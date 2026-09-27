package co.granizados.pos.producto;

public record ProductoDto(Long id, String sabor, TipoProducto tipo, String nombre, long precio, long costo,
                          int stock, int stockMinimo, boolean activo, int orden) {

    public static ProductoDto de(Producto p) {
        return new ProductoDto(p.getId(), p.getSabor(), p.getTipo(), p.nombre(), p.getPrecio(), p.getCosto(),
                p.getStock(), p.getStockMinimo(), p.isActivo(), p.getOrden());
    }
}
