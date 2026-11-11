package co.granizados.pos.equipo;

import java.time.Instant;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PrestamoVendedorRepository extends JpaRepository<PrestamoVendedor, Long> {

    /** Los que todavía no se le han descontado. */
    List<PrestamoVendedor> findByVendedorIdAndPagoIdIsNullOrderByCreadoEnAscIdAsc(Long vendedorId);

    List<PrestamoVendedor> findByPagoId(Long pagoId);

    List<PrestamoVendedor> findByCreadoEnGreaterThanEqualOrderByCreadoEnDescIdDesc(Instant desde);

    List<PrestamoVendedor> findByCreadoEnGreaterThanEqualAndCreadoEnLessThanOrderByCreadoEnDescIdDesc(Instant desde, Instant hasta);
}
