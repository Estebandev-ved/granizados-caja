/**
 * GRANIZADOS · Caja rápida + inventario + pedido automático
 * Backend en Google Apps Script sobre un Google Sheet.
 *
 * Primera vez: ejecuta setup() desde el editor (menú ▶ Ejecutar).
 */

const TZ = 'America/Bogota';
const HOJA = { PRODUCTOS: 'Productos', VENTAS: 'Ventas', ENTRADAS: 'Entradas', CONFIG: 'Config' };

const SABORES_INICIALES = [
  'Smirnoff', 'Piña colada', 'Margarita', 'Tussi', 'Mojito', 'Sangría',
  'Four Loko sandía', 'Four Loko apple', 'Chicle', 'Macufresa', 'Crema de whisky'
];
const PRECIOS = { normal: 6000, cremoso: 7000, grande: 10000 };

// ───────────────────────── Web app ─────────────────────────

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('Granizados · Caja')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover')
    .addMetaTag('apple-mobile-web-app-capable', 'yes')
    .addMetaTag('mobile-web-app-capable', 'yes');
}

/** Todo lo que la app necesita al abrir. */
function getEstado() {
  const recientes = leerVentas_(FILAS_RECIENTES); // una sola lectura para "hoy" y "últimas"
  return {
    productos: leerProductos_(), hoy: resumenHoy_(recientes), ultimas: ultimasVentas_(8, recientes),
    dia: Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd')
  };
}

/**
 * Registra una venta. uid lo genera el celular para que un reintento no duplique la venta.
 * Si el error empieza con NO_REINTENTAR, el celular la saca de la cola (reintentar no la arregla).
 * @param {{uid:string, id:string, metodo:'nequi'|'efectivo', cantidad?:number}} v
 */
function registrarVenta(v) {
  let alerta = null;
  const estado = conLock_(() => {
    if (yaProcesado_(v.uid, HOJA.VENTAS, COL_UID_VENTAS)) return getEstado();

    const cant = Math.min(99, Math.max(1, Math.floor(Number(v.cantidad)) || 1));
    const { hoja, fila, prod } = buscarProducto_(v.id);
    const antes = Number(prod.stock) || 0;
    const despues = antes - cant;
    hoja.getRange(fila, COL.stock).setValue(despues);

    SpreadsheetApp.getActive().getSheetByName(HOJA.VENTAS).appendRow([
      new Date(), prod.id, prod.sabor, prod.tipo, Number(prod.precio) * cant,
      v.metodo === 'efectivo' ? 'efectivo' : 'nequi', cant, v.uid || ''
    ]);
    marcarProcesado_(v.uid);

    const min = Number(prod.minimo) || 0;
    if (antes > min && despues <= min) alerta = { prod, despues, min };
    return getEstado();
  });
  // La alerta va por fuera del lock: si Telegram/correo se demora o falla, la venta ya quedó.
  if (alerta) {
    notificar_('⚠️ Stock bajo: ' + etiqueta_(alerta.prod),
      `Quedan ${alerta.despues} de ${etiqueta_(alerta.prod)} (mínimo ${alerta.min}).\n\n` + textoPedido_().resumen);
  }
  return estado;
}

/** Borra la última venta y devuelve el stock. */
function deshacerUltimaVenta() {
  return conLock_(() => {
    const hv = SpreadsheetApp.getActive().getSheetByName(HOJA.VENTAS);
    const last = hv.getLastRow();
    if (last < 2) return getEstado();
    const r = hv.getRange(last, 1, 1, 8).getValues()[0];
    const { hoja, fila, prod } = buscarProducto_(String(r[1]));
    hoja.getRange(fila, COL.stock).setValue((Number(prod.stock) || 0) + (Number(r[6]) || 1));
    hv.deleteRow(last);
    return getEstado();
  });
}

/** Suma unidades al inventario cuando llega el pedido. uid evita sumar dos veces en un reintento. */
function reponer(id, cantidad, uid) {
  return conLock_(() => {
    const cant = Math.floor(Number(cantidad)) || 0;
    if (!cant) return getEstado();
    if (yaProcesado_(uid, HOJA.ENTRADAS, COL_UID_ENTRADAS)) return getEstado();
    const { hoja, fila, prod } = buscarProducto_(id);
    hoja.getRange(fila, COL.stock).setValue((Number(prod.stock) || 0) + cant);
    SpreadsheetApp.getActive().getSheetByName(HOJA.ENTRADAS)
      .appendRow([new Date(), prod.id, prod.sabor, prod.tipo, cant, uid || '']);
    marcarProcesado_(uid);
    return getEstado();
  });
}

