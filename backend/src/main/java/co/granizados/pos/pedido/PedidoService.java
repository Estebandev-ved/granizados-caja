package co.granizados.pos.pedido;

import co.granizados.pos.ajustes.AjustesService;
import co.granizados.pos.comun.NoEncontradoException;
import co.granizados.pos.inventario.InventarioService;
import co.granizados.pos.inventario.TipoMovimiento;
import co.granizados.pos.plata.LugarPlata;
import co.granizados.pos.plata.PlataService;
import co.granizados.pos.producto.Producto;
import co.granizados.pos.producto.ProductoRepository;
import co.granizados.pos.venta.VentaRepository;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Pedido al proveedor.
 *   Sugerido: promedio = vendidas en los últimos DIAS_HISTORIAL / días reales con historial (mínimo 1)
 *             objetivo = max(ceil(promedio × DIAS_COBERTURA), stock mínimo)
 *             pedir    = max(0, objetivo − stock)
 *   Enviado:  queda registrado con su estado para saber si ya llegó.
 */
@Service
public class PedidoService {

    /** `pedir` es lo que se recomienda; `ideal` es lo que pediría sin límite de plata. */
    public record Item(Long productoId, String sabor, int pedir, double promedioDia, long costo, int ideal) {
    }

    public record Linea(Long productoId, String sabor, int cantidad) {
    }

    /** `presupuesto` y `disponible` vienen null si no se pasó plata; `recortado` = la plata no alcanzó para lo ideal. */
    public record PedidoSugerido(List<Item> items, int total, long costoTotal, String mensaje, String link,
                                 boolean tieneProveedor, String resumen,
                                 Long presupuesto, Long disponible, boolean recortado, int dias) {
    }

    public record NuevoItem(@NotNull Long productoId, @Min(1) @Max(1000) int cantidad) {
    }

    public record Armar(@NotEmpty @Size(max = 50) List<@Valid NuevoItem> items) {
    }

    public record PedidoCreado(long id, String estado, int totalUnidades, long costoTotal, String mensaje, String link,
                               boolean tieneProveedor) {
    }

    public record ItemPedidoDto(Long productoId, String sabor, int pedida, int recibida) {
    }

    public record PedidoDto(long id, String estado, Instant creadoEn, Instant recibidoEn,
                            int totalUnidades, long costoTotal, List<ItemPedidoDto> items) {
    }

    public record ItemRecibido(@NotNull Long productoId, @Min(0) @Max(1000) int cantidad) {
    }

    /** pagoLugar (opcional): de dónde salió la plata para pagarle al proveedor. Sin él se asume Nequi. */
    public record Recepcion(@NotBlank @Size(max = 64) String clientUid,
                            @NotEmpty @Size(max = 50) List<@Valid ItemRecibido> items,
                            LugarPlata pagoLugar) {
        public Recepcion(String clientUid, List<ItemRecibido> items) {
            this(clientUid, items, null);
        }
    }

    public enum EstadoRecepcion { REGISTRADA, REPETIDA }

    /** Lo que el celular ve en el banner: hay un pedido en camino. Trae los items para poder recibirlo sin señal. */
    public record PedidoEnCamino(Long id, int totalUnidades, List<ItemPedidoDto> items) {
    }

    /** De la plata que le pasas, este porcentaje se queda en caja y no se gasta en el pedido. */
    static final int RESERVA_PORCENTAJE = 20;

    /** Tope de días de inventario que se puede pedir desde la pantalla. */
    static final int MAX_DIAS_COBERTURA = 30;

    private static final long DIA_MS = Duration.ofDays(1).toMillis();

    private final ProductoRepository productos;
    private final VentaRepository ventas;
    private final AjustesService ajustes;
    private final PedidoProveedorRepository pedidos;
    private final InventarioService inventario;
    private final Clock clock;
    private final PlataService plata;

    public PedidoService(ProductoRepository productos, VentaRepository ventas, AjustesService ajustes,
                         PedidoProveedorRepository pedidos, InventarioService inventario, Clock clock,
                         PlataService plata) {
        this.plata = plata;
        this.productos = productos;
        this.ventas = ventas;
        this.ajustes = ajustes;
        this.pedidos = pedidos;
        this.inventario = inventario;
        this.clock = clock;
    }

    // ------------------------------------------------------------------ sugerido

    @Transactional(readOnly = true)
    public PedidoSugerido sugerido() {
        return sugerido(null, null);
    }

    public PedidoSugerido sugerido(Long presupuesto) {
        return sugerido(presupuesto, null);
    }

