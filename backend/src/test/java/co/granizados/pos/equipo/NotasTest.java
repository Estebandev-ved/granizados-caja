package co.granizados.pos.equipo;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import co.granizados.pos.PruebaIntegracion;
import co.granizados.pos.equipo.EquipoService.NuevoVendedor;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/** El dueño le deja notas al trabajador; él las ve en Mi día y las marca como leídas, y el dueño sabe cuándo las leyó. */
@AutoConfigureMockMvc
class NotasTest extends PruebaIntegracion {

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

    private long idDeNota(String cuerpo) {
        return Long.parseLong(cuerpo.replaceAll(".*\"id\":(\\d+).*", "$1"));
    }

    @Test
    void elDuenoEscribeElTrabajadorLaLeeYElDuenoSabeCuando() throws Exception {
        var juan = equipo.crear(new NuevoVendedor("Juan", "1111", 10));
        String dueno = entrar("4321");
        String token = entrar("1111");

        String cuerpo = mvc.perform(con(dueno, post("/api/equipo/" + juan.id() + "/notas")).content("{\"texto\":\"  Mañana se empieza a las 8  \"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.texto").value("Mañana se empieza a las 8"))
                .andReturn().getResponse().getContentAsString();
        long nota = idDeNota(cuerpo);

        mvc.perform(con(token, get("/api/mi-turno/notas"))).andExpect(status().isOk())
                .andExpect(jsonPath("$[0].texto").value("Mañana se empieza a las 8"))
                .andExpect(jsonPath("$[0].leidaEn").isEmpty());

        mvc.perform(con(token, post("/api/mi-turno/notas/" + nota + "/leida"))).andExpect(status().isOk())
                .andExpect(jsonPath("$.leidaEn").isNotEmpty());
        mvc.perform(con(dueno, get("/api/equipo/" + juan.id() + "/notas")))
                .andExpect(jsonPath("$[0].leidaEn").isNotEmpty());
    }

    @Test
    void elTrabajadorNoEscribeNotasNiLeeLasDeOtro() throws Exception {
        var juan = equipo.crear(new NuevoVendedor("Juan", "1111", 10));
        var pedro = equipo.crear(new NuevoVendedor("Pedro", "2222", 10));
        String dueno = entrar("4321");
        String deJuan = mvc.perform(con(dueno, post("/api/equipo/" + juan.id() + "/notas")).content("{\"texto\":\"Solo para Juan\"}"))
                .andReturn().getResponse().getContentAsString();
        long nota = idDeNota(deJuan);

        String tokenPedro = entrar("2222");
        mvc.perform(con(tokenPedro, get("/api/mi-turno/notas"))).andExpect(jsonPath("$.length()").value(0));
        mvc.perform(con(tokenPedro, post("/api/mi-turno/notas/" + nota + "/leida"))).andExpect(status().isNotFound());
        mvc.perform(con(tokenPedro, post("/api/equipo/" + pedro.id() + "/notas")).content("{\"texto\":\"hola\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void unaNotaParaTodosLlegaACadaTrabajadorActivoYElDuenoLaPuedeBorrar() throws Exception {
        var juan = equipo.crear(new NuevoVendedor("Juan", "1111", 10));
        equipo.crear(new NuevoVendedor("Pedro", "2222", 10));
        String dueno = entrar("4321");

        mvc.perform(con(dueno, post("/api/equipo/notas")).content("{\"texto\":\"Hoy hay promo\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.enviadas").value(2));
        mvc.perform(con(entrar("2222"), get("/api/mi-turno/notas"))).andExpect(jsonPath("$[0].texto").value("Hoy hay promo"));

        String lista = mvc.perform(con(dueno, get("/api/equipo/" + juan.id() + "/notas"))).andReturn().getResponse().getContentAsString();
        mvc.perform(con(dueno, delete("/api/equipo/notas/" + idDeNota(lista)))).andExpect(status().isNoContent());
        mvc.perform(con(dueno, get("/api/equipo/" + juan.id() + "/notas"))).andExpect(jsonPath("$.length()").value(0));

        // Vacía o muy larga no se guarda
        mvc.perform(con(dueno, post("/api/equipo/notas")).content("{\"texto\":\"   \"}")).andExpect(status().isBadRequest());
        mvc.perform(con(dueno, post("/api/equipo/notas")).content("{\"texto\":\"" + "a".repeat(301) + "\"}"))
                .andExpect(status().isBadRequest());
    }
}
