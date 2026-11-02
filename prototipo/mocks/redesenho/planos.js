/* MOCK DE DECISÃO (redesenho da descida), não é código do jogo.
   Plantas ILUSTRADAS das 7 câmaras e das antessalas, vistas de cima, em SVG, a partir de DADOS em
   metros (x para leste, z para norte; o SVG inverte z). Nada é escrito por cima da planta: cada
   elemento ganha um número e a chave fica ao lado do desenho. Cores só por classe (estilo no fim
   deste arquivo) apontando para os tokens do design system. */
(function () {
  const R = (v) => Math.round(v * 100) / 100;
  let uid = 0;
  const rnd = (i) => { const x = Math.sin(i * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

  // ------------------------------------------------------------------ bustos (gravura)
  // Cada glifo cabe num quadrado 24x24 centrado em (0,0). Busto = cabeça + ombros; o atributo diz o tipo.
  const BUST = '<path class="gb-body" d="M-9 11 C-9 4 -6 1 -3 0.2 L-3 -1.8 C-5.4 -3 -5.6 -6.4 -4.4 -8.4 C-3.4 -10.4 -1.8 -11 0 -11 C1.8 -11 3.4 -10.4 4.4 -8.4 C5.6 -6.4 5.4 -3 3 -1.8 L3 0.2 C6 1 9 4 9 11Z"/>';
  const HOOD = '<path class="gb-body" d="M-9 11 C-9 4 -7 0 -5 -2 C-6 -7 -3 -12 0 -12 C3 -12 6 -7 5 -2 C7 0 9 4 9 11Z"/><path class="gb-void" d="M-3.2 -2.5 C-3.6 -6.5 -1.8 -9 0 -9 C1.8 -9 3.6 -6.5 3.2 -2.5 C2.4 -0.5 -2.4 -0.5 -3.2 -2.5Z"/>';
  const SKULL = '<circle class="gb-eye" cx="-2" cy="-6.6" r="1"/><circle class="gb-eye" cx="2" cy="-6.6" r="1"/><path class="gb-fine" d="M-2.4 -3.6 h4.8 M-1.6 -3.6 v1.4 M0 -3.6 v1.6 M1.6 -3.6 v1.4"/>';
  const GL = {
    manso: BUST + SKULL,
    guerreiro: '<path class="gb-fine" d="M-10 10 L2 -9 M-9.4 7.2 L-6 9.2 M0 -7.8 L3 -9.6"/>' + BUST + SKULL,
    ladino: HOOD + '<path class="gb-fine" d="M4 4 L11 -4 M9 -4.6 L11.6 -1.8"/>',
    arqueiro: BUST + SKULL + '<path class="gb-fine" d="M8 -10 C14 -4 14 6 8 11 M8 -10 L8 11"/>',
    conjurador: HOOD + '<path class="gb-fine" d="M-9.5 11 L-9.5 -6"/><circle class="gb-ember" cx="-9.5" cy="-8" r="2.4"/>',
    espreitador: '<g transform="rotate(-18)">' + HOOD + '</g><path class="gb-fine" d="M-12 -2 h5 M-13 1.5 h7 M-12 5 h4"/>',
    demonio: BUST + SKULL + '<path class="gb-fine" d="M-3.6 -9.6 C-5 -12 -7.4 -13 -8.6 -12.4 M3.6 -9.6 C5 -12 7.4 -13 8.6 -12.4"/>',
    antigo: BUST + '<path class="gb-fine" d="M-4.4 -6.2 h8.8"/><path class="gb-crest" d="M-1.2 -11 C-1.6 -14 -0.4 -16 0 -17 C0.4 -16 1.6 -14 1.2 -11Z"/>',
    brutamonte: '<path class="gb-body" d="M-12 11 C-12 3 -8 0 -4 -0.6 L-4 -2.2 C-6 -3.2 -6.4 -6.8 -5 -8.6 C-3.8 -10.2 -2 -10.6 0 -10.6 C2 -10.6 3.8 -10.2 5 -8.6 C6.4 -6.8 6 -3.2 4 -2.2 L4 -0.6 C8 0 12 3 12 11Z"/>' + SKULL,
    sentinela: BUST + '<path class="gb-fine" d="M-4.4 -6.2 h8.8"/><path class="gb-crest" d="M-1.2 -11 C-1.6 -14 -0.4 -16 0 -17 C0.4 -16 1.6 -14 1.2 -11Z"/><circle class="gb-shield" cx="8" cy="4" r="4.6"/><path class="gb-fine" d="M8 -0.6 v9.2 M3.4 4 h9.2"/>',
    guardia: HOOD + '<path class="gb-dead" d="M0 2.2 L0.9 4.3 L3 5.2 L0.9 6.1 L0 8.2 L-0.9 6.1 L-3 5.2 L-0.9 4.3Z"/>',
    acendedora: HOOD + '<path class="gb-ember-star" d="M0 2.2 L0.9 4.3 L3 5.2 L0.9 6.1 L0 8.2 L-0.9 6.1 L-3 5.2 L-0.9 4.3Z"/>',
    // perigos e situações
    chao: '<path class="gb-slab" d="M-11 -7 H11 V7 H-11Z"/><path class="gb-ember-l" d="M-11 0.5 L-6 -1 L-2.5 2 L1.5 -1.5 L5 2.5 L11 1 M-2.5 2 L-4 7 M1.5 -1.5 L2.5 -7"/>',
    colunas: '<path class="gb-slab" d="M-3.5 -9 H3.5 V9 H-3.5Z M-5.5 -9 H5.5 M-5.5 9 H5.5"/><path class="gb-ember-l" d="M-12 0 H-7 M-7 0 L-9 -2 M-7 0 L-9 2 M12 0 H7 M7 0 L9 -2 M7 0 L9 2"/>',
    agua: '<path class="gb-frost-l" d="M-11 -5 Q-7.5 -9 -4 -5 T3 -5 T10 -5 M-11 1 Q-7.5 -3 -4 1 T3 1 T10 1 M-11 7 Q-7.5 3 -4 7 T3 7 T10 7"/>',
    fissura: '<path class="gb-slab" d="M-11 -10 H11 M-11 10 H11"/><path class="gb-ember-l" d="M-11 9 L-6 3 L-3 5 L1 -3 L3.5 -1 L7 -8 L11 -11"/>',
    aneis: '<path class="gb-slab" d="M-11 -11 H11 V11 H-11Z M-7 -7 H7 V7 H-7Z M-3 -3 H3 V3 H-3Z"/>',
    vigilia: '<path class="gb-slab" d="M-2.5 -1 H2.5 V10 H-2.5Z M-5 10 H5"/><path class="gb-ember" d="M0 -1 C-3.4 -5 -2.2 -8.6 0 -11.5 C2.2 -8.6 3.4 -5 0 -1Z"/>',
    tumulo: '<path class="gb-slab" d="M-9 -4 H9 V10 H-9Z M-9 0 H9"/><path class="gb-ember-l" d="M-7.5 -4 L-10 -10 L8 -8.6 L8.5 -4"/>',
    onda: '<path class="gb-slab" d="M-11 8 H11"/><path class="gb-fine" d="M-10 3 L-6 -6 L-2 3 M2 3 L6 -6 L10 3"/>',
    emboscada: '<path class="gb-slab" d="M-11 0 C-6 -7 6 -7 11 0 C6 7 -6 7 -11 0Z"/><circle class="gb-eye" cx="0" cy="0" r="3.2"/><path class="gb-ember-l" d="M0 -11 V-8 M0 8 V11"/>',
  };
  const glyph = (kind, x, y, s, cls) =>
    `<g class="gb ${cls || ""}" transform="translate(${R(x)} ${R(y)}) scale(${R(s / 24)})">${GL[kind] || ""}</g>`;
  const LETRA = { manso: "M", guerreiro: "G", ladino: "L", arqueiro: "A", conjurador: "J", espreitador: "E", demonio: "D", antigo: "N", brutamonte: "B", sentinela: "S", guardia: "Gd" };
  const NOME = { manso: "Manso", guerreiro: "Guerreiro", ladino: "Ladino", arqueiro: "Arqueiro", conjurador: "Conjurador", espreitador: "Espreitador", demonio: "Demônio", antigo: "Antigo", brutamonte: "Brutamonte", sentinela: "Sentinela", guardia: "Guardiã" };

  // ------------------------------------------------------------------ primitivos
  const rect = (x0, x1, z0, z1, cls, extra) => `<rect class="${cls}" x="${R(x0)}" y="${R(-z1)}" width="${R(x1 - x0)}" height="${R(z1 - z0)}" ${extra || ""}/>`;
  const line = (x0, z0, x1, z1, cls) => `<line class="${cls}" x1="${R(x0)}" y1="${R(-z0)}" x2="${R(x1)}" y2="${R(-z1)}"/>`;
  const text = (x, z, t, cls, extra) => `<text class="${cls}" x="${R(x)}" y="${R(-z)}" ${extra || ""}>${t}</text>`;
  const circle = (x, z, r, cls, extra) => `<circle class="${cls}" cx="${R(x)}" cy="${R(-z)}" r="${R(r)}" ${extra || ""}/>`;

  function defs(id) {
    return `<defs>
      <filter id="${id}-glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="0.9"/></filter>
      <filter id="${id}-glow2" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="2.2"/></filter>
      <filter id="${id}-soft" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="0.25"/></filter>
      <pattern id="${id}-hz" width="1.4" height="1.4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line class="pl-hatch" x1="0" y1="0" x2="0" y2="1.4"/></pattern>
      <pattern id="${id}-hg" width="1.1" height="1.1" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)"><line class="pl-hatch-gold" x1="0" y1="0" x2="0" y2="1.1"/></pattern>
      <radialGradient id="${id}-ember"><stop offset="0" class="pl-s-e1"/><stop offset="0.45" class="pl-s-e2"/><stop offset="1" class="pl-s-e3"/></radialGradient>
      <radialGradient id="${id}-frost"><stop offset="0" class="pl-s-f1"/><stop offset="1" class="pl-s-f2"/></radialGradient>
      <radialGradient id="${id}-pit"><stop offset="0" class="pl-s-p1"/><stop offset="0.7" class="pl-s-p2"/><stop offset="1" class="pl-s-p3"/></radialGradient>
      <radialGradient id="${id}-pillar" cx="0.35" cy="0.3" r="0.8"><stop offset="0" class="pl-s-pl1"/><stop offset="1" class="pl-s-pl2"/></radialGradient>
      <linearGradient id="${id}-water" x1="0" y1="0" x2="1" y2="1"><stop offset="0" class="pl-s-w1"/><stop offset="1" class="pl-s-w2"/></linearGradient>
    </defs>`;
  }

  // Piso de pedra: ladrilhos de 6 m com variação de tom e juntas; dentro de um retângulo.
  function stoneFloor(x0, x1, z0, z1, seed, safe) {
    let s = rect(x0, x1, z0, z1, safe ? "pl-floor safe" : "pl-floor");
    let i = seed;
    for (let x = Math.floor(x0 / 6) * 6; x < x1; x += 6) {
      for (let z = Math.floor(z0 / 6) * 6; z < z1; z += 6) {
        const ax = Math.max(x, x0), bx = Math.min(x + 6, x1), az = Math.max(z, z0), bz = Math.min(z + 6, z1);
        if (bx - ax < 0.2 || bz - az < 0.2) continue;
        const v = rnd(i++) * 0.09;
        s += rect(ax, bx, az, bz, "pl-tile", `style="fill-opacity:${R(0.04 + v)}"`);
        // lascas: duas fendas curtas por ladrilho, determinísticas
        const cx = (ax + bx) / 2 + (rnd(i++) - 0.5) * 3, cz = (az + bz) / 2 + (rnd(i++) - 0.5) * 3;
        const a = rnd(i++) * Math.PI, l = 0.6 + rnd(i++) * 1.2;
        s += line(cx - Math.cos(a) * l, cz - Math.sin(a) * l, cx + Math.cos(a) * l, cz + Math.sin(a) * l, "pl-chip");
      }
    }
    for (let x = Math.ceil(x0 / 6) * 6; x < x1; x += 6) if (x > x0) s += line(x, z0, x, z1, "pl-joint");
    for (let z = Math.ceil(z0 / 6) * 6; z < z1; z += 6) if (z > z0) s += line(x0, z, x1, z, "pl-joint");
    return s;
  }

  // Muro: espessura de 1 m, sombra para fora, fio de luz para dentro.
  const wallRect = (x0, x1, z0, z1) =>
    rect(x0, x1, z0, z1, "pl-wall-shadow") + rect(x0, x1, z0, z1, "pl-wall") + rect(x0, x1, z0, z1, "pl-wall-inner");

  function pillar(p, id) {
    let s = circle(p.x, p.z, 1.15, "pl-pillar-shadow") + circle(p.x, p.z, 0.95, "pl-pillar", `fill="url(#${id}-pillar)"`);
    if (p.broken) {
      s = circle(p.x, p.z, 1.15, "pl-pillar-shadow") + `<path class="pl-pillar broken" fill="url(#${id}-pillar)" d="M${R(p.x - 0.95)} ${R(-p.z)} A0.95 0.95 0 0 1 ${R(p.x + 0.95)} ${R(-p.z)} L${R(p.x + 0.4)} ${R(-p.z + 0.5)} L${R(p.x - 0.3)} ${R(-p.z + 0.2)}Z"/>`;
      s += circle(p.x + 1.4, p.z - 0.9, 0.3, "pl-rubble") + circle(p.x - 1.2, p.z - 1.2, 0.22, "pl-rubble") + circle(p.x + 0.4, p.z - 1.6, 0.18, "pl-rubble");
    }
    if (p.move) {
      const d = p.move / 2 + 1.1;
      s += line(p.x, p.z - d, p.x, p.z + d, "pl-move-glow") + line(p.x, p.z - d, p.x, p.z + d, "pl-move");
      s += `<path class="pl-move" d="M${R(p.x - 0.55)} ${R(-(p.z + d) + 0.7)} L${R(p.x)} ${R(-(p.z + d))} L${R(p.x + 0.55)} ${R(-(p.z + d) + 0.7)} M${R(p.x - 0.55)} ${R(-(p.z - d) - 0.7)} L${R(p.x)} ${R(-(p.z - d))} L${R(p.x + 0.55)} ${R(-(p.z - d) - 0.7)}"/>`;
    }
    return s;
  }

  function star(x, z, s, cls) {
    const y = -z;
    return `<path class="${cls}" d="M${R(x)} ${R(y - s)} L${R(x + s * 0.28)} ${R(y - s * 0.28)} L${R(x + s)} ${R(y)} L${R(x + s * 0.28)} ${R(y + s * 0.28)} L${R(x)} ${R(y + s)} L${R(x - s * 0.28)} ${R(y + s * 0.28)} L${R(x - s)} ${R(y)} L${R(x - s * 0.28)} ${R(y - s * 0.28)}Z"/>`;
  }
  const flame = (cx, by, h, w, cls) =>
    `<path class="${cls}" d="M${R(cx - w)} ${R(by)} C${R(cx - w)} ${R(by - h * 0.42)} ${R(cx - w * 0.25)} ${R(by - h * 0.5)} ${R(cx)} ${R(by - h)} C${R(cx + w * 0.25)} ${R(by - h * 0.5)} ${R(cx + w)} ${R(by - h * 0.42)} ${R(cx + w)} ${R(by)}Z"/>`;

  function relic(x, z, id, big) {
    const k = big ? 1.6 : 1;
    return circle(x, z, 3.2 * k, "pl-glow-ember", `fill="url(#${id}-ember)"`) + circle(x, z, 1.9 * k, "pl-dais") + circle(x, z, 1.5 * k, "pl-dais-step") + circle(x, z, 1.0 * k, "pl-dais-top") +
      star(x, z, 1.3 * k, "pl-relic-halo") + star(x, z, 0.8 * k, "pl-relic");
  }

  function hatch(x, z, id) {
    let s = circle(x, z, 3.3, "pl-glow-ember", `fill="url(#${id}-ember)"`) + circle(x, z, 2.3, "pl-hatch-rim") + circle(x, z, 1.9, "pl-hatch-pit", `fill="url(#${id}-pit)"`);
    // degraus em caracol
    for (let i = 0; i < 7; i++) { const a0 = (i / 7) * Math.PI * 2, a1 = ((i + 0.72) / 7) * Math.PI * 2; s += `<path class="pl-step" d="M${R(x + Math.cos(a0) * 1.8)} ${R(-z - Math.sin(a0) * 1.8)} A1.8 1.8 0 0 1 ${R(x + Math.cos(a1) * 1.8)} ${R(-z - Math.sin(a1) * 1.8)} L${R(x + Math.cos(a1) * 0.6)} ${R(-z - Math.sin(a1) * 0.6)}"/>`; }
    s += circle(x, z, 2.6, "pl-hatch-ring");
    return s;
  }

  function enemy(e, id) {
    const cls = e.wave === 2 ? "pl-token w2" : e.amb ? "pl-token amb" : "pl-token";
    let s = circle(e.x, e.z, 2.0, "pl-glow-frost", `fill="url(#${id}-frost)"`) + circle(e.x, e.z, 1.25, cls) + glyph(e.kind, e.x, -e.z + 0.1, 2.0, "frost");
    if (e.wave === 2) s += circle(e.x, e.z, 1.65, "pl-token-outer w2");
    if (e.amb) s += circle(e.x, e.z, 1.65, "pl-token-outer amb");
    return s;
  }

  const badge = (x, z, n) => circle(x, z, 0.78, "pl-badge") + text(x, z - 0.36, String(n), "pl-badge-t", 'text-anchor="middle"');

  // Ícones de marco (em metros, centrados).
  function markIcon(m) {
    const x = m.x, y = -m.z;
    switch (m.kind) {
      case "tumulo": return `<g transform="translate(${R(x)} ${R(y)}) rotate(${m.rot || 0})"><rect class="pl-ic-fill" x="-1.3" y="-0.8" width="2.6" height="1.6" rx="0.15"/><path class="pl-ic" d="M-1.3 -0.8 H1.3 V0.8 H-1.3Z M-1.3 -0.25 H1.3"/>${m.open ? '<path class="pl-ic-ember" d="M-1.1 -0.8 L-1.6 -1.6 L1.2 -1.4 L1.3 -0.8"/>' : ""}</g>`;
      case "banco": return `<g transform="translate(${R(x)} ${R(y)})"><rect class="pl-ic-fill" x="-1.4" y="-0.35" width="2.8" height="0.7" rx="0.1"/><path class="pl-ic" d="M-1.4 -0.35 H1.4 V0.35 H-1.4Z M-1.1 0.35 V0.8 M1.1 0.35 V0.8"/></g>`;
      case "acampamento": return `<g transform="translate(${R(x)} ${R(y)})"><path class="pl-ic-fill" d="M-1.8 1.2 C-1.6 -0.2 -1 -1.2 0 -1.3 C1 -1.2 1.6 -0.2 1.8 1.2Z"/><path class="pl-ic" d="M-1.8 1.2 C-1.6 -0.2 -1 -1.2 0 -1.3 C1 -1.2 1.6 -0.2 1.8 1.2Z"/><path class="pl-ic-hatch" d="M-1 1.2 L-0.4 -0.6 M-0.2 1.2 L0.2 -0.8 M0.6 1.2 L0.9 -0.2"/><circle class="pl-ic-dead" cx="1.9" cy="0.9" r="0.32"/></g>`;
      case "fogueira": return `<g transform="translate(${R(x)} ${R(y)})"><circle class="pl-ic-fill" r="0.9"/><circle class="pl-ic" r="0.9"/><path class="pl-ic" d="M-0.5 0.4 L0.5 -0.4 M-0.5 -0.4 L0.5 0.4"/></g>`;
      case "mochila": return `<g transform="translate(${R(x)} ${R(y)})"><rect class="pl-ic-fill" x="-0.7" y="-0.8" width="1.4" height="1.6" rx="0.3"/><path class="pl-ic" d="M-0.7 -0.8 H0.7 V0.8 H-0.7Z M-0.3 -0.8 V-1.2 H0.3 V-0.8"/></g>`;
      case "inscricao": return `<g transform="translate(${R(x)} ${R(y)})"><rect class="pl-ic-fill" x="-0.9" y="-1.1" width="1.8" height="2.2" rx="0.2"/><path class="pl-ic" d="M-0.9 -1.1 H0.9 V1.1 H-0.9Z"/><path class="pl-ic-fine" d="M-0.5 -0.5 h1 M-0.5 0 h1 M-0.5 0.5 h0.6"/></g>`;
      case "ossada": return `<g transform="translate(${R(x)} ${R(y)}) rotate(${m.rot || 0})"><path class="pl-ic-fill" d="M-1.6 0.6 C-1.6 -0.2 -1 -0.6 -0.4 -0.6 L1.2 -0.6 C1.7 -0.6 1.9 0 1.6 0.6Z"/><path class="pl-ic" d="M-1.6 0.6 C-1.6 -0.2 -1 -0.6 -0.4 -0.6 L1.2 -0.6 C1.7 -0.6 1.9 0 1.6 0.6Z"/><circle class="pl-ic-bone" cx="-0.9" cy="0" r="0.42"/><path class="pl-ic-hatch" d="M0.2 -0.3 v0.8 M0.6 -0.3 v0.8 M1 -0.3 v0.8"/></g>`;
      case "forja": return `<g transform="translate(${R(x)} ${R(y)})"><path class="pl-ic-fill" d="M-1.6 -0.3 H1.6 L1 0.4 H0.4 V1 H-0.4 V0.4 H-1 Z"/><path class="pl-ic" d="M-1.6 -0.3 H1.6 L1 0.4 H0.4 V1 H-0.4 V0.4 H-1 Z"/></g>`;
      case "vela": return `<g transform="translate(${R(x)} ${R(y)})"><circle class="pl-ic-fill" r="0.5"/><circle class="pl-ic" r="0.5"/>${flame(0, -0.5, 0.9, 0.3, "pl-ic-ember-fill")}</g>`;
      case "braseiro_frio": return `<g transform="translate(${R(x)} ${R(y)})"><circle class="pl-ic-fill" r="1.1"/><circle class="pl-ic" r="1.1"/><circle class="pl-ic" r="0.5"/><path class="pl-ic-fine" d="M-0.3 0.6 L0.3 -0.6"/></g>`;
      case "cascata": return `<g transform="translate(${R(x)} ${R(y)})"><path class="pl-ic-frost" d="M-2.4 -0.8 Q-1.6 -1.6 -0.8 -0.8 T0.8 -0.8 T2.4 -0.8 M-2.4 0.2 Q-1.6 -0.6 -0.8 0.2 T0.8 0.2 T2.4 0.2 M-1.6 -2 V-0.8 M0 -2.2 V-0.8 M1.6 -2 V-0.8"/></g>`;
      case "coluna": return `<g transform="translate(${R(x)} ${R(y)})"><circle class="pl-ic-fill" r="1.1"/><circle class="pl-ic" r="1.1"/><path class="pl-ic-fine" d="M-0.6 -0.3 h1.2 M-0.6 0.1 h1.2 M-0.6 0.5 h0.8"/></g>`;
      case "grade": return `<g transform="translate(${R(x)} ${R(y)})"><rect class="pl-ic-ember-fill" x="-1.4" y="-1.4" width="2.8" height="2.8"/><path class="pl-ic-grid" d="M-1.4 -0.7 h2.8 M-1.4 0 h2.8 M-1.4 0.7 h2.8 M-0.7 -1.4 v2.8 M0 -1.4 v2.8 M0.7 -1.4 v2.8"/><rect class="pl-ic" x="-1.4" y="-1.4" width="2.8" height="2.8"/></g>`;
      case "guardia": return `<g transform="translate(${R(x)} ${R(y)})">${circle(0, 0, 2.6, "pl-glow-frost", `fill="url(#${m.id}-frost)"`)}<circle class="pl-token boss" r="1.6"/>${glyph("guardia", 0, 0.1, 2.5, "frost")}</g>`;
      default: return `<path class="pl-mark" d="M${R(x)} ${R(y - 0.8)} L${R(x + 0.8)} ${R(y)} L${R(x)} ${R(y + 0.8)} L${R(x - 0.8)} ${R(y)}Z"/>`;
    }
  }

  function heroToken(x, z, id) {
    return circle(x, z, 2.2, "pl-glow-ember", `fill="url(#${id}-ember)"`) + circle(x, z, 1.25, "pl-token hero") + glyph("acendedora", x, -z + 0.1, 2.0, "gold");
  }

  function stoneDoor(x, z, vertical) {
    // vão no muro + laje de pedra (no eixo da parede sul da câmara, ou da norte da antessala)
    return rect(x - 1.7, x + 1.7, z - 0.75, z + 0.75, "pl-floor-fill") + rect(x - 1.5, x + 1.5, z - 0.32, z + 0.32, "pl-door") + rect(x - 1.5, x + 1.5, z + 0.1, z + 0.32, "pl-door-hi") + circle(x, z, 0.12, "pl-door-knob");
  }

  function compass(x, z) {
    return `<g transform="translate(${R(x)} ${R(-z)})"><path class="pl-compass" d="M0 -2.2 L0.7 0.4 L0 -0.2 L-0.7 0.4Z"/><text class="pl-lab tiny" x="0" y="-2.7" text-anchor="middle">N</text></g>`;
  }
  const scaleBar = (x, z) => line(x, z, x + 6, z, "pl-scale") + line(x, z - 0.4, x, z + 0.4, "pl-scale") + line(x + 6, z - 0.4, x + 6, z + 0.4, "pl-scale") + text(x + 3, z - 1.3, "6 m", "pl-lab tiny", 'text-anchor="middle"');

  // ------------------------------------------------------------------ antessala
  // a: { w, h, oficio: "estante"|"bancada"|"ambos"|null, extra?: fn, nome }
  function antessala(a, x0, zTop, id, key) {
    const w = a.w || 12, h = a.h || 12;
    const x1 = x0 + w, z1 = zTop, z0 = zTop - h;
    const cx = (x0 + x1) / 2;
    let s = wallRect(x0, x1, z0, z1) + stoneFloor(x0, x1, z0, z1, 900, true);
    // luz fria do patamar + poça quente do braseiro
    const bz = z0 + h * 0.42;
    s += circle(cx, bz, 5.2, "pl-glow-ember", `fill="url(#${id}-ember)" opacity="0.7"`);
    // escada que chega do andar de cima (canto sudoeste)
    s += rect(x0 + 0.9, x0 + 4.1, z0 + 0.3, z0 + 2.5, "pl-stairwell", `fill="url(#${id}-pit)"`);
    for (let i = 0; i < 5; i++) s += line(x0 + 0.9, z0 + 0.5 + i * 0.45, x0 + 4.1, z0 + 0.5 + i * 0.45, "pl-step");
    s += rect(x0 + 0.9, x0 + 4.1, z0 + 0.3, z0 + 2.5, "pl-stairwell-rim");
    // braseiro
    s += circle(cx, bz, 1.25, "pl-brazier-shadow") + circle(cx, bz, 1.05, "pl-brazier") + circle(cx, bz, 0.75, "pl-brazier-bowl") + flame(cx, -bz + 0.55, 1.5, 0.5, "pl-flame-glow") + flame(cx, -bz + 0.55, 1.3, 0.42, "pl-flame") + flame(cx, -bz + 0.5, 0.7, 0.2, "pl-flame-core");
    // armário (parede oeste)
    const az = z0 + h * 0.64;
    s += rect(x0 + 0.5, x0 + 1.5, az - 1.7, az + 1.7, "pl-furn") + rect(x0 + 0.5, x0 + 1.5, az - 1.7, az + 1.7, "pl-furn-life");
    for (let i = 0; i < 4; i++) { const nz = az - 1.35 + i * 0.85; s += rect(x0 + 0.65, x0 + 1.35, nz - 0.3, nz + 0.3, "pl-nicho"); if (i === 0 || i === 2) s += circle(x0 + 1.0, nz, 0.17, "pl-bottle" + (i === 2 ? " gold" : "")); }
    // ofício (parede leste)
    const of = a.oficio;
    const estante = (zz) => { let t = rect(x1 - 1.5, x1 - 0.5, zz - 1.9, zz + 1.9, "pl-furn") + rect(x1 - 1.5, x1 - 0.5, zz - 1.9, zz + 1.9, "pl-furn-gold"); for (let i = 0; i < 7; i++) t += line(x1 - 1.35, zz - 1.6 + i * 0.53, x1 - 0.65, zz - 1.6 + i * 0.53, "pl-book"); return t + circle(x1 - 2.1, zz, 0.3, "pl-candle") + flame(x1 - 2.1, -zz - 0.3, 0.6, 0.18, "pl-flame"); };
    const bancada = (zz) => { let t = rect(x1 - 2.6, x1 - 0.5, zz - 1.4, zz + 1.4, "pl-furn") + rect(x1 - 2.6, x1 - 0.5, zz - 1.4, zz + 1.4, "pl-furn-life"); for (let i = 0; i < 3; i++) t += circle(x1 - 1.55, zz - 0.85 + i * 0.85, 0.27, "pl-bottle" + (i === 1 ? " ember" : "")); for (let i = 0; i < 3; i++) t += circle(x1 - 2.2, zz - 0.85 + i * 0.85, 0.12, "pl-candle") + flame(x1 - 2.2, -(zz - 0.85 + i * 0.85) - 0.12, 0.45, 0.13, "pl-flame"); return t; };
    if (of === "estante") s += estante(az);
    if (of === "bancada") s += bancada(az);
    if (of === "ambos") s += estante(az + 1.2) + bancada(z0 + h * 0.28);
    // mural (parede norte, dos dois lados da porta)
    if (a.mural !== false) {
      const panel = (px0, px1) => rect(px0, px1, z1 - 1.0, z1 - 0.3, "pl-mural") + rect(px0 + 0.15, px1 - 0.15, z1 - 0.88, z1 - 0.42, "pl-mural-in", `fill="url(#${id}-hg)"`) + rect(px0, px1, z1 - 1.3, z1 - 1.0, "pl-mural-light", `filter="url(#${id}-soft)"`);
      s += panel(x0 + 0.6, cx - 2.3) + panel(cx + 2.3, x1 - 0.6);
    }
    if (a.extra) s += a.extra(x0, x1, z0, z1, cx, id);
    // etiquetas fixas (letras), explicadas na legenda comum
    const tag = (x, z, t) => circle(x, z, 0.62, "pl-tag") + text(x, z - 0.3, t, "pl-tag-t", 'text-anchor="middle"');
    s += tag(x0 + 2.5, z0 + 3.4, "E") + tag(cx + 1.9, bz - 1.6, "B") + tag(x0 + 1.0, az - 2.6, "A") + (of ? tag(x1 - 1.0, (of === "ambos" ? az + 1.2 : az) - 2.8, "O") : "") + (a.mural !== false ? tag(x0 + 1.3, z1 - 2.0, "M") + tag(x1 - 1.3, z1 - 2.0, "M") : "");
    if (key) key.push({ fixed: true });
    return s;
  }

  // ------------------------------------------------------------------ câmara
  function chamber(d) {
    uid++;
    const id = `pl${uid}`;
    const HX = d.halfX, HZ = d.halfZ;
    const ant = d.antessala || {};
    const aw = ant.w || 12, ah = ant.h || 12;
    const GAP = 1.6;
    const extras = d.extra || [];
    let minX = -HX, maxX = HX, minZ = -HZ - GAP - ah, maxZ = HZ;
    for (const e of extras) { minX = Math.min(minX, e.x0); maxX = Math.max(maxX, e.x1); maxZ = Math.max(maxZ, e.z1); }
    minX = Math.min(minX, -aw / 2); maxX = Math.max(maxX, aw / 2);
    const pad = 2.6;
    const vb = `${R(minX - pad)} ${R(-(maxZ + pad + 1.2))} ${R(maxX - minX + pad * 2)} ${R(maxZ - minZ + pad * 2 + 1.2)}`;
    let s = `<svg class="plan-svg" viewBox="${vb}" style="--fs:${d.fs || 1}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${d.nome}">${defs(id)}`;
    s += `<rect class="pl-bg" x="${R(minX - pad)}" y="${R(-(maxZ + pad + 1.2))}" width="${R(maxX - minX + pad * 2)}" height="${R(maxZ - minZ + pad * 2 + 1.2)}"/>`;
    // muros (sombra para fora) e piso
    s += wallRect(-HX, HX, -HZ, HZ);
    for (const e of extras) s += wallRect(e.x0, e.x1, e.z0, e.z1);
    s += stoneFloor(-HX, HX, -HZ, HZ, d.n * 37);
    for (const e of extras) s += stoneFloor(e.x0, e.x1, e.z0, e.z1, d.n * 53 + e.x0);
    for (const e of extras) if (e.open) s += line(e.open[0], e.open[1], e.open[2], e.open[3], "pl-open");
    // água, perigos, faixas, anéis
    for (const w of d.water || []) s += rect(w.x0, w.x1, w.z0, w.z1, "pl-water", `fill="url(#${id}-water)"`) + rect(w.x0, w.x1, w.z0, w.z1, "pl-water-edge");
    for (const h of d.hazard || []) {
      if (h.kind === "plataforma") s += rect(h.x0, h.x1, h.z0, h.z1, "pl-platform") + rect(h.x0 + 0.5, h.x1 - 0.5, h.z0 + 0.5, h.z1 - 0.5, "pl-platform-top");
      else s += rect(h.x0, h.x1, h.z0, h.z1, "pl-hot", `fill="url(#${id}-ember)" opacity="0.55"`) + rect(h.x0, h.x1, h.z0, h.z1, "pl-hazard", `fill="url(#${id}-hz)"`);
      if (h.kind === "fissura") { let p = `M${R(h.x0 + (h.x1 - h.x0) / 2)} ${R(-h.z0)}`; for (let z = h.z0; z < h.z1; z += 2.2) p += ` L${R(h.x0 + (h.x1 - h.x0) * (0.25 + rnd(z * 3 + d.n) * 0.5))} ${R(-(z + 1.1))}`; s += `<path class="pl-fissure-glow" d="${p}" filter="url(#${id}-glow)"/><path class="pl-fissure" d="${p}"/>`; }
      if (h.kind === "grade") s += markIcon({ kind: "grade", x: (h.x0 + h.x1) / 2, z: (h.z0 + h.z1) / 2 });
    }
    if (d.bands) for (let i = 1; i < d.bands; i++) s += line(-HX, -HZ + i * 6, HX, -HZ + i * 6, "pl-band");
    if (d.bands) for (let i = 0; i < d.bands; i++) s += text(-HX + 0.7, -HZ + i * 6 + 2.6, String(i + 1), "pl-lab tiny ember", 'text-anchor="start"');
    if (d.rings) for (const r of d.rings) s += rect(-r.half, r.half, -r.half, r.half, "pl-ring") + text(r.half - 0.5, r.half - 1.6, r.label, "pl-lab tiny frost", 'text-anchor="end"');
    // faixa de combate: poça de luz quente
    if (d.calm) s += `<ellipse class="pl-calm-glow" cx="${R(d.calm.cx)}" cy="${R(-d.calm.cz)}" rx="${R(d.calm.rx)}" ry="${R(d.calm.rz)}" fill="url(#${id}-ember)"/><ellipse class="pl-calm" cx="${R(d.calm.cx)}" cy="${R(-d.calm.cz)}" rx="${R(d.calm.rx)}" ry="${R(d.calm.rz)}"/>`;
    // pilares, marcos, relicário, alçapão, porta, heroína, inimigos
    for (const p of d.pillars || []) s += pillar(p, id);
    const key = [];
    let n = 0;
    for (const m of d.marks || []) { s += markIcon(Object.assign({ id }, m)); if (m.key) { n++; s += badge(m.x + (m.bdx ?? 1.2), m.z + (m.bdz ?? 1.2), n); key.push({ n, kind: "marco", t: m.key }); } }
    for (const h of d.hazard || []) if (h.key) { n++; s += badge(h.x0 + 1.1, h.z1 - 1.1, n); key.push({ n, kind: "perigo", t: h.key }); }
    if (d.relic) s += relic(d.relic.x, d.relic.z, id, d.n === 7);
    if (d.hatch) s += hatch(d.hatch.x, d.hatch.z, id);
    s += stoneDoor(d.door ? d.door.x : 0, -HZ);
    s += heroToken(d.spawn ? d.spawn.x : 0, d.spawn ? d.spawn.z : -HZ + 3, id);
    for (const e of d.enemies || []) { s += enemy(e, id); n++; s += badge(e.x + 1.35, e.z + 1.35, n); key.push({ n, kind: e.wave === 2 ? "onda 2" : e.amb ? "emboscada" : "morto", t: `<strong>${NOME[e.kind]}</strong>${e.key ? ": " + e.key : ""}` }); }
    // antessala abaixo, ligada pela porta de pedra
    s += antessala(Object.assign({}, ant), -aw / 2, -HZ - GAP, id);
    s += stoneDoor(0, -HZ - GAP);
    s += rect(-0.9, 0.9, -HZ - GAP, -HZ, "pl-link");
    // título, dimensão, bússola, escala
    s += text(minX - pad + 0.6, maxZ + pad + 0.1, d.nome, "pl-title", 'text-anchor="start"');
    s += text(maxX + pad - 0.6, maxZ + pad + 0.2, `${HX * 2} x ${HZ * 2} m`, "pl-lab", 'text-anchor="end"');
    s += text(-aw / 2, -HZ - GAP - ah - 1.5, ant.nome || "antessala", "pl-title safe", 'text-anchor="start"');
    s += compass(maxX + pad - 1.4, minZ + 3.2) + scaleBar(maxX + pad - 8.6, minZ - 0.4);
    s += "</svg>";
    return { svg: s, key };
  }

  // ------------------------------------------------------------------ dados: as 7 câmaras
  const CAMARAS = [
    {
      n: 1, id: "c1", nome: "Câmara dos Bancos", sub: "a guarda de cima (arenito, raízes, túmulo arrombado)",
      halfX: 12, halfZ: 12,
      extra: [
        { x0: 12, x1: 14.5, z0: -7.5, z1: -4.5, open: [12, -7.5, 12, -4.5] },
        { x0: 12, x1: 14.5, z0: -1.5, z1: 1.5, open: [12, -1.5, 12, 1.5] },
        { x0: 12, x1: 14.5, z0: 4.5, z1: 7.5, open: [12, 4.5, 12, 7.5] },
      ],
      calm: { cx: 0, cz: -1.5, rx: 6.5, rz: 8.5 },
      pillars: [{ x: -8, z: -6, broken: true }, { x: 8, z: -6, broken: true }, { x: -8, z: 6 }, { x: 8, z: 6 }],
      marks: [
        { x: 13.3, z: -6, kind: "tumulo", rot: 90, key: "túmulo selado, intacto (fila dos que repousam)" },
        { x: 13.3, z: 0, kind: "tumulo", rot: 90, open: true, key: "túmulo arrombado por dentro: o ponto exato onde a luz recuou" },
        { x: 13.3, z: 6, kind: "tumulo", rot: 90, key: "túmulo selado; o 2o Manso sai daqui quando o 1o cai" },
        { x: -5, z: -4, kind: "banco", key: "bancos com os nomes do povo (leitura por proximidade; chutáveis)" }, { x: 5, z: -4, kind: "banco" }, { x: -5, z: 2, kind: "banco" }, { x: 5, z: 2, kind: "banco" },
      ],
      relic: { x: 0, z: 9.2 }, hatch: { x: -6.5, z: 7.5 },
      enemies: [{ x: 8.8, z: -0.4, kind: "manso", key: "sai do túmulo arrombado; 1 contra 1 na faixa de combate" }, { x: 8.8, z: 5.6, kind: "manso", wave: 2, key: "acorda só quando o primeiro cai (onda mínima)" }],
      antessala: { nome: "A1 A Boca (prólogo)", oficio: null },
      props: {
        proposito: "Ensinar o laço inteiro em segurança: penumbra, um morto que sai de um túmulo (não de um ponto no ar), limpar, colher a estilha, descer. Beat do canon: os mortos são o povo (nomes nos bancos).",
        planta: "Quadrado 24 x 24 com três nichos de túmulo na parede leste; o do meio está arrombado por dentro. Bancos em duas filas emolduram a faixa de combate. Alçapão a noroeste, para a Acendedora cruzar a sala.",
        inimigos: "1 Manso sai do túmulo arrombado. Quando cai, um 2o Manso acorda no túmulo ao lado: a onda mínima, que ensina que o escuro responde à luz que avança.",
        aprende: "Ler o tell e punir; a sala limpa abre o relicário; a estilha abre o alçapão. Sem prazo, sem flanco.",
      },
      tags: ["ember:tutorial", "frost:1 + 1 Manso", "gold:beat: o povo"],
    },
    {
      n: 2, id: "c2", nome: "Salão do Acampamento", sub: "alguém desceu antes (basalto, cinza, acampamento apagado)",
      halfX: 18, halfZ: 12,
      extra: [{ x0: -6, x1: 6, z0: 12, z1: 18, open: [-6, 12, 6, 12] }],
      calm: { cx: 0, cz: -1, rx: 9, rz: 8 },
      pillars: [{ x: -13, z: -6, broken: true }, { x: -13, z: 0 }, { x: -13, z: 6 }, { x: 13, z: -6 }, { x: 13, z: 0, broken: true }, { x: 13, z: 6 }],
      marks: [
        { x: 0, z: -2, kind: "acampamento", key: "o acampamento apagado: manto rasgado e fagulha apagada (o decalque da Crônica)" },
        { x: -9, z: 9, kind: "fogueira", key: "fogueira fria de quem desceu antes" },
        { x: 15, z: 9.5, kind: "mochila", key: "mochila e corda abandonadas" },
      ],
      relic: { x: 0, z: 15.2 }, hatch: { x: 11, z: 6 },
      enemies: [
        { x: -15, z: -3, kind: "manso", key: "vem da colunata oeste (pressão de um lado só)" }, { x: -15, z: 4, kind: "manso", key: "o segundo da colunata, dois passos atrás" },
        { x: 4.5, z: 14, kind: "demonio", amb: true, key: "emboscada avisada: acorda quando a Acendedora toca o acampamento (1 s de cinzas subindo); o mural já o mostrou" },
      ],
      antessala: { nome: "A2 O Scriptorium", oficio: "estante" },
      props: {
        proposito: "O primeiro flanco e a primeira silhueta nova. O centro do salão é o acampamento de quem desceu antes: a Acendedora tem que passar por ele, e é ali que o Demônio emboscado se revela.",
        planta: "Salão largo 36 x 24 com abside ao norte (12 x 6) onde está o relicário. Colunatas de basalto quebradas nas paredes leste e oeste. Alçapão a nordeste, do lado oposto à colunata dos Mansos.",
        inimigos: "2 Mansos vêm da colunata oeste. O Demônio só acorda quando a Acendedora chega ao acampamento (gatilho de proximidade, aviso de 1 s).",
        aprende: "Flanquear e virar; respeitar uma silhueta mais rápida; o mural é honesto: o que ele mostrou está aqui.",
      },
      tags: ["frost:2 Mansos + Demônio", "ember:emboscada avisada", "gold:beat: alguém desceu antes"],
    },
    {
      n: 3, id: "c3", nome: "Cisterna que Cede", sub: "a dúvida (calcário, gelo, água parada, cascata)",
      halfX: 12, halfZ: 24,
      extra: [
        { x0: -18, x1: -12, z0: 0, z1: 12, open: [-12, 0, -12, 12] },
        { x0: 12, x1: 18, z0: 0, z1: 12, open: [12, 0, 12, 12] },
      ],
      water: [{ x0: -12, x1: -10.4, z0: -24, z1: 24 }, { x0: 10.4, x1: 12, z0: -24, z1: 24 }, { x0: -6, x1: 6, z0: 22.4, z1: 24 }],
      bands: 8,
      hazard: [{ x0: 12.4, x1: 17.6, z0: 6.2, z1: 11.6, kind: "plataforma", key: "plataforma elevada com parapeito: o posto do Arqueiro; só se alcança pelo braço leste, por uma rampa" }],
      calm: { cx: 0, cz: 0, rx: 7, rz: 17 },
      pillars: [{ x: -8.5, z: -18 }, { x: 8.5, z: -18 }, { x: -8.5, z: -10 }, { x: 8.5, z: -10 }, { x: -8.5, z: 14 }, { x: 8.5, z: 14 }, { x: -8.5, z: 19, broken: true }, { x: 8.5, z: 19 }],
      marks: [
        { x: -8.5, z: -10, kind: "inscricao", bdx: -1.3, bdz: 1.3, key: "inscrição 1: 'uma mulher acendeu a primeira chama'" },
        { x: 8.5, z: -10, kind: "inscricao", key: "inscrição 2: 'a própria luz tomou forma'" },
        { x: -8.5, z: 14, kind: "inscricao", bdx: -1.3, bdz: 1.3, key: "inscrição 3: 'nunca houve primeira; sempre houve fogo'" },
        { x: 0, z: 23.2, kind: "cascata", bdx: 3.2, bdz: -0.6, key: "cascata atrás do relicário; a água parada corre ao longo das paredes (atenua passos)" },
      ],
      relic: { x: 0, z: 20.5 }, hatch: { x: 6.8, z: 17 },
      enemies: [
        { x: 0, z: 3, kind: "guerreiro", key: "na frente, na pista central" }, { x: -3, z: 7, kind: "manso", key: "ao lado do Guerreiro" },
        { x: 15, z: 8.2, kind: "arqueiro", key: "atira do alto da plataforma (4); subir até ele custa tempo de prazo" },
        { x: -15, z: 6, kind: "espreitador", amb: true, key: "espreita no braço oeste e ataca quem passa pelo transepto" },
      ],
      antessala: { nome: "A3 A Botica", oficio: "bancada" },
      props: {
        proposito: "O pico de pressão do Ato I para o II: tempo (Instabilidade), distância (Arqueiro no alto) e um flanco escondido. A dúvida do canon está nas três inscrições contraditórias que a Acendedora passa correndo.",
        planta: "Nave 24 x 48 em 8 faixas de 6 m que cedem da entrada para o relicário (spec cenário vivo, aprovada; as três últimas não cedem). Transepto a meio caminho (braços 6 x 12). Canais de água ao longo das paredes e cascata atrás do relicário.",
        inimigos: "Guerreiro e Manso na frente; Arqueiro na plataforma do braço leste; Espreitador espera no braço oeste e ataca quem passa pelo transepto.",
        aprende: "Ler o prazo (poeira, rachadura, rangido); escolher entre caçar o arqueiro ou correr; usar cobertura; o Unguento preparado na Botica paga a Ferida da pressa.",
      },
      tags: ["ember:set piece: Instabilidade", "frost:4 mortos, 1 ranged", "gold:beat: a dúvida"],
    },
    {
      n: 4, id: "c4", nome: "Salão das Grades", sub: "o custo (ferro, espetos, veios de brasa, colunas que deslizam)",
      halfX: 12, halfZ: 12,
      extra: [
        { x0: -14.5, x1: -12, z0: -12, z1: -8, open: [-12, -12, -12, -8] },
        { x0: 12, x1: 14.5, z0: -12, z1: -8, open: [12, -12, 12, -8] },
      ],
      hazard: [{ x0: -10, x1: -7, z0: -8, z1: -5, kind: "grade", key: "grade quente: brasa visível por baixo; 4% da vida por segundo a quem fica parado em cima (jogador e morto)" }, { x0: 7, x1: 10, z0: -8, z1: -5, kind: "grade" }, { x0: 3, x1: 6, z0: 7.5, z1: 10.5, kind: "grade" }],
      calm: { cx: 0, cz: -1.5, rx: 6.5, rz: 8.5 },
      pillars: [{ x: -7, z: -5, move: 3 }, { x: -4, z: -5, broken: true }, { x: 4, z: -5, broken: true }, { x: 7, z: -5, move: 3 }, { x: -7, z: 1, move: 3 }, { x: -4, z: 1 }, { x: 4, z: 1 }, { x: 7, z: 1, move: 3 }],
      marks: [
        { x: 0, z: 3.5, kind: "coluna", key: "coluna da Primeira, com a inscrição 'a chama cobra em carne: uma vida por geração'" },
        { x: -13.2, z: -10, kind: "tumulo", key: "nicho da entrada: o Espreitador sai daqui 3 s depois do despertar, pelas costas" },
        { x: 13.2, z: -10, kind: "tumulo", key: "nicho da entrada (vazio, mas o jogador não sabe)" },
      ],
      relic: { x: 0, z: 9.4 }, hatch: { x: -8, z: 8.5 },
      enemies: [
        { x: 7.5, z: 5.5, kind: "conjurador", key: "fundo, atrás das colunas que deslizam (a cobertura some e volta no ciclo de 7 s)" },
        { x: 0, z: -0.5, kind: "antigo", key: "escolta o centro (postura 45: não interrompe com leves)" }, { x: -3.5, z: -2.5, kind: "guerreiro", key: "com o Antigo" }, { x: 3.5, z: -3, kind: "manso", key: "com o Antigo" },
        { x: -13.2, z: -10, kind: "espreitador", amb: true, key: "emboscada avisada: sai do nicho atrás da Acendedora 3 s depois" },
      ],
      antessala: { nome: "A4 A Sala dos Nomes", oficio: "estante" },
      props: {
        proposito: "Cobertura que se mexe e um inimigo que exige paciência. É o andar do custo: o chão está quente pelas grades (o primeiro calor da Brasa, sentido antes de visto) e a inscrição da Primeira confessa a conta.",
        planta: "Quadrado 24 x 24 com floresta de pilares (|x| = 4 e 7); as quatro colunas externas deslizam 3 m em z (spec cenário vivo, aprovada). Dois nichos nos cantos da entrada.",
        inimigos: "Conjurador fundo, protegido pelas colunas móveis; Antigo escolta o centro com Guerreiro e Manso; Espreitador surge do nicho da entrada 3 s depois do despertar.",
        aprende: "Esperar a janela da coluna para fechar no Conjurador; respeitar o Antigo; não dar as costas à porta; as grades punem ficar parado.",
      },
      tags: ["ember:set piece: colunas deslizantes", "frost:5 mortos, 1 ranged", "gold:beat: o custo"],
    },
    {
      n: 5, id: "c5", nome: "Santuário das Duas", sub: "luto e respiro (osso e cal, velas votivas, duas ossadas)",
      halfX: 18, halfZ: 12,
      extra: [
        { x0: -21, x1: -18, z0: -8, z1: 8, open: [-18, -8, -18, 8] },
        { x0: 18, x1: 21, z0: -8, z1: 8, open: [18, -8, 18, 8] },
        { x0: -5, x1: 5, z0: 12, z1: 16, open: [-5, 12, 5, 12] },
      ],
      calm: { cx: 0, cz: 0, rx: 10, rz: 8.5 },
      pillars: [{ x: -14.5, z: -6 }, { x: -14.5, z: 2 }, { x: -14.5, z: 10 }, { x: 14.5, z: -6 }, { x: 14.5, z: 2 }, { x: 14.5, z: 10 }],
      marks: [
        { x: -4, z: -9.5, kind: "ossada", rot: -20, key: "ossada da que voltou: chegou até a porta e ali ficou" },
        { x: 2.5, z: 13.8, kind: "ossada", rot: 15, key: "ossada da que desceu mais, no limiar norte" },
        { x: -19.5, z: -2, kind: "tumulo", rot: 90, key: "galeria oeste: ossuário que se abre na Vigília" },
        { x: 19.5, z: -2, kind: "tumulo", rot: 90, key: "galeria leste: ossuário que se abre na Vigília" },
        { x: -4, z: -4, kind: "vela", key: "velas votivas em volta do estrado; apagam quando a Vigília começa" }, { x: 4, z: -4, kind: "vela" }, { x: -4, z: 4, kind: "vela" }, { x: 4, z: 4, kind: "vela" },
      ],
      relic: { x: 0, z: 0 }, hatch: { x: 11.5, z: -6.5 },
      enemies: [
        { x: -1.5, z: 14.8, kind: "brutamonte", wave: 2, key: "vem da abside, lento: dá tempo de se posicionar; inquebrável (esquiva)" },
        { x: -19.5, z: 4, kind: "arqueiro", wave: 2, key: "da galeria oeste, atira sobre o estrado" },
        { x: 19.5, z: 2, kind: "ladino", wave: 2, key: "da galeria leste, rápido" }, { x: 19.5, z: -4, kind: "demonio", wave: 2, key: "da galeria leste, atrás do Ladino" },
      ],
      antessala: { nome: "A5 A Botica Funda", oficio: "bancada" },
      props: {
        proposito: "Inverter o laço uma vez: a câmara está em silêncio ao entrar. A Acendedora passa pela ossada da que voltou, atravessa as velas e colhe a estilha no centro; só então os ossuários se abrem (Vigília) e ela luta de costas para a saída, que ficou onde entrou.",
        planta: "Salão axial 36 x 24 com colunata, duas galerias de ossuário (3 m fundas) ao longo das paredes longas e uma abside ao norte com a segunda ossada. Relicário no centro, num estrado rodeado de velas. Alçapão junto da entrada.",
        inimigos: "Nenhum ao entrar. Ao colher a estilha: Brutamonte da abside, Arqueiro da galeria oeste, Ladino e Demônio da galeria leste. O alçapão abre quando os quatro caem.",
        aprende: "Ler a sala antes de agir; lutar recuando para a saída conhecida; o Brutamonte inquebrável; por que preparar na Botica antes (Unguento para a arena, sem Descanso lá).",
      },
      tags: ["ember:modo: vigília", "frost:4 mortos, depois da estilha", "gold:beat: luto"],
    },
    {
      n: 6, id: "c6", nome: "Forja da Primeira Fagulha", sub: "a verdade se monta (rocha vulcânica, fissuras, a Brasa visível)",
      halfX: 12, halfZ: 18,
      hazard: [{ x0: -12, x1: -9, z0: -18, z1: 13, kind: "fissura", key: "fissura de brasa (3 m de zona quente): a Brasa visível lá embaixo; pulsa no ritmo dela; empurra a luta para o centro" }, { x0: 9, x1: 12, z0: -18, z1: 13, kind: "fissura" }],
      calm: { cx: 0, cz: -2, rx: 6.5, rz: 11 },
      pillars: [{ x: -6, z: -10 }, { x: 6, z: -10 }, { x: -6, z: 0 }, { x: 6, z: 0 }],
      marks: [
        { x: -7, z: 6, kind: "forja", key: "forja oeste (bigorna fria): plataforma elevada, cobertura" },
        { x: 7, z: 6, kind: "forja", key: "forja leste (fornalha morta): o posto do Arqueiro" },
        { x: -6, z: 16, kind: "tumulo", key: "túmulo de fundadora (selado)" }, { x: 0, z: 16, kind: "tumulo", open: true, key: "túmulo aberto: a Sentinela se levanta daqui na onda 2" }, { x: 6, z: 16, kind: "tumulo", key: "túmulo de fundadora (selado)" },
      ],
      relic: { x: 0, z: 9.4 }, hatch: { x: 7.5, z: 12.2 },
      enemies: [
        { x: 0, z: 1, kind: "guerreiro", key: "onda 1, na frente" }, { x: -5, z: -3, kind: "ladino", key: "onda 1, flanco" }, { x: 7, z: 7.8, kind: "arqueiro", key: "onda 1, da forja leste" },
        { x: 0, z: 14.2, kind: "sentinela", wave: 2, key: "onda 2 (quando a 1a cai): levanta do túmulo vestindo um manto igual ao da Acendedora; mini-chefe, postura 95, inquebrável" }, { x: -7, z: 7.8, kind: "espreitador", wave: 2, key: "onda 2, sai da forja oeste" },
      ],
      antessala: { nome: "A6 A Casa da Ordem", oficio: "ambos", h: 18 },
      props: {
        proposito: "O pré-chefe: ela luta contra uma que foi como ela. Duas ondas dão à Sentinela uma entrada só dela. As fissuras laterais mostram a Brasa lá embaixo e esquentam a borda: a luta é empurrada para o centro.",
        planta: "Nave 24 x 36 com fissuras de brasa ao longo das paredes, duas forjas elevadas a meio caminho e três túmulos das fundadoras na parede norte; o do meio se abre na onda 2. Alçapão a nordeste, passando pela forja.",
        inimigos: "Onda 1: Guerreiro e Ladino na frente, Arqueiro na forja leste. Onda 2: a Sentinela-Acendedora e um Espreitador da forja oeste.",
        aprende: "Esquivar o inquebrável e punir a recuperação; ritmo de mini-chefe antes do Guardião; o custo humano do que ela é (uma Acendedora caída).",
      },
      tags: ["frost:2 ondas, Sentinela-Acendedora", "ember:fissura quente", "gold:beat: a verdade"],
    },
    {
      n: 7, id: "c7", nome: "Câmara da Brasa", sub: "o confronto (obsidiana, cratera, a arena encolhe)",
      halfX: 18, halfZ: 18,
      rings: [{ half: 14.5, label: "fase 2: 14,5 m" }, { half: 11, label: "fase 3: 11 m" }],
      calm: { cx: 0, cz: 0, rx: 10.5, rz: 10.5 },
      pillars: [{ x: -14, z: -14, broken: true }, { x: 14, z: -14 }, { x: -14, z: 14 }, { x: 14, z: 14, broken: true }],
      marks: [
        { x: -8, z: 12, kind: "braseiro_frio", key: "braseiro frio das fundadoras (memória; não acende)" }, { x: 8, z: 12, kind: "braseiro_frio" },
        { x: 0, z: -8.5, kind: "guardia", bdx: 2.3, bdz: 1.6, key: "a Guardiã (Primeira Acendedora), ajoelhada diante da Brasa, de costas para a porta; fala antes de atacar, sussurra ao cair" },
      ],
      relic: { x: 0, z: 0 }, hatch: null,
      enemies: [],
      antessala: { nome: "A7 O Limiar", oficio: null, extra: (x0, x1, z0, z1, cx, id) => rect(x1 - 4.4, x1 - 1.2, z0 + 8.2, z0 + 9.8, "pl-hot", `fill="url(#${id}-ember)"`) + markIcon({ kind: "grade", x: x1 - 2.8, z: z0 + 9 }) },
      props: {
        proposito: "O clímax aprovado: a Brasa moribunda no centro (relicário final), a Guardiã ajoelhada diante dela, a arena que encolhe nas fases 2 e 3 (spec cenário vivo). A antessala do Limiar é a última chance de preparar; o mural mostra quem é ela antes de ela se virar, e uma grade no chão deixa ver a Brasa lá embaixo.",
        planta: "Arena 36 x 36 com a Brasa no centro (numa cratera baixa) e anéis que cedem: 18 m, 14,5 m, 11 m. Quatro pilares nos cantos, dois quebrados. Nenhum alçapão: o fim do poço.",
        inimigos: "Só a Guardiã: 3 fases por vida + gangorra de luz (reacender a Brasa cambaleia). Fala uma frase antes de atacar; sussurra a verdade ao cair.",
        aprende: "Tudo o que a descida ensinou: ler, esquivar o inquebrável, usar a luz (reacender) e o espaço que encolhe. O que trouxe do Limiar é o que tem.",
      },
      tags: ["ember:set piece: arena que encolhe", "frost:Guardiã", "gold:beat: o confronto"],
    },
  ];

  // ------------------------------------------------------------------ cartão
  function card(d) {
    const { svg, key } = chamber(d);
    const tags = (d.tags || []).map((t) => { const [c, l] = t.split(":"); return `<span class="tag ${c}">${l}</span>`; }).join("");
    const dl = Object.entries(d.props).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
    const items = key.filter((k) => !k.fixed).map((k) => `<li><span class="kn ${k.kind.replace(/\s/g, "-")}">${k.n}</span><span><em>${k.kind}</em> ${k.t}</span></li>`).join("");
    return `<section class="panel plan" id="${d.id}">
      <div>${svg}</div>
      <div>
        <div class="head"><span class="num">${d.n}</span><div><h3>${d.nome}</h3><div class="sub">${d.sub}</div></div></div>
        <dl>${dl}</dl>
        <div class="tags">${tags}</div>
        <h4 class="keyhead">Chave da planta</h4>
        <ol class="key">${items}</ol>
      </div>
    </section>`;
  }

  // Legenda dos símbolos fixos (comum às plantas).
  function legend() {
    const id = "lg";
    const sw = (inner, vb) => `<svg viewBox="${vb || "-3.2 -3.2 6.4 6.4"}" xmlns="http://www.w3.org/2000/svg">${defs(id)}${inner}</svg>`;
    const items = [
      [sw(`<ellipse class="pl-calm-glow" cx="0" cy="0" rx="2.8" ry="2" fill="url(#${id}-ember)"/><ellipse class="pl-calm" cx="0" cy="0" rx="2.8" ry="2"/>`), "faixa de combate: a poça de luz onde a luta acontece; sem cenografia 3D, piso atenuado"],
      [sw(stoneFloor(-3, 3, -3, 3, 5, true)), "piso da antessala (patamar seguro); o da câmara é mais escuro"],
      [sw(relic(0, 0, id)), "relicário com a estilha (abre quando a câmara limpa)"],
      [sw(hatch(0, 0, id), "-3.6 -3.6 7.2 7.2"), "alçapão do poço: escada em caracol para a antessala seguinte"],
      [sw(rect(-2.6, 2.6, -1.6, 1.6, "pl-wall") + stoneDoor(0, 0)), "porta de pedra no muro (sela atrás)"],
      [sw(heroToken(0, 0, id)), "a Acendedora (entra por aqui)"],
      [sw(enemy({ x: 0, z: 0, kind: "guerreiro" }, id)), "morto desperto (o busto diz o tipo; o número remete à chave)"],
      [sw(enemy({ x: 0, z: 0, kind: "brutamonte", wave: 2 }, id)), "anel tracejado: onda 2 (acorda quando a 1a cai, ou depois da estilha)"],
      [sw(enemy({ x: 0, z: 0, kind: "espreitador", amb: true }, id)), "anel pontilhado: emboscada avisada (o mural a mostrou)"],
      [sw(pillar({ x: -1.3, z: 0 }, id) + pillar({ x: 1.6, z: 0, broken: true }, id)), "pilar (cobertura) e pilar quebrado"],
      [sw(pillar({ x: 0, z: 0, move: 2 }, id), "-3.2 -3.6 6.4 7.2"), "coluna que desliza (setas = curso)"],
      [sw(rect(-2.6, 2.6, -1.5, 1.5, "pl-water", `fill="url(#${id}-water)"`) + rect(-2.6, 2.6, -1.5, 1.5, "pl-water-edge")), "água rasa (decorativa; atenua passos)"],
      [sw(rect(-2.6, 2.6, -1.5, 1.5, "pl-hot", `fill="url(#${id}-ember)" opacity="0.55"`) + rect(-2.6, 2.6, -1.5, 1.5, "pl-hazard", `fill="url(#${id}-hz)"`)), "zona quente (fissura, grade): dano a quem fica parado"],
      [sw(rect(-2.6, 2.6, -1.5, 1.5, "pl-platform") + rect(-2.1, 2.1, -1, 1, "pl-platform-top")), "plataforma elevada (posto de atirador)"],
      [sw(rect(-2.8, 2.8, -0.4, 0.4, "pl-mural") + rect(-2.65, 2.65, -0.25, 0.25, "pl-mural-in", `fill="url(#${id}-hg)"`)), "M: parede-mural (painel 'o que foi' e painel 'o que vem')"],
      [sw(rect(-0.6, 0.6, -2.1, 2.1, "pl-furn") + rect(-0.6, 0.6, -2.1, 2.1, "pl-furn-life") + rect(-0.4, 0.4, 0.6, 1.4, "pl-nicho") + rect(-0.4, 0.4, -1.4, -0.6, "pl-nicho")), "A: armário de poções (4 nichos)"],
      [sw(circle(0, 0, 1.05, "pl-brazier") + circle(0, 0, 0.75, "pl-brazier-bowl") + flame(0, 0.55, 1.5, 0.5, "pl-flame-glow") + flame(0, 0.55, 1.3, 0.42, "pl-flame")), "B: braseiro da antessala (acender: cura, mural, chama)"],
      [sw(rect(-0.6, 0.6, -2.1, 2.1, "pl-furn") + rect(-0.6, 0.6, -2.1, 2.1, "pl-furn-gold") + line(-0.45, -1.5, 0.45, -1.5, "pl-book") + line(-0.45, -0.8, 0.45, -0.8, "pl-book") + line(-0.45, 0, 0.45, 0, "pl-book") + line(-0.45, 0.8, 0.45, 0.8, "pl-book")), "O: ofício da antessala (Estante ou Bancada)"],
      [sw(rect(-2.4, 0.8, -1.2, 1.2, "pl-stairwell", `fill="url(#${id}-pit)"`) + line(-2.4, -0.6, 0.8, -0.6, "pl-step") + line(-2.4, 0, 0.8, 0, "pl-step") + line(-2.4, 0.6, 0.8, 0.6, "pl-step")), "E: boca da escada por onde a Acendedora chega"],
      [sw(rect(-3, 3, -3, 3, "pl-ring") + rect(-1.6, 1.6, -1.6, 1.6, "pl-ring")), "anéis da arena que cedem (fases 2 e 3)"],
      [sw(line(-2.8, 0.8, 2.8, 0.8, "pl-band") + line(-2.8, -0.8, 2.8, -0.8, "pl-band")), "faixas de 6 m que cedem (Instabilidade)"],
    ];
    return `<div class="legend">${items.map(([i, t]) => `<div>${i}<span>${t}</span></div>`).join("")}</div>`;
  }

  // Antessala isolada (página própria), com chave fixa.
  function antessalaSolo(a) {
    uid++;
    const id = `pl${uid}`;
    const w = a.w || 12, h = a.h || 12;
    const vb = `${R(-w / 2 - 2.4)} ${R(-(h / 2) - 2.6)} ${R(w + 4.8)} ${R(h + 5.6)}`;
    let s = `<svg class="plan-svg" viewBox="${vb}" style="--fs:0.5" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${a.nome}">${defs(id)}`;
    s += `<rect class="pl-bg" x="${R(-w / 2 - 2.4)}" y="${R(-(h / 2) - 2.6)}" width="${R(w + 4.8)}" height="${R(h + 5.6)}"/>`;
    s += antessala(a, -w / 2, h / 2, id);
    s += stoneDoor(0, h / 2);
    s += compass(w / 2 + 1.5, -h / 2 + 1.4) + scaleBar(-w / 2, -h / 2 - 1.4);
    s += "</svg>";
    return s;
  }

  window.PLANOS = { CAMARAS, card, legend, chamber, antessalaSolo, glyph, GL, LETRA, NOME, flame, star };

  // ------------------------------------------------------------------ estilo (só tokens)
  const css = `
  .plan-svg text { font-family: var(--font-text); }
  .pl-bg { fill: var(--ink-950); }
  .pl-floor { fill: var(--ink-800); }
  .pl-floor.safe { fill: var(--ink-700); }
  .pl-floor-fill { fill: var(--ink-800); }
  .pl-tile { fill: var(--text-hi); }
  .pl-joint { stroke: var(--ink-950); stroke-width: 0.14; stroke-opacity: 0.8; }
  .pl-chip { stroke: var(--ink-950); stroke-width: 0.08; stroke-opacity: 0.6; stroke-linecap: round; }
  .pl-wall-shadow { fill: none; stroke: var(--ink-950); stroke-width: 1.7; stroke-opacity: 0.85; }
  .pl-wall { fill: none; stroke: var(--ink-500); stroke-width: 1.0; }
  .pl-wall-inner { fill: none; stroke: var(--gold-700); stroke-width: 0.12; stroke-opacity: 0.9; }
  .pl-open { stroke: var(--ink-800); stroke-width: 1.8; }
  .pl-water { }
  .pl-water-edge { fill: none; stroke: var(--frost-500); stroke-width: 0.08; stroke-opacity: 0.8; }
  .pl-hot { }
  .pl-hazard { stroke: var(--ember-600); stroke-width: 0.1; }
  .pl-hatch { stroke: var(--ember-600); stroke-width: 0.22; stroke-opacity: 0.9; }
  .pl-hatch-gold { stroke: var(--gold-700); stroke-width: 0.18; }
  .pl-fissure { fill: none; stroke: var(--ember-300); stroke-width: 0.22; stroke-linejoin: round; }
  .pl-fissure-glow { fill: none; stroke: var(--ember-500); stroke-width: 0.9; }
  .pl-platform { fill: var(--ink-600); stroke: var(--ink-950); stroke-width: 0.3; }
  .pl-platform-top { fill: var(--ink-500); stroke: var(--gold-700); stroke-width: 0.1; }
  .pl-calm-glow { opacity: 0.55; }
  .pl-calm { fill: none; stroke: var(--ember-400); stroke-width: 0.14; stroke-dasharray: 0.5 0.6; stroke-opacity: 0.8; }
  .pl-pillar-shadow { fill: var(--ink-950); fill-opacity: 0.7; }
  .pl-pillar { stroke: var(--gold-600); stroke-width: 0.12; }
  .pl-pillar.broken { stroke-dasharray: none; }
  .pl-rubble { fill: var(--ink-500); stroke: var(--ink-950); stroke-width: 0.06; }
  .pl-move { stroke: var(--ember-300); stroke-width: 0.16; fill: none; }
  .pl-move-glow { stroke: var(--ember-500); stroke-width: 0.6; stroke-opacity: 0.45; }
  .pl-glow-ember, .pl-glow-frost { }
  .pl-dais { fill: var(--ink-600); stroke: var(--ink-950); stroke-width: 0.2; }
  .pl-dais-step { fill: var(--ink-500); stroke: var(--gold-700); stroke-width: 0.08; }
  .pl-dais-top { fill: var(--ink-700); stroke: var(--gold-600); stroke-width: 0.08; }
  .pl-relic-halo { fill: var(--ember-500); fill-opacity: 0.55; }
  .pl-relic { fill: var(--ember-200); }
  .pl-hatch-rim { fill: var(--ink-600); stroke: var(--ink-950); stroke-width: 0.25; }
  .pl-hatch-pit { }
  .pl-hatch-ring { fill: none; stroke: var(--ember-400); stroke-width: 0.18; stroke-dasharray: 0.7 0.45; }
  .pl-step { fill: none; stroke: var(--gold-500); stroke-width: 0.1; stroke-opacity: 0.9; }
  .pl-stairwell { }
  .pl-stairwell-rim { fill: none; stroke: var(--gold-700); stroke-width: 0.12; }
  .pl-door { fill: var(--gold-500); }
  .pl-door-hi { fill: var(--gold-300); }
  .pl-door-knob { fill: var(--ink-950); }
  .pl-link { fill: var(--ink-800); stroke: var(--gold-700); stroke-width: 0.1; }
  .pl-token { fill: var(--ink-950); stroke: var(--frost-300); stroke-width: 0.2; }
  .pl-token.hero { stroke: var(--gold-300); }
  .pl-token.boss { stroke: var(--frost-300); stroke-width: 0.26; }
  .pl-token-outer { fill: none; stroke: var(--frost-500); stroke-width: 0.14; }
  .pl-token-outer.w2 { stroke-dasharray: 0.7 0.4; }
  .pl-token-outer.amb { stroke-dasharray: 0.18 0.28; stroke: var(--gold-400); }
  .pl-badge { fill: var(--gold-400); stroke: var(--ink-950); stroke-width: 0.12; }
  .pl-badge-t { fill: var(--ink-950); font-family: var(--font-display); font-weight: 700; font-size: calc(1.05px * var(--fs, 1)); }
  .pl-tag { fill: var(--ink-950); stroke: var(--gold-500); stroke-width: 0.1; }
  .pl-tag-t { fill: var(--gold-200); font-family: var(--font-display); font-weight: 700; font-size: calc(0.85px * var(--fs, 1)); }
  .pl-mark { fill: var(--gold-400); stroke: var(--gold-200); stroke-width: 0.08; }
  .pl-ic { fill: none; stroke: var(--gold-300); stroke-width: 0.12; stroke-linejoin: round; stroke-linecap: round; }
  .pl-ic-fine { fill: none; stroke: var(--gold-500); stroke-width: 0.08; stroke-linecap: round; }
  .pl-ic-fill { fill: var(--ink-600); }
  .pl-ic-hatch { fill: none; stroke: var(--gold-600); stroke-width: 0.07; }
  .pl-ic-ember { fill: none; stroke: var(--ember-400); stroke-width: 0.14; stroke-linecap: round; }
  .pl-ic-ember-fill { fill: var(--ember-500); fill-opacity: 0.55; }
  .pl-ic-grid { fill: none; stroke: var(--ink-950); stroke-width: 0.12; }
  .pl-ic-dead { fill: var(--ink-950); stroke: var(--frost-500); stroke-width: 0.1; }
  .pl-ic-bone { fill: var(--text-hi); }
  .pl-ic-frost { fill: none; stroke: var(--frost-300); stroke-width: 0.14; stroke-linecap: round; }
  .pl-lab { fill: var(--text-mid); font-size: calc(1.05px * var(--fs, 1)); }
  .pl-lab.tiny { font-size: calc(0.8px * var(--fs, 1)); fill: var(--text-lo); font-family: var(--font-display); letter-spacing: 0.06px; }
  .pl-lab.tiny.ember { fill: var(--ember-300); } .pl-lab.tiny.frost { fill: var(--frost-300); }
  .pl-title { fill: var(--gold-200); font-family: var(--font-display); font-size: calc(1.7px * var(--fs, 1)); letter-spacing: 0.1px; }
  .pl-title.safe { fill: var(--gold-300); font-size: calc(1.25px * var(--fs, 1)); }
  .pl-band { stroke: var(--ember-600); stroke-width: 0.1; stroke-dasharray: 0.4 0.4; stroke-opacity: 0.9; }
  .pl-ring { fill: none; stroke: var(--frost-300); stroke-width: 0.16; stroke-dasharray: 0.9 0.5; stroke-opacity: 0.9; }
  .pl-brazier-shadow { fill: var(--ink-950); }
  .pl-brazier { fill: var(--ink-500); stroke: var(--gold-600); stroke-width: 0.1; }
  .pl-brazier-bowl { fill: var(--ember-600); }
  .pl-flame-glow { fill: var(--ember-500); fill-opacity: 0.45; }
  .pl-flame { fill: var(--ember-300); }
  .pl-flame-core { fill: var(--ember-200); }
  .pl-furn { fill: var(--ink-950); }
  .pl-furn-life { fill: none; stroke: var(--life-400); stroke-width: 0.12; }
  .pl-furn-gold { fill: none; stroke: var(--gold-300); stroke-width: 0.12; }
  .pl-nicho { fill: var(--ink-700); stroke: var(--ink-500); stroke-width: 0.05; }
  .pl-bottle { fill: var(--life-400); } .pl-bottle.ember { fill: var(--ember-400); } .pl-bottle.gold { fill: var(--gold-300); }
  .pl-book { stroke: var(--gold-400); stroke-width: 0.14; }
  .pl-candle { fill: var(--text-hi); }
  .pl-mural { fill: var(--gold-500); }
  .pl-mural-in { }
  .pl-mural-light { fill: var(--gold-300); fill-opacity: 0.35; }
  .pl-compass { fill: var(--gold-400); }
  .pl-scale { stroke: var(--text-lo); stroke-width: 0.1; }
  .pl-s-e1 { stop-color: var(--ember-300); stop-opacity: 0.6; } .pl-s-e2 { stop-color: var(--ember-500); stop-opacity: 0.22; } .pl-s-e3 { stop-color: var(--ember-600); stop-opacity: 0; }
  .pl-s-f1 { stop-color: var(--frost-300); stop-opacity: 0.35; } .pl-s-f2 { stop-color: var(--frost-500); stop-opacity: 0; }
  .pl-s-p1 { stop-color: var(--ink-950); } .pl-s-p2 { stop-color: var(--ink-950); } .pl-s-p3 { stop-color: var(--ink-600); }
  .pl-s-pl1 { stop-color: var(--ink-500); } .pl-s-pl2 { stop-color: var(--ink-700); }
  .pl-s-w1 { stop-color: var(--frost-500); stop-opacity: 0.45; } .pl-s-w2 { stop-color: var(--frost-300); stop-opacity: 0.2; }
  /* bustos (gravura): traço ouro; o que ameaça em gelo; só o fogo em laranja */
  .gb .gb-body { fill: var(--ink-950); stroke: var(--gold-300); stroke-width: 1.6; stroke-linejoin: round; }
  .gb .gb-void { fill: var(--ink-950); stroke: var(--gold-500); stroke-width: 0.9; }
  .gb .gb-eye { fill: var(--gold-300); }
  .gb .gb-fine { fill: none; stroke: var(--gold-300); stroke-width: 1.3; stroke-linecap: round; stroke-linejoin: round; }
  .gb .gb-crest { fill: var(--gold-300); }
  .gb .gb-shield { fill: var(--ink-950); stroke: var(--gold-300); stroke-width: 1.4; }
  .gb .gb-ember { fill: var(--ember-400); }
  .gb .gb-ember-star { fill: var(--ember-300); }
  .gb .gb-dead { fill: var(--ink-950); stroke: var(--frost-300); stroke-width: 1; }
  .gb .gb-slab { fill: none; stroke: var(--gold-300); stroke-width: 1.5; stroke-linejoin: round; stroke-linecap: round; }
  .gb .gb-ember-l { fill: none; stroke: var(--ember-400); stroke-width: 1.7; stroke-linejoin: round; stroke-linecap: round; }
  .gb .gb-frost-l { fill: none; stroke: var(--frost-300); stroke-width: 1.6; stroke-linecap: round; }
  .gb.frost .gb-body { stroke: var(--frost-300); } .gb.frost .gb-fine { stroke: var(--frost-300); } .gb.frost .gb-eye { fill: var(--frost-300); } .gb.frost .gb-crest { fill: var(--frost-300); } .gb.frost .gb-shield { stroke: var(--frost-300); } .gb.frost .gb-void { stroke: var(--frost-500); }
  .gb.gold .gb-body { stroke: var(--gold-200); }
  `;
  const st = document.createElement("style");
  st.textContent = css;
  document.head.appendChild(st);
})();
