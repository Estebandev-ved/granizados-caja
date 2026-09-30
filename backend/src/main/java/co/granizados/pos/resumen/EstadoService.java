package co.granizados.pos.resumen;

import co.granizados.pos.ajustes.AjustesService;
import co.granizados.pos.comun.AppProperties;
import co.granizados.pos.gasto.GastoRepository;
import co.granizados.pos.inventario.EntradaInventarioRepository;
import co.granizados.pos.inventario.TipoMovimiento;
import co.granizados.pos.pedido.PedidoService;
import co.granizados.pos.plata.IngresoRepository;
import co.granizados.pos.producto.ProductoDto;
import co.granizados.pos.producto.ProductoRepository;
import co.granizados.pos.venta.MetodoPago;
import co.granizados.pos.venta.Venta;
import co.granizados.pos.venta.VentaRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Arma lo que la app necesita al abrir: productos, cómo va el día y las últimas ventas. */
@Service
public class EstadoService {

    public record PorSabor(String sabor, int unidades) {
    }

    /**
     * Todo en pesos enteros. La ganancia es lo que queda después de pagar el producto,
     * los gastos del día y lo que se perdió en mermas, más los ingresos extra marcados como ganancia
     * (por ejemplo el cobro de una venta vieja).
     */
    public record ResumenDia(long total, long nequi, long efectivo, int unidades, List<PorSabor> porSabor,
                             long costo, long gastos, long mermas, long ganancia, long ingresos) {
    }

    public record VentaReciente(String clientUid, String hora, String sabor, long total, MetodoPago metodo) {
    }

    /** La meta del día y los días seguidos cumpliéndola. `valor = 0` significa que está apagada. */
    public record Meta(long valor, int racha) {
    }

    public record Estado(List<ProductoDto> productos, ResumenDia hoy, List<VentaReciente> ultimas, LocalDate dia,
                         PedidoService.PedidoEnCamino pedido, Meta meta) {
    }

    private static final DateTimeFormatter HORA = DateTimeFormatter.ofPattern("h:mm a", Locale.US);

    /** Cuántas ventas del día se mandan al celular para poder borrar cualquiera, no solo la última. */
    static final int MAX_ULTIMAS = 40;

    /** Cuántos días hacia atrás mira la racha (incluyendo hoy). */
    static final int DIAS_RACHA = 90;

    private final ProductoRepository productos;
    private final VentaRepository ventas;
    private final PedidoService pedidos;
    private final GastoRepository gastos;
    private final EntradaInventarioRepository movimientos;
    private final IngresoRepository ingresosExtra;
    private final AjustesService ajustes;
    private final Clock clock;
    private final ZoneId zona;

    public EstadoService(ProductoRepository productos, VentaRepository ventas, PedidoService pedidos,
                         GastoRepository gastos, EntradaInventarioRepository movimientos,
                         IngresoRepository ingresosExtra, AjustesService ajustes, Clock clock, AppProperties props) {
        this.productos = productos;
        this.ventas = ventas;
        this.pedidos = pedidos;
        this.gastos = gastos;
        this.movimientos = movimientos;
        this.ingresosExtra = ingresosExtra;
        this.ajustes = ajustes;
        this.clock = clock;
        this.zona = props.zoneId();
    }

    /** "Hoy" es el día calendario en Bogotá, no en UTC. */
    public LocalDate hoy() {
        return LocalDate.now(clock.withZone(zona));
    }

    @Transactional(readOnly = true)
    public Estado estado() {
        LocalDate dia = hoy();
        List<Venta> delDia = ventasDe(dia);
        List<VentaReciente> ultimas = delDia.stream().limit(MAX_ULTIMAS)
                .map(v -> new VentaReciente(v.getClientUid(), HORA.format(v.getCreadaEn().atZone(zona)),
                        v.getProducto().nombre(), v.getTotal(), v.getMetodo()))
                .toList();
        List<ProductoDto> activos = productos.findByActivoTrueOrderByOrdenAscIdAsc().stream().map(ProductoDto::de).toList();
        ResumenDia resumen = resumenDe(dia, delDia);
        return new Estado(activos, resumen, ultimas, dia, pedidos.enCamino(), metaDe(dia));
    }

