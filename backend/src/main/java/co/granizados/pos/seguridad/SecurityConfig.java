package co.granizados.pos.seguridad;

import co.granizados.pos.comun.AppProperties;
import co.granizados.pos.negocio.NegocioFiltro;
import co.granizados.pos.negocio.NegocioService;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import java.nio.charset.StandardCharsets;
import java.util.List;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtIssuerValidator;
import org.springframework.security.oauth2.jwt.JwtTimestampValidator;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

/**
 * Se entra de dos maneras: con PIN o Face ID (token propio de 30 días, del negocio por defecto) o con la cuenta de
 * Antigravity (token de 12 horas firmado por ellos, del negocio que diga el claim negocio_id).
 * La API es stateless con token Bearer, sin cookies, por eso CSRF no aplica.
 */
@Configuration
public class SecurityConfig {

    @Bean
    SecretKey claveJwt(AppProperties props) {
        byte[] bytes = props.jwtSecret().getBytes(StandardCharsets.UTF_8);
        if (bytes.length < 32) {
            throw new IllegalStateException("JWT_SECRET debe tener al menos 32 caracteres");
        }
        return new SecretKeySpec(bytes, "HmacSHA256");
    }

    @Bean
    JwtEncoder jwtEncoder(SecretKey clave) {
        return new NimbusJwtEncoder(new ImmutableSecret<>(clave));
    }

    @Bean
    JwtDecoder jwtDecoder(SecretKey clave, AppProperties props) {
        NimbusJwtDecoder propio = NimbusJwtDecoder.withSecretKey(clave).macAlgorithm(MacAlgorithm.HS256).build();
        if (props.antigravity() == null || !props.antigravity().activo()) return propio;

        byte[] bytes = props.antigravity().jwtSecret().getBytes(StandardCharsets.UTF_8);
        if (bytes.length < 32) {
            throw new IllegalStateException("CAJA_JWT_SECRET debe tener al menos 32 caracteres");
        }
        NimbusJwtDecoder deAntigravity = NimbusJwtDecoder.withSecretKey(new SecretKeySpec(bytes, "HmacSHA256"))
                .macAlgorithm(MacAlgorithm.HS256).build();
        // Lo de Antigravity se acepta solo si el emisor, la audiencia y el negocio vienen como se acordó
        deAntigravity.setJwtValidator(new DelegatingOAuth2TokenValidator<>(
                new JwtTimestampValidator(),
                new JwtIssuerValidator("antigravity"),
                audienciaCaja(),
                traeNegocio()));

        return token -> {
            try {
                return propio.decode(token);
            } catch (JwtException noEsPropio) {
                return deAntigravity.decode(token);
            }
        };
    }

    private static OAuth2TokenValidator<Jwt> audienciaCaja() {
        return jwt -> jwt.getAudience() != null && jwt.getAudience().contains("caja")
                ? OAuth2TokenValidatorResult.success()
                : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "La audiencia no es la caja", null));
    }

    private static OAuth2TokenValidator<Jwt> traeNegocio() {
        return jwt -> {
            Object negocio = jwt.getClaim("negocio_id");
            boolean valido = negocio instanceof Number n && n.longValue() > 0;
            return valido ? OAuth2TokenValidatorResult.success()
                    : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "Falta el negocio", null));
        };
    }

    /**
     * El frontend puede vivir en otro dominio (ej: Vercel) mientras el backend queda en Railway.
     * Reusa los mismos orígenes de Face ID: si un dominio puede hacer la ceremonia de passkey,
     * también debe poder llamar a la API desde ahí.
     */
    @Bean
    CorsConfigurationSource corsConfigurationSource(AppProperties props) {
        CorsConfiguration config = new CorsConfiguration();
        config.setAllowedOrigins(props.webauthn().origenes());
        config.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        config.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", config);
        return source;
    }

    @Bean
    SecurityFilterChain filtros(HttpSecurity http, @Qualifier("corsConfigurationSource") CorsConfigurationSource cors,
                                AppProperties props, NegocioService negocios) throws Exception {
        http
                .csrf(c -> c.disable())
                .cors(c -> c.configurationSource(cors))
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(a -> a
                        .requestMatchers("/api/auth/login", "/api/passkey/login", "/api/passkey/login/opciones", "/actuator/health").permitAll()
                        .requestMatchers("/api/**", "/actuator/**").authenticated()
                        .anyRequest().permitAll()) // el frontend (archivos estáticos)
                .oauth2ResourceServer(o -> o.jwt(Customizer.withDefaults()))
                // Después de verificar el token: de ahí sale el negocio de la petición
                .addFilterAfter(new NegocioFiltro(props, negocios), BearerTokenAuthenticationFilter.class);
        return http.build();
    }
}
