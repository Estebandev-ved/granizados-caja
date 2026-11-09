package co.granizados.pos.resumen;

import static org.assertj.core.api.Assertions.assertThat;

import co.granizados.pos.PruebaIntegracion;
import co.granizados.pos.ajustes.AjustesService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;

class PerfilTest extends PruebaIntegracion {

    @Autowired
    EstadoService estado;

    @Autowired
    AjustesService ajustes;

    @Test
    void sinPerfilElEstadoLoDejaVacioYTodoSigueIgual() {
        assertThat(estado.estado().perfil()).isNull();
    }

    @Test
    void elPerfilGuardadoLeLlegaATodosEnElEstado() {
        String perfil = "{\"nombre\":\"Café Luna\",\"rubro\":\"cafe\",\"equipo\":false,\"fiados\":true}";
        ajustes.actualizar("PERFIL", perfil);

        assertThat(estado.estado().perfil()).isEqualTo(perfil);
    }
}
