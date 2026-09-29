package co.granizados.pos;

import co.granizados.pos.notificacion.Notificador;
import org.junit.jupiter.api.BeforeEach;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

/**
 * Base de las pruebas: arranca la app completa con H2 (modo PostgreSQL) y las migraciones reales de Flyway.
 * Antes de cada prueba deja la base limpia: todos los sabores con stock 10 y mínimo 3.
 */
@SpringBootTest
@ActiveProfiles("test")
@Import(PruebaConfig.class)
public abstract class PruebaIntegracion {

    @Autowired
    protected JdbcTemplate jdbc;

    @Autowired
    protected RelojPrueba reloj;

    @MockitoBean
    protected Notificador notificador;

    @BeforeEach
    void limpiarBase() {
        reloj.poner("2026-09-25T15:00-05:00");
        jdbc.update("delete from venta");
        jdbc.update("delete from entrada_inventario");
        jdbc.update("delete from pedido_item");
        jdbc.update("delete from pedido_proveedor");
        jdbc.update("delete from gasto");
        jdbc.update("delete from arqueo");
        jdbc.update("delete from ingreso");
        jdbc.update("delete from conteo_plata");
        jdbc.update("delete from pago_proveedor");
        jdbc.update("delete from passkey");
        jdbc.update("delete from producto where orden > 11");
        jdbc.update("update producto set stock = 10, stock_minimo = 3, activo = true, precio = 6000, costo = 0");
        jdbc.update("update config set valor = '573001234567' where clave = 'PROVEEDOR_WHATSAPP'");
        jdbc.update("update config set valor = '4' where clave = 'DIAS_COBERTURA'");
        jdbc.update("update config set valor = '14' where clave = 'DIAS_HISTORIAL'");
        jdbc.update("update config set valor = '0' where clave = 'META_DIARIA'");
    }

    protected long idDe(String sabor) {
        return jdbc.queryForObject("select id from producto where sabor = ?", Long.class, sabor);
    }

    protected int stockDe(String sabor) {
        return jdbc.queryForObject("select stock from producto where sabor = ?", Integer.class, sabor);
    }

    protected void ponerStock(String sabor, int stock) {
        jdbc.update("update producto set stock = ? where sabor = ?", stock, sabor);
    }

    protected int contar(String tabla) {
        return jdbc.queryForObject("select count(*) from " + tabla, Integer.class);
    }
}
