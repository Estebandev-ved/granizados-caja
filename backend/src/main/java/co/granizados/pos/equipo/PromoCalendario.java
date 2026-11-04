package co.granizados.pos.equipo;

import java.time.LocalDate;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * ¿Está corriendo la promoción en un día? Lee el JSON que guarda Ajustes (ajuste PROMO) con la misma regla del celular:
 * con días de la semana manda el calendario; si no, "solo hoy" (el día en que se prendió) o hasta que se apague.
 */
final class PromoCalendario {

    private static final Pattern ACTIVA = Pattern.compile("\"activa\"\\s*:\\s*true");
    private static final Pattern SOLO_HOY = Pattern.compile("\"soloHoy\"\\s*:\\s*true");
    private static final Pattern DIA = Pattern.compile("\"dia\"\\s*:\\s*\"([^\"]*)\"");
    private static final Pattern DIAS = Pattern.compile("\"dias\"\\s*:\\s*\\[([^\\]]*)\\]");

    private PromoCalendario() {
    }

    static boolean vigente(String json, LocalDate dia) {
        if (json == null || json.isBlank() || !ACTIVA.matcher(json).find()) return false;
        Matcher dias = DIAS.matcher(json);
        if (dias.find() && !dias.group(1).isBlank()) {
            for (String d : dias.group(1).split(",")) {
                if (d.trim().equals(String.valueOf(dia.getDayOfWeek().getValue()))) return true;
            }
            return false;
        }
        if (!SOLO_HOY.matcher(json).find()) return true;
        Matcher prendida = DIA.matcher(json);
        return prendida.find() && prendida.group(1).equals(dia.toString());
    }
}
