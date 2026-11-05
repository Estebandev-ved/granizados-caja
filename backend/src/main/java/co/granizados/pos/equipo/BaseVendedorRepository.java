package co.granizados.pos.equipo;

import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BaseVendedorRepository extends JpaRepository<BaseVendedor, Long> {

    List<BaseVendedor> findByVendedorIdAndDiaOrderByCreadaEnAscIdAsc(Long vendedorId, LocalDate dia);
}
