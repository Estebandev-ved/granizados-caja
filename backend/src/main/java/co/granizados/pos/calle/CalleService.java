package co.granizados.pos.calle;

import co.granizados.pos.ajustes.AjustesService;
import co.granizados.pos.comun.AppProperties;
import co.granizados.pos.comun.NoEncontradoException;
import co.granizados.pos.equipo.AvisoEquipo;
import co.granizados.pos.equipo.EquipoService;
import co.granizados.pos.equipo.Sesion;
import co.granizados.pos.equipo.Vendedor;
import co.granizados.pos.equipo.VendedorRepository;
import co.granizados.pos.negocio.TenantContext;
import co.granizados.pos.venta.Venta;
import co.granizados.pos.venta.VentaRepository;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * El plan de ventas en la calle: salidas a un lugar, qué tan bueno resultó cada lugar y el botón de alerta.
 * Lo vendido sale de las ventas que llevan el uid de la salida; acá solo se guarda dónde, cuándo y qué pasó.
 */
@Service
public class CalleService {

    /** Cuánto atrás se acepta la hora que manda el celular (una salida pudo empezar sin señal). */
    private static final Duration MAX_ATRASO = Duration.ofDays(3);
    /** Las salidas y alertas que se muestran: lo de los últimos días que el dueño usa para decidir. */
    private static final int DIAS_RESUMEN = 180;
    private static final DateTimeFormatter HORA = DateTimeFormatter.ofPattern("h:mm a", Locale.US);

    public record NuevaSalida(@NotBlank @Size(max = 64) String clientUid, @NotBlank @Size(max = 60) String lugar,
                              Double lat, Double lng, Instant inicio, Boolean prueba) {
    }

    public record CierreSalida(Instant fin, @Min(0) @Max(500000) Long pasaje, @Size(max = 80) String incidentes,
                               @Size(max = 200) String nota) {
    }

    public record NuevaAlerta(@NotBlank @Size(max = 64) String clientUid, @NotNull AlertaSos.Tipo tipo, Double lat, Double lng) {
    }

    public record LugarSimple(Long id, String nombre, Double lat, Double lng) {
    }

    public record Iniciada(String clientUid, Long lugarId, String lugar, Instant inicio) {
    }

    /** Lo que ve quien cerró la salida: sin costos ni ganancia del dueño. */
    public record Cierre(int unidades, long total, double horas, long comision, long pasajeADevolver, String veredicto) {
    }

    /** Una salida como la ve el dueño. */
    public record SalidaDto(String clientUid, Long lugarId, String lugar, String quien, Instant inicio, Instant fin,
                            boolean abierta, boolean prueba, int unidades, long total, double horas, Integer ritmo4h,
                            String veredicto, long pasaje, long pasajeADevolver, long comision, long meDeja,
                            String incidentes, String nota) {
    }

    /** Un lugar con lo que dejaron todas sus salidas. `ritmo4h` = granizados en 4 horas (null = sin datos). */
    public record LugarDto(Long id, String nombre, Double lat, Double lng, int salidas, int unidades, double horas,
                           Integer ritmo4h, String veredicto, long pasajePromedio, long meDeja, Integer mejorHora,
                           int alertas) {
    }

    public record AlertaDto(Long id, String quien, String tipo, String lugar, Double lat, Double lng, Instant creadaEn) {
    }

    public record Resumen(CalleConfig config, List<LugarDto> lugares, List<SalidaDto> salidas, List<AlertaDto> alertas) {
    }

    private final LugarVentaRepository lugares;
    private final SalidaCalleRepository salidas;
    private final AlertaSosRepository alertas;
    private final VentaRepository ventas;
    private final VendedorRepository vendedores;
    private final AjustesService ajustes;
    private final ApplicationEventPublisher eventos;
    private final Clock clock;
    private final ZoneId zona;