    /** La meta puesta en Ajustes, más la racha. Con 0 la meta está apagada y no hay racha. */
    private Meta metaDe(LocalDate dia) {
        long valor;
        try {
            valor = Long.parseLong(ajustes.mapa().getOrDefault(AjustesService.META_DIARIA, "0").trim());
        } catch (NumberFormatException e) {
            valor = 0;
        }
        if (valor <= 0) return new Meta(0, 0);
        return new Meta(valor, racha(valor, dia));
    }

    /**
     * Días seguidos que cumplieron la meta: los de hasta ayer, más hoy si ya la alcanzó.
     * Un día sin ventas rompe la racha.
     */
    private int racha(long valor, LocalDate dia) {
        LocalDate desde = dia.minusDays(DIAS_RACHA - 1);
        Map<LocalDate, Long> porDia = ventas
                .entre(desde.atStartOfDay(zona).toInstant(), dia.plusDays(1).atStartOfDay(zona).toInstant())
                .stream()
                .collect(Collectors.groupingBy(v -> v.getCreadaEn().atZone(zona).toLocalDate(),
                        Collectors.summingLong(Venta::getTotal)));

        int racha = porDia.getOrDefault(dia, 0L) >= valor ? 1 : 0;
        LocalDate d = dia.minusDays(1);
        while (!d.isBefore(desde)) {
            if (porDia.getOrDefault(d, 0L) < valor) break;
            racha++;
            d = d.minusDays(1);
        }
        return racha;
    }

    @Transactional(readOnly = true)
    public ResumenDia resumenDe(LocalDate dia) {
        return resumenDe(dia, ventasDe(dia));
    }

    private ResumenDia resumenDe(LocalDate dia, List<Venta> delDia) {
        Instant desde = dia.atStartOfDay(zona).toInstant();
        Instant hasta = dia.plusDays(1).atStartOfDay(zona).toInstant();
        long gastosDia = Optional.ofNullable(gastos.montoEntre(desde, hasta)).orElse(0L);
        // Las mermas se guardan con el delta (negativo): lo que se perdió vale −delta × costo
        long mermasDia = movimientos.entre(TipoMovimiento.MERMA, desde, hasta).stream()
                .mapToLong(e -> (long) -e.getCantidad() * e.getProducto().getCosto())
                .sum();
        long ingresosDia = Optional.ofNullable(ingresosExtra.gananciaEntre(desde, hasta)).orElse(0L);
        return resumir(delDia, gastosDia, mermasDia, ingresosDia);
    }

    private List<Venta> ventasDe(LocalDate dia) {
        return ventas.entre(dia.atStartOfDay(zona).toInstant(), dia.plusDays(1).atStartOfDay(zona).toInstant());
    }

    private static ResumenDia resumir(List<Venta> lista, long gastos, long mermas, long ingresos) {
        long total = 0, nequi = 0, efectivo = 0, costo = 0;
        int unidades = 0;
        Map<String, Integer> porSabor = new LinkedHashMap<>();
        for (Venta v : lista) {
            total += v.getTotal();
            unidades += v.getCantidad();
            costo += v.getCostoUnitario() * v.getCantidad();
            if (v.getMetodo() == MetodoPago.EFECTIVO) efectivo += v.getTotal();
            else nequi += v.getTotal();
            porSabor.merge(v.getProducto().nombre(), v.getCantidad(), Integer::sum);
        }
        List<PorSabor> ranking = porSabor.entrySet().stream()
                .map(e -> new PorSabor(e.getKey(), e.getValue()))
                .sorted(Comparator.comparingInt(PorSabor::unidades).reversed())
                .toList();
        return new ResumenDia(total, nequi, efectivo, unidades, ranking, costo, gastos, mermas,
                total - costo - gastos - mermas + ingresos, ingresos);
    }
}
