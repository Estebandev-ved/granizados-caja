// Pruebas del backend (Code.gs) con el simulador de Apps Script.
// Correr: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const { crearEntorno } = require('./gas-mock');

const ventas = e => e.hojas.Ventas.filas.slice(1);

test('setup crea hojas, sabores y triggers sin duplicar', () => {
  const e = crearEntorno();
  e.gs.setup();
  e.gs.setup(); // correrlo dos veces no debe duplicar nada
  assert.equal(e.hojas.Productos.filas.length, 12);
  assert.deepEqual(e.hojas.Productos.filas[1].slice(0, 4), ['smirnoff-normal', 'Smirnoff', 'normal', 6000]);
  assert.equal(e.hojas.Productos.filas.find(r => r[1] === 'Piña colada')[0], 'pina-colada-normal');
  assert.equal(e.triggers.length, 2);
});

test('venta descuenta stock y guarda la fila', () => {
  const e = crearEntorno().preparar();
  const est = e.gs.registrarVenta({ uid: 'a1', id: 'smirnoff-normal', metodo: 'efectivo', cantidad: 2 });
  assert.equal(e.stockDe('smirnoff-normal'), 8);
  assert.equal(ventas(e).length, 1);
  assert.equal(ventas(e)[0][4], 12000);
  assert.equal(ventas(e)[0][5], 'efectivo');
  assert.equal(est.hoy.total, 12000);
  assert.equal(est.hoy.efectivo, 12000);
  assert.equal(est.hoy.unidades, 2);
  assert.equal(e.lockTomado, false);
});

test('venta repetida con el mismo uid no se duplica', () => {
  const e = crearEntorno().preparar();
  const v = { uid: 'x', id: 'mojito-normal', metodo: 'nequi', cantidad: 1 };
  e.gs.registrarVenta(v);
  e.gs.registrarVenta(v);
  assert.equal(ventas(e).length, 1);
  assert.equal(e.stockDe('mojito-normal'), 9);
});

test('venta repetida no se duplica aunque la cache se haya borrado', () => {
  const e = crearEntorno().preparar();
  const v = { uid: 'y', id: 'mojito-normal', metodo: 'nequi' };
  e.gs.registrarVenta(v);
  for (const k in e.cacheData) delete e.cacheData[k]; // CacheService puede botar claves cuando quiera
  e.gs.registrarVenta(v);
  assert.equal(ventas(e).length, 1);
  assert.equal(e.stockDe('mojito-normal'), 9);
});

test('producto que no existe: error marcado para que el celular no reintente para siempre', () => {
  const e = crearEntorno().preparar();
  assert.throws(() => e.gs.registrarVenta({ uid: 'z', id: 'no-existe', metodo: 'nequi' }), /NO_REINTENTAR/);
  assert.equal(e.lockTomado, false);
});

test('cantidad inválida se normaliza a 1', () => {
  const e = crearEntorno().preparar();
  e.gs.registrarVenta({ uid: 'q', id: 'tussi-normal', metodo: 'nequi', cantidad: -4 });
  assert.equal(e.stockDe('tussi-normal'), 9);
});

test('alerta de stock bajo solo al cruzar el mínimo', () => {
  const e = crearEntorno().preparar({ stock: 5 });
  const vender = uid => e.gs.registrarVenta({ uid, id: 'chicle-normal', metodo: 'nequi' });
  vender('1'); // 5 → 4
  assert.equal(e.enviados.correos.length, 0);
  vender('2'); // 4 → 3 (cruza el mínimo 3)
  assert.equal(e.enviados.correos.length, 1);
  assert.match(e.enviados.correos[0].asunto, /Stock bajo: Chicle/);
  assert.match(e.enviados.correos[0].texto, /Quedan 3/);
  vender('3'); // 3 → 2: ya estaba bajo, no repite
  assert.equal(e.enviados.correos.length, 1);
});

test('si la notificación falla, la venta igual queda y no lanza error', () => {
  const e = crearEntorno().preparar({ stock: 4 });
  e.gs.MailApp.sendEmail = () => { throw new Error('cuota de correo agotada'); };
  assert.doesNotThrow(() => e.gs.registrarVenta({ uid: 'n', id: 'chicle-normal', metodo: 'nequi' }));
  assert.equal(e.stockDe('chicle-normal'), 3);
  assert.equal(ventas(e).length, 1);
});

test('las alertas usan Telegram cuando está configurado', () => {
  const e = crearEntorno().preparar({ stock: 4 });
  e.hojas.Config.filas.find(r => r[0] === 'TELEGRAM_TOKEN')[1] = 'TOK';
  e.hojas.Config.filas.find(r => r[0] === 'TELEGRAM_CHAT_ID')[1] = '123';
  e.gs.registrarVenta({ uid: 't', id: 'chicle-normal', metodo: 'nequi' });
  assert.equal(e.enviados.correos.length, 0);
  assert.equal(e.enviados.fetches.length, 1);
  assert.match(e.enviados.fetches[0].url, /botTOK\/sendMessage/);
});

