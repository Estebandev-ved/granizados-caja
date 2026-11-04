package co.granizados.pos.equipo;

import co.granizados.pos.ajustes.AjustesService;
import co.granizados.pos.comun.AppProperties;
import co.granizados.pos.comun.NoEncontradoException;
import co.granizados.pos.comun.Pesos;
import co.granizados.pos.negocio.TenantContext;
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
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
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
                              List<FilaCarga> carga, Instant terminosAceptadosEn) {
    }

    /**
     * Lo que lleva ganado un trabajador hoy: comisión, premio del escalón alcanzado y el próximo por alcanzar.
     * `gratis` son los granizados que puede tomarse sin pagar.
     */
    public record PremiosDia(int vendidas, long comision, long premio, List<Escalones.Escalon> escalones,
                             Escalones.Escalon siguiente, int gratis) {
    }

    public record SeccionTerminos(String titulo, List<String> lineas) {
    }

    /** Los términos vigentes. `aceptadaEn` es null si este trabajador todavía no aceptó esta versión. */
    public record Terminos(String version, String titulo, List<SeccionTerminos> secciones, Instant aceptadaEn) {
    }

    /**
     * Cuentas de un trabajador en un rango de días. `saldo` = efectivo − comisión − bonos por meta: si es positivo el
     * trabajador le debe esa plata al dueño; si es negativo, el dueño le debe a él.
     */
    public record Liquidacion(Long vendedorId, String nombre, int comisionPct, int unidades, long total, long efectivo,
                              long nequi, long comision, int diasMeta, long bonos, long saldo) {
    }

    /** La meta del día de un trabajador: cuánto lleva, cuánto gana si la cumple y cuántos días seguidos la viene cumpliendo. */
    public record MetaEquipo(int unidades, long premio, int vendidas, int racha) {
    }

    /** Lo que ve el trabajador al cerrar su turno: lo que debe entregar y lo que devuelve. */
    public record CierreTurno(int unidades, long total, long efectivo, long nequi, long comision, long bonos, long entregar,
                              List<FilaCarga> devuelve) {
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
    private final ZoneId zona;
    private final BCryptPasswordEncoder hash = new BCryptPasswordEncoder();

    public EquipoService(VendedorRepository vendedores, CargaVendedorRepository cargas, ProductoRepository productos,
                         VentaRepository ventas, AjustesService ajustes, AppProperties props, Clock clock,
                         ApplicationEventPublisher eventos, AceptacionTerminosRepository aceptaciones) {
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
        long total = 0, efectivo = 0, nequi = 0, comision = 0;
        for (Venta x : delDia) {
            if (!vendedorId.equals(x.getVendedorId())) continue;
            unidades += x.getCantidad();
            total += x.getTotal();
            efectivo += x.efectivo();
            nequi += x.nequi();
            comision += comisionDe(x, v);
        }
        int meta = AjustesService.entero(ajustes.mapa(), "META_EQUIPO", 0);
        long premio = AjustesService.entero(ajustes.mapa(), "PREMIO_EQUIPO", 0);
        long bonos = (meta > 0 && unidades >= meta ? premio : 0)
                + Escalones.premioDe(Escalones.leer(ajustes.mapa().get("PREMIOS_ESCALONES")), unidades);
        long entregar = efectivo - comision - bonos;
        List<FilaCarga> devuelve = filasDe(vendedorId, dia, delDia).stream().filter(f -> f.queda() > 0).toList();

        StringBuilder t = new StringBuilder(v.getNombre() + " cerró su día: " + unidades + " vendidos, " + Pesos.formato(total)
                + "\n• Efectivo: " + Pesos.formato(efectivo) + "\n• Nequi: " + Pesos.formato(nequi));
        if (comision > 0) t.append("\n• Su comisión: ").append(Pesos.formato(comision));
        if (bonos > 0) t.append("\n• Premios del día: ").append(Pesos.formato(bonos));
        t.append(entregar >= 0 ? "\nTe entrega " + Pesos.formato(entregar) : "\nTú le debes " + Pesos.formato(-entregar));
        if (devuelve.isEmpty()) t.append("\nNo devuelve nada.");
        else t.append("\nDevuelve: ").append(String.join(", ", devuelve.stream().map(f -> f.queda() + " " + f.nombre()).toList()));
        eventos.publishEvent(new AvisoEquipo(TenantContext.actual(), "🧾 " + v.getNombre() + " cerró su día", t.toString()));
        return new CierreTurno(unidades, total, efectivo, nequi, comision, bonos, entregar, devuelve);
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
    public Long comisionPorGranizado(TipoProducto tipo) {
        Map<String, String> cfg = ajustes.mapa();
        long normal = AjustesService.entero(cfg, "COMISION_NORMAL", 0);
        long cremoso = AjustesService.entero(cfg, "COMISION_CREMOSO", 0);
        long grande = AjustesService.entero(cfg, "COMISION_GRANDE", 0);
        long cerveza = AjustesService.entero(cfg, "COMISION_CERVEZA", 0);
        if (normal + cremoso + grande + cerveza == 0) return null;
        return switch (tipo) {
            case NORMAL -> normal;
            case CREMOSO -> cremoso;
            case GRANDE -> grande;
            case CERVEZA -> cerveza;
        };
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
        Map<String, String> cfg = ajustes.mapa();
        int meta = AjustesService.entero(cfg, "META_EQUIPO", 0);
        long premio = AjustesService.entero(cfg, "PREMIO_EQUIPO", 0);
        List<Escalones.Escalon> escalones = Escalones.leer(cfg.get("PREMIOS_ESCALONES"));
        for (Vendedor v : vendedores.findAllByOrderByNombreAscIdAsc()) {
            long total = 0, efectivo = 0, nequi = 0, comision = 0;
            int unidades = 0;
            for (Venta x : delRango) {
                if (!v.getId().equals(x.getVendedorId())) continue;
                unidades += x.getCantidad();
                total += x.getTotal();
                efectivo += x.efectivo();
                nequi += x.nequi();
                comision += comisionDe(x, v);
            }
            if (!v.isActivo() && unidades == 0) continue;
            // Un premio por cada día del rango en que cumplió la meta, más el del escalón que alcanzó cada día
            int diasMeta = 0;
            long premiosEscalon = 0;
            if (meta > 0 || !escalones.isEmpty()) {
                for (int unidadesDia : unidadesPorDia(v.getId(), desde, hasta).values()) {
                    if (meta > 0 && unidadesDia >= meta) diasMeta++;
                    premiosEscalon += Escalones.premioDe(escalones, unidadesDia);
                }
            }
            long bonos = diasMeta * premio + premiosEscalon;
            filas.add(new Liquidacion(v.getId(), v.getNombre(), v.getComisionPct(), unidades, total, efectivo, nequi,
                    comision, diasMeta, bonos, efectivo - comision - bonos));
        }
        return filas;
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
            if (vendedorId.equals(v.getVendedorId())) {
                porDia.merge(v.getCreadaEn().atZone(zona).toLocalDate(), v.getCantidad(), Integer::sum);
            }
        }
        return porDia;
    }

    private VendedorDto dto(Vendedor v, List<Venta> mias, List<FilaCarga> carga) {
        return new VendedorDto(v.getId(), v.getNombre(), v.getComisionPct(), v.isActivo(),
                mias.stream().mapToInt(Venta::getCantidad).sum(), mias.stream().mapToLong(Venta::getTotal).sum(), carga,
                terminos(v).aceptadaEn());
    }

    // ------------------------------------------------------------------ premios del día y términos

    /** Lo que lleva ganado hoy el trabajador (`mias` son sus ventas del día). */
    @Transactional(readOnly = true)
    public PremiosDia premiosDe(Long vendedorId, List<Venta> mias) {
        Map<String, String> cfg = ajustes.mapa();
        List<Escalones.Escalon> escalones = Escalones.leer(cfg.get("PREMIOS_ESCALONES"));
        int vendidas = mias.stream().mapToInt(Venta::getCantidad).sum();
        long comision = vendedores.findById(vendedorId)
                .map(v -> mias.stream().mapToLong(x -> comisionDe(x, v)).sum()).orElse(0L);
        int gratis = 1;
        try {
            gratis = Math.max(0, Integer.parseInt(cfg.getOrDefault("GRANIZADOS_GRATIS", "1").trim()));
        } catch (NumberFormatException e) {
            // se queda en 1
        }
        return new PremiosDia(vendidas, comision, Escalones.premioDe(escalones, vendidas), escalones,
                Escalones.siguiente(escalones, vendidas), gratis);
    }

    private Terminos terminos(Vendedor v) {
        List<TerminosTrabajo.Seccion> secciones = TerminosTrabajo.armar(ajustes.mapa(), v.getComisionPct());
        String version = TerminosTrabajo.version(TerminosTrabajo.texto(secciones));
        Instant aceptada = aceptaciones.findFirstByVendedorIdAndVersion(v.getId(), version)
                .map(AceptacionTerminos::getAceptadaEn).orElse(null);
        return new Terminos(version, "Términos del trabajo",
                secciones.stream().map(s -> new SeccionTerminos(s.titulo(), s.lineas())).toList(), aceptada);
    }

    /** Los términos que ve el trabajador, y si ya aceptó la versión de hoy. */
    @Transactional(readOnly = true)
    public Terminos terminos(Long vendedorId) {
        return terminos(vendedores.findById(vendedorId)
                .orElseThrow(() -> new NoEncontradoException("Trabajador no encontrado: " + vendedorId)));
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
