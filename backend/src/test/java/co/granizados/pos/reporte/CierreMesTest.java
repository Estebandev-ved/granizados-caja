package co.granizados.pos.reporte;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.after;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import co.granizados.pos.PruebaIntegracion;
import co.granizados.pos.equipo.EquipoService;
import co.granizados.pos.equipo.EquipoService.NuevoVendedor;
import co.granizados.pos.gasto.GastoService;
import co.granizados.pos.plata.LugarPlata;
import co.granizados.pos.plata.PlataService;
import co.granizados.pos.venta.MetodoPago;
import co.granizados.pos.venta.VentaService;
import co.granizados.pos.venta.VentaService.NuevaVenta;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * Control del negocio: la ganancia real del mes (con el equipo restado), lo que se paga el dueño, el punto de
 * equilibrio, lo que deja cada sabor, el rastro de las ventas borradas y la copia de seguridad.
 */
@AutoConfigureMockMvc
class CierreMesTest extends PruebaIntegracion {

    @Autowired
    CierreMesService cierres;

    @Autowired
    RespaldoService respaldo;

    @Autowired
    VentaService ventas;

    @Autowired
    GastoService gastos;

    @Autowired
    PlataService plata;

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

    private void venderComo(String token, String uid, String metodo, int cantidad) throws Exception {
        mvc.perform(con(token, post("/api/ventas")).content("{\"clientUid\":\"" + uid + "\",\"productoId\":" + idDe("Smirnoff")
                        + ",\"metodo\":\"" + metodo + "\",\"cantidad\":" + cantidad + "}"))
                .andExpect(status().isOk());
    }

    /** El dueño vende 10 Smirnoff en efectivo y Juan (10 %) vende 10 por Nequi. Smirnoff cuesta 3.000. */
    private EquipoService.VendedorDto mesConEquipo() throws Exception {
        jdbc.update("update producto set costo = 3000, stock = 100 where sabor = 'Smirnoff'");
        ventas.registrar(new NuevaVenta("d-1", idDe("Smirnoff"), MetodoPago.EFECTIVO, 10));
        var juan = equipo.crear(new NuevoVendedor("Juan", "1111", 10));
        venderComo(entrar("1111"), "j-1", "NEQUI", 10);
        gastos.registrar(new GastoService.NuevoGasto("g-1", "HIELO", "bolsas", 10_000, null));
        gastos.registrar(new GastoService.NuevoGasto("g-2", "TRABAJADORES", "", 2_000, null));
        return juan;
    }

    // ------------------------------------------------------------------ cierre del mes

    @Test
    void laGananciaRealRestaLoQueSeGanoElEquipoSinContarDosVecesElGastoTrabajadores() throws Exception {
        mesConEquipo();

        var m = cierres.cierre(null);

        assertThat(m.mes()).isEqualTo("2026-09");
        assertThat(m.enCurso()).isTrue();
        assertThat(m.ventas()).isEqualTo(120_000);
        assertThat(m.unidades()).isEqualTo(20);
        assertThat(m.costo()).isEqualTo(60_000);
        assertThat(m.gastos()).isEqualTo(10_000);
        assertThat(m.gastoTrabajadores()).isEqualTo(2_000);
        assertThat(m.equipoApp()).isEqualTo(6_000); // 10 % de 60.000
        assertThat(m.equipo()).isEqualTo(6_000); // el mayor entre lo de la app y el gasto anotado
        assertThat(m.gananciaApp()).isEqualTo(120_000 - 60_000 - 12_000);
        assertThat(m.gananciaReal()).isEqualTo(120_000 - 60_000 - 10_000 - 6_000);
        assertThat(m.gastosPorCategoria()).extracting(CierreMesService.Categoria::categoria).containsExactly("HIELO");
        assertThat(m.consejos()).anyMatch(c -> c.contains("no se resta en la ganancia de Hoy"));
    }

