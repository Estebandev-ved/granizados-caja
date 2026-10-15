package co.granizados.pos.fiado;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DeudaRepository extends JpaRepository<Deuda, Long> {

    List<Deuda> findByPagadaEnIsNullOrderByCreadaEnAscIdAsc();

    Optional<Deuda> findByVentaUid(String ventaUid);

    /** El último celular que se guardó para ese nombre (sin importar mayúsculas), esté o no pagada la deuda. */
    Optional<Deuda> findFirstByClienteIgnoreCaseAndTelefonoIsNotNullOrderByIdDesc(String cliente);
}
