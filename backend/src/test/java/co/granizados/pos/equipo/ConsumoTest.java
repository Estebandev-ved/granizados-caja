package co.granizados.pos.equipo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import co.granizados.pos.PruebaIntegracion;
import co.granizados.pos.equipo.EquipoService.Carga;
import co.granizados.pos.equipo.EquipoService.ItemCarga;
import co.granizados.pos.equipo.EquipoService.NuevoVendedor;
import co.granizados.pos.plata.PlataService;
import co.granizados.pos.resumen.EstadoService;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * El trabajador se toma (o compra) un granizado de su carga: el del día es gratis y del siguiente en adelante se le
 * descuenta de su pago. No es una venta: no entra plata, no gana comisión y no cuenta para sus premios.
 */
@AutoConfigureMockMvc
class ConsumoTest extends PruebaIntegracion {

    @Autowired
    EquipoService equipo;

    @Autowired
    EstadoService estado;

    @Autowired
    PlataService plata;

    @Autowired
    MockMvc mvc;

    private String entrar(String pin) throws Exception {
        String cuerpo = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content("{\"pin\":\"" + pin + "\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return cuerpo.replaceAll(".*\"token\":\"([^\"]+)\".*", "$1");
    }

    private MockHttpServletRequestBuilder con(String token, MockHttpServletRequestBuilder req) {
        return req.header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON);
    }

    private String venta(String uid, String metodo, int cantidad) {
        return "{\"clientUid\":\"" + uid + "\",\"productoId\":" + idDe("Smirnoff") + ",\"metodo\":\"" + metodo
                + "\",\"cantidad\":" + cantidad + "}";
    }

    private void vender(String token, String uid, String metodo, int cantidad) throws Exception {
        mvc.perform(con(token, post("/api/ventas")).content(venta(uid, metodo, cantidad)))
                .andExpect(status().isOk()).andExpect(jsonPath("$.estado").value("REGISTRADA"));
    }

    private long cargoDe(String uid) {
        return jdbc.queryForObject("select cargo_vendedor from venta where client_uid = ?", Long.class, uid);
    }

    @Test
    void elPrimeroDelDiaEsGratisYElSiguienteSeLeDescuenta() throws Exception {
        var juan = equipo.crear(new NuevoVendedor("Juan", "1111", 10));
        equipo.cargar(juan.id(), new Carga(List.of(new ItemCarga(idDe("Smirnoff"), 5))));
        String token = entrar("1111");
        int antes = stockDe("Smirnoff");

        vender(token, "v-1", "EFECTIVO", 2);
        vender(token, "c-1", "CONSUMO", 1);
        vender(token, "c-2", "CONSUMO", 1);

        assertThat(cargoDe("c-1")).isZero();
        assertThat(cargoDe("c-2")).isEqualTo(6000);
        assertThat(stockDe("Smirnoff")).isEqualTo(antes - 4);

        // El trabajador: vendió 2 (no 4), le queda 1 de los 5 y ve lo que se le descuenta
        mvc.perform(con(token, get("/api/estado"))).andExpect(status().isOk())
                .andExpect(jsonPath("$.hoy.unidades").value(2))
                .andExpect(jsonPath("$.hoy.total").value(12000))
                .andExpect(jsonPath("$.hoy.efectivo").value(12000))
                .andExpect(jsonPath("$.premios.vendidas").value(2))
                .andExpect(jsonPath("$.premios.comision").value(1200))
                .andExpect(jsonPath("$.premios.consumidos").value(2))
                .andExpect(jsonPath("$.premios.descuento").value(6000))
                .andExpect(jsonPath("$.productos[?(@.sabor == 'Smirnoff')].stock").value(1));

        // El dueño: no entró plata por lo que se tomó
        var hoy = estado.estado().hoy();
        assertThat(hoy.total()).isEqualTo(12000);
        assertThat(hoy.efectivo()).isEqualTo(12000);
        assertThat(hoy.nequi()).isZero();

        var cuentas = equipo.liquidar(equipo.hoy(), equipo.hoy()).getFirst();
        assertThat(cuentas.unidades()).isEqualTo(2);
        assertThat(cuentas.comision()).isEqualTo(1200);
        assertThat(cuentas.consumidos()).isEqualTo(2);
        assertThat(cuentas.consumos()).isEqualTo(6000);
        assertThat(cuentas.saldo()).isEqualTo(12000 - 1200 + 6000);
        assertThat(equipo.listar().getFirst().unidadesHoy()).isEqualTo(2);
    }

    @Test
    void variosDeUnaVezSoloElDelDiaSaleGratis() throws Exception {
        equipo.crear(new NuevoVendedor("Juan", "1111", 10));
        String token = entrar("1111");

        vender(token, "c-1", "CONSUMO", 3);

        assertThat(cargoDe("c-1")).isEqualTo(12000);
        assertThat(jdbc.queryForObject("select total from venta where client_uid = 'c-1'", Long.class)).isZero();
    }

    @Test
    void sinGranizadosGratisSeCobraDesdeElPrimero() throws Exception {
        jdbc.update("update config set valor = '0' where clave = 'GRANIZADOS_GRATIS'");
        equipo.crear(new NuevoVendedor("Juan", "1111", 10));
        String token = entrar("1111");

        vender(token, "c-1", "CONSUMO", 1);

        assertThat(cargoDe("c-1")).isEqualTo(6000);
    }

    @Test
    void alBorrarElGratisElSiguientePasaASerElGratis() throws Exception {
        equipo.crear(new NuevoVendedor("Juan", "1111", 10));
        String token = entrar("1111");
        int antes = stockDe("Smirnoff");
        vender(token, "c-1", "CONSUMO", 1);
        reloj.avanzar(Duration.ofMinutes(1));
        vender(token, "c-2", "CONSUMO", 1);
        assertThat(cargoDe("c-2")).isEqualTo(6000);

        mvc.perform(con(token, delete("/api/ventas/c-1"))).andExpect(status().isNoContent());

        assertThat(cargoDe("c-2")).isZero();
        assertThat(stockDe("Smirnoff")).isEqualTo(antes - 1);
    }

    @Test
    void elDuenoNoAnotaConsumosDesdeSuCaja() throws Exception {
        String dueno = entrar("4321");

        mvc.perform(con(dueno, post("/api/ventas")).content(venta("c-1", "CONSUMO", 1))).andExpect(status().isBadRequest());

        assertThat(contar("venta")).isZero();
    }

    @Test
    void alCerrarElDiaEntregaTambienLoQueSeTomo() throws Exception {
        equipo.crear(new NuevoVendedor("Juan", "1111", 10));
        String token = entrar("1111");
        vender(token, "v-1", "EFECTIVO", 2);
        vender(token, "c-1", "CONSUMO", 2);

        mvc.perform(con(token, post("/api/mi-turno/cierre"))).andExpect(status().isOk())
                .andExpect(jsonPath("$.unidades").value(2))
                .andExpect(jsonPath("$.comision").value(1200))
                .andExpect(jsonPath("$.consumidos").value(2))
                .andExpect(jsonPath("$.consumos").value(6000))
                .andExpect(jsonPath("$.entregar").value(12000 - 1200 + 6000));
    }

    @Test
    void elPagoSaleConElDescuentoDeLoQueSeTomo() throws Exception {
        var juan = equipo.crear(new NuevoVendedor("Juan", "1111", 10));
        String token = entrar("1111");
        vender(token, "v-1", "NEQUI", 20); // 120.000 vendidos, 12.000 de comisión
        vender(token, "c-1", "CONSUMO", 2); // uno gratis y otro de 6.000

        assertThat(equipo.listar().getFirst().porPagar()).isEqualTo(6000);
        var pago = equipo.pagar(juan.id(), PagoVendedor.Metodo.EFECTIVO, null);

        assertThat(pago.monto()).isEqualTo(6000);
        assertThat(pago.comision()).isEqualTo(12000);
        assertThat(pago.consumos()).isEqualTo(6000);
        assertThat(pago.unidades()).isEqualTo(20);
        assertThat(pago.texto()).contains("ya descontados $6.000");
        // Las cuentas arrancan de cero: el consumo ya quedó cobrado en ese pago
        reloj.avanzar(Duration.ofMinutes(1));
        assertThat(equipo.cuenta(juan.id()).pendiente().consumos()).isZero();
    }

    @Test
    void elConsumoNoMueveLaPlataDeLaCajaNiDeNequi() throws Exception {
        equipo.crear(new NuevoVendedor("Juan", "1111", 10));
        String token = entrar("1111");
        plata.contar(new PlataService.NuevoConteo("c-0", 10_000, 0, 20_000));
        reloj.avanzar(Duration.ofMinutes(1));

        vender(token, "c-1", "CONSUMO", 2);

        var saldo = plata.saldo();
        assertThat(saldo.caja()).isEqualTo(10_000);
        assertThat(saldo.nequi()).isEqualTo(20_000);
    }
}
