package co.granizados.pos.pedido;

import jakarta.persistence.LockModeType;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;

public interface PedidoProveedorRepository extends JpaRepository<PedidoProveedor, Long> {

    /** El pedido que está en camino, si hay uno. */
    Optional<PedidoProveedor> findFirstByEstadoOrderByCreadoEnDescIdDesc(EstadoPedido estado);

    @Query("select p from PedidoProveedor p left join fetch p.items i left join fetch i.producto order by p.creadoEn desc, p.id desc")
    List<PedidoProveedor> historial();

    @Query("""
            select p from PedidoProveedor p left join fetch p.items i left join fetch i.producto
            where p.estado = :estado order by p.creadoEn desc, p.id desc""")
    List<PedidoProveedor> porEstado(EstadoPedido estado);

    /** Bloquea el pedido: nadie puede recibirlo dos veces al mismo tiempo. Los items se cargan aparte (lazy). */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select p from PedidoProveedor p where p.id = :id")
    Optional<PedidoProveedor> findParaActualizar(Long id);

    /** Pedidos hechos en [desde, hasta), con sus items, para los reportes. */
    @Query("""
            select p from PedidoProveedor p left join fetch p.items i left join fetch i.producto
            where p.creadoEn >= :desde and p.creadoEn < :hasta order by p.creadoEn desc, p.id desc""")
    List<PedidoProveedor> entre(Instant desde, Instant hasta);
}
