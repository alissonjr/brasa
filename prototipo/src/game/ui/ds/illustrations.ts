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

function defs(extra = ""): string {
  return (
    "<defs>" + extra +
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
export function illustration(id: IllustrationId, format: MuralFormat = "retrato"): string {
  ns = `gv${++uid}-`;
  const body = (PLATES[id] ?? PLATES.braseiro)();
  // Paisagem (textura 2:1 do painel 3D): a faixa central da gravura, onde mora o assunto.
  const vb = format === "paisagem" ? "0 150 400 200" : "0 0 400 500";
  const bg = format === "paisagem" ? '<rect class="gv-bg" y="150" width="400" height="200"/>' : '<rect class="gv-bg" width="400" height="500"/>';
  return `<svg class="gv" viewBox="${vb}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${defs()}${bg}${body}</svg>`;
}

// ---------------------------------------------------------------------------------------------
// ALFABETO DO MURAL (fase R5): bustos dos mortos, glifos de perigo e de situação, marcas de
// contagem, e o painel "o que vem" composto a partir de dados. Mesma linguagem da Crônica
// (traço de xilogravura, só classes `.gv-*`), sem texto dentro do desenho.
// ---------------------------------------------------------------------------------------------

/** Formato do painel: retrato (placa DOM; o `vem` é 400x460, a gravura 400x500 cortada ao centro) ou paisagem 800x400 (textura 2:1 do painel 3D). */
export type MuralFormat = "retrato" | "paisagem";

/** Tipos de morto com busto. Os ids são os `SkeletonKind` do jogo (+ a Guardiã e a Acendedora). */
export type BustKind =
  | "minion" | "warrior" | "rogue" | "heavy" | "antigo" | "sentinela"
  | "conjurador" | "arqueiro" | "demonio" | "brutamonte" | "espreitador"
  | "guardia" | "acendedora";

/** Glifos de perigo de cenário e de situação (olho = emboscada, ondas, vela = vigília). */
export type HazardKind =
  | "tumulo" | "chao" | "colunas" | "agua" | "fissura" | "grade" | "arena"
  | "vigilia" | "emboscada" | "ondas";

export const BUST_KINDS: BustKind[] = [
  "minion", "warrior", "rogue", "heavy", "antigo", "sentinela",
  "conjurador", "arqueiro", "demonio", "brutamonte", "espreitador", "guardia", "acendedora",
];
export const HAZARD_KINDS: HazardKind[] = [
  "tumulo", "chao", "colunas", "agua", "fissura", "grade", "arena", "vigilia", "emboscada", "ondas",
];

type GlyphKey = BustKind | HazardKind | "sentinela_manto";

/** Corpo de pedra do glifo: massa escura, hachura de xilogravura e contorno. */
const gBody = (d: string): string =>
  `<path class="gv-mid" d="${d}"/><path fill="${ref("hk")}" d="${d}" opacity=".75"/><path class="gv-gl" d="${d}"/>`;
const gSlab = (d: string): string => `<path class="gv-mid" d="${d}"/><path class="gv-gm" d="${d}"/>`;

const D_BUST =
  "M-9 11 C-9 4 -6 1 -3 0.2 L-3 -1.8 C-5.4 -3 -5.6 -6.4 -4.4 -8.4 C-3.4 -10.4 -1.8 -11 0 -11 C1.8 -11 3.4 -10.4 4.4 -8.4 C5.6 -6.4 5.4 -3 3 -1.8 L3 0.2 C6 1 9 4 9 11Z";
const D_HOOD = "M-9 11 C-9 4 -7 0 -5 -2 C-6 -7 -3 -12 0 -12 C3 -12 6 -7 5 -2 C7 0 9 4 9 11Z";
const D_HOOD_FACE = "M-3.2 -2.5 C-3.6 -6.5 -1.8 -9 0 -9 C1.8 -9 3.6 -6.5 3.2 -2.5 C2.4 -0.5 -2.4 -0.5 -3.2 -2.5Z";
const D_WIDE =
  "M-12 11 C-12 3 -8 0 -4 -0.6 L-4 -2.2 C-6 -3.2 -6.4 -6.8 -5 -8.6 C-3.8 -10.2 -2 -10.6 0 -10.6 C2 -10.6 3.8 -10.2 5 -8.6 C6.4 -6.8 6 -3.2 4 -2.2 L4 -0.6 C8 0 12 3 12 11Z";
const D_STAR = "M0 2.2 L0.9 4.3 L3 5.2 L0.9 6.1 L0 8.2 L-0.9 6.1 L-3 5.2 L-0.9 4.3Z";
const D_CREST = "M-1.4 -11 C-1.8 -14 -0.5 -16.4 0 -17.6 C0.5 -16.4 1.8 -14 1.4 -11Z";

const gSkull = (): string =>
  '<circle class="gv-gb" cx="-2" cy="-6.6" r="1.05"/><circle class="gv-gb" cx="2" cy="-6.6" r="1.05"/>' +
  '<path class="gv-gt" d="M-2.4 -3.6 h4.8 M-1.6 -3.6 v1.4 M0 -3.6 v1.6 M1.6 -3.6 v1.4"/>';
const gHood = (): string => gBody(D_HOOD) + `<path class="gv-void" d="${D_HOOD_FACE}"/>`;

const GLYPHS: Record<GlyphKey, () => string> = {
  // Manso (o povo): caveira limpa, sem atributo.
  minion: () => gBody(D_BUST) + gSkull(),
  // Guerreiro: espada atrás do ombro.
  warrior: () => '<path class="gv-gm" d="M-10.5 10 L2 -9.5 M-10 6.6 L-6 9.2 M0 -8 L3.2 -10"/>' + gBody(D_BUST) + gSkull(),
  // Ladino: capuz e adaga.
  rogue: () => gHood() + '<path class="gv-gl" d="M5 4 L11.5 -4 M9.4 -4.8 L12 -2"/>',
  // Pesado: elmo fechado com fenda e maça atrás do ombro.
  heavy: () =>
    '<path class="gv-gm" d="M10 11 V-8"/><path class="gv-gg" d="M7 -12 H13 V-7 H7Z"/>' + gBody(D_WIDE) +
    gSlab("M-5.6 -4 C-5.6 -10.6 -3 -12.4 0 -12.4 C3 -12.4 5.6 -10.6 5.6 -4Z") +
    '<path class="gv-void" d="M-4.4 -7.6 H4.4 V-6 H-4.4Z"/><path class="gv-gt" d="M0 -12.4 V-4"/>',
  // Antigo: crista na testa.
  antigo: () => gBody(D_BUST) + gSkull() + `<path class="gv-gg" d="${D_CREST}"/><path class="gv-gt" d="M-4.6 -9.6 h9.2"/>`,
  // Sentinela: crista e escudo.
  sentinela: () =>
    gBody(D_BUST) + gSkull() + `<path class="gv-gg" d="${D_CREST}"/>` +
    '<circle class="gv-mid" cx="8" cy="4.4" r="4.8"/><circle class="gv-gl" cx="8" cy="4.4" r="4.8"/><path class="gv-gt" d="M8 -0.4 v9.6 M3.2 4.4 h9.6"/>',
  // Sentinela com o manto da Acendedora (A6): capa caída dos ombros.
  sentinela_manto: () =>
    '<path class="gv-mid" d="M-8 -2 C-11 4 -12 9 -13 12.5 L13 12.5 C12 9 11 4 8 -2Z"/><path fill="' + ref("hk") + '" d="M-8 -2 C-11 4 -12 9 -13 12.5 L13 12.5 C12 9 11 4 8 -2Z" opacity=".8"/><path class="gv-gm" d="M-8 -2 C-11 4 -12 9 -13 12.5 M8 -2 C11 4 12 9 13 12.5"/>' +
    gBody(D_BUST) + gSkull() + `<path class="gv-gg" d="${D_CREST}"/>` +
    '<circle class="gv-mid" cx="9" cy="5" r="4.2"/><circle class="gv-gl" cx="9" cy="5" r="4.2"/>',
  // Conjurador: capuz e cajado com orbe (a única brasa do painel).
  conjurador: () =>
    gHood() + '<path class="gv-gl" d="M-10 11.5 L-10 -6.5"/><circle class="gv-gx-glow" cx="-10" cy="-8.4" r="4.4"/><circle class="gv-gxe" cx="-10" cy="-8.4" r="2.5"/><circle class="gv-gxe2" cx="-10" cy="-8.4" r="1"/>',
  // Arqueiro: arco atrás do ombro.
  arqueiro: () => '<path class="gv-gm" d="M8.4 -11 C15 -5 15 6 8.4 12 M8.4 -11 V12"/>' + gBody(D_BUST) + gSkull(),
  // Demônio: chifres.
  demonio: () => gBody(D_BUST) + gSkull() + '<path class="gv-gl" d="M-3.6 -9.8 C-5 -12.4 -7.6 -13.4 -9 -12.6 M3.6 -9.8 C5 -12.4 7.6 -13.4 9 -12.6"/>',
  // Brutamonte: ombros largos, sem pescoço.
  brutamonte: () => gBody(D_WIDE) + gSkull(),
  // Espreitador: capuz inclinado e linhas de pressa.
  espreitador: () =>
    '<g transform="rotate(-18)">' + gHood() + '</g><path class="gv-gm" d="M-13 -2 h5.4 M-14 1.6 h7.4 M-13 5.2 h4.4"/>',
  // Guardiã: capuz e fagulha apagada (gelo).
  guardia: () => gHood() + `<path class="gv-gfe" d="${D_STAR}"/>`,
  // Acendedora: capuz e fagulha em brasa.
  acendedora: () => gHood() + `<path class="gv-gxe2" d="${D_STAR}"/>`,

  // --- perigos e situações ---
  // Túmulo arrombado: laje com a tampa torta e a rachadura em gelo.
  tumulo: () =>
    gSlab("M-9 -4 H9 V10 H-9Z") + '<path class="gv-gt" d="M-9 1 H9"/>' +
    '<path class="gv-mid" d="M-8 -4 L-10.6 -10 L8 -9.2 L8.6 -4Z"/><path class="gv-gf" d="M-8 -4 L-10.6 -10 L8 -9.2 L8.6 -4"/><path class="gv-gft" d="M-3 10 L-1.6 5 L-4 2"/>',
  // Chão que cede: laje partida em dois pedaços, rachadura aberta.
  chao: () =>
    gSlab("M-11 -7 H11 V7 H-11Z") + '<path class="gv-void" d="M-11 0.6 L-6 -1 L-2.6 2 L1.4 -1.6 L5 2.6 L11 1 V3.4 L5 4.8 L1.4 1 L-2.6 4.4 L-6 1.6 L-11 3Z"/>' +
    '<path class="gv-gl" d="M-11 0.6 L-6 -1 L-2.6 2 L1.4 -1.6 L5 2.6 L11 1 M-2.6 2 L-4 7 M1.4 -1.6 L2.6 -7"/>' +
    '<path class="gv-gt" d="M-9 5 l0 0 M7 -4 l0 0"/>',
  // Colunas móveis: coluna entre duas setas.
  colunas: () =>
    gSlab("M-3.5 -9 H3.5 V9 H-3.5Z") + '<path class="gv-gl" d="M-5.6 -9 H5.6 M-5.6 9 H5.6"/><path class="gv-gt" d="M-1 -5 V5 M1.4 -3 V4"/>' +
    '<path class="gv-gl" d="M-12 0 H-7.4 M-7.4 0 L-9.4 -2.2 M-7.4 0 L-9.4 2.2 M12 0 H7.4 M7.4 0 L9.4 -2.2 M7.4 0 L9.4 2.2"/>',
  // Água parada: três linhas de onda, em gelo.
  agua: () =>
    '<path class="gv-gf" d="M-11 -5.4 Q-7.5 -9.4 -4 -5.4 T3 -5.4 T10 -5.4 M-11 0.6 Q-7.5 -3.4 -4 0.6 T3 0.6 T10 0.6 M-11 6.6 Q-7.5 2.6 -4 6.6 T3 6.6 T10 6.6"/>' +
    '<path class="gv-gft" d="M-8 9.4 Q-5.5 7.8 -3 9.4 T2 9.4"/>',
  // Fissura quente: duas bordas de pedra e a brasa pela fenda.
  fissura: () =>
    '<path class="gv-gx-glow" d="M-11 10 L-6 3 L-3 5 L1 -3 L3.6 -1 L7 -8 L11 -11 L11 -8 L8 -4 L5 4 L1 0 L-2 8 L-6 6 L-9 11Z"/>' +
    gSlab("M-11 -10.4 H11 M-11 10.4 H11") + '<path class="gv-gx" d="M-11 9 L-6 3 L-3 5 L1 -3 L3.6 -1 L7 -8 L11 -11"/>',
  // Grade quente: barras sobre brasa.
  grade: () =>
    '<ellipse class="gv-gx-glow" cx="0" cy="3" rx="11" ry="7"/>' + gSlab("M-10 -7 H10 V8 H-10Z") +
    '<path class="gv-void" d="M-8 -5 H8 V6 H-8Z"/><path class="gv-gxe" d="M-8 2 H8 V6 H-8Z" opacity=".85"/>' +
    '<path class="gv-gl" d="M-8 -5 V6 M-4 -5 V6 M0 -5 V6 M4 -5 V6 M8 -5 V6 M-10 -1 H10"/>',
  // Arena que encolhe: anéis de pedra e setas para dentro, em gelo.
  arena: () =>
    '<circle class="gv-gm" cx="0" cy="0" r="11"/><circle class="gv-gft" cx="0" cy="0" r="7.2" style="stroke-dasharray:1.6 1.4"/><circle class="gv-gf" cx="0" cy="0" r="3.4"/>' +
    '<path class="gv-gl" d="M0 -11.6 V-8.6 M-1.4 -10 L0 -8.4 L1.4 -10 M0 11.6 V8.6 M-1.4 10 L0 8.4 L1.4 10 M-11.6 0 H-8.6 M-10 -1.4 L-8.4 0 L-10 1.4 M11.6 0 H8.6 M10 -1.4 L8.4 0 L10 1.4"/>',
  // Vigília: a vela acesa sobre o castiçal.
  vigilia: () =>
    '<ellipse class="gv-gx-glow" cx="0" cy="-8" rx="6.5" ry="7.5"/>' + gSlab("M-2.6 -1 H2.6 V10 H-2.6Z") + '<path class="gv-gl" d="M-6 10 H6 M0 -1 V-3"/>' +
    '<path class="gv-gxe" d="M0 -3 C-3.6 -6.4 -2.4 -10 0 -13 C2.4 -10 3.6 -6.4 0 -3Z"/><path class="gv-gxe2" d="M0 -3.6 C-1.4 -5.6 -1 -7.6 0 -9 C1 -7.6 1.4 -5.6 0 -3.6Z"/>',
  // Emboscada: o olho aberto, em gelo (ameaça), com cílios de alerta.
  emboscada: () =>
    '<ellipse class="gv-gf-glow" cx="0" cy="0" rx="12" ry="8"/>' +
    '<path class="gv-void" d="M-11 0 C-6 -7 6 -7 11 0 C6 7 -6 7 -11 0Z"/><path class="gv-gf" d="M-11 0 C-6 -7 6 -7 11 0 C6 7 -6 7 -11 0Z"/>' +
    '<circle class="gv-gfe" cx="0" cy="0" r="3.2"/><circle class="gv-void" cx="0" cy="0" r="1.3"/><path class="gv-gft" d="M0 -11 V-8 M-6 -9.4 L-4.6 -7 M6 -9.4 L4.6 -7"/>',
  // Duas ondas: duas cristas.
  ondas: () =>
    gSlab("M-11 8 H11 V10 H-11Z") +
    '<path class="gv-gl" d="M-10.4 5 L-6.6 -7 L-2.8 5 M2.8 5 L6.6 -7 L10.4 5"/><path class="gv-gt" d="M-8.6 1 H-4.6 M4.6 1 H8.6"/>',
};

/** Padrão de hachura dos glifos (em unidades do glifo, que é escalado pelo `<g>`). */
function glyphDefs(): string {
  return (
    `<pattern id="${ns}hk" width="1.5" height="1.5" patternUnits="userSpaceOnUse" patternTransform="rotate(40)"><line class="gv-ph" x1="0" y1="0" x2="0" y2="1.5"/></pattern>`
  );
}

const put = (key: GlyphKey, cx: number, cy: number, k: number): string =>
  `<g transform="translate(${r(cx)} ${r(cy)}) scale(${k})">${(GLYPHS[key] ?? GLYPHS.minion)()}</g>`;

/**
 * Marcas de contagem verticais (1 a 5): quatro riscos e o quinto cruzando. Centradas em `cx`,
 * topo em `y`. Mais de 5 repete o grupo.
 */
function tallyMarks(n: number, cx: number, y: number): string {
  let out = "";
  const groups = Math.ceil(Math.max(0, n) / 5);
  const gw = 38; // largura de um grupo de 5
  for (let g = 0; g < groups; g++) {
    const inGroup = Math.min(5, n - g * 5);
    const gx = cx - (groups * gw) / 2 + g * gw + 4;
    const bars = Math.min(4, inGroup);
    for (let i = 0; i < bars; i++) out += `<path class="gv-tally" d="M${r(gx + i * 8)} ${y} v18"/>`;
    if (inGroup === 5) out += `<path class="gv-tally" d="M${r(gx - 5)} ${y + 14} L${r(gx + 30)} ${y + 3}"/>`;
  }
  return out;
}

/** Glifo avulso (alfabeto, legenda): 28x28 unidades, centrado. `aria-hidden`; quem usa descreve. */
export function glyphSvg(key: BustKind | HazardKind | "sentinela_manto"): string {
  ns = `gv${++uid}-`;
  return `<svg class="gv gv-solo" viewBox="-14 -14 28 28" aria-hidden="true" focusable="false"><defs>${glyphDefs()}</defs>${GLYPHS[key]()}</svg>`;
}

/** Marcas de contagem avulsas (alfabeto). */
export function tallySvg(n: number): string {
  ns = `gv${++uid}-`;
  const w = Math.max(1, Math.ceil(n / 5)) * 38 + 8;
  return `<svg class="gv gv-solo" viewBox="${-w / 2} -2 ${w} 24" aria-hidden="true" focusable="false">${tallyMarks(n, 0, 2)}</svg>`;
}

// --- Painel "o que vem" ---

/** Um tipo de morto no painel: quantos, e se espera emboscado / veste o manto. */
export interface MuralMorto {
  kind: BustKind;
  n: number;
  /** Acorda por emboscada: o olho aparece junto do busto. */
  emboscada?: boolean;
  /** Só a Sentinela: veste um manto igual ao da Acendedora (A6). */
  manto?: boolean;
}

/** O aviso de uma câmara: grupos (cada grupo é uma onda), perigos de cenário e situação. */
export interface MuralNext {
  /** Ondas em ordem. Um grupo = sem ondas; dois = as duas cristas entre eles. */
  grupos: MuralMorto[][];
  /** Perigos de cenário (e `vigilia`, que vira a vela no alto). Nunca `emboscada` nem `ondas`: vêm dos dados. */
  perigos: HazardKind[];
}

const K_BUST = 4; // unidades do glifo -> unidades da vista (96 px por busto)
const CELL_W = 120;
const ROW_H = 128;
const SIT_H = 76;
const HAZ_H = 104;
const GAP = 10;

interface Block {
  h: number;
  draw: (top: number, W: number) => string;
}

function bustRow(items: MuralMorto[], ring: boolean): Block {
  return {
    h: ROW_H,
    draw: (top, W) => {
      const n = items.length;
      let out = "";
      items.forEach((m, i) => {
        const cx = W / 2 + (i - (n - 1) / 2) * CELL_W;
        const cy = top + 52;
        if (ring) out += `<circle class="gv-ring2" cx="${r(cx)}" cy="${r(cy)}" r="58"/>`;
        const key: GlyphKey = m.kind === "sentinela" && m.manto ? "sentinela_manto" : m.kind;
        out += put(key, cx, cy, K_BUST);
        if (m.emboscada) {
          out += `<circle class="gv-void" cx="${r(cx + 40)}" cy="${r(cy - 38)}" r="21"/><circle class="gv-ft" cx="${r(cx + 40)}" cy="${r(cy - 38)}" r="21"/>` + put("emboscada", cx + 40, cy - 38, 1.5);
        }
        out += tallyMarks(m.n, cx, top + 106);
      });
      return out;
    },
  };
}

/** Divide `items` em linhas equilibradas de no máximo `perRow` (5 vira 3+2; 4 vira 2+2). */
function splitRows(items: MuralMorto[], perRow: number): MuralMorto[][] {
  const rows = Math.ceil(items.length / perRow);
  const size = Math.ceil(items.length / rows);
  const out: MuralMorto[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * O painel "o que vem" (SVG, decorativo): bustos dos tipos de morto com marcas de contagem,
 * o olho junto de quem espera emboscado, a vela da vigília no alto, as duas cristas entre as
 * ondas e a faixa dos perigos de cenário embaixo. Só tokens; sem texto.
 */
export function muralVem(next: MuralNext, format: MuralFormat = "retrato"): string {
  ns = `gv${++uid}-`;
  const W = format === "paisagem" ? 800 : 400;
  const H = format === "paisagem" ? 400 : 460;
  const perRow = Math.max(1, Math.floor((W - 40) / CELL_W));
  const vigilia = next.perigos.includes("vigilia");
  const hazards = next.perigos.filter((h) => h !== "vigilia");

  const blocks: Block[] = [];
  if (vigilia) {
    blocks.push({ h: SIT_H + 8, draw: (top, w) => put("vigilia", w / 2, top + 42, 3.2) });
  }
  next.grupos.forEach((g, gi) => {
    if (gi > 0) {
      blocks.push({
        h: SIT_H,
        draw: (top, w) =>
          `<path class="gv-rule" d="M24 ${top + 38} H${r(w / 2 - 58)} M${r(w / 2 + 58)} ${top + 38} H${w - 24}"/>` + put("ondas", w / 2, top + 38, 3.2),
      });
    }
    for (const row of splitRows(g, perRow)) blocks.push(bustRow(row, gi > 0));
  });
  if (hazards.length) {
    blocks.push({
      h: HAZ_H,
      draw: (top, w) => {
        let out = `<path class="gv-rule" d="M32 ${top + 2} H${w - 32}"/>`;
        hazards.forEach((hk, i) => {
          out += put(hk, w / 2 + (i - (hazards.length - 1) / 2) * 118, top + 56, 3.6);
        });
        return out;
      },
    });
  }

  const total = blocks.reduce((a, b) => a + b.h, 0) + GAP * Math.max(0, blocks.length - 1);
  let y = Math.max(20, (H - total) / 2);
  let body = "";
  for (const b of blocks) {
    body += b.draw(y, W);
    y += b.h + GAP;
  }

  const frame =
    `<rect class="gv-bg" width="${W}" height="${H}"/>` +
    `<rect fill="${ref("hg")}" width="${W}" height="${H}" opacity=".16"/>` +
    `<rect class="gv-lt" x="10" y="10" width="${W - 20}" height="${H - 20}" rx="3"/>` +
    `<rect class="gv-ld" x="16" y="16" width="${W - 32}" height="${H - 32}" rx="2"/>`;
  return `<svg class="gv" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${defs(glyphDefs())}${frame}${body}</svg>`;
}
