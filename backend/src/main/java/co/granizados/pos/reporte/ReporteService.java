package co.granizados.pos.reporte;

import co.granizados.pos.caja.ArqueoService;
import co.granizados.pos.comun.AppProperties;
import co.granizados.pos.gasto.CategoriaGasto;
import co.granizados.pos.gasto.Gasto;
import co.granizados.pos.gasto.GastoRepository;
import co.granizados.pos.inventario.EntradaInventarioRepository;
import co.granizados.pos.inventario.TipoMovimiento;
import co.granizados.pos.pedido.PedidoService;
import co.granizados.pos.venta.MetodoPago;
import co.granizados.pos.venta.Venta;
import co.granizados.pos.venta.VentaRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.TreeMap;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reportes por periodo. Todo se calcula en Java sobre las ventas ya cargadas:
 * la hora de Bogotá no se calcula igual en H2 y en PostgreSQL, y el volumen es chico.
 * `desde` y `hasta` son fechas de Bogotá y ambas se incluyen.
 */
@Service
public class ReporteService {

    public record Totales(long ventas, int unidades, long nequi, long efectivo, long costo,
                          long gastos, long mermas, long ganancia) {
    }

    public record PorDia(String dia, int unidades, long total, long ganancia) {
    }

    /** Para las barras: `clave` es la hora (0-23) o el día de la semana (0-6, lunes=0). */
    public record PorEtiqueta(int clave, String nombre, int unidades) {
    }

    public record PorSabor(String sabor, int unidades, long ingresos, long ganancia) {
    }

    /** El cierre de un día: cuánto decía la app y cuánto había. `diferencia` negativa = faltó plata. */
    public record CierreCaja(LocalDate dia, long esperado, long contado, long diferencia, String nota) {
    }

    public record PorCategoriaGasto(CategoriaGasto categoria, long monto) {
    }

    /** Un gasto individual del periodo, para la lista de "Mis gastos". */
    public record GastoDetalle(String clientUid, String dia, String hora, CategoriaGasto categoria, String concepto, long monto) {
    }

    /** Lo gastado en un día del periodo, para la gráfica de "Mis gastos". */
    public record PorDiaGasto(String dia, long monto) {
    }

    /** Mismos totales del periodo inmediatamente anterior, de igual duración, para comparar. */
    public record Comparacion(long ventas, int unidades, long ganancia, long gastos) {
    }

    public record Reporte(String desde, String hasta, Totales totales, List<PorDia> porDia,
                          List<PorEtiqueta> porHora, List<PorEtiqueta> porDiaSemana,
                          List<PorSabor> porSabor, List<PedidoService.PedidoDto> pedidos,
                          List<CierreCaja> arqueos, List<PorCategoriaGasto> porCategoriaGasto,
                          List<PorCategoriaGasto> porCategoriaGastoAnterior,
                          List<GastoDetalle> gastosDetalle, List<PorDiaGasto> gastosPorDia, Comparacion anterior) {
    }

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_LOCAL_DATE;
    private static final DateTimeFormatter HORA = DateTimeFormatter.ofPattern("HH:mm");
    private static final String[] DIAS = {"lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"};

    private final VentaRepository ventas;
    private final GastoRepository gastos;
    private final EntradaInventarioRepository movimientos;
    private final PedidoService pedidos;
    private final ArqueoService arqueos;
    private final ZoneId zona;

    public ReporteService(VentaRepository ventas, GastoRepository gastos,
                          EntradaInventarioRepository movimientos, PedidoService pedidos,
                          ArqueoService arqueos, Clock clock, AppProperties props) {
        this.ventas = ventas;
        this.gastos = gastos;
        this.movimientos = movimientos;
        this.pedidos = pedidos;
        this.arqueos = arqueos;
        this.zona = props.zoneId();
    }

