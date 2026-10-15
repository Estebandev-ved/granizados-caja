package co.granizados.pos.fiado;

import co.granizados.pos.ajustes.AjustesService;
import co.granizados.pos.comun.AppProperties;
import co.granizados.pos.comun.NoEncontradoException;
import co.granizados.pos.comun.Pesos;
import co.granizados.pos.plata.LugarPlata;
import co.granizados.pos.plata.PlataService;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Los que te deben. Las deudas de la misma persona (mismo nombre) se juntan en una sola con el total, y el
 * celular queda ligado al nombre: se pide una vez y sirve para todos sus fiados.
 */
@Service
public class FiadoService {

    /** Mínimo de horas entre un recordatorio y el siguiente a la misma persona. */
    static final Duration ENTRE_RECORDATORIOS = Duration.ofHours(24);

    private static final DateTimeFormatter FECHA = DateTimeFormatter.ofPattern("d 'de' MMM", Locale.of("es", "CO"));

    public record DeudaDto(Long id, String detalle, long monto, Instant creadaEn) {
        static DeudaDto de(Deuda d) {
            return new DeudaDto(d.getId(), d.getDetalle(), d.getMonto(), d.getCreadaEn());
        }
    }

    /** Todo lo que debe una persona. `mensaje` es el recordatorio listo para mandar (explica qué debe y cómo pagar). */
    public record Persona(String cliente, String telefono, long total, List<DeudaDto> deudas, String mensaje,
                          Instant recordadoEn) {
    }

    public record Lista(boolean bot, long total, List<Persona> personas) {
    }

    public record Conocido(String cliente, String telefono) {
    }

    private final DeudaRepository deudas;
    private final PlataService plata;
    private final AjustesService ajustes;
    private final WhatsAppCloud whatsapp;
    private final Clock clock;
    private final ZoneId zona;

    public FiadoService(DeudaRepository deudas, PlataService plata, AjustesService ajustes, WhatsAppCloud whatsapp,
                        Clock clock, AppProperties props) {
        this.deudas = deudas;
        this.plata = plata;
        this.ajustes = ajustes;
        this.whatsapp = whatsapp;
        this.clock = clock;
        this.zona = props.zoneId();
    }

    @Transactional(readOnly = true)
    public Lista pendientes() {
        Map<String, String> cfg = ajustes.mapa();
        Map<String, List<Deuda>> porNombre = new LinkedHashMap<>();
        for (Deuda d : deudas.findByPagadaEnIsNullOrderByCreadaEnAscIdAsc()) {
            porNombre.computeIfAbsent(clave(d.getCliente()), k -> new ArrayList<>()).add(d);
        }
        List<Persona> personas = porNombre.values().stream().map(lista -> persona(lista, cfg)).toList();
        return new Lista(whatsapp.activo(), personas.stream().mapToLong(Persona::total).sum(), personas);
    }

