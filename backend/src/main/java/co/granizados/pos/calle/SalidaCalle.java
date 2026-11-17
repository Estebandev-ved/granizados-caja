package co.granizados.pos.calle;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import org.hibernate.annotations.TenantId;

/**
 * Una salida a vender a un lugar. Las unidades y la plata no se guardan acá: salen de las ventas que llevan el
 * `clientUid` de la salida, así nunca se desajustan.
 */
@Entity
@Table(name = "salida_calle")
public class SalidaCalle {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String clientUid;

    private Long lugarId;

    /** Quién salió: el id del trabajador, o null si fue el dueño. */
    private Long vendedorId;

    private Instant inicio;

    private Instant fin;

    private Double latIni;

    private Double lngIni;

    /** Lo que gastó en pasajes, en pesos. */
    private long pasaje;

    /** El dueño la mandó a probar el lugar: el pasaje se le devuelve completo. */
    private boolean prueba;

    private String incidentes;

    private String nota;

    @TenantId
    @Column(name = "negocio_id", updatable = false)
    private Long negocioId;

    protected SalidaCalle() {
    }

    public SalidaCalle(String clientUid, Long lugarId, Long vendedorId, Instant inicio, Double latIni, Double lngIni,
                       boolean prueba) {
        this.clientUid = clientUid;
        this.lugarId = lugarId;
        this.vendedorId = vendedorId;
        this.inicio = inicio;
        this.latIni = latIni;
        this.lngIni = lngIni;
        this.prueba = prueba;
    }

    public void terminar(Instant fin, long pasaje, String incidentes, String nota) {
        this.fin = fin;
        this.pasaje = pasaje;
        this.incidentes = incidentes;
        this.nota = nota;
    }

    public boolean estaAbierta() {
        return fin == null;
    }

    public Long getId() { return id; }
    public String getClientUid() { return clientUid; }
    public Long getLugarId() { return lugarId; }
    public Long getVendedorId() { return vendedorId; }
    public Instant getInicio() { return inicio; }
    public Instant getFin() { return fin; }
    public Double getLatIni() { return latIni; }
    public Double getLngIni() { return lngIni; }
    public long getPasaje() { return pasaje; }
    public boolean isPrueba() { return prueba; }
    public String getIncidentes() { return incidentes; }
    public String getNota() { return nota; }
}
