package co.granizados.pos.venta;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import co.granizados.pos.PruebaIntegracion;
import co.granizados.pos.plata.PlataService;
import co.granizados.pos.resumen.EstadoService;
import co.granizados.pos.venta.VentaService.NuevaVenta;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class PagoMixtoTest extends PruebaIntegracion {

    @Autowired
    VentaService ventas;

    @Autowired
    EstadoService estado;

    @Autowired
    PlataService plata;

    private NuevaVenta mixta(String uid, int cantidad, Long efectivo) {
        return new NuevaVenta(uid, idDe("Smirnoff"), MetodoPago.MIXTO, cantidad, null, null, null, null, efectivo);
    }

    @Test
    void laVentaMixtaReparteLaPlataEntreEfectivoYNequiYDescuentaStock() {
        int antes = stockDe("Smirnoff");

        ventas.registrar(mixta("m1", 2, 5000L)); // 12.000: 5.000 en efectivo, 7.000 por Nequi

        var hoy = estado.estado().hoy();
        assertThat(hoy.total()).isEqualTo(12000);
        assertThat(hoy.efectivo()).isEqualTo(5000);
        assertThat(hoy.nequi()).isEqualTo(7000);
        assertThat(stockDe("Smirnoff")).isEqualTo(antes - 2);
    }

    @Test
    void miPlataSumaCadaParteDondeEntro() {
        plata.contar(new PlataService.NuevoConteo("c-1", 10_000, 0, 20_000));
        reloj.avanzar(Duration.ofMinutes(1));

        ventas.registrar(mixta("m1", 2, 5000L));

        var saldo = plata.saldo();
        assertThat(saldo.caja()).isEqualTo(15_000);
        assertThat(saldo.nequi()).isEqualTo(27_000);

        var movimientos = plata.movimientos(1).stream().filter(m -> m.tipo().equals("VENTAS")).toList();
        assertThat(movimientos).extracting(PlataService.Movimiento::lugar, PlataService.Movimiento::monto)
                .containsExactlyInAnyOrder(org.assertj.core.groups.Tuple.tuple("CAJA", 5000L),
                        org.assertj.core.groups.Tuple.tuple("NEQUI", 7000L));
    }

    @Test
    void elEfectivoNoPuedeFaltarNiPasarseDelTotal() {
        assertThatThrownBy(() -> ventas.registrar(mixta("m1", 1, null))).isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> ventas.registrar(mixta("m2", 1, 6001L))).isInstanceOf(IllegalArgumentException.class);
        assertThat(contar("venta")).isZero();
    }

    @Test
    void unaLineaDeUnComboPuedeQuedarTodaEnUnSoloMetodo() {
        ventas.registrar(mixta("m1", 1, 0L));    // todo Nequi
        ventas.registrar(mixta("m2", 1, 6000L)); // todo efectivo

        var hoy = estado.estado().hoy();
        assertThat(hoy.efectivo()).isEqualTo(6000);
        assertThat(hoy.nequi()).isEqualTo(6000);
    }

    @Test
    void repetirLaMismaVentaMixtaNoDuplica() {
        ventas.registrar(mixta("m1", 1, 2000L));
        var segunda = ventas.registrar(mixta("m1", 1, 2000L));

        assertThat(segunda).isEqualTo(VentaService.Resultado.REPETIDA);
        assertThat(estado.estado().hoy().efectivo()).isEqualTo(2000);
    }
}
