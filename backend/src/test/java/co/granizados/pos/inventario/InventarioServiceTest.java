package co.granizados.pos.inventario;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import co.granizados.pos.PruebaIntegracion;
import co.granizados.pos.resumen.EstadoService;
import co.granizados.pos.venta.MetodoPago;
import co.granizados.pos.venta.VentaService;
import co.granizados.pos.venta.VentaService.NuevaVenta;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class InventarioServiceTest extends PruebaIntegracion {

    @Autowired
    InventarioService inventario;

    @Autowired
    VentaService ventas;

    @Autowired
    EstadoService estado;

    private InventarioService.NuevoMovimiento conteo(String uid, long productoId, int real) {
        return new InventarioService.NuevoMovimiento(uid, productoId, TipoMovimiento.CONTEO, null, real, null);
    }

    private InventarioService.NuevoMovimiento merma(String uid, long productoId, int cantidad, MotivoMerma motivo) {
        return new InventarioService.NuevoMovimiento(uid, productoId, TipoMovimiento.MERMA, cantidad, null, motivo);
    }

    private InventarioService.NuevoMovimiento entrada(String uid, long productoId, int cantidad) {
        return new InventarioService.NuevoMovimiento(uid, productoId, TipoMovimiento.ENTRADA, cantidad, null, null);
    }

    @Test
    void elConteoCuadraConLasVentasDeAntesYDespues() {
        ponerStock("Smirnoff", 20);
        // El celular ya vendió 3 y eso subió antes que el conteo
        ventas.registrar(new NuevaVenta("v-antes", idDe("Smirnoff"), MetodoPago.NEQUI, 3));
        assertThat(stockDe("Smirnoff")).isEqualTo(17);

        // El dueño contó 12 en el anaquel: sobran/faltan 5 y eso es lo que queda
        inventario.registrar(conteo("c1", idDe("Smirnoff"), 12));
        assertThat(stockDe("Smirnoff")).isEqualTo(12);

        // Una venta que llega después del conteo se resta encima
        ventas.registrar(new NuevaVenta("v-despues", idDe("Smirnoff"), MetodoPago.EFECTIVO, 2));
        assertThat(stockDe("Smirnoff")).isEqualTo(10);
    }

    @Test
    void unConteoCuadradoTambienSeGuarda() {
        ponerStock("Mojito", 7);
        inventario.registrar(conteo("c-cuadrado", idDe("Mojito"), 7));

        assertThat(stockDe("Mojito")).isEqualTo(7);
        assertThat(contar("entrada_inventario")).isEqualTo(1);
        var fila = jdbc.queryForMap("select cantidad, tipo from entrada_inventario where client_uid = 'c-cuadrado'");
        assertThat(((Number) fila.get("cantidad")).intValue()).isZero();
        assertThat(fila.get("tipo")).isEqualTo("CONTEO");
    }

    @Test
    void laMermaRestaUnidadesSinSumarPlata() {
        ponerStock("Mojito", 10);
        inventario.registrar(merma("m1", idDe("Mojito"), 2, MotivoMerma.VENCIDO));

        assertThat(stockDe("Mojito")).isEqualTo(8);
        var h = estado.estado().hoy();
        assertThat(h.total()).isZero();
        assertThat(h.unidades()).isZero();
        assertThat(h.nequi()).isZero();
        assertThat(h.efectivo()).isZero();
    }

    @Test
    void laMermaSinMotivoNoPasa() {
        var sinMotivo = new InventarioService.NuevoMovimiento("m-mala", idDe("Mojito"), TipoMovimiento.MERMA, 1, null, null);
        assertThatThrownBy(() -> inventario.registrar(sinMotivo))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("motivo");
        assertThat(stockDe("Mojito")).isEqualTo(10);
    }

    @Test
    void laIdempotenciaSeMantieneEnLosTresTipos() {
        ponerStock("Sangría", 10);

        var entrada = entrada("r1", idDe("Sangría"), 5);
        assertThat(inventario.registrar(entrada)).isEqualTo(InventarioService.Resultado.REGISTRADA);
        assertThat(inventario.registrar(entrada)).isEqualTo(InventarioService.Resultado.REPETIDA);
        assertThat(stockDe("Sangría")).isEqualTo(15);

        var cuenta = conteo("c1", idDe("Sangría"), 4);
        assertThat(inventario.registrar(cuenta)).isEqualTo(InventarioService.Resultado.REGISTRADA);
        assertThat(inventario.registrar(cuenta)).isEqualTo(InventarioService.Resultado.REPETIDA);
        assertThat(stockDe("Sangría")).isEqualTo(4);

        var pega = merma("m1", idDe("Sangría"), 1, MotivoMerma.DANADO);
        assertThat(inventario.registrar(pega)).isEqualTo(InventarioService.Resultado.REGISTRADA);
        assertThat(inventario.registrar(pega)).isEqualTo(InventarioService.Resultado.REPETIDA);
        assertThat(stockDe("Sangría")).isEqualTo(3);
    }
}
