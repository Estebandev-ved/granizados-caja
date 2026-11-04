package co.granizados.pos.reporte;

import static org.assertj.core.api.Assertions.assertThat;

import co.granizados.pos.PruebaIntegracion;
import co.granizados.pos.fiado.FiadoService;
import co.granizados.pos.fiado.WhatsAppCloud;
import co.granizados.pos.plata.LugarPlata;
import co.granizados.pos.venta.MetodoPago;
import co.granizados.pos.venta.VentaService;
import co.granizados.pos.venta.VentaService.NuevaVenta;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

class ReporteFiadosYAnalisisTest extends PruebaIntegracion {

    @Autowired
    ReporteService reportes;

    @Autowired
    VentaService ventas;

    @Autowired
    FiadoService fiados;

    @MockitoBean
    WhatsAppCloud whatsapp;

    private static final Instant JUEVES_10 = Instant.parse("2026-09-24T15:00:00Z"); // 10:00 Bogotá

    private void fiar(String uid, String cliente) {
        ventas.registrar(new NuevaVenta(uid, idDe("Smirnoff"), MetodoPago.FIADO, 1, JUEVES_10, null, cliente, null));
    }

    @Test
    void elReporteSeparaLoFiadoQueYaSeCobroDeLoQueSigueDebiendose() {
        fiar("f-1", "Camila");
        fiar("f-2", "Juan");
        fiados.cobrar(fiados.pendientes().personas().stream().filter(p -> p.cliente().equals("Camila")).findFirst()
                .orElseThrow().deudas().getFirst().id(), LugarPlata.NEQUI, "cobro-1");

        var f = reportes.reporte("2026-09-24", "2026-09-24").fiados();

        assertThat(f.cobrado()).isEqualTo(6000);
        assertThat(f.pendiente()).isEqualTo(6000);
        assertThat(f.unidadesCobradas()).isEqualTo(1);
        assertThat(f.unidadesPendientes()).isEqualTo(1);
    }

    @Test
    void elCsvDiceCualFiadoYaSeCobro() {
        fiar("f-1", "Camila");
        fiar("f-2", "Juan");
        fiados.cobrar(fiados.pendientes().personas().stream().filter(p -> p.cliente().equals("Camila")).findFirst()
                .orElseThrow().deudas().getFirst().id(), LugarPlata.NEQUI, "cobro-1");

        String csv = reportes.csv("2026-09-24", "2026-09-24");

        assertThat(csv).contains("Fiado (cobrado)").contains("Fiado (debe)");
    }

    @Test
    void elAnalisisAgrupaLasComprasDelMismoMinutoYCuentaLosDescuentos() {
        // Una compra de 2 (mismo minuto) y otra de 1; la de 1 con descuento de promo
        ventas.registrar(new NuevaVenta("a1", idDe("Smirnoff"), MetodoPago.EFECTIVO, 1, JUEVES_10));
        ventas.registrar(new NuevaVenta("a2", idDe("Margarita"), MetodoPago.EFECTIVO, 1, JUEVES_10));
        ventas.registrar(new NuevaVenta("a3", idDe("Smirnoff"), MetodoPago.NEQUI, 1, JUEVES_10.plusSeconds(3600), 5000L));

        var a = reportes.reporte("2026-09-24", "2026-09-24").analisis();

        assertThat(a.compras()).isEqualTo(2);
        assertThat(a.comprasDeVarios()).isEqualTo(1);
        assertThat(a.unidadesPorCompra()).isEqualTo(1.5);
        assertThat(a.ticketPromedio()).isEqualTo((6000 + 6000 + 5000) / 2);
        assertThat(a.unidadesConDescuento()).isEqualTo(1);
        assertThat(a.descuento()).isEqualTo(1000);
        assertThat(a.diasConVenta()).isEqualTo(1);
        assertThat(a.diasDelPeriodo()).isEqualTo(1);
        assertThat(a.porTipo()).extracting(ReporteService.PorTipo::tipo).containsExactly("NORMAL");
    }
}
