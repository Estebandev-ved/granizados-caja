package co.granizados.pos.venta;

import co.granizados.pos.comun.NoEncontradoException;
import co.granizados.pos.equipo.Sesion;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Fotos de comprobantes de pago. El celular las comprime (unos 100-200 KB) y las manda en base64; si no hay señal
 * esperan en el celular y suben después, aunque la venta todavía no haya llegado.
 * Un trabajador solo sube y ve las de sus ventas; el dueño ve todas.
 */
@Service
public class ComprobanteService {

    /** Una foto ya comprimida no debería pasar de esto. */
    static final int MAX_BYTES = 900_000;

    /** Las fotos traen el nombre del cliente: se borran solas pasado este tiempo. */
    static final Duration SE_GUARDA = Duration.ofDays(30);

    private static final Set<String> TIPOS = Set.of("image/jpeg", "image/png", "image/webp");

    /** `imagen` es un data URL ("data:image/jpeg;base64,...") o base64 pelado (se asume JPEG). */
    public record NuevoComprobante(@NotBlank @Size(max = 64) String ventaUid, @NotBlank @Size(max = 1_300_000) String imagen) {
    }

    public record Foto(String tipo, byte[] bytes) {
    }

    private final ComprobanteRepository comprobantes;
    private final VentaRepository ventas;
    private final Clock clock;

    public ComprobanteService(ComprobanteRepository comprobantes, VentaRepository ventas, Clock clock) {
        this.comprobantes = comprobantes;
        this.ventas = ventas;
        this.clock = clock;
    }

    @Transactional
    public void guardar(NuevoComprobante n) {
        Long vendedor = Sesion.vendedorId();
        ventas.findByClientUid(n.ventaUid()).ifPresent(v -> {
            if (vendedor != null && !vendedor.equals(v.getVendedorId())) {
                throw new NoEncontradoException("Venta no encontrada: " + n.ventaUid());
            }
        });
        String texto = n.imagen().trim();
        String tipo = "image/jpeg";
        if (texto.startsWith("data:")) {
            int coma = texto.indexOf(',');
            if (coma < 0 || !texto.substring(0, coma).endsWith(";base64")) throw new IllegalArgumentException("La foto llegó dañada");
            tipo = texto.substring(5, coma - ";base64".length());
            texto = texto.substring(coma + 1);
        }
        if (!TIPOS.contains(tipo)) throw new IllegalArgumentException("Eso no es una foto");
        byte[] bytes;
        try {
            bytes = Base64.getDecoder().decode(texto);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("La foto llegó dañada");
        }
        if (bytes.length == 0 || bytes.length > MAX_BYTES) throw new IllegalArgumentException("La foto es muy pesada");

        Instant ahora = clock.instant();
        Optional<Comprobante> existente = comprobantes.findByVentaUid(n.ventaUid());
        if (existente.isPresent()) {
            Comprobante c = existente.get();
            if (vendedor != null && !vendedor.equals(c.getVendedorId())) {
                throw new NoEncontradoException("Venta no encontrada: " + n.ventaUid());
            }
            c.reemplazar(tipo, bytes, ahora);
            comprobantes.save(c);
        } else {
            comprobantes.save(new Comprobante(n.ventaUid(), vendedor, tipo, bytes, ahora));
        }
        // Limpieza: las de este negocio que ya pasaron su tiempo
        comprobantes.deleteAll(comprobantes.findByCreadoEnBefore(ahora.minus(SE_GUARDA)));
    }

    @Transactional(readOnly = true)
    public Foto leer(String ventaUid) {
        Comprobante c = comprobantes.findByVentaUid(ventaUid)
                .orElseThrow(() -> new NoEncontradoException("Esa venta no tiene foto"));
        Long vendedor = Sesion.vendedorId();
        if (vendedor != null && !vendedor.equals(c.getVendedorId())) throw new NoEncontradoException("Esa venta no tiene foto");
        return new Foto(c.getTipo(), c.getImagen());
    }

    /** De esas ventas, cuáles tienen foto. */
    @Transactional(readOnly = true)
    public Set<String> conFoto(Collection<String> uids) {
        if (uids.isEmpty()) return Set.of();
        return new HashSet<>(comprobantes.conFoto(List.copyOf(uids)));
    }
}
