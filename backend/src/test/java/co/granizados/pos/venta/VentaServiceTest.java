package co.granizados.pos.venta;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.after;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;

import co.granizados.pos.PruebaIntegracion;
import co.granizados.pos.comun.NoEncontradoException;
import co.granizados.pos.venta.VentaService.NuevaVenta;
import co.granizados.pos.venta.VentaService.Resultado;
import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class VentaServiceTest extends PruebaIntegracion {

    @Autowired
    VentaService ventas;

    private NuevaVenta venta(String uid, String sabor, MetodoPago metodo, int cantidad) {
        return new NuevaVenta(uid, idDe(sabor), metodo, cantidad);
    }

    @Test
    void registraLaVentaYDescuentaStock() {
        assertThat(ventas.registrar(venta("a1", "Smirnoff", MetodoPago.EFECTIVO, 2))).isEqualTo(Resultado.REGISTRADA);

        assertThat(stockDe("Smirnoff")).isEqualTo(8);
        var fila = jdbc.queryForMap("select total, precio_unitario, metodo, cantidad from venta where client_uid = 'a1'");
        assertThat(fila.get("total")).isEqualTo(12000L);
        assertThat(fila.get("precio_unitario")).isEqualTo(6000L);
        assertThat(fila.get("metodo")).isEqualTo("EFECTIVO");
    }

    @Test
    void ventaConPromoGuardaLoCobradoYNuncaMasQueElPrecioNormal() {
        ventas.registrar(new NuevaVenta("promo", idDe("Smirnoff"), MetodoPago.NEQUI, 2, null, 10000L));
        ventas.registrar(new NuevaVenta("abuso", idDe("Smirnoff"), MetodoPago.NEQUI, 1, null, 99000L));

        assertThat(jdbc.queryForMap("select total from venta where client_uid = 'promo'").get("total")).isEqualTo(10000L);
        assertThat(jdbc.queryForMap("select total from venta where client_uid = 'abuso'").get("total")).isEqualTo(6000L);
        assertThat(stockDe("Smirnoff")).isEqualTo(7);
    }

    @Test
    void laMismaVentaDosVecesNoSeDuplica() {
        var v = venta("repetida", "Mojito", MetodoPago.NEQUI, 1);
        assertThat(ventas.registrar(v)).isEqualTo(Resultado.REGISTRADA);
        assertThat(ventas.registrar(v)).isEqualTo(Resultado.REPETIDA);

        assertThat(contar("venta")).isEqualTo(1);
        assertThat(stockDe("Mojito")).isEqualTo(9);
    }

    @Test
    void productoQueNoExisteSeRechaza() {
        assertThatThrownBy(() -> ventas.registrar(new NuevaVenta("x", 999_999L, MetodoPago.NEQUI, 1)))
                .isInstanceOf(NoEncontradoException.class);
        assertThat(contar("venta")).isZero();
    }

    @Test
    void avisaStockBajoSoloAlCruzarElMinimo() {
        ponerStock("Chicle", 5);
        ventas.registrar(venta("c1", "Chicle", MetodoPago.NEQUI, 1)); // 5 → 4
        verify(notificador, after(300).never()).enviar(anyString(), anyString());

        ventas.registrar(venta("c2", "Chicle", MetodoPago.NEQUI, 1)); // 4 → 3: cruza el mínimo
        verify(notificador, timeout(2000)).enviar(eq("⚠️ Stock bajo: Chicle"), contains("Quedan 3 de Chicle"));

        ventas.registrar(venta("c3", "Chicle", MetodoPago.NEQUI, 1)); // 3 → 2: ya estaba bajo, no repite
        verify(notificador, after(300).times(1)).enviar(anyString(), anyString());
    }

    @Test
    void deshacerBorraLaVentaYDevuelveElStock() {
        ventas.registrar(venta("d1", "Margarita", MetodoPago.NEQUI, 3));
        assertThat(stockDe("Margarita")).isEqualTo(7);

        ventas.deshacer("d1");

        assertThat(stockDe("Margarita")).isEqualTo(10);
        assertThat(contar("venta")).isZero();
        verify(notificador, never()).enviar(anyString(), anyString());
    }

    @Test
    void usaLaHoraDelCelularSiEsCreible() {
        Instant hace2Horas = reloj.instant().minus(Duration.ofHours(2));
        Instant futuro = reloj.instant().plus(Duration.ofDays(1));
        Instant muyVieja = reloj.instant().minus(Duration.ofDays(30));
        long id = idDe("Tussi");
        ventas.registrar(new NuevaVenta("h1", id, MetodoPago.NEQUI, 1, hace2Horas));
        ventas.registrar(new NuevaVenta("h2", id, MetodoPago.NEQUI, 1, futuro));
        ventas.registrar(new NuevaVenta("h3", id, MetodoPago.NEQUI, 1, muyVieja));

        assertThat(creadaEn("h1")).isEqualTo(hace2Horas);
        assertThat(creadaEn("h2")).isEqualTo(reloj.instant());
        assertThat(creadaEn("h3")).isEqualTo(reloj.instant());
    }

    private Instant creadaEn(String uid) {
        return jdbc.queryForObject("select creada_en from venta where client_uid = ?", java.time.OffsetDateTime.class, uid).toInstant();
    }

    @Test
    void cambiarElPrecioNoAlteraVentasViejas() {
        ventas.registrar(venta("p1", "Tussi", MetodoPago.NEQUI, 1));
        jdbc.update("update producto set precio = 7000 where sabor = 'Tussi'");
        ventas.registrar(venta("p2", "Tussi", MetodoPago.NEQUI, 1));

        assertThat(jdbc.queryForList("select total from venta order by id", Long.class)).containsExactly(6000L, 7000L);
    }
}
