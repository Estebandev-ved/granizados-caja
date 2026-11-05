package co.granizados.pos.equipo;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PagoVendedorRepository extends JpaRepository<PagoVendedor, Long> {

    /** El último pago que sigue en pie (no anulado): marca desde dónde cuentan las cuentas del trabajador. */
    Optional<PagoVendedor> findFirstByVendedorIdAndEstadoNotOrderByHastaDesc(Long vendedorId, PagoVendedor.Estado estado);

    List<PagoVendedor> findTop10ByVendedorIdOrderByCreadoEnDescIdDesc(Long vendedorId);
}
