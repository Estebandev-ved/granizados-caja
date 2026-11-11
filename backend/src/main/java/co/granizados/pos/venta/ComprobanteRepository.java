package co.granizados.pos.venta;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ComprobanteRepository extends JpaRepository<Comprobante, Long> {

    Optional<Comprobante> findByVentaUid(String ventaUid);

    /** Cuáles de esas ventas tienen foto (sin traer las imágenes). */
    @Query("select c.ventaUid from Comprobante c where c.ventaUid in :uids")
    List<String> conFoto(@Param("uids") Collection<String> uids);

    List<Comprobante> findByCreadoEnBefore(Instant antes);
}
