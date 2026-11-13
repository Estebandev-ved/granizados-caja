package co.granizados.pos.pedido;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import co.granizados.pos.PruebaIntegracion;
import co.granizados.pos.pedido.PedidoService.EstadoRecepcion;
import co.granizados.pos.pedido.PedidoService.ItemRecibido;
import co.granizados.pos.pedido.PedidoService.ItemPedidoDto;
import co.granizados.pos.pedido.PedidoService.NuevoItem;
import co.granizados.pos.pedido.PedidoService.Recepcion;
import co.granizados.pos.resumen.EstadoService;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class PedidoSeguimientoTest extends PruebaIntegracion {

    @Autowired
    PedidoService pedidos;

    @Autowired
    EstadoService estado;

    private PedidoService.PedidoCreado crear(int smirnoff, int mojito) {
        return pedidos.crear(List.of(new NuevoItem(idDe("Smirnoff"), smirnoff), new NuevoItem(idDe("Mojito"), mojito)));
    }

    @Test
    void crearElPedidoLoDejaEnCaminoYDevuelveElLink() {
        var creado = crear(20, 10);

        assertThat(creado.estado()).isEqualTo("ENVIADO");
        assertThat(creado.totalUnidades()).isEqualTo(30);
        assertThat(creado.link()).startsWith("https://wa.me/573001234567?text=");
        assertThat(creado.mensaje()).contains("• 20 Smirnoff").contains("• 10 Mojito").contains("Total: 30 unidades");
        var enCamino = estado.estado().pedido();
        assertThat(enCamino).isNotNull();
        assertThat(enCamino.id()).isEqualTo(creado.id());
        assertThat(enCamino.totalUnidades()).isEqualTo(30);
        assertThat(enCamino.items()).containsExactlyInAnyOrder(
                new ItemPedidoDto(idDe("Smirnoff"), "Smirnoff", 20, 0),
                new ItemPedidoDto(idDe("Mojito"), "Mojito", 10, 0));
    }

    @Test
    void recibirSumaExactoYElPedidoPasaARecibido() {
        var creado = crear(20, 10);
        ponerStock("Smirnoff", 1);
        ponerStock("Mojito", 0);

        var r = pedidos.recibir(creado.id(),
                new Recepcion("rx-1", List.of(new ItemRecibido(idDe("Smirnoff"), 18), new ItemRecibido(idDe("Mojito"), 10))));

        assertThat(r).isEqualTo(EstadoRecepcion.REGISTRADA);
        assertThat(stockDe("Smirnoff")).isEqualTo(19);
        assertThat(stockDe("Mojito")).isEqualTo(10);
        assertThat(estado.estado().pedido()).isNull();

        var recibido = pedidos.listar(EstadoPedido.RECIBIDO);
        assertThat(recibido).hasSize(1);
        assertThat(recibido.getFirst().items()).containsExactlyInAnyOrder(
                new ItemPedidoDto(idDe("Smirnoff"), "Smirnoff", 20, 18),
                new ItemPedidoDto(idDe("Mojito"), "Mojito", 10, 10));

        // Los movimientos quedaron ligados al pedido
        assertThat(contar("entrada_inventario")).isEqualTo(2);
        assertThat(jdbc.queryForList("select distinct pedido_id from entrada_inventario", Long.class))
                .containsExactly(creado.id());
    }

    @Test
    void recibirDosVecesNoDuplica() {
        var creado = crear(20, 10);
        ponerStock("Smirnoff", 0);
        ponerStock("Mojito", 0);
        var primera = new Recepcion("rx-1", List.of(new ItemRecibido(idDe("Smirnoff"), 20), new ItemRecibido(idDe("Mojito"), 10)));
        var segunda = new Recepcion("rx-2", List.of(new ItemRecibido(idDe("Smirnoff"), 20), new ItemRecibido(idDe("Mojito"), 10)));

        assertThat(pedidos.recibir(creado.id(), primera)).isEqualTo(EstadoRecepcion.REGISTRADA);
        assertThat(pedidos.recibir(creado.id(), segunda)).isEqualTo(EstadoRecepcion.REPETIDA);

        assertThat(stockDe("Smirnoff")).isEqualTo(20);
        assertThat(stockDe("Mojito")).isEqualTo(10);
        assertThat(contar("entrada_inventario")).isEqualTo(2);
    }

    @Test
    void siLlegaIncompletoSeRegistraLoQueLlego() {
        var creado = crear(20, 10);
        ponerStock("Smirnoff", 10);
        ponerStock("Mojito", 0);

        pedidos.recibir(creado.id(), new Recepcion("rx-1",
                List.of(new ItemRecibido(idDe("Smirnoff"), 0), new ItemRecibido(idDe("Mojito"), 7))));

        assertThat(stockDe("Smirnoff")).isEqualTo(10);
        assertThat(stockDe("Mojito")).isEqualTo(7);
        assertThat(contar("entrada_inventario")).isEqualTo(1);
        assertThat(pedidos.listar(EstadoPedido.RECIBIDO).getFirst().items()).containsExactlyInAnyOrder(
                new ItemPedidoDto(idDe("Smirnoff"), "Smirnoff", 20, 0),
                new ItemPedidoDto(idDe("Mojito"), "Mojito", 10, 7));
    }

    @Test
    void cancelarQuitaElPedidoDeCaminoYNoDejaRecibirlo() {
        var creado = crear(5, 5);
        assertThat(estado.estado().pedido()).isNotNull();

        pedidos.cancelar(creado.id());
        assertThat(estado.estado().pedido()).isNull();
        assertThat(pedidos.cancelar(creado.id())).isEqualTo(EstadoPedido.CANCELADO);

        assertThatThrownBy(() -> pedidos.recibir(creado.id(),
                new Recepcion("rx", List.of(new ItemRecibido(idDe("Smirnoff"), 5)))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("cancelado");
        assertThat(stockDe("Smirnoff")).isEqualTo(10);
    }

    @Test
    void sinNadaQuePedirNoSeArmaPedido() {
        assertThatThrownBy(() -> pedidos.crear(List.of()))
                .isInstanceOf(IllegalArgumentException.class);
    }

    private void ponerCosto(String sabor, int costo) {
        jdbc.update("update producto set costo = ? where sabor = ?", costo, sabor);
    }

    @Test
    void elBonoDelProveedorAchicaLoQueSeLePaga() {
        ponerCosto("Smirnoff", 4000);
        ponerCosto("Mojito", 4500);
        var creado = crear(20, 10); // 20 × 4000 + 10 × 4500 = 125000
        ponerStock("Smirnoff", 0);
        ponerStock("Mojito", 0);

        pedidos.recibir(creado.id(), new Recepcion("rx-1",
                List.of(new ItemRecibido(idDe("Smirnoff"), 20), new ItemRecibido(idDe("Mojito"), 10)),
                null, 50_000L));

        var dto = pedidos.listar(EstadoPedido.RECIBIDO).getFirst();
        assertThat(dto.bono()).isEqualTo(50_000L);
        assertThat(dto.pagado()).isEqualTo(75_000L);
        assertThat(jdbc.queryForObject("select monto from pago_proveedor where pedido_id = ?", Long.class, creado.id()))
                .isEqualTo(75_000L);
    }

    @Test
    void ajustarBonoDespuesDeRecibirReajustaLoPagado() {
        ponerCosto("Smirnoff", 4000);
        ponerCosto("Mojito", 4500);
        var creado = crear(20, 10); // 125000 bruto
        ponerStock("Smirnoff", 0);
        ponerStock("Mojito", 0);
        pedidos.recibir(creado.id(), new Recepcion("rx-1",
                List.of(new ItemRecibido(idDe("Smirnoff"), 20), new ItemRecibido(idDe("Mojito"), 10))));
        assertThat(jdbc.queryForObject("select monto from pago_proveedor where pedido_id = ?", Long.class, creado.id()))
                .isEqualTo(125_000L);

        var ajustado = pedidos.ajustarBono(creado.id(), 30_000L);

        assertThat(ajustado.bono()).isEqualTo(30_000L);
        assertThat(ajustado.pagado()).isEqualTo(95_000L);
        assertThat(jdbc.queryForObject("select monto from pago_proveedor where pedido_id = ?", Long.class, creado.id()))
                .isEqualTo(95_000L);
    }

    @Test
    void siElBonoCubreTodoNoSeLePagaNada() {
        ponerCosto("Smirnoff", 4000);
        var creado = pedidos.crear(List.of(new NuevoItem(idDe("Smirnoff"), 5))); // 5 × 4000 = 20000
        ponerStock("Smirnoff", 0);
        pedidos.recibir(creado.id(), new Recepcion("rx-1",
                List.of(new ItemRecibido(idDe("Smirnoff"), 5)), null, 999_999L));

        var dto = pedidos.listar(EstadoPedido.RECIBIDO).getFirst();
        assertThat(dto.bono()).isEqualTo(20_000L);
        assertThat(dto.pagado()).isEqualTo(0L);
        assertThat(contar("pago_proveedor")).isEqualTo(0);
    }

    @Test
    void noSePuedeAjustarBonoDeUnPedidoEnCamino() {
        var creado = pedidos.crear(List.of(new NuevoItem(idDe("Smirnoff"), 5)));
        assertThatThrownBy(() -> pedidos.ajustarBono(creado.id(), 1_000L))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
