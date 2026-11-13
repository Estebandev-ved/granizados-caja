package co.granizados.pos.reporte;

import co.granizados.pos.comun.AppProperties;
import co.granizados.pos.comun.Pesos;
import co.granizados.pos.equipo.EquipoService;
import co.granizados.pos.equipo.Vendedor;
import co.granizados.pos.equipo.VendedorRepository;
import co.granizados.pos.gasto.Gasto;
import co.granizados.pos.gasto.GastoRepository;
import co.granizados.pos.inventario.EntradaInventarioRepository;
import co.granizados.pos.inventario.TipoMovimiento;
import co.granizados.pos.pedido.PedidoProveedorRepository;
import co.granizados.pos.plata.IngresoRepository;
import co.granizados.pos.plata.Retiro;
import co.granizados.pos.plata.RetiroRepository;
import co.granizados.pos.venta.MetodoPago;
import co.granizados.pos.venta.Venta;
import co.granizados.pos.venta.VentaRepository;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.format.TextStyle;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * El cierre del mes: lo que de verdad le quedó al negocio. Como la ganancia de Hoy (y a diferencia de Reportes), acá sí
 * se resta lo que se ganó el equipo (comisiones y premios, menos lo que se les descuenta por consumos y faltantes).
 * Si el dueño además anotó pagos al equipo como gasto «Trabajadores», no se cuentan dos veces: se toma el mayor.
 * También dice cuánto se pagó el dueño («Me pagué»), el punto de equilibrio y lo que deja cada sabor.
 */
@Service
public class CierreMesService {

    /** La categoría de gasto que se usa para pagos al equipo. */
    static final String TRABAJADORES = "TRABAJADORES";

    public record Resumen(String mes, String nombre, int unidades, long ventas, long gastos, long equipo,
                          long gananciaReal, long retiros) {
    }

    /**
     * Cuántos granizados al día hacen falta para cubrir los gastos. `dejaPorGranizado` es lo que deja uno, ya pagado
     * el producto y el equipo; `granizadosAlDia` es null si todavía no hay datos para saberlo.
     */
    public record Equilibrio(long gastosDelMes, long gastoPorDia, long dejaPorGranizado, Integer granizadosAlDia,
                             double promedioAlDia, int diasQueCubrieron, int diasConVenta) {
    }

    /** Lo que deja cada sabor en el mes, ya pagado el producto y la comisión del que lo vendió. */
    public record SaborMes(String sabor, int unidades, long ventas, long costo, long equipo, long ganancia,
                           long porUnidad, int pctGanancia) {
    }

    public record Categoria(String categoria, long monto) {
    }

    public record CierreMes(String mes, String nombre, String desde, String hasta, boolean enCurso, int diasDelMes,
                            int diasTranscurridos, int diasConVenta, int unidades, long ventas, long costo, long mermas,
                            /** Gastos sin contar los de «Trabajadores» (esos van en `equipo`). */
                            long gastos, long ingresos,
                            /** Lo del equipo que se resta: el mayor entre lo que ganaron según la app y lo anotado como gasto. */
                            long equipo, long equipoApp, long gastoTrabajadores,
                            /** Bono/descuento que te hizo el proveedor en los pedidos recibidos este mes. */
                            long bonosProveedor,
                            /** La ganancia como la muestran Hoy y Reportes (sin restar el equipo). */
                            long gananciaApp, long gananciaReal, long retiros, long quedaEnNegocio,
                            /** Si el mes va en curso: a cuánto llegaría la ganancia real al ritmo de hoy. */
                            Long proyeccion,
                            List<Categoria> gastosPorCategoria, Equilibrio equilibrio, List<SaborMes> porSabor,
                            Resumen anterior, List<String> consejos) {
    }

    private static final Locale ES = Locale.of("es", "CO");

    private final VentaRepository ventas;
    private final GastoRepository gastos;
    private final EntradaInventarioRepository movimientos;
    private final IngresoRepository ingresos;
    private final RetiroRepository retiros;
    private final VendedorRepository vendedores;
    private final PedidoProveedorRepository pedidos;
    private final EquipoService equipo;
    private final Clock clock;
    private final ZoneId zona;

    public CierreMesService(VentaRepository ventas, GastoRepository gastos, EntradaInventarioRepository movimientos,
                            IngresoRepository ingresos, RetiroRepository retiros, VendedorRepository vendedores,
                            PedidoProveedorRepository pedidos, EquipoService equipo, Clock clock, AppProperties props) {
        this.ventas = ventas;
        this.gastos = gastos;
        this.movimientos = movimientos;
        this.ingresos = ingresos;
        this.retiros = retiros;
        this.vendedores = vendedores;
        this.pedidos = pedidos;
        this.equipo = equipo;
        this.clock = clock;
        this.zona = props.zoneId();
    }

