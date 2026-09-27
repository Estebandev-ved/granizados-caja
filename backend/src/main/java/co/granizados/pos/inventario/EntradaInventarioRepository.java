package co.granizados.pos.inventario;

import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface EntradaInventarioRepository extends JpaRepository<EntradaInventario, Long> {

    boolean existsByClientUid(String clientUid);

    /** Movimientos de un tipo en [desde, hasta), con el producto ya cargado (para saber su costo). */
    @Query("""
            select e from EntradaInventario e join fetch e.producto
            where e.tipo = :tipo and e.creadaEn >= :desde and e.creadaEn < :hasta
            order by e.creadaEn""")
    List<EntradaInventario> entre(TipoMovimiento tipo, Instant desde, Instant hasta);
}
