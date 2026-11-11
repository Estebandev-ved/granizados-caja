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

/** Cuántos granizados se propuso vender el trabajador ese día. Una por día; la puede subir. */
@Entity
@Table(name = "meta_vendedor")
public class MetaVendedor {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long vendedorId;

    private LocalDate dia;

    private int meta;

    private Instant creadaEn;

    @TenantId
    @Column(name = "negocio_id", updatable = false)
    private Long negocioId;

    protected MetaVendedor() {
    }

    public MetaVendedor(Long vendedorId, LocalDate dia, int meta, Instant creadaEn) {
        this.vendedorId = vendedorId;
        this.dia = dia;
        this.meta = meta;
        this.creadaEn = creadaEn;
    }

    public void cambiar(int meta, Instant cuando) {
        this.meta = meta;
        this.creadaEn = cuando;
    }

    public Long getVendedorId() { return vendedorId; }
    public LocalDate getDia() { return dia; }
    public int getMeta() { return meta; }
}
