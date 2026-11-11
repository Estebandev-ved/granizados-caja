package co.granizados.pos.equipo;

import co.granizados.pos.ajustes.AjustesService;
import co.granizados.pos.comun.AppProperties;
import co.granizados.pos.comun.NoEncontradoException;
import co.granizados.pos.comun.Pesos;
import co.granizados.pos.negocio.TenantContext;
import co.granizados.pos.plata.LugarPlata;
import co.granizados.pos.venta.MetodoPago;
import co.granizados.pos.producto.Producto;
import co.granizados.pos.producto.ProductoRepository;
import co.granizados.pos.producto.TipoProducto;
import co.granizados.pos.venta.Venta;
import co.granizados.pos.venta.VentaRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Locale;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.Optional;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Trabajadores que venden dentro de la misma caja. Comparten inventario y reportes con el dueño; lo que cambia es
 * quién hizo cada venta, cuánto sacó cada uno a vender (la carga) y cuánto le toca de lo vendido (la liquidación).
 * Se asume que el Nequi entra a la cuenta del dueño y el efectivo lo tiene el trabajador hasta entregarlo.
 */
@Service
public class EquipoService {

    public record NuevoVendedor(
            @NotBlank @Size(max = 60) String nombre,
            @NotBlank @Pattern(regexp = "\\d{4,8}", message = "El PIN son entre 4 y 8 números") String pin,
            @Min(0) @Max(100) int comisionPct) {
    }

    public record CambioVendedor(
            @Size(max = 60) String nombre,
            @Pattern(regexp = "\\d{4,8}", message = "El PIN son entre 4 y 8 números") String pin,
            @Min(0) @Max(100) Integer comisionPct,
            Boolean activo) {
    }

    public record ItemCarga(@NotNull Long productoId, @Min(0) @Max(999) int llevo) {
    }

    public record Carga(@NotNull @Size(max = 100) List<@Valid ItemCarga> items) {
    }

    /** Un sabor de la carga: cuánto sacó, cuánto vendió desde entonces y cuánto le queda. */
    public record FilaCarga(Long productoId, String nombre, int llevo, int vendi, int queda) {
    }

    /** `terminosAceptadosEn` es null mientras no haya aceptado la versión actual de los términos. */
    public record VendedorDto(Long id, String nombre, int comisionPct, boolean activo, int unidadesHoy, long totalHoy,
                              List<FilaCarga> carga, Instant terminosAceptadosEn,
                              FrecuenciaPago frecuenciaPago, long porPagar, PagoVendedor.Estado ultimoPago, long baseHoy,
                              long entregaPendiente, EntregaVendedor.Estado ultimaEntrega,
                              /** Cuántos se propuso vender hoy (null = no ha escogido). */
                              Integer metaHoy) {
    }

    /**
     * Lo que lleva ganado un trabajador hoy: comisión, premio del escalón alcanzado y el próximo por alcanzar.
     * `gratis` son los granizados que puede tomarse sin pagar.
     */
    public record PremiosDia(int vendidas, long comision, long premio, List<Escalones.Escalon> escalones,
                             Escalones.Escalon siguiente, int gratis, boolean diaPromo,
                             /** Los que se ha tomado hoy y lo que se le descuenta por los que pasaron de los gratis. */
                             int consumidos, long descuento,
                             /** Lo que se le descuenta hoy por granizados que faltaron en su carga (lo anota el dueño). */
                             long faltantes,
                             /** Cuánto gana por cada granizado, normal y en promo, para que lo vea en Vender y en Mi día. */
                             TarifasDia tarifas,
                             /** Cuántos se propuso vender hoy (null = todavía no escoge). */
                             Integer metaPropia) {
    }

    /**
     * Lo que gana el trabajador por granizado. `porcentaje` solo si no hay tarifas por granizado (gana su % de lo
     * vendido). `promo` es lo que gana por cada uno vendido en promo y `rebajaPromo` lo que bajan los premios ese día.
     */
    public record TarifasDia(long normal, long cremoso, long grande, long cerveza, long promo, long rebajaPromo, Integer porcentaje) {
    }

    /**
     * Lo que dicen las ventas de las últimas semanas para armar premios que le convengan a los dos: cuánto vende un
     * trabajador en un día normal (`base`, la mediana), su mejor día y cuánto te deja cada granizado ya pagada la
     * comisión (normal y en promo). Con eso el celular calcula qué parte de lo extra se lleva el trabajador en cada premio.
     */
    public record DatosPremios(int base, int diasAnalizados, int mejorDia, long margenNormal, Long margenPromo,
                               boolean pocosDatos, boolean faltanCostos, boolean sinTarifas) {
    }

    /** Cuántos días atrás se miran las ventas para los premios sugeridos. */
    static final int DIAS_ANALISIS = 28;
    /** Con menos días trabajados que esto, la base es una estimación. */
    static final int MIN_DIAS_ANALISIS = 5;

    public record SeccionTerminos(String titulo, List<String> lineas) {
    }

    /** Los términos vigentes. `aceptadaEn` es null si este trabajador todavía no aceptó esta versión. */
    public record Terminos(String version, String titulo, List<SeccionTerminos> secciones, Instant aceptadaEn,
                           FrecuenciaPago frecuenciaPago) {
    }

    /**
     * Cuentas de un trabajador en un rango de días. `saldo` = efectivo − comisión − bonos por meta + consumos: si es
     * positivo el trabajador le debe esa plata al dueño; si es negativo, el dueño le debe a él.
     * `consumidos` son los granizados que se tomó él (no cuentan como vendidos) y `consumos` lo que se le descuenta
     * por los que pasaron de los gratis del día.
     */
    public record Liquidacion(Long vendedorId, String nombre, int comisionPct, int unidades, long total, long efectivo,
                              long nequi, long comision, int diasMeta, long bonos, long saldo, int consumidos, long consumos,
                              /** Granizados de su carga que faltaron al cuadrar y lo que se le descuenta (al precio de venta). */
                              int unidadesFaltantes, long faltantes,
                              /** Días del rango en que vendió algo. */
                              int dias) {

        /** Lo que hay que pagarle por este rango: lo que ganó menos lo que se tomó y lo que faltó. Negativo = él debe. */
        public long porPagar() {
            return comision + bonos - consumos - faltantes;
        }
    }

    /** La meta del día de un trabajador: cuánto lleva, cuánto gana si la cumple y cuántos días seguidos la viene cumpliendo. */
    public record MetaEquipo(int unidades, long premio, int vendidas, int racha) {
    }

    /** Lo que ve el trabajador al cerrar su turno: lo que debe entregar y lo que devuelve. */
    public record CierreTurno(int unidades, long total, long efectivo, long nequi, long comision, long bonos, long base, long entregar,
                              List<FilaCarga> devuelve,
                              /** Los que se tomó hoy y lo que se le descuenta por ellos (ya está sumado en `entregar`). */
                              int consumidos, long consumos,
                              /** Lo que se le descuenta por granizados que faltaron (también va sumado en `entregar`). */
                              long faltantes) {
    }

    /** Cuando a un trabajador le quedan este número de granizados (o menos) de un sabor, el dueño recibe un aviso. */
    public static final int POCOS = 2;

    /** Cuántos días atrás se mira la racha. */
    static final int DIAS_RACHA = 30;

    private final VendedorRepository vendedores;
    private final CargaVendedorRepository cargas;
    private final ProductoRepository productos;
    private final VentaRepository ventas;
    private final AjustesService ajustes;
    private final AppProperties props;
    private final Clock clock;
    private final ApplicationEventPublisher eventos;
    private final AceptacionTerminosRepository aceptaciones;
    private final PagoVendedorRepository pagos;
    private final BaseVendedorRepository bases;
    private final EntregaVendedorRepository entregas;
    private final PrestamoVendedorRepository prestamos;
    private final MetaVendedorRepository metas;
    private final ZoneId zona;
    private final BCryptPasswordEncoder hash = new BCryptPasswordEncoder();

    public EquipoService(VendedorRepository vendedores, CargaVendedorRepository cargas, ProductoRepository productos,
                         VentaRepository ventas, AjustesService ajustes, AppProperties props, Clock clock,
                         ApplicationEventPublisher eventos, AceptacionTerminosRepository aceptaciones,
                         PagoVendedorRepository pagos, BaseVendedorRepository bases,
                         EntregaVendedorRepository entregas, PrestamoVendedorRepository prestamos, MetaVendedorRepository metas) {
        this.metas = metas;
        this.entregas = entregas;
        this.prestamos = prestamos;
        this.pagos = pagos;
        this.bases = bases;
        this.vendedores = vendedores;
        this.cargas = cargas;
        this.productos = productos;
        this.ventas = ventas;
        this.ajustes = ajustes;
        this.props = props;
        this.clock = clock;
        this.eventos = eventos;
        this.aceptaciones = aceptaciones;
        this.zona = props.zoneId();
    }

