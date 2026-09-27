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

    public String emitir() {
        Instant ahora = clock.instant();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer("granizados-pos")
                .subject("dueno")
                .issuedAt(ahora)
                .expiresAt(ahora.plus(Duration.ofDays(props.tokenDias())))
                .build();
        JwsHeader header = JwsHeader.with(MacAlgorithm.HS256).build();
        return encoder.encode(JwtEncoderParameters.from(header, claims)).getTokenValue();
    }
}
