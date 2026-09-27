package co.granizados.pos.producto;

import jakarta.persistence.LockModeType;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface ProductoRepository extends JpaRepository<Producto, Long> {

    List<Producto> findByActivoTrueOrderByOrdenAscIdAsc();

    List<Producto> findAllByOrderByOrdenAscIdAsc();

    /** Cambia el stock en la base sin leer y escribir por separado, así dos ventas a la vez no se pisan. */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("update Producto p set p.stock = p.stock + :delta where p.id = :id")
    int sumarStock(Long id, int delta);

    /**
     * Lee el stock con la fila bloqueada: nadie más puede moverlo mientras se calcula el delta de un conteo.
     * Se desbloquea al terminar la transacción.
     */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from Producto p where p.id = :id")
    Optional<Producto> findParaActualizar(Long id);

    @Query("select p.stock from Producto p where p.id = :id")
    Optional<Integer> stockActual(Long id);

    @Query("select coalesce(max(p.orden), 0) from Producto p")
    int maxOrden();
}
