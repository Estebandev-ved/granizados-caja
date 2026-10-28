package co.granizados.pos.seguridad;

import co.granizados.pos.equipo.EquipoService;
import co.granizados.pos.equipo.Sesion;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Un trabajador solo puede ver su turno (/api/estado) y vender o deshacer lo suyo. Todo lo demás (costos, reportes,
 * Mi plata, ajustes, equipo…) es del dueño. Va después de NegocioFiltro, así ya se sabe de qué negocio es.
 * Si el dueño desactiva al trabajador, su token deja de servir en la siguiente petición.
 */
public class RolFiltro extends OncePerRequestFilter {

    private final EquipoService equipo;

    public RolFiltro(EquipoService equipo) {
        this.equipo = equipo;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Long vendedor = Sesion.vendedorId();
        if (vendedor == null) {
            chain.doFilter(request, response);
            return;
        }
        if (!equipo.estaActivo(vendedor)) {
            responder(response, 401, "Tu acceso fue desactivado");
            return;
        }
        if (!permitido(request.getMethod(), request.getRequestURI())) {
            responder(response, 403, "Eso solo lo puede hacer el dueño");
            return;
        }
        chain.doFilter(request, response);
    }

    static boolean permitido(String metodo, String ruta) {
        if (metodo.equals("OPTIONS")) return true;
        if (ruta.equals("/api/estado")) return metodo.equals("GET");
        if (ruta.equals("/api/ventas") || ruta.equals("/api/ventas/lote")) return metodo.equals("POST");
        // Deshacer una venta: DELETE /api/ventas/{uid} (el servicio revisa que sea suya)
        return ruta.startsWith("/api/ventas/") && !ruta.equals("/api/ventas/importar") && metodo.equals("DELETE");
    }

    private static void responder(HttpServletResponse response, int estado, String mensaje) throws IOException {
        response.setStatus(estado);
        response.setContentType("application/json;charset=UTF-8");
        response.getWriter().write("{\"error\":\"" + mensaje + "\"}");
    }
}
