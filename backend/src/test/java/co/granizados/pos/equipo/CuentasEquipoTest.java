package co.granizados.pos.equipo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import co.granizados.pos.PruebaIntegracion;
import co.granizados.pos.equipo.EquipoService.Carga;
import co.granizados.pos.equipo.EquipoService.ItemCarga;
import co.granizados.pos.equipo.EquipoService.NuevoFaltante;
import co.granizados.pos.equipo.EquipoService.NuevoPrestamo;
import co.granizados.pos.equipo.EquipoService.NuevoVendedor;
import co.granizados.pos.plata.LugarPlata;
import co.granizados.pos.plata.PlataService;
import java.time.Duration;
import java.util.Base64;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/**
 * Las cuentas con el equipo: «Ya le pagué» sale de Mi plata, los préstamos se descuentan del próximo pago, los faltantes
 * de la carga se cobran al precio de venta, la foto del comprobante y el historial por trabajador.
 */
@AutoConfigureMockMvc
class CuentasEquipoTest extends PruebaIntegracion {

    @Autowired
    EquipoService equipo;

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

    private void vender(String token, String uid, String metodo, int cantidad) throws Exception {
        mvc.perform(con(token, post("/api/ventas")).content("{\"clientUid\":\"" + uid + "\",\"productoId\":" + idDe("Smirnoff")
                        + ",\"metodo\":\"" + metodo + "\",\"cantidad\":" + cantidad + "}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.estado").value("REGISTRADA"));
    }

    /** Cuenta la plata para que Mi plata arranque: 100.000 en caja, 50.000 en casa y 80.000 en Nequi. */
    private void contarPlata() {
        reloj.avanzar(Duration.ofMinutes(1));
        plata.contar(new PlataService.NuevoConteo("conteo", 100_000, 50_000, 80_000));
        reloj.avanzar(Duration.ofMinutes(1));
    }

    // ------------------------------------------------------------------ «Ya le pagué» sale de Mi plata

    @Test
    void elPagoNuevoSaleDeMiPlataSegunDondeSalioLaPlata() throws Exception {
        var juan = equipo.crear(new NuevoVendedor("Juan", "1111", 10));
        String token = entrar("1111");
        vender(token, "v-1", "NEQUI", 20); // 12.000 de comisión
        contarPlata();

        var pago = equipo.pagar(juan.id(), PagoVendedor.Metodo.MIXTO, 12_000L, 5_000L, false, LugarPlata.CASA);

        assertThat(pago.lugarEfectivo()).isEqualTo(LugarPlata.CASA);
        var saldo = plata.saldo();
        assertThat(saldo.caja()).isEqualTo(100_000);
        assertThat(saldo.casa()).isEqualTo(45_000);
        assertThat(saldo.nequi()).isEqualTo(73_000);
        assertThat(plata.movimientos(1)).extracting(PlataService.Movimiento::concepto).contains("Le pagué a Juan");

        // Anulado, la plata vuelve
        equipo.anularPago(pago.id());
        assertThat(plata.saldo().total()).isEqualTo(230_000);
    }

    @Test
    void elEfectivoDelPagoSaleDeLaCajaSiNoSeDiceOtraCosa() throws Exception {
        var juan = equipo.crear(new NuevoVendedor("Juan", "1111", 10));
        vender(entrar("1111"), "v-1", "NEQUI", 10);
        contarPlata();

        equipo.pagar(juan.id(), PagoVendedor.Metodo.EFECTIVO, null);

        assertThat(plata.saldo().caja()).isEqualTo(100_000 - 6_000);
    }

    @Test
    void losPagosDeAntesNoRestanDeMiPlata() throws Exception {
        var juan = equipo.crear(new NuevoVendedor("Juan", "1111", 10));
        vender(entrar("1111"), "v-1", "NEQUI", 10);
        contarPlata();
        equipo.pagar(juan.id(), PagoVendedor.Metodo.EFECTIVO, null);

        // Así quedan los pagos que ya existían cuando corrió la migración
        jdbc.update("update pago_vendedor set mueve_plata = false");

        assertThat(plata.saldo().caja()).isEqualTo(100_000);
    }

