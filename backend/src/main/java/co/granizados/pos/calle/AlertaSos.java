package co.granizados.pos.calle;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import org.hibernate.annotations.TenantId;

/** Lo que pasó cuando alguien tocó el botón de alerta: de qué tipo, dónde y cuándo. */
@Entity
@Table(name = "alerta_sos")
public class AlertaSos {

    public enum Tipo { HURTO, POLICIA, AYUDA }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String clientUid;

    /** Quién la mandó (null = el dueño). */
    private Long vendedorId;

    private String tipo;

    /** El lugar de su salida abierta, si tenía una. */
    private String lugar;

    private Double lat;

    private Double lng;

    private Instant creadaEn;

    @TenantId
    @Column(name = "negocio_id", updatable = false)
    private Long negocioId;

    protected AlertaSos() {
    }

    public AlertaSos(String clientUid, Long vendedorId, Tipo tipo, String lugar, Double lat, Double lng, Instant creadaEn) {
        this.clientUid = clientUid;
        this.vendedorId = vendedorId;
        this.tipo = tipo.name();
        this.lugar = lugar;
        this.lat = lat;
        this.lng = lng;
        this.creadaEn = creadaEn;
    }

    public Long getId() { return id; }
    public String getClientUid() { return clientUid; }
    public Long getVendedorId() { return vendedorId; }
    public Tipo getTipo() { return Tipo.valueOf(tipo); }
    public String getLugar() { return lugar; }
    public Double getLat() { return lat; }
    public Double getLng() { return lng; }
    public Instant getCreadaEn() { return creadaEn; }
}
