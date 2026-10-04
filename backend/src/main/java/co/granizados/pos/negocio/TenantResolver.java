package co.granizados.pos.negocio;

import co.granizados.pos.comun.AppProperties;
import java.util.Map;
import org.hibernate.cfg.AvailableSettings;
import org.hibernate.context.spi.CurrentTenantIdentifierResolver;
import org.springframework.boot.hibernate.autoconfigure.HibernatePropertiesCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.stereotype.Component;

/**
 * Le dice a Hibernate de qué negocio es la petición. Con eso, toda consulta (HQL, derivadas y guardados) se filtra
 * sola por negocio_id gracias a @TenantId en las entidades: no hay que acordarse de filtrar a mano.
 */
@Component
public class TenantResolver implements CurrentTenantIdentifierResolver<Long> {

    private final long porDefecto;

    public TenantResolver(AppProperties props) {
        this.porDefecto = props.negocioId();
    }

    @Override
    public Long resolveCurrentTenantIdentifier() {
        Long actual = TenantContext.actual();
        return actual != null ? actual : porDefecto;
    }

    @Override
    public boolean validateExistingCurrentSessions() {
        return true;
    }

    @Configuration
    static class Registro {

        @Bean
        HibernatePropertiesCustomizer tenantResolverCustomizer(TenantResolver resolver) {
            return (Map<String, Object> props) -> props.put(AvailableSettings.MULTI_TENANT_IDENTIFIER_RESOLVER, resolver);
        }
    }
}
