package co.granizados.pos.inventario;

import jakarta.persistence.Column;
import co.granizados.pos.producto.Producto;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.time.Instant;
import org.hibernate.annotations.TenantId;

/**
 * Un movimiento de stock: entrada, conteo o merma.
 * La cantidad es el delta aplicado (positivo suma, negativo resta, 0 queda como auditoría de un conteo cuadrado).
 */
@Entity
@Table(name = "entrada_inventario")
public class EntradaInventario {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String clientUid;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "producto_id")
    private Producto producto;

    private int cantidad;

    @Enumerated(EnumType.STRING)
    private TipoMovimiento tipo;

    @Enumerated(EnumType.STRING)
    private MotivoMerma motivo;

    /** Si nació de "Llegó el pedido", cuál fue. Nulo en entradas sueltas. */
    private Long pedidoId;

    private Instant creadaEn;

    /** El negocio dueño de esta fila. Hibernate lo llena y lo filtra solo (ver TenantResolver). */
    @TenantId
    @Column(name = "negocio_id", updatable = false)
    private Long negocioId;

    protected EntradaInventario() {
    }

    public EntradaInventario(String clientUid, Producto producto, int cantidad,
                             TipoMovimiento tipo, MotivoMerma motivo, Instant creadaEn) {
        this(clientUid, producto, cantidad, tipo, motivo, null, creadaEn);
    }

    public EntradaInventario(String clientUid, Producto producto, int cantidad,
                             TipoMovimiento tipo, MotivoMerma motivo, Long pedidoId, Instant creadaEn) {
        this.clientUid = clientUid;
        this.producto = producto;
        this.cantidad = cantidad;
        this.tipo = tipo;
        this.motivo = motivo;
        this.pedidoId = pedidoId;
        this.creadaEn = creadaEn;
    }

    public Long getId() { return id; }
    public String getClientUid() { return clientUid; }
    public Producto getProducto() { return producto; }
    public int getCantidad() { return cantidad; }
    public TipoMovimiento getTipo() { return tipo; }
    public MotivoMerma getMotivo() { return motivo; }
    public Long getPedidoId() { return pedidoId; }
    public Instant getCreadaEn() { return creadaEn; }
}