    @Transactional(readOnly = true)
    public Reporte reporte(String desdeTexto, String hastaTexto) {
        LocalDate desde = validar(desdeTexto, hastaTexto);
        LocalDate hasta = LocalDate.parse(hastaTexto, ISO);
        Instant inicio = desde.atStartOfDay(zona).toInstant();
        Instant fin = hasta.plusDays(1).atStartOfDay(zona).toInstant();

        List<Venta> lista = ventas.entre(inicio, fin);
        List<Gasto> gastosLista = gastos.findByCreadoEnGreaterThanEqualAndCreadoEnLessThanOrderByCreadoEnDescIdDesc(inicio, fin);
        Map<String, Long> mermasPorDia = mermasPorDia(inicio, fin);

        return new Reporte(desdeTexto, hastaTexto,
                totales(lista, montoGastos(gastosLista), suma(mermasPorDia)),
                porDia(lista, gastosLista, mermasPorDia),
                porHora(lista),
                porDiaSemana(lista),
                porSabor(lista),
                pedidos.listarEntre(inicio, fin),
                cierres(desde, hasta),
                porCategoriaGasto(gastosLista),
                porCategoriaGasto(gastosAnteriores(desde, hasta)),
                gastosDetalle(gastosLista),
                gastosPorDia(gastosLista),
                comparacionAnterior(desde, hasta));
    }

    /** CSV de las ventas del periodo: punto y coma y BOM para que Excel en Colombia lo abra bien. */
    @Transactional(readOnly = true)
    public String csv(String desdeTexto, String hastaTexto) {
        LocalDate desde = validar(desdeTexto, hastaTexto);
        LocalDate hasta = LocalDate.parse(hastaTexto, ISO);
        Instant inicio = desde.atStartOfDay(zona).toInstant();
        Instant fin = hasta.plusDays(1).atStartOfDay(zona).toInstant();

        List<Venta> lista = new ArrayList<>(ventas.entre(inicio, fin));
        lista.sort(Comparator.comparing(Venta::getCreadaEn).thenComparing(Venta::getId));

        // "sep=;" en la primera línea: sin esto, Excel usa el separador de listas de Windows
        // (coma en inglés) y mete todo en una sola columna aunque el archivo use ";".
        StringBuilder sb = new StringBuilder("sep=;\nfecha;hora;sabor;cantidad;precio;total;costo;metodo\n");
        for (Venta v : lista) {
            var cuando = v.getCreadaEn().atZone(zona);
            sb.append(ISO.format(cuando.toLocalDate())).append(';')
                    .append(HORA.format(cuando.toLocalTime())).append(';')
                    .append(v.getProducto().nombre()).append(';')
                    .append(v.getCantidad()).append(';')
                    .append(v.getPrecioUnitario()).append(';')
                    .append(v.getTotal()).append(';')
                    .append((long) v.getCostoUnitario() * v.getCantidad()).append(';')
                    .append(v.getMetodo() == MetodoPago.EFECTIVO ? "Efectivo" : "Nequi").append('\n');
        }
        return sb.toString();
    }

    // ------------------------------------------------------------------ cortes

    private Totales totales(List<Venta> lista, long gastosTotal, long mermasTotal) {
        long ventasTotal = 0, nequi = 0, efectivo = 0, costo = 0;
        int unidades = 0;
        for (Venta v : lista) {
            ventasTotal += v.getTotal();
            unidades += v.getCantidad();
            costo += (long) v.getCostoUnitario() * v.getCantidad();
            if (v.getMetodo() == MetodoPago.EFECTIVO) efectivo += v.getTotal();
            else nequi += v.getTotal();
        }
        return new Totales(ventasTotal, unidades, nequi, efectivo, costo, gastosTotal, mermasTotal,
                ventasTotal - costo - gastosTotal - mermasTotal);
    }

