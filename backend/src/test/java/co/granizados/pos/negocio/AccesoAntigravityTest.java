package co.granizados.pos.negocio;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import co.granizados.pos.PruebaIntegracion;
import co.granizados.pos.producto.Producto;
import co.granizados.pos.producto.ProductoRepository;
import co.granizados.pos.producto.TipoProducto;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import javax.crypto.spec.SecretKeySpec;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Entrar a la caja con la cuenta de Antigravity: el token lo firma Antigravity con su propio secreto
 * (CAJA_JWT_SECRET), con emisor "antigravity", audiencia "caja" y el negocio_id del negocio.
 */
@AutoConfigureMockMvc
@TestPropertySource(properties = "app.antigravity.jwt-secret=secreto-de-prueba-de-antigravity-32bytes!!")
class AccesoAntigravityTest extends PruebaIntegracion {

    private static final String SECRETO = "secreto-de-prueba-de-antigravity-32bytes!!";

    @Autowired
    MockMvc mvc;

    @Autowired
    ProductoRepository productos;

    @Autowired
    NegocioService negocios;

    @BeforeEach
    void negocioDosConUnaCamisa() {
        negocios.olvidar();
        TenantContext.poner(2L);
        try {
            negocios.asegurar(2);
            productos.saveAndFlush(new Producto("Camisa", TipoProducto.NORMAL, 50_000, 2, 1));
        } finally {
            TenantContext.limpiar();
        }
    }

    private String token(String secreto, String emisor, String audiencia, Object negocioId, String estado, Duration vigencia) {
        Instant ahora = Instant.now();
        Instant expira = ahora.plus(vigencia);
        // Un token ya vencido se emitió antes de vencer
        Instant emitido = vigencia.isNegative() ? expira.minus(Duration.ofHours(1)) : ahora.minus(Duration.ofMinutes(1));
        JwtClaimsSet.Builder claims = JwtClaimsSet.builder()
                .issuer(emisor)
                .audience(List.of(audiencia))
                .claim("nombre", "Mi negocio")
                .claim("plan", "emprendedor")
                .claim("estado", estado)
                .issuedAt(emitido)
                .expiresAt(expira);
        if (negocioId != null) claims.claim("negocio_id", negocioId);
        var encoder = new NimbusJwtEncoder(new ImmutableSecret<>(new SecretKeySpec(secreto.getBytes(StandardCharsets.UTF_8), "HmacSHA256")));
        return encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims.build())).getTokenValue();
    }

    private String valido(Object negocioId, String estado) {
        return token(SECRETO, "antigravity", "caja", negocioId, estado, Duration.ofHours(12));
    }

    @Test
    void elTokenDeAntigravityDaAccesoSoloAlNegocioQueDice() throws Exception {
        mvc.perform(get("/api/productos").header("Authorization", "Bearer " + valido(2, "activo")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].sabor").value("Camisa"));
    }

    @Test
    void unTokenConOtraFirmaOSecretoDistintoNoEntra() throws Exception {
        String falso = token("otro-secreto-que-no-es-el-de-antigravity-123", "antigravity", "caja", 2, "activo", Duration.ofHours(1));
        mvc.perform(get("/api/productos").header("Authorization", "Bearer " + falso)).andExpect(status().isUnauthorized());
    }

    @Test
    void unTokenParaOtraAudienciaOEmisorNoEntra() throws Exception {
        String otraAudiencia = token(SECRETO, "antigravity", "otra-app", 2, "activo", Duration.ofHours(1));
        String otroEmisor = token(SECRETO, "alguien-mas", "caja", 2, "activo", Duration.ofHours(1));
        mvc.perform(get("/api/productos").header("Authorization", "Bearer " + otraAudiencia)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/productos").header("Authorization", "Bearer " + otroEmisor)).andExpect(status().isUnauthorized());
    }

    @Test
    void unTokenVencidoOSinNegocioNoEntra() throws Exception {
        String vencido = token(SECRETO, "antigravity", "caja", 2, "activo", Duration.ofSeconds(-120));
        mvc.perform(get("/api/productos").header("Authorization", "Bearer " + vencido)).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/productos").header("Authorization", "Bearer " + valido(null, "activo"))).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/productos").header("Authorization", "Bearer " + valido(0, "activo"))).andExpect(status().isUnauthorized());
    }

    @Test
    void conLaSuscripcionVencidaSoloSePuedeMirar() throws Exception {
        String vencida = valido(2, "vencido");

        mvc.perform(get("/api/productos").header("Authorization", "Bearer " + vencida)).andExpect(status().isOk());
        mvc.perform(post("/api/gastos").header("Authorization", "Bearer " + vencida).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"clientUid\":\"g-1\",\"categoria\":\"HIELO\",\"concepto\":\"\",\"monto\":1000}"))
                .andExpect(status().isPaymentRequired())
                .andExpect(jsonPath("$.error").exists());
        // Y no quedó nada guardado
        org.assertj.core.api.Assertions.assertThat(contar("gasto")).isZero();
    }

    @Test
    void conLaSuscripcionActivaSiSePuedeEscribir() throws Exception {
        mvc.perform(post("/api/gastos").header("Authorization", "Bearer " + valido(2, "activo")).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"clientUid\":\"g-1\",\"categoria\":\"HIELO\",\"concepto\":\"\",\"monto\":1000}"))
                .andExpect(status().isOk());
        // El gasto es del negocio 2: el 1 no lo ve
        org.assertj.core.api.Assertions.assertThat(
                jdbc.queryForObject("select negocio_id from gasto where client_uid = 'g-1'", Long.class)).isEqualTo(2L);
    }
}
