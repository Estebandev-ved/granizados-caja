package co.granizados.pos.negocio;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import co.granizados.pos.PruebaIntegracion;
import co.granizados.pos.ajustes.AjustesService;
import co.granizados.pos.caja.ArqueoService;
import co.granizados.pos.comun.NoEncontradoException;
import co.granizados.pos.plata.LugarPlata;
import co.granizados.pos.plata.PlataService;
import co.granizados.pos.producto.Producto;
import co.granizados.pos.producto.ProductoRepository;
import co.granizados.pos.producto.TipoProducto;
import co.granizados.pos.resumen.EstadoService;
import co.granizados.pos.venta.MetodoPago;
import co.granizados.pos.venta.VentaService;
import co.granizados.pos.venta.VentaService.NuevaVenta;
import java.util.function.Supplier;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/**
 * Lo más importante del SaaS: un negocio NUNCA ve ni toca los datos de otro.
 * El negocio 1 es Dopamina Cocktails (los 11 sabores de siempre) y el 2 es un negocio nuevo.
 */
@AutoConfigureMockMvc
class AislamientoTest extends PruebaIntegracion {

    @Autowired
    ProductoRepository productos;

    @Autowired
    VentaService ventas;

    @Autowired
    co.granizados.pos.fiado.FiadoService fiados;

    @Autowired
    AjustesService ajustes;

    @Autowired
    PlataService plata;

    @Autowired
    co.granizados.pos.gasto.GastoService gastos;

    @Autowired
    ArqueoService arqueos;

    @Autowired
    EstadoService estado;

    @Autowired
    co.granizados.pos.equipo.EquipoService equipo;

    @Autowired
    NegocioService negocios;

    @Autowired
    MockMvc mvc;

    @Autowired
    PlatformTransactionManager transacciones;

    @BeforeEach
    void negocioDosListo() {
        negocios.olvidar();
        // El negocio 2 vende camisas: un producto propio con stock
        como(2, () -> {
            negocios.asegurar(2);
            productos.saveAndFlush(new Producto("Camisa", TipoProducto.NORMAL, 50_000, 2, 1));
            return null;
        });
        jdbc.update("update producto set stock = 10 where negocio_id = 2");
    }

    /** Ejecuta algo como si la petición fuera de ese negocio y vuelve al principal al terminar. */
    private <T> T como(long negocioId, Supplier<T> accion) {
        TenantContext.poner(negocioId);
        try {
            return accion.get();
        } finally {
            TenantContext.limpiar();
        }
    }

    private long idCamisa() {
        return jdbc.queryForObject("select id from producto where negocio_id = 2 and sabor = 'Camisa'", Long.class);
    }

    @Test
    void cadaNegocioVeSoloSusProductos() {
        assertThat(como(1, () -> productos.findByActivoTrueOrderByOrdenAscIdAsc()))
                .hasSize(11).extracting(Producto::getSabor).doesNotContain("Camisa");
        assertThat(como(2, () -> productos.findByActivoTrueOrderByOrdenAscIdAsc()))
                .extracting(Producto::getSabor).containsExactly("Camisa");
    }

    @Test
    void unNegocioNoPuedeLeerNiModificarElProductoDeOtroConociendoSuId() {
        long id = idCamisa();

        assertThat(como(1, () -> productos.findById(id))).isEmpty();

        // El UPDATE atómico del stock tampoco cruza de negocio
        como(1, () -> new TransactionTemplate(transacciones).execute(t -> productos.sumarStock(id, 500)));
        assertThat(jdbc.queryForObject("select stock from producto where id = ?", Integer.class, id)).isEqualTo(10);
        assertThat(como(1, () -> productos.stockActual(id))).isEmpty();
    }

    @Test
    void noSePuedeVenderElProductoDeOtroNegocio() {
        long id = idCamisa();

        assertThatThrownBy(() -> como(1, () -> ventas.registrar(new NuevaVenta("v-cruzada", id, MetodoPago.NEQUI, 1))))
                .isInstanceOf(NoEncontradoException.class);
        assertThat(contar("venta")).isZero();
        assertThat(jdbc.queryForObject("select stock from producto where id = ?", Integer.class, id)).isEqualTo(10);
    }

