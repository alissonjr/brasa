/**
 * CAMADA JOGO (Brasa). BIBLIOTECA DE EFEITOS SONOROS sintetizados (sem assets): passos por
 * superfície, pulo/aterrissagem, golpes (ar, carne/osso/armadura), esquiva, bloqueio, poção,
 * item, portas, braseiro, escada, morte de inimigo e a voz/pulso do Guardião. Curtos, com
 * variação aleatória leve (tom, filtro e ganho) para não soar "tocado em loop".
 *
 * Gated pelo volume de EFEITOS (grupo "sfx" do audioBus). Cada função é segura de chamar
 * mesmo sem WebAudio ou com volume 0 (não faz nada e não cria nós).
 *
 * PONTOS DE LIGAÇÃO (quem ainda precisa chamar):
 *  - playJump() / playLand(intensity): o agente `salto` chama no início do pulo e no
 *    toque no chão (intensity 0..1+, ex.: queda/12 m, clampado). NÃO duplicar com o som de
 *    queda que já existe na animação: esta é a versão sonora oficial; remover a antiga.
 *  - playFootstep(surface, intensity) / createFootstepper(): passos. O main.ts já alimenta o
 *    footstepper com a velocidade do herói (ver gameAudioEvents.ts); o ator não precisa chamar.
 *  - o restante (morte, bloqueio, cura, esquiva perfeita) vem dos eventos do barramento
 *    `platform.events` via bindGameAudio(); portas/braseiro/escada/poção/item têm funções
 *    próprias (playDoor, playBrazierLit, playStairs, playPotion, playPickup) para os sistemas
 *    de exploração chamarem quando quiserem.
 */
import { audioContext, groupOut, groupVolume, jit, rand, rr, duckPulse, type AudioGroup } from "./audioBus";
import { noise, tone, midiHz } from "./synth";

export type Surface = "laje" | "agua" | "cinza";
export type HitMaterial = "osso" | "carne" | "armadura";

interface V {
  a: BaseAudioContext;
  out: AudioNode;
  t: number;
}

function begin(group: AudioGroup = "sfx"): V | null {
  if (groupVolume(group) <= 0) return null;
  const a = audioContext();
  const out = groupOut(group);
  if (!a || !out) return null;
  return { a, out, t: a.currentTime + 0.005 };
}

// --- passos -----------------------------------------------------------------------------
/** Um passo. `foot` alterna esquerdo/direito (tom levemente diferente). */
export function playFootstep(surface: Surface, intensity = 1, foot = 0): void {
  const v = begin();
  if (!v) return;
  const { a, out, t } = v;
  const I = Math.max(0.2, Math.min(1.6, intensity));
  const side = foot % 2 === 0 ? 1 : 0.94;
  if (surface === "laje") {
    tone(a, out, t, { f: 210 * side * jit(0.1), f1: 110, dur: 0.07, gain: 0.05 * I * jit(0.2) }); // corpo do passo
    tone(a, out, t, { f: 90 * side, f1: 56, dur: 0.1, gain: 0.014 * I }); // peso
    noise(a, out, t, { dur: 0.04, gain: 0.05 * I * jit(0.25), filters: [{ type: "bandpass", f: 1500 * jit(0.18), q: 1 }] }); // estalo da sola
    noise(a, out, t + 0.01, { dur: 0.09, gain: 0.04 * I, kind: "pink", filters: [{ type: "bandpass", f: 650 * jit(0.2), q: 0.9 }] }); // eco curto da pedra
  } else if (surface === "agua") {
    noise(a, out, t, { dur: 0.17, gain: 0.095 * I * jit(0.2), kind: "pink", attack: 0.02, filters: [{ type: "bandpass", f: 520 * jit(0.2), f1: 1150 * jit(0.2), q: 0.9 }] });
    noise(a, out, t + 0.02, { dur: 0.1, gain: 0.025 * I, attack: 0.012, filters: [{ type: "highpass", f: 2400 }] });
    tone(a, out, t, { f: 120 * side, f1: 64, dur: 0.08, gain: 0.03 * I });
    if (rand() < 0.7) {
      const f = rr(650, 1100);
      tone(a, out, t + rr(0.05, 0.15), { f, f1: f * 1.7, dur: 0.06, gain: 0.014 * I }); // plip da gota
    }
  } else {
    noise(a, out, t, { dur: 0.15, gain: 0.15 * I * jit(0.2), kind: "pink", attack: 0.025, filters: [{ type: "highpass", f: 260 }, { type: "lowpass", f: 2200 * jit(0.15) }] });
    tone(a, out, t, { f: 120 * side, f1: 66, dur: 0.08, gain: 0.03 * I });
    for (let k = 0; k < 3; k++) {
      noise(a, out, t + rr(0.01, 0.1), { dur: 0.012, gain: rr(0.008, 0.02) * I, filters: [{ type: "highpass", f: 3200 }] }); // grãos
    }
  }
}

