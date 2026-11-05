package co.granizados.pos.equipo;

import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Solo el dueño: los trabajadores no llegan acá (ver RolFiltro). */
@RestController
@RequestMapping("/api/equipo")
public class EquipoController {

    private final EquipoService servicio;

    public EquipoController(EquipoService servicio) {
        this.servicio = servicio;
    }

    @GetMapping
    public List<EquipoService.VendedorDto> listar() {
        return servicio.listar();
    }

    @PostMapping
    public EquipoService.VendedorDto crear(@Valid @RequestBody EquipoService.NuevoVendedor nuevo) {
        return servicio.crear(nuevo);
    }

    @PatchMapping("/{id}")
    public EquipoService.VendedorDto cambiar(@PathVariable Long id, @Valid @RequestBody EquipoService.CambioVendedor cambio) {
        return servicio.cambiar(id, cambio);
    }

    @PutMapping("/{id}/carga")
    public List<EquipoService.FilaCarga> cargar(@PathVariable Long id, @Valid @RequestBody EquipoService.Carga carga) {
        return servicio.cargar(id, carga);
    }

    /** Suma granizados a lo que ya sacó hoy (el PUT de arriba lo reemplaza). */
    @PostMapping("/{id}/carga/agregar")
    public List<EquipoService.FilaCarga> agregarCarga(@PathVariable Long id, @Valid @RequestBody EquipoService.Carga carga) {
        return servicio.agregarCarga(id, carga);
    }

    /** Lo que se le debe desde su último pago y sus pagos recientes. */
    @GetMapping("/{id}/cuenta")
    public EquipoService.Cuenta cuenta(@PathVariable Long id) {
        return servicio.cuenta(id);
    }

    /** "Ya le pagué": guarda el pago y reinicia sus cuentas. */
    @PostMapping("/{id}/pagos")
    public EquipoService.PagoDto pagar(@PathVariable Long id, @Valid @RequestBody EquipoService.NuevoPago nuevo) {
        return servicio.pagar(id, nuevo.metodo(), nuevo.monto());
    }

    @PostMapping("/pagos/{pagoId}/anular")
    public EquipoService.PagoDto anular(@PathVariable Long pagoId) {
        return servicio.anularPago(pagoId);
    }

    /** Sin fechas, las cuentas de hoy. */
    @GetMapping("/liquidacion")
    public List<EquipoService.Liquidacion> liquidacion(@RequestParam(required = false) LocalDate desde,
                                                       @RequestParam(required = false) LocalDate hasta) {
        LocalDate hoy = servicio.hoy();
        LocalDate d = desde != null ? desde : hoy;
        return servicio.liquidar(d, hasta != null ? hasta : (desde != null ? desde : hoy));
    }
}
