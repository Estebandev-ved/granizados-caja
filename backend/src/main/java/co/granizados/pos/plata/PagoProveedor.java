package co.granizados.pos.plata;

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

/** Lo que se le pagó a Energy Cocktails por un pedido. Uno por pedido. */
@Entity
@Table(name = "pago_proveedor")
public class PagoProveedor {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long pedidoId;

    private long monto;

    @Enumerated(EnumType.STRING)
    private LugarPlata lugar;

    private Instant creadoEn;

    /** El negocio dueño de esta fila. Hibernate lo llena y lo filtra solo (ver TenantResolver). */
    @TenantId
    @Column(name = "negocio_id", updatable = false)
    private Long negocioId;

    protected PagoProveedor() {
    }

    public PagoProveedor(Long pedidoId, long monto, LugarPlata lugar, Instant creadoEn) {
        this.pedidoId = pedidoId;
        this.monto = monto;
        this.lugar = lugar;
        this.creadoEn = creadoEn;
    }

    public long getMonto() { return monto; }
    public LugarPlata getLugar() { return lugar; }
    public Instant getCreadoEn() { return creadoEn; }
}
