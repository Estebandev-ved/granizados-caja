package co.granizados.pos.comun;

/** Formato de plata colombiano: 18000 → "$18.000". */
public final class Pesos {

    private Pesos() {
    }

    public static String formato(long valor) {
        String digitos = String.valueOf(Math.abs(valor));
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < digitos.length(); i++) {
            if (i > 0 && (digitos.length() - i) % 3 == 0) sb.append('.');
            sb.append(digitos.charAt(i));
        }
        return (valor < 0 ? "-$" : "$") + sb;
    }
}
