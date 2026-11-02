/**
 * CAMADA JOGO. DESIGN SYSTEM, parte 4: GRAVURAS. Xilogravuras procedurais em SVG para a
 * Crônica (ouro sobre preto), no mesmo padrão de `icons.ts`: uma função por placa que
 * devolve a string SVG. Tela 400x500 (retrato). Nenhuma cor é escrita aqui: o traço e o
 * preenchimento vêm de classes `.gv-*` (em `illustrations.css`) que apontam só para tokens.
 *
 * Cada gravura monta o seu próprio `<defs>` com ids únicos por instância. Assim o desenho
 * não depende de um `<defs>` global e continua certo quando a tela pai está oculta
 * (`display: none` quebra a referência de padrões e gradientes dentro dela).
 * Strings estáticas, sem entrada do usuário.
 */
import "./illustrations.css";

export type IllustrationId =
  | "cinza"
  | "marta"
  | "guardia"
  | "mortos"
  | "manto"
  | "eco"
  | "preco"
  | "duas"
  | "poco"
  | "brasa"
  | "frio"
  | "fagulha"
  | "braseiro";

let uid = 0;
/** Prefixo dos ids de `<defs>` da gravura em construção (as funções abaixo são síncronas). */
let ns = "";
const ref = (name: string): string => `url(#${ns}${name})`;

const r = (n: number): number => Math.round(n * 10) / 10;
/** Pseudo-aleatório determinístico: as gravuras nunca mudam entre cargas. */
const rnd = (i: number): number => {
  const x = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

function defs(): string {
  return (
    "<defs>" +
    `<pattern id="${ns}hg" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(40)"><line class="gv-pg" x1="0" y1="0" x2="0" y2="6"/></pattern>` +
    `<pattern id="${ns}hf" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(-35)"><line class="gv-pf" x1="0" y1="0" x2="0" y2="5"/></pattern>` +
    `<pattern id="${ns}he" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(55)"><line class="gv-pe" x1="0" y1="0" x2="0" y2="5"/></pattern>` +
    `<radialGradient id="${ns}ge"><stop offset="0" class="gv-s-e1"/><stop offset=".35" class="gv-s-e2"/><stop offset="1" class="gv-s-e3"/></radialGradient>` +
    `<radialGradient id="${ns}gf"><stop offset="0" class="gv-s-f1"/><stop offset="1" class="gv-s-f2"/></radialGradient>` +
    "</defs>"
  );
}

function rays(cx: number, cy: number, n: number, r0: number, r1: number, cls: string, seed = 0): string {
  let out = "";
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + seed;
    const len = r0 + (r1 - r0) * (0.45 + 0.55 * rnd(i + seed * 7));
    out += `<line class="${cls}" x1="${r(cx + Math.cos(a) * r0)}" y1="${r(cy + Math.sin(a) * r0)}" x2="${r(cx + Math.cos(a) * len)}" y2="${r(cy + Math.sin(a) * len)}"/>`;
  }
  return out;
}

function flame(cx: number, by: number, h: number, w: number, cls: string): string {
  return (
    `<path class="${cls}" d="M${cx - w} ${by} C${cx - w} ${r(by - h * 0.42)} ${r(cx - w * 0.25)} ${r(by - h * 0.5)} ${cx} ${by - h}` +
    ` C${r(cx + w * 0.25)} ${r(by - h * 0.5)} ${cx + w} ${r(by - h * 0.42)} ${cx + w} ${by}Z"/>`
  );
}

function star(cx: number, cy: number, s: number, cls: string): string {
  return (
    `<path class="${cls}" d="M${cx} ${cy - s} L${r(cx + s * 0.22)} ${r(cy - s * 0.22)} L${cx + s} ${cy} L${r(cx + s * 0.22)} ${r(cy + s * 0.22)}` +
    ` L${cx} ${cy + s} L${r(cx - s * 0.22)} ${r(cy + s * 0.22)} L${cx - s} ${cy} L${r(cx - s * 0.22)} ${r(cy - s * 0.22)}Z"/>`
  );
}

