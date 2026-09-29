package co.granizados.pos.plata;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/** Lo que contaste que tenías en cada lugar. Desde acá se suman y restan los movimientos. */
@Entity
@Table(name = "conteo_plata")
public class ConteoPlata {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String clientUid;
    private long caja;
    private long casa;
    private long nequi;
    private Instant creadoEn;

    protected ConteoPlata() {
    }

    public ConteoPlata(String clientUid, long caja, long casa, long nequi, Instant creadoEn) {
        this.clientUid = clientUid;
        this.caja = caja;
        this.casa = casa;
        this.nequi = nequi;
        this.creadoEn = creadoEn;
    }

    public String getClientUid() { return clientUid; }
    public long getCaja() { return caja; }
    public long getCasa() { return casa; }
    public long getNequi() { return nequi; }
    public Instant getCreadoEn() { return creadoEn; }
}
