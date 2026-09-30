package co.granizados.pos.plata;

import co.granizados.pos.comun.AppProperties;
import co.granizados.pos.comun.NoEncontradoException;
import co.granizados.pos.gasto.Gasto;
import co.granizados.pos.gasto.GastoRepository;
import co.granizados.pos.venta.MetodoPago;
import co.granizados.pos.venta.Venta;
import co.granizados.pos.venta.VentaRepository;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Cuánta plata hay y dónde. Parte del último conteo que hiciste y le suma o resta lo que pasó después:
 *   caja  = conteo + ventas en efectivo + ingresos − gastos − pagos al proveedor ± traslados
 *   casa  = conteo + ingresos − pagos al proveedor ± traslados
 *   nequi = conteo + ventas por Nequi + ingresos − pagos al proveedor ± traslados
 * Los gastos se asumen pagados con efectivo de la caja. Si no coincide con la realidad, se cuenta de nuevo.
 *
 * Las metas ("sobres") apartan plata sin moverla de lugar: `libre = total − apartado`.
 * Solo los ingresos marcados como ganancia entran en la ganancia del día (ver EstadoService y ReporteService).
 */
@Service
public class PlataService {

    public record NuevoIngreso(
            @NotBlank @Size(max = 64) String clientUid,
            @Size(max = 120) String concepto,
            @Positive @Max(1_000_000_000) long monto,
            @NotNull LugarPlata lugar,
            Instant creadoEn,
            Boolean cuentaGanancia) {
    }

    public record NuevoConteo(
            @NotBlank @Size(max = 64) String clientUid,
            @Min(0) @Max(1_000_000_000) long caja,
            @Min(0) @Max(1_000_000_000) long casa,
            @Min(0) @Max(1_000_000_000) long nequi) {
    }

    public record NuevoTraslado(
            @NotBlank @Size(max = 64) String clientUid,
            @Positive @Max(1_000_000_000) long monto,
            @NotNull LugarPlata desde,
            @NotNull LugarPlata hacia) {
    }

    public record NuevaMeta(
            @NotBlank @Size(max = 64) String clientUid,
            @NotBlank @Size(max = 40) String nombre,
            @Min(0) @Max(1_000_000_000) long objetivo) {
    }

    /** `monto` positivo aparta plata para la meta; negativo la saca. */
    public record NuevoAporte(
            @NotBlank @Size(max = 64) String clientUid,
            @Max(1_000_000_000) @Min(-1_000_000_000) long monto) {
    }

    public record IngresoDto(String clientUid, String concepto, long monto, LugarPlata lugar, Instant creadoEn,
                             boolean cuentaGanancia) {
    }

    public record MetaDto(long id, String nombre, long objetivo, long apartado) {
    }

    /**
     * `contadoEn` es null si todavía no has contado nada: en ese caso caja/casa/nequi no significan nada.
     * `libre` es lo que puedes gastar sin tocar lo apartado en metas.
     */
    public record Saldo(long caja, long casa, long nequi, long total, long apartado, long libre, Instant contadoEn,
                        List<IngresoDto> ingresos, List<MetaDto> metas) {
    }

    /** Un renglón del historial. `monto` va con signo; los traslados llevan 0 porque no cambian el total. */
    public record Movimiento(String tipo, String dia, String hora, String concepto, long monto, String lugar,
                             String clientUid) {
    }

    public enum Resultado { REGISTRADA, REPETIDA }

    /** Mismo criterio que ventas y gastos: la hora la manda el celular, pero no más de 3 días atrás. */
    static final Duration MAX_ATRASO = Duration.ofDays(3);

    private static final DateTimeFormatter DIA = DateTimeFormatter.ISO_LOCAL_DATE;
    private static final DateTimeFormatter HORA = DateTimeFormatter.ofPattern("h:mm a", Locale.US);

    private final IngresoRepository ingresos;
    private final ConteoPlataRepository conteos;
    private final PagoProveedorRepository pagos;
    private final TrasladoRepository traslados;
    private final MetaPlataRepository metas;
    private final AporteMetaRepository aportes;
    private final VentaRepository ventas;
    private final GastoRepository gastos;
    private final Clock clock;
    private final ZoneId zona;

