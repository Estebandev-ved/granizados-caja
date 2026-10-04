package co.granizados.pos.venta;

import co.granizados.pos.comun.AppProperties;
import co.granizados.pos.comun.NoEncontradoException;
import co.granizados.pos.negocio.TenantContext;
import co.granizados.pos.producto.Producto;
import co.granizados.pos.producto.ProductoRepository;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class VentaService {

    public record NuevaVenta(
            @NotBlank @Size(max = 64) String clientUid,
            @NotNull Long productoId,
            @NotNull MetodoPago metodo,
            @Min(1) @Max(99) int cantidad,
            Instant creadaEn) {

        public NuevaVenta(String clientUid, Long productoId, MetodoPago metodo, int cantidad) {
            this(clientUid, productoId, metodo, cantidad, null);
        }
    }

    /** Cuánto atrás se acepta la hora que manda el celular (ventas que se hicieron sin señal). */
    static final Duration MAX_ATRASO = Duration.ofDays(3);

    public enum Resultado { REGISTRADA, REPETIDA }

    /** Un sabor del CSV que no encaja con ningún producto (fila humana 1-based, con encabezado). */
    public record ErrorImportacion(int fila, String motivo) {
    }

    public record ImportarResultado(int importadas, int repetidas, List<ErrorImportacion> errores) {
    }

    /** Sabores que en el histórico venían con un nombre distinto al del catálogo actual. */
    private static final Map<String, String> ALIAS_SABOR = Map.of("crema de wisky", "crema de whisky");

    private final VentaRepository ventas;
    private final ProductoRepository productos;
    private final ApplicationEventPublisher eventos;
    private final Clock clock;
    private final ZoneId zona;

    public VentaService(VentaRepository ventas, ProductoRepository productos,
                        ApplicationEventPublisher eventos, Clock clock, AppProperties props) {
        this.ventas = ventas;
        this.productos = productos;
        this.eventos = eventos;
        this.clock = clock;
        this.zona = props.zoneId();
    }

    /**
     * Registra la venta y descuenta el stock en la misma transacción.
     * Si el clientUid ya existe no hace nada: el celular puede reintentar sin miedo a duplicar.
     */
    @Transactional
    public Resultado registrar(NuevaVenta v) {
        if (ventas.existsByClientUid(v.clientUid())) return Resultado.REPETIDA;

        Producto p = productos.findById(v.productoId())
                .orElseThrow(() -> new NoEncontradoException("Producto no encontrado: " + v.productoId()));
        String nombre = p.nombre();
        int minimo = p.getStockMinimo();

        ventas.saveAndFlush(new Venta(v.clientUid(), p, v.cantidad(), v.metodo(), cuando(v.creadaEn())));
        productos.sumarStock(p.getId(), -v.cantidad());

        int despues = productos.stockActual(p.getId()).orElseThrow();
        int antes = despues + v.cantidad();
        if (antes > minimo && despues <= minimo) {
            eventos.publishEvent(new StockBajo(TenantContext.actual(), p.getId(), nombre, despues, minimo));
        }
        return Resultado.REGISTRADA;
    }

    /**
     * Hora de la venta: la del celular si es creíble (la venta pudo quedar en cola sin señal),
     * si no la del servidor. Así el cierre del día cuenta cada venta en el día en que se hizo.
     */
    private Instant cuando(Instant delCelular) {
        Instant ahora = clock.instant();
        if (delCelular == null || delCelular.isAfter(ahora.plus(Duration.ofMinutes(5)))
                || delCelular.isBefore(ahora.minus(MAX_ATRASO))) {
            return ahora;
        }
        return delCelular;
    }

    /** Borra una venta puntual y devuelve las unidades al stock. */
    @Transactional
    public void deshacer(String clientUid) {
        Venta v = ventas.findByClientUid(clientUid)
                .orElseThrow(() -> new NoEncontradoException("Venta no encontrada: " + clientUid));
        Long productoId = v.getProducto().getId();
        int cantidad = v.getCantidad();
        ventas.delete(v);
        productos.sumarStock(productoId, cantidad);
    }

    /**
     * Importa ventas históricas de un CSV (fecha;sabor;cantidad;precioUnitario[;metodo], separadas por ';',
     * con encabezado). No toca el stock: son ventas que ya pasaron en el sistema anterior.
     * El costo se congela con el costo actual del producto, porque el histórico no lo traía por venta.
     * Cada fila es idempotente: un mismo CSV se puede volver a subir sin duplicar.
     */
    @Transactional
    public ImportarResultado importarCsv(String csv) {
        Map<String, Producto> porSabor = new HashMap<>();
        for (Producto p : productos.findAll()) porSabor.put(normalizar(p.getSabor()), p);

        String[] lineas = csv.split("\r?\n");
        int importadas = 0, repetidas = 0;
        List<ErrorImportacion> errores = new ArrayList<>();

        for (int i = 1; i < lineas.length; i++) {
            String linea = lineas[i].trim();
            int fila = i + 1;
            if (linea.isEmpty()) continue;

            String[] col = linea.split(";", -1);
            if (col.length < 4) {
                errores.add(new ErrorImportacion(fila, "Faltan columnas: se esperan al menos fecha;sabor;cantidad;precioUnitario"));
                continue;
            }
            try {
                LocalDate fecha = LocalDate.parse(col[0].trim());
                String saborTexto = col[1].trim();
                int cantidad = Integer.parseInt(col[2].trim());
                long precioUnitario = Long.parseLong(col[3].trim());
                MetodoPago metodo = col.length > 4 && !col[4].isBlank()
                        ? MetodoPago.valueOf(col[4].trim().toUpperCase())
                        : MetodoPago.EFECTIVO;

                String clave = normalizar(saborTexto);
                clave = ALIAS_SABOR.getOrDefault(clave, clave);
                Producto p = porSabor.get(clave);
                if (p == null) {
                    errores.add(new ErrorImportacion(fila, "Sabor no encontrado en el catálogo: " + saborTexto));
                    continue;
                }

                String clientUid = "import-" + UUID.nameUUIDFromBytes(linea.getBytes(StandardCharsets.UTF_8));
                if (ventas.existsByClientUid(clientUid)) {
                    repetidas++;
                    continue;
                }

                Instant creadaEn = fecha.atTime(12, 0).atZone(zona).toInstant();
                ventas.save(new Venta(clientUid, p, cantidad, precioUnitario, p.getCosto(), metodo, creadaEn));
                importadas++;
            } catch (Exception e) {
                errores.add(new ErrorImportacion(fila, "Fila inválida: " + e.getMessage()));
            }
        }
        return new ImportarResultado(importadas, repetidas, errores);
    }

    /** Sin tildes, en minúsculas y sin espacios de sobra, para que "Four loko" case el con "Four Loko". */
    private String normalizar(String s) {
        String sinAcentos = Normalizer.normalize(s, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return sinAcentos.toLowerCase().trim().replaceAll("\\s+", " ");
    }
}
