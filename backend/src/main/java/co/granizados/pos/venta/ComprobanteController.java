package co.granizados.pos.venta;

import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

/** Fotos de comprobantes de pago (Nequi, transferencias). Ver ComprobanteService. */
@RestController
@RequestMapping("/api/comprobantes")
public class ComprobanteController {

    private final ComprobanteService servicio;

    public ComprobanteController(ComprobanteService servicio) {
        this.servicio = servicio;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void subir(@Valid @RequestBody ComprobanteService.NuevoComprobante nuevo) {
        servicio.guardar(nuevo);
    }

    @GetMapping("/{ventaUid}")
    public ResponseEntity<byte[]> ver(@PathVariable String ventaUid) {
        ComprobanteService.Foto foto = servicio.leer(ventaUid);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(foto.tipo()))
                .cacheControl(CacheControl.noStore())
                .body(foto.bytes());
    }
}
