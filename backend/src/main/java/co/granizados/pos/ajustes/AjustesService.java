package co.granizados.pos.ajustes;

import co.granizados.pos.comun.NoEncontradoException;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AjustesService {

    public static final String PROVEEDOR_WHATSAPP = "PROVEEDOR_WHATSAPP";
    public static final String DIAS_COBERTURA = "DIAS_COBERTURA";
    public static final String DIAS_HISTORIAL = "DIAS_HISTORIAL";
    public static final String META_DIARIA = "META_DIARIA";
    public static final String NOMBRE = "NOMBRE";

    public record ParamDto(String clave, String valor, String nota) {
    }

    private final ConfigParamRepository repo;

    public AjustesService(ConfigParamRepository repo) {
        this.repo = repo;
    }

    @Transactional(readOnly = true)
    public List<ParamDto> todos() {
        return repo.findAll(Sort.by("clave")).stream()
                .map(p -> new ParamDto(p.getClave(), p.getValor(), p.getNota())).toList();
    }

    @Transactional(readOnly = true)
    public Map<String, String> mapa() {
        return repo.findAll().stream().collect(Collectors.toMap(ConfigParam::getClave, ConfigParam::getValor));
    }

    @Transactional
    public ParamDto actualizar(String clave, String valor) {
        ConfigParam p = repo.findByClave(clave).orElseThrow(() -> new NoEncontradoException("No existe el ajuste " + clave));
        p.setValor(validar(clave, valor == null ? "" : valor.trim()));
        return new ParamDto(p.getClave(), p.getValor(), p.getNota());
    }

    public static int entero(Map<String, String> cfg, String clave, int porDefecto) {
        try {
            int n = Integer.parseInt(cfg.getOrDefault(clave, "").trim());
            return n > 0 ? n : porDefecto;
        } catch (NumberFormatException e) {
            return porDefecto;
        }
    }

    private static String validar(String clave, String valor) {
        switch (clave) {
            case PROVEEDOR_WHATSAPP -> {
                String digitos = valor.replaceAll("\\D", "");
                if (!digitos.isEmpty() && (digitos.length() < 10 || digitos.length() > 15)) {
                    throw new IllegalArgumentException("El WhatsApp debe ir con indicativo, ej: 573001234567");
                }
                return digitos;
            }
            case DIAS_COBERTURA, DIAS_HISTORIAL -> {
                if (!valor.matches("\\d{1,3}") || Integer.parseInt(valor) < 1) {
                    throw new IllegalArgumentException(clave + " debe ser un número de días mayor a 0");
                }
                return valor;
            }
            case META_DIARIA -> {
                if (!valor.matches("\\d{1,10}")) {
                    throw new IllegalArgumentException("La meta es un monto en pesos, sin decimales ni letras. 0 la apaga");
                }
                return valor;
            }
            default -> {
                if (valor.length() > 500) throw new IllegalArgumentException("Muy largo");
                return valor;
            }
        }
    }
}
