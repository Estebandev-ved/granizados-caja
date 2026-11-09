package co.granizados.pos.gasto;

import co.granizados.pos.plata.LugarPlata;
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

/** Un gasto del día. El clientUid es único: el celular puede reintentar sin duplicar. */
@Entity
@Table(name = "gasto")
public class Gasto {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String clientUid;

    /** HIELO, TRANSPORTE… o el nombre que el negocio le haya puesto a una categoría propia. */
    private String categoria;

    private String concepto;

    /** Pesos enteros. */
    private long monto;

    private Instant creadoEn;

    /** De dónde salió la plata: caja (efectivo), casa o Nequi. */
    @Enumerated(EnumType.STRING)
    private LugarPlata lugar;

    /** El negocio dueño de esta fila. Hibernate lo llena y lo filtra solo (ver TenantResolver). */
    @TenantId
    @Column(name = "negocio_id", updatable = false)
    private Long negocioId;

    protected Gasto() {
    }

    public Gasto(String clientUid, String categoria, String concepto, long monto, LugarPlata lugar, Instant creadoEn) {
        this.clientUid = clientUid;
        this.categoria = categoria;
        this.concepto = concepto;
        this.monto = monto;
        this.lugar = lugar;
        this.creadoEn = creadoEn;
    }

    /** El gasto se anotó tarde: pasa al día en que de verdad se hizo. */
    public void moverA(Instant cuando) {
        this.creadoEn = cuando;
    }

    public Long getId() { return id; }
    public String getClientUid() { return clientUid; }
    public String getCategoria() { return categoria; }
    public LugarPlata getLugar() { return lugar; }
    public String getConcepto() { return concepto; }
    public long getMonto() { return monto; }
    public Instant getCreadoEn() { return creadoEn; }
}
