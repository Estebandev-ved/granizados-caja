package co.granizados.pos.seguridad.passkey;

import java.io.ByteArrayOutputStream;
import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.security.Signature;
import java.security.interfaces.ECPublicKey;
import java.security.spec.ECGenParameterSpec;
import java.util.Arrays;
import java.util.Base64;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Hace lo mismo que el Face ID del iPhone, pero en software, para poder probar el servidor:
 * crea una llave P-256, arma la respuesta de registro ("none") y firma los retos de entrada.
 */
class AutenticadorFalso {

    static final String ORIGEN = "http://localhost:5173";
    static final String RP_ID = "localhost";

    private final KeyPair llaves;
    private final byte[] credentialId = new byte[16];
    private int contador;

    AutenticadorFalso() throws Exception {
        KeyPairGenerator g = KeyPairGenerator.getInstance("EC");
        g.initialize(new ECGenParameterSpec("secp256r1"));
        llaves = g.generateKeyPair();
        new SecureRandom().nextBytes(credentialId);
    }

    /** Respuesta a navigator.credentials.create(), como la manda el navegador. */
    String registrar(String opcionesJson) throws Exception {
        byte[] clientData = clientData("webauthn.create", reto(opcionesJson));

        ByteArrayOutputStream auth = new ByteArrayOutputStream();
        auth.write(sha256(RP_ID.getBytes(StandardCharsets.UTF_8)));
        auth.write(0x45); // presencia (UP) + verificación biométrica (UV) + trae la llave (AT)
        auth.write(entero4(0));
        auth.write(new byte[16]); // AAGUID
        auth.write(credentialId.length >> 8);
        auth.write(credentialId.length & 0xff);
        auth.write(credentialId);
        auth.write(llaveCose());

        ByteArrayOutputStream att = new ByteArrayOutputStream();
        att.write(0xA3); // mapa CBOR de 3 elementos
        textoCbor(att, "fmt");
        textoCbor(att, "none");
        textoCbor(att, "attStmt");
        att.write(0xA0); // mapa vacío
        textoCbor(att, "authData");
        bytesCbor(att, auth.toByteArray());

        return """
                {"id":"%1$s","rawId":"%1$s","type":"public-key",
                 "response":{"clientDataJSON":"%2$s","attestationObject":"%3$s","transports":["internal"]},
                 "clientExtensionResults":{}}"""
                .formatted(b64(credentialId), b64(clientData), b64(att.toByteArray()));
    }

    /** Respuesta a navigator.credentials.get(): firma el reto. */
    String firmar(String opcionesJson) throws Exception {
        byte[] clientData = clientData("webauthn.get", reto(opcionesJson));

        ByteArrayOutputStream auth = new ByteArrayOutputStream();
        auth.write(sha256(RP_ID.getBytes(StandardCharsets.UTF_8)));
        auth.write(0x05); // UP + UV
        auth.write(entero4(++contador));
        byte[] authData = auth.toByteArray();

        Signature firma = Signature.getInstance("SHA256withECDSA");
        firma.initSign(llaves.getPrivate());
        firma.update(authData);
        firma.update(sha256(clientData));

        return """
                {"id":"%1$s","rawId":"%1$s","type":"public-key",
                 "response":{"clientDataJSON":"%2$s","authenticatorData":"%3$s","signature":"%4$s","userHandle":"%5$s"},
                 "clientExtensionResults":{}}"""
                .formatted(b64(credentialId), b64(clientData), b64(authData), b64(firma.sign()),
                        RepositorioCredenciales.USER_HANDLE.getBase64Url());
    }

    static String reto(String json) {
        Matcher m = Pattern.compile("\"challenge\"\\s*:\\s*\"([^\"]+)\"").matcher(json);
        if (!m.find()) throw new IllegalArgumentException("Sin challenge: " + json);
        return m.group(1);
    }

    private static byte[] clientData(String tipo, String reto) {
        return ("{\"type\":\"" + tipo + "\",\"challenge\":\"" + reto + "\",\"origin\":\"" + ORIGEN + "\",\"crossOrigin\":false}")
                .getBytes(StandardCharsets.UTF_8);
    }

    /** Llave pública EC2 P-256 en COSE: {1:2, 3:-7, -1:1, -2:x, -3:y} */
    private byte[] llaveCose() throws Exception {
        ECPublicKey pub = (ECPublicKey) llaves.getPublic();
        ByteArrayOutputStream c = new ByteArrayOutputStream();
        c.write(new byte[] {(byte) 0xA5, 0x01, 0x02, 0x03, 0x26, 0x20, 0x01});
        c.write(0x21);
        bytesCbor(c, a32(pub.getW().getAffineX()));
        c.write(0x22);
        bytesCbor(c, a32(pub.getW().getAffineY()));
        return c.toByteArray();
    }

    private static byte[] a32(BigInteger n) {
        byte[] b = n.toByteArray();
        if (b.length == 32) return b;
        byte[] r = new byte[32];
        if (b.length > 32) System.arraycopy(b, b.length - 32, r, 0, 32);
        else System.arraycopy(b, 0, r, 32 - b.length, b.length);
        return r;
    }

    private static void textoCbor(ByteArrayOutputStream o, String s) {
        byte[] b = s.getBytes(StandardCharsets.UTF_8);
        o.write(0x60 + b.length);
        o.writeBytes(b);
    }

    private static void bytesCbor(ByteArrayOutputStream o, byte[] b) {
        if (b.length < 24) {
            o.write(0x40 + b.length);
        } else if (b.length < 256) {
            o.write(0x58);
            o.write(b.length);
        } else {
            o.write(0x59);
            o.write(b.length >> 8);
            o.write(b.length & 0xff);
        }
        o.writeBytes(b);
    }

    private static byte[] entero4(int n) {
        return new byte[] {(byte) (n >> 24), (byte) (n >> 16), (byte) (n >> 8), (byte) n};
    }

    private static byte[] sha256(byte[] b) throws Exception {
        return MessageDigest.getInstance("SHA-256").digest(b);
    }

    private static String b64(byte[] b) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(b);
    }

    byte[] credentialId() {
        return Arrays.copyOf(credentialId, credentialId.length);
    }
}
