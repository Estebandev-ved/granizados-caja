package co.granizados.pos.equipo;

import java.time.LocalDate;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ConteoCargaRepository extends JpaRepository<ConteoCarga, Long> {

    /** El último conteo de ese día (se puede contar otra vez: solo descuenta lo que falte de más). */
    Optional<ConteoCarga> findFirstByVendedorIdAndDiaOrderByContadoEnDescIdDesc(Long vendedorId, LocalDate dia);
}