    private List<PorDia> porDia(List<Venta> lista, List<Gasto> gastosLista, Map<String, Long> mermasPorDia) {
        Map<String, Corte> mapa = new TreeMap<>();
        for (Venta v : lista) {
            Corte c = mapa.computeIfAbsent(dia(v.getCreadaEn()), Corte::nuevo);
            c.unidades += v.getCantidad();
            c.total += v.getTotal();
            c.costo += (long) v.getCostoUnitario() * v.getCantidad();
        }
        for (Gasto g : gastosLista) {
            mapa.computeIfAbsent(dia(g.getCreadoEn()), Corte::nuevo).gastos += g.getMonto();
        }
        for (Map.Entry<String, Long> e : mermasPorDia.entrySet()) {
            mapa.computeIfAbsent(e.getKey(), Corte::nuevo).mermas += e.getValue();
        }
        return mapa.entrySet().stream()
                .map(e -> new PorDia(e.getKey(), e.getValue().unidades, e.getValue().total,
                        e.getValue().total - e.getValue().costo - e.getValue().gastos - e.getValue().mermas))
                .toList();
    }

    private List<PorEtiqueta> porHora(List<Venta> lista) {
        int[] unidades = new int[24];
        for (Venta v : lista) unidades[v.getCreadaEn().atZone(zona).getHour()] += v.getCantidad();
        List<PorEtiqueta> salida = new ArrayList<>();
        for (int h = 0; h < 24; h++) salida.add(new PorEtiqueta(h, "%02d".formatted(h), unidades[h]));
        return salida;
    }

    private List<PorEtiqueta> porDiaSemana(List<Venta> lista) {
        int[] unidades = new int[7];
        for (Venta v : lista) unidades[v.getCreadaEn().atZone(zona).getDayOfWeek().getValue() - 1] += v.getCantidad();
        List<PorEtiqueta> salida = new ArrayList<>();
        for (int d = 0; d < 7; d++) salida.add(new PorEtiqueta(d, DIAS[d], unidades[d]));
        return salida;
    }

    private List<PorSabor> porSabor(List<Venta> lista) {
        Map<String, Corte> mapa = new LinkedHashMap<>();
        for (Venta v : lista) {
            Corte c = mapa.computeIfAbsent(v.getProducto().nombre(), Corte::nuevo);
            c.unidades += v.getCantidad();
            c.total += v.getTotal();
            c.costo += (long) v.getCostoUnitario() * v.getCantidad();
        }
        return mapa.entrySet().stream()
                .map(e -> new PorSabor(e.getKey(), e.getValue().unidades, e.getValue().total,
                        e.getValue().total - e.getValue().costo))
                .sorted(Comparator.comparingInt(PorSabor::unidades).reversed())
                .toList();
    }

    private List<PorCategoriaGasto> porCategoriaGasto(List<Gasto> lista) {
        Map<CategoriaGasto, Long> mapa = new EnumMap<>(CategoriaGasto.class);
        for (Gasto g : lista) mapa.merge(g.getCategoria(), g.getMonto(), Long::sum);
        return mapa.entrySet().stream()
                .map(e -> new PorCategoriaGasto(e.getKey(), e.getValue()))
                .sorted(Comparator.comparingLong(PorCategoriaGasto::monto).reversed())
                .toList();
    }

    /** Cada gasto tal cual quedó, más reciente primero, para la lista "Mis gastos". */
    private List<GastoDetalle> gastosDetalle(List<Gasto> lista) {
        return lista.stream()
                .map(g -> {
                    var cuando = g.getCreadoEn().atZone(zona);
                    return new GastoDetalle(g.getClientUid(), ISO.format(cuando.toLocalDate()),
                            HORA.format(cuando.toLocalTime()), g.getCategoria(), g.getConcepto(), g.getMonto());
                })
                .toList();
    }

