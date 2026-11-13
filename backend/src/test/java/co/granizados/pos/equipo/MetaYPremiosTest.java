package co.granizados.pos.equipo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import co.granizados.pos.PruebaIntegracion;
import co.granizados.pos.equipo.EquipoService.NuevoVendedor;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/** El trabajador ve cuánto gana por granizado y escoge su meta del día; el dueño recibe los datos para armar premios. */
@AutoConfigureMockMvc
class MetaYPremiosTest extends PruebaIntegracion {

    @Autowired
    EquipoService equipo;

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

    private void vender(String token, String uid, int cantidad, Long total) throws Exception {
        mvc.perform(con(token, post("/api/ventas")).content("{\"clientUid\":\"" + uid + "\",\"productoId\":" + idDe("Smirnoff")
                        + ",\"metodo\":\"EFECTIVO\",\"cantidad\":" + cantidad + (total == null ? "" : ",\"total\":" + total) + "}"))
                .andExpect(status().isOk());
    }

    private void tarifas() {
        jdbc.update("update config set valor = '1000' where clave = 'COMISION_NORMAL'");
        jdbc.update("update config set valor = '1500' where clave = 'COMISION_CREMOSO'");
        jdbc.update("update config set valor = '700' where clave = 'COMISION_PROMO'");
        jdbc.update("update config set valor = '5000' where clave = 'PREMIO_REBAJA_PROMO'");
    }

    @Test
    void elTrabajadorVeCuantoGanaPorGranizadoYEnPromo() throws Exception {
        tarifas();
        equipo.crear(new NuevoVendedor("Juan", "1111", 10));

        mvc.perform(con(entrar("1111"), get("/api/estado"))).andExpect(status().isOk())
                .andExpect(jsonPath("$.premios.tarifas.normal").value(1000))
                .andExpect(jsonPath("$.premios.tarifas.cremoso").value(1500))
                .andExpect(jsonPath("$.premios.tarifas.promo").value(700))
                .andExpect(jsonPath("$.premios.tarifas.rebajaPromo").value(5000))
                .andExpect(jsonPath("$.premios.tarifas.porcentaje").doesNotExist());
    }

    @Test
    void sinTarifasPorGranizadoVeSuPorcentaje() throws Exception {
        equipo.crear(new NuevoVendedor("Juan", "1111", 12));

        mvc.perform(con(entrar("1111"), get("/api/estado"))).andExpect(jsonPath("$.premios.tarifas.porcentaje").value(12));
    }

    @Test
    void elTrabajadorEscogeSuMetaDelDiaYLaPuedeSubir() throws Exception {
        var juan = equipo.crear(new NuevoVendedor("Juan", "1111", 10));
        String token = entrar("1111");
        mvc.perform(con(token, get("/api/estado"))).andExpect(jsonPath("$.premios.metaPropia").doesNotExist());

        mvc.perform(con(token, post("/api/mi-turno/meta")).content("{\"meta\":20}")).andExpect(status().isOk())
                .andExpect(jsonPath("$.metaPropia").value(20));
        mvc.perform(con(token, post("/api/mi-turno/meta")).content("{\"meta\":25}")).andExpect(status().isOk());
        mvc.perform(con(token, post("/api/mi-turno/meta")).content("{\"meta\":0}")).andExpect(status().isBadRequest());

        assertThat(equipo.listar().getFirst().metaHoy()).isEqualTo(25);
        assertThat(contar("meta_vendedor")).isEqualTo(1);
        // Al otro día arranca sin meta
        reloj.avanzar(Duration.ofDays(1));
        assertThat(equipo.listar().getFirst().metaHoy()).isNull();
        assertThat(juan.id()).isNotNull();
    }

    @Test
    void elDuenoNoPoneMetasPorElTrabajador() throws Exception {
        mvc.perform(con(entrar("4321"), post("/api/mi-turno/meta")).content("{\"meta\":20}")).andExpect(status().isForbidden());
    }

