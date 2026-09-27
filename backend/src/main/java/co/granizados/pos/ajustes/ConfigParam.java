package co.granizados.pos.ajustes;

import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

/** Parámetro editable desde la app (tabla config: clave/valor). */
@Entity
@Table(name = "config")
public class ConfigParam {

    @Id
    private String clave;

    private String valor;

    private String nota;

    protected ConfigParam() {
    }

    public String getClave() { return clave; }
    public String getValor() { return valor; }
    public String getNota() { return nota; }

    public void setValor(String valor) { this.valor = valor; }
}
