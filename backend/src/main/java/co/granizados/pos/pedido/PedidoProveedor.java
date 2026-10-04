package co.granizados.pos.pedido;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import org.hibernate.annotations.TenantId;

/** Un pedido que se le hizo a Energy Cocktails, por WhatsApp. */
@Entity
@Table(name = "pedido_proveedor")
public class PedidoProveedor {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    private EstadoPedido estado;

    private Instant creadoEn;

    private Instant recibidoEn;

    /** UUID del celular que confirmó la llegada, para poder repetir la petición sin duplicar. */
    private String recibidoUid;

    private int totalUnidades;

    @OneToMany(mappedBy = "pedido", cascade = jakarta.persistence.CascadeType.ALL, orphanRemoval = true)
    private List<PedidoItem> items = new ArrayList<>();

    /** El negocio dueño de esta fila. Hibernate lo llena y lo filtra solo (ver TenantResolver). */
    @TenantId
    @Column(name = "negocio_id", updatable = false)
    private Long negocioId;

    protected PedidoProveedor() {
    }

    public PedidoProveedor(EstadoPedido estado, int totalUnidades, Instant creadoEn) {
        this.estado = estado;
        this.totalUnidades = totalUnidades;
        this.creadoEn = creadoEn;
    }

    public void agregarItem(PedidoItem item) {
        item.setPedido(this);
        items.add(item);
    }

    public Long getId() { return id; }
    public EstadoPedido getEstado() { return estado; }
    public Instant getCreadoEn() { return creadoEn; }
    public Instant getRecibidoEn() { return recibidoEn; }
    public String getRecibidoUid() { return recibidoUid; }
    public int getTotalUnidades() { return totalUnidades; }
    public List<PedidoItem> getItems() { return items; }

    public void setEstado(EstadoPedido estado) { this.estado = estado; }
    public void setRecibidoEn(Instant recibidoEn) { this.recibidoEn = recibidoEn; }
    public void setRecibidoUid(String recibidoUid) { this.recibidoUid = recibidoUid; }
}
