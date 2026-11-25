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
            new Ajuste("META_DIARIA", "0", "Lo que quieres vender al día en pesos. 0 la apaga"),
            new Ajuste("META_EQUIPO", "0", "Granizados que debe vender cada trabajador al día. 0 la apaga"),
            new Ajuste("PREMIO_EQUIPO", "0", "Pesos que gana el trabajador por cada día que cumple la meta. 0 = solo reconocimiento"),
            new Ajuste("COMISION_NORMAL", "0", "Pesos que gana el trabajador por cada granizado Normal. Con todas en 0 se usa su porcentaje"),
            new Ajuste("COMISION_CREMOSO", "0", "Pesos que gana el trabajador por cada granizado Cremoso"),
            new Ajuste("COMISION_GRANDE", "0", "Pesos que gana el trabajador por cada granizado Grande"),
            new Ajuste("COMISION_CERVEZA", "0", "Pesos que gana el trabajador por cada cerveza"),
            new Ajuste("PROMO", "", "Promoción (la edita Ajustes → Promoción)"),
            new Ajuste("PREMIO_REBAJA_PROMO", "0", "Pesos que bajan los premios por escalón los días de promoción. 0 = no bajan"),
            new Ajuste("COMISION_PROMO", "0", "Pesos que gana el trabajador por cada granizado vendido en promoción. 0 = gana la tarifa normal"),
            new Ajuste("PREMIOS_ESCALONES", "", "Premio del día por escalón, acumulado. Ej: 12:2000,15:4000 = con 12 granizados ganas $2.000 y con 15, $4.000 en total"),
            new Ajuste("GRANIZADOS_GRATIS", "1", "Granizados que el trabajador puede tomarse gratis por día de trabajo"),
            new Ajuste("PAGO_NEQUI", "", "Tu número de Nequi para que te paguen lo fiado. Ej: 3001234567"),
            new Ajuste("PAGO_BREB", "", "Tu llave Bre-B para que te paguen lo fiado"),
            new Ajuste("CAJA_BASE", "0", "Plata que dejas siempre en la caja para vueltos (se edita en Mi plata)"),
            new Ajuste("TOPES_GASTO", "", "Tope de gasto al mes por categoría (lo edita Hoy → Gastos del mes)"),
            new Ajuste("PERFIL", "", "Perfil del negocio (lo edita la bienvenida y Ajustes → Mi negocio)"),
            new Ajuste("PAGO_PRESENCIAL", "", "Dónde te pueden pagar en persona. Ej: en la U, bloque 4, en horas de almuerzo"),
            new Ajuste("CALLE_ACTIVO", "0", "Plan de ventas en la calle: 1 = prendido, 0 = apagado"),
            new Ajuste("CALLE_PRECIO_NORMAL", "0", "Precio en la calle del granizado Normal. 0 = el de siempre"),
            new Ajuste("CALLE_PRECIO_CREMOSO", "0", "Precio en la calle del granizado Cremoso. 0 = el de siempre"),
            new Ajuste("CALLE_PRECIO_GRANDE", "0", "Precio en la calle del granizado Grande. 0 = el de siempre"),
            new Ajuste("CALLE_PRECIO_CERVEZA", "0", "Precio en la calle de la cerveza. 0 = el de siempre"),
            new Ajuste("CALLE_COM_NORMAL", "0", "Comisión por granizado Normal vendido en la calle. 0 = la de siempre"),
            new Ajuste("CALLE_COM_CREMOSO", "0", "Comisión por granizado Cremoso vendido en la calle. 0 = la de siempre"),
            new Ajuste("CALLE_COM_GRANDE", "0", "Comisión por granizado Grande vendido en la calle. 0 = la de siempre"),
            new Ajuste("CALLE_COM_CERVEZA", "0", "Comisión por cerveza vendida en la calle. 0 = la de siempre"),
            new Ajuste("CALLE_COM_COMBO", "0", "Comisión por granizado vendido en combo en la calle. 0 = la de cada tipo"),
            new Ajuste("CALLE_PASAJE", "0", "Lo que cuesta ir y volver (pasajes) de un trabajador, para sugerir cuánto devolverle"),
            new Ajuste("CALLE_MINIMO_PASAJE", "12", "Si en una salida vende menos que esto, se le devuelve el pasaje"),
            new Ajuste("CALLE_BUENO", "25", "Granizados en 4 horas para que un lugar sea bueno"),
            new Ajuste("CALLE_REGULAR", "15", "Granizados en 4 horas para que un lugar sea regular (menos que esto es malo)"));

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