/** Superfície padrão por tema de andar (0..6). `molhado`: o herói está na poça/margem do lago. */
export function surfaceForFloor(themeIndex: number, molhado = false): Surface {
  if (molhado) return "agua";
  switch (themeIndex) {
    case 0: // arenito: poeira
    case 4: // osso e cal
    case 5: // vulcânico (cinza)
      return "cinza";
    case 2: // cisterna (calcário): piso lavado
      return "agua";
    default:
      return "laje";
  }
}

export interface Footstepper {
  /** Chamar todo quadro: dt em s, speed em m/s (plano), grounded se tocando o chão. */
  update(dt: number, speed: number, grounded: boolean, surface: Surface): void;
  reset(): void;
}

/** Dispara passos pela DISTÂNCIA percorrida (passada ~1,05 m a pé, ~1,5 m correndo). */
export function createFootstepper(): Footstepper {
  let dist = 0;
  let foot = 0;
  let last = -1;
  let clock = 0;
  return {
    update(dt, speed, grounded, surface) {
      clock += dt;
      if (!grounded || speed < 0.6) {
        if (speed < 0.6) dist = Math.min(dist, 0.5);
        return;
      }
      dist += speed * dt;
      const stride = speed > 5 ? 1.5 : 1.05;
      if (dist >= stride && clock - last > 0.17) {
        dist = 0;
        last = clock;
        foot++;
        playFootstep(surface, speed > 5 ? 1.25 : 0.9, foot);
      }
    },
    reset() {
      dist = 0;
      last = -1;
    },
  };
}

// --- pulo e aterrissagem ----------------------------------------------------------------
export function playJump(): void {
  const v = begin();
  if (!v) return;
  const { a, out, t } = v;
  noise(a, out, t, { dur: 0.17, gain: 0.04 * jit(0.2), kind: "pink", attack: 0.03, filters: [{ type: "bandpass", f: 480, f1: 1100, q: 0.8 }] }); // esforço do "hup"
  tone(a, out, t, { f: 170 * jit(0.08), f1: 100, dur: 0.08, gain: 0.04 }); // impulso do pé
  noise(a, out, t, { dur: 0.05, gain: 0.014, filters: [{ type: "highpass", f: 2800 }] }); // couro/tecido
}

/** Aterrissagem. intensity: 0 (degrau) a 1 (queda longa); acima de 1 é clampado. */
export function playLand(intensity = 0.5): void {
  const v = begin();
  if (!v) return;
  const { a, out, t } = v;
  const I = Math.max(0, Math.min(1, intensity));
  tone(a, out, t, { f: (150 - 25 * I) * jit(0.08), f1: 50, dur: 0.12 + 0.12 * I, gain: (0.03 + 0.06 * I) * jit(0.12) });
  tone(a, out, t, { f: (300 - 40 * I) * jit(0.08), f1: 150, dur: 0.07, gain: 0.06 + 0.06 * I }); // corpo do impacto
  noise(a, out, t, { dur: 0.16 + 0.22 * I, gain: (0.06 + 0.1 * I) * jit(0.2), kind: "pink", attack: 0.008, filters: [{ type: "highpass", f: 250 }, { type: "lowpass", f: 1400 + 600 * I }] }); // poeira
  noise(a, out, t, { dur: 0.04, gain: (0.015 + 0.02 * I), filters: [{ type: "bandpass", f: 2100 * jit(0.2), q: 1.2 }] });
  if (I > 0.55) tone(a, out, t + 0.01, { f: 1380 * jit(0.1), dur: 0.05, gain: 0.012 * I, type: "triangle" }); // fivela/equipamento
  if (I > 0.7) duckPulse(0.25);
}

