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
    AjustesService ajustes;

    @Autowired
    PlataService plata;

    @Autowired
    ArqueoService arqueos;

    @Autowired
    EstadoService estado;

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
}
