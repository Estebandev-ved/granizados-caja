package co.granizados.pos.resumen;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import co.granizados.pos.PruebaIntegracion;
import co.granizados.pos.equipo.EquipoService;
import co.granizados.pos.equipo.EquipoService.NuevoVendedor;
import co.granizados.pos.plata.PlataService;
import co.granizados.pos.venta.MetodoPago;
import co.granizados.pos.venta.VentaService;
import co.granizados.pos.venta.VentaService.NuevaVenta;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

/** El dueño ve de quién es cada venta: en las ventas de hoy y en los movimientos de Mi plata. */
@AutoConfigureMockMvc
class QuienVendioTest extends PruebaIntegracion {

    @Autowired
    EstadoService estado;

    @Autowired
    PlataService plata;

    @Autowired
    VentaService ventas;

    @Autowired
    EquipoService equipo;

    @Autowired
    MockMvc mvc;

    private void venderComoJuan(String uid, String metodo, int cantidad) throws Exception {
        String cuerpo = mvc.perform(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content("{\"pin\":\"1111\"}"))
                .andReturn().getResponse().getContentAsString();
        String token = cuerpo.replaceAll(".*\"token\":\"([^\"]+)\".*", "$1");
        mvc.perform(post("/api/ventas").header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"clientUid\":\"" + uid + "\",\"productoId\":" + idDe("Smirnoff") + ",\"metodo\":\"" + metodo
                                + "\",\"cantidad\":" + cantidad + "}"))
                .andExpect(status().isOk());
    }

    @Test
    void cadaVentaDeHoyDiceQuienLaHizo() throws Exception {
        equipo.crear(new NuevoVendedor("Juan", "1111", 10));
        ventas.registrar(new NuevaVenta("d-1", idDe("Smirnoff"), MetodoPago.EFECTIVO, 1));
        venderComoJuan("j-1", "NEQUI", 2);

        var ultimas = estado.estado().ultimas();

        assertThat(ultimas).filteredOn(u -> u.clientUid().equals("j-1")).extracting(EstadoService.VentaReciente::vendedor).containsExactly("Juan");
        assertThat(ultimas).filteredOn(u -> u.clientUid().equals("d-1")).extracting(EstadoService.VentaReciente::vendedor).containsOnlyNulls();
    }

    @Test
    void enMovimientosLasVentasVanSeparadasPorQuienLasHizo() throws Exception {
        equipo.crear(new NuevoVendedor("Juan", "1111", 10));
        ventas.registrar(new NuevaVenta("d-1", idDe("Smirnoff"), MetodoPago.EFECTIVO, 1));
        venderComoJuan("j-1", "EFECTIVO", 2);
        venderComoJuan("j-2", "NEQUI", 1);

        var deVentas = plata.movimientos(1).stream().filter(m -> m.tipo().equals("VENTAS")).toList();

        assertThat(deVentas).extracting(PlataService.Movimiento::concepto).containsExactlyInAnyOrder(
                "Ventas en efectivo · 1 u.", "Ventas en efectivo de Juan · 2 u.", "Ventas por Nequi de Juan · 1 u.");
        assertThat(deVentas).extracting(PlataService.Movimiento::quien).containsExactlyInAnyOrder("Tú", "Juan", "Juan");
        assertThat(deVentas).filteredOn(m -> "Juan".equals(m.quien()) && m.lugar().equals("CAJA"))
                .extracting(PlataService.Movimiento::monto).containsExactly(12_000L);
    }
}
