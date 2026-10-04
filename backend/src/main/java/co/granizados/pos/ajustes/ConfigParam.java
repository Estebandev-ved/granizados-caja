package co.granizados.pos.ajustes;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import org.hibernate.annotations.TenantId;

/** Parámetro editable desde la app (tabla config: clave/valor), propio de cada negocio. */
@Entity
@Table(name = "config")
public class ConfigParam {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** El negocio dueño de este ajuste. Hibernate lo llena y lo filtra solo (ver TenantResolver). */
    @TenantId
    @Column(name = "negocio_id", updatable = false)
    private Long negocioId;

    private String clave;
    private String valor;
    private String nota;

    protected ConfigParam() {
    }

    public ConfigParam(String clave, String valor, String nota) {
        this.clave = clave;
        this.valor = valor;
        this.nota = nota;
    }

    public String getClave() { return clave; }
    public String getValor() { return valor; }
    public String getNota() { return nota; }
    public void setValor(String valor) { this.valor = valor; }
}
