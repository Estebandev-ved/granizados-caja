package co.granizados.pos.plata;

import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PagoProveedorRepository extends JpaRepository<PagoProveedor, Long> {

    boolean existsByPedidoId(Long pedidoId);

    List<PagoProveedor> findByCreadoEnGreaterThanEqual(Instant desde);
}
