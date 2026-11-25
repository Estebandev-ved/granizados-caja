package co.granizados.pos.equipo;

import co.granizados.pos.comun.NoEncontradoException;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Notas del dueño a sus trabajadores: avisos cortos que el trabajador ve en Mi día y marca como leídas. No interrumpen
 * la venta (no hay ventana que salte): solo un punto en la pestaña mientras haya alguna sin leer.
 */
@Service
public class NotaService {

    public record NuevaNota(@NotBlank @Size(max = 300) String texto) {
    }

    public record NotaDto(Long id, String texto, Instant creadaEn, Instant leidaEn) {
    }

    private final NotaVendedorRepository notas;
    private final VendedorRepository vendedores;
    private final Clock clock;

    public NotaService(NotaVendedorRepository notas, VendedorRepository vendedores, Clock clock) {
        this.notas = notas;
        this.vendedores = vendedores;
        this.clock = clock;
    }

    /** El dueño le escribe a un trabajador. */
    @Transactional
    public NotaDto escribir(Long vendedorId, NuevaNota n) {
        if (!vendedores.existsById(vendedorId)) throw new NoEncontradoException("Trabajador no encontrado: " + vendedorId);
        return dto(notas.save(new NotaVendedor(vendedorId, limpiar(n.texto()), clock.instant())));
    }

    /** La misma nota a todos los trabajadores activos (una por cada uno, así cada quien la marca leída). */
    @Transactional
    public int escribirATodos(NuevaNota n) {
        String texto = limpiar(n.texto());
        Instant ahora = clock.instant();
        List<Vendedor> activos = vendedores.findAllByOrderByNombreAscIdAsc().stream().filter(Vendedor::isActivo).toList();
        activos.forEach(v -> notas.save(new NotaVendedor(v.getId(), texto, ahora)));
        return activos.size();
    }

    /** Las de un trabajador, las más nuevas primero. La ven el dueño (con si ya la leyó) y el trabajador. */
    @Transactional(readOnly = true)
    public List<NotaDto> de(Long vendedorId) {
        return notas.findTop30ByVendedorIdOrderByCreadaEnDescIdDesc(vendedorId).stream().map(NotaService::dto).toList();
    }

    /** El trabajador la marca como leída. Solo las suyas. */
    @Transactional
    public NotaDto leer(Long vendedorId, Long notaId) {
        NotaVendedor nota = notas.findByIdAndVendedorId(notaId, vendedorId)
                .orElseThrow(() -> new NoEncontradoException("Nota no encontrada: " + notaId));
        nota.leer(clock.instant());
        return dto(nota);
    }

    /** El dueño la borra (la escribió mal o ya no aplica). */
    @Transactional
    public void borrar(Long notaId) {
        NotaVendedor nota = notas.findById(notaId).orElseThrow(() -> new NoEncontradoException("Nota no encontrada: " + notaId));
        notas.delete(nota);
    }

    private static String limpiar(String texto) {
        String t = texto.trim();
        if (t.isEmpty()) throw new IllegalArgumentException("Escribe la nota");
        return t;
    }

    private static NotaDto dto(NotaVendedor n) {
        return new NotaDto(n.getId(), n.getTexto(), n.getCreadaEn(), n.getLeidaEn());
    }
}