    public LocalDate hoy() {
        return LocalDate.now(clock.withZone(zona));
    }

    /** `mes` como 2026-11; vacío = el mes en curso. */
    @Transactional(readOnly = true)
    public CierreMes cierre(String mesTexto) {
        YearMonth actual = YearMonth.from(hoy());
        YearMonth mes = mesTexto == null || mesTexto.isBlank() ? actual : YearMonth.parse(mesTexto);
        if (mes.isAfter(actual)) throw new IllegalArgumentException("Ese mes todavía no llega");
        if (mes.isBefore(actual.minusMonths(24))) throw new IllegalArgumentException("Solo los últimos 2 años");

        Cuentas c = cuentas(mes);
        Cuentas ant = cuentas(mes.minusMonths(1));
        boolean enCurso = mes.equals(actual);
        int diasDelMes = mes.lengthOfMonth();
        int transcurridos = enCurso ? hoy().getDayOfMonth() : diasDelMes;

        // Punto de equilibrio: los gastos del día contra lo que deja cada granizado
        long gastoPorDia = transcurridos == 0 ? 0 : Math.round((double) c.gastosSinTrab / transcurridos);
        long deja = c.vendidas == 0 ? 0 : (c.ventas - c.costo - c.mermas - c.equipo) / c.vendidas;
        // Sin gastos no hay nada que cubrir: no hay punto de equilibrio que mostrar
        Integer alDia = deja > 0 && gastoPorDia > 0 ? (int) Math.ceil((double) gastoPorDia / deja) : null;
        int cubrieron = 0;
        if (alDia != null) for (int u : c.vendidasPorDia.values()) if (u >= alDia) cubrieron++;
        double promedio = c.vendidasPorDia.isEmpty() ? 0 : Math.round(c.vendidas * 10.0 / c.vendidasPorDia.size()) / 10.0;
        Equilibrio equilibrio = new Equilibrio(c.gastosSinTrab, gastoPorDia, deja, alDia, promedio, cubrieron,
                c.vendidasPorDia.size());

        Long proyeccion = enCurso && transcurridos > 0 && transcurridos < diasDelMes
                ? Math.round((double) c.gananciaReal() * diasDelMes / transcurridos) : null;

        Resumen anterior = new Resumen(ant.mes.toString(), nombre(ant.mes), ant.vendidas, ant.ventas, ant.gastosSinTrab,
                ant.equipo, ant.gananciaReal(), ant.retiros);

        return new CierreMes(mes.toString(), nombre(mes), mes.atDay(1).toString(), mes.atEndOfMonth().toString(), enCurso,
                diasDelMes, transcurridos, c.vendidasPorDia.size(), c.vendidas, c.ventas, c.costo, c.mermas, c.gastosSinTrab,
                c.ingresos, c.equipo, c.equipoApp, c.gastoTrabajadores, c.bonosProveedor,
                c.gananciaApp(), c.gananciaReal(), c.retiros,
                c.gananciaReal() - c.retiros, proyeccion, c.categorias, equilibrio, c.porSabor, anterior,
                consejos(c, ant, equilibrio, enCurso));
    }

    // ------------------------------------------------------------------ cuentas

    private static String nombre(YearMonth mes) {
        String m = mes.getMonth().getDisplayName(TextStyle.FULL, ES);
        return m.substring(0, 1).toUpperCase(ES) + m.substring(1) + " " + mes.getYear();
    }

    /** Los totales de un mes, ya separados como los necesita el cierre. */
    private static final class Cuentas {
        YearMonth mes;
        long ventas, costo, mermas, gastosSinTrab, gastoTrabajadores, ingresos, equipoApp, equipo, retiros, bonosProveedor;
        int vendidas;
        Map<LocalDate, Integer> vendidasPorDia = new HashMap<>();
        List<Categoria> categorias = List.of();
        List<SaborMes> porSabor = List.of();

        long gananciaApp() {
            return ventas - costo - mermas - gastosSinTrab - gastoTrabajadores + ingresos;
        }

        long gananciaReal() {
            return ventas - costo - mermas - gastosSinTrab - equipo + ingresos;
        }
    }