    public PlataService(IngresoRepository ingresos, ConteoPlataRepository conteos, PagoProveedorRepository pagos,
                        TrasladoRepository traslados, MetaPlataRepository metas, AporteMetaRepository aportes,
                        VentaRepository ventas, GastoRepository gastos, Clock clock, AppProperties props) {
        this.ingresos = ingresos;
        this.conteos = conteos;
        this.pagos = pagos;
        this.traslados = traslados;
        this.metas = metas;
        this.aportes = aportes;
        this.ventas = ventas;
        this.gastos = gastos;
        this.clock = clock;
        this.zona = props.zoneId();
    }

    // ------------------------------------------------------------------ escribir

    @Transactional
    public Resultado registrarIngreso(NuevoIngreso n) {
        if (ingresos.existsByClientUid(n.clientUid())) return Resultado.REPETIDA;
        String concepto = n.concepto() == null ? "" : n.concepto().trim();
        boolean cuentaGanancia = n.cuentaGanancia() == null || n.cuentaGanancia();
        ingresos.saveAndFlush(new Ingreso(n.clientUid(), concepto, n.monto(), n.lugar(), cuando(n.creadoEn()),
                cuentaGanancia));
        return Resultado.REGISTRADA;
    }

    @Transactional
    public void borrarIngreso(String clientUid) {
        ingresos.findByClientUid(clientUid).ifPresent(ingresos::delete);
    }

    @Transactional
    public Resultado contar(NuevoConteo c) {
        if (conteos.existsByClientUid(c.clientUid())) return Resultado.REPETIDA;
        conteos.saveAndFlush(new ConteoPlata(c.clientUid(), c.caja(), c.casa(), c.nequi(), clock.instant()));
        return Resultado.REGISTRADA;
    }

    @Transactional
    public Resultado trasladar(NuevoTraslado t) {
        if (traslados.existsByClientUid(t.clientUid())) return Resultado.REPETIDA;
        if (t.desde() == t.hacia()) throw new IllegalArgumentException("Escoge dos lugares distintos");
        traslados.saveAndFlush(new Traslado(t.clientUid(), t.monto(), t.desde(), t.hacia(), clock.instant()));
        return Resultado.REGISTRADA;
    }

    @Transactional
    public Resultado crearMeta(NuevaMeta m) {
        if (metas.existsByClientUid(m.clientUid())) return Resultado.REPETIDA;
        metas.saveAndFlush(new MetaPlata(m.clientUid(), m.nombre().trim(), m.objetivo(), clock.instant()));
        return Resultado.REGISTRADA;
    }

    @Transactional
    public Resultado aportar(long metaId, NuevoAporte a) {
        if (aportes.existsByClientUid(a.clientUid())) return Resultado.REPETIDA;
        if (a.monto() == 0) throw new IllegalArgumentException("Escribe cuánta plata");
        MetaPlata meta = metas.findById(metaId)
                .orElseThrow(() -> new NoEncontradoException("Meta no encontrada: " + metaId));
        long actual = aportes.totalDe(metaId);
        if (actual + a.monto() < 0) {
            throw new IllegalArgumentException("La meta " + meta.getNombre() + " solo tiene $" + actual + " apartados");
        }
        aportes.saveAndFlush(new AporteMeta(a.clientUid(), metaId, a.monto(), clock.instant()));
        return Resultado.REGISTRADA;
    }

    /** Borrar una meta devuelve lo apartado a la plata libre: el dinero nunca se pierde. */
    @Transactional
    public void borrarMeta(long metaId) {
        if (!metas.existsById(metaId)) throw new NoEncontradoException("Meta no encontrada: " + metaId);
        aportes.borrarDe(metaId);
        metas.deleteById(metaId);
    }

