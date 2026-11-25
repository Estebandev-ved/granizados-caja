package co.granizados.pos.equipo;

import java.util.ArrayList;
import java.util.List;

/**
 * Bonos automáticos: «lo que vendes de más, lo partimos». La app saca el día normal de cada trabajador (la mediana de
 * sus últimas semanas) y por cada granizado que venda por encima de ese día él se lleva una parte de lo que ese
 * granizado le deja al negocio ya pagada su comisión: `parte` % hasta un 30 % más que su día normal, y 5 puntos más
 * de ahí en adelante, nunca más de `PARTE_MAXIMA`: al dueño siempre le queda al menos el 55 % de cada granizado de más.
 * Con eso se arma su escalera de premios (los mismos escalones de siempre: la barra, el premio gordo y la liquidación
 * funcionan igual), así que el dueño solo paga por granizados que no se iban a vender.
 */
public final class BonosAuto {

    /** Parte (en %) de lo extra que se lleva el trabajador si el dueño no escoge otra. */
    public static final int PARTE_DEFECTO = 40;

    /** Lo máximo que se lleva el trabajador de un granizado de más: al dueño nunca le queda menos del 55 %. */
    public static final int PARTE_MAXIMA = 45;

    /** Desde qué tanto por encima de su día normal la parte sube 5 puntos (sin pasar de PARTE_MAXIMA). */
    static final double TRAMO_ALTO = 1.3;

    /** Dónde van los escalones, como veces su día normal. El último es el premio gordo. */
    static final double[] HITOS = {1.15, 1.3, 1.5, 1.75, 2.0};

    /**
     * Lo que dicen las ventas de las últimas semanas para un trabajador: su día normal (`base`; si lleva pocos días, el
     * del equipo y `pocosDatos`) y lo que deja cada granizado ya pagada la comisión, normal y en promo (null si no hubo
     * ventas en promo con costo).
     */
    public record Base(int base, boolean pocosDatos, long margen, Long margenPromo) {
    }

    private BonosAuto() {
    }

    /** La escalera de premios con su día normal `base` y lo que deja cada granizado (`margen`). */
    public static List<Escalones.Escalon> escalera(int base, long margen, int parte) {
        List<Escalones.Escalon> lista = new ArrayList<>();
        if (base <= 0 || margen <= 0 || parte <= 0) return lista;
        int alto = (int) Math.round(base * TRAMO_ALTO);
        parte = Math.min(parte, PARTE_MAXIMA);
        int parteAlta = Math.min(PARTE_MAXIMA, parte + 5);
        int anterior = base;
        long acumulado = 0;
        int contados = base;
        for (double veces : HITOS) {
            int hito = Math.max(anterior + 1, (int) Math.round(base * veces));
            for (int k = contados + 1; k <= hito; k++) acumulado += margen * (k <= alto ? parte : parteAlta) / 100;
            contados = hito;
            long premio = acumulado / 500 * 500;
            if (premio >= 500 && (lista.isEmpty() || premio > lista.getLast().total())) lista.add(new Escalones.Escalon(hito, premio));
            anterior = hito;
        }
        return lista;
    }
}
