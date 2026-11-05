package co.granizados.pos.equipo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import co.granizados.pos.PruebaIntegracion;
import co.granizados.pos.equipo.EquipoService.Carga;
import co.granizados.pos.equipo.EquipoService.ItemCarga;
import co.granizados.pos.equipo.EquipoService.NuevoVendedor;
import java.time.Duration;
import java.time.LocalDate;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.context.event.ApplicationEvents;
import org.springframework.test.context.event.RecordApplicationEvents;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/** Trabajadores dentro de la misma caja: PIN propio, solo venden, carga en el servidor y cuentas por persona. */
@AutoConfigureMockMvc
@RecordApplicationEvents
class EquipoTest extends PruebaIntegracion {

    @Autowired
    EquipoService equipo;

    @Autowired
    co.granizados.pos.ajustes.AjustesService ajustes;

    @Autowired
    MockMvc mvc;

    @Autowired
    ApplicationEvents eventos;

    private String entrar(String pin) throws Exception {
        String cuerpo = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content("{\"pin\":\"" + pin + "\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return cuerpo.replaceAll(".*\"token\":\"([^\"]+)\".*", "$1");
    }

    private MockHttpServletRequestBuilder con(String token, MockHttpServletRequestBuilder req) {
        return req.header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON);
    }

    private String venta(String uid, String metodo, int cantidad, String extra) {
        return "{\"clientUid\":\"" + uid + "\",\"productoId\":" + idDe("Smirnoff") + ",\"metodo\":\"" + metodo
                + "\",\"cantidad\":" + cantidad + extra + "}";
    }

    @Test
    void elPinDeUnTrabajadorNoPuedeRepetirseNiSerElDelDueno() {
        equipo.crear(new NuevoVendedor("Juan", "1111", 10));

        assertThatThrownBy(() -> equipo.crear(new NuevoVendedor("Pedro", "1111", 0))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> equipo.crear(new NuevoVendedor("Pedro", "4321", 0))).isInstanceOf(IllegalArgumentException.class);
        assertThat(equipo.listar()).hasSize(1);
    }

    @Test
    void conSuPinEntraElTrabajadorYConOtroNo() throws Exception {
        equipo.crear(new NuevoVendedor("Juan", "1111", 10));

        assertThat(entrar("1111")).isNotBlank();
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content("{\"pin\":\"2222\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void unTrabajadorSoloPuedeVenderNoVerLoDelDueno() throws Exception {
        equipo.crear(new NuevoVendedor("Juan", "1111", 10));
        String token = entrar("1111");

        for (String ruta : List.of("/api/reportes", "/api/equipo", "/api/plata", "/api/ajustes", "/api/fiados", "/api/pedidos")) {
            mvc.perform(con(token, get(ruta))).andExpect(status().isForbidden());
        }
        mvc.perform(con(token, get("/api/estado"))).andExpect(status().isOk());
    }

    @Test
    void laVentaDelTrabajadorQuedaConSuNombreYDescuentaDelInventarioDeLaCasa() throws Exception {
        var juan = equipo.crear(new NuevoVendedor("Juan", "1111", 10));
        String token = entrar("1111");
        int antes = stockDe("Smirnoff");

        mvc.perform(con(token, post("/api/ventas")).content(venta("t-1", "NEQUI", 2, "")))
                .andExpect(status().isOk()).andExpect(jsonPath("$.estado").value("REGISTRADA"));

        assertThat(stockDe("Smirnoff")).isEqualTo(antes - 2);
        assertThat(jdbc.queryForObject("select vendedor_id from venta where client_uid = 't-1'", Long.class)).isEqualTo(juan.id());
    }

    @Test
    void unTrabajadorNoPuedeFiar() throws Exception {
        equipo.crear(new NuevoVendedor("Juan", "1111", 0));
        String token = entrar("1111");

        mvc.perform(con(token, post("/api/ventas")).content(venta("t-1", "FIADO", 1, ",\"cliente\":\"Ana\"")))
                .andExpect(status().isBadRequest());
        assertThat(contar("venta")).isZero();
    }

    @Test
    void unTrabajadorSoloDeshaceLoSuyo() throws Exception {
        equipo.crear(new NuevoVendedor("Juan", "1111", 0));
        equipo.crear(new NuevoVendedor("Luis", "2222", 0));
        String juan = entrar("1111");
        String luis = entrar("2222");
        mvc.perform(con(juan, post("/api/ventas")).content(venta("t-1", "EFECTIVO", 1, ""))).andExpect(status().isOk());

        mvc.perform(con(luis, delete("/api/ventas/t-1"))).andExpect(status().isNotFound());
        assertThat(contar("venta")).isEqualTo(1);
        mvc.perform(con(juan, delete("/api/ventas/t-1"))).andExpect(status().isNoContent());
        assertThat(contar("venta")).isZero();
    }

    @Test
    void elTrabajadorVeSuCargaComoStockYNingunCosto() throws Exception {
        var juan = equipo.crear(new NuevoVendedor("Juan", "1111", 0));
        jdbc.update("update producto set costo = 3000");
        equipo.cargar(juan.id(), new Carga(List.of(new ItemCarga(idDe("Smirnoff"), 5))));
        String token = entrar("1111");

        mvc.perform(con(token, post("/api/ventas")).content(venta("t-1", "NEQUI", 2, ""))).andExpect(status().isOk());

        var cuerpo = mvc.perform(con(token, get("/api/estado"))).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        var smirnoff = com.fasterxml.jackson.databind.json.JsonMapper.builder().build().readTree(cuerpo);
        var productos = smirnoff.get("productos");
        long conStock = 0;
        for (var p : productos) {
            assertThat(p.get("costo").asLong()).isZero();
            if (p.get("sabor").asText().equals("Smirnoff")) assertThat(p.get("stock").asInt()).isEqualTo(3);
            else assertThat(p.get("stock").asInt()).isZero();
            if (p.get("stock").asInt() > 0) conStock++;
        }
        assertThat(conStock).isEqualTo(1);
        assertThat(smirnoff.get("hoy").get("total").asLong()).isEqualTo(12000);
        assertThat(smirnoff.get("hoy").get("costo").asLong()).isZero();
    }

    @Test
    void laCargaSoloCuentaLasVentasDeEseTrabajadorDesdeQueSeLaEntregaron() throws Exception {
        var juan = equipo.crear(new NuevoVendedor("Juan", "1111", 0));
        equipo.crear(new NuevoVendedor("Luis", "2222", 0));
        String tokenJuan = entrar("1111");
        String tokenLuis = entrar("2222");

        // Juan vendió una antes de que le entregaran la carga: no cuenta contra ella
        mvc.perform(con(tokenJuan, post("/api/ventas")).content(venta("antes", "EFECTIVO", 1, ""))).andExpect(status().isOk());
        reloj.avanzar(Duration.ofMinutes(5));
        var fila = equipo.cargar(juan.id(), new Carga(List.of(new ItemCarga(idDe("Smirnoff"), 6)))).getFirst();
        assertThat(fila.queda()).isEqualTo(6);

        reloj.avanzar(Duration.ofMinutes(5));
        mvc.perform(con(tokenJuan, post("/api/ventas")).content(venta("j-1", "EFECTIVO", 2, ""))).andExpect(status().isOk());
        mvc.perform(con(tokenLuis, post("/api/ventas")).content(venta("l-1", "EFECTIVO", 3, ""))).andExpect(status().isOk());

        var carga = equipo.listar().stream().filter(v -> v.id().equals(juan.id())).findFirst().orElseThrow().carga();
        assertThat(carga).singleElement().satisfies(f -> {
            assertThat(f.vendi()).isEqualTo(2);
            assertThat(f.queda()).isEqualTo(4);
        });

        // Editar la carga no borra lo vendido
        var editada = equipo.cargar(juan.id(), new Carga(List.of(new ItemCarga(idDe("Smirnoff"), 8)))).getFirst();
        assertThat(editada.vendi()).isEqualTo(2);
        assertThat(editada.queda()).isEqualTo(6);
        assertThat(equipo.cargar(juan.id(), new Carga(List.of()))).isEmpty();
    }

    @Test
    void elEstadoDelDuenoSumaTodoPeroSuCargaSoloCuentaLoQueVendioEl() throws Exception {
        var juan = equipo.crear(new NuevoVendedor("Juan", "1111", 0));
        String token = entrar("1111");
        mvc.perform(con(token, post("/api/ventas")).content(venta("j-1", "NEQUI", 3, ""))).andExpect(status().isOk());

        var dueno = estadoDelDueno();

        assertThat(dueno.hoy().unidades()).isEqualTo(3);
        assertThat(dueno.hoy().propias()).isEmpty();
        assertThat(juan.id()).isNotNull();
    }

    private co.granizados.pos.resumen.EstadoService.Estado estadoDelDueno() {
        return estadoService.estado();
    }

    @Autowired
    co.granizados.pos.resumen.EstadoService estadoService;

    @Test
    void laLiquidacionSeparaEfectivoNequiYComision() throws Exception {
        var juan = equipo.crear(new NuevoVendedor("Juan", "1111", 10));
        String token = entrar("1111");
        // 12.000 en efectivo y 6.000 por Nequi
        mvc.perform(con(token, post("/api/ventas")).content(venta("j-1", "EFECTIVO", 2, ""))).andExpect(status().isOk());
        mvc.perform(con(token, post("/api/ventas")).content(venta("j-2", "NEQUI", 1, ""))).andExpect(status().isOk());
        // Una venta mixta: 4.000 en efectivo y 2.000 por Nequi
        mvc.perform(con(token, post("/api/ventas")).content(venta("j-3", "MIXTO", 1, ",\"efectivo\":4000"))).andExpect(status().isOk());

        var l = equipo.liquidar(LocalDate.of(2026, 9, 25), LocalDate.of(2026, 9, 25)).getFirst();

        assertThat(l.vendedorId()).isEqualTo(juan.id());
        assertThat(l.unidades()).isEqualTo(4);
        assertThat(l.total()).isEqualTo(24000);
        assertThat(l.efectivo()).isEqualTo(16000);
        assertThat(l.nequi()).isEqualTo(8000);
        assertThat(l.comision()).isEqualTo(2400);
        assertThat(l.saldo()).isEqualTo(13600); // lo que debe entregar: efectivo menos su comisión
    }

    @Test
    void siSeDesactivaAlTrabajadorSuTokenDejaDeServir() throws Exception {
        var juan = equipo.crear(new NuevoVendedor("Juan", "1111", 0));
        String token = entrar("1111");
        mvc.perform(con(token, get("/api/estado"))).andExpect(status().isOk());

        equipo.cambiar(juan.id(), new EquipoService.CambioVendedor(null, null, null, false));

        mvc.perform(con(token, get("/api/estado"))).andExpect(status().isUnauthorized());
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content("{\"pin\":\"1111\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void sinMetaDelEquipoElTrabajadorNoTieneBarra() throws Exception {
        var juan = equipo.crear(new NuevoVendedor("Juan", "1111", 0));

        assertThat(equipo.metaDe(juan.id(), equipo.hoy())).isNull();
    }

    @Test
    void laMetaDelDiaCuentaLoVendidoYLaRachaDeDiasSeguidos() throws Exception {
        var juan = equipo.crear(new NuevoVendedor("Juan", "1111", 0));
        ajustes.actualizar("META_EQUIPO", "3");
        ajustes.actualizar("PREMIO_EQUIPO", "2000");
        String token = entrar("1111");

        // Ayer cumplió la meta (3 unidades) y hoy vende 2: todavía no la cumple
        reloj.avanzar(Duration.ofHours(-24));
        mvc.perform(con(token, post("/api/ventas")).content(venta("ayer", "EFECTIVO", 3, ""))).andExpect(status().isOk());
        reloj.avanzar(Duration.ofHours(24));
        mvc.perform(con(token, post("/api/ventas")).content(venta("h-1", "EFECTIVO", 2, ""))).andExpect(status().isOk());

        var parcial = equipo.metaDe(juan.id(), equipo.hoy());
        assertThat(parcial.unidades()).isEqualTo(3);
        assertThat(parcial.premio()).isEqualTo(2000);
        assertThat(parcial.vendidas()).isEqualTo(2);
        assertThat(parcial.racha()).isEqualTo(1); // la de ayer; hoy todavía no suma

        mvc.perform(con(token, post("/api/ventas")).content(venta("h-2", "NEQUI", 1, ""))).andExpect(status().isOk());

        var cumplida = equipo.metaDe(juan.id(), equipo.hoy());
        assertThat(cumplida.vendidas()).isEqualTo(3);
        assertThat(cumplida.racha()).isEqualTo(2);

        // El trabajador recibe su meta en el estado
        mvc.perform(con(token, get("/api/estado"))).andExpect(status().isOk())
                .andExpect(jsonPath("$.metaEquipo.unidades").value(3))
                .andExpect(jsonPath("$.metaEquipo.vendidas").value(3));
    }

    @Test
    void elPremioPorMetaSeDescuentaDelSaldoUnaVezPorDiaCumplido() throws Exception {
        equipo.crear(new NuevoVendedor("Juan", "1111", 10));
        ajustes.actualizar("META_EQUIPO", "3");
        ajustes.actualizar("PREMIO_EQUIPO", "2000");
        String token = entrar("1111");
        mvc.perform(con(token, post("/api/ventas")).content(venta("h-1", "EFECTIVO", 3, ""))).andExpect(status().isOk());

        var l = equipo.liquidar(LocalDate.of(2026, 9, 25), LocalDate.of(2026, 9, 25)).getFirst();

        assertThat(l.total()).isEqualTo(18000);
        assertThat(l.comision()).isEqualTo(1800);
        assertThat(l.diasMeta()).isEqualTo(1);
        assertThat(l.bonos()).isEqualTo(2000);
        assertThat(l.saldo()).isEqualTo(18000 - 1800 - 2000);
    }

    @Test
    void alBajarASuLimiteElDuenoRecibeUnSoloAvisoDeQueLeQuedanPocos() throws Exception {
        var juan = equipo.crear(new NuevoVendedor("Juan", "1111", 0));
        equipo.cargar(juan.id(), new Carga(List.of(new ItemCarga(idDe("Smirnoff"), 4))));
        String token = entrar("1111");

        mvc.perform(con(token, post("/api/ventas")).content(venta("p-1", "EFECTIVO", 1, ""))).andExpect(status().isOk());
        assertThat(eventos.stream(AvisoEquipo.class).count()).isZero(); // le quedan 3

        mvc.perform(con(token, post("/api/ventas")).content(venta("p-2", "EFECTIVO", 1, ""))).andExpect(status().isOk());
        assertThat(eventos.stream(AvisoEquipo.class).map(AvisoEquipo::texto).toList())
                .singleElement().asString().contains("Juan").contains("Smirnoff"); // le quedan 2

        mvc.perform(con(token, post("/api/ventas")).content(venta("p-3", "EFECTIVO", 1, ""))).andExpect(status().isOk());
        assertThat(eventos.stream(AvisoEquipo.class).count()).isEqualTo(1); // no repite
    }

    @Test
    void elTrabajadorCierraSuDiaYElDuenoRecibeElResumen() throws Exception {
        var juan = equipo.crear(new NuevoVendedor("Juan", "1111", 10));
        equipo.cargar(juan.id(), new Carga(List.of(new ItemCarga(idDe("Smirnoff"), 5))));
        String token = entrar("1111");
        mvc.perform(con(token, post("/api/ventas")).content(venta("c-1", "EFECTIVO", 2, ""))).andExpect(status().isOk());

        mvc.perform(con(token, post("/api/mi-turno/cierre")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.unidades").value(2))
                .andExpect(jsonPath("$.devuelve[0].queda").value(3));

        assertThat(eventos.stream(AvisoEquipo.class).map(AvisoEquipo::asunto).toList())
                .anyMatch(a -> a.contains("Juan") && a.contains("cerró"));
    }

    @Test
    void elDuenoNoCierraElDiaDeUnTrabajador() throws Exception {
        mvc.perform(con(entrar("4321"), post("/api/mi-turno/cierre"))).andExpect(status().isForbidden());
    }

    @Test
    void conTarifaPorGranizadoLaComisionEsPorUnidadYSeCongelaAlVender() throws Exception {
        equipo.crear(new NuevoVendedor("Juan", "1111", 50)); // el 50 % no cuenta mientras haya tarifas
        ajustes.actualizar("COMISION_NORMAL", "1000");
        String token = entrar("1111");
        mvc.perform(con(token, post("/api/ventas")).content(venta("t-1", "EFECTIVO", 2, ""))).andExpect(status().isOk());

        // Subir la tarifa después no cambia lo que ya se vendió
        ajustes.actualizar("COMISION_NORMAL", "2000");
        mvc.perform(con(token, post("/api/ventas")).content(venta("t-2", "NEQUI", 1, ""))).andExpect(status().isOk());

        var l = equipo.liquidar(LocalDate.of(2026, 9, 25), LocalDate.of(2026, 9, 25)).getFirst();
        assertThat(l.comision()).isEqualTo(2 * 1000 + 2000);
        assertThat(l.saldo()).isEqualTo(l.efectivo() - l.comision());
    }

    @Test
    void sinTarifasElTrabajadorSigueGanandoSuPorcentaje() throws Exception {
        equipo.crear(new NuevoVendedor("Juan", "1111", 10));
        String token = entrar("1111");
        mvc.perform(con(token, post("/api/ventas")).content(venta("p-1", "EFECTIVO", 2, ""))).andExpect(status().isOk());

        var l = equipo.liquidar(LocalDate.of(2026, 9, 25), LocalDate.of(2026, 9, 25)).getFirst();
        assertThat(l.comision()).isEqualTo(l.total() / 10);
    }

    @Test
    void unaTarifaConLetrasOMuyLargaSeRechaza() {
        assertThatThrownBy(() -> ajustes.actualizar("COMISION_CREMOSO", "mil")).isInstanceOf(IllegalArgumentException.class);
        assertThat(ajustes.actualizar("COMISION_CREMOSO", "1500").valor()).isEqualTo("1500");
    }

    @Test
    void elPremioDelDiaEsElDelEscalonMasAltoQueAlcanzoYSeSumaALaLiquidacion() throws Exception {
        equipo.crear(new NuevoVendedor("Juan", "1111", 0));
        ajustes.actualizar("PREMIOS_ESCALONES", "2:2000, 5:6000");
        String token = entrar("1111");

        mvc.perform(con(token, post("/api/ventas")).content(venta("e-1", "EFECTIVO", 1, ""))).andExpect(status().isOk());
        mvc.perform(con(token, get("/api/estado"))).andExpect(status().isOk())
                .andExpect(jsonPath("$.premios.premio").value(0))
                .andExpect(jsonPath("$.premios.siguiente.granizados").value(2));

        mvc.perform(con(token, post("/api/ventas")).content(venta("e-2", "EFECTIVO", 1, ""))).andExpect(status().isOk());
        mvc.perform(con(token, get("/api/estado"))).andExpect(jsonPath("$.premios.premio").value(2000));

        mvc.perform(con(token, post("/api/ventas")).content(venta("e-3", "EFECTIVO", 3, ""))).andExpect(status().isOk());
        mvc.perform(con(token, get("/api/estado")))
                .andExpect(jsonPath("$.premios.vendidas").value(5))
                .andExpect(jsonPath("$.premios.premio").value(6000));

        var l = equipo.liquidar(java.time.LocalDate.of(2026, 9, 25), java.time.LocalDate.of(2026, 9, 25)).getFirst();
        assertThat(l.bonos()).isEqualTo(6000);
        assertThat(l.saldo()).isEqualTo(l.efectivo() - l.comision() - 6000);
    }

    @Test
    void losEscalonesMalEscritosSeRechazan() {
        assertThatThrownBy(() -> ajustes.actualizar("PREMIOS_ESCALONES", "doce:2000")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> ajustes.actualizar("PREMIOS_ESCALONES", "15:4000,12:2000")).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> ajustes.actualizar("PREMIOS_ESCALONES", "12:4000,15:2000")).isInstanceOf(IllegalArgumentException.class);
        assertThat(ajustes.actualizar("PREMIOS_ESCALONES", "").valor()).isEmpty();
    }

    @Test
    void elTrabajadorAceptaLosTerminosYSiCambianLasTarifasHayQueAceptarOtraVez() throws Exception {
        var juan = equipo.crear(new NuevoVendedor("Juan", "1111", 0));
        ajustes.actualizar("COMISION_NORMAL", "1000");
        String token = entrar("1111");

        String cuerpo = mvc.perform(con(token, get("/api/mi-turno/terminos")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.aceptadaEn").doesNotExist())
                .andReturn().getResponse().getContentAsString();
        String version = cuerpo.replaceAll(".*\"version\":\"([^\"]+)\".*", "$1");

        mvc.perform(con(token, post("/api/mi-turno/terminos/aceptar")).content("{\"version\":\"otra\"}"))
                .andExpect(status().isBadRequest());
        mvc.perform(con(token, post("/api/mi-turno/terminos/aceptar")).content("{\"version\":\"" + version + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.aceptadaEn").exists());
        assertThat(contar("aceptacion_terminos")).isEqualTo(1);
        assertThat(equipo.listar().getFirst().terminosAceptadosEn()).isNotNull();

        // Aceptar dos veces no duplica la constancia
        mvc.perform(con(token, post("/api/mi-turno/terminos/aceptar")).content("{\"version\":\"" + version + "\"}"))
                .andExpect(status().isOk());
        assertThat(contar("aceptacion_terminos")).isEqualTo(1);

        // Al cambiar una tarifa cambia la versión y vuelve a quedar sin aceptar
        ajustes.actualizar("COMISION_NORMAL", "1200");
        mvc.perform(con(token, get("/api/mi-turno/terminos")))
                .andExpect(jsonPath("$.aceptadaEn").doesNotExist());
        assertThat(equipo.listar().getFirst().terminosAceptadosEn()).isNull();
        assertThat(juan.id()).isNotNull();
    }

    @Test
    void losTerminosDicenLoQueGanaYElGranizadoDeRegalo() throws Exception {
        equipo.crear(new NuevoVendedor("Juan", "1111", 0));
        ajustes.actualizar("COMISION_NORMAL", "1000");
        ajustes.actualizar("COMISION_CREMOSO", "1500");
        ajustes.actualizar("PREMIOS_ESCALONES", "12:2000");
        String token = entrar("1111");

        String texto = mvc.perform(con(token, get("/api/mi-turno/terminos"))).andReturn().getResponse().getContentAsString();
        assertThat(texto).contains("Normal $1.000").contains("Cremoso $1.500").contains("1 granizado por d")
                .contains("Los montos pueden variar")
                // Los premios no se escriben en los t\u00e9rminos: cambian y se ven en la barra de la app
                .doesNotContain("$2.000");
    }

    @Test
    void elDuenoNoVeLosTerminosDeUnTrabajador() throws Exception {
        mvc.perform(con(entrar("4321"), get("/api/mi-turno/terminos"))).andExpect(status().isForbidden());
    }

    @Test
    void enPromocionGanaLaTarifaDePromoYFueraDeEllaLaNormal() throws Exception {
        equipo.crear(new NuevoVendedor("Juan", "1111", 0));
        ajustes.actualizar("COMISION_NORMAL", "1000");
        ajustes.actualizar("COMISION_PROMO", "700");
        String token = entrar("1111");

        // 2 x $10.000 con el precio en $6.000: se cobr\u00f3 menos que precio x cantidad, es promo
        mvc.perform(con(token, post("/api/ventas")).content(venta("pr-1", "EFECTIVO", 2, ",\"total\":10000"))).andExpect(status().isOk());
        // Dos m\u00e1s a precio completo
        mvc.perform(con(token, post("/api/ventas")).content(venta("pr-2", "EFECTIVO", 2, ""))).andExpect(status().isOk());

        var l = equipo.liquidar(java.time.LocalDate.of(2026, 9, 25), java.time.LocalDate.of(2026, 9, 25)).getFirst();
        assertThat(l.comision()).isEqualTo(2 * 700 + 2 * 1000);
    }

    @Test
    void laTarifaDePromoSolaNoApagaElPorcentaje() throws Exception {
        equipo.crear(new NuevoVendedor("Juan", "1111", 10));
        ajustes.actualizar("COMISION_PROMO", "700");
        String token = entrar("1111");
        mvc.perform(con(token, post("/api/ventas")).content(venta("pp-1", "EFECTIVO", 2, ""))).andExpect(status().isOk());

        var l = equipo.liquidar(java.time.LocalDate.of(2026, 9, 25), java.time.LocalDate.of(2026, 9, 25)).getFirst();
        assertThat(l.comision()).isEqualTo(l.total() / 10);
    }

    @Test
    void elTrabajadorEscogeCadaCuantoCobraYElDuenoLoVe() throws Exception {
        equipo.crear(new NuevoVendedor("Juan", "1111", 0));
        String token = entrar("1111");
        mvc.perform(con(token, get("/api/mi-turno/terminos"))).andExpect(jsonPath("$.frecuenciaPago").doesNotExist());

        mvc.perform(con(token, post("/api/mi-turno/pago")).content("{\"frecuencia\":\"QUINCENAL\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.frecuenciaPago").value("QUINCENAL"));
        mvc.perform(con(token, post("/api/mi-turno/pago")).content("{\"frecuencia\":\"CADA_RATO\"}"))
                .andExpect(status().isBadRequest());

        assertThat(equipo.listar().getFirst().frecuenciaPago()).isEqualTo(FrecuenciaPago.QUINCENAL);
    }

    @Test
    void elDuenoNoEscogeElPagoDeUnTrabajador() throws Exception {
        mvc.perform(con(entrar("4321"), post("/api/mi-turno/pago")).content("{\"frecuencia\":\"SEMANAL\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void laPromoDelDuenoLeLlegaALosCelularesDeLosTrabajadores() throws Exception {
        equipo.crear(new NuevoVendedor("Juan", "1111", 0));
        String token = entrar("1111");
        mvc.perform(con(token, get("/api/estado"))).andExpect(jsonPath("$.promo").doesNotExist());

        String promo = "{\"activa\":true,\"cantidad\":2,\"precio\":10000,\"tipos\":[\"NORMAL\"],\"soloHoy\":false,\"dia\":\"\",\"dias\":[3]}";
        ajustes.actualizar("PROMO", promo);

        mvc.perform(con(token, get("/api/estado"))).andExpect(jsonPath("$.promo").value(promo));
        mvc.perform(con(entrar("4321"), get("/api/estado"))).andExpect(jsonPath("$.promo").value(promo));
    }

    @Test
    void losDiasDePromoLosPremiosBajanYElTrabajadorVeLosMontosDeHoy() throws Exception {
        equipo.crear(new NuevoVendedor("Juan", "1111", 0));
        ajustes.actualizar("PREMIOS_ESCALONES", "2:2000,5:6000");
        ajustes.actualizar("PREMIO_REBAJA_PROMO", "1500");
        // 2026-09-25 es viernes (5): la promo corre los viernes
        ajustes.actualizar("PROMO", "{\"activa\":true,\"cantidad\":2,\"precio\":10000,\"tipos\":[\"NORMAL\"],\"soloHoy\":false,\"dia\":\"\",\"dias\":[5]}");
        String token = entrar("1111");

        mvc.perform(con(token, get("/api/estado")))
                .andExpect(jsonPath("$.premios.diaPromo").value(true))
                .andExpect(jsonPath("$.premios.escalones[0].total").value(500))
                .andExpect(jsonPath("$.premios.escalones[1].total").value(4500));

        mvc.perform(con(token, post("/api/ventas")).content(venta("rp-1", "EFECTIVO", 5, ",\"total\":25000"))).andExpect(status().isOk());
        var l = equipo.liquidar(java.time.LocalDate.of(2026, 9, 25), java.time.LocalDate.of(2026, 9, 25)).getFirst();
        assertThat(l.bonos()).isEqualTo(4500); // 6.000 menos 1.500 por ser d\u00eda de promo
    }

    @Test
    void unDiaSinPromoLosPremiosNoBajan() throws Exception {
        equipo.crear(new NuevoVendedor("Juan", "1111", 0));
        ajustes.actualizar("PREMIOS_ESCALONES", "2:2000,5:6000");
        ajustes.actualizar("PREMIO_REBAJA_PROMO", "1500");
        // La promo es de los mi\u00e9rcoles (3) y hoy es viernes
        ajustes.actualizar("PROMO", "{\"activa\":true,\"cantidad\":2,\"precio\":10000,\"tipos\":[\"NORMAL\"],\"soloHoy\":false,\"dia\":\"\",\"dias\":[3]}");
        String token = entrar("1111");

        mvc.perform(con(token, get("/api/estado")))
                .andExpect(jsonPath("$.premios.diaPromo").value(false))
                .andExpect(jsonPath("$.premios.escalones[1].total").value(6000));
        mvc.perform(con(token, post("/api/ventas")).content(venta("np-1", "EFECTIVO", 5, ""))).andExpect(status().isOk());
        var l = equipo.liquidar(java.time.LocalDate.of(2026, 9, 25), java.time.LocalDate.of(2026, 9, 25)).getFirst();
        assertThat(l.bonos()).isEqualTo(6000);
    }

    @Test
    void elDuenoPagaLasComisionesLasCuentasSeReinicianYElTrabajadorFirmaElPazYSalvo() throws Exception {
        var juan = equipo.crear(new NuevoVendedor("Juan", "1111", 10));
        String token = entrar("1111");
        String duenoToken = entrar("4321");
        mvc.perform(con(token, post("/api/ventas")).content(venta("g-1", "EFECTIVO", 2, ""))).andExpect(status().isOk());

        // Sin vender no hay nada que pagar; vendiendo, se le deben 10 % de $12.000
        assertThat(equipo.cuenta(juan.id()).pendiente().comision()).isEqualTo(1200);
        assertThat(equipo.listar().getFirst().porPagar()).isEqualTo(1200);
        mvc.perform(con(duenoToken, post("/api/equipo/" + juan.id() + "/pagos")).content("{\"metodo\":\"EFECTIVO\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.monto").value(1200))
                .andExpect(jsonPath("$.estado").value("PENDIENTE"))
                .andExpect(jsonPath("$.texto").value(org.hamcrest.Matchers.containsString("PAZ Y SALVO")));

        // Las cuentas arrancan de cero y no se puede pagar dos veces lo mismo
        assertThat(equipo.cuenta(juan.id()).pendiente().comision()).isZero();
        mvc.perform(con(duenoToken, post("/api/equipo/" + juan.id() + "/pagos")).content("{\"metodo\":\"EFECTIVO\"}"))
                .andExpect(status().isBadRequest());

        // El trabajador ve el pago pendiente; en efectivo no puede confirmar sin firmar
        String cuerpo = mvc.perform(con(token, get("/api/mi-turno/pagos"))).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].estado").value("PENDIENTE")).andReturn().getResponse().getContentAsString();
        String id = cuerpo.replaceAll(".*\"id\":(\\d+).*", "$1");
        mvc.perform(con(token, post("/api/mi-turno/pagos/" + id + "/responder")).content("{\"recibido\":true}"))
                .andExpect(status().isBadRequest());
        mvc.perform(con(token, post("/api/mi-turno/pagos/" + id + "/responder")).content("{\"recibido\":true,\"firma\":\"Juan Pérez\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("CONFIRMADO"))
                .andExpect(jsonPath("$.firma").value("Juan Pérez"));
        // Ya respondido: no se responde otra vez, y confirmado no se anula
        mvc.perform(con(token, post("/api/mi-turno/pagos/" + id + "/responder")).content("{\"recibido\":false}"))
                .andExpect(status().isBadRequest());
        mvc.perform(con(duenoToken, post("/api/equipo/pagos/" + id + "/anular"))).andExpect(status().isBadRequest());
    }

    @Test
    void siElTrabajadorDiceQueNoLePagaronElDuenoPuedeAnularYLasCuentasVuelven() throws Exception {
        var juan = equipo.crear(new NuevoVendedor("Juan", "1111", 10));
        String token = entrar("1111");
        String duenoToken = entrar("4321");
        mvc.perform(con(token, post("/api/ventas")).content(venta("g-1", "NEQUI", 2, ""))).andExpect(status().isOk());
        var pago = equipo.pagar(juan.id(), PagoVendedor.Metodo.NEQUI, null);
        assertThat(pago.texto()).isNull(); // por Nequi no hay paz y salvo

        mvc.perform(con(token, post("/api/mi-turno/pagos/" + pago.id() + "/responder")).content("{\"recibido\":false}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.estado").value("DISPUTADO"));
        assertThat(equipo.listar().getFirst().ultimoPago()).isEqualTo(PagoVendedor.Estado.DISPUTADO);

        mvc.perform(con(duenoToken, post("/api/equipo/pagos/" + pago.id() + "/anular"))).andExpect(status().isOk());
        assertThat(equipo.cuenta(juan.id()).pendiente().comision()).isEqualTo(1200);
    }

    @Test
    void elTrabajadorNoPagaNiVePagosAjenos() throws Exception {
        var juan = equipo.crear(new NuevoVendedor("Juan", "1111", 10));
        equipo.crear(new NuevoVendedor("Luis", "2222", 10));
        String token = entrar("1111");
        mvc.perform(con(token, post("/api/ventas")).content(venta("g-1", "NEQUI", 2, ""))).andExpect(status().isOk());
        var pago = equipo.pagar(juan.id(), PagoVendedor.Metodo.NEQUI, null);

        mvc.perform(con(token, post("/api/equipo/" + juan.id() + "/pagos")).content("{\"metodo\":\"NEQUI\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(con(entrar("2222"), post("/api/mi-turno/pagos/" + pago.id() + "/responder")).content("{\"recibido\":true}"))
                .andExpect(status().isNotFound());
        mvc.perform(con(entrar("2222"), get("/api/mi-turno/pagos"))).andExpect(jsonPath("$").isEmpty());
    }

    @Test
    void elDuenoPuedeEscribirCuantoLeDaYElPazYSalvoDiceEseMonto() throws Exception {
        var juan = equipo.crear(new NuevoVendedor("Juan", "1111", 10));
        mvc.perform(con(entrar("1111"), post("/api/ventas")).content(venta("m-1", "EFECTIVO", 2, ""))).andExpect(status().isOk());

        var pago = equipo.pagar(juan.id(), PagoVendedor.Metodo.EFECTIVO, 5000L);

        assertThat(pago.monto()).isEqualTo(5000);
        assertThat(pago.comision()).isEqualTo(1200);
        assertThat(pago.texto()).contains("5.000");
    }

    @Test
    void agregarCargaSumaAlaQueYaTieneYConservaLoVendido() throws Exception {
        var juan = equipo.crear(new NuevoVendedor("Juan", "1111", 0));
        equipo.cargar(juan.id(), new Carga(List.of(new ItemCarga(idDe("Smirnoff"), 5))));
        String token = entrar("1111");
        mvc.perform(con(token, post("/api/ventas")).content(venta("a-1", "EFECTIVO", 2, ""))).andExpect(status().isOk());

        mvc.perform(con(entrar("4321"), post("/api/equipo/" + juan.id() + "/carga/agregar"))
                        .content("{\"items\":[{\"productoId\":" + idDe("Smirnoff") + ",\"llevo\":4}]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].llevo").value(9))
                .andExpect(jsonPath("$[0].vendi").value(2))
                .andExpect(jsonPath("$[0].queda").value(7));
        mvc.perform(con(entrar("4321"), post("/api/equipo/" + juan.id() + "/carga/agregar")).content("{\"items\":[]}"))
                .andExpect(status().isBadRequest());
    }
}
