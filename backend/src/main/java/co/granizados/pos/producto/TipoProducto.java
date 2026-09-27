package co.granizados.pos.producto;

public enum TipoProducto {
    NORMAL, CREMOSO, GRANDE;

    public String etiqueta() {
        return name().toLowerCase();
    }
}
