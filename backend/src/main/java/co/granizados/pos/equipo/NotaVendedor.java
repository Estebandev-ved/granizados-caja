package co.granizados.pos.equipo;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import org.hibernate.annotations.TenantId;

/** Una nota del dueño a un trabajador. `leidaEn` es null mientras no la marque como leída. */
@Entity
@Table(name = "nota_vendedor")
public class NotaVendedor {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long vendedorId;

    private String texto;

    private Instant creadaEn;

    private Instant leidaEn;

    @TenantId
    @Column(name = "negocio_id", updatable = false)
    private Long negocioId;

    protected NotaVendedor() {
    }

    public NotaVendedor(Long vendedorId, String texto, Instant creadaEn) {
        this.vendedorId = vendedorId;
        this.texto = texto;
        this.creadaEn = creadaEn;
    }

    /** La primera vez que la lee queda la hora; si la toca otra vez no cambia. */
    public void leer(Instant cuando) {
        if (leidaEn == null) leidaEn = cuando;
    }

    public Long getId() { return id; }
    public Long getVendedorId() { return vendedorId; }
    public String getTexto() { return texto; }
    public Instant getCreadaEn() { return creadaEn; }
    public Instant getLeidaEn() { return leidaEn; }
}
