package co.granizados.pos.equipo;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface VendedorRepository extends JpaRepository<Vendedor, Long> {

    List<Vendedor> findAllByOrderByNombreAscIdAsc();

    List<Vendedor> findByActivoTrue();
}