    public CalleService(LugarVentaRepository lugares, SalidaCalleRepository salidas, AlertaSosRepository alertas,
                        VentaRepository ventas, VendedorRepository vendedores, AjustesService ajustes,
                        ApplicationEventPublisher eventos, Clock clock, AppProperties props) {
        this.lugares = lugares;
        this.salidas = salidas;
        this.alertas = alertas;
        this.ventas = ventas;
        this.vendedores = vendedores;
        this.ajustes = ajustes;
        this.eventos = eventos;
        this.clock = clock;
        this.zona = props.zoneId();
    }

    // ------------------------------------------------------------------ salidas

    @Transactional(readOnly = true)
    public List<LugarSimple> lugares() {
        return lugares.findAllByOrderByNombreAscIdAsc().stream()
                .map(l -> new LugarSimple(l.getId(), l.getNombre(), l.getLat(), l.getLng())).toList();
    }

    /** Empieza una salida. Si el celular reintenta con el mismo uid, devuelve la misma sin duplicar. */
    @Transactional
    public Iniciada iniciar(NuevaSalida n) {
        Long vendedor = Sesion.vendedorId();
        var existente = salidas.findByClientUid(n.clientUid());
        if (existente.isPresent()) {
            SalidaCalle s = existente.get();
            if (!java.util.Objects.equals(s.getVendedorId(), vendedor)) throw new NoEncontradoException("Salida no encontrada");
            return iniciada(s);
        }
        Instant ahora = clock.instant();
        Double lat = coordenada(n.lat(), 90), lng = coordenada(n.lng(), 180);
        if (lat == null || lng == null) {
            lat = null;
            lng = null;
        }
        String nombre = n.lugar().trim().replaceAll("\\s+", " ");
        if (nombre.isEmpty()) throw new IllegalArgumentException("Falta el nombre del lugar");
        LugarVenta lugar = lugares.findByNombreIgnoreCase(nombre).orElseGet(() -> lugares.save(new LugarVenta(nombre, null, null, ahora)));
        lugar.ubicarSiFalta(lat, lng);
        // Una salida de prueba solo la puede marcar el dueño (él es quien paga el pasaje completo)
        boolean prueba = Boolean.TRUE.equals(n.prueba()) && vendedor == null;
        SalidaCalle s = salidas.saveAndFlush(new SalidaCalle(n.clientUid(), lugar.getId(), vendedor, cuando(n.inicio(), ahora), lat, lng, prueba));
        return iniciada(s);
    }

    private Iniciada iniciada(SalidaCalle s) {
        String nombre = lugares.findById(s.getLugarId()).map(LugarVenta::getNombre).orElse("");
        return new Iniciada(s.getClientUid(), s.getLugarId(), nombre, s.getInicio());
    }

    /** Cierra la salida con los pasajes y lo que pasó, y devuelve el resumen de lo vendido. Repetirlo no cambia nada. */
    @Transactional
    public Cierre terminar(String clientUid, CierreSalida c) {
        SalidaCalle s = suya(clientUid);
        if (s.estaAbierta()) {
            Instant fin = cuando(c.fin(), clock.instant());
            if (fin.isBefore(s.getInicio())) fin = s.getInicio();
            s.terminar(fin, c.pasaje() == null ? 0 : c.pasaje(), limpio(c.incidentes()), limpio(c.nota()));
        }
        CalleConfig cfg = CalleConfig.leer(ajustes.mapa());
        Stats st = stats(s, ventasDe(s.getClientUid()), cfg, nombresDe());
        return new Cierre(st.unidades, st.total, st.horas, st.comision, st.pasajeADevolver, st.veredicto);
    }

    /** Una salida solo la cierra quien la abrió (el dueño puede cerrar cualquiera). */
    private SalidaCalle suya(String clientUid) {
        SalidaCalle s = salidas.findByClientUid(clientUid).orElseThrow(() -> new NoEncontradoException("Salida no encontrada"));
        Long vendedor = Sesion.vendedorId();
        if (vendedor != null && !vendedor.equals(s.getVendedorId())) throw new NoEncontradoException("Salida no encontrada");
        return s;
    }

