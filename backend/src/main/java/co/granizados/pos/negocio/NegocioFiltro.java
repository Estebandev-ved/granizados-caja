package co.granizados.pos.negocio;

import co.granizados.pos.comun.AppProperties;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.server.resource.authentication.JwtAuthenticationToken;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Decide de qué negocio es cada petición. Siempre sale del token ya verificado (claim {@code negocio_id}); un
 * encabezado o parámetro del cliente jamás se usa. Los tokens de antes de multi-negocio no traen el claim y
 * pertenecen al negocio por defecto (Dopamina Cocktails), así que siguen funcionando.
 * No es un bean a propósito: lo arma SecurityConfig dentro de la cadena, justo después de verificar el token.
 */
public class NegocioFiltro extends OncePerRequestFilter {

    private final long porDefecto;
    private final NegocioService negocios;

    public NegocioFiltro(AppProperties props, NegocioService negocios) {
        this.porDefecto = props.negocioId();
        this.negocios = negocios;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        try {
            long negocioId = negocioDe(SecurityContextHolder.getContext().getAuthentication());
            TenantContext.poner(negocioId);
            if (suscripcionVencida(SecurityContextHolder.getContext().getAuthentication()) && escribe(request)) {
                response.setStatus(402);
                response.setContentType("application/json;charset=UTF-8");
                response.getWriter().write("{\"error\":\"Tu suscripción venció. Renuévala para volver a registrar movimientos.\"}");
                return;
            }
            if (SecurityContextHolder.getContext().getAuthentication() instanceof JwtAuthenticationToken) {
                negocios.asegurar(negocioId);
            }
            chain.doFilter(request, response);
        } finally {
            TenantContext.limpiar();
        }
    }

    /** Con la suscripción vencida solo se puede mirar: el token de Antigravity trae el estado. */
    private static boolean suscripcionVencida(Authentication auth) {
        return auth instanceof JwtAuthenticationToken token && "vencido".equals(token.getToken().getClaimAsString("estado"));
    }

    private static boolean escribe(HttpServletRequest request) {
        String metodo = request.getMethod();
        return !(metodo.equals("GET") || metodo.equals("HEAD") || metodo.equals("OPTIONS"));
    }

    private long negocioDe(Authentication auth) {
        if (auth instanceof JwtAuthenticationToken token) {
            Jwt jwt = token.getToken();
            Object claim = jwt.getClaim("negocio_id");
            if (claim instanceof Number n && n.longValue() > 0) return n.longValue();
            if (claim instanceof String s && s.matches("\\d{1,18}") && Long.parseLong(s) > 0) return Long.parseLong(s);
        }
        return porDefecto;
    }
}