/** Para el botón "Armar pedido" de la app: devuelve texto + link de WhatsApp listo. */
function armarPedido() {
  return textoPedido_();
}

// ───────────────────── Tareas programadas ─────────────────────

/** Domingo 7pm: te manda el pedido sugerido con el link al proveedor. */
function pedidoSemanal() {
  const p = textoPedido_();
  if (!p.items.length) {
    notificar_('🧊 Pedido semanal', 'Esta semana no hace falta pedir nada. Inventario al día.');
    return;
  }
  notificar_('🧊 Pedido semanal sugerido',
    p.mensaje + '\n\n👉 Mandárselo al proveedor:\n' + p.link);
}

/** Todos los días 9pm: cierre de caja. */
function cierreDiario() {
  const h = resumenHoy_();
  if (!h.unidades) return;
  const top = h.porSabor.slice(0, 3).map(s => `${s.sabor} (${s.unidades})`).join(', ');
  notificar_('💰 Cierre del día',
    `Vendiste ${h.unidades} granizados: ${pesos_(h.total)}\n` +
    `• Nequi: ${pesos_(h.nequi)}\n• Efectivo: ${pesos_(h.efectivo)} (esto debe haber en caja)\n` +
    `Top: ${top}`);
}

// ───────────────────────── Setup ─────────────────────────

function setup() {
  const ss = SpreadsheetApp.getActive();
  const crear = (nombre, headers) => {
    let h = ss.getSheetByName(nombre);
    if (!h) h = ss.insertSheet(nombre);
    if (h.getLastRow() === 0) {
      h.appendRow(headers);
      h.getRange(1, 1, 1, headers.length).setFontWeight('bold');
      h.setFrozenRows(1);
    }
    return h;
  };

  const hp = crear(HOJA.PRODUCTOS, ['id', 'sabor', 'tipo', 'precio', 'stock', 'minimo', 'activo']);
  if (hp.getLastRow() === 1) {
    const filas = SABORES_INICIALES.map(s => [slug_(s + '-normal'), s, 'normal', PRECIOS.normal, 0, 3, true]);
    hp.getRange(2, 1, filas.length, 7).setValues(filas);
  }
  crear(HOJA.VENTAS, ['fecha', 'id', 'sabor', 'tipo', 'total', 'metodo', 'cantidad', 'uid']);
  const he = crear(HOJA.ENTRADAS, ['fecha', 'id', 'sabor', 'tipo', 'cantidad', 'uid']);
  if (he.getRange(1, COL_UID_ENTRADAS).getValues()[0][0] === '') he.getRange(1, COL_UID_ENTRADAS).setValue('uid'); // hojas de la versión anterior

  const hc = crear(HOJA.CONFIG, ['clave', 'valor', 'nota']);
  if (hc.getLastRow() === 1) {
    hc.getRange(2, 1, 6, 3).setValues([
      ['PROVEEDOR_WHATSAPP', '', 'Número del proveedor con 57 adelante, sin + ni espacios. Ej: 573001234567'],
      ['DIAS_COBERTURA', 4, 'Para cuántos días de venta quieres tener inventario después de pedir'],
      ['DIAS_HISTORIAL', 14, 'Cuántos días atrás mirar para calcular el promedio de ventas'],
      ['TELEGRAM_TOKEN', '', 'Opcional. Si lo dejas vacío, las alertas te llegan al correo'],
      ['TELEGRAM_CHAT_ID', '', 'Opcional. Tu chat id de Telegram'],
      ['NOMBRE', 'Esteban', 'Cómo firmas el pedido'],
    ]);
  }

  // Triggers (se recrean para no duplicar)
  ScriptApp.getProjectTriggers()
    .filter(t => ['pedidoSemanal', 'cierreDiario'].includes(t.getHandlerFunction()))
    .forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('pedidoSemanal').timeBased()
    .onWeekDay(ScriptApp.WeekDay.SUNDAY).atHour(19).inTimezone(TZ).create();
  ScriptApp.newTrigger('cierreDiario').timeBased()
    .everyDays(1).atHour(21).inTimezone(TZ).create();

  SpreadsheetApp.getActive().toast('Listo. Llena el stock en la hoja Productos y publica la app.', 'Granizados', 8);
}

