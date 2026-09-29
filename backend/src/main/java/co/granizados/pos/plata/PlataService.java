package co.granizados.pos.plata;

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
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Cuánta plata hay y dónde. Parte del último conteo que hiciste y le suma o resta lo que pasó después:
 *   caja  = conteo + ventas en efectivo + ingresos a la caja − gastos − pagos al proveedor desde la caja
 *   casa  = conteo + ingresos a la casa − pagos al proveedor desde la casa
 *   nequi = conteo + ventas por Nequi + ingresos a Nequi − pagos al proveedor desde Nequi
 * Los gastos se asumen pagados con efectivo de la caja. Si no coincide con la realidad, se cuenta de nuevo.
 * Nada de esto toca la ganancia ni los reportes.
 */
@Service
public class PlataService {

    public record NuevoIngreso(
            @NotBlank @Size(max = 64) String clientUid,
            @Size(max = 120) String concepto,
            @Positive @Max(1_000_000_000) long monto,
            @NotNull LugarPlata lugar,
            Instant creadoEn) {
    }

    public record NuevoConteo(
            @NotBlank @Size(max = 64) String clientUid,
            @Min(0) @Max(1_000_000_000) long caja,
            @Min(0) @Max(1_000_000_000) long casa,
            @Min(0) @Max(1_000_000_000) long nequi) {
    }

    public record IngresoDto(String clientUid, String concepto, long monto, LugarPlata lugar, Instant creadoEn) {
    }

    /** `contadoEn` es null si todavía no has contado nada: en ese caso los montos son 0 y no significan nada. */
    public record Saldo(long caja, long casa, long nequi, long total, Instant contadoEn, List<IngresoDto> ingresos) {
    }

    public enum Resultado { REGISTRADA, REPETIDA }

    /** Mismo criterio que ventas y gastos: la hora la manda el celular, pero no más de 3 días atrás. */
    static final Duration MAX_ATRASO = Duration.ofDays(3);

    private final IngresoRepository ingresos;
    private final ConteoPlataRepository conteos;
    private final PagoProveedorRepository pagos;
    private final VentaRepository ventas;
    private final GastoRepository gastos;
    private final Clock clock;

    public PlataService(IngresoRepository ingresos, ConteoPlataRepository conteos, PagoProveedorRepository pagos,
                        VentaRepository ventas, GastoRepository gastos, Clock clock) {
        this.ingresos = ingresos;
        this.conteos = conteos;
        this.pagos = pagos;
        this.ventas = ventas;
        this.gastos = gastos;
        this.clock = clock;
    }

    @Transactional
    public Resultado registrarIngreso(NuevoIngreso n) {
        if (ingresos.existsByClientUid(n.clientUid())) return Resultado.REPETIDA;
        String concepto = n.concepto() == null ? "" : n.concepto().trim();
        ingresos.saveAndFlush(new Ingreso(n.clientUid(), concepto, n.monto(), n.lugar(), cuando(n.creadoEn())));
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

    /** Se llama al recibir un pedido. Uno por pedido: si ya estaba, no escribe otra vez. */
    @Transactional
    public void registrarPagoPedido(Long pedidoId, long monto, LugarPlata lugar) {
        if (monto <= 0 || pagos.existsByPedidoId(pedidoId)) return;
        pagos.save(new PagoProveedor(pedidoId, monto, lugar == null ? LugarPlata.NEQUI : lugar, clock.instant()));
    }

    @Transactional(readOnly = true)
    public Saldo saldo() {
        List<IngresoDto> recientes = ingresos.findTop10ByOrderByCreadoEnDescIdDesc().stream()
                .map(i -> new IngresoDto(i.getClientUid(), i.getConcepto(), i.getMonto(), i.getLugar(), i.getCreadoEn()))
                .toList();
        Optional<ConteoPlata> ultimo = conteos.findFirstByOrderByCreadoEnDescIdDesc();
        if (ultimo.isEmpty()) return new Saldo(0, 0, 0, 0, null, recientes);

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
        return new Saldo(caja, casa, nequi, caja + casa + nequi, desde, recientes);
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
