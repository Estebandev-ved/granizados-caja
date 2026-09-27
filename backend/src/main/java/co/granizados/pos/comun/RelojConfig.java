package co.granizados.pos.comun;

import java.time.Clock;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/** Todo lo que dependa de "ahora" usa este Clock, así las pruebas pueden mover la hora. */
@Configuration
public class RelojConfig {

    @Bean
    public Clock clock() {
        return Clock.systemUTC();
    }
}
