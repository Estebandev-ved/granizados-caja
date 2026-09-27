package co.granizados.pos;

import java.time.Instant;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

/** Reemplaza el reloj real por uno que las pruebas controlan. */
@TestConfiguration
class PruebaConfig {

    @Bean
    @Primary
    RelojPrueba relojPrueba() {
        return new RelojPrueba(Instant.parse("2026-09-25T20:00:00Z")); // 3pm en Bogotá
    }
}
