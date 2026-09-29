package co.granizados.pos;

import static org.assertj.core.api.Assertions.assertThat;
import static org.hamcrest.Matchers.startsWith;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/** Prueba la API de punta a punta: login con PIN, token y los endpoints que usa el celular. */
@AutoConfigureMockMvc
class ApiTest extends PruebaIntegracion {

    @Autowired
    MockMvc mvc;

    String token;

    @BeforeEach
    void entrar() throws Exception {
        String cuerpo = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content("{\"pin\":\"4321\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        token = cuerpo.replaceAll(".*\"token\":\"([^\"]+)\".*", "$1");
    }

    private MockHttpServletRequestBuilder conToken(MockHttpServletRequestBuilder req) {
        return req.header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON);
    }

    @Test
    void sinTokenNoDejaEntrar() throws Exception {
        mvc.perform(get("/api/estado")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/estado").header("Authorization", "Bearer inventado")).andExpect(status().isUnauthorized());
    }

    @Test
    void pinIncorrecto() throws Exception {
        mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content("{\"pin\":\"0000\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("PIN incorrecto"));
    }

    @Test
    void healthEsPublico() throws Exception {
        mvc.perform(get("/actuator/health")).andExpect(status().isOk());
    }

    @Test
    void estadoConProductosYResumen() throws Exception {
        mvc.perform(conToken(get("/api/estado")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.productos.length()").value(11))
                .andExpect(jsonPath("$.productos[0].sabor").value("Smirnoff"))
                .andExpect(jsonPath("$.hoy.total").value(0))
                .andExpect(jsonPath("$.dia").value("2026-09-25"));
    }

    @Test
    void loteConUnaVentaMalaNoFrenaLasDemas() throws Exception {
        long smirnoff = idDe("Smirnoff");
        String lote = """
                {"ventas":[
                  {"clientUid":"l1","productoId":%d,"metodo":"NEQUI","cantidad":1},
                  {"clientUid":"l2","productoId":999999,"metodo":"NEQUI","cantidad":1},
                  {"clientUid":"l3","productoId":%d,"metodo":"EFECTIVO","cantidad":2}
                ]}""".formatted(smirnoff, smirnoff);

        mvc.perform(conToken(post("/api/ventas/lote")).content(lote))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].estado").value("REGISTRADA"))
                .andExpect(jsonPath("$[1].estado").value("RECHAZADA"))
                .andExpect(jsonPath("$[2].estado").value("REGISTRADA"));

        // El celular reintenta el mismo lote (se le cayó la señal antes de la respuesta)
        mvc.perform(conToken(post("/api/ventas/lote")).content(lote))
                .andExpect(jsonPath("$[0].estado").value("REPETIDA"))
                .andExpect(jsonPath("$[2].estado").value("REPETIDA"));

        assertThat(stockDe("Smirnoff")).isEqualTo(7);
    }

    @Test
    void ventaInvalidaEs400() throws Exception {
        mvc.perform(conToken(post("/api/ventas")).content("{\"clientUid\":\"x\",\"productoId\":1,\"metodo\":\"NEQUI\",\"cantidad\":0}"))
                .andExpect(status().isBadRequest());
        mvc.perform(conToken(post("/api/ventas")).content("{\"clientUid\":\"x\",\"productoId\":1,\"metodo\":\"BITCOIN\",\"cantidad\":1}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void deshacerUnaVenta() throws Exception {
        mvc.perform(conToken(post("/api/ventas"))
                        .content("{\"clientUid\":\"u1\",\"productoId\":%d,\"metodo\":\"NEQUI\",\"cantidad\":1}".formatted(idDe("Mojito"))))
                .andExpect(jsonPath("$.estado").value("REGISTRADA"));
        mvc.perform(conToken(delete("/api/ventas/u1"))).andExpect(status().isNoContent());
        mvc.perform(conToken(delete("/api/ventas/u1"))).andExpect(status().isNotFound());
        assertThat(stockDe("Mojito")).isEqualTo(10);
    }

    @Test
    void reponerEsIdempotente() throws Exception {
        String entrada = "{\"clientUid\":\"r1\",\"productoId\":%d,\"cantidad\":12}".formatted(idDe("Sangría"));
        mvc.perform(conToken(post("/api/inventario/entradas")).content(entrada)).andExpect(jsonPath("$.estado").value("REGISTRADA"));
        mvc.perform(conToken(post("/api/inventario/entradas")).content(entrada)).andExpect(jsonPath("$.estado").value("REPETIDA"));
        assertThat(stockDe("Sangría")).isEqualTo(22);
    }

    @Test
    void conteoFijaElStockYLaMermaResta() throws Exception {
        // Contar todo de una vez: dos sabores con su stock real
        String conteo = """
                {"movimientos":[
                  {"clientUid":"k1","productoId":%d,"tipo":"CONTEO","real":4},
                  {"clientUid":"k2","productoId":%d,"tipo":"CONTEO","real":9}
                ]}""".formatted(idDe("Smirnoff"), idDe("Tussi"));
        mvc.perform(conToken(post("/api/inventario/conteo")).content(conteo))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].estado").value("REGISTRADA"))
                .andExpect(jsonPath("$[1].estado").value("REGISTRADA"));
        assertThat(stockDe("Smirnoff")).isEqualTo(4);
        assertThat(stockDe("Tussi")).isEqualTo(9);

        // El conteo repetido no vuelve a mover nada
        mvc.perform(conToken(post("/api/inventario/conteo")).content(conteo))
                .andExpect(jsonPath("$[0].estado").value("REPETIDA"));
        assertThat(stockDe("Smirnoff")).isEqualTo(4);

        // Merma con motivo
        String merma = "{\"clientUid\":\"km\",\"productoId\":%d,\"tipo\":\"MERMA\",\"cantidad\":3,\"motivo\":\"DANADO\"}"
                .formatted(idDe("Mojito"));
        mvc.perform(conToken(post("/api/inventario/movimientos")).content(merma))
                .andExpect(jsonPath("$.estado").value("REGISTRADA"));
        assertThat(stockDe("Mojito")).isEqualTo(7);

        // Sin motivo no pasa
        mvc.perform(conToken(post("/api/inventario/movimientos"))
                        .content("{\"clientUid\":\"km2\",\"productoId\":%d,\"tipo\":\"MERMA\",\"cantidad\":1}".formatted(idDe("Mojito"))))
                .andExpect(status().isBadRequest());
        assertThat(stockDe("Mojito")).isEqualTo(7);
    }

    @Test
    void pedidoEnCaminoSeRecibeUnaSolaVez() throws Exception {
        long smirnoff = idDe("Smirnoff");
        String cuerpo = "{\"items\":[{\"productoId\":%d,\"cantidad\":12}]}".formatted(smirnoff);
        String creada = mvc.perform(conToken(post("/api/pedidos")).content(cuerpo))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("ENVIADO"))
                .andExpect(jsonPath("$.totalUnidades").value(12))
                .andExpect(jsonPath("$.link").value(startsWith("https://wa.me/")))
                .andReturn().getResponse().getContentAsString();
        long id = Long.parseLong(creada.replaceAll(".*\"id\":(\\d+).*", "$1"));

        mvc.perform(conToken(get("/api/estado")))
                .andExpect(jsonPath("$.pedido.id").value(id))
                .andExpect(jsonPath("$.pedido.totalUnidades").value(12));

        String llego = "{\"clientUid\":\"llego-1\",\"items\":[{\"productoId\":%d,\"cantidad\":9}]}".formatted(smirnoff);
        mvc.perform(conToken(post("/api/pedidos/" + id + "/recibido")).content(llego))
                .andExpect(jsonPath("$.estado").value("REGISTRADA"));
        mvc.perform(conToken(post("/api/pedidos/" + id + "/recibido")).content(llego))
                .andExpect(jsonPath("$.estado").value("REPETIDA"));

        assertThat(stockDe("Smirnoff")).isEqualTo(19);
        assertThat(contar("entrada_inventario")).isEqualTo(1);
        mvc.perform(conToken(get("/api/estado"))).andExpect(jsonPath("$.pedido").doesNotExist());
    }

    @Test
    void costoYGastoSeVenEnLaGananciaDeHoy() throws Exception {
        mvc.perform(conToken(put("/api/productos/" + idDe("Smirnoff")))
                        .content("{\"sabor\":\"Smirnoff\",\"tipo\":\"NORMAL\",\"precio\":6000,\"costo\":3000,\"stockMinimo\":3}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.costo").value(3000));

        String gasto = "{\"clientUid\":\"g1\",\"categoria\":\"HIELO\",\"concepto\":\"bolsas\",\"monto\":1500}";
        mvc.perform(conToken(post("/api/gastos")).content(gasto))
                .andExpect(jsonPath("$.estado").value("REGISTRADA"));
        mvc.perform(conToken(post("/api/gastos")).content(gasto))
                .andExpect(jsonPath("$.estado").value("REPETIDA"));
        assertThat(contar("gasto")).isEqualTo(1);

        mvc.perform(conToken(post("/api/ventas"))
                        .content("{\"clientUid\":\"vg1\",\"productoId\":%d,\"metodo\":\"EFECTIVO\",\"cantidad\":2}"
                                .formatted(idDe("Smirnoff"))))
                .andExpect(jsonPath("$.estado").value("REGISTRADA"));

        mvc.perform(conToken(get("/api/estado")))
                .andExpect(jsonPath("$.hoy.total").value(12000))
                .andExpect(jsonPath("$.hoy.costo").value(6000))
                .andExpect(jsonPath("$.hoy.gastos").value(1500))
                .andExpect(jsonPath("$.hoy.ganancia").value(4500));

        mvc.perform(conToken(delete("/api/gastos/g1"))).andExpect(status().isNoContent());
        assertThat(contar("gasto")).isZero();
        // Un gasto que ya no existe da 404, no un 200 mentiroso
        mvc.perform(conToken(delete("/api/gastos/g1"))).andExpect(status().isNotFound());
    }

    @Test
    void reportesDelDiaYElCSV() throws Exception {
        mvc.perform(conToken(put("/api/productos/" + idDe("Smirnoff")))
                        .content("{\"sabor\":\"Smirnoff\",\"tipo\":\"NORMAL\",\"precio\":6000,\"costo\":3000,\"stockMinimo\":3}"))
                .andExpect(status().isOk());
        mvc.perform(conToken(post("/api/ventas"))
                        .content("{\"clientUid\":\"vr1\",\"productoId\":%d,\"metodo\":\"NEQUI\",\"cantidad\":2}"
                                .formatted(idDe("Smirnoff"))))
                .andExpect(status().isOk());

        mvc.perform(conToken(get("/api/reportes").param("desde", "2026-09-25").param("hasta", "2026-09-25")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.totales.ventas").value(12000))
                .andExpect(jsonPath("$.totales.ganancia").value(6000))
                .andExpect(jsonPath("$.porHora.length()").value(24))
                .andExpect(jsonPath("$.porDiaSemana.length()").value(7))
                .andExpect(jsonPath("$.porSabor[0].sabor").value("Smirnoff"));

        mvc.perform(conToken(get("/api/reportes/ventas.csv")
                        .param("desde", "2026-09-25").param("hasta", "2026-09-25")))
                .andExpect(status().isOk())
                .andExpect(content().string(startsWith("﻿sep=;\nfecha;hora;sabor;")));

        // Fechas al revés: 400, para que el celular descarte y no reintente para siempre
        mvc.perform(conToken(get("/api/reportes").param("desde", "2026-09-25").param("hasta", "2026-09-24")))
                .andExpect(status().isBadRequest());
    }

    @Test
    void cerrarCajaEsIdempotenteYSaleEnElReporte() throws Exception {
        mvc.perform(conToken(post("/api/ventas"))
                        .content("{\"clientUid\":\"vc1\",\"productoId\":%d,\"metodo\":\"EFECTIVO\",\"cantidad\":2}"
                                .formatted(idDe("Smirnoff"))))
                .andExpect(status().isOk());

        String cierre = "{\"clientUid\":\"ar1\",\"contado\":10000}";
        mvc.perform(conToken(post("/api/arqueo")).content(cierre))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("REGISTRADA"));
        mvc.perform(conToken(post("/api/arqueo")).content(cierre))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.estado").value("REPETIDA"));
        assertThat(contar("arqueo")).isEqualTo(1);

        mvc.perform(conToken(get("/api/arqueo")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.esperado").value(12000))
                .andExpect(jsonPath("$.diferencia").value(-2000));

        mvc.perform(conToken(get("/api/reportes").param("desde", "2026-09-25").param("hasta", "2026-09-25")))
                .andExpect(jsonPath("$.arqueos.length()").value(1))
                .andExpect(jsonPath("$.arqueos[0].diferencia").value(-2000));
    }

    @Test
    void ajustesYProductos() throws Exception {
        mvc.perform(conToken(put("/api/config/PROVEEDOR_WHATSAPP")).content("{\"valor\":\"+57 300 123 4567\"}"))
                .andExpect(jsonPath("$.valor").value("573001234567"));
        mvc.perform(conToken(put("/api/config/DIAS_COBERTURA")).content("{\"valor\":\"cero\"}"))
                .andExpect(status().isBadRequest());

        mvc.perform(conToken(post("/api/productos"))
                        .content("{\"sabor\":\"Piña colada\",\"tipo\":\"CREMOSO\",\"precio\":7000,\"stockMinimo\":2}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.nombre").value("Piña colada cremoso"))
                .andExpect(jsonPath("$.orden").value(12));
        // El mismo sabor y tipo otra vez choca con el UNIQUE
        mvc.perform(conToken(post("/api/productos"))
                        .content("{\"sabor\":\"Piña colada\",\"tipo\":\"CREMOSO\",\"precio\":7000,\"stockMinimo\":2}"))
                .andExpect(status().isConflict());
    }
}
