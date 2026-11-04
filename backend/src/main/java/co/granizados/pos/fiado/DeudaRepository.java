package co.granizados.pos.fiado;

import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface DeudaRepository extends JpaRepository<Deuda, Long> {

    List<Deuda> findByPagadaEnIsNullOrderByCreadaEnAscIdAsc();

    Optional<Deuda> findByVentaUid(String ventaUid);

    /** Las deudas de esas ventas fiadas (para saber cuáles ya se cobraron). */
    List<Deuda> findByVentaUidIn(Collection<String> ventaUids);

    /** El último celular que se guardó para ese nombre (sin importar mayúsculas), esté o no pagada la deuda. */
    Optional<Deuda> findFirstByClienteIgnoreCaseAndTelefonoIsNotNullOrderByIdDesc(String cliente);
}