    /**
     * Con `presupuesto` (pesos que tienes para el pedido) reparte solo lo que alcanza dejando la reserva.
     * Sin él devuelve lo ideal, como siempre.
     */
    @Transactional(readOnly = true)
    public PedidoSugerido sugerido(Long presupuesto, Integer diasPedidos) {
        if (presupuesto != null && presupuesto < 0) throw new IllegalArgumentException("La plata no puede ser negativa");
        Map<String, String> cfg = ajustes.mapa();
        int diasHistorial = AjustesService.entero(cfg, AjustesService.DIAS_HISTORIAL, 14);
        // Los días que pides en pantalla mandan sobre los de Ajustes, solo para este cálculo
        int diasCobertura = diasPedidos != null && diasPedidos >= 1 && diasPedidos <= MAX_DIAS_COBERTURA
                ? diasPedidos : AjustesService.entero(cfg, AjustesService.DIAS_COBERTURA, 4);

        Instant ahora = clock.instant();
        Instant desde = ahora.minus(Duration.ofDays(diasHistorial));
        Map<Long, Long> vendidas = ventas.unidadesPorProductoDesde(desde).stream()
                .collect(Collectors.toMap(VentaRepository.UnidadesPorProducto::getProductoId,
                        VentaRepository.UnidadesPorProducto::getUnidades));
        // Si llevas menos días vendiendo que la ventana, divide por los días reales
        Instant primera = ventas.primeraDesde(desde).orElse(ahora);
        long diasMs = ahora.toEpochMilli() - primera.toEpochMilli();
        long dias = Math.max(1, Math.min(diasHistorial, (diasMs + DIA_MS - 1) / DIA_MS));

        List<Item> ideales = new ArrayList<>();
        Map<Long, Producto> porId = new LinkedHashMap<>();
        for (Producto p : productos.findByActivoTrueOrderByOrdenAscIdAsc()) {
            Item i = item(p, vendidas.getOrDefault(p.getId(), 0L), dias, diasCobertura);
            if (i.ideal() > 0) {
                ideales.add(i);
                porId.put(p.getId(), p);
            }
        }

        Long disponible = null;
        List<Item> items = ideales;
        if (presupuesto != null) {
            disponible = presupuesto * (100 - RESERVA_PORCENTAJE) / 100;
            items = repartir(ideales, porId, disponible);
        }
        boolean recortado = items.stream().anyMatch(i -> i.pedir() < i.ideal());
        // Con plata definida se dejan también los que quedaron en 0, para poder subirlos a mano
        List<Item> mostrar = new ArrayList<>(presupuesto == null
                ? items.stream().filter(i -> i.pedir() > 0).toList() : items);
        mostrar.sort(Comparator.comparingInt(Item::pedir).reversed());

        List<Item> pedidos = mostrar.stream().filter(i -> i.pedir() > 0).toList();
        int total = pedidos.stream().mapToInt(Item::pedir).sum();
        long costoTotal = pedidos.stream().mapToLong(i -> (long) i.pedir() * i.costo()).sum();
        String lineas = pedidos.stream().map(i -> "• " + i.pedir() + " " + i.sabor()).collect(Collectors.joining("\n"));
        String mensaje = mensaje(pedidos.isEmpty() ? List.of()
                : pedidos.stream().map(i -> new Linea(i.productoId(), i.sabor(), i.pedir())).toList());
        String resumen = pedidos.isEmpty() ? "Todo con stock suficiente." : "Pedido sugerido:\n" + lineas;
        return new PedidoSugerido(mostrar, total, costoTotal, mensaje, link(mensaje), hayProveedor(), resumen,
                presupuesto, disponible, recortado, diasCobertura);
    }