    // ------------------------------------------------------------------ botón de alerta

    /**
     * El trabajador está en problemas (hurto, policía, necesita ayuda): al dueño le llega un Telegram con quién es,
     * dónde está y un link al mapa. Repetir el mismo uid no manda otro aviso.
     */
    @Transactional
    public AlertaDto alertar(NuevaAlerta n) {
        Long vendedor = Sesion.vendedorId();
        var repetida = alertas.findByClientUid(n.clientUid());
        if (repetida.isPresent()) return alertaDto(repetida.get(), nombresDe());
        Instant ahora = clock.instant();
        Double lat = coordenada(n.lat(), 90), lng = coordenada(n.lng(), 180);
        if (lat == null || lng == null) {
            lat = null;
            lng = null;
        }
        var abierta = vendedor == null ? salidas.findFirstByVendedorIdIsNullAndFinIsNullOrderByInicioDesc()
                : salidas.findFirstByVendedorIdAndFinIsNullOrderByInicioDesc(vendedor);
        String lugar = abierta.flatMap(s -> lugares.findById(s.getLugarId())).map(LugarVenta::getNombre).orElse(null);
        AlertaSos a = alertas.saveAndFlush(new AlertaSos(n.clientUid(), vendedor, n.tipo(), lugar, lat, lng, ahora));
        String quien = vendedor == null ? "Tú (prueba)" : vendedores.findById(vendedor).map(Vendedor::getNombre).orElse("Un trabajador");
        String que = switch (n.tipo()) {
            case HURTO -> "🚨 HURTO";
            case POLICIA -> "🚓 POLICÍA";
            case AYUDA -> "🆘 NECESITA AYUDA";
        };
        String texto = quien + " mandó la alerta: " + que + "\n"
                + (lugar == null ? "" : "Lugar: " + lugar + "\n")
                + "Hora: " + HORA.format(ahora.atZone(zona))
                + (lat == null ? "\nNo se pudo tomar la ubicación: llámalo ya." : "\nUbicación: https://maps.google.com/?q=" + lat + "," + lng)
                + "\nLlámalo o escríbele ahora.";
        eventos.publishEvent(new AvisoEquipo(TenantContext.actual(), que + " · " + quien, texto));
        return alertaDto(a, nombresDe());
    }

    // ------------------------------------------------------------------ resumen del dueño

