package co.granizados.pos.resumen;

import static org.assertj.core.api.Assertions.assertThat;

import co.granizados.pos.PruebaIntegracion;
import co.granizados.pos.gasto.CategoriaGasto;
import co.granizados.pos.gasto.GastoService;
import co.granizados.pos.inventario.InventarioService;
import co.granizados.pos.inventario.MotivoMerma;
import co.granizados.pos.inventario.TipoMovimiento;
import co.granizados.pos.notificacion.Reportes;
import co.granizados.pos.venta.MetodoPago;
import co.granizados.pos.venta.VentaService;
import co.granizados.pos.venta.VentaService.NuevaVenta;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class GananciaTest extends PruebaIntegracion {

    @Autowired
    EstadoService estado;

    @Autowired
    VentaService ventas;

    @Autowired
    GastoService gastos;

    @Autowired
    InventarioService inventario;

    @Autowired
    Reportes reportes;

    private void ponerCosto(String sabor, long costo) {
        jdbc.update("update producto set costo = ? where sabor = ?", costo, sabor);
    }

    @Test
    void laGananciaRestaCostoGastosYMermas() {
        ponerCosto("Smirnoff", 3000);

        ventas.registrar(new NuevaVenta("v1", idDe("Smirnoff"), MetodoPago.EFECTIVO, 2));
        gastos.registrar(new GastoService.NuevoGasto("g1", CategoriaGasto.HIELO, "bolsas de hielo", 1500, null));
        inventario.registrar(new InventarioService.NuevoMovimiento(
                "m1", idDe("Smirnoff"), TipoMovimiento.MERMA, 1, null, MotivoMerma.DANADO));

        var h = estado.resumenDe(estado.hoy());
        assertThat(h.total()).isEqualTo(12000);
        assertThat(h.costo()).isEqualTo(6000);
        assertThat(h.gastos()).isEqualTo(1500);
        assertThat(h.mermas()).isEqualTo(3000);
        assertThat(h.ganancia()).isEqualTo(1500);
    }

    @Test
    void cambiarElCostoNoReescribeLasVentasViejas() {
        ponerCosto("Smirnoff", 1000);
        ventas.registrar(new NuevaVenta("v1", idDe("Smirnoff"), MetodoPago.NEQUI, 1));
        ponerCosto("Smirnoff", 5000);
        ventas.registrar(new NuevaVenta("v2", idDe("Smirnoff"), MetodoPago.NEQUI, 1));

        var h = estado.resumenDe(estado.hoy());
        assertThat(h.total()).isEqualTo(12000);
        assertThat(h.costo()).isEqualTo(6000); // 1000 de la primera + 5000 de la segunda
        assertThat(h.ganancia()).isEqualTo(6000);
    }

    @Test
    void elGastoNoSeDuplicaYSePuedeBorrar() {
        assertThat(gastos.registrar(new GastoService.NuevoGasto("g1", CategoriaGasto.HIELO, "hielo", 1500, null)))
                .isEqualTo(GastoService.Resultado.REGISTRADA);
        assertThat(gastos.registrar(new GastoService.NuevoGasto("g1", CategoriaGasto.HIELO, "hielo", 1500, null)))
                .isEqualTo(GastoService.Resultado.REPETIDA);
        assertThat(contar("gasto")).isEqualTo(1);

        gastos.borrar("g1");
        assertThat(contar("gasto")).isEqualTo(0);
        assertThat(estado.resumenDe(estado.hoy()).gastos()).isZero();
    }

    @Test
    void elCierreDeTelegramTraeLaGanancia() {
        ponerCosto("Smirnoff", 3000);
        ventas.registrar(new NuevaVenta("1", idDe("Smirnoff"), MetodoPago.EFECTIVO, 2));
        gastos.registrar(new GastoService.NuevoGasto("g1", CategoriaGasto.TRANSPORTE, "gasolina", 2000, null));

        var aviso = reportes.cierreDelDia().orElseThrow();
        assertThat(aviso.texto())
                .contains("Lo que costó: $6.000")
                .contains("Gastos: $2.000")
                .contains("Ganancia: $4.000");
    }
}
