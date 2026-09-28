const TRAZOS: Record<string, string> = {
  billete: 'M3 6h18v12H3z M7 6v12 M17 6v12 M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z',
  grafico: 'M4 19h16 M8 19V9 M13 19V5 M18 19v-7',
  vaso: 'M6 4h12l-2 15H8z M6 4l1 4h10l1-4',
  ticket: 'M4 5h16v4a2 2 0 1 0 0 6v4H4v-4a2 2 0 1 0 0-6z',
  billetera: 'M3 7h15a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M16 12h3',
  trofeo: 'M8 4h8v5a4 4 0 1 1-8 0z M8 5H5a2 2 0 0 0 0 4h1 M16 5h3a2 2 0 0 1 0 4h-1 M10 15v3h4v-3 M8 21h8',
  reloj: 'M12 8v5l3 2 M12 3a9 9 0 1 0 .1 0z',
  celular: 'M8 3h8v18H8z M11 18h2',
  calendario: 'M4 5h16v15H4z M4 9h16 M8 3v4 M16 3v4',
  semana: 'M4 5h16v15H4z M4 9h16 M8 13h2 M8 17h2 M14 13h2 M14 17h2',
  caja: 'M3 8l9-5 9 5-9 5-9-5z M3 8v9l9 5 9-5V8 M12 13v9',
  candado: 'M6 11V7a6 6 0 1 1 12 0v4 M5 11h14v10H5z',
  sliders: 'M4 6h10 M4 12h6 M4 18h13 M17 4v4 M12 10v4 M20 16v4',
  cara: 'M12 3a9 9 0 1 0 .1 0z M9 10v.01 M15 10v.01 M9 15c.7.8 1.8 1.3 3 1.3s2.3-.5 3-1.3',
  buscar: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14z M21 21l-4.3-4.3',
  alerta: 'M12 3l10 18H2z M12 10v4 M12 17v.01',
  camion: 'M2 8h11v8H4a2 2 0 0 1-2-2z M13 11h4l3 3v2h-3 M7 18v.01 M18 18v.01',
  moneda: 'M12 4a8 8 0 1 0 .1 0z M9 9.5h4 M9 14.5h4 M12 7v10',
  flecha: 'M9 14l-5-5 5-5 M4 9h11a5 5 0 0 1 5 5v1',
  refrescar: 'M4 12a8 8 0 0 1 13.66-5.66 M18 4v4h-4 M20 12a8 8 0 0 1-13.66 5.66 M6 20v-4h4',
}

/** Set chico de íconos lineales para tarjetas y encabezados, mismo estilo del nav de abajo. */
export function Icono({ nombre }: { nombre: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      width="15" height="15" style={{ verticalAlign: -2 }}>
      <path d={TRAZOS[nombre]} />
    </svg>
  )
}
