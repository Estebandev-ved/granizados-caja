package co.granizados.pos.seguridad.passkey;

import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;

/** Una llave de Face ID registrada (una por celular). Solo se guarda la llave pública. */
@Entity
@Table(name = "passkey")
public class Passkey {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** base64url */
    private String credentialId;

    /** Llave pública en formato COSE, en base64url. */
    private String publicKeyCose;

    private long signCount;

    private String nombre;

    private Instant creadaEn;

    private Instant usadaEn;

    protected Passkey() {
    }

    public Passkey(String credentialId, String publicKeyCose, long signCount, String nombre, Instant creadaEn) {
        this.credentialId = credentialId;
        this.publicKeyCose = publicKeyCose;
        this.signCount = signCount;
        this.nombre = nombre;
        this.creadaEn = creadaEn;
    }

    public void usada(long signCount, Instant cuando) {
        this.signCount = signCount;
        this.usadaEn = cuando;
    }

    public Long getId() { return id; }
    public String getCredentialId() { return credentialId; }
    public String getPublicKeyCose() { return publicKeyCose; }
    public long getSignCount() { return signCount; }
    public String getNombre() { return nombre; }
    public Instant getCreadaEn() { return creadaEn; }
    public Instant getUsadaEn() { return usadaEn; }
}
