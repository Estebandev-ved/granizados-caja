package co.granizados.pos.caja;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ArqueoRepository extends JpaRepository<Arqueo, Long> {

    Optional<Arqueo> findByClientUid(String clientUid);

    /** Solo puede haber un cierre por día: `dia` tiene índice único. */
    Optional<Arqueo> findByDia(LocalDate dia);

    boolean existsByDia(LocalDate dia);

    List<Arqueo> findByDiaGreaterThanEqualAndDiaLessThanOrderByDiaDesc(LocalDate desde, LocalDate hasta);
}
