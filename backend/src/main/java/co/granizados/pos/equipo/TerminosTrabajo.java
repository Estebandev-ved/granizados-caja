package co.granizados.pos.equipo;

import co.granizados.pos.comun.Pesos;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;

/**
 * Los términos del trabajo, armados con las tarifas y premios que el dueño tiene hoy en Ajustes. Como el texto sale de
 * esos valores, su huella (la versión) cambia cuando cambian, y el trabajador tiene que aceptarlos otra vez.
 */
final class TerminosTrabajo {

    record Seccion(String titulo, List<String> lineas) {
    }

    private TerminosTrabajo() {
    }

    static List<Seccion> armar(Map<String, String> cfg, int comisionPct) {
        String negocio = cfg.getOrDefault("NOMBRE", "").isBlank() ? "el negocio" : cfg.get("NOMBRE").trim();
        List<Seccion> secciones = new ArrayList<>();

        secciones.add(new Seccion("Antes de empezar", List.of(
                "Este es el acuerdo para trabajar vendiendo granizados con " + negocio + ".",
                "Léelo con calma. Al aceptarlo confirmas que lo leíste, que lo entendiste y que estás de acuerdo.")));

        secciones.add(new Seccion("Tu trabajo", List.of(
                "Vendes los granizados que te entregan y registras cada venta en la app en el momento en que la haces.",
                "Los sabores con licor se venden solo a mayores de edad. Si dudas, pide el documento.",
                "No se fía: cada venta se paga en el momento, en efectivo o por Nequi.",
                "Trabajas tu día en el puesto y ganas por lo que vendes tú, no por lo que vende otra persona.",
                "Cuida el producto y el puesto: de eso vivimos todos.")));

        List<String> ganas = new ArrayList<>();
        List<String> tarifas = new ArrayList<>();
        tarifa(tarifas, "Normal", cfg.get("COMISION_NORMAL"));
        tarifa(tarifas, "Cremoso", cfg.get("COMISION_CREMOSO"));
        tarifa(tarifas, "Grande", cfg.get("COMISION_GRANDE"));
        tarifa(tarifas, "cerveza", cfg.get("COMISION_CERVEZA"));
        if (tarifas.isEmpty()) {
            ganas.add("Ganas el " + comisionPct + " % de lo que vendes.");
        } else {
            ganas.add("Por cada granizado que vendes ganas: " + String.join(", ", tarifas) + ".");
        }
        int enPromo = numero(cfg.get("COMISION_PROMO"), 0);
        if (enPromo > 0 && !tarifas.isEmpty()) {
            ganas.add("Los días de promoción (por ejemplo, 2 por $10.000) ganas " + Pesos.formato(enPromo)
                    + " por cada granizado que vendes en la promo, porque ese día el margen es menor.");
        }
        List<Escalones.Escalon> escalones = Escalones.leer(cfg.get("PREMIOS_ESCALONES"));
        if (!escalones.isEmpty()) {
            ganas.add("Además hay premios del día: mientras más granizados vendes, más ganas. Los montos pueden variar"
                    + " (por ejemplo, los días de promoción son un poco menores) y siempre los ves en la barra de premios de la app.");
            ganas.add("El premio es por día y cuenta solo lo que vendes tú.");
        }
        ganas.add("Lo que ganas se descuenta del efectivo que entregas al cerrar el día. Lo ves en Mi día.");
        ganas.add("Tú escoges cada cuánto te pagamos: cada día, cada semana o cada quincena. Lo puedes cambiar hablando con el dueño.");
        secciones.add(new Seccion("Lo que ganas", ganas));

        secciones.add(new Seccion("El efectivo y el producto", List.of(
                "Cuenta lo que te entregan cuando lo recibes.",
                "Cuando te paguen por Nequi o por transferencia, toma la foto del comprobante en la app al anotar la venta.",
                "Al terminar tocas \"Terminé mi día\" y entregas el efectivo que te muestra la app. El Nequi entra directo a la cuenta del negocio.",
                "Al final se cuadran las cuentas: lo que te entregaron, lo que vendiste, lo que te tomaste y lo que devuelves.",
                "Si las cuentas no dan, lo revisamos juntos con calma para ver qué pudo pasar.",
                "Si falta producto y no hay cómo explicarlo, cada granizado que falte se te descuenta de tu pago al precio de venta"
                        + " (no al precio al que lo compramos).")));

        secciones.add(new Seccion("Préstamos", List.of(
                "Si te prestamos plata (un adelanto), queda anotado en la app con la fecha y el monto.",
                "Se te descuenta de tu próximo pago. Lo ves en Mi día mientras esté pendiente.")));

        int gratis = numero(cfg.get("GRANIZADOS_GRATIS"), 1);
        List<String> tuyo = new ArrayList<>();
        if (gratis > 0) {
            tuyo.add("Te lo ganaste: puedes tomarte " + (gratis == 1 ? "1 granizado" : gratis + " granizados")
                    + " por día de trabajo, sin costo.");
            tuyo.add("Del siguiente en adelante se cobra al precio de venta. Lo anotas en la app con \"Me lo tomo yo\" y se descuenta de tu pago.");
        } else {
            tuyo.add("Los granizados del puesto son para vender. Si te tomas uno, lo anotas con \"Me lo tomo yo\": se cobra al precio de venta y se descuenta de tu pago.");
        }
        secciones.add(new Seccion("Tu granizado", tuyo));

        secciones.add(new Seccion("Cambios y salida", List.of(
                "Si cambian las tarifas o los premios, te mostramos los términos nuevos y los aceptas otra vez. Lo que ya vendiste se paga con las tarifas con las que lo vendiste.",
                "Cualquiera de los dos puede terminar este acuerdo avisando. Los días ya trabajados siempre se pagan.",
                "Este acuerdo queda guardado con la fecha y la hora en que lo aceptas.")));
        return secciones;
    }

    /** El texto plano, tal cual lo que se guarda como constancia. */
    static String texto(List<Seccion> secciones) {
        StringBuilder sb = new StringBuilder("TÉRMINOS DEL TRABAJO\n");
        for (Seccion s : secciones) {
            sb.append('\n').append(s.titulo().toUpperCase()).append('\n');
            for (String linea : s.lineas()) sb.append("- ").append(linea).append('\n');
        }
        return sb.toString();
    }

    /** Huella corta del texto: dos textos distintos nunca comparten versión. */
    static String version(String texto) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(texto.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash).substring(0, 16);
        } catch (java.security.NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    private static void tarifa(List<String> tarifas, String tipo, String valor) {
        int pesos = numero(valor, 0);
        if (pesos > 0) tarifas.add(tipo + " " + Pesos.formato(pesos));
    }

    private static int numero(String valor, int defecto) {
        try {
            int n = Integer.parseInt(valor == null ? "" : valor.trim());
            return n >= 0 ? n : defecto;
        } catch (NumberFormatException e) {
            return defecto;
        }
    }
}