// ───────────────────────── Lógica ─────────────────────────

function textoPedido_() {
  const cfg = leerConfig_();
  const diasHist = Number(cfg.DIAS_HISTORIAL) || 14;
  const diasCob = Number(cfg.DIAS_COBERTURA) || 4;
  const productos = leerProductos_();

  // Ventas por producto en la ventana
  const desde = new Date(Date.now() - diasHist * 864e5);
  const ventas = leerVentas_().filter(v => v.fecha >= desde);
  const primera = ventas.length ? Math.min.apply(null, ventas.map(v => v.fecha.getTime())) : Date.now();
  // Si llevas menos días vendiendo que la ventana, divide por los días reales (mínimo 1)
  const dias = Math.max(1, Math.min(diasHist, Math.ceil((Date.now() - primera) / 864e5)));
  const vendidas = {};
  ventas.forEach(v => { vendidas[v.id] = (vendidas[v.id] || 0) + v.cantidad; });

  const items = productos.map(p => {
    const stock = Number(p.stock) || 0;
    const promedio = (vendidas[p.id] || 0) / dias;
    const objetivo = Math.max(Math.ceil(promedio * diasCob), Number(p.minimo) || 0);
    return { p, promedio, pedir: Math.max(0, objetivo - stock) };
  }).filter(x => x.pedir > 0)
    .sort((a, b) => b.pedir - a.pedir);

  const lineas = items.map(x => `• ${x.pedir} ${etiqueta_(x.p)}`);
  const total = items.reduce((s, x) => s + x.pedir, 0);
  const mensaje = `Hola! Te hago el pedido de esta semana 🙌\n\n${lineas.join('\n')}\n\nTotal: ${total} unidades.\nGracias! — ${cfg.NOMBRE || ''}`.trim();
  const tel = String(cfg.PROVEEDOR_WHATSAPP || '').replace(/\D/g, '');
  const link = 'https://wa.me/' + tel + '?text=' + encodeURIComponent(mensaje);

  return {
    items: items.map(x => ({ id: x.p.id, sabor: etiqueta_(x.p), pedir: x.pedir, promedioDia: Math.round(x.promedio * 10) / 10 })),
    total, mensaje, link, tieneProveedor: !!tel,
    resumen: items.length ? 'Pedido sugerido:\n' + lineas.join('\n') : 'Todo con stock suficiente.'
  };
}

function resumenHoy_(ventas) {
  const hoy = Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
  const vs = (ventas || leerVentas_(FILAS_RECIENTES)).filter(v => Utilities.formatDate(v.fecha, TZ, 'yyyy-MM-dd') === hoy);
  const r = { total: 0, nequi: 0, efectivo: 0, unidades: 0, porSabor: [] };
  const map = {};
  vs.forEach(v => {
    r.total += v.total; r.unidades += v.cantidad;
    if (v.metodo === 'efectivo') r.efectivo += v.total; else r.nequi += v.total;
    const k = v.sabor + (v.tipo && v.tipo !== 'normal' ? ' ' + v.tipo : '');
    map[k] = (map[k] || 0) + v.cantidad;
  });
  r.porSabor = Object.keys(map).map(k => ({ sabor: k, unidades: map[k] })).sort((a, b) => b.unidades - a.unidades);
  return r;
}

function ultimasVentas_(n, ventas) {
  return (ventas || leerVentas_(n)).slice(-n).reverse().map(v => ({
    hora: Utilities.formatDate(v.fecha, TZ, 'h:mm a'),
    sabor: v.sabor + (v.tipo && v.tipo !== 'normal' ? ' ' + v.tipo : ''),
    total: v.total, metodo: v.metodo
  }));
}

// ───────────────────────── Datos ─────────────────────────

const COL = { id: 1, sabor: 2, tipo: 3, precio: 4, stock: 5, minimo: 6, activo: 7 };
const COL_UID_VENTAS = 8, COL_UID_ENTRADAS = 6;
// Filas que se leen del final de Ventas para "hoy", "últimas" y la idempotencia. Sobra para un día de venta.
const FILAS_RECIENTES = 600;

