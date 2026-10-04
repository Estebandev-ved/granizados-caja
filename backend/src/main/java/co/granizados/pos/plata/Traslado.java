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

/** Plata que cambia de lugar (ej. de la caja a la casa). No es ingreso ni gasto: el total no cambia. */
@Entity
@Table(name = "traslado")
public class Traslado {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String clientUid;

    private long monto;

    @Enumerated(EnumType.STRING)
    private LugarPlata desde;

    @Enumerated(EnumType.STRING)
    private LugarPlata hacia;

    private Instant creadoEn;

    /** El negocio dueño de esta fila. Hibernate lo llena y lo filtra solo (ver TenantResolver). */
    @TenantId
    @Column(name = "negocio_id", updatable = false)
    private Long negocioId;

    protected Traslado() {
    }

    public Traslado(String clientUid, long monto, LugarPlata desde, LugarPlata hacia, Instant creadoEn) {
        this.clientUid = clientUid;
        this.monto = monto;
        this.desde = desde;
        this.hacia = hacia;
        this.creadoEn = creadoEn;
    }

    public String getClientUid() { return clientUid; }
    public long getMonto() { return monto; }
    public LugarPlata getDesde() { return desde; }
    public LugarPlata getHacia() { return hacia; }
    public Instant getCreadoEn() { return creadoEn; }
}
