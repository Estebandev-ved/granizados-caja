// Simulador mínimo de Google Apps Script para probar Code.gs en Node.
// Carga Code.gs en un contexto aislado con SpreadsheetApp, CacheService, etc. falsos.
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function crearEntorno({ ahora = '2026-09-25T15:00:00-05:00' } = {}) {
  let reloj = new Date(ahora).getTime();

  // Date controlable: new Date() y Date.now() usan el reloj falso
  class FDate extends Date {
    constructor(...a) { if (a.length) super(...a); else super(reloj); }
    static now() { return reloj; }
  }

  class Hoja {
    constructor(nombre) { this.nombre = nombre; this.filas = []; this.lecturas = 0; }
    getName() { return this.nombre; }
    getLastRow() { return this.filas.length; }
    appendRow(r) { this.filas.push(r.slice()); }
    deleteRow(n) { this.filas.splice(n - 1, 1); }
    setFrozenRows() {}
    getRange(fila, col, nf = 1, nc = 1) {
      const h = this;
      return {
        getValues() {
          h.lecturas += nf;
          const out = [];
          for (let i = 0; i < nf; i++) {
            const r = h.filas[fila - 1 + i] || [];
            const o = [];
            for (let j = 0; j < nc; j++) o.push(r[col - 1 + j] === undefined ? '' : r[col - 1 + j]);
            out.push(o);
          }
          return out;
        },
        setValues(vals) {
          vals.forEach((r, i) => r.forEach((v, j) => {
            const f = fila - 1 + i;
            while (h.filas.length <= f) h.filas.push([]);
            h.filas[f][col - 1 + j] = v;
          }));
        },
        setValue(v) { this.setValues([[v]]); },
        setFontWeight() { return this; },
      };
    }
  }

  const hojas = {};
  const ss = {
    getSheetByName: n => hojas[n] || null,
    insertSheet: n => (hojas[n] = new Hoja(n)),
    toast() {},
  };

  const cacheData = {};
  const enviados = { correos: [], fetches: [] };
  let triggers = [];
  let lockTomado = false;

  const pad = n => String(n).padStart(2, '0');
  function partes(d, tz) {
    const f = new Intl.DateTimeFormat('en-US', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d);
    const g = t => f.find(p => p.type === t).value;
    return { y: g('year'), M: g('month'), d: g('day'), H: Number(g('hour')) % 24, m: g('minute') };
  }

  const ctx = {
    Date: FDate, console, Intl, Math, JSON, Number, String, Object, Array, Error, encodeURIComponent,
    SpreadsheetApp: { getActive: () => ss },
    CacheService: { getScriptCache: () => ({
      get: k => (k in cacheData ? cacheData[k] : null),
      put: (k, v) => { cacheData[k] = v; },
    }) },
    LockService: { getScriptLock: () => ({
      waitLock() { if (lockTomado) throw new Error('lock ocupado'); lockTomado = true; },
      releaseLock() { lockTomado = false; },
    }) },
    Utilities: {
      formatDate(d, tz, fmt) {
        const p = partes(d, tz);
        if (fmt === 'yyyy-MM-dd') return `${p.y}-${p.M}-${p.d}`;
        if (fmt === 'h:mm a') return `${p.H % 12 || 12}:${p.m} ${p.H < 12 ? 'AM' : 'PM'}`;
        if (fmt === 'HH:mm') return `${pad(p.H)}:${p.m}`;
        throw new Error('formato no soportado en el mock: ' + fmt);
      },
    },
    MailApp: { sendEmail: (to, asunto, texto) => enviados.correos.push({ to, asunto, texto }) },
    Session: { getEffectiveUser: () => ({ getEmail: () => 'yo@example.com' }) },
    UrlFetchApp: { fetch: (url, opt) => { enviados.fetches.push({ url, opt }); return {}; } },
    ScriptApp: {
      WeekDay: { SUNDAY: 'SUNDAY' },
      getProjectTriggers: () => triggers,
      deleteTrigger: t => { triggers = triggers.filter(x => x !== t); },
      newTrigger(fn) {
        const b = { timeBased: () => b, onWeekDay: () => b, atHour: () => b, everyDays: () => b, inTimezone: () => b,
          create: () => { const t = { getHandlerFunction: () => fn }; triggers.push(t); return t; } };
        return b;
      },
    },
    HtmlService: {},
  };
  vm.createContext(ctx);
  const codigo = fs.readFileSync(path.join(__dirname, '..', 'Code.gs'), 'utf8');
  vm.runInContext(codigo, ctx, { filename: 'Code.gs' });

  return {
    gs: ctx, hojas, cacheData, enviados,
    get triggers() { return triggers; },
    get lockTomado() { return lockTomado; },
    fecha: s => new FDate(s),
    setAhora: s => { reloj = new Date(s).getTime(); },
    avanzar: ms => { reloj += ms; },
    // Ejecuta setup() y deja stock/proveedor listos para probar
    preparar({ stock = 10, proveedor = '573001234567' } = {}) {
      ctx.setup();
      hojas.Productos.filas.slice(1).forEach(r => { r[4] = stock; });
      const cfg = hojas.Config.filas.find(r => r[0] === 'PROVEEDOR_WHATSAPP');
      cfg[1] = proveedor;
      return this;
    },
    stockDe: id => hojas.Productos.filas.find(r => r[0] === id)[4],
  };
}

module.exports = { crearEntorno };