    /** Todo lo que ve el dueño en el mapa: cada lugar con su veredicto, las salidas y las alertas. */
    @Transactional(readOnly = true)
    public Resumen resumen() {
        Instant ahora = clock.instant();
        Instant desde = ahora.minus(Duration.ofDays(DIAS_RESUMEN));
        CalleConfig cfg = CalleConfig.leer(ajustes.mapa());
        Map<Long, String> nombres = nombresDe();
        Map<String, List<Venta>> porSalida = new HashMap<>();
        for (Venta v : ventas.entre(desde, ahora.plusSeconds(60))) {
            if (v.getSalidaUid() != null) porSalida.computeIfAbsent(v.getSalidaUid(), k -> new ArrayList<>()).add(v);
        }
        Map<Long, LugarVenta> porLugar = new LinkedHashMap<>();
        for (LugarVenta l : lugares.findAllByOrderByNombreAscIdAsc()) porLugar.put(l.getId(), l);

        List<SalidaCalle> lista = salidas.findByInicioGreaterThanEqualOrderByInicioDescIdDesc(desde);
        List<SalidaDto> salidasDto = new ArrayList<>();
        Map<Long, List<Stats>> statsDeLugar = new HashMap<>();
        Map<Long, List<Venta>> ventasDeLugar = new HashMap<>();
        for (SalidaCalle s : lista) {
            List<Venta> vs = porSalida.getOrDefault(s.getClientUid(), List.of());
            Stats st = stats(s, vs, cfg, nombres);
            LugarVenta l = porLugar.get(s.getLugarId());
            salidasDto.add(new SalidaDto(s.getClientUid(), s.getLugarId(), l == null ? "" : l.getNombre(),
                    s.getVendedorId() == null ? "Tú" : nombres.getOrDefault(s.getVendedorId(), "Trabajador"),
                    s.getInicio(), s.getFin(), s.estaAbierta(), s.isPrueba(), st.unidades, st.total, st.horas, st.ritmo4h,
                    st.veredicto, s.getPasaje(), st.pasajeADevolver, st.comision, st.meDeja, s.getIncidentes(), s.getNota()));
            statsDeLugar.computeIfAbsent(s.getLugarId(), k -> new ArrayList<>()).add(st);
            ventasDeLugar.computeIfAbsent(s.getLugarId(), k -> new ArrayList<>()).addAll(vs);
        }

        List<AlertaSos> recientes = alertas.findByCreadaEnGreaterThanEqualOrderByCreadaEnDescIdDesc(desde);
        Map<String, Integer> alertasPorLugar = new HashMap<>();
        for (AlertaSos a : recientes) {
            if (a.getLugar() != null) alertasPorLugar.merge(a.getLugar().toLowerCase(Locale.ROOT), 1, Integer::sum);
        }
        List<LugarDto> lugaresDto = new ArrayList<>();
        for (LugarVenta l : porLugar.values()) {
            List<Stats> ss = statsDeLugar.getOrDefault(l.getId(), List.of());
            int unidades = 0;
            double horas = 0;
            int unidadesMedidas = 0;
            double horasMedidas = 0;
            long pasajes = 0, meDeja = 0;
            for (Stats st : ss) {
                unidades += st.unidades;
                horas += st.horas;
                meDeja += st.meDeja;
                pasajes += st.pasaje;
                // Solo cuentan para el ritmo las salidas de una hora o más: menos que eso no dice nada
                if (st.horas >= 1) {
                    unidadesMedidas += st.unidades;
                    horasMedidas += st.horas;
                }
            }
            Integer ritmo = horasMedidas >= 1 ? (int) Math.round(unidadesMedidas * 4 / horasMedidas) : null;
            lugaresDto.add(new LugarDto(l.getId(), l.getNombre(), l.getLat(), l.getLng(), ss.size(), unidades,
                    redondear(horas), ritmo, veredicto(ritmo, cfg), ss.isEmpty() ? 0 : pasajes / ss.size(), meDeja,
                    mejorHora(ventasDeLugar.getOrDefault(l.getId(), List.of())),
                    alertasPorLugar.getOrDefault(l.getNombre().toLowerCase(Locale.ROOT), 0)));
        }
        lugaresDto.sort(Comparator.comparing((LugarDto l) -> l.ritmo4h() == null ? -1 : l.ritmo4h()).reversed()
                .thenComparing(LugarDto::nombre));
        return new Resumen(cfg, lugaresDto, salidasDto, recientes.stream().map(a -> alertaDto(a, nombres)).toList());
    }

    // ------------------------------------------------------------------ cuentas de una salida

    /** Lo que se mide de una salida con las ventas que llevan su uid. */
    private static final class Stats {
        int unidades;
        long total;
        long comision;
        long costo;
        long pasaje;
        long pasajeADevolver;
        long meDeja;
        double horas;
        Integer ritmo4h;
        String veredicto;
    }

