package co.granizados.pos.equipo;

import java.time.LocalDate;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MetaVendedorRepository extends JpaRepository<MetaVendedor, Long> {

    Optional<MetaVendedor> findByVendedorIdAndDia(Long vendedorId, LocalDate dia);
}
