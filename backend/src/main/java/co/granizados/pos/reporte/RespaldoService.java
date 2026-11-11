package co.granizados.pos.reporte;

import co.granizados.pos.comun.AppProperties;
import co.granizados.pos.negocio.TenantContext;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.sql.ResultSetMetaData;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Copia de seguridad de todos los datos del negocio: un .zip con un CSV por tabla (con `;` y BOM, se abren en Excel).
 * Es la única lectura con SQL a mano de la app (para no escribir un exportador por entidad), así que filtra por
 * `negocio_id` explícitamente con el negocio del token (o el principal en las tareas programadas). Cubierto en
 * AislamientoTest. No lleva lo que no sirve en una hoja o es delicado: PIN cifrados, llaves de Face ID y las fotos de
 * comprobantes.
 */
@Service
public class RespaldoService {

    /** Archivo del zip → tabla. En orden de importancia. */
    private static final Map<String, String> TABLAS = new LinkedHashMap<>();

    static {
        TABLAS.put("ventas", "venta");
        TABLAS.put("ventas_borradas", "venta_borrada");
        TABLAS.put("productos", "producto");
        TABLAS.put("inventario_movimientos", "entrada_inventario");
        TABLAS.put("gastos", "gasto");
        TABLAS.put("ingresos", "ingreso");
        TABLAS.put("me_pague", "retiro");
        TABLAS.put("conteos_de_plata", "conteo_plata");
        TABLAS.put("traslados", "traslado");
        TABLAS.put("metas_de_plata", "meta_plata");
        TABLAS.put("aportes_a_metas", "aporte_meta");
        TABLAS.put("cierres_de_caja", "arqueo");
        TABLAS.put("pedidos", "pedido_proveedor");
        TABLAS.put("pedidos_detalle", "pedido_item");
        TABLAS.put("pagos_al_proveedor", "pago_proveedor");
        TABLAS.put("fiados", "deuda");
        TABLAS.put("equipo", "vendedor");
        TABLAS.put("equipo_cargas", "carga_vendedor");
        TABLAS.put("equipo_pagos", "pago_vendedor");
        TABLAS.put("equipo_prestamos", "prestamo_vendedor");
        TABLAS.put("equipo_entregas", "entrega_vendedor");
        TABLAS.put("equipo_base_vueltos", "base_vendedor");
        TABLAS.put("equipo_metas", "meta_vendedor");
        TABLAS.put("equipo_terminos_aceptados", "aceptacion_terminos");
        TABLAS.put("ajustes", "config");
    }

    /** Columnas que no salen en la copia. */
    private static final Set<String> FUERA = Set.of("negocio_id", "pin_hash");

    private static final DateTimeFormatter FECHA = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final JdbcTemplate jdbc;
    private final long negocioPrincipal;
    private final ZoneId zona;

    public RespaldoService(JdbcTemplate jdbc, AppProperties props) {
        this.jdbc = jdbc;
        this.negocioPrincipal = props.negocioId();
        this.zona = props.zoneId();
    }

    private long negocio() {
        Long actual = TenantContext.actual();
        return actual != null ? actual : negocioPrincipal;
    }

    @Transactional(readOnly = true)
    public byte[] zip() {
        long negocio = negocio();
        ByteArrayOutputStream bytes = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(bytes, StandardCharsets.UTF_8)) {
            for (Map.Entry<String, String> t : TABLAS.entrySet()) {
                zip.putNextEntry(new ZipEntry(t.getKey() + ".csv"));
                zip.write(csv(t.getValue(), negocio).getBytes(StandardCharsets.UTF_8));
                zip.closeEntry();
            }
            zip.putNextEntry(new ZipEntry("LEEME.txt"));
            zip.write(("Copia de seguridad de Antigravity Caja\r\n"
                    + "Cada archivo .csv es una tabla y se abre con Excel. Las fechas van en hora de Colombia.\r\n"
                    + "La plata va en pesos enteros. No incluye PIN, Face ID ni fotos de comprobantes.\r\n")
                    .getBytes(StandardCharsets.UTF_8));
            zip.closeEntry();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        return bytes.toByteArray();
    }

    /** Una tabla como CSV para Excel. El nombre de la tabla sale de la lista fija de arriba, nunca del cliente. */
    String csv(String tabla, long negocio) {
        return jdbc.query("select * from " + tabla + " where negocio_id = ? order by id", rs -> {
            StringBuilder sb = new StringBuilder("﻿sep=;\n");
            ResultSetMetaData meta = rs.getMetaData();
            int n = meta.getColumnCount();
            boolean[] sale = new boolean[n + 1];
            StringBuilder cab = new StringBuilder();
            for (int i = 1; i <= n; i++) {
                String col = meta.getColumnLabel(i).toLowerCase(java.util.Locale.ROOT);
                sale[i] = !FUERA.contains(col);
                if (!sale[i]) continue;
                if (!cab.isEmpty()) cab.append(';');
                cab.append(col);
            }
            sb.append(cab).append('\n');
            while (rs.next()) {
                boolean algo = false;
                for (int i = 1; i <= n; i++) {
                    if (!sale[i]) continue;
                    if (algo) sb.append(';');
                    algo = true;
                    sb.append(celda(rs.getObject(i)));
                }
                sb.append('\n');
            }
            return sb.toString();
        }, negocio);
    }

    private String celda(Object valor) {
        if (valor == null) return "";
        String texto;
        if (valor instanceof OffsetDateTime f) texto = FECHA.format(f.atZoneSameInstant(zona));
        else if (valor instanceof java.sql.Timestamp t) texto = FECHA.format(t.toInstant().atZone(zona));
        else if (valor instanceof byte[]) texto = "";
        else texto = valor.toString();
        if (texto.contains(";") || texto.contains("\"") || texto.contains("\n")) {
            texto = '"' + texto.replace("\"", "\"\"") + '"';
        }
        return texto;
    }
}
