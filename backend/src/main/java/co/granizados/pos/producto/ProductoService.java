package co.granizados.pos.producto;

import co.granizados.pos.comun.NoEncontradoException;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProductoService {

    public record DatosProducto(
            @NotBlank @Size(max = 80) String sabor,
            @NotNull TipoProducto tipo,
            @PositiveOrZero @Max(1_000_000) long precio,
            @PositiveOrZero @Max(1_000_000) Long costo,
            @PositiveOrZero @Max(1000) int stockMinimo,
            Boolean activo,
            Integer orden) {
    }

    private final ProductoRepository productos;

    public ProductoService(ProductoRepository productos) {
        this.productos = productos;
    }

    @Transactional(readOnly = true)
    public List<ProductoDto> todos() {
        return productos.findAllByOrderByOrdenAscIdAsc().stream().map(ProductoDto::de).toList();
    }

    @Transactional
    public ProductoDto crear(DatosProducto d) {
        int orden = d.orden() != null ? d.orden() : productos.maxOrden() + 1;
        Producto p = new Producto(d.sabor().trim(), d.tipo(), d.precio(), d.stockMinimo(), orden);
        if (d.costo() != null) p.setCosto(d.costo());
        if (d.activo() != null) p.setActivo(d.activo());
        return ProductoDto.de(productos.saveAndFlush(p));
    }

    /** No se borran productos (tienen ventas históricas): se desactivan con activo=false. */
    @Transactional
    public ProductoDto editar(Long id, DatosProducto d) {
        Producto p = productos.findById(id).orElseThrow(() -> new NoEncontradoException("Producto no encontrado: " + id));
        p.setSabor(d.sabor().trim());
        p.setTipo(d.tipo());
        p.setPrecio(d.precio());
        if (d.costo() != null) p.setCosto(d.costo());
        p.setStockMinimo(d.stockMinimo());
        if (d.activo() != null) p.setActivo(d.activo());
        if (d.orden() != null) p.setOrden(d.orden());
        return ProductoDto.de(productos.saveAndFlush(p));
    }
}