function leerProductos_() {
  const h = SpreadsheetApp.getActive().getSheetByName(HOJA.PRODUCTOS);
  if (h.getLastRow() < 2) return [];
  return h.getRange(2, 1, h.getLastRow() - 1, 7).getValues()
    .filter(r => r[0] && r[6] !== false && String(r[6]).toUpperCase() !== 'FALSE')
    .map(r => ({ id: String(r[0]), sabor: r[1], tipo: r[2] || 'normal', precio: Number(r[3]) || 0,
                 stock: Number(r[4]) || 0, minimo: Number(r[5]) || 0 }));
}

function buscarProducto_(id) {
  const h = SpreadsheetApp.getActive().getSheetByName(HOJA.PRODUCTOS);
  const vals = h.getRange(2, 1, Math.max(1, h.getLastRow() - 1), 7).getValues();
  const i = vals.findIndex(r => String(r[0]) === String(id));
  if (i < 0) throw new Error('NO_REINTENTAR: producto no encontrado: ' + id);
  const r = vals[i];
  return { hoja: h, fila: i + 2,
           prod: { id: String(r[0]), sabor: r[1], tipo: r[2] || 'normal', precio: r[3], stock: r[4], minimo: r[5] } };
}

/** Lee las ventas en orden. Con maxFilas solo lee las últimas N (las ventas se agregan en orden de fecha). */
function leerVentas_(maxFilas) {
  const h = SpreadsheetApp.getActive().getSheetByName(HOJA.VENTAS);
  const last = h.getLastRow();
  if (last < 2) return [];
  const n = maxFilas ? Math.min(maxFilas, last - 1) : last - 1;
  return h.getRange(last - n + 1, 1, n, 7).getValues()
    .filter(r => r[0] instanceof Date)
    .map(r => ({ fecha: r[0], id: String(r[1]), sabor: r[2], tipo: r[3], total: Number(r[4]) || 0,
                 metodo: r[5], cantidad: Number(r[6]) || 1 }));
}

function leerConfig_() {
  const h = SpreadsheetApp.getActive().getSheetByName(HOJA.CONFIG);
  const cfg = {};
  if (h && h.getLastRow() > 1) h.getRange(2, 1, h.getLastRow() - 1, 2).getValues().forEach(r => { cfg[r[0]] = r[1]; });
  return cfg;
}

// ───────────────────────── Utilidades ─────────────────────────

/** Manda la alerta. Nunca lanza error: una alerta fallida no puede tumbar una venta. */
function notificar_(asunto, texto) {
  try {
    const cfg = leerConfig_();
    if (cfg.TELEGRAM_TOKEN && cfg.TELEGRAM_CHAT_ID) {
      UrlFetchApp.fetch('https://api.telegram.org/bot' + cfg.TELEGRAM_TOKEN + '/sendMessage', {
        method: 'post', contentType: 'application/json', muteHttpExceptions: true,
        payload: JSON.stringify({ chat_id: cfg.TELEGRAM_CHAT_ID, text: asunto + '\n\n' + texto, disable_web_page_preview: true })
      });
    } else {
      MailApp.sendEmail(Session.getEffectiveUser().getEmail(), asunto, texto);
    }
  } catch (e) {
    console.error('No se pudo notificar: ' + asunto, e);
  }
}

/**
 * ¿Ya se procesó esta operación? Mira primero la cache (rápido) y, si no está,
 * busca el uid en las últimas filas de la hoja, porque CacheService puede botar claves antes de tiempo.
 */
function yaProcesado_(uid, nombreHoja, colUid) {
  if (!uid) return false;
  if (CacheService.getScriptCache().get('op_' + uid)) return true;
  const h = SpreadsheetApp.getActive().getSheetByName(nombreHoja);
  const last = h.getLastRow();
  if (last < 2) return false;
  const n = Math.min(FILAS_RECIENTES, last - 1);
  return h.getRange(last - n + 1, colUid, n, 1).getValues().some(r => String(r[0]) === String(uid));
}

function marcarProcesado_(uid) {
  if (uid) CacheService.getScriptCache().put('op_' + uid, '1', 21600);
}

function conLock_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try { return fn(); } finally { lock.releaseLock(); }
}

function etiqueta_(p) { return p.sabor + (p.tipo && p.tipo !== 'normal' ? ' ' + p.tipo : ''); }
function pesos_(n) { return '$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }
function slug_(s) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
