package co.granizados.pos.venta;

import static org.assertj.core.api.Assertions.assertThat;

import co.granizados.pos.PruebaIntegracion;
import co.granizados.pos.resumen.EstadoService;
import co.granizados.pos.venta.VentaService.NuevaVenta;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** En Ventas de hoy se ve cuáles se vendieron con promo y cuáles al precio normal (el que vende escoge «Sin promo»). */
class VentaEnPromoTest extends PruebaIntegracion {

    @Autowired
    VentaService ventas;

    @Autowired
    EstadoService estado;

    @Test
    void lasVentasDeHoyDicenSiFueronConPromo() {
        // Smirnoff vale $6.000: dos sueltos son $12.000 y en promo se cobraron $10.000
        ventas.registrar(new NuevaVenta("normal", idDe("Smirnoff"), MetodoPago.EFECTIVO, 2, null, null));
        ventas.registrar(new NuevaVenta("promo", idDe("Smirnoff"), MetodoPago.EFECTIVO, 2, null, 10_000L));

        var ultimas = estado.estado().ultimas();

        assertThat(ultimas).filteredOn(u -> u.clientUid().equals("promo")).singleElement()
                .satisfies(u -> assertThat(u.enPromo()).isTrue());
        assertThat(ultimas).filteredOn(u -> u.clientUid().equals("normal")).singleElement()
                .satisfies(u -> assertThat(u.enPromo()).isFalse());
    }
}
