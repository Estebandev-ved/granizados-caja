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
 * Plata que entra y no es una venta del sistema (ej. te pagaron una deuda). El clientUid es único.
 * `cuentaGanancia`: true si es ganancia del negocio (cobro de una venta vieja); false si solo es plata tuya (un aporte).
 */
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

    private boolean cuentaGanancia = true;

    /** El negocio dueño de esta fila. Hibernate lo llena y lo filtra solo (ver TenantResolver). */
    @TenantId
    @Column(name = "negocio_id", updatable = false)
    private Long negocioId;

    protected Ingreso() {
    }

    public Ingreso(String clientUid, String concepto, long monto, LugarPlata lugar, Instant creadoEn,
                   boolean cuentaGanancia) {
        this.clientUid = clientUid;
        this.concepto = concepto;
        this.monto = monto;
        this.lugar = lugar;
        this.creadoEn = creadoEn;
        this.cuentaGanancia = cuentaGanancia;
    }

    public Long getId() { return id; }
    public String getClientUid() { return clientUid; }
    public String getConcepto() { return concepto; }
    public long getMonto() { return monto; }
    public LugarPlata getLugar() { return lugar; }
    public Instant getCreadoEn() { return creadoEn; }
    public boolean isCuentaGanancia() { return cuentaGanancia; }
}