// --- golpes -----------------------------------------------------------------------------
/** Golpe da espada que ERRA (ar cortado). O pesado é mais grave e mais longo. */
export function playSwing(heavy = false): void {
  const v = begin();
  if (!v) return;
  const { a, out, t } = v;
  const d = heavy ? 0.26 : 0.14;
  noise(a, out, t, {
    dur: d,
    gain: (heavy ? 0.17 : 0.12) * jit(0.15),
    kind: "white",
    attack: d * 0.4,
    filters: [{ type: "bandpass", f: (heavy ? 340 : 760) * jit(0.12), f1: (heavy ? 1250 : 2500) * jit(0.12), q: 0.9 }],
  });
  if (heavy) tone(a, out, t, { f: 150, f1: 100, dur: 0.2, gain: 0.02, attack: 0.05 }); // massa do braço
}

/** Golpe que ACERTA. osso: estalo seco; carne: abafado e úmido; armadura: metal que ressoa. */
export function playHit(heavy = false, material: HitMaterial = "osso"): void {
  const v = begin();
  if (!v) return;
  const { a, out, t } = v;
  const H = heavy ? 1 : 0;
  if (material === "osso") {
    tone(a, out, t, { f: (heavy ? 200 : 280) * jit(0.08), f1: heavy ? 70 : 120, dur: heavy ? 0.2 : 0.11, gain: heavy ? 0.16 : 0.1 }); // peso
    tone(a, out, t, { f: (heavy ? 420 : 560) * jit(0.08), f1: 240, dur: 0.07, gain: heavy ? 0.1 : 0.08 }); // batida oca do osso
    noise(a, out, t, { dur: heavy ? 0.07 : 0.05, gain: (heavy ? 0.19 : 0.15) * jit(0.15), filters: [{ type: "bandpass", f: 2600 * jit(0.15), q: 1.4 }] });
    tone(a, out, t, { f: 1480 * jit(0.1), dur: 0.1, gain: 0.018 + 0.01 * H, type: "triangle" }); // estalo do osso
    tone(a, out, t + 0.004, { f: 2190 * jit(0.1), dur: 0.07, gain: 0.012 });
  } else if (material === "carne") {
    tone(a, out, t, { f: (heavy ? 170 : 220) * jit(0.08), f1: heavy ? 64 : 90, dur: heavy ? 0.22 : 0.13, gain: heavy ? 0.15 : 0.1 });
    noise(a, out, t, { dur: heavy ? 0.12 : 0.08, gain: (heavy ? 0.2 : 0.15) * jit(0.15), kind: "pink", attack: 0.006, filters: [{ type: "bandpass", f: 820 * jit(0.2), f1: 420, q: 0.8 }] });
    noise(a, out, t + 0.01, { dur: 0.05, gain: 0.025, filters: [{ type: "highpass", f: 2600 }] });
  } else {
    tone(a, out, t, { f: (heavy ? 180 : 230) * jit(0.08), f1: heavy ? 90 : 120, dur: heavy ? 0.16 : 0.1, gain: heavy ? 0.12 : 0.08 });
    noise(a, out, t, { dur: 0.05, gain: (heavy ? 0.15 : 0.11) * jit(0.15), filters: [{ type: "highpass", f: 3200 }] });
    const base = (heavy ? 540 : 660) * jit(0.08);
    const ring = heavy ? 0.55 : 0.3;
    tone(a, out, t, { f: base, dur: ring, gain: 0.05, attack: 0.002 });
    tone(a, out, t, { f: base * 2.76, dur: ring * 0.7, gain: 0.032, attack: 0.002 });
    tone(a, out, t, { f: base * 5.4, dur: ring * 0.4, gain: 0.014, attack: 0.002 });
  }
  if (heavy) duckPulse(0.35);
}

