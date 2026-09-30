package co.granizados.pos.plata;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.tuple;

import co.granizados.pos.PruebaIntegracion;
import co.granizados.pos.pedido.PedidoService;
import co.granizados.pos.reporte.ReporteService;
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

    @Autowired
    co.granizados.pos.resumen.EstadoService estado;

    @Autowired
    co.granizados.pos.reporte.ReporteService reportes;

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
        plata.registrarIngreso(new PlataService.NuevoIngreso("i-1", "Pago deuda", 80_000, LugarPlata.CASA, null, null));

        var s = plata.saldo();
        assertThat(s.caja()).isEqualTo(50_000 + 6_000 - 4_000);
        assertThat(s.casa()).isEqualTo(280_000);
        assertThat(s.nequi()).isEqualTo(42_000);
        assertThat(s.total()).isEqualTo(52_000 + 280_000 + 42_000);
        assertThat(s.ingresos()).extracting(PlataService.IngresoDto::concepto).containsExactly("Pago deuda");
    }

    @Test
    void repetirUnIngresoOUnConteoNoDuplicaNada() {
        var ingreso = new PlataService.NuevoIngreso("i-1", "Deuda", 10_000, LugarPlata.NEQUI, null, null);
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

    // ------------------------------------------------------------------ traslados y metas

    @Test
    void trasladarMueveLaPlataSinCambiarElTotal() {
        plata.contar(new PlataService.NuevoConteo("c-1", 150_000, 0, 20_000));
        reloj.avanzar(Duration.ofMinutes(1));

        plata.trasladar(new PlataService.NuevoTraslado("t-1", 100_000, LugarPlata.CAJA, LugarPlata.CASA));
        // Repetirlo no lo mueve dos veces
        assertThat(plata.trasladar(new PlataService.NuevoTraslado("t-1", 100_000, LugarPlata.CAJA, LugarPlata.CASA)))
                .isEqualTo(PlataService.Resultado.REPETIDA);

        var s = plata.saldo();
        assertThat(s.caja()).isEqualTo(50_000);
        assertThat(s.casa()).isEqualTo(100_000);
        assertThat(s.total()).isEqualTo(170_000);
    }

    @Test
    void noSePuedeTrasladarAlMismoLugar() {
        assertThatThrownBy(() -> plata.trasladar(new PlataService.NuevoTraslado("t-1", 5_000, LugarPlata.CAJA, LugarPlata.CAJA)))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void lasMetasApartanPlataPeroElTotalNoCambia() {
        plata.contar(new PlataService.NuevoConteo("c-1", 100_000, 0, 0));
        plata.crearMeta(new PlataService.NuevaMeta("m-1", "Ahorro", 500_000));
        long id = plata.saldo().metas().getFirst().id();

        plata.aportar(id, new PlataService.NuevoAporte("a-1", 30_000));
        var s = plata.saldo();
        assertThat(s.total()).isEqualTo(100_000);
        assertThat(s.apartado()).isEqualTo(30_000);
        assertThat(s.libre()).isEqualTo(70_000);
        assertThat(s.metas().getFirst().apartado()).isEqualTo(30_000);

        // No se puede sacar más de lo que hay apartado
        assertThatThrownBy(() -> plata.aportar(id, new PlataService.NuevoAporte("a-2", -40_000)))
                .isInstanceOf(IllegalArgumentException.class);
        plata.aportar(id, new PlataService.NuevoAporte("a-3", -10_000));
        assertThat(plata.saldo().apartado()).isEqualTo(20_000);

        // Borrar la meta devuelve todo a la plata libre
        plata.borrarMeta(id);
        assertThat(plata.saldo().libre()).isEqualTo(100_000);
    }

    // ------------------------------------------------------------------ ganancia e historial

    @Test
    void elIngresoDeGananciaSumaEnLaGananciaDelDiaYElAporteNo() {
        plata.registrarIngreso(new PlataService.NuevoIngreso("i-1", "Pago deuda", 50_000, LugarPlata.CAJA, null, null));
        plata.registrarIngreso(new PlataService.NuevoIngreso("i-2", "Puse plata mía", 200_000, LugarPlata.CASA, null, false));

        var hoy = estado.resumenDe(estado.hoy());
        assertThat(hoy.ingresos()).isEqualTo(50_000);
        assertThat(hoy.ganancia()).isEqualTo(50_000);

        var dia = estado.hoy().toString();
        var r = reportes.reporte(dia, dia);
        assertThat(r.totales().ingresos()).isEqualTo(50_000);
        assertThat(r.totales().ganancia()).isEqualTo(50_000);
        assertThat(r.porDia()).extracting(ReporteService.PorDia::ganancia).containsExactly(50_000L);
    }

    @Test
    void elHistorialJuntaTodoLoQueMovioLaPlata() {
        plata.contar(new PlataService.NuevoConteo("c-1", 10_000, 0, 0));
        reloj.avanzar(Duration.ofMinutes(1));
        venta("v-1", 6_000, "EFECTIVO");
        venta("v-2", 6_000, "EFECTIVO");
        venta("v-3", 12_000, "NEQUI");
        jdbc.update("insert into gasto (client_uid, categoria, concepto, monto, creado_en) values ('g-1', 'HIELO', 'bolsa', 4000, ?)",
                Timestamp.from(reloj.instant()));
        plata.registrarIngreso(new PlataService.NuevoIngreso("i-1", "Pago deuda", 30_000, LugarPlata.CASA, null, null));
        plata.trasladar(new PlataService.NuevoTraslado("t-1", 5_000, LugarPlata.CAJA, LugarPlata.CASA));

        var movs = plata.movimientos(7);

        assertThat(movs).extracting(PlataService.Movimiento::tipo)
                .containsExactlyInAnyOrder("VENTAS", "VENTAS", "GASTO", "INGRESO", "TRASLADO");
        // Las dos ventas en efectivo salen sumadas en un solo renglón
        assertThat(movs.stream().filter(m -> m.tipo().equals("VENTAS") && m.lugar().equals("CAJA")).findFirst().orElseThrow().monto())
                .isEqualTo(12_000);
        assertThat(movs.stream().filter(m -> m.tipo().equals("GASTO")).findFirst().orElseThrow().monto()).isEqualTo(-4_000);
    }

    // ------------------------------------------------------------------ recomendación de compra

    private void vender14Smirnoff() {
        ponerStock("Smirnoff", 0);
        jdbc.update("update producto set costo = 2200");
        var hace2Dias = reloj.instant().minus(Duration.ofDays(2));
        for (int i = 0; i < 14; i++) {
            jdbc.update("""
                    insert into venta (client_uid, producto_id, cantidad, precio_unitario, total, metodo, creada_en)
                    values (?, ?, 1, 6000, 6000, 'NEQUI', ?)""",
                    "h-" + i, idDe("Smirnoff"), Timestamp.from(hace2Dias.plusSeconds(i)));
        }
    }

    @Test
    void conPlataDeSobraRecomiendaLaSemana() {
        vender14Smirnoff(); // 7 al día → una semana son 49 unidades = $107.800
        plata.contar(new PlataService.NuevoConteo("c-1", 200_000, 0, 0));

        var r = pedidos.recomendacion();

        assertThat(r.recomendado()).isEqualTo(7);
        assertThat(r.disponible()).isEqualTo(160_000);
        assertThat(r.opciones()).extracting(PedidoService.Opcion::dias, PedidoService.Opcion::alcanza)
                .containsExactly(tuple(4, true), tuple(7, true), tuple(10, true), tuple(14, false));
    }

    @Test
    void siNoAlcanzaLaSemanaRecomiendaCuatroDias() {
        vender14Smirnoff();
        plata.contar(new PlataService.NuevoConteo("c-1", 100_000, 0, 0)); // puede gastar $80.000

        assertThat(pedidos.recomendacion().recomendado()).isEqualTo(4);
    }

    @Test
    void laPlataApartadaNoCuentaParaComprar() {
        vender14Smirnoff();
        plata.contar(new PlataService.NuevoConteo("c-1", 200_000, 0, 0));
        plata.crearMeta(new PlataService.NuevaMeta("m-1", "Ahorro", 0));
        plata.aportar(plata.saldo().metas().getFirst().id(), new PlataService.NuevoAporte("a-1", 100_000));

        var r = pedidos.recomendacion();

        assertThat(r.libre()).isEqualTo(100_000);
        assertThat(r.recomendado()).isEqualTo(4);
    }

    @Test
    void sinNingunaPlataAvisaQueCuentesPrimero() {
        vender14Smirnoff();

        var r = pedidos.recomendacion();

        assertThat(r.libre()).isNull();
        assertThat(r.recomendado()).isEqualTo(7);
        assertThat(r.motivo()).contains("Cuenta tu plata");
    }
}