    // ------------------------------------------------------------------ préstamos

    @Test
    void elPrestamoSaleDeMiPlataYSeDescuentaEnElProximoPago() throws Exception {
        var juan = equipo.crear(new NuevoVendedor("Juan", "1111", 10));
        String token = entrar("1111");
        contarPlata();
        equipo.prestar(juan.id(), new NuevoPrestamo(5_000L, LugarPlata.NEQUI, "para el bus"));
        assertThat(plata.saldo().nequi()).isEqualTo(75_000);

        vender(token, "v-1", "NEQUI", 20); // 12.000 de comisión
        assertThat(equipo.listar().getFirst().porPagar()).isEqualTo(7_000);
        mvc.perform(con(token, get("/api/mi-turno/prestamos"))).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].monto").value(5000))
                .andExpect(jsonPath("$[0].nota").value("para el bus"));

        var pago = equipo.pagar(juan.id(), PagoVendedor.Metodo.EFECTIVO, null);

        assertThat(pago.monto()).isEqualTo(7_000);
        assertThat(pago.prestamos()).isEqualTo(5_000);
        assertThat(pago.texto()).contains("$5.000 que el negocio me prestó");
        assertThat(equipo.cuenta(juan.id()).prestamos()).isEmpty();
        // Entraron los 120.000 de la venta y salieron 5.000 del préstamo + 7.000 del pago = los 12.000 que se ganó
        assertThat(plata.saldo().total()).isEqualTo(230_000 + 120_000 - 12_000);