    public LocalDate hoy() {
        return LocalDate.now(clock.withZone(zona));
    }

    // ------------------------------------------------------------------ cuentas

    /** El trabajador activo con ese PIN, si hay uno. */
    @Transactional(readOnly = true)
    public Optional<Vendedor> entrar(String pin) {
        for (Vendedor v : vendedores.findByActivoTrue()) {
            if (hash.matches(pin, v.getPinHash())) return Optional.of(v);
        }
        return Optional.empty();
    }

    @Transactional(readOnly = true)
    public boolean estaActivo(Long vendedorId) {
        return vendedores.findById(vendedorId).map(Vendedor::isActivo).orElse(false);
    }

    @Transactional
    public VendedorDto crear(NuevoVendedor n) {
        verificarPinLibre(n.pin(), null);
        Vendedor v = vendedores.save(new Vendedor(n.nombre().trim(), hash.encode(n.pin()), n.comisionPct(), clock.instant()));
        return dto(v, List.of(), List.of());
    }

    @Transactional
    public VendedorDto cambiar(Long id, CambioVendedor c) {
        Vendedor v = vendedores.findById(id).orElseThrow(() -> new NoEncontradoException("Trabajador no encontrado: " + id));
        String nuevoHash = null;
        if (c.pin() != null) {
            verificarPinLibre(c.pin(), id);
            nuevoHash = hash.encode(c.pin());
        }
        v.cambiar(c.nombre(), nuevoHash, c.comisionPct(), c.activo());
        return dto(vendedores.save(v), List.of(), List.of());
    }

    /** Dos personas no pueden tener el mismo PIN (ni el del dueño): el PIN es lo único que dice quién entra. */
    private void verificarPinLibre(String pin, Long ignorar) {
        if (MessageDigest.isEqual(pin.getBytes(StandardCharsets.UTF_8), props.pin().getBytes(StandardCharsets.UTF_8))) {
            throw new IllegalArgumentException("Ese PIN ya se usa, escoge otro");
        }
        for (Vendedor v : vendedores.findAll()) {
            if (!v.getId().equals(ignorar) && hash.matches(pin, v.getPinHash())) {
                throw new IllegalArgumentException("Ese PIN ya se usa, escoge otro");
            }
        }
    }

    // ------------------------------------------------------------------ carga

    /** Reemplaza lo que el trabajador sacó hoy. Un sabor ya cargado conserva su hora de entrega, así editar no borra lo vendido. */
    @Transactional
    public List<FilaCarga> cargar(Long vendedorId, Carga carga) {
        Vendedor v = vendedores.findById(vendedorId).orElseThrow(() -> new NoEncontradoException("Trabajador no encontrado: " + vendedorId));
        LocalDate dia = hoy();
        Instant ahora = clock.instant();
        Map<Long, CargaVendedor> actuales = new HashMap<>();
        for (CargaVendedor c : cargas.findByVendedorIdAndDia(v.getId(), dia)) actuales.put(c.getProductoId(), c);

        Map<Long, Integer> pedido = new LinkedHashMap<>();
        for (ItemCarga i : carga.items()) {
            if (i.llevo() > 0) pedido.merge(i.productoId(), i.llevo(), Integer::sum);
        }
        for (Long productoId : pedido.keySet()) {
            if (!productos.existsById(productoId)) throw new NoEncontradoException("Producto no encontrado: " + productoId);
        }
        for (CargaVendedor c : actuales.values()) {
            if (!pedido.containsKey(c.getProductoId())) cargas.delete(c);
        }
        pedido.forEach((productoId, llevo) -> {
            CargaVendedor c = actuales.get(productoId);
            if (c == null) cargas.save(new CargaVendedor(v.getId(), productoId, dia, llevo, ahora));
            else {
                c.llevo(llevo);
                cargas.save(c);
            }
        });
        cargas.flush();
        return filasDe(v.getId(), dia, ventasDelDia(dia));
    }

    private List<Venta> ventasDelDia(LocalDate dia) {
        return ventas.entre(dia.atStartOfDay(zona).toInstant(), dia.plusDays(1).atStartOfDay(zona).toInstant());
    }

    /** Lo que le queda a un trabajador por producto: lo que sacó menos lo que vendió desde que se lo entregaron. */
    private List<FilaCarga> filasDe(Long vendedorId, LocalDate dia, List<Venta> delDia) {
        List<FilaCarga> filas = new ArrayList<>();
        for (CargaVendedor c : cargas.findByVendedorIdAndDia(vendedorId, dia)) {
            int vendi = 0;
            for (Venta v : delDia) {
                if (v.getProducto().getId().equals(c.getProductoId()) && vendedorId.equals(v.getVendedorId())
                        && !v.getCreadaEn().isBefore(c.getDesde())) {
                    vendi += v.getCantidad();
                }
            }
            String nombre = productos.findById(c.getProductoId()).map(Producto::nombre).orElse("?");
            filas.add(new FilaCarga(c.getProductoId(), nombre, c.getLlevo(), vendi, Math.max(0, c.getLlevo() - vendi)));
        }
        filas.sort((a, b) -> a.nombre().compareToIgnoreCase(b.nombre()));
        return filas;
    }

    /** Lo que le queda a ese trabajador hoy, por id de producto. Sin carga armada, no le queda nada. */
    @Transactional(readOnly = true)
    public Map<Long, Integer> queda(Long vendedorId, LocalDate dia, List<Venta> delDia) {
        Map<Long, Integer> queda = new HashMap<>();
        for (FilaCarga f : filasDe(vendedorId, dia, delDia)) queda.put(f.productoId(), f.queda());
        return queda;
    }

    /**
     * Avisa al dueño si esta venta dejó al trabajador con pocos de ese sabor (solo al cruzar el límite, no en cada venta).
     * Se llama después de guardar la venta, así `queda` ya la descuenta.
     */
    @Transactional(readOnly = true)
    public void revisarPocos(Long vendedorId, Long productoId, String sabor, int vendidos) {
        LocalDate dia = hoy();
        int despues = queda(vendedorId, dia, ventasDelDia(dia)).getOrDefault(productoId, 0);
        int antes = despues + vendidos;
        if (antes <= POCOS || despues > POCOS) return;
        String quien = vendedores.findById(vendedorId).map(Vendedor::getNombre).orElse("Un trabajador");
        eventos.publishEvent(new AvisoEquipo(TenantContext.actual(), "📦 A " + quien + " le quedan pocos",
                "A " + quien + " le " + (despues == 1 ? "queda 1" : "quedan " + despues) + " de " + sabor
                        + (despues == 0 ? " (se le acabó)" : "") + ". Llévale más si lo necesita."));
    }

    /** El trabajador termina su día: cuánto entrega y qué devuelve. El dueño recibe el resumen por Telegram. */
    @Transactional
    public CierreTurno cerrarTurno(Long vendedorId) {
        Vendedor v = vendedores.findById(vendedorId).orElseThrow(() -> new NoEncontradoException("Trabajador no encontrado: " + vendedorId));
        LocalDate dia = hoy();
        List<Venta> delDia = ventasDelDia(dia);
        int unidades = 0;
        int consumidos = 0;
        long total = 0, efectivo = 0, nequi = 0, comision = 0, consumos = 0, faltantes = 0;
        for (Venta x : delDia) {
            if (!vendedorId.equals(x.getVendedorId())) continue;
            if (x.esFaltante()) { // faltó en su carga: se le descuenta al precio de venta
                faltantes += x.getCargoVendedor();
                continue;
            }
            if (x.esConsumo()) { // se lo tomó él: no es una venta, y lo que no era gratis se le descuenta
                consumidos += x.getCantidad();
                consumos += x.getCargoVendedor();
                continue;
            }
            unidades += x.getCantidad();
            total += x.getTotal();
            efectivo += x.efectivo();
            nequi += x.nequi();
            comision += comisionDe(x, v);
        }
        int meta = AjustesService.entero(ajustes.mapa(), "META_EQUIPO", 0);
        long premio = AjustesService.entero(ajustes.mapa(), "PREMIO_EQUIPO", 0);
        boolean diaPromo = delDia.stream().anyMatch(x -> vendedorId.equals(x.getVendedorId()) && x.isEnPromo())
                || PromoCalendario.vigente(ajustes.mapa().get("PROMO"), dia);
        long bonos = (meta > 0 && unidades >= meta ? premio : 0)
                + Escalones.premioDe(escalonesDelDia(ajustes.mapa(), diaPromo), unidades);
        long base = baseDeHoy(vendedorId);
        long entregar = efectivo + base - comision - bonos + consumos + faltantes;
        List<FilaCarga> devuelve = filasDe(vendedorId, dia, delDia).stream().filter(f -> f.queda() > 0).toList();

        StringBuilder t = new StringBuilder(v.getNombre() + " cerró su día: " + unidades + " vendidos, " + Pesos.formato(total)
                + "\n• Efectivo: " + Pesos.formato(efectivo) + "\n• Nequi: " + Pesos.formato(nequi));
        if (base > 0) t.append("\n\u2022 Base para vueltos que le pasaste: ").append(Pesos.formato(base));
        if (comision > 0) t.append("\n• Su comisión: ").append(Pesos.formato(comision));
        if (bonos > 0) t.append("\n• Premios del día: ").append(Pesos.formato(bonos));
        if (consumidos > 0) t.append("\n• Se tomó ").append(consumidos)
                .append(consumos > 0 ? ": se le descuentan " + Pesos.formato(consumos) : " (gratis del día)");
        if (faltantes > 0) t.append("\n• Faltantes de su carga: ").append(Pesos.formato(faltantes));
        t.append(entregar >= 0 ? "\nTe entrega " + Pesos.formato(entregar) : "\nTú le debes " + Pesos.formato(-entregar));
        if (devuelve.isEmpty()) t.append("\nNo devuelve nada.");
        else t.append("\nDevuelve: ").append(String.join(", ", devuelve.stream().map(f -> f.queda() + " " + f.nombre()).toList()));
        eventos.publishEvent(new AvisoEquipo(TenantContext.actual(), "🧾 " + v.getNombre() + " cerró su día", t.toString()));
        return new CierreTurno(unidades, total, efectivo, nequi, comision, bonos, base, entregar, devuelve, consumidos, consumos,
                faltantes);
    }

