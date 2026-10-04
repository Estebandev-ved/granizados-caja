package co.granizados.pos.negocio;

/**
 * El negocio (tenant) de la petición que se está atendiendo. Lo pone {@link NegocioFiltro} a partir del token ya
 * verificado; nunca de un dato que mande el cliente. Fuera de una petición (tareas programadas, avisos) queda
 * vacío y se usa el negocio por defecto.
 */
public final class TenantContext {

    private static final ThreadLocal<Long> ACTUAL = new ThreadLocal<>();

    private TenantContext() {
    }

    /** El negocio de esta petición, o null si no hay (se usa el negocio por defecto). */
    public static Long actual() {
        return ACTUAL.get();
    }

    public static void poner(Long negocioId) {
        ACTUAL.set(negocioId);
    }

    public static void limpiar() {
        ACTUAL.remove();
    }
}
