package co.granizados.pos.producto;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "producto")
public class Producto {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String sabor;

    @Enumerated(EnumType.STRING)
    private TipoProducto tipo;

    /** Pesos enteros. */
    private long precio;

    /** Cuánto cuesta comprarlo: también pesos enteros. Sirve para saber cuánto se gana. */
    private long costo;

    /** Se modifica solo con UPDATE atómicos del repositorio (ver ProductoRepository.sumarStock). */
    private int stock;

    private int stockMinimo;

    private boolean activo = true;

    private int orden;

    protected Producto() {
    }

    public Producto(String sabor, TipoProducto tipo, long precio, int stockMinimo, int orden) {
        this.sabor = sabor;
        this.tipo = tipo;
        this.precio = precio;
        this.stockMinimo = stockMinimo;
        this.orden = orden;
    }

    /** "Smirnoff", o "Piña colada cremoso" si no es normal. */
    public String nombre() {
        return tipo == TipoProducto.NORMAL ? sabor : sabor + " " + tipo.etiqueta();
    }

    public Long getId() { return id; }
    public String getSabor() { return sabor; }
    public TipoProducto getTipo() { return tipo; }
    public long getPrecio() { return precio; }
    public long getCosto() { return costo; }
    public int getStock() { return stock; }
    public int getStockMinimo() { return stockMinimo; }
    public boolean isActivo() { return activo; }
    public int getOrden() { return orden; }

    public void setSabor(String sabor) { this.sabor = sabor; }
    public void setTipo(TipoProducto tipo) { this.tipo = tipo; }
    public void setPrecio(long precio) { this.precio = precio; }
    public void setCosto(long costo) { this.costo = costo; }
    public void setStockMinimo(int stockMinimo) { this.stockMinimo = stockMinimo; }
    public void setActivo(boolean activo) { this.activo = activo; }
    public void setOrden(int orden) { this.orden = orden; }
}
