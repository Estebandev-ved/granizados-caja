package co.granizados.pos.venta;

import static org.assertj.core.api.Assertions.assertThat;

import co.granizados.pos.PruebaIntegracion;
import co.granizados.pos.plata.PlataService;
import co.granizados.pos.resumen.EstadoService;
import co.granizados.pos.venta.VentaService.NuevaVenta;
import java.time.Duration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class RegaloTest extends PruebaIntegracion {

    @Autowired
    VentaService ventas;

    @Autowired
    EstadoService estado;

    @Autowired
    PlataService plata;

    private NuevaVenta regalo(String uid, int cantidad) {
        return new NuevaVenta(uid, idDe("Smirnoff"), MetodoPago.REGALO, cantidad);
    }

    @Test
    void unRegaloBajaElStockYCuentaElCostoPeroNoEntraPlata() {
        int antes = stockDe("Smirnoff");

        ventas.registrar(regalo("r1", 1));

        var hoy = estado.estado().hoy();
        assertThat(hoy.total()).isZero();
        assertThat(hoy.efectivo()).isZero();
        assertThat(hoy.nequi()).isZero();
        assertThat(hoy.unidades()).isEqualTo(1);
        assertThat(stockDe("Smirnoff")).isEqualTo(antes - 1);
    }

    @Test
    void elRegaloIgnoraElTotalQueMandeElCelular() {
        ventas.registrar(new NuevaVenta("r1", idDe("Smirnoff"), MetodoPago.REGALO, 1, null, 6000L));

        assertThat(estado.estado().hoy().total()).isZero();
    }

    @Test
    void elRegaloNoMueveLaPlataDeLaCajaNiDeNequi() {
        plata.contar(new PlataService.NuevoConteo("c-1", 10_000, 0, 20_000));
        reloj.avanzar(Duration.ofMinutes(1));

        ventas.registrar(regalo("r1", 1));

        var saldo = plata.saldo();
        assertThat(saldo.caja()).isEqualTo(10_000);
        assertThat(saldo.nequi()).isEqualTo(20_000);
    }

    @Test
    void repetirElMismoRegaloNoDuplica() {
        int antes = stockDe("Smirnoff");
        ventas.registrar(regalo("r1", 1));
        var segunda = ventas.registrar(regalo("r1", 1));

        assertThat(segunda).isEqualTo(VentaService.Resultado.REPETIDA);
        assertThat(stockDe("Smirnoff")).isEqualTo(antes - 1);
    }

    @Test
    void deshacerUnRegaloDevuelveElStock() {
        int antes = stockDe("Smirnoff");
        ventas.registrar(regalo("r1", 2));

        ventas.deshacer("r1");

        assertThat(stockDe("Smirnoff")).isEqualTo(antes);
        assertThat(contar("venta")).isZero();
    }
}