test('deshacer borra la última venta y devuelve el stock', () => {
  const e = crearEntorno().preparar();
  e.gs.registrarVenta({ uid: 'd1', id: 'margarita-normal', metodo: 'nequi', cantidad: 3 });
  assert.equal(e.stockDe('margarita-normal'), 7);
  const est = e.gs.deshacerUltimaVenta();
  assert.equal(e.stockDe('margarita-normal'), 10);
  assert.equal(ventas(e).length, 0);
  assert.equal(est.hoy.total, 0);
});

test('reponer suma stock y registra la entrada, sin duplicar por uid', () => {
  const e = crearEntorno().preparar({ stock: 2 });
  e.gs.reponer('sangria-normal', 12, 'r1');
  e.gs.reponer('sangria-normal', 12, 'r1');
  assert.equal(e.stockDe('sangria-normal'), 14);
  assert.equal(e.hojas.Entradas.filas.length, 2);
});

test('"hoy" se calcula en hora de Bogotá', () => {
  const e = crearEntorno({ ahora: '2026-09-25T20:30:00-05:00' }).preparar(); // 01:30 UTC del 26
  e.hojas.Ventas.appendRow([e.fecha('2026-09-24T23:30:00-05:00'), 'smirnoff-normal', 'Smirnoff', 'normal', 6000, 'nequi', 1, 'ayer']);
  e.hojas.Ventas.appendRow([e.fecha('2026-09-25T20:00:00-05:00'), 'smirnoff-normal', 'Smirnoff', 'normal', 6000, 'efectivo', 1, 'hoy']);
  const est = e.gs.getEstado();
  assert.equal(est.hoy.unidades, 1);
  assert.equal(est.hoy.efectivo, 6000);
  assert.equal(est.dia, '2026-09-25');
});

test('pedido sugerido según el promedio diario', () => {
  const e = crearEntorno().preparar({ stock: 10 });
  // 20 Smirnoff en los últimos 2 días, stock actual 5
  for (let i = 0; i < 20; i++) {
    e.hojas.Ventas.appendRow([e.fecha(e.gs.Date.now() - 2 * 864e5 + i * 1000), 'smirnoff-normal', 'Smirnoff', 'normal', 6000, 'nequi', 1, 's' + i]);
  }
  e.hojas.Productos.filas.find(r => r[0] === 'smirnoff-normal')[4] = 5;
  e.hojas.Productos.filas.find(r => r[0] === 'tussi-normal')[4] = 1; // debajo del mínimo
  const p = e.gs.armarPedido();
  assert.deepEqual(p.items.map(i => [i.id, i.pedir]), [['smirnoff-normal', 35], ['tussi-normal', 2]]);
  assert.equal(p.total, 37);
  assert.ok(p.link.startsWith('https://wa.me/573001234567?text='));
  assert.match(decodeURIComponent(p.link.split('text=')[1]), /• 35 Smirnoff/);
  assert.equal(p.tieneProveedor, true);
});

test('pedido semanal y cierre diario', () => {
  const e = crearEntorno().preparar({ stock: 50 });
  e.gs.cierreDiario();
  assert.equal(e.enviados.correos.length, 0, 'sin ventas no manda cierre');
  e.gs.pedidoSemanal();
  assert.match(e.enviados.correos[0].texto, /no hace falta pedir/);
  e.gs.registrarVenta({ uid: 'c1', id: 'smirnoff-normal', metodo: 'efectivo', cantidad: 2 });
  e.gs.registrarVenta({ uid: 'c2', id: 'tussi-normal', metodo: 'nequi' });
  e.gs.cierreDiario();
  const c = e.enviados.correos.at(-1);
  assert.match(c.texto, /Vendiste 3 granizados: \$18\.000/);
  assert.match(c.texto, /Efectivo: \$12\.000/);
});

test('getEstado no relee toda la hoja de ventas cuando hay mucho historial', () => {
  const e = crearEntorno().preparar();
  const vieja = e.fecha('2025-01-01T12:00:00-05:00');
  for (let i = 0; i < 20000; i++) e.hojas.Ventas.filas.push([vieja, 'smirnoff-normal', 'Smirnoff', 'normal', 6000, 'nequi', 1, 'h' + i]);
  e.hojas.Ventas.lecturas = 0;
  e.gs.getEstado();
  assert.ok(e.hojas.Ventas.lecturas < 5000, 'leyó ' + e.hojas.Ventas.lecturas + ' filas');
});
