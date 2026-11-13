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
        return servicio.pagar(id, nuevo.metodo(), nuevo.monto(), nuevo.montoEfectivo(), Boolean.TRUE.equals(nuevo.quedaDebiendo()),
                nuevo.lugarEfectivo());
    }

    /** «Le presté plata»: sale de Mi plata y se le descuenta en el próximo pago. */
    @PostMapping("/{id}/prestamos")
    public EquipoService.PrestamoDto prestar(@PathVariable Long id, @Valid @RequestBody EquipoService.NuevoPrestamo nuevo) {
        return servicio.prestar(id, nuevo);
    }

    /** Borra un préstamo anotado por error (solo si todavía no se le descontó). */
    @org.springframework.web.bind.annotation.DeleteMapping("/prestamos/{prestamoId}")
    @org.springframework.web.bind.annotation.ResponseStatus(org.springframework.http.HttpStatus.NO_CONTENT)
    public void quitarPrestamo(@PathVariable Long prestamoId) {
        servicio.quitarPrestamo(prestamoId);
    }

    /** Faltaron granizados de su carga al cuadrar: se le descuentan al precio de venta. */
    @PostMapping("/{id}/faltantes")
    public EquipoService.FilaCarga faltante(@PathVariable Long id, @Valid @RequestBody EquipoService.NuevoFaltante nuevo) {
        return servicio.anotarFaltante(id, nuevo);
    }

    /** Lo que dicen las ventas de las últimas semanas para armar premios que convengan (Ajustes → Equipo). */
    @GetMapping("/premios/datos")
    public EquipoService.DatosPremios datosPremios() {
        return servicio.datosPremios();
    }

    /** Cómo viene vendiendo cada trabajador activo y cuánto se hace en un día suyo (para estimar lo que va a ganar). */
    @GetMapping("/proyeccion")
    public java.util.List<EquipoService.Proyeccion> proyecciones() {
        return servicio.proyecciones();
    }

    /** Para Reportes: por trabajador, lo de cada día, sus pagos y sus préstamos en el rango. */
    @GetMapping("/historial")
    public List<EquipoService.Historial> historial(@RequestParam LocalDate desde, @RequestParam LocalDate hasta) {
        return servicio.historial(desde, hasta);
    }

    /** Plata de la caja que le pasas para dar vueltos (se la devuelve al cerrar). */
    @GetMapping("/{id}/base")
    public EquipoService.BaseDia base(@PathVariable Long id) {
        return servicio.baseDia(id);
    }

    @PostMapping("/{id}/base")
    public EquipoService.BaseDia pasarBase(@PathVariable Long id, @Valid @RequestBody EquipoService.NuevaBase nueva) {
        return servicio.pasarBase(id, nueva.monto());
    }

    @org.springframework.web.bind.annotation.DeleteMapping("/base/{baseId}")
    public EquipoService.BaseDia quitarBase(@PathVariable Long baseId) {
        return servicio.quitarBase(baseId);
    }

    /** Lo que el trabajador dice que te entregó, para que confirmes si es verdad. */
    @GetMapping("/{id}/entregas")
    public List<EquipoService.EntregaDto> entregas(@PathVariable Long id) {
        return servicio.entregasDe(id);
    }

    @PostMapping("/entregas/{entregaId}/responder")
    public EquipoService.EntregaDto responderEntrega(@PathVariable Long entregaId, @RequestBody EquipoService.RespuestaEntrega cuerpo) {
        return servicio.responderEntrega(entregaId, cuerpo.recibida());
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
