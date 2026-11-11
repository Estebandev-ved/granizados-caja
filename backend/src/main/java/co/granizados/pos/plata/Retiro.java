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

/**
 * Plata que el dueño saca del negocio para él («Me pagué»). Resta de Mi plata del lugar escogido, pero no es un gasto:
 * la ganancia no cambia. En el cierre del mes se ve cuánto te pagaste y cuánto le quedó al negocio.
 */
@Entity
@Table(name = "retiro")
public class Retiro {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String clientUid;

    private long monto;

    @Enumerated(EnumType.STRING)
    private LugarPlata lugar;

    private String nota;

    private Instant creadoEn;

    @TenantId
    @Column(name = "negocio_id", updatable = false)
    private Long negocioId;

    protected Retiro() {
    }

    public Retiro(String clientUid, long monto, LugarPlata lugar, String nota, Instant creadoEn) {
        this.clientUid = clientUid;
        this.monto = monto;
        this.lugar = lugar;
        this.nota = nota;
        this.creadoEn = creadoEn;
    }

    public Long getId() { return id; }
    public String getClientUid() { return clientUid; }
    public long getMonto() { return monto; }
    public LugarPlata getLugar() { return lugar; }
    public String getNota() { return nota; }
    public Instant getCreadoEn() { return creadoEn; }
}
