package co.granizados.pos.notificacion;

import co.granizados.pos.caja.Arqueo;
import co.granizados.pos.caja.ArqueoService;
import co.granizados.pos.comun.Pesos;
import co.granizados.pos.pedido.PedidoService;
import co.granizados.pos.resumen.EstadoService;
import co.granizados.pos.venta.StockBajo;
import java.time.LocalDate;
import java.time.format.TextStyle;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;

/** Textos de los avisos. Separados del envío para poder probarlos. */
@Service
public class Reportes {

    public record Aviso(String asunto, String texto) {
    }

    private static final String SALTO = "\n";

    private final EstadoService estado;
    private final PedidoService pedidos;
    private final ArqueoService arqueos;

    public Reportes(EstadoService estado, PedidoService pedidos, ArqueoService arqueos) {
        this.estado = estado;
        this.pedidos = pedidos;
        this.arqueos = arqueos;
    }

    /** Cierre de caja del día. Vacío si no hubo ventas. */
    public Optional<Aviso> cierreDelDia() {
        EstadoService.ResumenDia h = estado.resumenDe(estado.hoy());
        if (h.unidades() == 0) return Optional.empty();
        String top = h.porSabor().stream().limit(3)
                .map(s -> s.sabor() + " (" + s.unidades() + ")").collect(Collectors.joining(", "));
        StringBuilder texto = new StringBuilder("Vendiste " + h.unidades() + " granizados: " + Pesos.formato(h.total())
                + "\n• Nequi: " + Pesos.formato(h.nequi())
                + "\n• Efectivo: " + Pesos.formato(h.efectivo()) + " (esto debe haber en caja)"
                + "\n• Lo que costó: " + Pesos.formato(h.costo()));
        if (h.gastos() > 0) texto.append("\n• Gastos: ").append(Pesos.formato(h.gastos()));
        if (h.mermas() > 0) texto.append("\n• Mermas: ").append(Pesos.formato(h.mermas()));
        texto.append("\nGanancia: ").append(Pesos.formato(h.ganancia()));
        arqueos.porDia(estado.hoy()).ifPresent(a -> texto.append(lineaDeCaja(a)));
        texto.append("\nTop: ").append(top);
        return Optional.of(new Aviso("💰 Cierre del día", texto.toString()));
    }

    /** Pedido de la semana con el link de WhatsApp listo. No le escribe al proveedor: tú confirmas y envías. */
    /** Qué decir del cierre: cuadró, o cuánto faltó o sobró. */
    private static String lineaDeCaja(Arqueo a) {
        long d = a.getDiferencia();
        if (d == 0) return "\nCaja: cuadró";
        return "\n" + (d < 0 ? "Faltaron " : "Sobraron ") + Pesos.formato(Math.abs(d));
    }

    /** Resumen de los últimos 7 días (hasta ayer) frente a los 7 anteriores. Vacío si no hubo ventas. */
    public Optional<Aviso> resumenSemanal() {
        LocalDate hoy = estado.hoy();
        long total = 0;
        long ganancia = 0;
        int unidades = 0;
        long mejorTotal = -1;
        LocalDate mejorDia = null;
        Map<String, Integer> sabores = new LinkedHashMap<>();
        for (int i = 1; i <= 7; i++) {
            LocalDate dia = hoy.minusDays(i);
            EstadoService.ResumenDia h = estado.resumenDe(dia);
            total += h.total();
            ganancia += h.ganancia();
            unidades += h.unidades();
            if (h.total() > mejorTotal) {
                mejorTotal = h.total();
                mejorDia = dia;
            }
            h.porSabor().forEach(s -> sabores.merge(s.sabor(), s.unidades(), Integer::sum));
        }
        if (unidades == 0) return Optional.empty();
        long anterior = 0;
        for (int i = 8; i <= 14; i++) anterior += estado.resumenDe(hoy.minusDays(i)).total();

        String top = sabores.entrySet().stream().sorted(Map.Entry.<String, Integer>comparingByValue().reversed()).limit(3)
                .map(e -> e.getKey() + " (" + e.getValue() + ")").collect(Collectors.joining(", "));
        StringBuilder texto = new StringBuilder("Esta semana vendiste " + unidades + " unidades: " + Pesos.formato(total)
                + SALTO + "• Ganancia: " + Pesos.formato(ganancia)
                + SALTO + "• Mejor día: " + mejorDia.getDayOfWeek().getDisplayName(TextStyle.FULL, Locale.of("es", "CO"))
                + " (" + Pesos.formato(mejorTotal) + ")"
                + SALTO + "• Lo más vendido: " + top);
        if (anterior > 0) {
            long cambio = Math.round((total - anterior) * 100.0 / anterior);
            texto.append(SALTO).append(cambio >= 0 ? "📈 " : "📉 ").append(Math.abs(cambio)).append("% ")
                    .append(cambio >= 0 ? "más" : "menos").append(" que la semana anterior");
        }
        return Optional.of(new Aviso("📊 Tu semana", texto.toString()));
    }

    public Aviso pedidoSemanal() {
        PedidoService.PedidoSugerido p = pedidos.sugerido();
        if (p.total() == 0) {
            return new Aviso("🧊 Pedido semanal", "Esta semana no hace falta pedir nada. Inventario al día.");
        }
        String destino = p.tieneProveedor()
                ? "👉 Mandárselo al proveedor:\n" + p.link()
                : "(Pon el WhatsApp del proveedor en Ajustes para tener el link directo)";
        String costo = p.costoTotal() > 0
                ? "\n💵 Vas a pagarle " + Pesos.formato(p.costoTotal()) + " a Energy Cocktails"
                : "";
        return new Aviso("🧊 Pedido semanal sugerido", p.mensaje() + costo + "\n\n" + destino);
    }

    public Aviso stockBajo(StockBajo e) {
        return new Aviso("⚠️ Stock bajo: " + e.nombre(),
                "Quedan " + e.quedan() + " de " + e.nombre() + " (mínimo " + e.minimo() + ").\n\n"
                        + pedidos.sugerido().resumen());
    }
}
