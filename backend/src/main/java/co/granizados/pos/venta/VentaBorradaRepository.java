package co.granizados.pos.venta;

import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface VentaBorradaRepository extends JpaRepository<VentaBorrada, Long> {

    List<VentaBorrada> findByBorradaEnGreaterThanEqualAndBorradaEnLessThanOrderByBorradaEnDescIdDesc(Instant desde, Instant hasta);

    long countByBorroVendedorIdAndBorradaEnGreaterThanEqual(Long borroVendedorId, Instant desde);
}