    @Test
    void siAnotoComoGastoMasDeLoQueDiceLaAppSeTomaLoQueAnoto() throws Exception {
        mesConEquipo();
        gastos.registrar(new GastoService.NuevoGasto("g-3", "TRABAJADORES", "", 8_000, null));

        var m = cierres.cierre("2026-09");

        assertThat(m.equipo()).isEqualTo(10_000);
        assertThat(m.gananciaReal()).isEqualTo(m.gananciaApp());
    }

    @Test
    void dicePuntoDeEquilibrioYLoQueDejaCadaSabor() throws Exception {
        mesConEquipo();

        var m = cierres.cierre("2026-09");

        // 25 días del mes: 10.000 de gastos son 400 al día; cada granizado deja (120.000 − 60.000 − 6.000) / 20 = 2.700
        assertThat(m.equilibrio().gastoPorDia()).isEqualTo(400);
        assertThat(m.equilibrio().dejaPorGranizado()).isEqualTo(2_700);
        assertThat(m.equilibrio().granizadosAlDia()).isEqualTo(1);
        assertThat(m.equilibrio().promedioAlDia()).isEqualTo(20.0);
        assertThat(m.equilibrio().diasQueCubrieron()).isEqualTo(1);
        var smirnoff = m.porSabor().getFirst();
        assertThat(smirnoff.sabor()).isEqualTo("Smirnoff");
        assertThat(smirnoff.equipo()).isEqualTo(6_000);
        assertThat(smirnoff.ganancia()).isEqualTo(54_000);
        assertThat(smirnoff.porUnidad()).isEqualTo(2_700);
    }

    @Test
    void loQueMePagueRestaDeMiPlataPeroNoDeLaGanancia() throws Exception {
        mesConEquipo();
        plata.contar(new PlataService.NuevoConteo("c-1", 100_000, 50_000, 80_000));
        reloj.avanzar(Duration.ofMinutes(1));

        plata.retirar(new PlataService.NuevoRetiro("r-1", 20_000, LugarPlata.CASA, "quincena"));
        assertThat(plata.retirar(new PlataService.NuevoRetiro("r-1", 20_000, LugarPlata.CASA, "quincena")))
                .isEqualTo(PlataService.Resultado.REPETIDA);

        assertThat(plata.saldo().casa()).isEqualTo(30_000);
        assertThat(plata.movimientos(1)).extracting(PlataService.Movimiento::concepto).contains("Me pagué · quincena");
        var m = cierres.cierre(null);
        assertThat(m.retiros()).isEqualTo(20_000);
        assertThat(m.gananciaReal()).isEqualTo(44_000);
        assertThat(m.quedaEnNegocio()).isEqualTo(24_000);
        assertThat(cierres.textoCierre(m)).contains("Te pagaste: $20.000");

        plata.borrarRetiro("r-1");
        assertThat(plata.saldo().casa()).isEqualTo(50_000);
    }

