package co.granizados.pos.reporte;

import java.nio.charset.StandardCharsets;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

/** Reportes del negocio: totales, cortes y el CSV para exportar. Todo con fechas de Bogotá. */
@RestController
@RequestMapping("/api/reportes")
public class ReporteController {

    private final ReporteService servicio;

    public ReporteController(ReporteService servicio) {
        this.servicio = servicio;
    }

    @GetMapping
    public ReporteService.Reporte reporte(@RequestParam String desde, @RequestParam String hasta) {
        return conLimpio(() -> servicio.reporte(desde, hasta));
    }

    /** El CSV de las ventas, con `;` y BOM: se abre en Excel sin que se rompa en acentos. */
    @GetMapping("/ventas.csv")
    public ResponseEntity<byte[]> csv(@RequestParam String desde, @RequestParam String hasta) {
        String texto = conLimpio(() -> servicio.csv(desde, hasta));
        byte[] cuerpo = ("﻿" + texto).getBytes(StandardCharsets.UTF_8);
        return ResponseEntity.ok()
                .contentType(new MediaType("text", "csv", StandardCharsets.UTF_8))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename("ventas-" + desde + "_" + hasta + ".csv").build().toString())
                .body(cuerpo);
    }

    /** Fechas mal puestas no son error 500: el celular solo descarta si es 4xx. */
    private <T> T conLimpio(java.util.function.Supplier<T> accion) {
        try {
            return accion.get();
        } catch (IllegalArgumentException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Fechas inválidas: " + e.getMessage(), e);
        }
    }
}
