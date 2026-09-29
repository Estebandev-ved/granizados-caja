package co.granizados.pos.reporte;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.groups.Tuple.tuple;

import co.granizados.pos.PruebaIntegracion;
import co.granizados.pos.gasto.CategoriaGasto;
import co.granizados.pos.gasto.GastoService;
import co.granizados.pos.inventario.InventarioService;
import co.granizados.pos.inventario.MotivoMerma;
import co.granizados.pos.inventario.TipoMovimiento;
import co.granizados.pos.pedido.PedidoService;
import co.granizados.pos.venta.MetodoPago;
import co.granizados.pos.venta.VentaService;
import co.granizados.pos.venta.VentaService.NuevaVenta;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class ReporteServiceTest extends PruebaIntegracion {

    @Autowired
    ReporteService reportes;

    @Autowired
    VentaService ventas;

    @Autowired
    GastoService gastos;

    @Autowired
    InventarioService inventario;

    @Autowired
    PedidoService pedidos;

    private static final Instant JUEVES_10 = Instant.parse("2026-09-24T15:00:00Z"); // 10:00 Bogotá
    private static final Instant VIERNES_14 = Instant.parse("2026-09-25T19:00:00Z"); // 14:00 Bogotá

    private void ponerCosto(String sabor, long costo) {
        jdbc.update("update producto set costo = ? where sabor = ?", costo, sabor);
    }

    @Test
    void elReporteCuentaLasDosCarasDelPeriodo() {
        ponerCosto("Smirnoff", 3000);
        ventas.registrar(new NuevaVenta("v1", idDe("Smirnoff"), MetodoPago.EFECTIVO, 2, JUEVES_10));
        ventas.registrar(new NuevaVenta("v2", idDe("Smirnoff"), MetodoPago.NEQUI, 1, VIERNES_14));
        gastos.registrar(new GastoService.NuevoGasto("g1", CategoriaGasto.HIELO, "bolsas", 1500, JUEVES_10));
        inventario.registrar(new InventarioService.NuevoMovimiento(
                "m1", idDe("Smirnoff"), TipoMovimiento.MERMA, 1, null, MotivoMerma.DANADO));

        var r = reportes.reporte("2026-09-24", "2026-09-25");

        assertThat(r.totales().ventas()).isEqualTo(18000);
        assertThat(r.totales().unidades()).isEqualTo(3);
        assertThat(r.totales().efectivo()).isEqualTo(12000);
        assertThat(r.totales().nequi()).isEqualTo(6000);
        assertThat(r.totales().costo()).isEqualTo(9000);
        assertThat(r.totales().gastos()).isEqualTo(1500);
        assertThat(r.totales().mermas()).isEqualTo(3000);
        assertThat(r.totales().ganancia()).isEqualTo(4500);

        assertThat(r.porDia()).extracting(ReporteService.PorDia::dia, ReporteService.PorDia::ganancia)
                .containsExactly(tuple("2026-09-24", 4500L), tuple("2026-09-25", 0L));
    }

    @Test
    void cortaPorHoraYPorDiaDeLaSemana() {
        ponerCosto("Smirnoff", 3000);
        ventas.registrar(new NuevaVenta("v1", idDe("Smirnoff"), MetodoPago.NEQUI, 2, JUEVES_10));
        ventas.registrar(new NuevaVenta("v2", idDe("Smirnoff"), MetodoPago.NEQUI, 1, VIERNES_14));

        var r = reportes.reporte("2026-09-24", "2026-09-25");

        assertThat(r.porHora()).filteredOn(p -> p.unidades() > 0)
                .extracting(ReporteService.PorEtiqueta::nombre, ReporteService.PorEtiqueta::unidades)
                .containsExactly(tuple("10", 2), tuple("14", 1));

        assertThat(r.porDiaSemana()).filteredOn(p -> p.unidades() > 0)
                .extracting(ReporteService.PorEtiqueta::nombre, ReporteService.PorEtiqueta::unidades)
                .containsExactly(tuple("jueves", 2), tuple("viernes", 1));
    }

    @Test
    void elSaborMasVendidoVaPrimeroYTraeSuGanancia() {
        ponerCosto("Smirnoff", 3000);
        ponerCosto("Piña colada", 4000);
        ventas.registrar(new NuevaVenta("v1", idDe("Smirnoff"), MetodoPago.NEQUI, 3, VIERNES_14));
        ventas.registrar(new NuevaVenta("v2", idDe("Piña colada"), MetodoPago.NEQUI, 1, VIERNES_14));

        var r = reportes.reporte("2026-09-25", "2026-09-25");

        assertThat(r.porSabor()).extracting(ReporteService.PorSabor::sabor, ReporteService.PorSabor::unidades)
                .containsExactly(tuple("Smirnoff", 3), tuple("Piña colada", 1));
        assertThat(r.porSabor().getFirst().ganancia()).isEqualTo(9000);
    }

    @Test
    void elCSVTraeUnaLineaPorVenta() {
        ponerCosto("Smirnoff", 3000);
        ventas.registrar(new NuevaVenta("v1", idDe("Smirnoff"), MetodoPago.EFECTIVO, 2, JUEVES_10));

        String csv = reportes.csv("2026-09-24", "2026-09-25");
        String[] lineas = csv.split("\n");

        assertThat(lineas[0]).isEqualTo("sep=;");
        assertThat(lineas[1]).isEqualTo("fecha;hora;sabor;cantidad;precio;total;costo;metodo");
        assertThat(lineas).hasSize(3);
        assertThat(lineas[2]).isEqualTo("2026-09-24;10:00;Smirnoff;2;6000;12000;6000;Efectivo");
        assertThat(reportes.csv("2026-09-26", "2026-09-26").split("\n")).hasSize(2);
    }

    @Test
    void meteLosPedidosDelPeriodo() {
        pedidos.crear(List.of(new PedidoService.NuevoItem(idDe("Smirnoff"), 20)));

        var r = reportes.reporte("2026-09-25", "2026-09-25");
        var otro = reportes.reporte("2026-09-20", "2026-09-20");

        assertThat(r.pedidos()).hasSize(1);
        assertThat(r.pedidos().getFirst().totalUnidades()).isEqualTo(20);
        assertThat(otro.pedidos()).isEmpty();
    }

    @Test
    void rechazaFechasAlReves() {
        assertThatThrownBy(() -> reportes.reporte("2026-09-25", "2026-09-24"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> reportes.reporte("2024-01-01", "2026-01-01"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
