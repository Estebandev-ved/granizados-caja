package co.granizados.pos.equipo;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;

/**
 * Quién hace la petición. Sale del token ya verificado, nunca de un dato del cliente.
 * Sin token (pruebas de servicio, tareas programadas) o con el del dueño, no hay trabajador.
 */
public final class Sesion {

    public static final String ROL_VENDEDOR = "vendedor";

    private Sesion() {
    }

    /** El id del trabajador que está vendiendo, o null si es el dueño. */
    public static Long vendedorId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth instanceof JwtAuthenticationToken token && ROL_VENDEDOR.equals(token.getToken().getClaimAsString("rol"))) {
            Object id = token.getToken().getClaim("vendedor_id");
            if (id instanceof Number n) return n.longValue();
        }
        return null;
    }
}
