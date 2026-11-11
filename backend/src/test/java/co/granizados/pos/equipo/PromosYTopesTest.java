package co.granizados.pos.equipo;

import static org.assertj.core.api.Assertions.assertThat;

import co.granizados.pos.PruebaIntegracion;
import co.granizados.pos.ajustes.AjustesService;
import co.granizados.pos.gasto.GastoService;
import co.granizados.pos.resumen.EstadoService;
import java.time.Instant;
import java.time.LocalDate;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

/** Varias promos al mismo tiempo (ajuste PROMO como lista) y el gasto del mes con sus topes. */
class PromosYTopesTest extends PruebaIntegracion {

    @Autowired
    AjustesService ajustes;

    @Autowired
    GastoService gastos;

    @Autowired
    EstadoService estado;

    /** El 25 de septiembre de 2026 es viernes (5). */
    private static final LocalDate VIERNES = LocalDate.parse("2026-09-25");

    @Test
    void conVariasPromosBastaConQueUnaEsteCorriendo() {
        String promos = "[{\"activa\":true,\"cantidad\":3,\"precio\":16000,\"tipos\":[\"NORMAL\"],\"soloHoy\":false,\"dia\":\"\",\"dias\":[1],\"nombre\":\"refrescantes\"},"
                + "{\"activa\":true,\"cantidad\":2,\"precio\":14000,\"tipos\":[\"CREMOSO\"],\"soloHoy\":false,\"dia\":\"\",\"dias\":[5],\"nombre\":\"cremosos\"}]";

        assertThat(PromoCalendario.vigente(promos, VIERNES)).isTrue();
        assertThat(PromoCalendario.vigente(promos, VIERNES.plusDays(1))).isFalse();
        assertThat(PromoCalendario.vigente(promos, VIERNES.plusDays(3))).isTrue(); // lunes: la de refrescantes
        // Apagadas, ninguna corre
        assertThat(PromoCalendario.vigente(promos.replace("\"activa\":true", "\"activa\":false"), VIERNES)).isFalse();
    }

    @Test
    void unaSolaPromoGuardadaComoAntesSigueFuncionando() {
        String una = "{\"activa\":true,\"cantidad\":2,\"precio\":10000,\"tipos\":[\"NORMAL\"],\"soloHoy\":true,\"dia\":\"2026-09-25\",\"dias\":[]}";

        assertThat(PromoCalendario.vigente(una, VIERNES)).isTrue();
        assertThat(PromoCalendario.vigente(una, VIERNES.plusDays(1))).isFalse();
        assertThat(PromoCalendario.vigente("", VIERNES)).isFalse();
    }

    @Test
    void elEstadoTraeLoGastadoEnElMesPorCategoriaYLosTopes() {
        Instant elMesPasado = Instant.parse("2026-08-30T17:00:00Z");
        gastos.registrar(new GastoService.NuevoGasto("g-1", "HIELO", "", 20_000, null));
        gastos.registrar(new GastoService.NuevoGasto("g-2", "HIELO", "", 5_000, null));
        gastos.registrar(new GastoService.NuevoGasto("g-3", "Gasolina", "", 12_000, null));
        gastos.registrar(new GastoService.NuevoGasto("g-4", "HIELO", "", 99_000, elMesPasado));
        ajustes.actualizar("TOPES_GASTO", "{\"HIELO\":30000}");

        var e = estado.estado();

        assertThat(e.gastosMes()).containsEntry("HIELO", 25_000L).containsEntry("Gasolina", 12_000L).hasSize(2);
        assertThat(e.topesGasto()).isEqualTo("{\"HIELO\":30000}");
    }
}