/** Bloqueio do herói (ou escudo do inimigo): clank de metal e pancada abafada. */
export function playBlock(perfect = false): void {
  const v = begin();
  if (!v) return;
  const { a, out, t } = v;
  const base = (perfect ? 700 : 520) * jit(0.06);
  const ring = perfect ? 0.5 : 0.28;
  tone(a, out, t, { f: base, dur: ring, gain: 0.06 * (perfect ? 1.2 : 1), attack: 0.002 });
  tone(a, out, t, { f: base * 2.76, dur: ring * 0.7, gain: 0.04, attack: 0.002 });
  tone(a, out, t, { f: base * 5.4, dur: ring * 0.35, gain: 0.018, attack: 0.002 });
  noise(a, out, t, { dur: 0.045, gain: 0.12, filters: [{ type: "bandpass", f: 3400 * jit(0.12), q: 0.9 }] });
  tone(a, out, t, { f: 210, f1: 110, dur: 0.1, gain: 0.1 });
  if (perfect) duckPulse(0.3);
}

/** Esquiva: rolamento de tecido e passada leve. */
export function playDodge(): void {
  const v = begin();
  if (!v) return;
  const { a, out, t } = v;
  noise(a, out, t, { dur: 0.22, gain: 0.06 * jit(0.15), kind: "pink", attack: 0.05, filters: [{ type: "bandpass", f: 1000 * jit(0.1), f1: 420, q: 0.7 }] });
  noise(a, out, t + 0.02, { dur: 0.1, gain: 0.014, filters: [{ type: "highpass", f: 3200 }] });
  tone(a, out, t + 0.1, { f: 88, f1: 56, dur: 0.1, gain: 0.05 }); // pé que recompõe
}

/** Dano ao herói: pancada no corpo, com um fôlego curto. */
export function playHeroHurt(): void {
  const v = begin();
  if (!v) return;
  const { a, out, t } = v;
  tone(a, out, t, { f: 170 * jit(0.06), f1: 60, dur: 0.22, gain: 0.15 });
  noise(a, out, t, { dur: 0.09, gain: 0.12, filters: [{ type: "bandpass", f: 900 * jit(0.15), q: 0.8 }] });
  noise(a, out, t + 0.05, { dur: 0.22, gain: 0.03, kind: "pink", attack: 0.06, filters: [{ type: "bandpass", f: 700, f1: 420, q: 1 }] }); // o ar escapando
  duckPulse(0.3);
}

// --- itens e poções ---------------------------------------------------------------------
/** Beber poção: três goles, estalo de vidro e brilho de cura. */
export function playPotion(): void {
  const v = begin();
  if (!v) return;
  const { a, out, t } = v;
  for (let k = 0; k < 3; k++) {
    const at = t + k * 0.16 + rr(0, 0.02);
    const f = rr(150, 210);
    tone(a, out, at, { f, f1: f * 0.7, dur: 0.11, gain: 0.07, attack: 0.02, type: "sine" });
    noise(a, out, at, { dur: 0.1, gain: 0.03, kind: "pink", attack: 0.02, filters: [{ type: "bandpass", f: 420 * jit(0.2), f1: 620, q: 1.4 }] });
    const b = rr(380, 520);
    tone(a, out, at + 0.04, { f: b, f1: b * 2, dur: 0.05, gain: 0.014 }); // bolha
  }
  const g = t + 0.54;
  noise(a, out, g, { dur: 0.012, gain: 0.05, filters: [{ type: "highpass", f: 5200 }] });
  tone(a, out, g, { f: 3300 * jit(0.04), dur: 0.16, gain: 0.025, attack: 0.001 });
  tone(a, out, g, { f: 4720 * jit(0.04), dur: 0.1, gain: 0.014, attack: 0.001 });
  [784, 1175, 1568].forEach((f, i) => tone(a, out, g + 0.04 + i * 0.06, { f, dur: 0.9, gain: 0.03, attack: 0.08 })); // brilho
}

