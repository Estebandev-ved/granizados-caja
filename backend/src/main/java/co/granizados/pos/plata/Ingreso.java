package co.granizados.pos.plata;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/** Plata que entra y no es una venta (ej. te pagaron una deuda). El clientUid es único. */
@Entity
@Table(name = "ingreso")
public class Ingreso {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String clientUid;

    private String concepto;

    /** Pesos enteros. */
    private long monto;

    @Enumerated(EnumType.STRING)
    private LugarPlata lugar;

    private Instant creadoEn;

    protected Ingreso() {
    }

    public Ingreso(String clientUid, String concepto, long monto, LugarPlata lugar, Instant creadoEn) {
        this.clientUid = clientUid;
        this.concepto = concepto;
        this.monto = monto;
        this.lugar = lugar;
        this.creadoEn = creadoEn;
    }

    public Long getId() { return id; }
    public String getClientUid() { return clientUid; }
    public String getConcepto() { return concepto; }
    public long getMonto() { return monto; }
    public LugarPlata getLugar() { return lugar; }
    public Instant getCreadoEn() { return creadoEn; }
}
