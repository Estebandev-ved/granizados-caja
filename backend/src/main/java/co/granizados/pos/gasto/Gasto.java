package co.granizados.pos.gasto;

import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/** Un gasto del día. El clientUid es único: el celular puede reintentar sin duplicar. */
@Entity
@Table(name = "gasto")
public class Gasto {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String clientUid;

    @Enumerated(EnumType.STRING)
    private CategoriaGasto categoria;

    private String concepto;

    /** Pesos enteros. */
    private long monto;

    private Instant creadoEn;

    protected Gasto() {
    }

    public Gasto(String clientUid, CategoriaGasto categoria, String concepto, long monto, Instant creadoEn) {
        this.clientUid = clientUid;
        this.categoria = categoria;
        this.concepto = concepto;
        this.monto = monto;
        this.creadoEn = creadoEn;
    }

    public Long getId() { return id; }
    public String getClientUid() { return clientUid; }
    public CategoriaGasto getCategoria() { return categoria; }
    public String getConcepto() { return concepto; }
    public long getMonto() { return monto; }
    public Instant getCreadoEn() { return creadoEn; }
}
