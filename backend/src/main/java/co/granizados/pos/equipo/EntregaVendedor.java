package co.granizados.pos.equipo;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import org.hibernate.annotations.TenantId;

/** Lo que el trabajador dice que le entregó al dueño; el dueño confirma si es verdad. */
@Entity
@Table(name = "entrega_vendedor")
public class EntregaVendedor {

    public enum Estado { PENDIENTE, RECIBIDA, NO_RECIBIDA }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long vendedorId;

    private LocalDate dia;

    private long monto;

    private long efectivo;

    private long nequi;

    private long transferencia;

    @Enumerated(EnumType.STRING)
    private Estado estado;

    private Instant creadaEn;

    private Instant respondidaEn;

    @TenantId
    @Column(name = "negocio_id", updatable = false)
    private Long negocioId;

    protected EntregaVendedor() {
    }

    public EntregaVendedor(Long vendedorId, LocalDate dia, long efectivo, long nequi, long transferencia, Instant creadaEn) {
        this.vendedorId = vendedorId;
        this.dia = dia;
        this.efectivo = efectivo;
        this.nequi = nequi;
        this.transferencia = transferencia;
        this.monto = efectivo + nequi + transferencia;
        this.estado = Estado.PENDIENTE;
        this.creadaEn = creadaEn;
    }

    public void responder(boolean recibida, Instant cuando) {
        this.estado = recibida ? Estado.RECIBIDA : Estado.NO_RECIBIDA;
        this.respondidaEn = cuando;
    }

    public Long getId() { return id; }
    public Long getVendedorId() { return vendedorId; }
    public LocalDate getDia() { return dia; }
    public long getMonto() { return monto; }
    public long getEfectivo() { return efectivo; }
    public long getNequi() { return nequi; }
    public long getTransferencia() { return transferencia; }
    public Estado getEstado() { return estado; }
    public Instant getCreadaEn() { return creadaEn; }
    public Instant getRespondidaEn() { return respondidaEn; }
}
