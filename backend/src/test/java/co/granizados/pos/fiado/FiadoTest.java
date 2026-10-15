package co.granizados.pos.fiado;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import co.granizados.pos.PruebaIntegracion;
import co.granizados.pos.plata.LugarPlata;
import co.granizados.pos.plata.PlataService;
import co.granizados.pos.resumen.EstadoService;
import co.granizados.pos.venta.MetodoPago;
import co.granizados.pos.venta.VentaService;
import co.granizados.pos.venta.VentaService.NuevaVenta;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

class FiadoTest extends PruebaIntegracion {

    @Autowired
    VentaService ventas;

    @Autowired
    FiadoService fiados;

    @Autowired
    EstadoService estado;

    @Autowired
    PlataService plata;

    @MockitoBean
    WhatsAppCloud whatsapp;

    private void fiar(String uid, String sabor, int cantidad, String cliente, String telefono) {
        ventas.registrar(new NuevaVenta(uid, idDe(sabor), MetodoPago.FIADO, cantidad, null, null, cliente, telefono));
    }

    private FiadoService.Persona unica() {
        var personas = fiados.pendientes().personas();
        assertThat(personas).hasSize(1);
        return personas.getFirst();
    }

    @Test
    void fiarDescuentaStockYDejaLaDeuda() {
        ponerStock("Smirnoff", 5);

        fiar("f-1", "Smirnoff", 2, "  Camila ", "300 123-4567");

        assertThat(jdbc.queryForObject("select stock from producto where id = ?", Integer.class, idDe("Smirnoff"))).isEqualTo(3);
        var p = unica();
        assertThat(p.cliente()).isEqualTo("Camila");
        assertThat(p.telefono()).isEqualTo("3001234567");
        assertThat(p.total()).isEqualTo(12_000);
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
        long id = unica().deudas().getFirst().id();

        fiados.cobrar(id, LugarPlata.NEQUI, "cobro-1");
        fiados.cobrar(id, LugarPlata.NEQUI, "cobro-2"); // repetido: no duplica

        assertThat(fiados.pendientes().personas()).isEmpty();
        assertThat(plata.saldo().nequi()).isEqualTo(6_000);
        assertThat(jdbc.queryForObject("select count(*) from ingreso", Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select cuenta_ganancia from ingreso", Boolean.class)).isFalse();
    }

    @Test
    void deshacerUnFiadoBorraLaDeudaYDevuelveElStock() {
        ponerStock("Smirnoff", 5);
        fiar("f-5", "Smirnoff", 1, "Camila", null);

        ventas.deshacer("f-5");

        assertThat(fiados.pendientes().personas()).isEmpty();
        assertThat(jdbc.queryForObject("select stock from producto where id = ?", Integer.class, idDe("Smirnoff"))).isEqualTo(5);
    }

    @Test
    void unFiadoYaCobradoNoSeDeshace() {
        ponerStock("Smirnoff", 5);
        fiar("f-6", "Smirnoff", 1, "Camila", null);
        fiados.cobrar(unica().deudas().getFirst().id(), LugarPlata.CAJA, "cobro-6");

        assertThatThrownBy(() -> ventas.deshacer("f-6")).isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void guardaYBorraElCelular() {
        ponerStock("Smirnoff", 5);
        fiar("f-7", "Smirnoff", 1, "Camila", null);
        long id = unica().deudas().getFirst().id();

        assertThat(fiados.telefono(id, "+57 300 111 2233").telefono()).isEqualTo("573001112233");
        assertThat(fiados.telefono(id, "").telefono()).isNull();
    }

    // ------------------------------------------------------------------ una persona, una cuenta

    @Test
    void lasDeudasDeLaMismaPersonaSeSumanEnUna() {
        ponerStock("Smirnoff", 10);
        ponerStock("Mojito", 10);
        fiar("g-1", "Smirnoff", 2, "Camila", "3001234567");
        fiar("g-2", "Mojito", 1, "camila ", null); // mismo nombre aunque cambien mayúsculas y espacios
        fiar("g-3", "Smirnoff", 1, "Juan", null);

        var lista = fiados.pendientes();

        assertThat(lista.personas()).hasSize(2);
        assertThat(lista.total()).isEqualTo(24_000);
        var camila = lista.personas().stream().filter(p -> p.cliente().equalsIgnoreCase("camila")).findFirst().orElseThrow();
        assertThat(camila.deudas()).hasSize(2);
        assertThat(camila.total()).isEqualTo(18_000);
    }

    @Test
    void elCelularQuedaLigadoAlNombreParaLosSiguientesFiados() {
        ponerStock("Smirnoff", 10);
        fiar("h-1", "Smirnoff", 1, "Camila", "3001234567");
        fiar("h-2", "Smirnoff", 1, "CAMILA", null);

        assertThat(unica().telefono()).isEqualTo("3001234567");
        assertThat(jdbc.queryForList("select telefono from deuda order by id", String.class))
                .containsExactly("3001234567", "3001234567");
        assertThat(fiados.conocidos()).extracting(FiadoService.Conocido::telefono).containsExactly("3001234567");
    }

    @Test
    void cobrarAUnaPersonaCobraTodasSusDeudasConUnSoloIngreso() {
        ponerStock("Smirnoff", 10);
        fiar("i-1", "Smirnoff", 1, "Camila", null);
        fiar("i-2", "Smirnoff", 2, "Camila", null);
        var ids = unica().deudas().stream().map(FiadoService.DeudaDto::id).toList();

        fiados.cobrar(ids, LugarPlata.CAJA, "cobro-i");

        assertThat(fiados.pendientes().personas()).isEmpty();
        assertThat(jdbc.queryForObject("select count(*) from ingreso", Integer.class)).isEqualTo(1);
        assertThat(jdbc.queryForObject("select monto from ingreso", Long.class)).isEqualTo(18_000L);
    }

    @Test
    void elMensajeExplicaQueDebeYDondePagar() {
        ponerStock("Smirnoff", 10);
        jdbc.update("update config set valor = '3001112233' where clave = 'PAGO_NEQUI'");
        jdbc.update("update config set valor = '@esteban' where clave = 'PAGO_BREB'");
        jdbc.update("update config set valor = 'en la U, bloque 4' where clave = 'PAGO_PRESENCIAL'");
        fiar("m-1", "Smirnoff", 2, "Camila", "3001234567");
        fiar("m-2", "Smirnoff", 1, "Camila", null);

        String m = unica().mensaje();

        assertThat(m).contains("Hola Camila").contains("2 Smirnoff").contains("1 Smirnoff")
                .contains("Total: $18.000")
                .contains("Nequi: 3001112233").contains("Llave Bre-B: @esteban").contains("En persona: en la U, bloque 4");
    }

    // ------------------------------------------------------------------ el bot

    @Test
    void elBotNoEnviaSiEstaApagado() {
        ponerStock("Smirnoff", 5);
        fiar("b-1", "Smirnoff", 1, "Camila", "3001234567");
        when(whatsapp.activo()).thenReturn(false);

        assertThat(fiados.pendientes().bot()).isFalse();
        assertThatThrownBy(() -> fiados.recordar(List.of(unica().deudas().getFirst().id())))
                .isInstanceOf(IllegalArgumentException.class);
        verify(whatsapp, never()).enviarPlantilla(eq("573001234567"), anyList());
    }

    @Test
    @SuppressWarnings("unchecked")
    void elBotManda5VariablesEnUnaLineaYNoRepiteElMismoDia() {
        ponerStock("Smirnoff", 10);
        jdbc.update("update config set valor = '3001112233' where clave = 'PAGO_NEQUI'");
        when(whatsapp.activo()).thenReturn(true);
        fiar("b-2", "Smirnoff", 2, "Camila", "3001234567");
        fiar("b-3", "Smirnoff", 1, "Camila", null);
        var ids = unica().deudas().stream().map(FiadoService.DeudaDto::id).toList();

        fiados.recordar(ids);

        ArgumentCaptor<List<String>> vars = ArgumentCaptor.forClass(List.class);
        verify(whatsapp).enviarPlantilla(eq("573001234567"), vars.capture());
        assertThat(vars.getValue()).hasSize(5);
        assertThat(vars.getValue().get(0)).isEqualTo("Camila");
        assertThat(vars.getValue().get(2)).isEqualTo("$18.000");
        assertThat(vars.getValue().get(3)).contains("2 Smirnoff").contains("1 Smirnoff");
        assertThat(vars.getValue().get(4)).contains("Nequi: 3001112233");
        vars.getValue().forEach(v -> assertThat(v).doesNotContain("\n").isNotBlank());
        assertThat(unica().recordadoEn()).isNotNull();

        // El mismo día no se vuelve a mandar...
        assertThatThrownBy(() -> fiados.recordar(ids)).isInstanceOf(IllegalArgumentException.class);
        // ...pero al día siguiente sí
        reloj.avanzar(Duration.ofHours(25));
        fiados.recordar(ids);
    }

    @Test
    void sinCelularElBotNoPuedeEnviar() {
        ponerStock("Smirnoff", 5);
        when(whatsapp.activo()).thenReturn(true);
        fiar("b-4", "Smirnoff", 1, "Camila", null);

        assertThatThrownBy(() -> fiados.recordar(List.of(unica().deudas().getFirst().id())))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("celular");
    }
}
