package co.granizados.pos.equipo;

/** Algo que le pasó a un trabajador y el dueño debe saber (le queda poco, cerró su turno). Sale por el Notificador. */
public record AvisoEquipo(Long negocioId, String asunto, String texto) {
}
