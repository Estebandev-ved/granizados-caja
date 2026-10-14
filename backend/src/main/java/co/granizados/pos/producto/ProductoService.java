package co.granizados.pos.producto;

import co.granizados.pos.comun.NoEncontradoException;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;
import java.util.List;
import org.springframework.jdbc.core.JdbcTemplate;
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

    /** Qué pasó con el sabor: se borró del todo o, como tiene historial, solo se ocultó. */
    public record ResultadoEliminar(boolean borrado, ProductoDto producto) {
    }

    private final ProductoRepository productos;
    private final JdbcTemplate jdbc;

    public ProductoService(ProductoRepository productos, JdbcTemplate jdbc) {
        this.productos = productos;
        this.jdbc = jdbc;
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

    /**
     * Quita un sabor que ya no tienes (sin stock). Si nunca tuvo ventas, entradas ni pedidos se borra de verdad;
     * si tiene historial se oculta, porque los reportes y la ganancia lo necesitan.
     */
    @Transactional
    public ResultadoEliminar eliminar(Long id) {
        Producto p = productos.findById(id).orElseThrow(() -> new NoEncontradoException("Producto no encontrado: " + id));
        if (p.getStock() > 0) {
            throw new IllegalArgumentException("Todavía tienes " + p.getStock() + " en stock. Cuéntalo en 0 o véndelo primero.");
        }
        // El id ya pasó por el filtro de negocio de findById, por eso esta consulta directa no cruza datos
        Long usos = jdbc.queryForObject(
                "select (select count(*) from venta where producto_id = ?)"
                        + " + (select count(*) from entrada_inventario where producto_id = ?)"
                        + " + (select count(*) from pedido_item where producto_id = ?)",
                Long.class, id, id, id);
        if (usos != null && usos > 0) {
            p.setActivo(false);
            return new ResultadoEliminar(false, ProductoDto.de(productos.saveAndFlush(p)));
        }
        productos.delete(p);
        productos.flush();
        return new ResultadoEliminar(true, null);
    }
}