    /** Se llama al recibir un pedido. Uno por pedido: si ya estaba, no escribe otra vez. */
    @Transactional
    public void registrarPagoPedido(Long pedidoId, long monto, LugarPlata lugar) {
        if (monto <= 0 || pagos.existsByPedidoId(pedidoId)) return;
        pagos.save(new PagoProveedor(pedidoId, monto, lugar == null ? LugarPlata.NEQUI : lugar, clock.instant()));
    }

    // ------------------------------------------------------------------ leer

    @Transactional(readOnly = true)
    public Saldo saldo() {
        List<IngresoDto> recientes = ingresos.findTop10ByOrderByCreadoEnDescIdDesc().stream()
                .map(PlataService::dto)
                .toList();
        List<MetaDto> listaMetas = metas.findAllByOrderByIdAsc().stream()
                .map(m -> new MetaDto(m.getId(), m.getNombre(), m.getObjetivo(), aportes.totalDe(m.getId())))
                .toList();
        long apartado = listaMetas.stream().mapToLong(MetaDto::apartado).sum();

        Optional<ConteoPlata> ultimo = conteos.findFirstByOrderByCreadoEnDescIdDesc();
        if (ultimo.isEmpty()) return new Saldo(0, 0, 0, 0, apartado, 0, null, recientes, listaMetas);

        ConteoPlata c = ultimo.get();
        Instant desde = c.getCreadoEn();
        Instant hasta = clock.instant().plus(Duration.ofDays(1));
        long caja = c.getCaja(), casa = c.getCasa(), nequi = c.getNequi();

        for (Venta v : ventas.entre(desde, hasta)) {
            if (v.getMetodo() == MetodoPago.EFECTIVO) caja += v.getTotal();
            else nequi += v.getTotal();
        }
        caja -= Optional.ofNullable(gastos.montoEntre(desde, hasta)).orElse(0L);
        for (Ingreso i : ingresos.findByCreadoEnGreaterThanEqualOrderByCreadoEnDescIdDesc(desde)) {
            switch (i.getLugar()) {
                case CAJA -> caja += i.getMonto();
                case CASA -> casa += i.getMonto();
                case NEQUI -> nequi += i.getMonto();
            }
        }
        for (PagoProveedor p : pagos.findByCreadoEnGreaterThanEqual(desde)) {
            switch (p.getLugar()) {
                case CAJA -> caja -= p.getMonto();
                case CASA -> casa -= p.getMonto();
                case NEQUI -> nequi -= p.getMonto();
            }
        }
        for (Traslado t : traslados.findByCreadoEnGreaterThanEqualOrderByCreadoEnDescIdDesc(desde)) {
            switch (t.getDesde()) {
                case CAJA -> caja -= t.getMonto();
                case CASA -> casa -= t.getMonto();
                case NEQUI -> nequi -= t.getMonto();
            }
            switch (t.getHacia()) {
                case CAJA -> caja += t.getMonto();
                case CASA -> casa += t.getMonto();
                case NEQUI -> nequi += t.getMonto();
            }
        }
        long total = caja + casa + nequi;
        return new Saldo(caja, casa, nequi, total, apartado, total - apartado, desde, recientes, listaMetas);
    }

