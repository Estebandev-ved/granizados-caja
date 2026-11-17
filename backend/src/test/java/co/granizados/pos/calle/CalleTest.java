package co.granizados.pos.calle;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import co.granizados.pos.PruebaIntegracion;
import co.granizados.pos.equipo.EquipoService;
import co.granizados.pos.equipo.EquipoService.NuevoVendedor;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/** Plan de ventas en la calle: precios y comisiones de la calle, veredicto por lugar y botón de alerta. */
@AutoConfigureMockMvc
class CalleTest extends PruebaIntegracion {

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

    private MockHttpServletRequestBuilder dueno(MockHttpServletRequestBuilder req) {
        return req.with(jwt().jwt(j -> j.claim("negocio_id", 1))).contentType(MediaType.APPLICATION_JSON);
    }

    private void prender() {
        jdbc.update("update config set valor = '1' where clave = 'CALLE_ACTIVO'");
        jdbc.update("update config set valor = '7000' where clave = 'CALLE_PRECIO_NORMAL'");
        jdbc.update("update config set valor = '1800' where clave = 'CALLE_COM_NORMAL'");
        jdbc.update("update config set valor = '1500' where clave = 'CALLE_COM_COMBO'");
    }

    private void salida(String token, String uid, String lugar, String inicio) throws Exception {
        mvc.perform(con(token, post("/api/calle/salidas")).content("{\"clientUid\":\"" + uid + "\",\"lugar\":\"" + lugar
                        + "\",\"lat\":6.2676,\"lng\":-75.5681,\"inicio\":\"" + inicio + "\"}"))
                .andExpect(status().isOk());
    }

    private void vender(String token, String uid, int cantidad, Long total, String salida, String cuando) throws Exception {
        mvc.perform(con(token, post("/api/ventas")).content("{\"clientUid\":\"" + uid + "\",\"productoId\":" + idDe("Smirnoff")
                        + ",\"metodo\":\"EFECTIVO\",\"cantidad\":" + cantidad + (total == null ? "" : ",\"total\":" + total)
                        + (salida == null ? "" : ",\"salidaUid\":\"" + salida + "\"")
                        + (cuando == null ? "" : ",\"creadaEn\":\"" + cuando + "\"") + "}"))
                .andExpect(status().isOk());
    }

    private Long precioUnitario(String uid) {
        return jdbc.queryForObject("select total / cantidad from venta where client_uid = ?", Long.class, uid);
    }

    private Long comision(String uid) {
        return jdbc.queryForObject("select comision_unitaria from venta where client_uid = ?", Long.class, uid);
    }

    @Test
    void enLaCalleConElPlanPrendidoSeCobraElPrecioYLaComisionDeLaCalle() throws Exception {
        prender();
        equipo.crear(new NuevoVendedor("Juan", "1111", 10));
        String token = entrar("1111");
        salida(token, "s1", "La Kurva", "2026-09-25T16:00:00Z");

        vender(token, "v-calle", 1, null, "s1", null);
        vender(token, "v-u", 1, null, null, null);

        assertThat(precioUnitario("v-calle")).isEqualTo(7000);
        assertThat(comision("v-calle")).isEqualTo(1800);
        // Sin salida se vende como siempre: precio de lista y su porcentaje
        assertThat(precioUnitario("v-u")).isEqualTo(6000);
        assertThat(jdbc.queryForObject("select comision_unitaria from venta where client_uid = 'v-u'", Long.class)).isNull();
    }

    @Test
    void conElPlanApagadoUnaVentaConSalidaCobraElPrecioDeSiempre() throws Exception {
        equipo.crear(new NuevoVendedor("Juan", "1111", 10));
        String token = entrar("1111");
        salida(token, "s1", "La Kurva", "2026-09-25T16:00:00Z");

        vender(token, "v1", 1, null, "s1", null);

        assertThat(precioUnitario("v1")).isEqualTo(6000);
    }

    @Test
    void elComboEnLaCallePagaLaComisionDeCombo() throws Exception {
        prender();
        equipo.crear(new NuevoVendedor("Juan", "1111", 10));
        String token = entrar("1111");
        salida(token, "s1", "La Kurva", "2026-09-25T16:00:00Z");

        // 2 por $13.000 es menos que 2 × $7.000: es promo y gana la tarifa de combo
        vender(token, "combo", 2, 13000L, "s1", null);

        assertThat(comision("combo")).isEqualTo(1500);
        assertThat(precioUnitario("combo")).isEqualTo(6500);
    }

    @Test
    void noSePuedeCobrarMasQueElPrecioDeLaCalle() throws Exception {
        prender();
        equipo.crear(new NuevoVendedor("Juan", "1111", 10));
        String token = entrar("1111");
        salida(token, "s1", "La Kurva", "2026-09-25T16:00:00Z");

        vender(token, "caro", 1, 9000L, "s1", null);

        assertThat(precioUnitario("caro")).isEqualTo(7000);
    }

