package co.granizados.pos.notificacion;

import co.granizados.pos.comun.AppProperties;
import co.granizados.pos.venta.StockBajo;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionalEventListener;

/**
 * Cuándo se manda cada aviso.
 * El de stock bajo sale después de confirmar la venta y en otro hilo: Telegram lento no demora la venta.
 */
@Component
public class Avisos {

    private static final Logger log = LoggerFactory.getLogger(Avisos.class);

    private final Reportes reportes;
    private final Notificador notificador;
    private final long negocioPrincipal;

    public Avisos(Reportes reportes, Notificador notificador, AppProperties props) {
        this.reportes = reportes;
        this.notificador = notificador;
        this.negocioPrincipal = props.negocioId();
    }

    @Async
    @TransactionalEventListener
    public void alBajarStock(StockBajo evento) {
        // El Telegram es del dueño del negocio principal: los demás negocios no le mandan avisos
        if (evento.negocioId() != null && evento.negocioId() != negocioPrincipal) return;
        try {
            enviar(reportes.stockBajo(evento));
        } catch (Exception e) {
            log.warn("No se pudo armar el aviso de stock bajo", e);
        }
    }

    void enviar(Reportes.Aviso aviso) {
        notificador.enviar(aviso.asunto(), aviso.texto());
    }

    /** Tareas por horario (hora Bogotá). En Railway el servidor no se duerme, así que corren solas. */
    @Component
    @ConditionalOnProperty(name = "app.tareas.habilitadas", havingValue = "true")
    static class Programadas {

        private final Reportes reportes;
        private final Avisos avisos;

        Programadas(Reportes reportes, Avisos avisos) {
            this.reportes = reportes;
            this.avisos = avisos;
        }

        @Scheduled(cron = "${app.tareas.cierre-diario}", zone = "${app.zona}")
        void cierreDiario() {
            reportes.cierreDelDia().ifPresent(avisos::enviar);
        }

        @Scheduled(cron = "${app.tareas.pedido-semanal}", zone = "${app.zona}")
        void pedidoSemanal() {
            avisos.enviar(reportes.pedidoSemanal());
        }
    }
}
