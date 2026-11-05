package co.granizados.pos.equipo;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import org.hibernate.annotations.TenantId;

/** Plata en efectivo que el dueño le pasó de la caja a un trabajador para dar vueltos ese día. */
@Entity
@Table(name = "base_vendedor")
public class BaseVendedor {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long vendedorId;

    private LocalDate dia;

    private long monto;

    private Instant creadaEn;

    @TenantId
    @Column(name = "negocio_id", updatable = false)
    private Long negocioId;

    protected BaseVendedor() {
    }

    public BaseVendedor(Long vendedorId, LocalDate dia, long monto, Instant creadaEn) {
        this.vendedorId = vendedorId;
        this.dia = dia;
        this.monto = monto;
        this.creadaEn = creadaEn;
    }

    public Long getId() { return id; }
    public Long getVendedorId() { return vendedorId; }
    public LocalDate getDia() { return dia; }
    public long getMonto() { return monto; }
    public Instant getCreadaEn() { return creadaEn; }
}