function glow(cx: number, cy: number, rr: number, id = "ge"): string {
  return `<circle class="gv-glow" cx="${cx}" cy="${cy}" r="${rr}" fill="${ref(id)}"/>`;
}

function frostFern(x: number, y: number, len: number, dir: number): string {
  let out = `<path class="gv-fl" d="M${x} ${y} l${dir * len * 0.2} ${-len}"/>`;
  for (let i = 1; i < 6; i++) {
    const px = x + dir * len * 0.2 * (i / 6);
    const py = y - len * (i / 6);
    out += `<path class="gv-ft" d="M${r(px)} ${r(py)} l-14 -9 M${r(px)} ${r(py)} l14 -9"/>`;
  }
  return out;
}

const PLATES: Record<IllustrationId, () => string> = {
  // A Acendedora: capuz, manto, espada cravada no chão com a fagulha no pomo, degraus descendo.
  cinza: () =>
    rays(200, 285, 44, 30, 340, "gv-lh", 0.2) + glow(200, 285, 170) +
    '<path class="gv-l" d="M0 438 H150 V456 H96 V474 H40 V492 H0"/><path class="gv-lt" d="M0 456 H80 M0 474 H30"/>' +
    '<path class="gv-mid" d="M290 204 L302 204 L305 436 L296 458 L287 436Z"/><path class="gv-l" d="M290 204 L302 204 L305 436 L296 458 L287 436Z"/><path class="gv-lt" d="M296 212 V440"/>' +
    '<path class="gv-l" d="M270 204 H322" style="stroke-width:6"/><path class="gv-l" d="M296 204 V170" style="stroke-width:5"/>' + glow(296, 158, 52) + star(296, 158, 20, "gv-e3") + star(296, 158, 20, "gv-elt") +
    '<path class="gv-mid" d="M200 140 C168 140 146 168 150 206 C146 236 118 276 104 446 L306 446 C 290 276 254 236 250 206 C254 168 232 140 200 140Z"/>' +
    `<path fill="${ref("hg")}" d="M200 140 C168 140 146 168 150 206 C146 236 118 276 104 446 L196 446 C 190 340 190 240 196 180Z"/>` +
    '<path class="gv-l" d="M200 140 C168 140 146 168 150 206 C146 236 118 276 104 446 L306 446 C 290 276 254 236 250 206 C254 168 232 140 200 140Z"/>' +
    '<path class="gv-lt" d="M150 270 C142 330 130 390 124 446 M176 300 C172 350 168 400 166 446 M236 296 C242 350 250 400 256 446 M262 270 C270 330 282 390 286 446"/>' +
    '<path class="gv-void" d="M200 160 C180 162 172 184 174 206 C176 230 190 242 200 242 C210 242 224 230 226 206 C228 184 220 162 200 160Z"/>' +
    '<path class="gv-lm" d="M200 160 C180 162 172 184 174 206 C176 230 190 242 200 242 C210 242 224 230 226 206 C228 184 220 162 200 160Z"/>' +
    '<path class="gv-lt" d="M186 210 h8 M206 210 h8"/>' +
    glow(200, 300, 46) + '<circle class="gv-e2" cx="200" cy="300" r="11"/><circle class="gv-e3" cx="200" cy="300" r="5"/>',

  // Marta: encolhida num xale diante de uma janela de geada, com um braseirinho quase apagado.
  marta: () => {
    let snow = "";
    for (let i = 0; i < 40; i++) snow += `<circle class="gv-bm" cx="${r(rnd(i) * 400)}" cy="${r(rnd(i + 90) * 500)}" r="${r(0.8 + rnd(i + 5) * 1.6)}" opacity=".55"/>`;
    return (
      glow(100, 210, 200, "gf") +
      `<path fill="${ref("hf")}" d="M42 300 L130 300 L330 470 L120 470Z" opacity=".7"/>` +
      '<path class="gv-void" d="M36 330 V118 A58 58 0 0 1 152 118 V330Z"/>' +
      '<path class="gv-fl" d="M36 330 V118 A58 58 0 0 1 152 118 V330Z"/><path class="gv-ft" d="M94 60 V330 M36 190 H152"/>' +
      frostFern(52, 326, 90, 1) + frostFern(136, 326, 70, -1) + frostFern(70, 190, 50, 1) +
      snow +
      '<path class="gv-lt" d="M0 440 H400 M0 462 H400 M0 486 H400"/>' +
      '<path class="gv-mid" d="M258 258 C214 262 196 304 202 352 L186 446 H350 L342 348 C348 298 306 252 258 258Z"/>' +
      `<path fill="${ref("hf")}" d="M258 258 C214 262 196 304 202 352 L186 446 H270 C262 380 262 300 262 262Z"/>` +
      '<path class="gv-l" d="M258 258 C214 262 196 304 202 352 L186 446 H350 L342 348 C348 298 306 252 258 258Z"/>' +
      '<path class="gv-lt" d="M214 330 C230 370 238 410 240 446 M300 320 C310 370 316 410 318 446"/>' +
      '<circle class="gv-void" cx="272" cy="232" r="25"/><path class="gv-l" d="M248 236 C246 206 270 196 288 206 C300 214 300 232 296 244"/>' +
      '<path class="gv-lt" d="M262 238 l8 2 M280 238 l8 2"/>' +
      '<path class="gv-void" d="M238 346 h56 l-8 22 h-40z"/><path class="gv-lm" d="M238 346 h56 l-8 22 h-40z"/>' +
      glow(266, 340, 40) + '<circle class="gv-e" cx="266" cy="342" r="6"/><circle class="gv-e3" cx="266" cy="342" r="2.5"/>'
    );
  },

  // A Primeira: silhueta de braços abertos dentro das chamas, coroa de fogo.
  guardia: () =>
    rays(200, 260, 56, 60, 360, "gv-elt", 0.1) + glow(200, 260, 230) +
    flame(200, 450, 400, 104, "gv-e0") + flame(124, 450, 290, 64, "gv-e") + flame(276, 450, 300, 66, "gv-e") +
    flame(200, 450, 330, 70, "gv-e2") + flame(200, 450, 230, 40, "gv-e3") +
    '<path class="gv-el" d="M200 50 C204 86 232 100 236 140"/>' +
    '<path class="gv-void" d="M200 150 C182 150 172 166 174 182 C160 200 150 230 118 330 L146 340 L170 270 C168 340 164 400 160 450 L240 450 C236 400 232 340 230 270 L254 340 L282 330 C250 230 240 200 226 182 C228 166 218 150 200 150Z"/>' +
    '<path class="gv-l" d="M200 150 C182 150 172 166 174 182 C160 200 150 230 118 330 L146 340 L170 270 C168 340 164 400 160 450 L240 450 C236 400 232 340 230 270 L254 340 L282 330 C250 230 240 200 226 182 C228 166 218 150 200 150Z"/>' +
    '<path class="gv-el" d="M176 150 L170 118 L186 138 L192 104 L200 134 L208 104 L214 138 L230 118 L224 150"/>' +
    glow(200, 330, 60) + '<circle class="gv-e3" cx="200" cy="330" r="10"/>' +
    '<path class="gv-lt" d="M178 200 h12 M210 200 h12"/>',

  // Os mortos selados: nichos em arco com os mortos de pé e um túmulo arrombado por dentro.
  mortos: () => {
    let out = glow(200, 520, 280, "gf");
    const xs = [28, 160, 292];
    const ys = [52, 238];
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 3; col++) {
        const x = xs[col]!;
        const y = ys[row]!;
        const broken = row === 1 && col === 1;
        const arch = `M${x} ${y + 150} V${y + 44} A40 40 0 0 1 ${x + 80} ${y + 44} V${y + 150}Z`;
        out += `<path class="gv-void" d="${arch}"/><path class="gv-lm" d="${arch}"/>`;
        if (broken) {
          out +=
            `<path class="gv-lt" d="M${x + 12} ${y + 150} L${x + 30} ${y + 100} L${x + 18} ${y + 70} M${x + 68} ${y + 150} L${x + 52} ${y + 108} L${x + 62} ${y + 76}"/>` +
            `<path class="gv-fl" d="M${x + 8} ${y + 150} l-26 8 M${x + 72} ${y + 150} l30 6 M${x + 40} ${y + 150} l-4 14"/>` +
            glow(x + 40, y + 108, 34);
        } else {
          const cx = x + 40;
          out +=
            `<path class="gv-mid" d="M${cx - 14} ${y + 144} V${y + 72} a14 14 0 0 1 28 0 V${y + 144}Z"/>` +
            `<path class="gv-lt" d="M${cx - 14} ${y + 90} h28 M${cx - 14} ${y + 106} h28 M${cx - 14} ${y + 122} h28"/>` +
            `<path fill="${ref("hf")}" d="M${cx - 14} ${y + 144} V${y + 72} a14 14 0 0 1 28 0 V${y + 144}Z" opacity=".8"/>`;
        }
      }
    }
    out += '<path class="gv-l" d="M10 440 H390 M10 462 H390"/>';
    for (let i = 0; i < 26; i++) out += `<path class="gv-lt" d="M${r(18 + i * 14.4)} 446 l${r((rnd(i) - 0.5) * 3)} ${r(8 + rnd(i + 9) * 8)}"/>`;
    return out + '<path class="gv-lh" d="M0 484 H400 M0 496 H400"/>';
  },

  // O manto rasgado: manto no chão em perspectiva, com a fagulha apagada ao lado.
  manto: () => {
    let floor = "";
    for (let i = 0; i < 9; i++) floor += `<path class="gv-ld" d="M${r(200 + (i - 4) * 14)} 290 L${r(200 + (i - 4) * 90)} 500"/>`;
    for (let j = 0; j < 6; j++) floor += `<path class="gv-ld" d="M0 ${r(300 + j * j * 6.4)} H400"/>`;
    return (
      `<path fill="${ref("hg")}" d="M262 0 H340 L300 380 H180Z" opacity=".55"/><path class="gv-lh" d="M262 0 L180 380 M340 0 L300 380"/>` +
      floor +
      '<path class="gv-mid" d="M92 390 L128 336 L190 322 L214 346 L262 318 L318 340 L330 392 L300 430 L236 412 L196 438 L140 426Z"/>' +
      `<path fill="${ref("hg")}" d="M92 390 L128 336 L190 322 L214 346 L240 330 L236 412 L196 438 L140 426Z"/>` +
      '<path class="gv-l" d="M92 390 L128 336 L190 322 L214 346 L262 318 L318 340 L330 392 L300 430 L236 412 L196 438 L140 426Z"/>' +
      '<path class="gv-void" d="M196 340 L214 366 L200 378 L226 398 L206 420 L188 392 L204 380 L184 362Z"/>' +
      '<path class="gv-lm" d="M196 340 L214 366 L200 378 L226 398 L206 420 L188 392 L204 380 L184 362Z"/>' +
      '<circle class="gv-void" cx="298" cy="458" r="14"/><circle class="gv-blm" cx="298" cy="458" r="14"/><path class="gv-blm" d="M290 450 l16 16 M306 450 l-16 16"/>' +
      '<path class="gv-lt" d="M276 470 q-14 6 -30 4 M320 472 q18 4 34 0"/>' +
      '<path class="gv-l" d="M20 120 V60 M20 60 H100 M44 60 V104 M70 60 V92 M20 120 H60"/>'
    );
  },

  // A que já estava aqui: nicho na cisterna, ecos em anéis e a água parada.
  eco: () => {
    let out = glow(200, 214, 170, "gf");
    for (let i = 1; i <= 7; i++) out += `<circle class="${i % 2 ? "gv-ft" : "gv-lh"}" cx="200" cy="214" r="${46 + i * 26}" style="stroke-dasharray:${4 + i} ${6 + i * 2}"/>`;
    let ripple = "";
    for (let k = 0; k < 5; k++) ripple += `<ellipse class="gv-lt" cx="200" cy="${406 + k * 18}" rx="${30 + k * 40}" ry="${4 + k * 3}"/>`;
    return (
      out +
      '<path class="gv-void" d="M156 300 V190 A44 44 0 0 1 244 190 V300Z"/><path class="gv-l" d="M156 300 V190 A44 44 0 0 1 244 190 V300Z"/>' +
      '<path class="gv-lt" d="M200 146 V300"/>' +
      '<path class="gv-mid" d="M10 500 V120 H62 V500Z M338 500 V120 H390 V500Z"/>' +
      `<path fill="${ref("hg")}" d="M10 500 V120 H36 V500Z M338 500 V120 H364 V500Z"/>` +
      '<path class="gv-lm" d="M10 500 V120 H62 V500 M338 500 V120 H390 V500 M4 120 H68 M332 120 H396"/>' +
      '<path class="gv-void" d="M0 372 H400 V500 H0Z" opacity=".75"/><path class="gv-lm" d="M0 372 H400"/>' + ripple +
      '<path class="gv-ft" d="M170 384 V420 M200 384 V430 M230 384 V420" opacity=".8"/>'
    );
  },

  // O preço: figura pequena consumida no coração da chama, contagem de riscos no altar.
  preco: () => {
    let tally = "";
    for (let row = 0; row < 3; row++) {
      for (let g = 0; g < 5; g++) {
        const bx = 36 + g * 70;
        const by = 404 + row * 28;
        const lit = row * 5 + g < 7;
        tally += `<path class="${lit ? "gv-lm" : "gv-ld"}" d="M${bx} ${by} v18 M${bx + 8} ${by} v18 M${bx + 16} ${by} v18 M${bx + 24} ${by} v18 M${bx - 4} ${by + 14} L${bx + 30} ${by + 4}"/>`;
      }
    }
    return (
      rays(200, 236, 40, 40, 300, "gv-lh", 0.4) + glow(200, 236, 190) +
      flame(200, 356, 320, 112, "gv-e0") + flame(200, 356, 270, 80, "gv-e") + flame(200, 356, 190, 52, "gv-e2") +
      '<circle class="gv-void" cx="200" cy="232" r="15"/><path class="gv-void" d="M178 340 C178 288 186 258 200 254 C214 258 222 288 222 340Z"/>' +
      '<path class="gv-lm" d="M178 340 C178 288 186 258 200 254 C214 258 222 288 222 340Z"/><circle class="gv-lm" cx="200" cy="232" r="15"/>' +
      glow(200, 296, 36) + '<circle class="gv-e3" cx="200" cy="296" r="6"/>' +
      '<path class="gv-void" d="M118 356 H282 L266 384 H134Z"/><path class="gv-l" d="M118 356 H282 L266 384 H134Z"/>' +
      tally
    );
  },

  // Duas que desceram: a que voltou até a porta e a que seguiu para baixo.
  duas: () => {
    let steps = "";
    for (let i = 0; i < 7; i++) steps += `<path class="gv-lt" d="M${140 + i * 8} ${210 + i * 18} H${260 - i * 8}"/>`;
    return (
      glow(70, 300, 130) +
      '<path class="gv-void" d="M90 460 V190 A110 110 0 0 1 310 190 V460Z"/><path class="gv-l" d="M90 460 V190 A110 110 0 0 1 310 190 V460Z"/>' +
      '<path class="gv-lt" d="M118 460 V196 A82 82 0 0 1 282 196 V460"/>' + steps +
      `<path fill="${ref("hg")}" d="M90 460 V190 A110 110 0 0 1 130 100 V460Z" opacity=".7"/>` +
      '<path class="gv-mid" d="M20 466 H380 V500 H20Z"/><path class="gv-l" d="M20 466 H380"/>' +
      '<circle class="gv-b" cx="128" cy="452" r="15"/><path class="gv-void" d="M120 448 h5 M132 448 h5"/><path class="gv-lm" d="M136 462 h26 M156 440 q22 -6 44 4 M164 452 q22 -4 48 4 M172 462 q20 -2 50 2"/>' +
      '<circle class="gv-bm" cx="214" cy="288" r="6"/><circle class="gv-bm" cx="218" cy="322" r="5"/><circle class="gv-bm" cx="222" cy="352" r="4"/>' +
      '<circle class="gv-b" cx="228" cy="262" r="6.5" opacity=".9"/>' +
      '<path class="gv-void" d="M30 430 h50 l-8 28 h-34z"/><path class="gv-lm" d="M30 430 h50 l-8 28 h-34z"/>' + flame(55, 430, 56, 14, "gv-e2") + flame(55, 430, 30, 7, "gv-e3")
    );
  },

  // O poço-cripta visto de cima: anéis de pedra descendo até a luz lá no fundo.
  poco: () => {
    let out = glow(200, 360, 220) + rays(200, 360, 40, 10, 240, "gv-lh", 0.3);
    for (let i = 0; i < 12; i++) {
      const rr = 188 * Math.pow(0.76, i);
      const cy = 150 + i * 20 + i * i * 0.9;
      out += `<ellipse class="${i % 3 === 0 ? "gv-l" : "gv-lm"}" cx="200" cy="${r(cy)}" rx="${r(rr)}" ry="${r(rr * 0.62)}"${i < 6 ? ' style="fill:var(--ink-950);fill-opacity:.55"' : ""}/>`;
      if (i < 9) {
        for (let t = 0; t < 10; t++) {
          const a = Math.PI * (0.15 + t * 0.08);
          out += `<line class="gv-lt" x1="${r(200 + Math.cos(a) * rr)}" y1="${r(cy + Math.sin(a) * rr * 0.62)}" x2="${r(200 + Math.cos(a) * rr * 0.9)}" y2="${r(cy + Math.sin(a) * rr * 0.56 + 6)}"/>`;
        }
      }
    }
    return out + '<ellipse class="gv-void" cx="200" cy="396" rx="16" ry="9"/>' + glow(200, 394, 40) + '<ellipse class="gv-e2" cx="200" cy="394" rx="8" ry="4.6"/><ellipse class="gv-e3" cx="200" cy="394" rx="3.4" ry="2"/>';
  },

  // A Brasa: o cadinho rachado no fundo, geada nas bordas.
  brasa: () => {
    let cracks = "";
    for (let i = 0; i < 9; i++) {
      const a = Math.PI * (1.05 + i * 0.11);
      const x2 = 200 + Math.cos(a) * 92;
      const y2 = 340 + Math.sin(a) * 52;
      cracks += `<path class="gv-elt" d="M200 340 L${r(200 + Math.cos(a) * 46 + (rnd(i) - 0.5) * 12)} ${r(340 + Math.sin(a) * 26)} L${r(x2)} ${r(y2)}"/>`;
    }
    let frost = "";
    for (let f = 0; f < 6; f++) frost += frostFern(34 + f * 16, 470, 70 + f * 8, 1) + frostFern(366 - f * 16, 470, 70 + f * 8, -1);
    return (
      rays(200, 330, 36, 70, 300, "gv-elt", 0.5) + glow(200, 330, 150) + frost +
      '<path class="gv-mid" d="M70 380 L330 380 L300 466 L100 466Z"/>' +
      `<path fill="${ref("hg")}" d="M70 380 L200 380 L200 466 L100 466Z"/><path class="gv-l" d="M70 380 L330 380 L300 466 L100 466Z"/>` +
      '<path class="gv-lt" d="M120 400 H280 M130 420 H270 M120 440 H282"/>' +
      '<path class="gv-void" d="M96 380 C96 296 304 296 304 380Z"/><path class="gv-lm" d="M96 380 C96 296 304 296 304 380"/>' +
      cracks + '<path class="gv-e0" d="M150 380 C150 330 250 330 250 380Z"/><path class="gv-e" d="M168 380 C168 346 232 346 232 380Z"/><ellipse class="gv-e3" cx="200" cy="366" rx="18" ry="10"/>'
    );
  },

  // O frio eterno: planície de geada, montanhas e as casas do reino num anel de calor.
  frio: () => {
    let stars = "";
    for (let i = 0; i < 26; i++) {
      const sx = r(rnd(i) * 400);
      const sy = r(rnd(i + 30) * 230);
      stars += `<path class="gv-lt" d="M${sx - 3} ${sy} h6 M${sx} ${sy - 3} v6" opacity=".7"/>`;
    }
    let field = "";
    for (let k = 0; k < 11; k++) field += `<path class="gv-ft" d="M${r(200 + (k - 5) * 8)} 330 L${r(200 + (k - 5) * 120)} 500"/>`;
    let houses = "";
    for (let h = 0; h < 11; h++) {
      const hx = 200 + (h - 5) * 14;
      const hy = 330 - Math.abs(h - 5) * 0.4;
      houses += `<path class="gv-lm" d="M${hx - 5} ${hy} v-8 l5 -6 l5 6 v8z"/>`;
    }
    return (
      stars + glow(200, 330, 130) +
      '<path class="gv-void" d="M0 330 H400 V500 H0Z"/>' + field + '<path class="gv-l" d="M0 330 H400"/>' +
      '<path class="gv-mid" d="M-10 330 L50 250 L90 296 L140 220 L196 330Z"/>' + `<path fill="${ref("hf")}" d="M-10 330 L50 250 L90 296 L140 220 L196 330Z" opacity=".8"/><path class="gv-fl" d="M-10 330 L50 250 L90 296 L140 220 L196 330"/>` +
      '<path class="gv-mid" d="M214 330 L270 236 L312 292 L356 210 L410 330Z"/>' + `<path fill="${ref("hf")}" d="M214 330 L270 236 L312 292 L356 210 L410 330Z" opacity=".8"/><path class="gv-fl" d="M214 330 L270 236 L312 292 L356 210 L410 330"/>` +
      houses + '<ellipse class="gv-e2" cx="200" cy="326" rx="12" ry="4"/>' +
      '<path class="gv-ft" d="M140 440 q60 -22 120 0 M110 470 q90 -30 180 0"/>'
    );
  },

  // A fagulha: estrela de brasa sobre as mãos em concha.
  fagulha: () =>
    rays(200, 240, 48, 36, 330, "gv-lh", 0.15) + glow(200, 240, 200) +
    star(200, 240, 120, "gv-e0") + star(200, 240, 84, "gv-e") + star(200, 240, 52, "gv-e3") +
    '<path class="gv-el" d="M200 112 V368 M72 240 H328" opacity=".6"/>' +
    '<path class="gv-mid" d="M70 500 C70 440 120 396 200 396 C280 396 330 440 330 500Z"/>' +
    '<path class="gv-l" d="M70 500 C70 440 120 396 200 396 C280 396 330 440 330 500"/><path class="gv-lt" d="M110 480 C130 430 160 416 200 416 M290 480 C270 430 240 416 200 416"/>' +
    '<path class="gv-lm" d="M110 420 C130 380 170 380 200 396 C230 380 270 380 290 420"/>',

  // Genérica (fallback): braseiro aceso num nicho em arco.
  braseiro: () =>
    rays(200, 300, 40, 40, 300, "gv-lh", 0.6) + glow(200, 300, 180) +
    '<path class="gv-void" d="M70 500 V170 A130 130 0 0 1 330 170 V500Z"/><path class="gv-l" d="M70 500 V170 A130 130 0 0 1 330 170 V500Z"/>' +
    flame(200, 372, 190, 62, "gv-e0") + flame(200, 372, 150, 42, "gv-e2") + flame(200, 372, 90, 22, "gv-e3") +
    '<path class="gv-mid" d="M130 372 H270 L250 420 H150Z"/><path class="gv-l" d="M130 372 H270 L250 420 H150Z"/>' +
    '<path class="gv-l" d="M176 420 L150 500 M224 420 L250 500 M200 420 V500"/>' +
    '<path class="gv-lt" d="M96 464 H304 M96 482 H304"/>',
};

export const ILLUSTRATION_IDS = Object.keys(PLATES) as IllustrationId[];

/**
 * Gravura pronta (SVG 400x500, decorativa: `aria-hidden`, quem usa descreve no texto ao redor).
 * `preserveAspectRatio="xMidYMid slice"` preenche qualquer moldura sem distorcer.
 */
export function illustration(id: IllustrationId): string {
  ns = `gv${++uid}-`;
  const body = (PLATES[id] ?? PLATES.braseiro)();
  return `<svg class="gv" viewBox="0 0 400 500" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${defs()}<rect class="gv-bg" width="400" height="500"/>${body}</svg>`;
}
