package co.granizados.pos.plata;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PagoProveedorRepository extends JpaRepository<PagoProveedor, Long> {

    boolean existsByPedidoId(Long pedidoId);

    Optional<PagoProveedor> findByPedidoId(Long pedidoId);

    List<PagoProveedor> findByCreadoEnGreaterThanEqual(Instant desde);
}
