package co.granizados.pos.caja;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.time.LocalDate;
import org.hibernate.annotations.TenantId;

/** El cierre de caja de un día: cuánto decía la app y cuánto había en el cajón. */
@Entity
@Table(name = "arqueo")
public class Arqueo {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String clientUid;

    private LocalDate dia;

    private long esperado;

    private long contado;

    private long diferencia;

    private String nota;

    private Instant creadoEn;

    /** El negocio dueño de esta fila. Hibernate lo llena y lo filtra solo (ver TenantResolver). */
    @TenantId
    @Column(name = "negocio_id", updatable = false)
    private Long negocioId;

    protected Arqueo() {
    }

    public Arqueo(String clientUid, LocalDate dia, long esperado, long contado, String nota, Instant creadoEn) {
        this.clientUid = clientUid;
        this.dia = dia;
        this.esperado = esperado;
        this.contado = contado;
        this.diferencia = contado - esperado;
        this.nota = nota;
        this.creadoEn = creadoEn;
    }

    /** Para actualizar el cierre de un mismo día sin crear otro registro. */
    public void actualizar(String clientUid, long esperado, long contado, String nota, Instant creadoEn) {
        this.clientUid = clientUid;
        this.esperado = esperado;
        this.contado = contado;
        this.diferencia = contado - esperado;
        this.nota = nota;
        this.creadoEn = creadoEn;
    }

    public Long getId() { return id; }
    public String getClientUid() { return clientUid; }
    public LocalDate getDia() { return dia; }
    public long getEsperado() { return esperado; }
    public long getContado() { return contado; }
    public long getDiferencia() { return diferencia; }
    public String getNota() { return nota; }
    public Instant getCreadoEn() { return creadoEn; }
}
