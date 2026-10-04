package co.granizados.pos.ajustes;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ConfigParamRepository extends JpaRepository<ConfigParam, Long> {

    Optional<ConfigParam> findByClave(String clave);
}