    /** Lo gastado día a día del periodo, para la gráfica de "Mis gastos". */
    private List<PorDiaGasto> gastosPorDia(List<Gasto> lista) {
        Map<String, Long> mapa = new TreeMap<>();
        for (Gasto g : lista) mapa.merge(dia(g.getCreadoEn()), g.getMonto(), Long::sum);
        return mapa.entrySet().stream().map(e -> new PorDiaGasto(e.getKey(), e.getValue())).toList();
    }

    /** [desde, hasta] tiene el mismo número de días que el periodo inmediatamente anterior. */
    private Instant[] rangoAnterior(LocalDate desde, LocalDate hasta) {
        long dias = ChronoUnit.DAYS.between(desde, hasta) + 1;
        LocalDate desdeAnt = desde.minusDays(dias);
        LocalDate hastaAnt = desde.minusDays(1);
        return new Instant[] { desdeAnt.atStartOfDay(zona).toInstant(), hastaAnt.plusDays(1).atStartOfDay(zona).toInstant() };
    }

    private List<Gasto> gastosAnteriores(LocalDate desde, LocalDate hasta) {
        Instant[] r = rangoAnterior(desde, hasta);
        return gastos.findByCreadoEnGreaterThanEqualAndCreadoEnLessThanOrderByCreadoEnDescIdDesc(r[0], r[1]);
    }

    /** Ventas, gastos, unidades y ganancia del periodo inmediatamente anterior, de igual duración que [desde, hasta]. */
    private Comparacion comparacionAnterior(LocalDate desde, LocalDate hasta) {
        Instant[] r = rangoAnterior(desde, hasta);
        List<Venta> lista = ventas.entre(r[0], r[1]);
        long gastosAnt = Optional.ofNullable(gastos.montoEntre(r[0], r[1])).orElse(0L);
        long mermasAnt = suma(mermasPorDia(r[0], r[1]));
        Totales t = totales(lista, gastosAnt, mermasAnt);
        return new Comparacion(t.ventas(), t.unidades(), t.ganancia(), t.gastos());
    }

    // ------------------------------------------------------------------ utilidades

    /** Los cierres de caja del periodo, para ver dónde faltó o sobró plata. `hasta` se incluye. */
    private List<CierreCaja> cierres(LocalDate desde, LocalDate hasta) {
        return arqueos.entre(desde, hasta.plusDays(1)).stream()
                .map(a -> new CierreCaja(a.getDia(), a.getEsperado(), a.getContado(), a.getDiferencia(), a.getNota()))
                .toList();
    }

    private Map<String, Long> mermasPorDia(Instant inicio, Instant fin) {
        Map<String, Long> mapa = new TreeMap<>();
        for (var e : movimientos.entre(TipoMovimiento.MERMA, inicio, fin)) {
            String dia = dia(e.getCreadaEn());
            long perdido = (long) -e.getCantidad() * e.getProducto().getCosto();
            mapa.merge(dia, perdido, Long::sum);
        }
        return mapa;
    }

    private String dia(Instant cuando) {
        return ISO.format(cuando.atZone(zona).toLocalDate());
    }

    private long montoGastos(List<Gasto> lista) {
        return lista.stream().mapToLong(Gasto::getMonto).sum();
    }

    private long suma(Map<String, Long> mapa) {
        return mapa.values().stream().mapToLong(Long::longValue).sum();
    }

    private LocalDate validar(String desdeTexto, String hastaTexto) {
        LocalDate desde = LocalDate.parse(desdeTexto, ISO);
        LocalDate hasta = LocalDate.parse(hastaTexto, ISO);
        if (hasta.isBefore(desde)) throw new IllegalArgumentException("hasta es anterior a desde");
        if (desde.isBefore(hasta.minusDays(365))) throw new IllegalArgumentException("Máximo un año de reporte");
        return desde;
    }

    /** Acumulado mutables: se usan mientras se recorre el periodo y no salen del servicio. */
    private static final class Corte {
        int unidades;
        long total;
        long costo;
        long gastos;
        long mermas;

        static Corte nuevo(String k) {
            return new Corte();
        }
    }
}
