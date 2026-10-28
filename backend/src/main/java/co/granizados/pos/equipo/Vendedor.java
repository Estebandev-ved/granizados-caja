package co.granizados.pos.equipo;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import org.hibernate.annotations.TenantId;

/** Un trabajador que vende con su propio PIN. Nunca se borra: sus ventas siguen contando, solo se desactiva. */
@Entity
@Table(name = "vendedor")
public class Vendedor {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String nombre;

    private String pinHash;

    /** Porcentaje de lo vendido que le toca (0 = sin comisión). */
    private int comisionPct;

    private boolean activo = true;

    private Instant creadoEn;

    /** El negocio dueño de esta fila. Hibernate lo llena y lo filtra solo (ver TenantResolver). */
    @TenantId
    @Column(name = "negocio_id", updatable = false)
    private Long negocioId;

    protected Vendedor() {
    }

    public Vendedor(String nombre, String pinHash, int comisionPct, Instant creadoEn) {
        this.nombre = nombre;
        this.pinHash = pinHash;
        this.comisionPct = comisionPct;
        this.creadoEn = creadoEn;
    }

    public void cambiar(String nombre, String pinHash, Integer comisionPct, Boolean activo) {
        if (nombre != null && !nombre.isBlank()) this.nombre = nombre.trim();
        if (pinHash != null) this.pinHash = pinHash;
        if (comisionPct != null) this.comisionPct = comisionPct;
        if (activo != null) this.activo = activo;
    }

    public Long getId() { return id; }
    public String getNombre() { return nombre; }
    public String getPinHash() { return pinHash; }
    public int getComisionPct() { return comisionPct; }
    public boolean isActivo() { return activo; }
}