    @Test
    void empezarDosVecesLaMismaSalidaNoLaDuplica() throws Exception {
        equipo.crear(new NuevoVendedor("Juan", "1111", 10));
        String token = entrar("1111");
        salida(token, "s1", "La Kurva", "2026-09-25T16:00:00Z");
        salida(token, "s1", "La Kurva", "2026-09-25T16:00:00Z");

        assertThat(jdbc.queryForObject("select count(*) from salida_calle", Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select count(*) from lugar_venta", Integer.class)).isEqualTo(1);
    }

    @Test
    void elVeredictoDelLugarSaleDeLosGranizadosEnCuatroHoras() throws Exception {
        prender();
        equipo.crear(new NuevoVendedor("Juan", "1111", 10));
        String token = entrar("1111");
        salida(token, "bueno", "La Kurva", "2026-09-25T16:00:00Z");
        vender(token, "b1", 25, null, "bueno", "2026-09-25T17:00:00Z");
        mvc.perform(con(token, post("/api/calle/salidas/bueno/terminar"))
                        .content("{\"fin\":\"2026-09-25T20:00:00Z\",\"pasaje\":7800}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unidades").value(25))
                .andExpect(jsonPath("$.pasajeADevolver").value(0))
                .andExpect(jsonPath("$.veredicto").value("BUENO"));

        salida(token, "malo", "Parque del Periodista", "2026-09-25T16:00:00Z");
        vender(token, "m1", 10, null, "malo", "2026-09-25T17:00:00Z");
        mvc.perform(con(token, post("/api/calle/salidas/malo/terminar"))
                        .content("{\"fin\":\"2026-09-25T20:00:00Z\",\"pasaje\":7800,\"incidentes\":\"POLICIA\"}"))
                .andExpect(status().isOk())
                // Vendió menos de 12: se le devuelve el pasaje
                .andExpect(jsonPath("$.pasajeADevolver").value(7800))
                .andExpect(jsonPath("$.veredicto").value("MALO"));

        mvc.perform(dueno(get("/api/calle/resumen"))).andExpect(status().isOk())
                .andExpect(jsonPath("$.lugares[0].nombre").value("La Kurva"))
                .andExpect(jsonPath("$.lugares[0].veredicto").value("BUENO"))
                .andExpect(jsonPath("$.lugares[0].ritmo4h").value(25))
                .andExpect(jsonPath("$.lugares[0].lat").value(6.2676))
                .andExpect(jsonPath("$.lugares[1].nombre").value("Parque del Periodista"))
                .andExpect(jsonPath("$.lugares[1].veredicto").value("MALO"))
                .andExpect(jsonPath("$.salidas.length()").value(2));
    }

    @Test
    void unaSalidaDeMenosDeUnaHoraNoDaVeredicto() throws Exception {
        equipo.crear(new NuevoVendedor("Juan", "1111", 10));
        String token = entrar("1111");
        salida(token, "corta", "La Kurva", "2026-09-25T19:30:00Z");
        vender(token, "c1", 2, null, "corta", "2026-09-25T19:45:00Z");

        mvc.perform(dueno(get("/api/calle/resumen"))).andExpect(status().isOk())
                .andExpect(jsonPath("$.lugares[0].veredicto").value("SIN_DATOS"));
    }

    @Test
    void elTrabajadorNoVeElResumenDelDuenoPeroSiLosLugares() throws Exception {
        equipo.crear(new NuevoVendedor("Juan", "1111", 10));
        String token = entrar("1111");

        mvc.perform(con(token, get("/api/calle/resumen"))).andExpect(status().isForbidden());
        mvc.perform(con(token, get("/api/calle/lugares"))).andExpect(status().isOk());
    }

    @Test
    void laAlertaLlegaAlDuenoConQuienDondeYUnLinkAlMapa() throws Exception {
        equipo.crear(new NuevoVendedor("Juan", "1111", 10));
        String token = entrar("1111");
        salida(token, "s1", "La Kurva", "2026-09-25T16:00:00Z");

        mvc.perform(con(token, post("/api/calle/sos")).content("{\"clientUid\":\"a1\",\"tipo\":\"HURTO\",\"lat\":6.25,\"lng\":-75.57}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.tipo").value("HURTO"))
                .andExpect(jsonPath("$.lugar").value("La Kurva"));

        verify(notificador, timeout(2000)).enviar(eq("🚨 HURTO · Juan"),
                contains("https://maps.google.com/?q=6.25,-75.57"));
        // El mismo uid otra vez no manda otro aviso ni guarda otra fila
        mvc.perform(con(token, post("/api/calle/sos")).content("{\"clientUid\":\"a1\",\"tipo\":\"HURTO\",\"lat\":6.25,\"lng\":-75.57}"))
                .andExpect(status().isOk());
        assertThat(jdbc.queryForObject("select count(*) from alerta_sos", Integer.class)).isEqualTo(1);

        mvc.perform(dueno(get("/api/calle/resumen"))).andExpect(jsonPath("$.alertas[0].quien").value("Juan"))
                .andExpect(jsonPath("$.lugares[0].alertas").value(1));
    }

    @Test
    void laAlertaSinUbicacionLeDiceAlDuenoQueLlameYa() throws Exception {
        equipo.crear(new NuevoVendedor("Juan", "1111", 10));
        String token = entrar("1111");

        mvc.perform(con(token, post("/api/calle/sos")).content("{\"clientUid\":\"a2\",\"tipo\":\"POLICIA\"}"))
                .andExpect(status().isOk());

        verify(notificador, timeout(2000)).enviar(eq("🚓 POLICÍA · Juan"), contains("No se pudo tomar la ubicación"));
    }

    @Test
    void elEstadoLlevaLosAjustesDeLaCalleATodos() throws Exception {
        prender();
        equipo.crear(new NuevoVendedor("Juan", "1111", 10));
        String token = entrar("1111");

        mvc.perform(con(token, get("/api/estado"))).andExpect(status().isOk())
                .andExpect(jsonPath("$.calle.activo").value(true))
                .andExpect(jsonPath("$.calle.precios.NORMAL").value(7000))
                .andExpect(jsonPath("$.calle.comisiones.NORMAL").value(1800));
    }
}
