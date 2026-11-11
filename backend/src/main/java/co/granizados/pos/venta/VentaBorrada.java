package co.granizados.pos.venta;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import org.hibernate.annotations.TenantId;

/**
 * Constancia de una venta que se borró: qué era, de quién era, quién la borró y cuándo. No mueve stock ni plata;
 * sirve para que el dueño vea si alguien cobra y después borra la venta.
 */
@Entity
@Table(name = "venta_borrada")
public class VentaBorrada {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String ventaUid;

    /** De quién era la venta (null = del dueño). */
    private Long vendedorId;

    /** Quién la borró (null = el dueño). */
    private Long borroVendedorId;

    private String sabor;

    private int cantidad;

    private long total;

    private String metodo;

    private Instant vendidaEn;

    private Instant borradaEn;

    @TenantId
    @Column(name = "negocio_id", updatable = false)
    private Long negocioId;

    protected VentaBorrada() {
    }

    public VentaBorrada(Venta v, Long borroVendedorId, Instant borradaEn) {
        this.ventaUid = v.getClientUid();
        this.vendedorId = v.getVendedorId();
        this.borroVendedorId = borroVendedorId;
        this.sabor = v.getProducto().nombre();
        this.cantidad = v.getCantidad();
        this.total = v.getTotal();
        this.metodo = v.getMetodo().name();
        this.vendidaEn = v.getCreadaEn();
        this.borradaEn = borradaEn;
    }

    public Long getId() { return id; }
    public String getVentaUid() { return ventaUid; }
    public Long getVendedorId() { return vendedorId; }
    public Long getBorroVendedorId() { return borroVendedorId; }
    public String getSabor() { return sabor; }
    public int getCantidad() { return cantidad; }
    public long getTotal() { return total; }
    public String getMetodo() { return metodo; }
    public Instant getVendidaEn() { return vendidaEn; }
    public Instant getBorradaEn() { return borradaEn; }
}
