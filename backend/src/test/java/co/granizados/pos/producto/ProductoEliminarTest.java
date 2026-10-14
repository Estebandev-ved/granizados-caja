package co.granizados.pos.producto;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import co.granizados.pos.PruebaIntegracion;
import java.sql.Timestamp;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class ProductoEliminarTest extends PruebaIntegracion {

    @Autowired
    ProductoService productos;

    @Test
    void sinHistorialSeBorraDeVerdad() {
        var creado = productos.crear(new ProductoService.DatosProducto("Nuevo", TipoProducto.NORMAL, 6000, null, 3, null, null));

        var r = productos.eliminar(creado.id());

        assertThat(r.borrado()).isTrue();
        assertThat(productos.todos()).extracting(ProductoDto::id).doesNotContain(creado.id());
    }

    @Test
    void conVentasSoloSeOculta() {
        ponerStock("Smirnoff", 0);
        long id = idDe("Smirnoff");
        jdbc.update("""
                insert into venta (client_uid, producto_id, cantidad, precio_unitario, total, metodo, creada_en)
                values ('x-1', ?, 1, 6000, 6000, 'NEQUI', ?)""", id, Timestamp.from(Instant.now()));

        var r = productos.eliminar(id);

        assertThat(r.borrado()).isFalse();
        assertThat(r.producto().activo()).isFalse();
    }

    @Test
    void conStockNoSePuedeEliminar() {
        ponerStock("Smirnoff", 4);

        assertThatThrownBy(() -> productos.eliminar(idDe("Smirnoff"))).isInstanceOf(IllegalArgumentException.class);
    }
}