    /**
     * Todo lo que movió la plata en los últimos `dias` días, lo más nuevo primero.
     * Las ventas van sumadas por día y método (si no serían decenas de renglones al día).
     */
    @Transactional(readOnly = true)
    public List<Movimiento> movimientos(int dias) {
        int n = Math.max(1, Math.min(dias, 60));
        LocalDate hoy = LocalDate.now(clock.withZone(zona));
        Instant desde = hoy.minusDays(n - 1L).atStartOfDay(zona).toInstant();
        Instant hasta = hoy.plusDays(1).atStartOfDay(zona).toInstant();

        record Fila(Instant cuando, Movimiento m) {
        }
        List<Fila> filas = new ArrayList<>();

        // Ventas por día y método
        record Acum(Instant ultima, long total, int unidades) {
        }
        Map<String, Acum> porDiaYMetodo = new LinkedHashMap<>();
        for (Venta v : ventas.entre(desde, hasta)) {
            String clave = DIA.format(v.getCreadaEn().atZone(zona)) + "|" + v.getMetodo();
            porDiaYMetodo.merge(clave, new Acum(v.getCreadaEn(), v.getTotal(), v.getCantidad()),
                    (a, b) -> new Acum(a.ultima().isAfter(b.ultima()) ? a.ultima() : b.ultima(),
                            a.total() + b.total(), a.unidades() + b.unidades()));
        }
        porDiaYMetodo.forEach((clave, a) -> {
            boolean efectivo = clave.endsWith("|" + MetodoPago.EFECTIVO);
            var z = a.ultima().atZone(zona);
            filas.add(new Fila(a.ultima(), new Movimiento("VENTAS", DIA.format(z), HORA.format(z),
                    (efectivo ? "Ventas en efectivo" : "Ventas por Nequi") + " · " + a.unidades() + " u.",
                    a.total(), efectivo ? "CAJA" : "NEQUI", null)));
        });

        for (Ingreso i : ingresos.findByCreadoEnGreaterThanEqualOrderByCreadoEnDescIdDesc(desde)) {
            var z = i.getCreadoEn().atZone(zona);
            String base = i.getConcepto() == null || i.getConcepto().isBlank() ? "Ingreso" : i.getConcepto();
            filas.add(new Fila(i.getCreadoEn(), new Movimiento("INGRESO", DIA.format(z), HORA.format(z), base,
                    i.getMonto(), i.getLugar().name(), i.getClientUid())));
        }
        for (Gasto g : gastos.findByCreadoEnGreaterThanEqualAndCreadoEnLessThanOrderByCreadoEnDescIdDesc(desde, hasta)) {
            var z = g.getCreadoEn().atZone(zona);
            String concepto = "Gasto · " + g.getCategoria().name().toLowerCase(Locale.ROOT)
                    + (g.getConcepto() == null || g.getConcepto().isBlank() ? "" : " · " + g.getConcepto());
            filas.add(new Fila(g.getCreadoEn(), new Movimiento("GASTO", DIA.format(z), HORA.format(z), concepto,
                    -g.getMonto(), "CAJA", g.getClientUid())));
        }
        for (PagoProveedor p : pagos.findByCreadoEnGreaterThanEqual(desde)) {
            var z = p.getCreadoEn().atZone(zona);
            filas.add(new Fila(p.getCreadoEn(), new Movimiento("PAGO_PEDIDO", DIA.format(z), HORA.format(z),
                    "Pago a Energy Cocktails", -p.getMonto(), p.getLugar().name(), null)));
        }
        for (Traslado t : traslados.findByCreadoEnGreaterThanEqualOrderByCreadoEnDescIdDesc(desde)) {
            var z = t.getCreadoEn().atZone(zona);
            filas.add(new Fila(t.getCreadoEn(), new Movimiento("TRASLADO", DIA.format(z), HORA.format(z),
                    "Pasé " + pesos(t.getMonto()) + " de " + t.getDesde().name().toLowerCase(Locale.ROOT)
                            + " a " + t.getHacia().name().toLowerCase(Locale.ROOT),
                    0, t.getHacia().name(), null)));
        }
        return filas.stream()
                .sorted(Comparator.comparing(Fila::cuando).reversed())
                .map(Fila::m)
                .toList();
    }

    private static String pesos(long n) {
        return "$" + java.text.NumberFormat.getIntegerInstance(Locale.of("es", "CO")).format(n);
    }

    private static IngresoDto dto(Ingreso i) {
        return new IngresoDto(i.getClientUid(), i.getConcepto(), i.getMonto(), i.getLugar(), i.getCreadoEn(),
                i.isCuentaGanancia());
    }

    private Instant cuando(Instant delCelular) {
        Instant ahora = clock.instant();
        if (delCelular == null || delCelular.isAfter(ahora.plus(Duration.ofMinutes(5)))
                || delCelular.isBefore(ahora.minus(MAX_ATRASO))) {
            return ahora;
        }
        return delCelular;
    }
}
