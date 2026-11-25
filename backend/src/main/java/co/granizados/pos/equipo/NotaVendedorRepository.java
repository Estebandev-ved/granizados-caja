package co.granizados.pos.equipo;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NotaVendedorRepository extends JpaRepository<NotaVendedor, Long> {

    /** Las más nuevas primero (se muestran las últimas 30). */
    List<NotaVendedor> findTop30ByVendedorIdOrderByCreadaEnDescIdDesc(Long vendedorId);

    Optional<NotaVendedor> findByIdAndVendedorId(Long id, Long vendedorId);
}
