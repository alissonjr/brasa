/**
 * CAMADA JOGO. Sons do combate, sintetizados via WebAudio (sem assets). Este arquivo mantém a
 * API pública de sempre (hitThunk, swingWhoosh, tellSound, shieldClank, perfectDodgeChime,
 * healChime, denyBlip, heroHurt) para o combatDirector e os inimigos não mudarem, mas o som
 * agora vem da biblioteca de efeitos (audio/sfx.ts) e do barramento único (audio/audioBus.ts):
 * variação aleatória leve a cada golpe, material do alvo (osso/carne/armadura), limitador
 * comum e ducking da música quando um golpe pesado cai.
 *
 * Gated pelo volume de EFEITOS das opções (master x sfx x mudo). Contexto preguiçoso
 * (política de autoplay).
 */
import { audioContext, groupOut, groupVolume, jit, setGroupVolume } from "../audio/audioBus";
import { playBlock, playHeroHurt, playHit, playSwing, type HitMaterial } from "../audio/sfx";
import { noise, tone } from "../audio/synth";

/** Liga o volume vivo (lido das opções a cada som). Chamado no boot do app. */
export function configureCombatSound(volume: () => number): void {
  setGroupVolume("sfx", volume);
}

function begin(): { a: BaseAudioContext; out: AudioNode; t: number } | null {
  if (groupVolume("sfx") <= 0) return null;
  const a = audioContext();
  const out = groupOut("sfx");
  if (!a || !out) return null;
  return { a, out, t: a.currentTime + 0.005 };
}

/**
 * Impacto do herói. `heavy` = mais grave e longo (golpe pesado). `material` = o que foi atingido:
 * "osso" (padrão: os mortos), "carne" (abafado) ou "armadura" (metal que ressoa).
 */
export function hitThunk(heavy = false, material: HitMaterial = "osso"): void {
  playHit(heavy, material);
}

/** Whoosh do golpe que ERRA (ar cortado); o pesado é mais grave e longo. */
export function swingWhoosh(heavy = false): void {
  playSwing(heavy);
}

/**
 * SOM DE TELL por arquétipo de inimigo (W6). A câmara é escura/azul: a leitura do golpe
 * não pode depender só da cor, então cada perfil telegrafa com uma assinatura sonora ao
 * iniciar o ataque. Sintetizado (sem assets), gated pelo volume de sfx.
 *  - swift: corte agudo e rápido (rogue/espreitador).
 *  - heavy: THOOM grave e longo (heavy/brutamonte/sentinela).
 *  - cast:  assobio frio ASCENDENTE (conjurador; avisa projétil).
 *  - boss:  grave com quinta aberta (Guardião); antes eram duas vozes a 6 Hz de batimento.
 *  - unblock: aviso de golpe INQUEBRÁVEL (sino grave + ruído áspero ascendente; "este não bloqueie").
 *  - basic: swish médio (minion/warrior/demônio/antigo).
 */
export type TellProfile = "swift" | "heavy" | "cast" | "boss" | "unblock" | "basic";
export function tellSound(profile: TellProfile): void {
  const v = begin();
  if (!v) return;
  const { a, out, t } = v;
  switch (profile) {
    case "swift": // corte agudo e curto
      tone(a, out, t, { f: 1400 * jit(0.05), f1: 2200, dur: 0.08, gain: 0.05 });
      noise(a, out, t, { dur: 0.05, gain: 0.07, filters: [{ type: "bandpass", f: 5200, q: 0.7 }] });
      break;
    case "heavy": // THOOM grave que sobe a tensão
      tone(a, out, t, { f: 78 * jit(0.05), f1: 118, dur: 0.34, gain: 0.13 });
      noise(a, out, t, { dur: 0.12, gain: 0.07, filters: [{ type: "bandpass", f: 420, q: 0.7 }] });
      break;
    case "cast": // assobio frio ascendente (mira)
      tone(a, out, t, { f: 600, f1: 1500, dur: 0.42, gain: 0.06, attack: 0.04 });
      break;
    case "boss": // grave com quinta aberta
      tone(a, out, t, { f: 90, f1: 70, dur: 0.5, gain: 0.14 });
      tone(a, out, t, { f: 135, f1: 105, dur: 0.5, gain: 0.07 });
      noise(a, out, t, { dur: 0.14, gain: 0.08, filters: [{ type: "bandpass", f: 600, q: 0.7 }] });
      break;
    case "unblock": // golpe inquebravel: sino grave + ruido aspero ASCENDENTE (aviso de perigo)
      tone(a, out, t, { f: 160, f1: 240, dur: 0.4, gain: 0.13 });
      tone(a, out, t + 0.04, { f: 80, dur: 0.36, gain: 0.1 });
      noise(a, out, t, { dur: 0.18, gain: 0.09, filters: [{ type: "bandpass", f: 1400, q: 0.7 }] });
      break;
    default: // basic: swish médio
      tone(a, out, t, { f: 700, f1: 1100, dur: 0.12, gain: 0.06 });
      noise(a, out, t, { dur: 0.06, gain: 0.06, filters: [{ type: "bandpass", f: 3200, q: 0.7 }] });
  }
}

/** Clank metálico de escudo (golpe do herói amortecido pela guarda do inimigo). */
export function shieldClank(): void {
  playBlock(false);
}

/** "Cintilar" da ESQUIVA PERFEITA: assobio agudo e cristalino (quase-colisão recompensada). */
export function perfectDodgeChime(): void {
  const v = begin();
  if (!v) return;
  const { a, out, t } = v;
  tone(a, out, t, { f: 1800, f1: 2600, dur: 0.16, gain: 0.06 });
  tone(a, out, t + 0.03, { f: 2400, f1: 3200, dur: 0.14, gain: 0.05 });
}

/** Carrilhão suave de CURA (essência/poção/braseiro): dois tons ascendentes, quente e curto. */
export function healChime(): void {
  const v = begin();
  if (!v) return;
  const { a, out, t } = v;
  tone(a, out, t, { f: 520, f1: 540, dur: 0.18, gain: 0.07 });
  tone(a, out, t + 0.06, { f: 780, f1: 800, dur: 0.22, gain: 0.06 }); // quinta acima (consonante, "alívio")
}

/** "Negativo" curto e baixo: a ação foi recusada (poção com a vida cheia). Dois tons descendo, sem susto. */
export function denyBlip(): void {
  const v = begin();
  if (!v) return;
  const { a, out, t } = v;
  tone(a, out, t, { f: 300, f1: 250, dur: 0.09, gain: 0.06 });
  tone(a, out, t + 0.07, { f: 220, f1: 180, dur: 0.12, gain: 0.06 });
}

/** Som de DANO ao herói: thud abafado e grave (mais "feio" que o acerto). `blocked` = clank metálico. */
export function heroHurt(blocked = false): void {
  if (blocked) playBlock(false);
  else playHeroHurt();
}