    /**
     * Lo que gana el trabajador por una venta: la tarifa por granizado que quedó congelada al vender o, en las ventas
     * de antes (o de un negocio sin tarifas), su porcentaje del total.
     */
    private static long comisionDe(Venta venta, Vendedor vendedor) {
        Long porUnidad = venta.getComisionUnitaria();
        if (porUnidad != null) return porUnidad * venta.getCantidad();
        return venta.getTotal() * vendedor.getComisionPct() / 100;
    }

    /**
     * Tarifa por granizado de ese tipo, en pesos. null si el dueño no puso ninguna (todas en 0): entonces el
     * trabajador sigue ganando su porcentaje. Se congela en cada venta, así cambiarla no reescribe lo ya pagado.
     */
    @Transactional(readOnly = true)
    public Long comisionPorGranizado(TipoProducto tipo, boolean promo) {
        return tarifaDe(ajustes.mapa(), tipo, promo);
    }

    /** La tarifa por granizado con unos ajustes ya leídos (null = sin tarifas: gana su porcentaje). */
    static Long tarifaDe(Map<String, String> cfg, TipoProducto tipo, boolean promo) {
        long normal = AjustesService.entero(cfg, "COMISION_NORMAL", 0);
        long cremoso = AjustesService.entero(cfg, "COMISION_CREMOSO", 0);
        long grande = AjustesService.entero(cfg, "COMISION_GRANDE", 0);
        long cerveza = AjustesService.entero(cfg, "COMISION_CERVEZA", 0);
        if (normal + cremoso + grande + cerveza == 0) return null;
        long base = switch (tipo) {
            case NORMAL -> normal;
            case CREMOSO -> cremoso;
            case GRANDE -> grande;
            case CERVEZA -> cerveza;
        };
        // En promoción el margen es menor: gana la tarifa de promo si el dueño la puso
        long enPromo = AjustesService.entero(cfg, "COMISION_PROMO", 0);
        return promo && enPromo > 0 ? enPromo : base;
    }

    // ------------------------------------------------------------------ vistas del dueño

    @Transactional(readOnly = true)
    public List<VendedorDto> listar() {
        LocalDate dia = hoy();
        List<Venta> delDia = ventasDelDia(dia);
        List<VendedorDto> lista = new ArrayList<>();
        for (Vendedor v : vendedores.findAllByOrderByNombreAscIdAsc()) {
            List<Venta> mias = delDia.stream().filter(x -> v.getId().equals(x.getVendedorId())).toList();
            lista.add(dto(v, mias, filasDe(v.getId(), dia, delDia)));
        }
        return lista;
    }

    /** Cuentas de cada trabajador entre dos días (ambos incluidos). */
    @Transactional(readOnly = true)
    public List<Liquidacion> liquidar(LocalDate desde, LocalDate hasta) {
        if (hasta.isBefore(desde)) throw new IllegalArgumentException("El rango está al revés");
        List<Venta> delRango = ventas.entre(desde.atStartOfDay(zona).toInstant(), hasta.plusDays(1).atStartOfDay(zona).toInstant());
        List<Liquidacion> filas = new ArrayList<>();
        for (Vendedor v : vendedores.findAllByOrderByNombreAscIdAsc()) {
            Liquidacion l = liquidacionDe(v, delRango);
            if (!v.isActivo() && l.unidades() == 0) continue;
            filas.add(l);
        }
        return filas;
    }

    /** Las cuentas de un trabajador con las ventas dadas (ya filtradas por el rango; acá se escogen las suyas). */
    private Liquidacion liquidacionDe(Vendedor v, List<Venta> delRango) {
        Map<String, String> cfg = ajustes.mapa();
        int meta = AjustesService.entero(cfg, "META_EQUIPO", 0);
        long premio = AjustesService.entero(cfg, "PREMIO_EQUIPO", 0);
        List<Escalones.Escalon> escalones = Escalones.leer(cfg.get("PREMIOS_ESCALONES"));
        List<Escalones.Escalon> rebajados = escalonesDelDia(cfg, true);
        LocalDate hoy = hoy();
        boolean promoHoy = PromoCalendario.vigente(cfg.get("PROMO"), hoy);
        long total = 0, efectivo = 0, nequi = 0, comision = 0, consumos = 0, faltantes = 0;
        int unidades = 0, consumidos = 0, unidadesFaltantes = 0;
        Set<LocalDate> diasConVenta = new HashSet<>();
        for (Venta x : delRango) {
            if (!v.getId().equals(x.getVendedorId())) continue;
            if (x.esFaltante()) {
                unidadesFaltantes += x.getCantidad();
                faltantes += x.getCargoVendedor();
                continue;
            }
            if (x.esConsumo()) {
                consumidos += x.getCantidad();
                consumos += x.getCargoVendedor();
                continue;
            }
            unidades += x.getCantidad();
            total += x.getTotal();
            efectivo += x.efectivo();
            nequi += x.nequi();
            comision += comisionDe(x, v);
            diasConVenta.add(x.getCreadaEn().atZone(zona).toLocalDate());
        }
        // Un premio por cada día del rango en que cumplió la meta, más el del escalón que alcanzó cada día
        int diasMeta = 0;
        long premiosEscalon = 0;
        if (meta > 0 || !escalones.isEmpty()) {
            Map<LocalDate, Integer> porDia = new HashMap<>();
            Set<LocalDate> diasPromo = new HashSet<>();
            for (Venta x : delRango) {
                if (!v.getId().equals(x.getVendedorId()) || x.esDelTrabajador()) continue; // lo que se toma él o lo que faltó no suma para premios
                LocalDate d = x.getCreadaEn().atZone(zona).toLocalDate();
                porDia.merge(d, x.getCantidad(), Integer::sum);
                if (x.isEnPromo()) diasPromo.add(d);
            }
            for (Map.Entry<LocalDate, Integer> e : porDia.entrySet()) {
                if (meta > 0 && e.getValue() >= meta) diasMeta++;
                boolean promo = diasPromo.contains(e.getKey()) || (promoHoy && e.getKey().equals(hoy));
                premiosEscalon += Escalones.premioDe(promo ? rebajados : escalones, e.getValue());
            }
        }
        long bonos = diasMeta * premio + premiosEscalon;
        return new Liquidacion(v.getId(), v.getNombre(), v.getComisionPct(), unidades, total, efectivo, nequi,
                comision, diasMeta, bonos, efectivo - comision - bonos + consumos + faltantes, consumidos, consumos,
                unidadesFaltantes, faltantes, diasConVenta.size());
    }

    // ------------------------------------------------------------------ pagos al trabajador

    private static final Instant SIEMPRE = Instant.parse("2000-01-01T00:00:00Z");
    private static final DateTimeFormatter FECHA_LARGA =
            DateTimeFormatter.ofPattern("d 'de' MMMM 'de' yyyy, h:mm a", Locale.forLanguageTag("es-CO"));