    private Stats stats(SalidaCalle s, List<Venta> vs, CalleConfig cfg, Map<Long, String> nombres) {
        Stats st = new Stats();
        Instant ultima = null;
        Vendedor vendedor = s.getVendedorId() == null ? null : vendedores.findById(s.getVendedorId()).orElse(null);
        for (Venta v : vs) {
            if (v.getCreadaEn() != null && (ultima == null || v.getCreadaEn().isAfter(ultima))) ultima = v.getCreadaEn();
            if (v.esDelTrabajador()) continue; // lo que se tomó él o lo que faltó no es una venta
            st.unidades += v.getCantidad();
            st.total += v.getTotal();
            st.costo += v.getCostoUnitario() * v.getCantidad();
            if (vendedor != null) st.comision += EquipoService.comisionDe(v, vendedor);
        }
        // Una salida sin cerrar mide hasta su última venta, para que olvidarse de cerrarla no la infle
        Instant hasta = s.getFin() != null ? s.getFin() : ultima != null ? ultima : s.getInicio();
        st.horas = redondear(Math.max(0, Duration.between(s.getInicio(), hasta).toMinutes() / 60.0));
        st.ritmo4h = st.horas >= 1 ? (int) Math.round(st.unidades * 4 / st.horas) : null;
        st.veredicto = veredicto(st.ritmo4h, cfg);
        st.pasaje = s.getPasaje();
        // Al trabajador se le devuelve el pasaje en una salida de prueba o si vendió menos del mínimo; el del dueño es suyo
        boolean devolver = s.getVendedorId() != null && s.getFin() != null && (s.isPrueba() || st.unidades < cfg.minimoPasaje());
        st.pasajeADevolver = devolver ? s.getPasaje() : 0;
        long costoPasaje = s.getVendedorId() == null ? s.getPasaje() : st.pasajeADevolver;
        st.meDeja = st.total - st.costo - st.comision - costoPasaje;
        return st;
    }

    private static String veredicto(Integer ritmo4h, CalleConfig cfg) {
        if (ritmo4h == null) return "SIN_DATOS";
        if (ritmo4h >= cfg.bueno()) return "BUENO";
        return ritmo4h >= cfg.regular() ? "REGULAR" : "MALO";
    }

    /** La hora del día (Bogotá) en que más se vendió en ese lugar; null si no hay ventas. */
    private Integer mejorHora(List<Venta> vs) {
        Map<Integer, Integer> porHora = new HashMap<>();
        for (Venta v : vs) {
            if (v.esDelTrabajador()) continue;
            porHora.merge(v.getCreadaEn().atZone(zona).getHour(), v.getCantidad(), Integer::sum);
        }
        return porHora.entrySet().stream().max(Map.Entry.<Integer, Integer>comparingByValue().thenComparing(Map.Entry.comparingByKey()))
                .map(Map.Entry::getKey).orElse(null);
    }

    private List<Venta> ventasDe(String salidaUid) {
        Instant ahora = clock.instant();
        return ventas.entre(ahora.minus(MAX_ATRASO.plusDays(DIAS_RESUMEN)), ahora.plusSeconds(60)).stream()
                .filter(v -> salidaUid.equals(v.getSalidaUid())).toList();
    }

    private Map<Long, String> nombresDe() {
        Map<Long, String> nombres = new HashMap<>();
        for (Vendedor v : vendedores.findAll()) nombres.put(v.getId(), v.getNombre());
        return nombres;
    }

    private AlertaDto alertaDto(AlertaSos a, Map<Long, String> nombres) {
        return new AlertaDto(a.getId(), a.getVendedorId() == null ? "Tú" : nombres.getOrDefault(a.getVendedorId(), "Trabajador"),
                a.getTipo().name(), a.getLugar(), a.getLat(), a.getLng(), a.getCreadaEn());
    }

    // ------------------------------------------------------------------ utilidades

    /** La hora del celular si es creíble (la salida pudo empezar sin señal); si no, la del servidor. */
    private static Instant cuando(Instant delCelular, Instant ahora) {
        if (delCelular == null || delCelular.isAfter(ahora.plus(Duration.ofMinutes(5)))
                || delCelular.isBefore(ahora.minus(MAX_ATRASO))) return ahora;
        return delCelular;
    }

    private static Double coordenada(Double valor, double limite) {
        return valor == null || valor.isNaN() || Math.abs(valor) > limite ? null : valor;
    }

    private static String limpio(String texto) {
        return texto == null || texto.isBlank() ? null : texto.trim();
    }

    private static double redondear(double x) {
        return Math.round(x * 10) / 10.0;
    }
}
