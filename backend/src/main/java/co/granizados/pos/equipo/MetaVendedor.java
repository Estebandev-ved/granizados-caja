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

    /** Lo que paga llegar a esa meta (congelado al escogerla). */
    private long premio;

    /** Lo que ya se ganó con la meta anterior, si la subió después de cumplirla. */
    private long premioPrevio;

    /** Desde cuántos granizados empieza a pagar el premio por pasos (0 = todo o nada, como las metas de antes). */
    private int desde;

    private Instant creadaEn;

    @TenantId
    @Column(name = "negocio_id", updatable = false)
    private Long negocioId;

    protected MetaVendedor() {
    }

    public MetaVendedor(Long vendedorId, LocalDate dia, int meta, long premio, int desde, Instant creadaEn) {
        this.vendedorId = vendedorId;
        this.dia = dia;
        this.meta = meta;
        this.premio = premio;
        this.desde = desde;
        this.creadaEn = creadaEn;
    }

    public void cambiar(int meta, long premio, int desde, long premioPrevio, Instant cuando) {
        this.meta = meta;
        this.premio = premio;
        this.desde = desde;
        this.premioPrevio = premioPrevio;
        this.creadaEn = cuando;
    }

    public Long getVendedorId() { return vendedorId; }
    public LocalDate getDia() { return dia; }
    public int getMeta() { return meta; }
    public long getPremio() { return premio; }
    public long getPremioPrevio() { return premioPrevio; }

    public int getDesde() { return desde; }

    /**
     * Lo que ganó este día con su reto. El premio se reparte en pasos iguales, uno por granizado, desde `desde` hasta la
     * meta: con cada uno que vende va sumando (redondeado a $500) y al cumplir la meta lo tiene completo. Nunca baja de
     * lo que ya había ganado con una meta anterior.
     */
    public long ganado(int unidades) {
        long actual = 0;
        if (unidades >= meta) actual = premio;
        else if (desde > 0 && desde <= meta && unidades >= desde) {
            long pasos = meta - desde + 1L;
            actual = premio * (unidades - desde + 1L) / pasos / 500 * 500;
        }
        return Math.max(premioPrevio, actual);
    }
}
