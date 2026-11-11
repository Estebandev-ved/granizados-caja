package co.granizados.pos.gasto;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface GastoRepository extends JpaRepository<Gasto, Long> {

    boolean existsByClientUid(String clientUid);

    Optional<Gasto> findByClientUid(String clientUid);

    /** Suma de los gastos en [desde, hasta). Nulo si no hubo ninguno. */
    @Query("select sum(g.monto) from Gasto g where g.creadoEn >= :desde and g.creadoEn < :hasta")
    Long montoEntre(Instant desde, Instant hasta);

    /** Las categorías que el negocio ha usado desde esa fecha (para ofrecerle las suyas al anotar un gasto). */
    @Query("select distinct g.categoria from Gasto g where g.creadoEn >= :desde")
    List<String> categoriasDesde(Instant desde);

    List<Gasto> findByCreadoEnGreaterThanEqualAndCreadoEnLessThanOrderByCreadoEnDescIdDesc(Instant desde, Instant hasta);

    /** Lo gastado en [desde, hasta) por categoría: filas {categoría, suma}. */
    @Query("select g.categoria, sum(g.monto) from Gasto g where g.creadoEn >= :desde and g.creadoEn < :hasta group by g.categoria")
    List<Object[]> porCategoriaEntre(Instant desde, Instant hasta);
}