    private Vendedor vendedor(Long id) {
        return vendedores.findById(id).orElseThrow(() -> new NoEncontradoException("Trabajador no encontrado: " + id));
    }

    /** Desde dónde cuentan las cuentas de un trabajador: el corte de su último pago que sigue en pie. */
    private Instant corteDe(Long vendedorId) {
        return pagos.findFirstByVendedorIdAndEstadoNotOrderByHastaDesc(vendedorId, PagoVendedor.Estado.ANULADO)
                .map(PagoVendedor::getHasta).orElse(null);
    }

    private Liquidacion pendienteDe(Vendedor v, Instant ahora) {
        Instant corte = corteDe(v.getId());
        return liquidacionDe(v, ventas.entre(corte != null ? corte.plusNanos(1) : SIEMPRE, ahora.plusSeconds(1)));
    }

    /** Lo que quedó debiéndole el dueño en su último pago en pie (un abono: le dio menos y el resto lo paga después). */
    private long saldoAnteriorDe(Long vendedorId) {
        return pagos.findFirstByVendedorIdAndEstadoNotOrderByHastaDesc(vendedorId, PagoVendedor.Estado.ANULADO)
                .map(PagoVendedor::getSaldo).orElse(0L);
    }

    /**
     * Lo que se le debe pagar hoy a ese trabajador: comisiones y premios desde su último pago, menos lo que se tomó,
     * más lo que quedó pendiente de ese pago.
     */
    private long porPagarDe(Vendedor v) {
        Liquidacion l = pendienteDe(v, clock.instant());
        return l.porPagar() + saldoAnteriorDe(v.getId()) - prestadoSinDescontar(v.getId());
    }

    /** Lo que se le ha prestado y todavía no se le descuenta. */
    private long prestadoSinDescontar(Long vendedorId) {
        return prestamos.findByVendedorIdAndPagoIdIsNullOrderByCreadoEnAscIdAsc(vendedorId).stream()
                .mapToLong(PrestamoVendedor::getMonto).sum();
    }

    /**
     * Un pago, tal cual lo ven el dueño y el trabajador. `montoEfectivo` es la parte de `monto` que fue en efectivo
     * (el resto, Nequi) y `saldo` lo que quedó pendiente después de este pago.
     */
    public record PagoDto(Long id, Long vendedorId, String nombre, PagoVendedor.Metodo metodo, PagoVendedor.Estado estado,
                          long monto, long comision, long bonos, int unidades, long totalVendido, long efectivo,
                          Instant desde, Instant hasta, Instant creadoEn, Instant respondidoEn, String texto, String firma,
                          long montoEfectivo, long saldo,
                          /** Lo que se le descontó en este pago por los granizados que se tomó. */
                          long consumos,
                          /** Lo que se le descontó por préstamos y por faltantes de su carga. */
                          long prestamos, long faltantes,
                          /** De dónde salió el efectivo (null en los pagos de antes, que no movían Mi plata). */
                          LugarPlata lugarEfectivo) {
    }

    /** Un préstamo (adelanto). `pagoId` null = todavía no se le descuenta. */
    public record PrestamoDto(Long id, Long vendedorId, long monto, LugarPlata lugar, String nota, Instant creadoEn, Long pagoId) {
    }

    public record NuevoPrestamo(@NotNull @Min(1) @Max(10_000_000) Long monto, @NotNull LugarPlata lugar,
                                @Size(max = 120) String nota) {
    }

    /** Granizados de la carga que no aparecieron al cuadrar: se le cobran al precio de venta. */
    public record NuevoFaltante(@NotNull Long productoId, @Min(1) @Max(99) int cantidad) {
    }

    /**
     * Lo que se le debe a un trabajador desde su último pago, y sus pagos más recientes. `saldoAnterior` es lo que
     * quedó pendiente de ese último pago: se le debe además de la comisión y los premios de `pendiente`.
     */
    public record Cuenta(Instant desde, Liquidacion pendiente, List<PagoDto> pagos, long saldoAnterior,
                         /** Préstamos que se le descuentan en el próximo pago. */
                         List<PrestamoDto> prestamos) {
    }

    /**
     * `montoEfectivo` solo con MIXTO: la parte en efectivo (el resto, por Nequi). `quedaDebiendo`: si le da menos de
     * lo que le toca, el resto queda pendiente para después (si no, las cuentas arrancan de cero igual).
     */
    public record NuevoPago(@NotNull PagoVendedor.Metodo metodo, @Min(1) Long monto, @Min(0) Long montoEfectivo,
                            Boolean quedaDebiendo,
                            /** De dónde sale el efectivo: caja (por defecto) o casa. Lo de Nequi sale de Nequi. */
                            LugarPlata lugarEfectivo) {
    }

    public record RespuestaPago(boolean recibido, @Size(max = 80) String firma) {
    }

    private PagoDto pagoDto(PagoVendedor p, String nombre) {
        return new PagoDto(p.getId(), p.getVendedorId(), nombre, p.getMetodo(), p.getEstado(), p.getMonto(), p.getComision(),
                p.getBonos(), p.getUnidades(), p.getTotalVendido(), p.getEfectivo(), p.getDesde(), p.getHasta(),
                p.getCreadoEn(), p.getRespondidoEn(), p.getTexto(), p.getFirma(), p.getMontoEfectivo(), p.getSaldo(), p.getConsumos(),
                p.getPrestamos(), p.getFaltantes(), p.isMuevePlata() ? p.getLugarEfectivo() : null);
    }

    private static PrestamoDto prestamoDto(PrestamoVendedor p) {
        return new PrestamoDto(p.getId(), p.getVendedorId(), p.getMonto(), p.getLugar(), p.getNota(), p.getCreadoEn(), p.getPagoId());
    }

    @Transactional(readOnly = true)
    public Cuenta cuenta(Long vendedorId) {
        Vendedor v = vendedor(vendedorId);
        return new Cuenta(corteDe(vendedorId), pendienteDe(v, clock.instant()),
                pagos.findTop10ByVendedorIdOrderByCreadoEnDescIdDesc(vendedorId).stream().map(p -> pagoDto(p, v.getNombre())).toList(),
                saldoAnteriorDe(vendedorId), prestamosPendientes(vendedorId));
    }

    /** Los préstamos de ese trabajador que todavía no se le descuentan (lo ve él en Mi día y el dueño en Equipo). */
    @Transactional(readOnly = true)
    public List<PrestamoDto> prestamosPendientes(Long vendedorId) {
        return prestamos.findByVendedorIdAndPagoIdIsNullOrderByCreadoEnAscIdAsc(vendedorId).stream()
                .map(EquipoService::prestamoDto).toList();
    }

    /** Un solo método, todo lo que se le debe (o `montoPagado`), y las cuentas arrancan de cero. */
    @Transactional
    public PagoDto pagar(Long vendedorId, PagoVendedor.Metodo metodo, Long montoPagado) {
        return pagar(vendedorId, metodo, montoPagado, null, false, null);
    }

    /**
     * El dueño dice "ya le pagué": se guarda el monto y las cuentas del trabajador vuelven a empezar desde este momento.
     * El trabajador queda con una pregunta pendiente: ¿te pagaron?
     * Con MIXTO, `montoEfectivo` es la parte en efectivo y el resto fue por Nequi. Si le dio menos de lo que le toca y
     * `quedaDebiendo`, lo que falta queda como saldo y se suma a lo que se le deba la próxima vez.
     */
    @Transactional
    public PagoDto pagar(Long vendedorId, PagoVendedor.Metodo metodo, Long montoPagado, Long montoEfectivo, boolean quedaDebiendo,
                         LugarPlata lugarEfectivo) {
        Vendedor v = vendedor(vendedorId);
        Instant ahora = clock.instant();
        Instant corte = corteDe(vendedorId);
        long saldoAnterior = saldoAnteriorDe(vendedorId);
        Liquidacion l = liquidacionDe(v, ventas.entre(corte != null ? corte.plusNanos(1) : SIEMPRE, ahora.plusSeconds(1)));
        List<PrestamoVendedor> prestados = prestamos.findByVendedorIdAndPagoIdIsNullOrderByCreadoEnAscIdAsc(vendedorId);
        long prestado = prestados.stream().mapToLong(PrestamoVendedor::getMonto).sum();
        long debido = l.porPagar() + saldoAnterior - prestado;
        long monto = montoPagado != null ? montoPagado : debido;
        if (monto <= 0) {
            throw new IllegalArgumentException(debido < 0
                    ? "Con lo que le prestaste y lo que se descuenta, no hay nada por pagarle: te debe " + Pesos.formato(-debido)
                    : "No hay comisiones por pagarle");
        }
        LugarPlata lugar = lugarEfectivo == LugarPlata.CASA ? LugarPlata.CASA : LugarPlata.CAJA;
        long enEfectivo = switch (metodo) {
            case EFECTIVO -> monto;
            case NEQUI -> 0;
            case MIXTO -> {
                if (montoEfectivo == null || montoEfectivo <= 0 || montoEfectivo >= monto) {
                    throw new IllegalArgumentException("Escribe cuánto le diste en efectivo: tiene que ser menos que el total");
                }
                yield montoEfectivo;
            }
        };
        long saldo = quedaDebiendo ? Math.max(0, debido - monto) : 0;
        String texto = enEfectivo > 0 ? pazYSalvo(v, l, monto, enEfectivo, saldoAnterior, saldo, prestado, corte, ahora) : null;
        PagoVendedor p = pagos.save(new PagoVendedor(vendedorId, metodo, monto, enEfectivo, saldo, l.comision(), l.bonos(),
                l.unidades(), l.total(), l.efectivo(), corte, ahora, ahora, texto)
                .conConsumos(l.consumos()).conDescuentos(prestado, l.faltantes()).saleDe(lugar));
        // Lo prestado ya quedó descontado en este pago
        for (PrestamoVendedor x : prestados) x.descontadoEn(p.getId());
        prestamos.saveAll(prestados);
        return pagoDto(p, v.getNombre());
    }

