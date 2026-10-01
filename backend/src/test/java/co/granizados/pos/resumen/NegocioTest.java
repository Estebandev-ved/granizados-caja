package co.granizados.pos.resumen;

import static org.assertj.core.api.Assertions.assertThat;

import co.granizados.pos.PruebaIntegracion;
import java.sql.Timestamp;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class NegocioTest extends PruebaIntegracion {

    @Autowired
    NegocioController negocio;

    @Test
    void sinVentasTodaviaNoHayDiasEnOperacion() {
        var n = negocio.negocio();
        assertThat(n.inicio()).isNull();
        assertThat(n.dias()).isZero();
    }

    @Test
    void cuentaLosDiasDesdeLaPrimeraVentaIncluyendoHoy() {
        // Primera venta hace 9 días: hoy es el día 10
        jdbc.update("""
                insert into venta (client_uid, producto_id, cantidad, precio_unitario, total, metodo, creada_en)
                values ('v-vieja', ?, 1, 6000, 6000, 'NEQUI', ?)""",
                idDe("Smirnoff"), Timestamp.from(reloj.instant().minus(Duration.ofDays(9))));
        jdbc.update("""
                insert into venta (client_uid, producto_id, cantidad, precio_unitario, total, metodo, creada_en)
                values ('v-nueva', ?, 1, 6000, 6000, 'NEQUI', ?)""",
                idDe("Smirnoff"), Timestamp.from(reloj.instant()));

        var n = negocio.negocio();

        assertThat(n.dias()).isEqualTo(10);
        assertThat(n.inicio()).isEqualTo(java.time.LocalDate.of(2026, 9, 16));
    }

    @Test
    void elPrimerDiaDeVentasEsElDiaUno() {
        jdbc.update("""
                insert into venta (client_uid, producto_id, cantidad, precio_unitario, total, metodo, creada_en)
                values ('v-hoy', ?, 1, 6000, 6000, 'NEQUI', ?)""",
                idDe("Smirnoff"), Timestamp.from(reloj.instant()));

        assertThat(negocio.negocio().dias()).isEqualTo(1);
    }
}
