package co.granizados.pos.plata;

import static org.assertj.core.api.Assertions.assertThat;

import co.granizados.pos.PruebaIntegracion;
import co.granizados.pos.pedido.PedidoService;
import java.sql.Timestamp;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class PlataServiceTest extends PruebaIntegracion {

    @Autowired
    PlataService plata;

    @Autowired
    PedidoService pedidos;

    private void venta(String uid, long total, String metodo) {
        jdbc.update("""
                insert into venta (client_uid, producto_id, cantidad, precio_unitario, total, metodo, creada_en)
                values (?, ?, 1, ?, ?, ?, ?)""",
                uid, idDe("Smirnoff"), total, total, metodo, Timestamp.from(reloj.instant()));
    }

    @Test
    void sinConteoNoHayPlataQueMostrar() {
        var s = plata.saldo();
        assertThat(s.contadoEn()).isNull();
        assertThat(s.total()).isZero();
    }

    @Test
    void elSaldoPartedelConteoYSumaLoQueEntroDespues() {
        plata.contar(new PlataService.NuevoConteo("c-1", 50_000, 200_000, 30_000));
        reloj.avanzar(Duration.ofMinutes(1));

        venta("v-1", 6_000, "EFECTIVO");
        venta("v-2", 12_000, "NEQUI");
        jdbc.update("insert into gasto (client_uid, categoria, concepto, monto, creado_en) values ('g-1', 'HIELO', '', 4000, ?)",
                Timestamp.from(reloj.instant()));
        // La deuda que te pagaron en efectivo y se fue para la casa
        plata.registrarIngreso(new PlataService.NuevoIngreso("i-1", "Pago deuda", 80_000, LugarPlata.CASA, null));

        var s = plata.saldo();
        assertThat(s.caja()).isEqualTo(50_000 + 6_000 - 4_000);
        assertThat(s.casa()).isEqualTo(280_000);
        assertThat(s.nequi()).isEqualTo(42_000);
        assertThat(s.total()).isEqualTo(52_000 + 280_000 + 42_000);
        assertThat(s.ingresos()).extracting(PlataService.IngresoDto::concepto).containsExactly("Pago deuda");
    }

    @Test
    void repetirUnIngresoOUnConteoNoDuplicaNada() {
        var ingreso = new PlataService.NuevoIngreso("i-1", "Deuda", 10_000, LugarPlata.NEQUI, null);
        assertThat(plata.registrarIngreso(ingreso)).isEqualTo(PlataService.Resultado.REGISTRADA);
        assertThat(plata.registrarIngreso(ingreso)).isEqualTo(PlataService.Resultado.REPETIDA);
        assertThat(contar("ingreso")).isEqualTo(1);

        var conteo = new PlataService.NuevoConteo("c-1", 1, 2, 3);
        assertThat(plata.contar(conteo)).isEqualTo(PlataService.Resultado.REGISTRADA);
        assertThat(plata.contar(conteo)).isEqualTo(PlataService.Resultado.REPETIDA);
        assertThat(contar("conteo_plata")).isEqualTo(1);
    }

    @Test
    void contarDeNuevoReemplazaElPuntoDePartida() {
        plata.contar(new PlataService.NuevoConteo("c-1", 10_000, 0, 0));
        reloj.avanzar(Duration.ofMinutes(1));
        venta("v-1", 6_000, "EFECTIVO");
        reloj.avanzar(Duration.ofMinutes(1));
        plata.contar(new PlataService.NuevoConteo("c-2", 15_000, 100_000, 0));

        var s = plata.saldo();
        assertThat(s.caja()).isEqualTo(15_000);
        assertThat(s.total()).isEqualTo(115_000);
    }

    @Test
    void alRecibirUnPedidoSeDescuentaLoQueSePagoAlProveedor() {
        jdbc.update("update producto set costo = 2200");
        plata.contar(new PlataService.NuevoConteo("c-1", 0, 0, 100_000));
        reloj.avanzar(Duration.ofMinutes(1));

        var creado = pedidos.crear(List.of(new PedidoService.NuevoItem(idDe("Smirnoff"), 10)));
        var recepcion = new PedidoService.Recepcion("rx-1",
                List.of(new PedidoService.ItemRecibido(idDe("Smirnoff"), 10)));
        pedidos.recibir(creado.id(), recepcion);
        // Recibirlo dos veces no cobra dos veces
        pedidos.recibir(creado.id(), recepcion);

        assertThat(plata.saldo().nequi()).isEqualTo(100_000 - 22_000);
        assertThat(contar("pago_proveedor")).isEqualTo(1);
    }

    @Test
    void elPagoAlProveedorSaleDelLugarQueDigas() {
        jdbc.update("update producto set costo = 2200");
        plata.contar(new PlataService.NuevoConteo("c-1", 0, 50_000, 0));
        reloj.avanzar(Duration.ofMinutes(1));

        var creado = pedidos.crear(List.of(new PedidoService.NuevoItem(idDe("Smirnoff"), 10)));
        pedidos.recibir(creado.id(), new PedidoService.Recepcion("rx-1",
                List.of(new PedidoService.ItemRecibido(idDe("Smirnoff"), 10)), LugarPlata.CASA));

        assertThat(plata.saldo().casa()).isEqualTo(28_000);
    }
}
