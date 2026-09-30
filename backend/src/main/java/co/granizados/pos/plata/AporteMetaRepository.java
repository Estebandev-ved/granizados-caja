package co.granizados.pos.plata;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface AporteMetaRepository extends JpaRepository<AporteMeta, Long> {

    boolean existsByClientUid(String clientUid);

    List<AporteMeta> findByMetaId(Long metaId);

    @Query("select coalesce(sum(a.monto), 0) from AporteMeta a where a.metaId = :metaId")
    long totalDe(Long metaId);

    @Modifying
    @Query("delete from AporteMeta a where a.metaId = :metaId")
    void borrarDe(Long metaId);
}
