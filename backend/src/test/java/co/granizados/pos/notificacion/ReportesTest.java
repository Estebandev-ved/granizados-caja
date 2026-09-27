package co.granizados.pos.notificacion;

import static org.assertj.core.api.Assertions.assertThat;

import co.granizados.pos.PruebaIntegracion;
import co.granizados.pos.venta.MetodoPago;
import co.granizados.pos.venta.VentaService;
import co.granizados.pos.venta.VentaService.NuevaVenta;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class ReportesTest extends PruebaIntegracion {

    @Autowired
    Reportes reportes;

    @Autowired
    VentaService ventas;

    @Test
    void sinVentasNoHayCierre() {
        assertThat(reportes.cierreDelDia()).isEmpty();
    }

    @Test
    void cierreConTotalesYEfectivoEnCaja() {
        ventas.registrar(new NuevaVenta("1", idDe("Smirnoff"), MetodoPago.EFECTIVO, 2));
        ventas.registrar(new NuevaVenta("2", idDe("Tussi"), MetodoPago.NEQUI, 1));

        var aviso = reportes.cierreDelDia().orElseThrow();

        assertThat(aviso.texto())
                .contains("Vendiste 3 granizados: $18.000")
                .contains("Nequi: $6.000")
                .contains("Efectivo: $12.000 (esto debe haber en caja)")
                .contains("Top: Smirnoff (2), Tussi (1)");
    }
}
