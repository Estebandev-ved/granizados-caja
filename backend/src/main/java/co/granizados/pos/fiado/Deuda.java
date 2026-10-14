package co.granizados.pos.fiado;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import org.hibernate.annotations.TenantId;

/** Lo que un cliente debe de una venta fiada. Se cobra entera: pagadaEn nulo = sigue debiendo. */
@Entity
@Table(name = "deuda")
public class Deuda {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** client_uid de la venta fiada: une la deuda con la venta. */
    private String ventaUid;

    private String cliente;

    private String telefono;

    private long monto;

    private String detalle;

    private Instant creadaEn;

    private Instant pagadaEn;

    /** El negocio dueño de esta fila. Hibernate lo llena y lo filtra solo (ver TenantResolver). */
    @TenantId
    @Column(name = "negocio_id", updatable = false)
    private Long negocioId;

    protected Deuda() {
    }

    public Deuda(String ventaUid, String cliente, String telefono, long monto, String detalle, Instant creadaEn) {
        this.ventaUid = ventaUid;
        this.cliente = cliente;
        this.telefono = telefono;
        this.monto = monto;
        this.detalle = detalle;
        this.creadaEn = creadaEn;
    }

    public Long getId() { return id; }
    public String getVentaUid() { return ventaUid; }
    public String getCliente() { return cliente; }
    public String getTelefono() { return telefono; }
    public long getMonto() { return monto; }
    public String getDetalle() { return detalle; }
    public Instant getCreadaEn() { return creadaEn; }
    public Instant getPagadaEn() { return pagadaEn; }
    public boolean estaPagada() { return pagadaEn != null; }

    public void setTelefono(String telefono) { this.telefono = telefono; }
    public void setPagadaEn(Instant pagadaEn) { this.pagadaEn = pagadaEn; }
}
