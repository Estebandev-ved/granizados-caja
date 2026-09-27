package co.granizados.pos.producto;

import jakarta.validation.Valid;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/productos")
public class ProductoController {

    private final ProductoService servicio;

    public ProductoController(ProductoService servicio) {
        this.servicio = servicio;
    }

    @GetMapping
    public List<ProductoDto> todos() {
        return servicio.todos();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public ProductoDto crear(@Valid @RequestBody ProductoService.DatosProducto datos) {
        return servicio.crear(datos);
    }

    @PutMapping("/{id}")
    public ProductoDto editar(@PathVariable Long id, @Valid @RequestBody ProductoService.DatosProducto datos) {
        return servicio.editar(id, datos);
    }
}
