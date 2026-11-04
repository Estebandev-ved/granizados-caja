package co.granizados.pos.equipo;

import java.util.ArrayList;
import java.util.List;

/**
 * Premios del día por escalón: "12:2000,15:4000" = con 12 granizados vendidos en el día el trabajador gana $2.000 en
 * total, y con 15, $4.000 en total (no se suman: vale el escalón más alto que alcanzó).
 */
public final class Escalones {

    public record Escalon(int granizados, long total) {
    }

    private Escalones() {
    }

    /** Los escalones del texto, de menor a mayor. Un texto vacío o dañado no da escalones (el premio queda apagado). */
    public static List<Escalon> leer(String texto) {
        List<Escalon> lista = new ArrayList<>();
        if (texto == null || texto.isBlank()) return lista;
        for (String parte : texto.split(",")) {
            String[] par = parte.trim().split(":");
            if (par.length != 2) return List.of();
            try {
                lista.add(new Escalon(Integer.parseInt(par[0].trim()), Long.parseLong(par[1].trim())));
            } catch (NumberFormatException e) {
                return List.of();
            }
        }
        lista.sort((a, b) -> Integer.compare(a.granizados(), b.granizados()));
        return lista;
    }

    /** Lo que gana en el día quien vendió `vendidas`: el total del escalón más alto que alcanzó, o 0. */
    public static long premioDe(List<Escalon> escalones, int vendidas) {
        long premio = 0;
        for (Escalon e : escalones) {
            if (vendidas >= e.granizados()) premio = e.total();
        }
        return premio;
    }

    /** El próximo escalón por alcanzar, o null si ya llegó al último. */
    public static Escalon siguiente(List<Escalon> escalones, int vendidas) {
        for (Escalon e : escalones) {
            if (vendidas < e.granizados()) return e;
        }
        return null;
    }

    /** Valida lo que escribe el dueño en Ajustes. Vacío apaga los premios. */
    public static String validar(String valor) {
        if (valor.isEmpty()) return valor;
        if (!valor.matches("\\d{1,3}:\\d{1,7}(,\\d{1,3}:\\d{1,7}){0,11}")) {
            throw new IllegalArgumentException("Escríbelos así: 12:2000,15:4000 (granizados:pesos en total), de menor a mayor");
        }
        // En el orden en que los escribió (leer() los ordena y ocultaría un desorden)
        List<Escalon> lista = new ArrayList<>();
        for (String parte : valor.split(",")) {
            String[] par = parte.split(":");
            lista.add(new Escalon(Integer.parseInt(par[0]), Long.parseLong(par[1])));
        }
        for (int i = 0; i < lista.size(); i++) {
            Escalon e = lista.get(i);
            if (e.granizados() < 1) throw new IllegalArgumentException("Cada escalón empieza en 1 granizado o más");
            if (i > 0 && e.granizados() <= lista.get(i - 1).granizados()) {
                throw new IllegalArgumentException("Los granizados de cada escalón tienen que ir de menor a mayor, sin repetir");
            }
            if (i > 0 && e.total() < lista.get(i - 1).total()) {
                throw new IllegalArgumentException("Un escalón más alto no puede pagar menos que el anterior");
            }
        }
        return valor;
    }
}