    private String pazYSalvo(Vendedor v, Liquidacion l, long monto, long enEfectivo, long saldoAnterior, long saldo,
                             long prestado, Instant desde, Instant hasta) {
        String periodo = desde == null ? "hasta el " + FECHA_LARGA.format(hasta.atZone(zona))
                : "entre el " + FECHA_LARGA.format(desde.atZone(zona)) + " y el " + FECHA_LARGA.format(hasta.atZone(zona));
        String como = enEfectivo == monto ? "recibí en efectivo del negocio la suma de " + Pesos.formato(monto)
                : "recibí del negocio la suma de " + Pesos.formato(monto) + " (" + Pesos.formato(enEfectivo) + " en efectivo y "
                        + Pesos.formato(monto - enEfectivo) + " por Nequi)";
        String cierre = saldo > 0
                ? "Este pago es un abono: queda pendiente un saldo de " + Pesos.formato(saldo) + " a mi favor por esos conceptos, "
                        + "que el negocio me paga después.\n"
                : "Con este pago quedo a paz y salvo con el negocio por esos conceptos y por ese período: no se me debe "
                        + "nada más por ese trabajo.\n";
        return "PAZ Y SALVO\n"
                + "Yo, " + v.getNombre() + ", declaro que " + como
                + " por concepto de comisiones" + (l.bonos() > 0 ? " y premios" : "") + " de " + l.unidades()
                + " granizados vendidos " + periodo
                + (saldoAnterior > 0 ? ", más " + Pesos.formato(saldoAnterior) + " que venían pendientes de un pago anterior" : "")
                + (l.consumos() > 0 ? ", ya descontados " + Pesos.formato(l.consumos()) + " de los granizados que consumí" : "")
                + (l.faltantes() > 0 ? ", " + Pesos.formato(l.faltantes()) + " de " + l.unidadesFaltantes()
                        + " granizados que faltaron en mi carga (al precio de venta)" : "")
                + (prestado > 0 ? " y " + Pesos.formato(prestado) + " que el negocio me prestó" : "") + ".\n"
                + cierre
                + "Firmo escribiendo mi nombre en la aplicación, y acepto que esta firma y la hora en que la hice quedan guardadas como constancia.";
    }

    private static String comoSePago(PagoVendedor p) {
        return switch (p.getMetodo()) {
            case EFECTIVO -> "efectivo, firmó el paz y salvo";
            case NEQUI -> "Nequi";
            case MIXTO -> Pesos.formato(p.getMontoEfectivo()) + " en efectivo y " + Pesos.formato(p.getMonto() - p.getMontoEfectivo())
                    + " por Nequi, firmó el paz y salvo";
        };
    }

    @Transactional(readOnly = true)
    public List<PagoDto> misPagos(Long vendedorId) {
        Vendedor v = vendedor(vendedorId);
        return pagos.findTop10ByVendedorIdOrderByCreadoEnDescIdDesc(vendedorId).stream()
                .filter(p -> p.getEstado() != PagoVendedor.Estado.ANULADO).map(p -> pagoDto(p, v.getNombre())).toList();
    }

    /** El trabajador responde si le pagaron. En efectivo, confirmar exige firmar el paz y salvo con su nombre. */
    @Transactional
    public PagoDto responderPago(Long vendedorId, Long pagoId, boolean recibido, String firma) {
        Vendedor v = vendedor(vendedorId);
        PagoVendedor p = pagos.findById(pagoId).filter(x -> x.getVendedorId().equals(vendedorId))
                .orElseThrow(() -> new NoEncontradoException("Pago no encontrado: " + pagoId));
        if (p.getEstado() != PagoVendedor.Estado.PENDIENTE) throw new IllegalArgumentException("Ese pago ya lo respondiste");
        String nombreFirma = firma == null ? "" : firma.trim();
        boolean firmaPazYSalvo = p.getMetodo() != PagoVendedor.Metodo.NEQUI; // recibió efectivo (todo o una parte)
        if (recibido && firmaPazYSalvo && nombreFirma.length() < 3) {
            throw new IllegalArgumentException("Para firmar el paz y salvo escribe tu nombre");
        }
        p.responder(recibido ? PagoVendedor.Estado.CONFIRMADO : PagoVendedor.Estado.DISPUTADO,
                recibido && firmaPazYSalvo ? nombreFirma : null, clock.instant());
        pagos.save(p);
        eventos.publishEvent(recibido
                ? new AvisoEquipo(TenantContext.actual(), "✅ " + v.getNombre() + " confirmó su pago",
                        v.getNombre() + " dice que recibió " + Pesos.formato(p.getMonto()) + " (" + comoSePago(p) + ").")
                : new AvisoEquipo(TenantContext.actual(), "⚠️ " + v.getNombre() + " dice que NO le pagaron",
                        v.getNombre() + " respondió que no recibió los " + Pesos.formato(p.getMonto()) + ". Revisa en Equipo."));
        return pagoDto(p, v.getNombre());
    }

    /** El dueño se equivocó o el trabajador dice que no le llegó: se anula y las cuentas vuelven a contar desde el pago anterior. */
    @Transactional
    public PagoDto anularPago(Long pagoId) {
        PagoVendedor p = pagos.findById(pagoId).orElseThrow(() -> new NoEncontradoException("Pago no encontrado: " + pagoId));
        if (p.getEstado() == PagoVendedor.Estado.CONFIRMADO || p.getEstado() == PagoVendedor.Estado.ANULADO) {
            throw new IllegalArgumentException("Ese pago ya está confirmado, no se puede anular");
        }
        p.anular();
        // Lo que se le había descontado de préstamos vuelve a quedar pendiente
        List<PrestamoVendedor> descontados = prestamos.findByPagoId(p.getId());
        for (PrestamoVendedor x : descontados) x.descontadoEn(null);
        prestamos.saveAll(descontados);
        return pagoDto(pagos.save(p), vendedor(p.getVendedorId()).getNombre());
    }

    // ------------------------------------------------------------------ préstamos (adelantos)

    /** El dueño le presta plata: sale de Mi plata y se le descuenta en el próximo «Ya le pagué». */
    @Transactional
    public PrestamoDto prestar(Long vendedorId, NuevoPrestamo n) {
        Vendedor v = vendedor(vendedorId);
        if (!v.isActivo()) throw new IllegalArgumentException("Ese trabajador está desactivado");
        String nota = n.nota() == null || n.nota().isBlank() ? null : n.nota().trim();
        return prestamoDto(prestamos.save(new PrestamoVendedor(vendedorId, n.monto(), n.lugar(), nota, clock.instant())));
    }

    /** Borra un préstamo anotado por error. Solo si todavía no se le descontó. */
    @Transactional
    public void quitarPrestamo(Long prestamoId) {
        PrestamoVendedor p = prestamos.findById(prestamoId)
                .orElseThrow(() -> new NoEncontradoException("Préstamo no encontrado: " + prestamoId));
        if (p.getPagoId() != null) throw new IllegalArgumentException("Ese préstamo ya se le descontó en un pago");
        prestamos.delete(p);
    }

    // ------------------------------------------------------------------ faltantes