    /** Los que ya han fiado antes, con su celular: sirve para no volver a pedirlo. */
    @Transactional(readOnly = true)
    public List<Conocido> conocidos() {
        Map<String, Conocido> porNombre = new LinkedHashMap<>();
        for (Deuda d : deudas.findAll(org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC, "id"))) {
            porNombre.merge(clave(d.getCliente()), new Conocido(d.getCliente(), d.getTelefono()),
                    (viejo, nuevo) -> viejo.telefono() != null ? viejo : new Conocido(viejo.cliente(), nuevo.telefono()));
        }
        return List.copyOf(porNombre.values());
    }

    /** Guarda el celular (solo dígitos) para esa persona: queda en todos sus fiados pendientes. Vacío lo borra. */
    @Transactional
    public Persona telefono(Long id, String telefono) {
        Deuda base = buscar(id);
        String limpio = telefono == null ? "" : telefono.replaceAll("\\D", "");
        if (limpio.length() > 15) throw new IllegalArgumentException("Ese número es muy largo");
        for (Deuda d : deudas.findByPagadaEnIsNullOrderByCreadaEnAscIdAsc()) {
            if (clave(d.getCliente()).equals(clave(base.getCliente()))) d.setTelefono(limpio.isEmpty() ? null : limpio);
        }
        deudas.flush();
        return persona(delMismoNombre(base), ajustes.mapa());
    }

    /** Cobra una deuda. */
    @Transactional
    public Persona cobrar(Long id, LugarPlata lugar, String clientUid) {
        return cobrar(List.of(id), lugar, clientUid);
    }

    /**
     * Marca esas deudas como cobradas y entra la plata (un solo ingreso por el total) al lugar elegido. La venta ya
     * sumó a la ganancia el día que se fió, por eso el ingreso no cuenta como ganancia otra vez. Repetir el cobro
     * no duplica la plata.
     */
    @Transactional
    public Persona cobrar(List<Long> ids, LugarPlata lugar, String clientUid) {
        List<Deuda> aCobrar = ids.stream().distinct().map(this::buscar).filter(d -> !d.estaPagada()).toList();
        if (!aCobrar.isEmpty()) {
            Instant ahora = clock.instant();
            aCobrar.forEach(d -> d.setPagadaEn(ahora));
            deudas.flush();
            long total = aCobrar.stream().mapToLong(Deuda::getMonto).sum();
            plata.registrarIngreso(new PlataService.NuevoIngreso(clientUid,
                    "Fiado cobrado · " + aCobrar.getFirst().getCliente(), total, lugar, null, false));
        }
        return persona(delMismoNombre(buscar(ids.getFirst())), ajustes.mapa());
    }

    /**
     * Manda el recordatorio por el bot de WhatsApp (plantilla aprobada). Una vez al día por persona.
     * Lo pide el dueño tocando el botón; nunca sale solo.
     */
    @Transactional
    public Persona recordar(List<Long> ids) {
        if (!whatsapp.activo()) throw new IllegalArgumentException("El bot de WhatsApp todavía no está configurado");
        List<Deuda> lista = ids.stream().distinct().map(this::buscar).filter(d -> !d.estaPagada()).toList();
        if (lista.isEmpty()) throw new IllegalArgumentException("Ya no debe nada");
        Deuda primera = lista.getFirst();
        Map<String, String> cfg = ajustes.mapa();
        Persona p = persona(lista, cfg);
        if (p.telefono() == null) throw new IllegalArgumentException("Falta el celular de " + p.cliente());

        Instant ahora = clock.instant();
        if (lista.stream().anyMatch(d -> d.getRecordadoEn() != null
                && d.getRecordadoEn().isAfter(ahora.minus(ENTRE_RECORDATORIOS)))) {
            throw new IllegalArgumentException("Ya le avisaste a " + p.cliente() + " hoy. Espera para no ser pesado");
        }
        whatsapp.enviarPlantilla(numero(p.telefono()), variablesPlantilla(p, cfg));
        lista.forEach(d -> d.setRecordadoEn(ahora));
        deudas.flush();
        return persona(delMismoNombre(primera), cfg);
    }

    // ------------------------------------------------------------------ armar

    private Persona persona(List<Deuda> lista, Map<String, String> cfg) {
        List<Deuda> sinPagar = lista.stream().filter(d -> !d.estaPagada()).toList();
        List<Deuda> base = sinPagar.isEmpty() ? lista : sinPagar;
        String cliente = base.getLast().getCliente();
        String telefono = base.stream().map(Deuda::getTelefono).filter(t -> t != null && !t.isBlank())
                .reduce((a, b) -> b).orElse(null);
        long total = sinPagar.stream().mapToLong(Deuda::getMonto).sum();
        Instant recordado = base.stream().map(Deuda::getRecordadoEn).filter(r -> r != null)
                .max(Instant::compareTo).orElse(null);
        return new Persona(cliente, telefono, total, base.stream().map(DeudaDto::de).toList(),
                mensaje(cliente, base, total, cfg), recordado);
    }

    private List<Deuda> delMismoNombre(Deuda base) {
        String k = clave(base.getCliente());
        List<Deuda> lista = deudas.findByPagadaEnIsNullOrderByCreadaEnAscIdAsc().stream()
                .filter(d -> clave(d.getCliente()).equals(k)).toList();
        return lista.isEmpty() ? List.of(base) : lista;
    }

    /** El mensaje que ve el cliente: qué debe (cada fiado), el total y dónde pagar. */
    String mensaje(String cliente, List<Deuda> lista, long total, Map<String, String> cfg) {
        String firma = cfg.getOrDefault(AjustesService.NOMBRE, "").trim();
        StringBuilder sb = new StringBuilder("Hola ").append(cliente).append(" 👋");
        sb.append(firma.isEmpty() ? " te escribo" : " te escribe " + firma);
        sb.append(" para recordarte lo que quedó pendiente:\n");
        for (Deuda d : lista) {
            sb.append("• ").append(d.getDetalle()).append(" (").append(cuando(d.getCreadaEn())).append(") — ")
                    .append(Pesos.formato(d.getMonto())).append('\n');
        }
        sb.append("Total: ").append(Pesos.formato(total)).append("\n\n");
        List<String> medios = medios(cfg);
        if (medios.isEmpty()) {
            sb.append("Avísame cómo prefieres pagarme. ");
        } else {
            sb.append("Me lo puedes pagar así:\n");
            medios.forEach(m -> sb.append("• ").append(m).append('\n'));
        }
        return sb.append("¡Gracias!").toString();
    }

    private List<String> medios(Map<String, String> cfg) {
        List<String> medios = new ArrayList<>();
        String nequi = cfg.getOrDefault("PAGO_NEQUI", "").trim();
        String breb = cfg.getOrDefault("PAGO_BREB", "").trim();
        String presencial = cfg.getOrDefault("PAGO_PRESENCIAL", "").trim();
        if (!nequi.isEmpty()) medios.add("Nequi: " + nequi);
        if (!breb.isEmpty()) medios.add("Llave Bre-B: " + breb);
        if (!presencial.isEmpty()) medios.add("En persona: " + presencial);
        return medios;
    }

    /**
     * Variables de la plantilla de Meta, en orden: {{1}} nombre, {{2}} quién escribe, {{3}} total, {{4}} qué debe,
     * {{5}} cómo pagar. Meta no deja saltos de línea ni variables vacías.
     */
    List<String> variablesPlantilla(Persona p, Map<String, String> cfg) {
        String firma = cfg.getOrDefault(AjustesService.NOMBRE, "").trim();
        String debe = p.deudas().stream()
                .map(d -> d.detalle() + " (" + cuando(d.creadaEn()) + ")")
                .collect(Collectors.joining(", "));
        List<String> medios = medios(cfg);
        return List.of(
                unaLinea(p.cliente(), "cliente"),
                unaLinea(firma, "tu vendedor"),
                Pesos.formato(p.total()),
                unaLinea(debe, "tu pedido"),
                unaLinea(String.join(" · ", medios), "avísame y te cuento cómo"));
    }

    private static String unaLinea(String texto, String siVacio) {
        String limpio = texto == null ? "" : texto.replaceAll("\\s+", " ").trim();
        return limpio.isEmpty() ? siVacio : limpio;
    }

    private String cuando(Instant creada) {
        LocalDate dia = creada.atZone(zona).toLocalDate();
        LocalDate hoy = LocalDate.now(clock.withZone(zona));
        if (dia.equals(hoy)) return "hoy";
        if (dia.equals(hoy.minusDays(1))) return "ayer";
        return "el " + FECHA.format(dia).replace(".", "");
    }

    /** Un celular de 10 dígitos es colombiano: se le pone el 57. */
    static String numero(String telefono) {
        String d = telefono.replaceAll("\\D", "");
        return d.length() == 10 ? "57" + d : d;
    }

    /** Mismo nombre aunque cambien mayúsculas, tildes o espacios. */
    static String clave(String cliente) {
        String sinTildes = java.text.Normalizer.normalize(cliente, java.text.Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return sinTildes.toLowerCase(Locale.ROOT).replaceAll("\\s+", " ").trim();
    }

    private Deuda buscar(Long id) {
        return deudas.findById(id).orElseThrow(() -> new NoEncontradoException("Fiado no encontrado: " + id));
    }
}
