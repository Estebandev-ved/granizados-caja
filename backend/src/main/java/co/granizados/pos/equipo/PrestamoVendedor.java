package co.granizados.pos.equipo;

import co.granizados.pos.plata.LugarPlata;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import org.hibernate.annotations.TenantId;

/**
 * Plata que el dueño le prestó (adelantó) a un trabajador. Sale de Mi plata (del lugar escogido) cuando se presta y se
 * le descuenta en el próximo «Ya le pagué»: ese pago queda en `pagoId`. Mientras `pagoId` sea null, está pendiente.
 */
@Entity
@Table(name = "prestamo_vendedor")
public class PrestamoVendedor {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long vendedorId;

    private long monto;

    @Enumerated(EnumType.STRING)
    private LugarPlata lugar;

    private String nota;

    private Instant creadoEn;

    private Long pagoId;

    @TenantId
    @Column(name = "negocio_id", updatable = false)
    private Long negocioId;

    protected PrestamoVendedor() {
    }

    public PrestamoVendedor(Long vendedorId, long monto, LugarPlata lugar, String nota, Instant creadoEn) {
        this.vendedorId = vendedorId;
        this.monto = monto;
        this.lugar = lugar;
        this.nota = nota;
        this.creadoEn = creadoEn;
    }

    /** Se le descontó en ese pago (null = vuelve a quedar pendiente, porque se anuló el pago). */
    public void descontadoEn(Long pagoId) {
        this.pagoId = pagoId;
    }

    public Long getId() { return id; }
    public Long getVendedorId() { return vendedorId; }
    public long getMonto() { return monto; }
    public LugarPlata getLugar() { return lugar; }
    public String getNota() { return nota; }
    public Instant getCreadoEn() { return creadoEn; }
    public Long getPagoId() { return pagoId; }
}