    /**
     * Al cuadrar faltaron granizados de su carga y no hay cómo explicarlo: se le descuentan al precio de venta (no al
     * costo), como dicen los términos. Baja el stock de la casa y su carga; el dueño lo puede deshacer como una venta.
     */
    @Transactional
    public FilaCarga anotarFaltante(Long vendedorId, NuevoFaltante n) {
        Vendedor v = vendedor(vendedorId);
        Producto p = productos.findById(n.productoId())
                .orElseThrow(() -> new NoEncontradoException("Producto no encontrado: " + n.productoId()));
        Venta faltante = new Venta("faltante-" + java.util.UUID.randomUUID(), p, n.cantidad(), MetodoPago.FALTANTE, clock.instant())
                .faltante().porVendedor(v.getId());
        faltante.cobrarAlVendedor(p.getPrecio() * n.cantidad());
        ventas.saveAndFlush(faltante);
        productos.sumarStock(p.getId(), -n.cantidad());
        LocalDate dia = hoy();
        return filasDe(v.getId(), dia, ventasDelDia(dia)).stream().filter(f -> f.productoId().equals(p.getId())).findFirst()
                .orElse(new FilaCarga(p.getId(), p.nombre(), 0, n.cantidad(), 0));
    }

    // ------------------------------------------------------------------ historial (Reportes)

    /** Un día de trabajo: lo vendido, lo ganado y lo descontado. */
    public record DiaTrabajado(LocalDate dia, int unidades, long total, long efectivo, long nequi, long comision, long bonos,
                               int consumidos, long consumos, int unidadesFaltantes, long faltantes) {
    }

    /** Todo lo de un trabajador en un rango: totales, día por día, sus pagos y lo que se le prestó. */
    public record Historial(Long vendedorId, String nombre, boolean activo, Liquidacion totales, List<DiaTrabajado> dias,
                            List<PagoDto> pagos, List<PrestamoDto> prestamos) {
    }

    @Transactional(readOnly = true)
    public List<Historial> historial(LocalDate desde, LocalDate hasta) {
        if (hasta.isBefore(desde)) throw new IllegalArgumentException("El rango está al revés");
        Instant inicio = desde.atStartOfDay(zona).toInstant();
        Instant fin = hasta.plusDays(1).atStartOfDay(zona).toInstant();
        List<Venta> delRango = ventas.entre(inicio, fin);
        List<PagoVendedor> pagosRango = pagos.findByCreadoEnGreaterThanEqualAndCreadoEnLessThanOrderByCreadoEnDescIdDesc(inicio, fin);
        List<PrestamoVendedor> prestamosRango = prestamos.findByCreadoEnGreaterThanEqualAndCreadoEnLessThanOrderByCreadoEnDescIdDesc(inicio, fin);
        List<Historial> lista = new ArrayList<>();
        for (Vendedor v : vendedores.findAllByOrderByNombreAscIdAsc()) {
            List<Venta> suyas = delRango.stream().filter(x -> v.getId().equals(x.getVendedorId())).toList();
            List<PagoDto> suyosPagos = pagosRango.stream().filter(p -> p.getVendedorId().equals(v.getId()))
                    .filter(p -> p.getEstado() != PagoVendedor.Estado.ANULADO).map(p -> pagoDto(p, v.getNombre())).toList();
            List<PrestamoDto> suyosPrestamos = prestamosRango.stream().filter(p -> p.getVendedorId().equals(v.getId()))
                    .map(EquipoService::prestamoDto).toList();
            if (suyas.isEmpty() && suyosPagos.isEmpty() && suyosPrestamos.isEmpty()) continue;
            Map<LocalDate, List<Venta>> porDia = new java.util.TreeMap<>(java.util.Comparator.reverseOrder());
            for (Venta x : suyas) porDia.computeIfAbsent(x.getCreadaEn().atZone(zona).toLocalDate(), d -> new ArrayList<>()).add(x);
            List<DiaTrabajado> dias = new ArrayList<>();
            porDia.forEach((dia, ventasDia) -> {
                Liquidacion l = liquidacionDe(v, ventasDia);
                dias.add(new DiaTrabajado(dia, l.unidades(), l.total(), l.efectivo(), l.nequi(), l.comision(), l.bonos(),
                        l.consumidos(), l.consumos(), l.unidadesFaltantes(), l.faltantes()));
            });
            lista.add(new Historial(v.getId(), v.getNombre(), v.isActivo(), liquidacionDe(v, suyas), dias, suyosPagos, suyosPrestamos));
        }
        return lista;
    }

    // ------------------------------------------------------------------ base para vueltos

    public record NuevaBase(@NotNull @Min(1) @Max(10_000_000) Long monto) {
    }

    /** La base que lleva hoy y cada entrega, por si hay que deshacer una. */
    public record BaseDia(long total, List<EntregaBase> entregas) {
    }

    public record EntregaBase(Long id, long monto, Instant creadaEn) {
    }

    private long baseDeHoy(Long vendedorId) {
        return bases.findByVendedorIdAndDiaOrderByCreadaEnAscIdAsc(vendedorId, hoy()).stream().mapToLong(BaseVendedor::getMonto).sum();
    }

    @Transactional(readOnly = true)
    public BaseDia baseDia(Long vendedorId) {
        List<EntregaBase> entregas = bases.findByVendedorIdAndDiaOrderByCreadaEnAscIdAsc(vendedorId, hoy()).stream()
                .map(b -> new EntregaBase(b.getId(), b.getMonto(), b.getCreadaEn())).toList();
        return new BaseDia(entregas.stream().mapToLong(EntregaBase::monto).sum(), entregas);
    }

    /** El dueño le pasa plata de la caja en efectivo para que tenga con qué dar vueltos. Se devuelve al cerrar el día. */
    @Transactional
    public BaseDia pasarBase(Long vendedorId, long monto) {
        Vendedor v = vendedor(vendedorId);
        if (!v.isActivo()) throw new IllegalArgumentException("Ese trabajador está desactivado");
        bases.save(new BaseVendedor(vendedorId, hoy(), monto, clock.instant()));
        return baseDia(vendedorId);
    }

    /** Deshace una entrega de base de hoy (por si te equivocaste de monto). */
    @Transactional
    public BaseDia quitarBase(Long baseId) {
        BaseVendedor b = bases.findById(baseId).orElseThrow(() -> new NoEncontradoException("Entrega no encontrada: " + baseId));
        if (!b.getDia().equals(hoy())) throw new IllegalArgumentException("Solo se deshace la base de hoy");
        bases.delete(b);
        bases.flush();
        return baseDia(b.getVendedorId());
    }

    // ------------------------------------------------------------------ entregas al dueño

    /** Lo que entrega el trabajador, separado por cómo le pagaron: efectivo, Nequi u otra transferencia. */
    public record NuevaEntrega(@Min(0) @Max(10_000_000) long efectivo, @Min(0) @Max(10_000_000) long nequi,
                               @Min(0) @Max(10_000_000) long transferencia) {
    }

    public record RespuestaEntrega(boolean recibida) {
    }

    /** Una entrega, tal cual la ven el trabajador y el dueño. */
    public record EntregaDto(Long id, Long vendedorId, String nombre, long monto, long efectivo, long nequi, long transferencia,
                             EntregaVendedor.Estado estado,
                             Instant creadaEn, Instant respondidaEn) {
    }

    private EntregaDto entregaDto(EntregaVendedor e, String nombre) {
        return new EntregaDto(e.getId(), e.getVendedorId(), nombre, e.getMonto(), e.getEfectivo(), e.getNequi(), e.getTransferencia(), e.getEstado(), e.getCreadaEn(), e.getRespondidaEn());
    }

    /** Las últimas entregas de un trabajador (la lista que ve él y la que ve el dueño). */
    @Transactional(readOnly = true)
    public List<EntregaDto> entregasDe(Long vendedorId) {
        String nombre = vendedor(vendedorId).getNombre();
        return entregas.findTop10ByVendedorIdOrderByCreadaEnDescIdDesc(vendedorId).stream().map(e -> entregaDto(e, nombre)).toList();
    }

    /** El trabajador dice cuánto le entregó al dueño. Queda pendiente hasta que el dueño confirme; le llega un aviso. */
    @Transactional
    public EntregaDto declararEntrega(Long vendedorId, long efectivo, long nequi, long transferencia) {
        Vendedor v = vendedor(vendedorId);
        long monto = efectivo + nequi + transferencia;
        if (efectivo < 0 || nequi < 0 || transferencia < 0 || monto <= 0) throw new IllegalArgumentException("Escribe cuánto entregaste");
        if (!entregas.findByVendedorIdAndEstado(vendedorId, EntregaVendedor.Estado.PENDIENTE).isEmpty()) {
            throw new IllegalArgumentException("Ya tienes una entrega esperando que el dueño la confirme");
        }
        EntregaVendedor e = entregas.save(new EntregaVendedor(vendedorId, hoy(), efectivo, nequi, transferencia, clock.instant()));
        eventos.publishEvent(new AvisoEquipo(TenantContext.actual(), "🤝 " + v.getNombre() + " dice que te entregó plata",
                v.getNombre() + " dice que te entregó " + Pesos.formato(monto) + detalleEntrega(e) + ". Confírmalo en Ajustes → Equipo si es verdad."));
        return entregaDto(e, v.getNombre());
    }

