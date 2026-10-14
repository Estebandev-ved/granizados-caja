package co.granizados.pos.fiado;

import co.granizados.pos.comun.NoEncontradoException;
import co.granizados.pos.plata.LugarPlata;
import co.granizados.pos.plata.PlataService;
import java.time.Clock;
import java.time.Instant;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Los que te deben: lista de pendientes, cobrar (entra la plata) y guardar el celular para recordarles. */
@Service
public class FiadoService {

    public record DeudaDto(Long id, String cliente, String telefono, long monto, String detalle, Instant creadaEn) {
        static DeudaDto de(Deuda d) {
            return new DeudaDto(d.getId(), d.getCliente(), d.getTelefono(), d.getMonto(), d.getDetalle(), d.getCreadaEn());
        }
    }

    private final DeudaRepository deudas;
    private final PlataService plata;
    private final Clock clock;

    public FiadoService(DeudaRepository deudas, PlataService plata, Clock clock) {
        this.deudas = deudas;
        this.plata = plata;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public List<DeudaDto> pendientes() {
        return deudas.findByPagadaEnIsNullOrderByCreadaEnAscIdAsc().stream().map(DeudaDto::de).toList();
    }

    /** Guarda el celular (solo dígitos) para el recordatorio; vacío lo borra. */
    @Transactional
    public DeudaDto telefono(Long id, String telefono) {
        Deuda d = buscar(id);
        String limpio = telefono == null ? "" : telefono.replaceAll("\\D", "");
        if (limpio.length() > 15) throw new IllegalArgumentException("Ese número es muy largo");
        d.setTelefono(limpio.isEmpty() ? null : limpio);
        return DeudaDto.de(deudas.saveAndFlush(d));
    }

    /**
     * Marca el fiado como cobrado y entra la plata al lugar elegido. La venta ya sumó a la ganancia el día que se
     * fió, por eso el ingreso no cuenta como ganancia otra vez. Cobrar dos veces no duplica la plata.
     */
    @Transactional
    public DeudaDto cobrar(Long id, LugarPlata lugar, String clientUid) {
        Deuda d = buscar(id);
        if (d.estaPagada()) return DeudaDto.de(d);
        d.setPagadaEn(clock.instant());
        deudas.saveAndFlush(d);
        plata.registrarIngreso(new PlataService.NuevoIngreso(clientUid, "Fiado cobrado · " + d.getCliente(),
                d.getMonto(), lugar, null, false));
        return DeudaDto.de(d);
    }

    private Deuda buscar(Long id) {
        return deudas.findById(id).orElseThrow(() -> new NoEncontradoException("Fiado no encontrado: " + id));
    }
}
