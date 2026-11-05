package co.granizados.pos.equipo;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import org.hibernate.annotations.TenantId;

/**
 * Un pago de comisiones y premios a un trabajador. Marca un corte: las cuentas de ese trabajador vuelven a empezar
 * después de `hasta`. El trabajador responde si le llegó; en efectivo firma el paz y salvo (texto exacto + nombre + hora).
 */
@Entity
@Table(name = "pago_vendedor")
public class PagoVendedor {

    public enum Metodo { EFECTIVO, NEQUI }

    public enum Estado { PENDIENTE, CONFIRMADO, DISPUTADO, ANULADO }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long vendedorId;

    @Enumerated(EnumType.STRING)
    private Metodo metodo;

    @Enumerated(EnumType.STRING)
    private Estado estado;

    private long monto;
    private long comision;
    private long bonos;
    private int unidades;
    private long totalVendido;
    private long efectivo;

    private Instant desde;
    private Instant hasta;
    private Instant creadoEn;
    private Instant respondidoEn;

    @Column(length = 4000)
    private String texto;

    @Column(length = 80)
    private String firma;

    @TenantId
    @Column(name = "negocio_id", updatable = false)
    private Long negocioId;

    protected PagoVendedor() {
    }

    public PagoVendedor(Long vendedorId, Metodo metodo, long monto, long comision, long bonos, int unidades, long totalVendido,
                        long efectivo, Instant desde, Instant hasta, Instant creadoEn, String texto) {
        this.vendedorId = vendedorId;
        this.metodo = metodo;
        this.estado = Estado.PENDIENTE;
        this.comision = comision;
        this.bonos = bonos;
        this.monto = monto;
        this.unidades = unidades;
        this.totalVendido = totalVendido;
        this.efectivo = efectivo;
        this.desde = desde;
        this.hasta = hasta;
        this.creadoEn = creadoEn;
        this.texto = texto;
    }

    public void responder(Estado nuevo, String firma, Instant cuando) {
        this.estado = nuevo;
        this.firma = firma;
        this.respondidoEn = cuando;
    }

    public void anular() {
        this.estado = Estado.ANULADO;
    }

    public Long getId() { return id; }
    public Long getVendedorId() { return vendedorId; }
    public Metodo getMetodo() { return metodo; }
    public Estado getEstado() { return estado; }
    public long getMonto() { return monto; }
    public long getComision() { return comision; }
    public long getBonos() { return bonos; }
    public int getUnidades() { return unidades; }
    public long getTotalVendido() { return totalVendido; }
    public long getEfectivo() { return efectivo; }
    public Instant getDesde() { return desde; }
    public Instant getHasta() { return hasta; }
    public Instant getCreadoEn() { return creadoEn; }
    public Instant getRespondidoEn() { return respondidoEn; }
    public String getTexto() { return texto; }
    public String getFirma() { return firma; }
}
