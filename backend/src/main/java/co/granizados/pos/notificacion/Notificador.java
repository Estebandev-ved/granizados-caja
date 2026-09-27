package co.granizados.pos.notificacion;

/** Canal por donde le llegan los avisos al dueño. Implementaciones nunca deben lanzar excepción. */
public interface Notificador {

    void enviar(String asunto, String texto);
}
