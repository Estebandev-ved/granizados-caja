package co.granizados.pos.comun;

import java.util.stream.Collectors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Errores de la API como {"error": "..."}.
 * Regla para el celular: 4xx = no reintentar (el dato está mal), 5xx o sin red = reintentar.
 */
@RestControllerAdvice
public class ApiErrores {

    private static final Logger log = LoggerFactory.getLogger(ApiErrores.class);

    public record Error(String error) {
    }

    @ExceptionHandler(NoEncontradoException.class)
    @ResponseStatus(HttpStatus.NOT_FOUND)
    public Error noEncontrado(NoEncontradoException e) {
        return new Error(e.getMessage());
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Error invalido(MethodArgumentNotValidException e) {
        return new Error(e.getBindingResult().getFieldErrors().stream()
                .map(f -> f.getField() + ": " + f.getDefaultMessage())
                .collect(Collectors.joining(", ")));
    }

    @ExceptionHandler({IllegalArgumentException.class, HttpMessageNotReadableException.class})
    @ResponseStatus(HttpStatus.BAD_REQUEST)
    public Error malFormado(Exception e) {
        return new Error(e instanceof IllegalArgumentException ? e.getMessage() : "Datos mal formados");
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    @ResponseStatus(HttpStatus.CONFLICT)
    public Error conflicto(DataIntegrityViolationException e) {
        log.warn("Conflicto de datos: {}", e.getMostSpecificCause().getMessage());
        return new Error("Ya existe o choca con otro registro");
    }
}
