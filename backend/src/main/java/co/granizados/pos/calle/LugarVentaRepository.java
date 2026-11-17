package co.granizados.pos.calle;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface LugarVentaRepository extends JpaRepository<LugarVenta, Long> {

    Optional<LugarVenta> findByNombreIgnoreCase(String nombre);

    List<LugarVenta> findAllByOrderByNombreAscIdAsc();
}
