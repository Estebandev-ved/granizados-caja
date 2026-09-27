package co.granizados.pos.venta;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface VentaRepository extends JpaRepository<Venta, Long> {

    boolean existsByClientUid(String clientUid);

    Optional<Venta> findByClientUid(String clientUid);

    /** Ventas en [desde, hasta), más recientes primero, con el producto ya cargado. */
    @Query("""
            select v from Venta v join fetch v.producto
            where v.creadaEn >= :desde and v.creadaEn < :hasta
            order by v.creadaEn desc, v.id desc""")
    List<Venta> entre(Instant desde, Instant hasta);

    interface UnidadesPorProducto {
        Long getProductoId();

        Long getUnidades();
    }

    @Query("""
            select v.producto.id as productoId, sum(v.cantidad) as unidades
            from Venta v where v.creadaEn >= :desde group by v.producto.id""")
    List<UnidadesPorProducto> unidadesPorProductoDesde(Instant desde);

    @Query("select min(v.creadaEn) from Venta v where v.creadaEn >= :desde")
    Optional<Instant> primeraDesde(Instant desde);
}