    /**
     * Va dando una unidad a la vez hasta que se acaba la plata.
     * Primero al que está agotado (venta perdida), después al que tiene menos días de venta cubiertos.
     * Nunca pasa de lo ideal de cada sabor. Si a un sabor no le alcanza, lo intenta con los más baratos.
     */
    private static List<Item> repartir(List<Item> ideales, Map<Long, Producto> porId, long disponible) {
        Map<Long, Integer> dado = new LinkedHashMap<>();
        for (Item i : ideales) dado.put(i.productoId(), 0);
        long restante = disponible;

        while (true) {
            Item mejor = null;
            int tierMejor = 0;
            double cobMejor = 0;
            for (Item i : ideales) {
                int ya = dado.get(i.productoId());
                if (ya >= i.ideal() || i.costo() > restante) continue;
                Producto p = porId.get(i.productoId());
                int tenido = p.getStock() + ya;
                int tier = tenido == 0 ? 0 : 1;
                double cob = i.promedioDia() > 0 ? tenido / i.promedioDia() : 1e9;
                boolean gana = mejor == null || tier < tierMejor
                        || (tier == tierMejor && (cob < cobMejor
                        || (cob == cobMejor && i.promedioDia() > mejor.promedioDia())));
                if (gana) {
                    mejor = i;
                    tierMejor = tier;
                    cobMejor = cob;
                }
            }
            if (mejor == null) break;
            dado.merge(mejor.productoId(), 1, Integer::sum);
            restante -= mejor.costo();
        }

        List<Item> resultado = new ArrayList<>();
        for (Item i : ideales) {
            resultado.add(new Item(i.productoId(), i.sabor(), dado.get(i.productoId()), i.promedioDia(), i.costo(), i.ideal()));
        }
        return resultado;
    }

    /** Cuentas con enteros: ceil(vendidas × cobertura / días), sin errores de redondeo de double. */
    private static Item item(Producto p, long vendidas, long dias, int cobertura) {
        long porVentas = (vendidas * cobertura + dias - 1) / dias;
        long objetivo = Math.max(porVentas, p.getStockMinimo());
        int pedir = (int) Math.max(0, objetivo - p.getStock());
        double promedio = Math.round(vendidas * 10.0 / dias) / 10.0;
        return new Item(p.getId(), p.nombre(), pedir, promedio, p.getCosto(), pedir);
    }

    // ------------------------------------------------------------------ texto de WhatsApp

    /** El mensaje vale igual para el sugerido y para el pedido que ya se armó: una sola fuente. */
    @Transactional(readOnly = true)
    public String mensaje(List<Linea> lineas) {
        int total = lineas.stream().mapToInt(Linea::cantidad).sum();
        String texto = lineas.stream().map(l -> "• " + l.cantidad() + " " + l.sabor()).collect(Collectors.joining("\n"));
        String nombre = ajustes.mapa().getOrDefault(AjustesService.NOMBRE, "").trim();
        return ("Hola! Te hago el pedido de esta semana 🙌\n\n" + texto + "\n\nTotal: " + total
                + " unidades.\nGracias!" + (nombre.isEmpty() ? "" : " — " + nombre));
    }

    @Transactional(readOnly = true)
    public String link(String mensaje) {
        String telefono = ajustes.mapa().getOrDefault(AjustesService.PROVEEDOR_WHATSAPP, "").replaceAll("\\D", "");
        if (telefono.isEmpty()) return "";
        return "https://wa.me/" + telefono + "?text=" + URLEncoder.encode(mensaje, StandardCharsets.UTF_8)
                .replace("+", "%20");
    }

    private boolean hayProveedor() {
        return !link("").isEmpty();
    }

    // ------------------------------------------------------------------ pedidos con estado

    /** Crea el pedido con las cantidades que el usuario editó y devuelve el link de WhatsApp. */
    @Transactional
    public PedidoCreado crear(List<NuevoItem> items) {
        if (items.isEmpty()) throw new IllegalArgumentException("El pedido necesita al menos un sabor");

        List<Linea> lineas = new ArrayList<>();
        Map<Long, Producto> porId = new LinkedHashMap<>();
        for (NuevoItem n : items) {
            Producto p = productos.findById(n.productoId())
                    .orElseThrow(() -> new NoEncontradoException("Producto no encontrado: " + n.productoId()));
            if (porId.putIfAbsent(p.getId(), p) != null) {
                throw new IllegalArgumentException("El sabor " + p.nombre() + " está dos veces en el pedido");
            }
            lineas.add(new Linea(p.getId(), p.nombre(), n.cantidad()));
        }

        int total = lineas.stream().mapToInt(Linea::cantidad).sum();
        long costoTotal = lineas.stream().mapToLong(l -> l.cantidad() * porId.get(l.productoId()).getCosto()).sum();
        PedidoProveedor pedido = new PedidoProveedor(EstadoPedido.ENVIADO, total, clock.instant());
        for (Linea l : lineas) {
            pedido.agregarItem(new PedidoItem(porId.get(l.productoId()), l.cantidad()));
        }
        pedidos.saveAndFlush(pedido);

        String mensaje = mensaje(lineas);
        return new PedidoCreado(pedido.getId(), pedido.getEstado().name(), total, costoTotal, mensaje, link(mensaje),
                hayProveedor());
    }

