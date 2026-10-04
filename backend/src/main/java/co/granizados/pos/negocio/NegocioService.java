package co.granizados.pos.negocio;

import co.granizados.pos.ajustes.ConfigParam;
import co.granizados.pos.ajustes.ConfigParamRepository;
import java.util.List;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Deja listo a un negocio la primera vez que entra: le siembra sus ajustes por defecto. */
@Service
public class NegocioService {

    private record Ajuste(String clave, String valor, String nota) {
    }

    private static final List<Ajuste> POR_DEFECTO = List.of(
            new Ajuste("PROVEEDOR_WHATSAPP", "", "Número del proveedor con 57 adelante, sin + ni espacios. Ej: 573001234567"),
            new Ajuste("DIAS_COBERTURA", "4", "Para cuántos días de venta quieres tener inventario después de pedir"),
            new Ajuste("DIAS_HISTORIAL", "14", "Cuántos días atrás mirar para calcular el promedio de ventas"),
            new Ajuste("NOMBRE", "", "Cómo firmas el pedido"),
            new Ajuste("META_DIARIA", "0", "Lo que quieres vender al día en pesos. 0 la apaga"));

    private final ConfigParamRepository config;
    /** Negocios que ya se sabe que están listos: evita ir a la base en cada petición. */
    private final Set<Long> listos = ConcurrentHashMap.newKeySet();

    public NegocioService(ConfigParamRepository config) {
        this.config = config;
    }

    /** Siembra los ajustes del negocio actual si no tiene ninguno. Hay que llamarlo con el negocio ya puesto. */
    @Transactional
    public void asegurar(long negocioId) {
        if (listos.contains(negocioId)) return;
        if (config.count() == 0) {
            POR_DEFECTO.forEach(a -> config.save(new ConfigParam(a.clave(), a.valor(), a.nota())));
        }
        listos.add(negocioId);
    }

    /** Solo para pruebas: olvida qué negocios estaban listos. */
    void olvidar() {
        listos.clear();
    }
}
