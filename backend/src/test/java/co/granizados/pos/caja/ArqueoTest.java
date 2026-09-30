package co.granizados.pos.caja;

import static org.assertj.core.api.Assertions.assertThat;

import co.granizados.pos.PruebaIntegracion;
import co.granizados.pos.notificacion.Reportes;
import co.granizados.pos.plata.PlataService;
import co.granizados.pos.venta.MetodoPago;
import co.granizados.pos.venta.VentaService;
import co.granizados.pos.venta.VentaService.NuevaVenta;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class ArqueoTest extends PruebaIntegracion {

    @Autowired
    ArqueoService arqueos;

    @Autowired
    VentaService ventas;

    @Autowired
    Reportes reportes;

    @Autowired
    PlataService plata;

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

    @Test
    void conLaPlataContadaLoEsperadoEsLoQueDebeHaberEnLaCajaNoSoloLoDeHoy() {
        // Ya tenías $50.000 en la caja antes de vender hoy
        plata.contar(new PlataService.NuevoConteo("c-1", 50_000, 200_000, 30_000));
        reloj.avanzar(Duration.ofMinutes(1));
        ventas.registrar(new NuevaVenta("v1", idDe("Smirnoff"), MetodoPago.EFECTIVO, 1)); // +$6.000 en efectivo

        arqueos.registrar(new ArqueoService.NuevoArqueo("a1", 55_000, null, null));

        var c = arqueos.cierreDeHoy();
        assertThat(c.esperado()).isEqualTo(56_000);
        assertThat(c.diferencia()).isEqualTo(-1_000);
    }

    @Test
    void alCerrarLaCajaLoContadoPasaAserLaCajaDeMiPlata() {
        plata.contar(new PlataService.NuevoConteo("c-1", 50_000, 200_000, 30_000));
        reloj.avanzar(Duration.ofMinutes(1));
        ventas.registrar(new NuevaVenta("v1", idDe("Smirnoff"), MetodoPago.EFECTIVO, 1));
        reloj.avanzar(Duration.ofMinutes(1));

        arqueos.registrar(new ArqueoService.NuevoArqueo("a1", 55_000, null, null));
        // Repetir el mismo cierre no cuenta dos veces
        arqueos.registrar(new ArqueoService.NuevoArqueo("a1", 55_000, null, null));

        var s = plata.saldo();
        assertThat(s.caja()).isEqualTo(55_000);
        assertThat(s.casa()).isEqualTo(200_000);
        assertThat(s.nequi()).isEqualTo(30_000);
        assertThat(contar("conteo_plata")).isEqualTo(2);
    }

    @Test
    void sinLaPlataContadaElCierreSigueComparandoContraElEfectivoDeHoy() {
        ventas.registrar(new NuevaVenta("v1", idDe("Smirnoff"), MetodoPago.EFECTIVO, 2));

        arqueos.registrar(new ArqueoService.NuevoArqueo("a1", 12_000, null, null));

        assertThat(arqueos.cierreDeHoy().esperado()).isEqualTo(12_000);
        assertThat(contar("conteo_plata")).isZero();
    }
}
