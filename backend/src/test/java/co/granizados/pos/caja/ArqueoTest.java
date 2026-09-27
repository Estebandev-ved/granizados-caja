package co.granizados.pos.caja;

import static org.assertj.core.api.Assertions.assertThat;

import co.granizados.pos.PruebaIntegracion;
import co.granizados.pos.notificacion.Reportes;
import co.granizados.pos.venta.MetodoPago;
import co.granizados.pos.venta.VentaService;
import co.granizados.pos.venta.VentaService.NuevaVenta;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class ArqueoTest extends PruebaIntegracion {

    @Autowired
    ArqueoService arqueos;

    @Autowired
    VentaService ventas;

    @Autowired
    Reportes reportes;

    @Test
    void quedaUnSoloCierrePorDiaYSePuedeRepetir() {
        var primero = arqueos.registrar(new ArqueoService.NuevoArqueo("a1", 4000, "corto", null));
        var mismo = arqueos.registrar(new ArqueoService.NuevoArqueo("a1", 4000, "corto", null));
        var otro = arqueos.registrar(new ArqueoService.NuevoArqueo("a2", 6000, "recuento", null));

        assertThat(primero).isEqualTo(ArqueoService.Resultado.REGISTRADA);
        assertThat(mismo).isEqualTo(ArqueoService.Resultado.REPETIDA);
        assertThat(otro).isEqualTo(ArqueoService.Resultado.REGISTRADA);
        assertThat(contar("arqueo")).isEqualTo(1);
        assertThat(arqueos.cierreDeHoy().contado()).isEqualTo(6000);
    }

    @Test
    void laDiferenciaDiceCuantoFaltaOSobra() {
        ventas.registrar(new NuevaVenta("v1", idDe("Smirnoff"), MetodoPago.EFECTIVO, 2)); // 12.000 en caja
        arqueos.registrar(new ArqueoService.NuevoArqueo("a1", 10000, null, null));

        var c = arqueos.cierreDeHoy();

        assertThat(c.esperado()).isEqualTo(12000);
        assertThat(c.contado()).isEqualTo(10000);
        assertThat(c.diferencia()).isEqualTo(-2000);
    }

    @Test
    void elCierreDeTelegramCuentaSiFaltoPlata() {
        ventas.registrar(new NuevaVenta("v1", idDe("Smirnoff"), MetodoPago.EFECTIVO, 2));
        arqueos.registrar(new ArqueoService.NuevoArqueo("a1", 9500, null, null));

        assertThat(reportes.cierreDelDia().orElseThrow().texto()).contains("Faltaron $2.500");

        arqueos.registrar(new ArqueoService.NuevoArqueo("a2", 12000, null, null));
        assertThat(reportes.cierreDelDia().orElseThrow().texto()).contains("Caja: cuadró");
    }
}
