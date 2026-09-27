package co.granizados.pos.resumen;

import static org.assertj.core.api.Assertions.assertThat;

import co.granizados.pos.PruebaIntegracion;
import co.granizados.pos.venta.MetodoPago;
import co.granizados.pos.venta.VentaService;
import co.granizados.pos.venta.VentaService.NuevaVenta;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class EstadoServiceTest extends PruebaIntegracion {

    @Autowired
    EstadoService estado;

    @Autowired
    VentaService ventas;

    @Test
    void hoySeCuentaEnHoraDeBogota() {
        // 11:30pm del 24 en Bogotá = 4:30am del 25 en UTC: es de AYER
        reloj.poner("2026-09-24T23:30-05:00");
        ventas.registrar(new NuevaVenta("ayer", idDe("Smirnoff"), MetodoPago.NEQUI, 1));
        // 8pm del 25 en Bogotá = 1am del 26 en UTC: es de HOY
        reloj.poner("2026-09-25T20:00-05:00");
        ventas.registrar(new NuevaVenta("hoy", idDe("Smirnoff"), MetodoPago.EFECTIVO, 1));

        reloj.poner("2026-09-25T20:30-05:00");
        var e = estado.estado();

        assertThat(e.dia()).isEqualTo(LocalDate.of(2026, 9, 25));
        assertThat(e.hoy().unidades()).isEqualTo(1);
        assertThat(e.hoy().efectivo()).isEqualTo(6000);
        assertThat(e.ultimas()).extracting(EstadoService.VentaReciente::clientUid).containsExactly("hoy");
        assertThat(e.ultimas().getFirst().hora()).isEqualTo("8:00 PM");
    }

    @Test
    void resumenPorMetodoYSabor() {
        ventas.registrar(new NuevaVenta("1", idDe("Smirnoff"), MetodoPago.NEQUI, 3));
        ventas.registrar(new NuevaVenta("2", idDe("Tussi"), MetodoPago.EFECTIVO, 1));
        ventas.registrar(new NuevaVenta("3", idDe("Smirnoff"), MetodoPago.EFECTIVO, 1));

        var h = estado.estado().hoy();

        assertThat(h.total()).isEqualTo(30000);
        assertThat(h.nequi()).isEqualTo(18000);
        assertThat(h.efectivo()).isEqualTo(12000);
        assertThat(h.porSabor()).containsExactly(new EstadoService.PorSabor("Smirnoff", 4), new EstadoService.PorSabor("Tussi", 1));
    }

    @Test
    void productosInactivosNoSalenEnLaCaja() {
        jdbc.update("update producto set activo = false where sabor = 'Sangría'");
        assertThat(estado.estado().productos()).extracting("sabor").doesNotContain("Sangría").hasSize(10);
    }
}
