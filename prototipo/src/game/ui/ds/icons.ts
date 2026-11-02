/**
 * CAMADA JOGO. DESIGN SYSTEM, parte 3: ÍCONES. Um conjunto só: grade 24x24, traço 1.6,
 * pontas e junções redondas, sem preenchimento (herdam currentColor). Quem precisa de um
 * ícone novo desenha aqui, no mesmo traço, e nunca solto dentro de uma tela.
 */
const P = (d: string): string => `<path d="${d}"/>`;

export const ICON_PATHS: Record<string, string> = {
  flame: P("M12 3c.8 3.4 5 5.2 5 10a5 5 0 0 1-10 0c0-2.2 1-3.6 2.4-4.8.2 1.8 1 2.8 2 3.2-.4-2.6-.2-5.4.6-8.4z"),
  spark: P("M12 3l2.2 6.8L21 12l-6.8 2.2L12 21l-2.2-6.8L3 12l6.8-2.2z"),
  eye: P("M2.5 12C5 7.5 8.3 5.5 12 5.5s7 2 9.5 6.5C19 16.5 15.7 18.5 12 18.5S5 16.5 2.5 12z") + '<circle cx="12" cy="12" r="3"/>',
  book: P("M5 4h11a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H5z") + P("M9 8h6M9 12h5"),
  scroll: P("M7 4h9a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 0-2-2h3") + P("M9 9h6M9 13h6"),
  shield: P("M12 3l7 3v5.5c0 4.4-3 7.7-7 9.5-4-1.8-7-5.1-7-9.5V6z"),
  sword: P("M19.5 4.5L9 15M6.5 12.5l5 5M8.2 15.8L4.5 19.5M19.5 4.5h-4.2M19.5 4.5v4.2"),
  heart: P("M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.2 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"),
  dodge: P("M4 8h9a3 3 0 1 0-3-3M3 12h14a3 3 0 1 1-3 3M5 16h6"),
  lock: '<rect x="6" y="11" width="12" height="9" rx="2"/>' + P("M8.5 11V8a3.5 3.5 0 0 1 7 0v3"),
  key: '<circle cx="8" cy="12" r="3.5"/>' + P("M11.5 12H21M17 12v3M20 12v2"),
  skull:
    P("M12 3.5c-4.2 0-7 2.8-7 6.6 0 2.2 1 3.7 2.5 4.7V18h9v-3.2c1.5-1 2.5-2.5 2.5-4.7 0-3.8-2.8-6.6-7-6.6z") +
    '<circle cx="9.2" cy="10.5" r="1.4"/><circle cx="14.8" cy="10.5" r="1.4"/>' + P("M10.5 18v2.2M13.5 18v2.2"),
  door: P("M6 20V6a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v14M4 20h16") + '<circle cx="14.6" cy="12.5" r=".6"/>',
  brazier:
    P("M5 9h14l-1.6 5.5a3 3 0 0 1-2.9 2.2h-4.9a3 3 0 0 1-2.9-2.2z") + P("M12 16.7V21M8 21h8") +
    P("M12 2.5c.5 2 2.4 2.7 2.4 4.7a2.4 2.4 0 0 1-4.8 0c0-1.2.6-1.9 1.3-2.4.1 1 .5 1.4 1 1.6-.2-1.3-.1-2.6.1-3.9z"),
  map: P("M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z") + P("M9 4v14M15 6v14"),
  compass: '<circle cx="12" cy="12" r="9"/>' + P("M15.5 8.5l-2 5-5 2 2-5z"),
  gear: '<circle cx="12" cy="12" r="3"/>' + P("M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1"),
  hourglass: P("M7 3h10M7 21h10M8 3v3.5c0 2.2 2.6 3.2 4 5.5 1.4-2.3 4-3.3 4-5.5V3M8 21v-3.5c0-2.2 2.6-3.2 4-5.5 1.4 2.3 4 3.3 4 5.5V21"),
  coin: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.5"/>',
  potion: P("M9.5 3h5M10.5 3v5l-4.2 8.2A3 3 0 0 0 9 20.5h6a3 3 0 0 0 2.7-4.3L13.5 8V3M8 15h8"),
  close: P("M6 6l12 12M18 6L6 18"),
  arrow: P("M5 12h14M13 6l6 6-6 6"),
  check: P("M5 12.5l4.5 4.5L19 7.5"),
  sound: P("M4 9.5h3.5L12 6v12l-4.5-3.5H4z") + P("M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"),
  mute: P("M4 9.5h3.5L12 6v12l-4.5-3.5H4z") + P("M16 9.5l5 5M21 9.5l-5 5"),
  keyboard: '<rect x="2.5" y="6.5" width="19" height="11" rx="2"/>' + P("M6.5 10h.01M9.5 10h.01M12.5 10h.01M15.5 10h.01M18 10h.01M7 14h10"),
  mouse: '<rect x="7" y="3" width="10" height="18" rx="5"/>' + P("M12 3v6"),
  exit: P("M14 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 8l-4 4 4 4M6 12h9"),
};

export type IconName = keyof typeof ICON_PATHS;

/** SVG pronto (string estática, sem entrada do usuário). `size` em px; herda a cor do texto. */
export function icon(name: string, size = 24): string {
  const body = ICON_PATHS[name] ?? "";
  return `<svg class="ds-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}
