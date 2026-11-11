package co.granizados.pos.venta;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import org.hibernate.annotations.TenantId;

/**
 * La foto del comprobante de una venta (el pantallazo de Nequi o de la transferencia), ya comprimida en el celular.
 * Va ligada a la venta por su `clientUid` y puede llegar antes que la venta (sin señal, la venta sigue en la cola).
 * Trae datos del cliente (su nombre en Nequi), así que se borra sola a los 30 días.
 */
@Entity
@Table(name = "comprobante")
public class Comprobante {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String ventaUid;

    /** Quién la subió: el trabajador, o null si fue el dueño. */
    private Long vendedorId;

    /** image/jpeg, image/png o image/webp. */
    private String tipo;

    private byte[] imagen;

    private Instant creadoEn;

    @TenantId
    @Column(name = "negocio_id", updatable = false)
    private Long negocioId;

    protected Comprobante() {
    }

    public Comprobante(String ventaUid, Long vendedorId, String tipo, byte[] imagen, Instant creadoEn) {
        this.ventaUid = ventaUid;
        this.vendedorId = vendedorId;
        this.tipo = tipo;
        this.imagen = imagen;
        this.creadoEn = creadoEn;
    }

    /** Se tomó otra foto para la misma venta: queda la nueva. */
    public void reemplazar(String tipo, byte[] imagen, Instant cuando) {
        this.tipo = tipo;
        this.imagen = imagen;
        this.creadoEn = cuando;
    }

    public Long getId() { return id; }
    public String getVentaUid() { return ventaUid; }
    public Long getVendedorId() { return vendedorId; }
    public String getTipo() { return tipo; }
    public byte[] getImagen() { return imagen; }
    public Instant getCreadoEn() { return creadoEn; }
}