/** Pegar item. kind: "item" (brilho), "essencia" (mais quente e grave), "chave" (metálico). */
export function playPickup(kind: "item" | "essencia" | "chave" = "item"): void {
  const v = begin();
  if (!v) return;
  const { a, out, t } = v;
  if (kind === "chave") {
    tone(a, out, t, { f: 1760, dur: 0.35, gain: 0.04, attack: 0.002 });
    tone(a, out, t, { f: 1760 * 2.76, dur: 0.18, gain: 0.02, attack: 0.002 });
    noise(a, out, t, { dur: 0.04, gain: 0.05, filters: [{ type: "highpass", f: 4000 }] });
    return;
  }
  const n1 = kind === "essencia" ? midiHz(72) : midiHz(83);
  const n2 = kind === "essencia" ? midiHz(79) : midiHz(88);
  tone(a, out, t, { f: n1 * jit(0.01), dur: 0.38, gain: 0.07, type: "triangle", attack: 0.004 });
  tone(a, out, t + 0.075, { f: n2 * jit(0.01), dur: 0.5, gain: 0.07, type: "triangle", attack: 0.004 });
  tone(a, out, t + 0.075, { f: n2 * 2, dur: 0.3, gain: 0.015, attack: 0.004 });
  noise(a, out, t, { dur: 0.02, gain: 0.025, filters: [{ type: "highpass", f: 5000 }] });
}

// --- portas, braseiro, escada -----------------------------------------------------------
/** Porta de pedra (kind "pedra") ou alçapão (kind "alcapao"). Retorna a duração em s. */
export function playDoor(kind: "pedra" | "alcapao" = "pedra"): number {
  const v = begin();
  if (!v) return 0;
  const { a, out, t } = v;
  if (kind === "alcapao") {
    tone(a, out, t, { f: 170 * jit(0.06), f1: 85, dur: 0.2, gain: 0.17 }); // batente oco de madeira
    noise(a, out, t, { dur: 0.45, gain: 0.05, kind: "pink", attack: 0.12, filters: [{ type: "bandpass", f: 360, f1: 640, q: 8 }] }); // rangido
    noise(a, out, t + 0.18, { dur: 0.5, gain: 0.025, kind: "pink", attack: 0.05, filters: [{ type: "highpass", f: 1800 }] }); // poeira caindo
    return 0.7;
  }
  noise(a, out, t, { dur: 1.7, gain: 0.13, kind: "brown", attack: 0.5, filters: [{ type: "lowpass", f: 170, f1: 280 }] }); // arrasto grave
  noise(a, out, t + 0.1, { dur: 1.5, gain: 0.09, kind: "pink", attack: 0.6, filters: [{ type: "bandpass", f: 330, f1: 620, q: 3 }] }); // atrito
  noise(a, out, t + 0.2, { dur: 1.3, gain: 0.03, kind: "pink", attack: 0.6, filters: [{ type: "bandpass", f: 1100, f1: 1800, q: 2 }] }); // grão da pedra
  tone(a, out, t, { f: 46, f1: 36, dur: 1.7, gain: 0.09, attack: 0.4 });
  const e = t + 1.62;
  tone(a, out, e, { f: 72, f1: 38, dur: 0.4, gain: 0.2 }); // pedra assenta
  noise(a, out, e, { dur: 0.6, gain: 0.03, kind: "pink", attack: 0.02, filters: [{ type: "highpass", f: 1800 }] });
  return 2.1;
}

/** Braseiro aceso: "whump" do fogo, sopro de ar e estalos que rareiam. */
export function playBrazierLit(): void {
  const v = begin();
  if (!v) return;
  const { a, out, t } = v;
  tone(a, out, t, { f: 64, f1: 38, dur: 0.5, gain: 0.2, attack: 0.012 });
  noise(a, out, t, { dur: 0.8, gain: 0.08, kind: "pink", attack: 0.2, filters: [{ type: "bandpass", f: 300, f1: 1500, q: 0.7 }] });
  for (let k = 0; k < 14; k++) {
    const at = t + 0.05 + 0.85 * Math.pow(rand(), 1.6);
    noise(a, out, at, { dur: rr(0.008, 0.03), gain: rr(0.012, 0.045) * (1 - (at - t) / 1.2), filters: [{ type: "highpass", f: rr(2200, 3600) }] });
  }
  tone(a, out, t + 0.1, { f: midiHz(67), dur: 0.9, gain: 0.025, attack: 0.15 }); // calor
}

