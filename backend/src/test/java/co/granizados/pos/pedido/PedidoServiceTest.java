package co.granizados.pos.pedido;

import static org.assertj.core.api.Assertions.assertThat;

import co.granizados.pos.PruebaIntegracion;
import co.granizados.pos.notificacion.Reportes;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class PedidoServiceTest extends PruebaIntegracion {

    @Autowired
    PedidoService pedidos;

    @Autowired
    Reportes reportes;

    /** Mete ventas directo en la tabla, con la fecha que uno quiera. */
    private void ventasHistoricas(String sabor, int unidades, Instant cuando) {
        for (int i = 0; i < unidades; i++) {
            jdbc.update("""
                    insert into venta (client_uid, producto_id, cantidad, precio_unitario, total, metodo, creada_en)
                    values (?, ?, 1, 6000, 6000, 'NEQUI', ?)""",
                    sabor + "-" + cuando + "-" + i, idDe(sabor), Timestamp.from(cuando.plusSeconds(i)));
        }
    }

    @Test
    void sugiereSegunElPromedioDiario() {
        // 20 Smirnoff en 2 días = 10/día. Cobertura 4 días → objetivo 40. Hay 5 → pedir 35
        ventasHistoricas("Smirnoff", 20, reloj.instant().minus(Duration.ofDays(2)));
        ponerStock("Smirnoff", 5);
        ponerStock("Tussi", 1); // debajo del mínimo 3 → pedir 2

        var p = pedidos.sugerido();

        assertThat(p.items()).extracting(PedidoService.Item::sabor, PedidoService.Item::pedir)
                .containsExactly(org.assertj.core.groups.Tuple.tuple("Smirnoff", 35), org.assertj.core.groups.Tuple.tuple("Tussi", 2));
        assertThat(p.items().getFirst().promedioDia()).isEqualTo(10.0);
        assertThat(p.total()).isEqualTo(37);
        assertThat(p.tieneProveedor()).isTrue();
        assertThat(p.link()).startsWith("https://wa.me/573001234567?text=");
        String texto = URLDecoder.decode(p.link().substring(p.link().indexOf("text=") + 5), StandardCharsets.UTF_8);
        assertThat(texto).contains("• 35 Smirnoff").contains("Total: 37 unidades").contains("— Esteban");
    }

    @Test
    void redondeaHaciaArribaSinErroresDeDecimales() {
        // 7 en 3 días × cobertura 3 = exactamente 7. Con doubles daba 7.000000001 → 8
        jdbc.update("update config set valor = '3' where clave = 'DIAS_COBERTURA'");
        ventasHistoricas("Mojito", 7, reloj.instant().minus(Duration.ofDays(3)));
        ponerStock("Mojito", 0);

        var mojito = pedidos.sugerido().items().stream().filter(i -> i.sabor().equals("Mojito")).findFirst().orElseThrow();
        assertThat(mojito.pedir()).isEqualTo(7);
    }

    @Test
    void sinNadaQuePedir() {
        var p = pedidos.sugerido();
        assertThat(p.items()).isEmpty();
        assertThat(reportes.pedidoSemanal().texto()).contains("no hace falta pedir");
    }

    @Test
    void sinProveedorConfiguradoNoHayLinkDirecto() {
        jdbc.update("update config set valor = '' where clave = 'PROVEEDOR_WHATSAPP'");
        ponerStock("Chicle", 0);
        assertThat(pedidos.sugerido().tieneProveedor()).isFalse();
        assertThat(reportes.pedidoSemanal().texto()).contains("Pon el WhatsApp del proveedor");
    }
}