    private Cuentas cuentas(YearMonth mes) {
        LocalDate desde = mes.atDay(1);
        LocalDate hasta = mes.atEndOfMonth();
        Instant inicio = desde.atStartOfDay(zona).toInstant();
        Instant fin = hasta.plusDays(1).atStartOfDay(zona).toInstant();
        Cuentas c = new Cuentas();
        c.mes = mes;

        Map<Long, Vendedor> equipoPorId = new HashMap<>();
        for (Vendedor v : vendedores.findAll()) equipoPorId.put(v.getId(), v);

        Map<String, long[]> sabores = new LinkedHashMap<>(); // sabor -> {unidades, ventas, costo, comisión}
        for (Venta v : ventas.entre(inicio, fin)) {
            long costo = (long) v.getCostoUnitario() * v.getCantidad();
            c.ventas += v.getTotal();
            c.costo += costo;
            boolean vendida = !v.esDelTrabajador() && v.getMetodo() != MetodoPago.REGALO;
            long comision = 0;
            if (vendida) {
                c.vendidas += v.getCantidad();
                c.vendidasPorDia.merge(v.getCreadaEn().atZone(zona).toLocalDate(), v.getCantidad(), Integer::sum);
                Vendedor quien = v.getVendedorId() == null ? null : equipoPorId.get(v.getVendedorId());
                if (quien != null) comision = EquipoService.comisionDe(v, quien);
            }
            long[] s = sabores.computeIfAbsent(v.getProducto().nombre(), k -> new long[4]);
            if (vendida) s[0] += v.getCantidad();
            s[1] += v.getTotal();
            s[2] += costo;
            s[3] += comision;
        }

        for (var e : movimientos.entre(TipoMovimiento.MERMA, inicio, fin)) {
            c.mermas += (long) -e.getCantidad() * e.getProducto().getCosto();
        }

        Map<String, Long> porCategoria = new LinkedHashMap<>();
        for (Gasto g : gastos.findByCreadoEnGreaterThanEqualAndCreadoEnLessThanOrderByCreadoEnDescIdDesc(inicio, fin)) {
            if (TRABAJADORES.equalsIgnoreCase(g.getCategoria())) c.gastoTrabajadores += g.getMonto();
            else {
                c.gastosSinTrab += g.getMonto();
                porCategoria.merge(g.getCategoria(), g.getMonto(), Long::sum);
            }
        }
        c.categorias = porCategoria.entrySet().stream()
                .map(e -> new Categoria(e.getKey(), e.getValue()))
                .sorted(Comparator.comparingLong(Categoria::monto).reversed())
                .toList();

        c.ingresos = Optional.ofNullable(ingresos.gananciaEntre(inicio, fin)).orElse(0L);
        c.retiros = retiros.findByCreadoEnGreaterThanEqualAndCreadoEnLessThanOrderByCreadoEnDescIdDesc(inicio, fin).stream()
                .mapToLong(Retiro::getMonto).sum();
        c.bonosProveedor = pedidos.bonosRecibidosEntre(inicio, fin);

        // Lo que ganó el equipo en el mes: comisión + premios − lo que se les descuenta por consumos y faltantes
        c.equipoApp = Math.max(0, equipo.liquidar(desde, hasta).stream().mapToLong(EquipoService.Liquidacion::porPagar).sum());
        c.equipo = Math.max(c.equipoApp, c.gastoTrabajadores);

        long gananciaTotal = sabores.values().stream().mapToLong(s -> s[1] - s[2] - s[3]).sum();
        c.porSabor = sabores.entrySet().stream()
                .map(e -> {
                    long[] s = e.getValue();
                    long ganancia = s[1] - s[2] - s[3];
                    return new SaborMes(e.getKey(), (int) s[0], s[1], s[2], s[3], ganancia,
                            s[0] == 0 ? 0 : ganancia / s[0],
                            gananciaTotal <= 0 ? 0 : (int) Math.round(ganancia * 100.0 / gananciaTotal));
                })
                .sorted(Comparator.comparingLong(SaborMes::ganancia).reversed())
                .toList();
        return c;
    }

    // ------------------------------------------------------------------ consejos

