package co.granizados.pos.producto;

public enum TipoProducto {
    NORMAL, CREMOSO, GRANDE, CERVEZA;

    public String etiqueta() {
        return name().toLowerCase();
    }
}