/** Escada: `steps` passos de pedra descendo, mais abafados e espaçados. */
export function playStairs(steps = 6): void {
  const v = begin();
  if (!v) return;
  const { a, out, t } = v;
  for (let k = 0; k < steps; k++) {
    const at = t + k * 0.27 + rr(-0.015, 0.015);
    const fade = 1 - (k / steps) * 0.45;
    tone(a, out, at, { f: 200 * jit(0.1), f1: 110, dur: 0.08, gain: 0.05 * fade });
    noise(a, out, at, { dur: 0.04, gain: 0.025 * fade, filters: [{ type: "bandpass", f: 1500 * jit(0.2), q: 1 }] });
    noise(a, out, at + 0.02, { dur: 0.2, gain: 0.04 * fade, kind: "pink", filters: [{ type: "bandpass", f: 520, q: 0.8 }] });
  }
}

// --- mortes e Guardião ------------------------------------------------------------------
/** Morte de inimigo esqueleto: ossos que desmontam em chocalho que desacelera. */
export function playEnemyDeath(): void {
  const v = begin();
  if (!v) return;
  const { a, out, t } = v;
  tone(a, out, t, { f: 210 * jit(0.08), f1: 80, dur: 0.18, gain: 0.1 });
  noise(a, out, t, { dur: 0.5, gain: 0.03, kind: "pink", attack: 0.03, filters: [{ type: "bandpass", f: 1200, q: 0.8 }] });
  const n = 11;
  for (let k = 0; k < n; k++) {
    const u = k / (n - 1);
    const at = t + 0.03 + 0.55 * (1 - Math.pow(1 - u, 1.7)) + rr(-0.012, 0.012); // intervalos crescem: desacelera
    const gain = rr(0.05, 0.11) * (1 - 0.7 * u);
    noise(a, out, at, { dur: rr(0.02, 0.05), gain, filters: [{ type: "bandpass", f: rr(1300, 3800), q: 3 }] });
    if (k % 2 === 0) tone(a, out, at, { f: rr(520, 900), f1: 330, dur: 0.05, gain: gain * 0.35, type: "triangle" });
  }
  duckPulse(0.25);
}

/** Voz grave do Guardião (síntese aditiva com formantes de "o"), sem dente de serra. */
export function playGuardianVoice(kind: "fala" | "rugido" = "fala"): void {
  const v = begin();
  if (!v) return;
  const { a, out, t } = v;
  const f0 = (kind === "rugido" ? 70 : 58) * jit(0.04);
  const dur = kind === "rugido" ? 1.5 : 1.1;
  const formants = [
    { f: 320, bw: 140, g: 1 },
    { f: kind === "rugido" ? 900 : 700, bw: 220, g: 0.55 },
    { f: 2300, bw: 400, g: 0.1 },
  ];
  for (let h = 1; h <= 16; h++) {
    const fr = f0 * h;
    if (fr > 3400) break;
    let amp = 0;
    for (const fm of formants) amp += fm.g * Math.exp(-0.5 * Math.pow((fr - fm.f) / fm.bw, 2));
    amp += 0.5 / h; // corpo grave
    tone(a, out, t, { f: fr, f1: fr * 0.8, dur, gain: 0.085 * amp / Math.sqrt(h), attack: dur * 0.3 });
  }
  tone(a, out, t, { f: f0 / 2, f1: f0 * 0.4, dur, gain: 0.07, attack: dur * 0.3 }); // sub-harmônico
  noise(a, out, t, { dur, gain: 0.025, kind: "pink", attack: dur * 0.3, filters: [{ type: "bandpass", f: 420, f1: 300, q: 1.2 }] }); // sopro
  duckPulse(dur * 0.7);
}

/** Pulso da Brasa do Guardião: duas batidas graves (tum-tum), de intensidade 0..1. */
export function playGuardianPulse(intensity = 0.6): void {
  const v = begin();
  if (!v) return;
  const { a, out, t } = v;
  const I = Math.max(0.1, Math.min(1, intensity));
  tone(a, out, t, { f: 56, f1: 34, dur: 0.26, gain: 0.2 * I, attack: 0.01 });
  tone(a, out, t + 0.17, { f: 52, f1: 33, dur: 0.24, gain: 0.14 * I, attack: 0.01 });
  tone(a, out, t, { f: 41, dur: 0.7, gain: 0.05 * I, attack: 0.05 }); // ressonância
  noise(a, out, t, { dur: 0.14, gain: 0.025 * I, kind: "brown", filters: [{ type: "lowpass", f: 260 }] });
}
