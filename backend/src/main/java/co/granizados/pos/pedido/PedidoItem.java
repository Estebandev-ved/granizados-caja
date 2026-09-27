package co.granizados.pos.pedido;

import co.granizados.pos.producto.Producto;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;

/** Una línea del pedido: cuánto se pidió y cuánto llegó realmente. */
@Entity
@Table(name = "pedido_item")
public class PedidoItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "pedido_id")
    private PedidoProveedor pedido;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "producto_id")
    private Producto producto;

    private int cantidadPedida;

    private int cantidadRecibida;

    protected PedidoItem() {
    }

    public PedidoItem(Producto producto, int cantidadPedida) {
        this.producto = producto;
        this.cantidadPedida = cantidadPedida;
    }

    public Long getId() { return id; }
    public PedidoProveedor getPedido() { return pedido; }
    public Producto getProducto() { return producto; }
    public int getCantidadPedida() { return cantidadPedida; }
    public int getCantidadRecibida() { return cantidadRecibida; }

    public void setPedido(PedidoProveedor pedido) { this.pedido = pedido; }
    public void setCantidadRecibida(int cantidadRecibida) { this.cantidadRecibida = cantidadRecibida; }
}
