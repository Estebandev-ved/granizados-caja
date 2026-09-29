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
    void conPocaPlataReparteLoQueAlcanzaYDejaReserva() {
        ventasHistoricas("Smirnoff", 20, reloj.instant().minus(Duration.ofDays(2)));
        ponerStock("Smirnoff", 5);
        ponerStock("Tussi", 1);

        jdbc.update("update producto set costo = 2200");
        // Ideal: 35 Smirnoff + 2 Tussi = 37 × $2.200. Con $50.000 solo se gasta el 80% = $40.000 → 18 unidades
        var p = pedidos.sugerido(50_000L);

        assertThat(p.disponible()).isEqualTo(40_000L);
        assertThat(p.recortado()).isTrue();
        assertThat(p.costoTotal()).isLessThanOrEqualTo(40_000L);
        // Con poca plata gana lo que más se vende; el que casi no sale (Tussi) espera
        assertThat(p.items()).extracting(PedidoService.Item::sabor, PedidoService.Item::pedir)
                .containsExactly(org.assertj.core.groups.Tuple.tuple("Smirnoff", 18), org.assertj.core.groups.Tuple.tuple("Tussi", 0));
        assertThat(p.items().getFirst().ideal()).isEqualTo(35);
    }

    @Test
    void conPocaPlataElMasVendidoNoQuedaBajoLosQueCasiNoSalen() {
        jdbc.update("update producto set costo = 2200");
        // Smirnoff vende 2/día con 4 en mano; Chicle casi no vende y está agotado; Mojito casi no vende y tiene 2
        ventasHistoricas("Smirnoff", 4, reloj.instant().minus(Duration.ofDays(2)));
        ventasHistoricas("Chicle", 1, reloj.instant().minus(Duration.ofDays(2)));
        ponerStock("Smirnoff", 4);
        ponerStock("Chicle", 0);
        ponerStock("Mojito", 2);

        // $6.000 → gasta $4.800 → 2 unidades: una al agotado y la otra a Smirnoff, no a Mojito
        var p = pedidos.sugerido(6_000L);

        var por = p.items().stream().collect(java.util.stream.Collectors.toMap(PedidoService.Item::sabor, PedidoService.Item::pedir));
        assertThat(por.get("Chicle")).isEqualTo(1);
        assertThat(por.get("Smirnoff")).isEqualTo(1);
        assertThat(por.get("Mojito")).isZero();
    }

    @Test
    void conPlataDeSobraPideLoIdeal() {
        ventasHistoricas("Smirnoff", 20, reloj.instant().minus(Duration.ofDays(2)));
        ponerStock("Smirnoff", 5);

        var p = pedidos.sugerido(1_000_000L);

        assertThat(p.recortado()).isFalse();
        assertThat(p.items().getFirst().pedir()).isEqualTo(35);
    }

    @Test
    void sinPlataNoPideNadaPeroDejaLosSaboresParaSubirlosAMano() {
        jdbc.update("update producto set costo = 2200");
        ponerStock("Chicle", 0);

        var p = pedidos.sugerido(0L);

        assertThat(p.total()).isZero();
        assertThat(p.items()).extracting(PedidoService.Item::sabor).contains("Chicle");
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