    private static String detalleEntrega(EntregaVendedor e) {
        List<String> partes = new ArrayList<>();
        if (e.getEfectivo() > 0) partes.add(Pesos.formato(e.getEfectivo()) + " en efectivo");
        if (e.getNequi() > 0) partes.add(Pesos.formato(e.getNequi()) + " por Nequi");
        if (e.getTransferencia() > 0) partes.add(Pesos.formato(e.getTransferencia()) + " por otra transferencia");
        return partes.isEmpty() ? "" : " (" + String.join(", ", partes) + ")";
    }

    /** El dueño dice si es verdad que recibió esa plata. Solo se responde una vez. */
    @Transactional
    public EntregaDto responderEntrega(Long entregaId, boolean recibida) {
        EntregaVendedor e = entregas.findById(entregaId).orElseThrow(() -> new NoEncontradoException("Entrega no encontrada: " + entregaId));
        if (e.getEstado() != EntregaVendedor.Estado.PENDIENTE) throw new IllegalArgumentException("Esa entrega ya la respondiste");
        e.responder(recibida, clock.instant());
        return entregaDto(entregas.save(e), vendedor(e.getVendedorId()).getNombre());
    }

    // ------------------------------------------------------------------ carga adicional

    /** Suma más granizados a lo que el trabajador ya sacó hoy. Lo ya vendido sigue contando: cada sabor conserva su hora de entrega. */
    @Transactional
    public List<FilaCarga> agregarCarga(Long vendedorId, Carga carga) {
        Vendedor v = vendedor(vendedorId);
        LocalDate dia = hoy();
        Instant ahora = clock.instant();
        Map<Long, CargaVendedor> actuales = new HashMap<>();
        for (CargaVendedor c : cargas.findByVendedorIdAndDia(v.getId(), dia)) actuales.put(c.getProductoId(), c);
        Map<Long, Integer> suma = new LinkedHashMap<>();
        for (ItemCarga i : carga.items()) {
            if (i.llevo() > 0) suma.merge(i.productoId(), i.llevo(), Integer::sum);
        }
        if (suma.isEmpty()) throw new IllegalArgumentException("Escoge cuántos le agregas");
        for (Long productoId : suma.keySet()) {
            if (!productos.existsById(productoId)) throw new NoEncontradoException("Producto no encontrado: " + productoId);
        }
        suma.forEach((productoId, extra) -> {
            CargaVendedor c = actuales.get(productoId);
            if (c == null) cargas.save(new CargaVendedor(v.getId(), productoId, dia, extra, ahora));
            else {
                c.llevo(Math.min(999, c.getLlevo() + extra));
                cargas.save(c);
            }
        });
        cargas.flush();
        return filasDe(v.getId(), dia, ventasDelDia(dia));
    }

    /** La meta del día de ese trabajador, o null si el dueño la tiene apagada. */
    @Transactional(readOnly = true)
    public MetaEquipo metaDe(Long vendedorId, LocalDate dia) {
        Map<String, String> cfg = ajustes.mapa();
        int meta = AjustesService.entero(cfg, "META_EQUIPO", 0);
        if (meta <= 0) return null;
        long premio = AjustesService.entero(cfg, "PREMIO_EQUIPO", 0);

        Map<LocalDate, Integer> porDia = unidadesPorDia(vendedorId, dia.minusDays(DIAS_RACHA), dia);
        int vendidas = porDia.getOrDefault(dia, 0);
        int racha = vendidas >= meta ? 1 : 0;
        for (LocalDate d = dia.minusDays(1); !d.isBefore(dia.minusDays(DIAS_RACHA)); d = d.minusDays(1)) {
            if (porDia.getOrDefault(d, 0) < meta) break;
            racha++;
        }
        return new MetaEquipo(meta, premio, vendidas, racha);
    }

    private Map<LocalDate, Integer> unidadesPorDia(Long vendedorId, LocalDate desde, LocalDate hasta) {
        Map<LocalDate, Integer> porDia = new HashMap<>();
        for (Venta v : ventas.entre(desde.atStartOfDay(zona).toInstant(), hasta.plusDays(1).atStartOfDay(zona).toInstant())) {
            if (vendedorId.equals(v.getVendedorId()) && !v.esDelTrabajador()) {
                porDia.merge(v.getCreadaEn().atZone(zona).toLocalDate(), v.getCantidad(), Integer::sum);
            }
        }
        return porDia;
    }

    private VendedorDto dto(Vendedor v, List<Venta> mias, List<FilaCarga> carga) {
        return new VendedorDto(v.getId(), v.getNombre(), v.getComisionPct(), v.isActivo(),
                mias.stream().filter(x -> !x.esDelTrabajador()).mapToInt(Venta::getCantidad).sum(),
                mias.stream().mapToLong(Venta::getTotal).sum(), carga,
                terminos(v).aceptadaEn(), v.getFrecuenciaPago(), porPagarDe(v),
                pagos.findTop10ByVendedorIdOrderByCreadoEnDescIdDesc(v.getId()).stream()
                        .map(PagoVendedor::getEstado).filter(e -> e != PagoVendedor.Estado.ANULADO).findFirst().orElse(null),
                baseDeHoy(v.getId()),
                entregas.findByVendedorIdAndEstado(v.getId(), EntregaVendedor.Estado.PENDIENTE).stream().mapToLong(EntregaVendedor::getMonto).sum(),
                entregas.findTop10ByVendedorIdOrderByCreadaEnDescIdDesc(v.getId()).stream()
                        .map(EntregaVendedor::getEstado).findFirst().orElse(null),
                metas.findByVendedorIdAndDia(v.getId(), hoy()).map(MetaVendedor::getMeta).orElse(null));
    }

    // ------------------------------------------------------------------ premios del día y términos

    /** Lo que lleva ganado hoy el trabajador (`mias` son sus ventas del día). */
    @Transactional(readOnly = true)
    public PremiosDia premiosDe(Long vendedorId, List<Venta> mias) {
        Map<String, String> cfg = ajustes.mapa();
        List<Escalones.Escalon> escalones = Escalones.leer(cfg.get("PREMIOS_ESCALONES"));
        int vendidas = mias.stream().filter(x -> !x.esDelTrabajador()).mapToInt(Venta::getCantidad).sum();
        int consumidos = mias.stream().filter(Venta::esConsumo).mapToInt(Venta::getCantidad).sum();
        long descuento = mias.stream().filter(Venta::esConsumo).mapToLong(Venta::getCargoVendedor).sum();
        long faltantes = mias.stream().filter(Venta::esFaltante).mapToLong(Venta::getCargoVendedor).sum();
        long comision = vendedores.findById(vendedorId)
                .map(v -> mias.stream().mapToLong(x -> comisionDe(x, v)).sum()).orElse(0L);
        int gratis = gratisPorDia(cfg);
        // Los días de promoción los premios bajan; el trabajador ve ya los montos de hoy
        boolean diaPromo = mias.stream().anyMatch(Venta::isEnPromo) || PromoCalendario.vigente(cfg.get("PROMO"), hoy());
        List<Escalones.Escalon> deHoy = escalonesDelDia(cfg, diaPromo);
        return new PremiosDia(vendidas, comision, Escalones.premioDe(deHoy, vendidas), deHoy,
                Escalones.siguiente(deHoy, vendidas), gratis, diaPromo, consumidos, descuento, faltantes,
                tarifasDia(cfg, vendedorId), metas.findByVendedorIdAndDia(vendedorId, hoy()).map(MetaVendedor::getMeta).orElse(null));
    }

    private TarifasDia tarifasDia(Map<String, String> cfg, Long vendedorId) {
        Long normal = tarifaDe(cfg, TipoProducto.NORMAL, false);
        long rebaja = AjustesService.entero(cfg, "PREMIO_REBAJA_PROMO", 0);
        if (normal == null) {
            int pct = vendedores.findById(vendedorId).map(Vendedor::getComisionPct).orElse(0);
            return new TarifasDia(0, 0, 0, 0, 0, rebaja, pct);
        }
        return new TarifasDia(normal, tarifaDe(cfg, TipoProducto.CREMOSO, false), tarifaDe(cfg, TipoProducto.GRANDE, false),
                tarifaDe(cfg, TipoProducto.CERVEZA, false), tarifaDe(cfg, TipoProducto.NORMAL, true), rebaja, null);
    }

    // ------------------------------------------------------------------ meta propia y premios que convengan

