package co.granizados.pos.seguridad.passkey;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import co.granizados.pos.PruebaIntegracion;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/** Face ID de punta a punta: registrar la llave con sesión y después entrar solo con la firma. */
@AutoConfigureMockMvc
class FaceIdTest extends PruebaIntegracion {

    @Autowired
    MockMvc mvc;

    String token;
    AutenticadorFalso iphone;

    @BeforeEach
    void preparar() throws Exception {
        jdbc.update("delete from passkey");
        token = campo(mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content("{\"pin\":\"4321\"}"))
                .andReturn().getResponse().getContentAsString(), "token");
        iphone = new AutenticadorFalso();
    }

    @Test
    void registrarYEntrarConFaceId() throws Exception {
        // Sin llaves registradas, no hay Face ID
        mvc.perform(post("/api/passkey/login/opciones")).andExpect(status().isNotFound());

        registrar(iphone).andExpect(status().isCreated()).andExpect(jsonPath("$.nombre").value("iPhone X"));

        // Entrar: sin token, solo con la firma del iPhone
        String opciones = cuerpo(post("/api/passkey/login/opciones"));
        String nuevoToken = campo(enviar("/api/passkey/login", campo(opciones, "solicitud"), iphone.firmar(opciones), null)
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString(), "token");

        mvc.perform(get("/api/estado").header("Authorization", "Bearer " + nuevoToken)).andExpect(status().isOk());
        assertThat(jdbc.queryForObject("select count(*) from passkey where usada_en is not null", Integer.class)).isEqualTo(1);
    }

    @Test
    void registrarPideSesion() throws Exception {
        mvc.perform(post("/api/passkey/registro/opciones")).andExpect(status().isUnauthorized());
    }

    @Test
    void unaSolicitudNoSePuedeUsarDosVeces() throws Exception {
        registrar(iphone).andExpect(status().isCreated());
        String opciones = cuerpo(post("/api/passkey/login/opciones"));
        String firma = iphone.firmar(opciones);

        enviar("/api/passkey/login", campo(opciones, "solicitud"), firma, null).andExpect(status().isOk());
        enviar("/api/passkey/login", campo(opciones, "solicitud"), firma, null).andExpect(status().isUnauthorized());
    }

    @Test
    void firmarElRetoEquivocadoNoDejaEntrar() throws Exception {
        registrar(iphone).andExpect(status().isCreated());
        String a = cuerpo(post("/api/passkey/login/opciones"));
        String b = cuerpo(post("/api/passkey/login/opciones"));

        // Firma el reto de A pero lo manda como respuesta a B (ataque de repetición)
        enviar("/api/passkey/login", campo(b, "solicitud"), iphone.firmar(a), null)
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Face ID no válido"));
    }

    @Test
    void otroCelularNoRegistradoNoEntra() throws Exception {
        registrar(iphone).andExpect(status().isCreated());
        AutenticadorFalso intruso = new AutenticadorFalso();
        String opciones = cuerpo(post("/api/passkey/login/opciones"));

        enviar("/api/passkey/login", campo(opciones, "solicitud"), intruso.firmar(opciones), null)
                .andExpect(status().isUnauthorized());
    }

    @Test
    void borrarElFaceId() throws Exception {
        registrar(iphone).andExpect(status().isCreated());
        String lista = cuerpo(conToken(get("/api/passkey")));
        String id = lista.replaceAll("(?s).*\"id\":(\\d+).*", "$1");

        mvc.perform(conToken(delete("/api/passkey/" + id))).andExpect(status().isNoContent());
        mvc.perform(post("/api/passkey/login/opciones")).andExpect(status().isNotFound());
    }

    private ResultActions registrar(AutenticadorFalso autenticador) throws Exception {
        String opciones = cuerpo(conToken(post("/api/passkey/registro/opciones")));
        assertThat(opciones).contains("\"rp\"").contains("\"authenticatorAttachment\":\"platform\"");
        return enviar("/api/passkey/registro", campo(opciones, "solicitud"), autenticador.registrar(opciones), "iPhone X");
    }

    private ResultActions enviar(String ruta, String solicitud, String credencial, String nombre) throws Exception {
        String json = "{\"solicitud\":\"" + solicitud + "\",\"credencial\":\"" + credencial.replace("\"", "\\\"").replace("\n", "")
                + "\"" + (nombre == null ? "" : ",\"nombre\":\"" + nombre + "\"") + "}";
        return mvc.perform(conToken(post(ruta)).content(json));
    }

    private MockHttpServletRequestBuilder conToken(MockHttpServletRequestBuilder req) {
        return req.header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON);
    }

    private String cuerpo(MockHttpServletRequestBuilder req) throws Exception {
        return mvc.perform(req).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
    }

    private static String campo(String json, String nombre) {
        return json.replaceAll("(?s).*\"" + nombre + "\":\"([^\"]+)\".*", "$1");
    }
}
