package co.granizados.pos.plata;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/** Plata que entra (+) o sale (−) de una meta. */
@Entity
@Table(name = "aporte_meta")
public class AporteMeta {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String clientUid;
    private Long metaId;
    private long monto;
    private Instant creadoEn;

    protected AporteMeta() {
    }

    public AporteMeta(String clientUid, Long metaId, long monto, Instant creadoEn) {
        this.clientUid = clientUid;
        this.metaId = metaId;
        this.monto = monto;
        this.creadoEn = creadoEn;
    }

    public Long getMetaId() { return metaId; }
    public long getMonto() { return monto; }
}
