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

/** Cuántos granizados de un sabor sacó un trabajador a vender ese día. */
@Entity
@Table(name = "carga_vendedor")
public class CargaVendedor {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long vendedorId;

    private Long productoId;

    private LocalDate dia;

    private int llevo;

    /** Las ventas del trabajador cuentan contra esta carga desde este momento. */
    private Instant desde;

    @TenantId
    @Column(name = "negocio_id", updatable = false)
    private Long negocioId;

    protected CargaVendedor() {
    }

    public CargaVendedor(Long vendedorId, Long productoId, LocalDate dia, int llevo, Instant desde) {
        this.vendedorId = vendedorId;
        this.productoId = productoId;
        this.dia = dia;
        this.llevo = llevo;
        this.desde = desde;
    }

    public void llevo(int llevo) {
        this.llevo = llevo;
    }

    public Long getId() { return id; }
    public Long getVendedorId() { return vendedorId; }
    public Long getProductoId() { return productoId; }
    public LocalDate getDia() { return dia; }
    public int getLlevo() { return llevo; }
    public Instant getDesde() { return desde; }
}