    @Test
    void comparaConElMesAnteriorYNoDejaVerElFuturo() {
        jdbc.update("update producto set costo = 3000 where sabor = 'Smirnoff'");
        ventas.registrar(new NuevaVenta("a-1", idDe("Smirnoff"), MetodoPago.EFECTIVO, 2));
        reloj.poner("2026-10-03T12:00-05:00");
        ventas.registrar(new NuevaVenta("b-1", idDe("Smirnoff"), MetodoPago.EFECTIVO, 4));

        var m = cierres.cierre("2026-10");
        assertThat(m.anterior().mes()).isEqualTo("2026-09");
        assertThat(m.anterior().gananciaReal()).isEqualTo(6_000);
        assertThat(m.gananciaReal()).isEqualTo(12_000);
        assertThat(m.proyeccion()).isEqualTo(124_000); // 12.000 en 3 días, al mismo ritmo en 31
        assertThat(cierres.cierre("2026-09").enCurso()).isFalse();
        assertThatThrownBy(() -> cierres.cierre("2026-11")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void elCierreSaleEnLaApiSoloParaElDueno() throws Exception {
        mesConEquipo();
        mvc.perform(con(entrar("4321"), get("/api/reportes/mes?mes=2026-09")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.gananciaReal").value(44_000));
        mvc.perform(con(entrar("4321"), get("/api/reportes/mes?mes=nada"))).andExpect(status().isBadRequest());
        mvc.perform(con(entrar("1111"), get("/api/reportes/mes"))).andExpect(status().isForbidden());
    }

    // ------------------------------------------------------------------ ventas borradas

    @Test
    void siUnTrabajadorBorraUnaVentaQuedaElRastroYElDuenoSeEntera() throws Exception {
        equipo.crear(new NuevoVendedor("Juan", "1111", 10));
        String token = entrar("1111");
        venderComo(token, "j-1", "EFECTIVO", 2);
        reloj.avanzar(Duration.ofMinutes(20));

        mvc.perform(con(token, delete("/api/ventas/j-1"))).andExpect(status().isNoContent());

        verify(notificador, timeout(2000)).enviar(eq("🗑️ Borraron una venta"), contains("Juan borró 2 Smirnoff de $12.000 en efectivo"));
        var borradas = ventas.borradas(LocalDate.parse("2026-09-25"), LocalDate.parse("2026-09-25"));
        assertThat(borradas).hasSize(1);
        assertThat(borradas.getFirst().borro()).isEqualTo("Juan");
        assertThat(borradas.getFirst().borroTrabajador()).isTrue();
        assertThat(borradas.getFirst().total()).isEqualTo(12_000);
        // El trabajador no puede ver la lista
        mvc.perform(con(token, get("/api/ventas/borradas?desde=2026-09-25&hasta=2026-09-25"))).andExpect(status().isForbidden());
        mvc.perform(con(entrar("4321"), get("/api/ventas/borradas?desde=2026-09-25&hasta=2026-09-25")))
                .andExpect(status().isOk()).andExpect(jsonPath("$[0].sabor").value("Smirnoff"));
    }

    @Test
    void loQueBorraElDuenoQuedaAnotadoSinAviso() {
        ventas.registrar(new NuevaVenta("d-1", idDe("Smirnoff"), MetodoPago.NEQUI, 1));
        ventas.deshacer("d-1");

        var b = ventas.borradas(LocalDate.parse("2026-09-25"), LocalDate.parse("2026-09-25")).getFirst();
        assertThat(b.borro()).isEqualTo("Tú");
        assertThat(b.deQuien()).isEqualTo("Tú");
        verify(notificador, after(300).never()).enviar(eq("🗑️ Borraron una venta"), anyString());
    }

    // ------------------------------------------------------------------ copia de seguridad

    private Map<String, String> abrir(byte[] zip) throws Exception {
        Map<String, String> archivos = new HashMap<>();
        try (ZipInputStream z = new ZipInputStream(new ByteArrayInputStream(zip), StandardCharsets.UTF_8)) {
            ZipEntry e;
            while ((e = z.getNextEntry()) != null) archivos.put(e.getName(), new String(z.readAllBytes(), StandardCharsets.UTF_8));
        }
        return archivos;
    }

    @Test
    void laCopiaTraeUnaHojaPorTablaSinPinNiFotos() throws Exception {
        mesConEquipo();

        var archivos = abrir(respaldo.zip());

        assertThat(archivos).containsKeys("ventas.csv", "gastos.csv", "equipo.csv", "me_pague.csv", "LEEME.txt");
        assertThat(archivos).doesNotContainKeys("passkey.csv", "comprobante.csv");
        assertThat(archivos.get("ventas.csv")).startsWith("﻿sep=;\n").contains("d-1").contains("j-1");
        assertThat(archivos.get("equipo.csv")).contains("Juan").doesNotContain("pin_hash").doesNotContain("negocio_id");
        assertThat(archivos.get("me_pague.csv")).contains("client_uid"); // sin filas, pero con encabezado

        mvc.perform(con(entrar("4321"), get("/api/reportes/respaldo.zip"))).andExpect(status().isOk());
        mvc.perform(con(entrar("1111"), get("/api/reportes/respaldo.zip"))).andExpect(status().isForbidden());
    }
}