    @Test
    void lasVentasYLaPlataDeUnNegocioNoSeMezclanConLasDeOtro() {
        como(2, () -> ventas.registrar(new NuevaVenta("v-1", idCamisa(), MetodoPago.EFECTIVO, 2)));

        assertThat(como(2, () -> estado.resumenDe(estado.hoy()).total())).isEqualTo(100_000);
        assertThat(como(1, () -> estado.resumenDe(estado.hoy()).total())).isZero();

        como(2, () -> plata.contar(new PlataService.NuevoConteo("c-1", 70_000, 0, 0)));
        assertThat(como(2, () -> plata.saldo().contadoEn())).isNotNull();
        assertThat(como(1, () -> plata.saldo().contadoEn())).isNull();
    }

    @Test
    void dosNegociosPuedenUsarElMismoIdentificadorDeVentaSinPisarse() {
        como(1, () -> ventas.registrar(new NuevaVenta("mismo-uid", idDe("Smirnoff"), MetodoPago.NEQUI, 1)));
        var resultado = como(2, () -> ventas.registrar(new NuevaVenta("mismo-uid", idCamisa(), MetodoPago.NEQUI, 1)));

        assertThat(resultado).isEqualTo(VentaService.Resultado.REGISTRADA);
        assertThat(contar("venta")).isEqualTo(2);
    }

    @Test
    void losFiadosDeUnNegocioNoLosVeOtro() {
        como(2, () -> ventas.registrar(new NuevaVenta("fiado-2", idCamisa(), MetodoPago.FIADO, 1, null, null, "Ana", null)));

        assertThat(como(2, () -> fiados.pendientes().personas())).hasSize(1);
        assertThat(como(1, () -> fiados.pendientes().personas())).isEmpty();
        assertThat(como(1, () -> fiados.conocidos())).isEmpty();
        long id = como(2, () -> fiados.pendientes().personas().getFirst().deudas().getFirst().id());
        assertThatThrownBy(() -> como(1, () -> fiados.cobrar(id, LugarPlata.CAJA, "x")))
                .isInstanceOf(NoEncontradoException.class);
    }

    @Test
    void losTrabajadoresYSusCargasSonDeCadaNegocio() {
        var juan = como(1, () -> equipo.crear(new co.granizados.pos.equipo.EquipoService.NuevoVendedor("Juan", "1111", 0)));
        como(1, () -> equipo.cargar(juan.id(), new co.granizados.pos.equipo.EquipoService.Carga(
                java.util.List.of(new co.granizados.pos.equipo.EquipoService.ItemCarga(idDe("Smirnoff"), 3)))));

        assertThat(como(1, () -> equipo.listar())).hasSize(1);
        assertThat(como(2, () -> equipo.listar())).isEmpty();
        assertThat(como(2, () -> equipo.entrar("1111"))).isEmpty();
        assertThat(como(2, () -> equipo.estaActivo(juan.id()))).isFalse();
        assertThatThrownBy(() -> como(2, () -> equipo.cargar(juan.id(),
                new co.granizados.pos.equipo.EquipoService.Carga(java.util.List.of()))))
                .isInstanceOf(NoEncontradoException.class);
        assertThat(como(2, () -> equipo.liquidar(estado.hoy(), estado.hoy()))).isEmpty();
    }

    @Test
    void cadaNegocioTieneSusPropiosAjustes() {
        como(2, () -> ajustes.actualizar("NOMBRE", "Ana"));

        assertThat(como(2, () -> ajustes.mapa().get("NOMBRE"))).isEqualTo("Ana");
        assertThat(como(1, () -> ajustes.mapa().get("NOMBRE"))).isNotEqualTo("Ana");
        // El negocio nuevo arrancó con sus ajustes por defecto
        assertThat(como(2, () -> ajustes.mapa())).containsKeys("DIAS_COBERTURA", "META_DIARIA");
    }

    @Test
    void cadaNegocioTieneSuPropioCierreDeCajaPorDia() {
        como(1, () -> arqueos.registrar(new ArqueoService.NuevoArqueo("a-1", 1_000, null, null)));
        como(2, () -> arqueos.registrar(new ArqueoService.NuevoArqueo("a-2", 2_000, null, null)));

        assertThat(contar("arqueo")).isEqualTo(2);
        assertThat(como(1, () -> arqueos.cierreDeHoy().contado())).isEqualTo(1_000);
        assertThat(como(2, () -> arqueos.cierreDeHoy().contado())).isEqualTo(2_000);
    }

    // ------------------------------------------------------------------ el negocio sale del token

