package co.granizados.pos.equipo;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EntregaVendedorRepository extends JpaRepository<EntregaVendedor, Long> {

    List<EntregaVendedor> findTop10ByVendedorIdOrderByCreadaEnDescIdDesc(Long vendedorId);

    List<EntregaVendedor> findByVendedorIdAndEstado(Long vendedorId, EntregaVendedor.Estado estado);
}