        // Si se anula el pago, el préstamo vuelve a quedar pendiente
        equipo.anularPago(pago.id());
        assertThat(equipo.cuenta(juan.id()).prestamos()).hasSize(1);
    }

    @Test
    void siLePrestasteMasDeLoQueGanoTeQuedaDebiendo() throws Exception {
        var juan = equipo.crear(new NuevoVendedor("Juan", "1111", 10));
        vender(entrar("1111"), "v-1", "NEQUI", 10); // 6.000 de comisión
        equipo.prestar(juan.id(), new NuevoPrestamo(10_000L, LugarPlata.CAJA, null));

        assertThat(equipo.listar().getFirst().porPagar()).isEqualTo(-4_000);
        assertThatThrownBy(() -> equipo.pagar(juan.id(), PagoVendedor.Metodo.EFECTIVO, null))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("te debe $4.000");
    }

    @Test
    void unPrestamoYaDescontadoNoSePuedeBorrar() throws Exception {
        var juan = equipo.crear(new NuevoVendedor("Juan", "1111", 10));
        vender(entrar("1111"), "v-1", "NEQUI", 20);
        var prestamo = equipo.prestar(juan.id(), new NuevoPrestamo(5_000L, LugarPlata.CAJA, null));
        var otro = equipo.prestar(juan.id(), new NuevoPrestamo(1_000L, LugarPlata.CAJA, null));
        equipo.quitarPrestamo(otro.id());
        equipo.pagar(juan.id(), PagoVendedor.Metodo.NEQUI, null);

        assertThatThrownBy(() -> equipo.quitarPrestamo(prestamo.id())).isInstanceOf(IllegalArgumentException.class);
        assertThat(contar("prestamo_vendedor")).isEqualTo(1);
    }

    @Test
    void elTrabajadorNoPuedePrestarseNiVerLoDeOtros() throws Exception {
        var juan = equipo.crear(new NuevoVendedor("Juan", "1111", 10));
        String token = entrar("1111");

        mvc.perform(con(token, post("/api/equipo/" + juan.id() + "/prestamos")).content("{\"monto\":5000,\"lugar\":\"CAJA\"}"))
                .andExpect(status().isForbidden());
        mvc.perform(con(token, get("/api/equipo/historial?desde=2026-09-25&hasta=2026-09-25"))).andExpect(status().isForbidden());
    }

    // ------------------------------------------------------------------ faltantes

    @Test
    void elFaltanteSeLeCobraAlPrecioDeVentaYNoAlCosto() throws Exception {
        jdbc.update("update producto set costo = 3000");
        var juan = equipo.crear(new NuevoVendedor("Juan", "1111", 10));
        equipo.cargar(juan.id(), new Carga(List.of(new ItemCarga(idDe("Smirnoff"), 5))));
        String token = entrar("1111");
        vender(token, "v-1", "EFECTIVO", 2);
        int antes = stockDe("Smirnoff");

        var fila = equipo.anotarFaltante(juan.id(), new NuevoFaltante(idDe("Smirnoff"), 1));

        assertThat(fila.queda()).isEqualTo(2);
        assertThat(stockDe("Smirnoff")).isEqualTo(antes - 1);
        var cuentas = equipo.liquidar(equipo.hoy(), equipo.hoy()).getFirst();
        assertThat(cuentas.unidades()).isEqualTo(2);
        assertThat(cuentas.unidadesFaltantes()).isEqualTo(1);
        assertThat(cuentas.faltantes()).isEqualTo(6_000);
        assertThat(cuentas.porPagar()).isEqualTo(1_200 - 6_000);
        assertThat(cuentas.saldo()).isEqualTo(12_000 - 1_200 + 6_000);

        // El trabajador lo ve pero no lo puede borrar
        mvc.perform(con(token, get("/api/estado"))).andExpect(status().isOk())
                .andExpect(jsonPath("$.premios.faltantes").value(6000))
                .andExpect(jsonPath("$.hoy.unidades").value(2))
                .andExpect(jsonPath("$.ultimas[0].metodo").value("FALTANTE"));
        String uid = jdbc.queryForObject("select client_uid from venta where metodo = 'FALTANTE'", String.class);
        mvc.perform(con(token, delete("/api/ventas/" + uid))).andExpect(status().isBadRequest());

        // El dueño sí, y el granizado vuelve al inventario
        mvc.perform(con(entrar("4321"), delete("/api/ventas/" + uid))).andExpect(status().isNoContent());
        assertThat(stockDe("Smirnoff")).isEqualTo(antes);
    }

    @Test
    void nadieAnotaUnFaltanteComoSiFueraUnaVenta() throws Exception {
        equipo.crear(new NuevoVendedor("Juan", "1111", 10));

        mvc.perform(con(entrar("1111"), post("/api/ventas")).content("{\"clientUid\":\"f-1\",\"productoId\":" + idDe("Smirnoff")
                + ",\"metodo\":\"FALTANTE\",\"cantidad\":1}")).andExpect(status().isBadRequest());
        assertThat(contar("venta")).isZero();
    }

    @Test
    void alCerrarElDiaYAlPagarCuentanLosFaltantes() throws Exception {
        var juan = equipo.crear(new NuevoVendedor("Juan", "1111", 10));
        String token = entrar("1111");
        vender(token, "v-1", "NEQUI", 20); // 12.000 de comisión
        equipo.anotarFaltante(juan.id(), new NuevoFaltante(idDe("Smirnoff"), 1));

        mvc.perform(con(token, post("/api/mi-turno/cierre"))).andExpect(status().isOk())
                .andExpect(jsonPath("$.faltantes").value(6000))
                .andExpect(jsonPath("$.entregar").value(-12_000 + 6_000));

        var pago = equipo.pagar(juan.id(), PagoVendedor.Metodo.EFECTIVO, null);
        assertThat(pago.monto()).isEqualTo(6_000);
        assertThat(pago.faltantes()).isEqualTo(6_000);
        assertThat(pago.texto()).contains("faltaron en mi carga (al precio de venta)");
    }

    @Test
    void losTerminosDicenComoSeCobranLosFaltantesYLosPrestamos() {
        var juan = equipo.crear(new NuevoVendedor("Juan", "1111", 10));

        String texto = equipo.terminos(juan.id()).secciones().stream().flatMap(s -> s.lineas().stream()).reduce("", String::concat);

        assertThat(texto).contains("lo revisamos juntos", "al precio de venta", "(no al precio al que lo compramos)",
                "descuenta de tu próximo pago", "foto del comprobante");
    }

    // ------------------------------------------------------------------ comprobantes

    private String foto(String uid, byte[] bytes) {
        return "{\"ventaUid\":\"" + uid + "\",\"imagen\":\"data:image/jpeg;base64," + Base64.getEncoder().encodeToString(bytes) + "\"}";
    }

    @Test
    void elTrabajadorSubeLaFotoDelComprobanteYElDuenoLaVe() throws Exception {
        equipo.crear(new NuevoVendedor("Juan", "1111", 10));
        equipo.crear(new NuevoVendedor("Luis", "2222", 10));
        String juan = entrar("1111");
        byte[] jpeg = {(byte) 0xFF, (byte) 0xD8, 1, 2, 3, (byte) 0xFF, (byte) 0xD9};

        // La foto puede llegar antes que la venta (la venta sigue en la cola sin señal)
        mvc.perform(con(juan, post("/api/comprobantes")).content(foto("v-1", jpeg))).andExpect(status().isNoContent());
        vender(juan, "v-1", "NEQUI", 1);

        mvc.perform(con(juan, get("/api/estado"))).andExpect(jsonPath("$.ultimas[0].comprobante").value(true));
        mvc.perform(con(entrar("4321"), get("/api/comprobantes/v-1")))
                .andExpect(status().isOk())
                .andExpect(content().contentType("image/jpeg"))
                .andExpect(content().bytes(jpeg));
        // Otro trabajador no la ve ni la cambia
        String luis = entrar("2222");
        mvc.perform(con(luis, get("/api/comprobantes/v-1"))).andExpect(status().isNotFound());
        mvc.perform(con(luis, post("/api/comprobantes")).content(foto("v-1", jpeg))).andExpect(status().isNotFound());
    }

    @Test
    void soloSeAceptanFotosYSeBorranALos30Dias() throws Exception {
        String dueno = entrar("4321");
        mvc.perform(con(dueno, post("/api/comprobantes")).content("{\"ventaUid\":\"v-1\",\"imagen\":\"data:text/html;base64,PGI+\"}"))
                .andExpect(status().isBadRequest());

        mvc.perform(con(dueno, post("/api/comprobantes")).content(foto("v-1", new byte[] {1, 2, 3}))).andExpect(status().isNoContent());
        reloj.avanzar(Duration.ofDays(31));
        mvc.perform(con(dueno, post("/api/comprobantes")).content(foto("v-2", new byte[] {4, 5}))).andExpect(status().isNoContent());

        assertThat(jdbc.queryForList("select venta_uid from comprobante", String.class)).containsExactly("v-2");
    }

    // ------------------------------------------------------------------ historial (Reportes)

    @Test
    void elHistorialTraeCadaDiaSusPagosYSusPrestamos() throws Exception {
        var juan = equipo.crear(new NuevoVendedor("Juan", "1111", 10));
        String token = entrar("1111");
        vender(token, "v-1", "NEQUI", 2);
        vender(token, "c-1", "CONSUMO", 1);
        reloj.avanzar(Duration.ofDays(1));
        vender(token, "v-2", "EFECTIVO", 3);
        equipo.prestar(juan.id(), new NuevoPrestamo(2_000L, LugarPlata.CAJA, null));

        mvc.perform(con(entrar("4321"), get("/api/equipo/historial?desde=2026-09-25&hasta=2026-09-26")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].nombre").value("Juan"))
                .andExpect(jsonPath("$[0].totales.unidades").value(5))
                .andExpect(jsonPath("$[0].totales.dias").value(2))
                .andExpect(jsonPath("$[0].dias[0].dia").value("2026-09-26"))
                .andExpect(jsonPath("$[0].dias[0].unidades").value(3))
                .andExpect(jsonPath("$[0].dias[1].consumidos").value(1))
                .andExpect(jsonPath("$[0].prestamos[0].monto").value(2000));
    }
}