    /** El trabajador dice cuántos se siente capaz de vender hoy (o la sube cuando la cumple). */
    @Transactional
    public PremiosDia ponerMeta(Long vendedorId, int meta) {
        vendedor(vendedorId); // que sea de este negocio
        if (meta < 1 || meta > 500) throw new IllegalArgumentException("Escoge entre 1 y 500 granizados");
        LocalDate dia = hoy();
        MetaVendedor m = metas.findByVendedorIdAndDia(vendedorId, dia).orElse(null);
        if (m == null) metas.save(new MetaVendedor(vendedorId, dia, meta, clock.instant()));
        else {
            m.cambiar(meta, clock.instant());
            metas.save(m);
        }
        metas.flush();
        List<Venta> mias = ventasDelDia(dia).stream().filter(x -> vendedorId.equals(x.getVendedorId())).toList();
        return premiosDe(vendedorId, mias);
    }

    /** Ver DatosPremios. Mira las ventas de las últimas semanas, sin contar hoy. */
    @Transactional(readOnly = true)
    public DatosPremios datosPremios() {
        Map<String, String> cfg = ajustes.mapa();
        LocalDate hoy = hoy();
        List<Venta> lista = ventas.entre(hoy.minusDays(DIAS_ANALISIS).atStartOfDay(zona).toInstant(), hoy.atStartOfDay(zona).toInstant());
        Map<String, Integer> porTrabajadorDia = new HashMap<>();
        long margenNormal = 0, margenPromo = 0;
        int unidadesNormal = 0, unidadesPromo = 0;
        boolean faltanCostos = false;
        boolean sinTarifas = tarifaDe(cfg, TipoProducto.NORMAL, false) == null;
        for (Venta v : lista) {
            if (v.esDelTrabajador() || v.getMetodo() == MetodoPago.REGALO) continue;
            int n = v.getCantidad();
            if (v.getVendedorId() != null) {
                porTrabajadorDia.merge(v.getVendedorId() + "|" + v.getCreadaEn().atZone(zona).toLocalDate(), n, Integer::sum);
            }
            if (v.getCostoUnitario() <= 0) faltanCostos = true;
            Long tarifa = tarifaDe(cfg, v.getProducto().getTipo(), v.isEnPromo());
            long margen = v.getTotal() - v.getCostoUnitario() * n - (tarifa == null ? 0 : tarifa * n);
            if (v.isEnPromo()) {
                margenPromo += margen;
                unidadesPromo += n;
            } else {
                margenNormal += margen;
                unidadesNormal += n;
            }
        }
        List<Integer> dias = porTrabajadorDia.values().stream().sorted().toList();
        boolean pocos = dias.size() < MIN_DIAS_ANALISIS;
        int base = pocos ? (AjustesService.entero(cfg, "META_EQUIPO", 0) > 0 ? AjustesService.entero(cfg, "META_EQUIPO", 0) : 15)
                : dias.get(dias.size() / 2);
        int mejor = dias.isEmpty() ? 0 : dias.get(dias.size() - 1);
        return new DatosPremios(base, dias.size(), mejor, unidadesNormal == 0 ? 0 : margenNormal / unidadesNormal,
                unidadesPromo == 0 ? null : margenPromo / unidadesPromo, pocos, faltanCostos, sinTarifas);
    }

    // ------------------------------------------------------------------ lo que se toma el trabajador

    /** Cuántos granizados puede tomarse gratis un trabajador por día (`GRANIZADOS_GRATIS`, 1 si no está puesto). */
    private static int gratisPorDia(Map<String, String> cfg) {
        try {
            return Math.max(0, Integer.parseInt(cfg.getOrDefault("GRANIZADOS_GRATIS", "1").trim()));
        } catch (NumberFormatException e) {
            return 1;
        }
    }

    /**
     * Pone cuánto se le descuenta por cada consumo de ese día: los primeros (en orden de hora) son los gratis y del
     * siguiente en adelante se cobra el precio de lista. Se llama cada vez que anota o borra uno, así siempre cuadra.
     */
    @Transactional
    public void recalcularConsumos(Long vendedorId, LocalDate dia) {
        int libres = gratisPorDia(ajustes.mapa());
        List<Venta> suyos = ventasDelDia(dia).stream()
                .filter(x -> vendedorId.equals(x.getVendedorId()) && x.esConsumo())
                .sorted(java.util.Comparator.comparing(Venta::getCreadaEn).thenComparing(Venta::getId))
                .toList();
        for (Venta x : suyos) {
            int sinCosto = Math.min(libres, x.getCantidad());
            libres -= sinCosto;
            x.cobrarAlVendedor(x.getPrecioUnitario() * (x.getCantidad() - sinCosto));
        }
        ventas.saveAll(suyos);
        ventas.flush();
    }

    /** El trabajador se tomó (o compró) uno de su carga: se calcula cuánto se le descuenta y el dueño recibe el aviso. */
    @Transactional
    public void anotarConsumo(Long vendedorId, Venta consumo, String sabor) {
        recalcularConsumos(vendedorId, consumo.getCreadaEn().atZone(zona).toLocalDate());
        String quien = vendedores.findById(vendedorId).map(Vendedor::getNombre).orElse("Un trabajador");
        long cargo = consumo.getCargoVendedor();
        eventos.publishEvent(new AvisoEquipo(TenantContext.actual(), "\uD83E\uDD64 " + quien + " se tomó uno",
                quien + " se tomó " + consumo.getCantidad() + " " + sabor
                        + (cargo > 0 ? ". Se le descuentan " + Pesos.formato(cargo) + " de su pago." : " (gratis del día).")));
    }

    /** Los escalones de premio de un día: los días de promoción cada uno baja `PREMIO_REBAJA_PROMO` (sin pasar de 0). */
    private static List<Escalones.Escalon> escalonesDelDia(Map<String, String> cfg, boolean promo) {
        List<Escalones.Escalon> escalones = Escalones.leer(cfg.get("PREMIOS_ESCALONES"));
        long rebaja = promo ? AjustesService.entero(cfg, "PREMIO_REBAJA_PROMO", 0) : 0;
        if (rebaja <= 0) return escalones;
        // Un escalón que queda en $0 ya no paga nada: no se muestra
        return escalones.stream().map(e -> new Escalones.Escalon(e.granizados(), Math.max(0, e.total() - rebaja)))
                .filter(e -> e.total() > 0).toList();
    }

    private Terminos terminos(Vendedor v) {
        List<TerminosTrabajo.Seccion> secciones = TerminosTrabajo.armar(ajustes.mapa(), v.getComisionPct());
        String version = TerminosTrabajo.version(TerminosTrabajo.texto(secciones));
        Instant aceptada = aceptaciones.findFirstByVendedorIdAndVersion(v.getId(), version)
                .map(AceptacionTerminos::getAceptadaEn).orElse(null);
        return new Terminos(version, "Términos del trabajo",
                secciones.stream().map(s -> new SeccionTerminos(s.titulo(), s.lineas())).toList(), aceptada, v.getFrecuenciaPago());
    }

    /** Los términos que ve el trabajador, y si ya aceptó la versión de hoy. */
    @Transactional(readOnly = true)
    public Terminos terminos(Long vendedorId) {
        return terminos(vendedores.findById(vendedorId)
                .orElseThrow(() -> new NoEncontradoException("Trabajador no encontrado: " + vendedorId)));
    }

    /** El trabajador escoge cada cuánto prefiere cobrar. */
    @Transactional
    public Terminos elegirFrecuencia(Long vendedorId, FrecuenciaPago frecuencia) {
        Vendedor v = vendedores.findById(vendedorId)
                .orElseThrow(() -> new NoEncontradoException("Trabajador no encontrado: " + vendedorId));
        v.elegirFrecuencia(frecuencia);
        return terminos(vendedores.save(v));
    }

    /** Guarda la constancia: el texto exacto, su huella y la hora. Solo vale la versión vigente. */
    @Transactional
    public Terminos aceptar(Long vendedorId, String version) {
        Vendedor v = vendedores.findById(vendedorId)
                .orElseThrow(() -> new NoEncontradoException("Trabajador no encontrado: " + vendedorId));
        List<TerminosTrabajo.Seccion> secciones = TerminosTrabajo.armar(ajustes.mapa(), v.getComisionPct());
        String texto = TerminosTrabajo.texto(secciones);
        if (!TerminosTrabajo.version(texto).equals(version)) {
            throw new IllegalArgumentException("Los términos cambiaron, léelos otra vez antes de aceptar");
        }
        if (aceptaciones.findFirstByVendedorIdAndVersion(vendedorId, version).isEmpty()) {
            aceptaciones.saveAndFlush(new AceptacionTerminos(vendedorId, version, texto, clock.instant()));
        }
        return terminos(v);
    }
}
