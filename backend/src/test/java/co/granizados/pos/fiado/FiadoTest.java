package co.granizados.pos.fiado;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import co.granizados.pos.PruebaIntegracion;
import co.granizados.pos.plata.LugarPlata;
import co.granizados.pos.plata.PlataService;
import co.granizados.pos.resumen.EstadoService;
import co.granizados.pos.venta.MetodoPago;
import co.granizados.pos.venta.VentaService;
import co.granizados.pos.venta.VentaService.NuevaVenta;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class FiadoTest extends PruebaIntegracion {

    @Autowired
    VentaService ventas;

    @Autowired
    FiadoService fiados;

    @Autowired
    EstadoService estado;

    @Autowired
    PlataService plata;

    private void fiar(String uid, String sabor, int cantidad, String cliente, String telefono) {
        ventas.registrar(new NuevaVenta(uid, idDe(sabor), MetodoPago.FIADO, cantidad, null, null, cliente, telefono));
    }

    @Test
    void fiarDescuentaStockYDejaLaDeuda() {
        ponerStock("Smirnoff", 5);

        fiar("f-1", "Smirnoff", 2, "  Camila ", "300 123-4567");

        assertThat(jdbc.queryForObject("select stock from producto where id = ?", Integer.class, idDe("Smirnoff"))).isEqualTo(3);
        var d = fiados.pendientes();
        assertThat(d).hasSize(1);
        assertThat(d.getFirst().cliente()).isEqualTo("Camila");
        assertThat(d.getFirst().telefono()).isEqualTo("3001234567");
        assertThat(d.getFirst().monto()).isEqualTo(12_000);
    }

    @Test
    void sinNombreNoSePuedeFiar() {
        ponerStock("Smirnoff", 5);

        assertThatThrownBy(() -> fiar("f-2", "Smirnoff", 1, " ", null)).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void elFiadoCuentaEnLaVentaPeroNoEsPlataHastaCobrarlo() {
        ponerStock("Smirnoff", 5);
        fiar("f-3", "Smirnoff", 1, "Camila", null);

        var hoy = estado.resumenDe(estado.hoy());
        assertThat(hoy.total()).isEqualTo(6_000);
        assertThat(hoy.efectivo()).isZero();
        assertThat(hoy.nequi()).isZero();
    }

    @Test
    void cobrarEntraLaPlataUnaSolaVezYNoSumaGananciaDeNuevo() {
        ponerStock("Smirnoff", 5);
        plata.contar(new PlataService.NuevoConteo("c-1", 10_000, 0, 0));
        fiar("f-4", "Smirnoff", 1, "Camila", null);
        long id = fiados.pendientes().getFirst().id();

        fiados.cobrar(id, LugarPlata.NEQUI, "cobro-1");
        fiados.cobrar(id, LugarPlata.NEQUI, "cobro-2"); // repetido: no duplica

        assertThat(fiados.pendientes()).isEmpty();
        assertThat(plata.saldo().nequi()).isEqualTo(6_000);
        assertThat(jdbc.queryForObject("select count(*) from ingreso", Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select cuenta_ganancia from ingreso", Boolean.class)).isFalse();
    }

    @Test
    void deshacerUnFiadoBorraLaDeudaYDevuelveElStock() {
        ponerStock("Smirnoff", 5);
        fiar("f-5", "Smirnoff", 1, "Camila", null);

        ventas.deshacer("f-5");

        assertThat(fiados.pendientes()).isEmpty();
        assertThat(jdbc.queryForObject("select stock from producto where id = ?", Integer.class, idDe("Smirnoff"))).isEqualTo(5);
    }

    @Test
    void unFiadoYaCobradoNoSeDeshace() {
        ponerStock("Smirnoff", 5);
        fiar("f-6", "Smirnoff", 1, "Camila", null);
        fiados.cobrar(fiados.pendientes().getFirst().id(), LugarPlata.CAJA, "cobro-6");

        assertThatThrownBy(() -> ventas.deshacer("f-6")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void guardaYBorraElCelular() {
        ponerStock("Smirnoff", 5);
        fiar("f-7", "Smirnoff", 1, "Camila", null);
        long id = fiados.pendientes().getFirst().id();

        assertThat(fiados.telefono(id, "+57 300 111 2233").telefono()).isEqualTo("573001112233");
        assertThat(fiados.telefono(id, "").telefono()).isNull();
    }
}