    @Test
    void losDatosDePremiosSalenDeLasVentasDeLasUltimasSemanas() throws Exception {
        tarifas();
        jdbc.update("update producto set costo = 2200");
        equipo.crear(new NuevoVendedor("Juan", "1111", 10));
        String token = entrar("1111");
        int[] porDia = {10, 14, 16, 18, 20, 12};
        for (int d = 0; d < porDia.length; d++) {
            vender(token, "v-" + d, porDia[d], null);
            reloj.avanzar(Duration.ofDays(1));
        }
        vender(token, "promo", 2, 10_000L); // hoy: no cuenta

        var datos = equipo.datosPremios();

        assertThat(datos.diasAnalizados()).isEqualTo(6);
        assertThat(datos.base()).isEqualTo(16); // la mediana de 10, 12, 14, 16, 18, 20
        assertThat(datos.mejorDia()).isEqualTo(20);
        // Cada granizado normal: 6.000 − 2.200 de costo − 1.000 de comisión
        assertThat(datos.margenNormal()).isEqualTo(2_800);
        assertThat(datos.margenPromo()).isNull();
        assertThat(datos.pocosDatos()).isFalse();
        assertThat(datos.faltanCostos()).isFalse();

        reloj.avanzar(Duration.ofDays(1));
        // La venta en promo (2 x 10.000) deja (10.000 − 4.400 − 2 × 700) / 2 por granizado
        assertThat(equipo.datosPremios().margenPromo()).isEqualTo(2_100);
    }

    @Test
    void conPocosDiasLaBaseEsUnaEstimacion() {
        var datos = equipo.datosPremios();

        assertThat(datos.pocosDatos()).isTrue();
        assertThat(datos.base()).isEqualTo(15);
        assertThat(datos.sinTarifas()).isTrue();
    }

    @Test
    void laProyeccionSaleDeComoVieneVendiendoElTrabajador() throws Exception {
        tarifas();
        jdbc.update("update config set valor = '12:2000,15:4000' where clave = 'PREMIOS_ESCALONES'");
        equipo.crear(new NuevoVendedor("Juan", "1111", 10));
        String token = entrar("1111");
        // Cuatro días seguidos: 10, 12, 16 y 14 granizados, con dos horas entre la primera y la última venta
        int[] porDia = {10, 12, 16, 14};
        for (int d = 0; d < porDia.length; d++) {
            vender(token, "a-" + d, porDia[d] - 1, null);
            reloj.avanzar(Duration.ofHours(2));
            vender(token, "b-" + d, 1, null);
            reloj.avanzar(Duration.ofHours(22));
        }
        vender(token, "hoy", 3, null); // hoy no cuenta para el promedio

        // Ganó 10.000, 12.000 + 2.000, 16.000 + 4.000 y 14.000 + 2.000: 60.000 en 4 días
        mvc.perform(con(token, get("/api/mi-turno/proyeccion"))).andExpect(status().isOk())
                .andExpect(jsonPath("$.dias").value(4))
                .andExpect(jsonPath("$.unidadesDia").value(13))
                .andExpect(jsonPath("$.ganaDia").value(15_000))
                .andExpect(jsonPath("$.mejorUnidades").value(16))
                .andExpect(jsonPath("$.mejorGana").value(20_000))
                .andExpect(jsonPath("$.diasSemana").value(4.0))
                .andExpect(jsonPath("$.minutosDia").value(120))
                .andExpect(jsonPath("$.primeraHoy").exists())
                // Lo que se le debe: los 60.000 de antes más los 3.000 de hoy
                .andExpect(jsonPath("$.pendiente").value(63_000));

        // El dueño ve la de todos; el trabajador no ve la de los demás ni el dueño pide la suya
        String dueno = entrar("4321");
        mvc.perform(con(dueno, get("/api/equipo/proyeccion"))).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].nombre").value("Juan"))
                .andExpect(jsonPath("$[0].ganaDia").value(15_000));
        mvc.perform(con(token, get("/api/equipo/proyeccion"))).andExpect(status().isForbidden());
        mvc.perform(con(dueno, get("/api/mi-turno/proyeccion"))).andExpect(status().isForbidden());
    }

    @Test
    void unTrabajadorNuevoNoTieneDatosParaLaProyeccion() throws Exception {
        equipo.crear(new NuevoVendedor("Ana", "2222", 10));

        mvc.perform(con(entrar("2222"), get("/api/mi-turno/proyeccion"))).andExpect(status().isOk())
                .andExpect(jsonPath("$.dias").value(0))
                .andExpect(jsonPath("$.ganaDia").value(0))
                .andExpect(jsonPath("$.minutosDia").value(0))
                .andExpect(jsonPath("$.primeraHoy").doesNotExist());
    }
}