    @Test
    void elNegocioSaleDelTokenYNuncaDeUnDatoDelCliente() throws Exception {
        // Token del negocio 2: solo ve sus camisas
        mvc.perform(get("/api/productos").with(jwt().jwt(j -> j.claim("negocio_id", 2))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].sabor").value("Camisa"));

        // Token del negocio 1: los 11 sabores de Dopamina
        mvc.perform(get("/api/productos").with(jwt().jwt(j -> j.claim("negocio_id", 1))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(11));

        // Un token anterior a multi-negocio (sin el claim) sigue siendo de Dopamina
        mvc.perform(get("/api/productos").with(jwt()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(11));

        // Pedir "como" otro negocio con un encabezado o parámetro no sirve de nada
        mvc.perform(get("/api/productos?negocio_id=2").header("X-Negocio-Id", "2").with(jwt().jwt(j -> j.claim("negocio_id", 1))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(11));
    }

    @Test
    void elNegocioNuevoQueEntraPorPrimeraVezQuedaConSusAjustes() throws Exception {
        negocios.olvidar();
        jdbc.update("delete from config where negocio_id = 2");

        mvc.perform(get("/api/config").with(jwt().jwt(j -> j.claim("negocio_id", 2))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.clave=='DIAS_COBERTURA')].valor").value("4"));
    }

    @Test
    void lasAceptacionesDeTerminosSonDeCadaNegocio() {
        var juan = como(1, () -> equipo.crear(new co.granizados.pos.equipo.EquipoService.NuevoVendedor("Juan", "1111", 0)));
        String version = como(1, () -> equipo.terminos(juan.id()).version());
        como(1, () -> equipo.aceptar(juan.id(), version));

        assertThat(como(1, () -> equipo.terminos(juan.id()).aceptadaEn())).isNotNull();
        assertThatThrownBy(() -> como(2, () -> equipo.terminos(juan.id()))).isInstanceOf(NoEncontradoException.class);
        assertThatThrownBy(() -> como(2, () -> equipo.aceptar(juan.id(), version))).isInstanceOf(NoEncontradoException.class);
    }

    @Test
    void losGastosYSusCategoriasPropiasSonDeCadaNegocio() {
        como(2, () -> gastos.registrar(new co.granizados.pos.gasto.GastoService.NuevoGasto(
                "g-1", "Telas", "", 30_000, null, co.granizados.pos.plata.LugarPlata.NEQUI)));

        assertThat(como(2, () -> estado.estado().categoriasGasto())).containsExactly("Telas");
        assertThat(como(1, () -> estado.estado().categoriasGasto())).isEmpty();
        assertThat(como(2, () -> estado.resumenDe(estado.hoy()).gastos())).isEqualTo(30_000);
        assertThat(como(1, () -> estado.resumenDe(estado.hoy()).gastos())).isZero();
        // El mismo identificador en el otro negocio no choca
        assertThat(como(1, () -> gastos.registrar(new co.granizados.pos.gasto.GastoService.NuevoGasto("g-1", "HIELO", "", 1_000, null))))
                .isEqualTo(co.granizados.pos.gasto.GastoService.Resultado.REGISTRADA);
    }

    @Test
    void losPrestamosYLasFotosDeComprobantesSonDeCadaNegocio() {
        var juan = como(1, () -> equipo.crear(new co.granizados.pos.equipo.EquipoService.NuevoVendedor("Juan", "1111", 0)));
        var prestamo = como(1, () -> equipo.prestar(juan.id(),
                new co.granizados.pos.equipo.EquipoService.NuevoPrestamo(5_000L, LugarPlata.CAJA, null)));

        assertThat(como(1, () -> equipo.prestamosPendientes(juan.id()))).hasSize(1);
        assertThat(como(2, () -> equipo.prestamosPendientes(juan.id()))).isEmpty();
        assertThatThrownBy(() -> como(2, () -> equipo.prestar(juan.id(),
                new co.granizados.pos.equipo.EquipoService.NuevoPrestamo(1_000L, LugarPlata.CAJA, null))))
                .isInstanceOf(NoEncontradoException.class);
        assertThatThrownBy(() -> como(2, () -> { equipo.quitarPrestamo(prestamo.id()); return null; }))
                .isInstanceOf(NoEncontradoException.class);

        como(1, () -> { comprobantes.guardar(new co.granizados.pos.venta.ComprobanteService.NuevoComprobante("v-1", "data:image/jpeg;base64,AQID")); return null; });
        assertThat(como(1, () -> comprobantes.conFoto(java.util.List.of("v-1")))).containsExactly("v-1");
        assertThat(como(2, () -> comprobantes.conFoto(java.util.List.of("v-1")))).isEmpty();
        assertThatThrownBy(() -> como(2, () -> comprobantes.leer("v-1"))).isInstanceOf(NoEncontradoException.class);
        // El mismo identificador de venta en el otro negocio no pisa la foto
        como(2, () -> { comprobantes.guardar(new co.granizados.pos.venta.ComprobanteService.NuevoComprobante("v-1", "data:image/jpeg;base64,BAU=")); return null; });
        assertThat(contar("comprobante")).isEqualTo(2);
        assertThat(como(1, () -> comprobantes.leer("v-1").bytes())).containsExactly(1, 2, 3);
    }

    @Autowired
    co.granizados.pos.venta.ComprobanteService comprobantes;

    @Test
    void laMetaDelDiaDeUnTrabajadorEsDeSuNegocio() {
        var juan = como(1, () -> equipo.crear(new co.granizados.pos.equipo.EquipoService.NuevoVendedor("Juan", "1111", 0)));
        como(1, () -> equipo.ponerMeta(juan.id(), 20));

        assertThat(como(1, () -> equipo.listar().getFirst().metaHoy())).isEqualTo(20);
        assertThat(como(2, () -> equipo.listar())).isEmpty();
        assertThatThrownBy(() -> como(2, () -> equipo.ponerMeta(juan.id(), 30))).isInstanceOf(NoEncontradoException.class);
        assertThat(como(2, () -> equipo.datosPremios().diasAnalizados())).isZero();
        // Cuánto se va a hacer: el otro negocio no ve a ese trabajador ni puede pedir su proyección
        assertThat(como(1, () -> equipo.proyecciones())).hasSize(1);
        assertThat(como(2, () -> equipo.proyecciones())).isEmpty();
        assertThatThrownBy(() -> como(2, () -> equipo.proyeccion(juan.id()))).isInstanceOf(NoEncontradoException.class);
    }

    @Autowired
    co.granizados.pos.reporte.RespaldoService respaldo;

    @Autowired
    co.granizados.pos.reporte.CierreMesService cierres;

    @Test
    void laCopiaLasVentasBorradasYLoQueMePagueSonDeCadaNegocio() throws Exception {
        como(2, () -> ventas.registrar(new NuevaVenta("camisa-1", idCamisa(), MetodoPago.EFECTIVO, 1)));
        como(2, () -> { ventas.deshacer("camisa-1"); return null; });
        como(2, () -> plata.retirar(new PlataService.NuevoRetiro("r-2", 9_000, LugarPlata.CAJA, null)));
        como(1, () -> ventas.registrar(new NuevaVenta("smirnoff-1", idDe("Smirnoff"), MetodoPago.EFECTIVO, 1)));

        var hoy = java.time.LocalDate.parse("2026-09-25");
        assertThat(como(1, () -> ventas.borradas(hoy, hoy))).isEmpty();
        assertThat(como(2, () -> ventas.borradas(hoy, hoy))).hasSize(1);
        assertThat(como(1, () -> cierres.cierre(null).retiros())).isZero();
        assertThat(como(2, () -> cierres.cierre(null).retiros())).isEqualTo(9_000);
        assertThatThrownBy(() -> como(1, () -> { plata.borrarRetiro("r-2"); return null; })).isInstanceOf(NoEncontradoException.class);

        String copia1 = como(1, () -> new String(respaldo.zip(), java.nio.charset.StandardCharsets.ISO_8859_1));
        String copia2 = como(2, () -> new String(respaldo.zip(), java.nio.charset.StandardCharsets.ISO_8859_1));
        assertThat(texto(copia1)).contains("smirnoff-1").doesNotContain("camisa-1").doesNotContain("Camisa");
        assertThat(texto(copia2)).contains("camisa-1").contains("Camisa").doesNotContain("smirnoff-1").doesNotContain("Smirnoff");
    }

    /** Todo el texto de los CSV del zip, para buscar adentro. */
    private static String texto(String zipLatin1) throws Exception {
        var sb = new StringBuilder();
        try (var z = new java.util.zip.ZipInputStream(new java.io.ByteArrayInputStream(
                zipLatin1.getBytes(java.nio.charset.StandardCharsets.ISO_8859_1)))) {
            while (z.getNextEntry() != null) sb.append(new String(z.readAllBytes(), java.nio.charset.StandardCharsets.UTF_8));
        }
        return sb.toString();
    }
}
