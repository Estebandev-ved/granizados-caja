package co.granizados.pos.equipo;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import org.hibernate.annotations.TenantId;

/** Constancia de que un trabajador leyó y aceptó los términos: guarda el texto exacto, la huella y cuándo. */
@Entity
@Table(name = "aceptacion_terminos")
public class AceptacionTerminos {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long vendedorId;

    private String version;

    @Column(length = 8000)
    private String texto;

    private Instant aceptadaEn;

    @TenantId
    @Column(name = "negocio_id", updatable = false)
    private Long negocioId;

    protected AceptacionTerminos() {
    }

    public AceptacionTerminos(Long vendedorId, String version, String texto, Instant aceptadaEn) {
        this.vendedorId = vendedorId;
        this.version = version;
        this.texto = texto;
        this.aceptadaEn = aceptadaEn;
    }

    public Long getVendedorId() { return vendedorId; }
    public String getVersion() { return version; }
    public String getTexto() { return texto; }
    public Instant getAceptadaEn() { return aceptadaEn; }
}
