package co.granizados.pos.plata;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import org.hibernate.annotations.TenantId;

/** Una meta o "sobre": plata apartada para algo. `objetivo` 0 = sin tope. */
@Entity
@Table(name = "meta_plata")
public class MetaPlata {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String clientUid;
    private String nombre;
    private long objetivo;
    private Instant creadoEn;

    /** El negocio dueño de esta fila. Hibernate lo llena y lo filtra solo (ver TenantResolver). */
    @TenantId
    @Column(name = "negocio_id", updatable = false)
    private Long negocioId;

    protected MetaPlata() {
    }

    public MetaPlata(String clientUid, String nombre, long objetivo, Instant creadoEn) {
        this.clientUid = clientUid;
        this.nombre = nombre;
        this.objetivo = objetivo;
        this.creadoEn = creadoEn;
    }

    public Long getId() { return id; }
    public String getClientUid() { return clientUid; }
    public String getNombre() { return nombre; }
    public long getObjetivo() { return objetivo; }
}