    /** Lo que vale la pena decirle al dueño de ese mes, en sus palabras. */
    private List<String> consejos(Cuentas c, Cuentas ant, Equilibrio eq, boolean enCurso) {
        List<String> salida = new ArrayList<>();
        if (c.vendidas == 0) {
            salida.add("Todavía no hay ventas este mes.");
            return salida;
        }
        if (c.equipoApp > c.gastoTrabajadores && c.equipoApp > 0) {
            salida.add("Lo que se ganó tu equipo (" + Pesos.formato(c.equipoApp) + ") no se resta en Reportes. "
                    + "Acá sí: por eso esta ganancia es más baja y es la de verdad.");
        }
        if (c.gananciaReal() < 0) {
            salida.add("Este mes el negocio va perdiendo " + Pesos.formato(-c.gananciaReal())
                    + ". Revisa los gastos más grandes y el precio de las promos.");
        } else if (c.retiros > c.gananciaReal()) {
            salida.add("Te pagaste " + Pesos.formato(c.retiros) + " y el negocio ganó " + Pesos.formato(c.gananciaReal())
                    + ": estás sacando " + Pesos.formato(c.retiros - c.gananciaReal())
                    + " de la plata del negocio (la que es para volver a pedir).");
        }
        if (eq.granizadosAlDia() != null) {
            if (eq.promedioAlDia() < eq.granizadosAlDia()) {
                salida.add("Para cubrir los gastos necesitas vender " + eq.granizadosAlDia() + " al día y vas en "
                        + formatoDecimal(eq.promedioAlDia()) + ". Sube las ventas o baja los gastos.");
            } else {
                salida.add("Cubres los gastos con " + eq.granizadosAlDia() + " al día y vendes "
                        + formatoDecimal(eq.promedioAlDia()) + ": de ahí en adelante es ganancia.");
            }
        }
        List<SaborMes> conVentas = c.porSabor.stream().filter(s -> s.unidades() >= 3).toList();
        if (conVentas.size() >= 2) {
            SaborMes mejor = conVentas.stream().max(Comparator.comparingLong(SaborMes::porUnidad)).orElseThrow();
            SaborMes peor = conVentas.stream().min(Comparator.comparingLong(SaborMes::porUnidad)).orElseThrow();
            if (mejor.porUnidad() > peor.porUnidad()) {
                salida.add(mejor.sabor() + " es el que más deja por unidad (" + Pesos.formato(mejor.porUnidad()) + ") y "
                        + peor.sabor() + " el que menos (" + Pesos.formato(peor.porUnidad()) + ").");
            }
        }
        if (!c.categorias.isEmpty() && c.gastosSinTrab > 0) {
            Categoria top = c.categorias.get(0);
            int pct = (int) Math.round(top.monto() * 100.0 / c.gastosSinTrab);
            if (pct >= 40) {
                salida.add("El " + pct + "% de tus gastos se va en " + top.categoria().toLowerCase(ES) + " ("
                        + Pesos.formato(top.monto()) + ").");
            }
        }
        if (!enCurso && ant.vendidas > 0) {
            long cambio = ant.gananciaReal() == 0 ? 0
                    : Math.round((c.gananciaReal() - ant.gananciaReal()) * 100.0 / Math.abs(ant.gananciaReal()));
            if (cambio != 0) {
                salida.add((cambio > 0 ? "📈 Ganaste " : "📉 Ganaste ") + Math.abs(cambio) + "% "
                        + (cambio > 0 ? "más" : "menos") + " que en " + nombre(ant.mes).toLowerCase(ES) + ".");
            }
        }
        return salida;
    }

    private static String formatoDecimal(double n) {
        return n == Math.floor(n) ? String.valueOf((long) n) : String.valueOf(n).replace('.', ',');
    }

    /** Usado por el resumen mensual de Telegram: el texto corto del cierre de un mes. */
    public String textoCierre(CierreMes m) {
        StringBuilder t = new StringBuilder("Así cerró " + m.nombre().toLowerCase(ES) + ":")
                .append("\n• Vendiste ").append(m.unidades()).append(" granizados: ").append(Pesos.formato(m.ventas()))
                .append("\n• Producto: −").append(Pesos.formato(m.costo()));
        if (m.gastos() > 0) t.append("\n• Gastos: −").append(Pesos.formato(m.gastos()));
        if (m.equipo() > 0) t.append("\n• Equipo: −").append(Pesos.formato(m.equipo()));
        if (m.mermas() > 0) t.append("\n• Mermas: −").append(Pesos.formato(m.mermas()));
        if (m.ingresos() > 0) t.append("\n• Otros ingresos: +").append(Pesos.formato(m.ingresos()));
        if (m.bonosProveedor() > 0) t.append("\n• Bonos del proveedor: ").append(Pesos.formato(m.bonosProveedor()))
                .append(" (ya restados del pedido)");
        t.append("\nGanancia real: ").append(Pesos.formato(m.gananciaReal()));
        if (m.retiros() > 0) {
            t.append("\nTe pagaste: ").append(Pesos.formato(m.retiros()))
                    .append("\nLe quedó al negocio: ").append(Pesos.formato(m.quedaEnNegocio()));
        }
        for (String c : m.consejos()) t.append("\n\n").append(c);
        return t.toString();
    }
}