    /** El que está en camino, si hay uno. Es lo que muestra el banner. */
    @Transactional(readOnly = true)
    public PedidoEnCamino enCamino() {
        return pedidos.findFirstByEstadoOrderByCreadoEnDescIdDesc(EstadoPedido.ENVIADO)
                .map(p -> new PedidoEnCamino(p.getId(), p.getTotalUnidades(), dto(p).items()))
                .orElse(null);
    }

    @Transactional(readOnly = true)
    public List<PedidoDto> listar(EstadoPedido estado) {
        List<PedidoProveedor> lista = estado == null ? pedidos.historial() : pedidos.porEstado(estado);
        return lista.stream().map(PedidoService::dto).toList();
    }

    /** Pedidos del periodo, para los reportes. */
    @Transactional(readOnly = true)
    public List<PedidoDto> listarEntre(Instant desde, Instant hasta) {
        return pedidos.entre(desde, hasta).stream().map(PedidoService::dto).toList();
    }

    private static PedidoDto dto(PedidoProveedor p) {
        List<ItemPedidoDto> items = p.getItems().stream()
                .map(i -> new ItemPedidoDto(i.getProducto().getId(), i.getProducto().nombre(),
                        i.getCantidadPedida(), i.getCantidadRecibida()))
                .toList();
        long costoTotal = p.getItems().stream()
                .mapToLong(i -> (long) i.getCantidadPedida() * i.getProducto().getCosto()).sum();
        return new PedidoDto(p.getId(), p.getEstado().name(), p.getCreadoEn(), p.getRecibidoEn(),
                p.getTotalUnidades(), costoTotal, items);
    }

    /**
     * "Llegó el pedido": anota lo que llegó y suma el stock, todo en una transacción.
     * Si el pedido ya estaba recibido no toca nada y responde REPETIDA (el celular puede reintentar sin miedo).
     */
    @Transactional
    public EstadoRecepcion recibir(Long pedidoId, Recepcion r) {
        PedidoProveedor pedido = pedidos.findParaActualizar(pedidoId)
                .orElseThrow(() -> new NoEncontradoException("Pedido no encontrado: " + pedidoId));
        if (pedido.getEstado() == EstadoPedido.RECIBIDO) return EstadoRecepcion.REPETIDA;
        if (pedido.getEstado() == EstadoPedido.CANCELADO) {
            throw new IllegalArgumentException("Ese pedido estaba cancelado, arma uno nuevo");
        }

        Map<Long, Integer> llegadas = new LinkedHashMap<>();
        for (ItemRecibido i : r.items()) llegadas.merge(i.productoId(), i.cantidad(), Integer::sum);

        pedido.setEstado(EstadoPedido.RECIBIDO);
        pedido.setRecibidoEn(clock.instant());
        pedido.setRecibidoUid(r.clientUid());
        for (PedidoItem it : pedido.getItems()) {
            it.setCantidadRecibida(llegadas.getOrDefault(it.getProducto().getId(), 0));
        }
        // Se guarda primero: inventario.sumarStock limpia la sesión y el pedido quedaría suelto
        pedidos.saveAndFlush(pedido);
        // Lo que se le paga al proveedor es lo que llegó, al costo de cada sabor
        long aPagar = pedido.getItems().stream()
                .mapToLong(it -> (long) it.getCantidadRecibida() * it.getProducto().getCosto()).sum();

        for (ItemRecibido i : r.items()) {
            if (i.cantidad() <= 0) continue;
            inventario.registrar(new InventarioService.NuevoMovimiento(
                    r.clientUid() + "-" + i.productoId(), i.productoId(), TipoMovimiento.ENTRADA,
                    i.cantidad(), null, null, pedidoId));
        }
        plata.registrarPagoPedido(pedidoId, aPagar, r.pagoLugar());
        return EstadoRecepcion.REGISTRADA;
    }

    @Transactional
    public EstadoPedido cancelar(Long pedidoId) {
        PedidoProveedor pedido = pedidos.findParaActualizar(pedidoId)
                .orElseThrow(() -> new NoEncontradoException("Pedido no encontrado: " + pedidoId));
        if (pedido.getEstado() == EstadoPedido.RECIBIDO) {
            throw new IllegalArgumentException("Ese pedido ya llegó, no se puede cancelar");
        }
        if (pedido.getEstado() == EstadoPedido.CANCELADO) return EstadoPedido.CANCELADO;
        pedido.setEstado(EstadoPedido.CANCELADO);
        pedidos.saveAndFlush(pedido);
        return EstadoPedido.CANCELADO;
    }
}
