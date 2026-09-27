package co.granizados.pos.gasto;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface GastoRepository extends JpaRepository<Gasto, Long> {

    boolean existsByClientUid(String clientUid);

    Optional<Gasto> findByClientUid(String clientUid);

    /** Suma de los gastos en [desde, hasta). Nulo si no hubo ninguno. */
    @Query("select sum(g.monto) from Gasto g where g.creadoEn >= :desde and g.creadoEn < :hasta")
    Long montoEntre(Instant desde, Instant hasta);

    List<Gasto> findByCreadoEnGreaterThanEqualAndCreadoEnLessThanOrderByCreadoEnDescIdDesc(Instant desde, Instant hasta);
}
