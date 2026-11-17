package co.granizados.pos.calle;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import org.hibernate.annotations.TenantId;

/** Un lugar donde se vende o se quiere probar (La Kurva, Parque del Periodista…), con su punto en el mapa. */
@Entity
@Table(name = "lugar_venta")
public class LugarVenta {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String nombre;

    private Double lat;

    private Double lng;

    private Instant creadoEn;

    @TenantId
    @Column(name = "negocio_id", updatable = false)
    private Long negocioId;

    protected LugarVenta() {
    }

    public LugarVenta(String nombre, Double lat, Double lng, Instant creadoEn) {
        this.nombre = nombre;
        this.lat = lat;
        this.lng = lng;
        this.creadoEn = creadoEn;
    }

    /** Si el lugar todavía no tenía punto en el mapa, se queda con el de quien llegó primero. */
    public void ubicarSiFalta(Double lat, Double lng) {
        if (this.lat == null && lat != null && lng != null) {
            this.lat = lat;
            this.lng = lng;
        }
    }

    public Long getId() { return id; }
    public String getNombre() { return nombre; }
    public Double getLat() { return lat; }
    public Double getLng() { return lng; }
}
