package co.granizados.pos.seguridad;

import co.granizados.pos.comun.AppProperties;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;

@Service
public class TokenService {

    private final JwtEncoder encoder;
    private final AppProperties props;
    private final Clock clock;

    public TokenService(JwtEncoder encoder, AppProperties props, Clock clock) {
        this.encoder = encoder;
        this.props = props;
        this.clock = clock;
    }

    /** Token de un trabajador: solo puede vender (ver RolFiltro) y trae quién es, para marcar sus ventas. */
    public String emitirVendedor(Long vendedorId, String nombre) {
        Instant ahora = clock.instant();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer("granizados-pos")
                .subject("vendedor:" + vendedorId)
                .claim("negocio_id", props.negocioId())
                .claim("rol", "vendedor")
                .claim("vendedor_id", vendedorId)
                .claim("nombre", nombre)
                .issuedAt(ahora)
                .expiresAt(ahora.plus(Duration.ofDays(props.tokenDias())))
                .build();
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        return encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
    }

    public String emitir() {
        Instant ahora = clock.instant();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer("granizados-pos")
                .subject("dueno")
                .claim("negocio_id", props.negocioId())
                .issuedAt(ahora)
                .expiresAt(ahora.plus(Duration.ofDays(props.tokenDias())))
                .build();
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        return encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
    }
}
