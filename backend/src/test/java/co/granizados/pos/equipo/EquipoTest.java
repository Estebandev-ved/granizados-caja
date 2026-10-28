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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/** Trabajadores dentro de la misma caja: PIN propio, solo venden, carga en el servidor y cuentas por persona. */
@AutoConfigureMockMvc
class EquipoTest extends PruebaIntegracion {

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
}
