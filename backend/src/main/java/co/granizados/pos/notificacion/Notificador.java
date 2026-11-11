package co.granizados.pos.notificacion;

/** Canal por donde le llegan los avisos al dueño. Implementaciones nunca deben lanzar excepción. */
public interface Notificador {

    void enviar(String asunto, String texto);

    /** Un aviso con un archivo adjunto (la copia de seguridad del mes). Sin soporte de archivos, manda solo el texto. */
    default void enviarArchivo(String asunto, String texto, String nombreArchivo, byte[] contenido) {
        enviar(asunto, texto);
    }
}
