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

    @Test
    void sinVentasEnLaSemanaNoHayResumen() {
        assertThat(reportes.resumenSemanal()).isEmpty();
    }

    @Test
    void resumenSemanalSumaLosSieteDiasHastaAyerYComparaConLaAnterior() {
        reloj.poner("2026-09-14T10:00-05:00"); // semana anterior
        ventas.registrar(new NuevaVenta("a", idDe("Smirnoff"), MetodoPago.EFECTIVO, 1));
        reloj.poner("2026-09-21T10:00-05:00"); // lunes pasado
        ventas.registrar(new NuevaVenta("b", idDe("Smirnoff"), MetodoPago.EFECTIVO, 2));
        ventas.registrar(new NuevaVenta("c", idDe("Tussi"), MetodoPago.NEQUI, 1));
        reloj.poner("2026-09-28T08:00-05:00"); // este lunes, cuando sale el aviso

        var aviso = reportes.resumenSemanal().orElseThrow();

        assertThat(aviso.texto())
                .contains("Esta semana vendiste 3 unidades: $18.000")
                .contains("Mejor día: lunes")
                .contains("Smirnoff (2), Tussi (1)")
                .contains("200% más que la semana anterior");
    }
}
