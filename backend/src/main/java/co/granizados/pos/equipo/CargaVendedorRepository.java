package co.granizados.pos.equipo;

import java.time.LocalDate;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CargaVendedorRepository extends JpaRepository<CargaVendedor, Long> {

    List<CargaVendedor> findByDia(LocalDate dia);

    List<CargaVendedor> findByVendedorIdAndDia(Long vendedorId, LocalDate dia);
}
