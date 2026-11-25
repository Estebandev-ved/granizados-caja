package co.granizados.pos.equipo;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;

class BonosAutoTest {

    @Test
    void conLosNumerosDeDopaminaLaEscaleraParteLoExtraYElDuenoSiempreGana() {
        // Día normal de 22 y cada granizado deja $2.831 ya pagada la comisión: 40 % hasta 29 y 45 % de ahí en adelante
        List<Escalones.Escalon> escalera = BonosAuto.escalera(22, 2_831, 40);

        assertThat(escalera).extracting(Escalones.Escalon::granizados).containsExactly(25, 29, 33, 39, 44);
        assertThat(escalera).extracting(Escalones.Escalon::total).containsExactly(3_000L, 7_500L, 13_000L, 20_500L, 27_000L);
        // En cada escalón al dueño le queda al menos el 55 % de lo que dejan los granizados de más
        for (Escalones.Escalon e : escalera) {
            long extra = (e.granizados() - 22L) * 2_831;
            assertThat(e.total()).isLessThanOrEqualTo(extra * 45 / 100);
        }
    }

    @Test
    void aunqueElDuenoPongaMasDel45PorCientoNuncaSePasa() {
        assertThat(BonosAuto.escalera(22, 2_831, 80)).isEqualTo(BonosAuto.escalera(22, 2_831, 45));
    }

    @Test
    void sinMargenOSinDiaNormalNoHayBonos() {
        assertThat(BonosAuto.escalera(22, 0, 50)).isEmpty();
        assertThat(BonosAuto.escalera(0, 2_831, 50)).isEmpty();
    }

    @Test
    void conUnDiaNormalChiquitoLosEscalonesNoSeRepitenNiBajan() {
        List<Escalones.Escalon> escalera = BonosAuto.escalera(3, 2_800, 50);

        for (int i = 1; i < escalera.size(); i++) {
            assertThat(escalera.get(i).granizados()).isGreaterThan(escalera.get(i - 1).granizados());
            assertThat(escalera.get(i).total()).isGreaterThan(escalera.get(i - 1).total());
        }
    }
}
