package co.granizados.pos.equipo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import co.granizados.pos.PruebaIntegracion;
import co.granizados.pos.equipo.EquipoService.Carga;
import co.granizados.pos.equipo.EquipoService.Conteo;
import co.granizados.pos.equipo.EquipoService.ItemCarga;
import co.granizados.pos.equipo.EquipoService.ItemConteo;
import co.granizados.pos.equipo.EquipoService.NuevoVendedor;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/** Al terminar el día el dueño cuenta lo que le devolvió el trabajador: lo que falte se le descuenta solo. */
@AutoConfigureMockMvc
class ConteoCargaTest extends PruebaIntegracion {

    @Autowired
    EquipoService equipo;

    @Autowired
    MockMvc mvc;

    private String entrar(String pin) throws Exception {
        String cuerpo = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content("{\"pin\":\"" + pin + "\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        return cuerpo.replaceAll(".*\"token\":\"([^\"]+)\".*", "$1");
    }

    private MockHttpServletRequestBuilder con(String token, MockHttpServletRequestBuilder req) {
        return req.header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON);
    }

    private void vender(String token, String uid, String sabor, int cantidad) throws Exception {
        mvc.perform(con(token, post("/api/ventas")).content("{\"clientUid\":\"" + uid + "\",\"productoId\":" + idDe(sabor)
                        + ",\"metodo\":\"EFECTIVO\",\"cantidad\":" + cantidad + "}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.estado").value("REGISTRADA"));
    }

    @Test
    void loQueFaltaAlContarSeLeDescuentaYContarOtraVezNoCobraDosVeces() throws Exception {
        var juan = equipo.crear(new NuevoVendedor("Juan", "1111", 10));
        equipo.cargar(juan.id(), new Carga(List.of(new ItemCarga(idDe("Smirnoff"), 5), new ItemCarga(idDe("Mojito"), 3))));
        String token = entrar("1111");
        vender(token, "v-1", "Smirnoff", 2);
        int antes = stockDe("Smirnoff");

        var porContar = equipo.porContar(juan.id(), null);
        assertThat(porContar.filas()).extracting(EquipoService.FilaCarga::queda).containsExactly(3, 3); // Mojito, Smirnoff
        assertThat(porContar.ultimo()).isNull();

        // La app dice que le quedan 3 de Smirnoff y 3 de Mojito, pero devolvió 1 de Smirnoff y 4 de Mojito
        var r = equipo.contar(juan.id(), new Conteo(null, List.of(new ItemConteo(idDe("Smirnoff"), 1), new ItemConteo(idDe("Mojito"), 4))));

        assertThat(r.conteo().faltaron()).isEqualTo(2);
        assertThat(r.conteo().sobraron()).isEqualTo(1);
        assertThat(r.conteo().cobrado()).isEqualTo(12_000);
        assertThat(r.conteo().detalle()).contains("Smirnoff: quedaban 3, devolvió 1 (faltaron 2)");
        assertThat(stockDe("Smirnoff")).isEqualTo(antes - 2);
        var cuentas = equipo.liquidar(equipo.hoy(), equipo.hoy()).getFirst();
        assertThat(cuentas.unidadesFaltantes()).isEqualTo(2);
        assertThat(cuentas.faltantes()).isEqualTo(12_000);
        assertThat(cuentas.unidades()).isEqualTo(2); // lo que faltó no cuenta como vendido

        // Contar otra vez lo mismo no cobra de nuevo: el faltante ya bajó lo que se espera
        var otra = equipo.contar(juan.id(), new Conteo(null, List.of(new ItemConteo(idDe("Smirnoff"), 1))));
        assertThat(otra.conteo().faltaron()).isZero();
        assertThat(otra.conteo().cobrado()).isZero();
        assertThat(equipo.liquidar(equipo.hoy(), equipo.hoy()).getFirst().faltantes()).isEqualTo(12_000);
        assertThat(equipo.listar().getFirst().contadoHoy()).isNotNull();
    }

    @Test
    void siDevolvioTodoNoSeLeDescuentaNada() throws Exception {
        var juan = equipo.crear(new NuevoVendedor("Juan", "1111", 10));
        equipo.cargar(juan.id(), new Carga(List.of(new ItemCarga(idDe("Smirnoff"), 5))));
        String token = entrar("1111");
        vender(token, "v-1", "Smirnoff", 2);

        var r = equipo.contar(juan.id(), new Conteo(null, List.of(new ItemConteo(idDe("Smirnoff"), 3))));

        assertThat(r.conteo().faltaron()).isZero();
        assertThat(r.conteo().cobrado()).isZero();
        assertThat(jdbc.queryForObject("select count(*) from venta where metodo = 'FALTANTE'", Integer.class)).isZero();
    }

    @Test
    void laCargaDeAyerSeCuentaContraAyerYNoTocaLaDeHoy() throws Exception {
        reloj.poner("2026-09-24T15:00-05:00");
        var juan = equipo.crear(new NuevoVendedor("Juan", "1111", 10));
        equipo.cargar(juan.id(), new Carga(List.of(new ItemCarga(idDe("Smirnoff"), 4))));
        String token = entrar("1111");
        vender(token, "ayer-1", "Smirnoff", 2);

        reloj.poner("2026-09-25T09:00-05:00");
        equipo.cargar(juan.id(), new Carga(List.of(new ItemCarga(idDe("Smirnoff"), 6))));
        var r = equipo.contar(juan.id(), new Conteo(equipo.hoy().minusDays(1), List.of(new ItemConteo(idDe("Smirnoff"), 0))));

        assertThat(r.conteo().faltaron()).isEqualTo(2);
        assertThat(r.conteo().dia()).isEqualTo(equipo.hoy().minusDays(1));
        // El faltante quedó en ayer: hoy sigue con sus 6 completos
        assertThat(equipo.porContar(juan.id(), null).filas().getFirst().queda()).isEqualTo(6);
        assertThat(equipo.porContar(juan.id(), equipo.hoy().minusDays(1)).filas().getFirst().queda()).isZero();
        // Y se le descuenta en su próximo pago
        assertThat(equipo.cuenta(juan.id()).pendiente().faltantes()).isEqualTo(12_000);

        assertThatThrownBy(() -> equipo.contar(juan.id(), new Conteo(equipo.hoy().minusDays(2), List.of(new ItemConteo(idDe("Smirnoff"), 0)))))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void sinCargaNoHayNadaQueContar() {
        var juan = equipo.crear(new NuevoVendedor("Juan", "1111", 10));
        assertThatThrownBy(() -> equipo.contar(juan.id(), new Conteo(null, List.of(new ItemConteo(idDe("Smirnoff"), 0)))))
                .isInstanceOf(IllegalArgumentException.class).hasMessageContaining("no le diste carga");
    }

    @Test
    void elTrabajadorNoSePuedeContarASiMismo() throws Exception {
        var juan = equipo.crear(new NuevoVendedor("Juan", "1111", 10));
        equipo.cargar(juan.id(), new Carga(List.of(new ItemCarga(idDe("Smirnoff"), 5))));
        String token = entrar("1111");

        mvc.perform(con(token, get("/api/equipo/" + juan.id() + "/conteo"))).andExpect(status().isForbidden());
        mvc.perform(con(token, post("/api/equipo/" + juan.id() + "/conteo"))
                        .content("{\"items\":[{\"productoId\":" + idDe("Smirnoff") + ",\"devolvio\":5}]}"))
                .andExpect(status().isForbidden());
    }
}
