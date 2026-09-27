package co.granizados.pos.resumen;

import static org.assertj.core.api.Assertions.assertThat;

import co.granizados.pos.PruebaIntegracion;
import co.granizados.pos.venta.MetodoPago;
import co.granizados.pos.venta.VentaService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class MetaTest extends PruebaIntegracion {

    @Autowired
    EstadoService estado;

    @Autowired
    VentaService ventas;

    private void ponerMeta(long valor) {
        jdbc.update("update config set valor = ? where clave = 'META_DIARIA'", String.valueOf(valor));
    }

    private void venderEn(String fecha, long pesosTotales) {
        reloj.poner(fecha);
        // 1 unidad de Smirnoff a $6.000
        ventas.registrar(new VentaService.NuevaVenta("m-" + fecha, idDe("Smirnoff"), MetodoPago.NEQUI,
                (int) Math.max(1, Math.min(99, pesosTotales / 6000))));
    }

    @Test
    void conLaMetaApagadaNoHayRacha() {
        ponerMeta(0);
        venderEn("2026-09-24T10:00-05:00", 6000);

        var m = estado.estado().meta();

        assertThat(m.valor()).isZero();
        assertThat(m.racha()).isZero();
    }

    @Test
    void laRachaMiraHastaAyerYHoySumaSiYaCumplio() {
        ponerMeta(6000);
        venderEn("2026-09-23T10:00-05:00", 6000);
        venderEn("2026-09-24T10:00-05:00", 6000);
        reloj.poner("2026-09-25T15:00-05:00");

        assertThat(estado.estado().meta().racha()).isEqualTo(2); // hoy todavía no vende nada

        venderEn("2026-09-25T15:00-05:00", 6000);
        assertThat(estado.estado().meta().racha()).isEqualTo(3); // hoy ya cumplió
    }

    @Test
    void unDiaSinVentaRompeLaRacha() {
        ponerMeta(6000);
        venderEn("2026-09-22T10:00-05:00", 6000); // este día se queda solo
        venderEn("2026-09-24T10:00-05:00", 6000);
        venderEn("2026-09-25T10:00-05:00", 6000);
        reloj.poner("2026-09-25T15:00-05:00");

        assertThat(estado.estado().meta().racha()).isEqualTo(2);
    }

    @Test
    void elValorDeLaMetaSaleEnElEstado() {
        ponerMeta(15000);
        venderEn("2026-09-25T10:00-05:00", 18000);

        var m = estado.estado().meta();

        assertThat(m.valor()).isEqualTo(15000);
        assertThat(m.racha()).isEqualTo(1);
    }
}
