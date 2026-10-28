package co.granizados.pos.venta;

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

@Entity
@Table(name = "venta")
public class Venta {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** UUID que genera el celular. Único: si la misma venta llega dos veces, no se duplica. */
    private String clientUid;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "producto_id")
    private Producto producto;

    private int cantidad;

    /** Se guarda el precio del momento, así cambiar el precio después no altera las ventas viejas. */
    private long precioUnitario;

    /** Igual con el costo: cambiarlo mañana no reescribe lo que ya se vendió. */
    private long costoUnitario;

    private long total;

    @Enumerated(EnumType.STRING)
    private MetodoPago metodo;

    /** Solo MIXTO: cuánto de `total` se pagó en efectivo; el resto fue por Nequi. */
    private Long montoEfectivo;

    /** Quién la vendió: el id del trabajador, o null si la hizo el dueño. */
    private Long vendedorId;

    private Instant creadaEn;

    /** El negocio dueño de esta fila. Hibernate lo llena y lo filtra solo (ver TenantResolver). */
    @TenantId
    @Column(name = "negocio_id", updatable = false)
    private Long negocioId;

    protected Venta() {
    }

    public Venta(String clientUid, Producto producto, int cantidad, MetodoPago metodo, Instant creadaEn) {
        this(clientUid, producto, cantidad, producto.getPrecio(), producto.getCosto(), metodo, creadaEn);
    }

    /** Venta con promoción (ej. 2 x $10.000): `total` es lo cobrado, y el precio unitario queda como el promedio. */
    public Venta(String clientUid, Producto producto, int cantidad, MetodoPago metodo, Instant creadaEn, long total) {
        this(clientUid, producto, cantidad, producto.getPrecio(), producto.getCosto(), metodo, creadaEn);
        this.total = total;
        this.precioUnitario = total / cantidad;
    }

    /** Para ventas históricas importadas: el precio y costo no son los actuales del catálogo, sino los del momento. */
    public Venta(String clientUid, Producto producto, int cantidad, long precioUnitario, long costoUnitario,
                 MetodoPago metodo, Instant creadaEn) {
        this.clientUid = clientUid;
        this.producto = producto;
        this.cantidad = cantidad;
        this.precioUnitario = precioUnitario;
        this.costoUnitario = costoUnitario;
        this.total = precioUnitario * cantidad;
        this.metodo = metodo;
        this.creadaEn = creadaEn;
    }

    /** Venta pagada mitad y mitad: `efectivo` en la caja y el resto por Nequi. */
    public Venta mixto(long efectivo) {
        this.metodo = MetodoPago.MIXTO;
        this.montoEfectivo = efectivo;
        return this;
    }

    /** Lo de esta venta que entró a la caja (el fiado no entra hasta cobrarlo). */
    public long efectivo() {
        return switch (metodo) {
            case EFECTIVO -> total;
            case MIXTO -> montoEfectivo == null ? 0 : montoEfectivo;
            case NEQUI, FIADO -> 0;
        };
    }

    /** Lo de esta venta que entró por Nequi. */
    public long nequi() {
        return switch (metodo) {
            case NEQUI -> total;
            case MIXTO -> total - efectivo();
            case EFECTIVO, FIADO -> 0;
        };
    }

    public Venta porVendedor(Long vendedorId) {
        this.vendedorId = vendedorId;
        return this;
    }

    public Long getId() { return id; }
    public Long getVendedorId() { return vendedorId; }
    public String getClientUid() { return clientUid; }
    public Producto getProducto() { return producto; }
    public int getCantidad() { return cantidad; }
    public long getPrecioUnitario() { return precioUnitario; }
    public long getCostoUnitario() { return costoUnitario; }
    public long getTotal() { return total; }
    public MetodoPago getMetodo() { return metodo; }
    public Long getMontoEfectivo() { return montoEfectivo; }
    public Instant getCreadaEn() { return creadaEn; }
}
