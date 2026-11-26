package co.granizados.pos.equipo;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import org.hibernate.annotations.TenantId;

/**
 * El dueño contó lo que le devolvió un trabajador de su carga de un día. `esperaba` es lo que la app decía que le
 * quedaba; lo que faltó se le descontó como faltante (`cobrado`). Queda como constancia por si hay reclamo.
 */
@Entity
@Table(name = "conteo_carga")
public class ConteoCarga {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long vendedorId;

    private LocalDate dia;

    private Instant contadoEn;

    private int esperaba;

    private int devolvio;

    private int faltaron;

    private int sobraron;

    private long cobrado;

    @Column(length = 1000)
    private String detalle;

    @TenantId
    @Column(name = "negocio_id", updatable = false)
    private Long negocioId;

    protected ConteoCarga() {
    }

    public ConteoCarga(Long vendedorId, LocalDate dia, Instant contadoEn, int esperaba, int devolvio, int faltaron,
                       int sobraron, long cobrado, String detalle) {
        this.vendedorId = vendedorId;
        this.dia = dia;
        this.contadoEn = contadoEn;
        this.esperaba = esperaba;
        this.devolvio = devolvio;
        this.faltaron = faltaron;
        this.sobraron = sobraron;
        this.cobrado = cobrado;
        this.detalle = detalle;
    }

    public Long getId() { return id; }
    public Long getVendedorId() { return vendedorId; }
    public LocalDate getDia() { return dia; }
    public Instant getContadoEn() { return contadoEn; }
    public int getEsperaba() { return esperaba; }
    public int getDevolvio() { return devolvio; }
    public int getFaltaron() { return faltaron; }
    public int getSobraron() { return sobraron; }
    public long getCobrado() { return cobrado; }
    public String getDetalle() { return detalle; }
}
