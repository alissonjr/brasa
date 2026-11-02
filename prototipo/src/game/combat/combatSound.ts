/**
 * CAMADA JOGO. Som de impacto sintetizado via WebAudio (sem assets), espelhando o padrão
 * de game/ui/uiSound.ts: um "thunk" de bronze em camadas (tom percussivo grave + rajada de
 * ruído filtrado). Gated pelo volume de efeitos das opções (master x sfx). Atende, em nível
 * mínimo, o "som em camadas" do feel de combate (spec-combate §1); a sonoplastia final
 * (samples) é trabalho do trilho de áudio. AudioContext preguiçoso (política de autoplay).
 */
import type { PotionKind } from "./tuning";

let ctx: AudioContext | null = null;
let getVolume: () => number = () => 0;

/** Liga o volume vivo (lido das opções a cada som). Chamado no boot do app. */
export function configureCombatSound(volume: () => number): void {
  getVolume = volume;
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(a: AudioContext, t: number, f0: number, f1: number, dur: number, gain: number): void {
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(f0, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

function noiseBurst(a: AudioContext, t: number, dur: number, gain: number, freq: number): void {
  const len = Math.floor(a.sampleRate * dur);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len); // ruído decaindo
  const src = a.createBufferSource();
  src.buffer = buf;
  const bp = a.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = freq;
  bp.Q.value = 0.7;
  const g = a.createGain();
  g.gain.value = gain;
  src.connect(bp).connect(g).connect(a.destination);
  src.start(t);
}

/** "Thunk" de impacto do herói. `heavy` = mais grave, mais longo (golpe pesado). */
export function hitThunk(heavy = false): void {
  const vol = getVolume();
  if (vol <= 0) return;
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  tone(a, t, heavy ? 150 : 210, heavy ? 60 : 95, heavy ? 0.18 : 0.1, (heavy ? 0.22 : 0.14) * vol);
  noiseBurst(a, t, 0.06, (heavy ? 0.18 : 0.1) * vol, heavy ? 1800 : 2600);
}

/** Whoosh do golpe que ERRA (ar cortado): ruído filtrado curto; o pesado é mais grave e longo. */
export function swingWhoosh(heavy = false): void {
  const vol = getVolume();
  if (vol <= 0) return;
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  noiseBurst(a, t, heavy ? 0.2 : 0.11, (heavy ? 0.16 : 0.1) * vol, heavy ? 520 : 1300);
}

/**
 * SOM DE TELL por arquétipo de inimigo (W6). A câmara é escura/azul: a leitura do golpe
 * não pode depender só da cor, então cada perfil telegrafa com uma assinatura sonora ao
 * iniciar o ataque. Sintetizado (sem assets), gated pelo volume de sfx.
 *  - swift: corte agudo e rápido (rogue/espreitador).
 *  - heavy: THOOM grave e longo (heavy/brutamonte/sentinela).
 *  - cast:  assobio frio ASCENDENTE (conjurador; avisa projétil).
 *  - boss:  grave dissonante (Guardião).
 *  - unblock: aviso de golpe INQUEBRÁVEL (sino grave + ruído áspero ascendente; "este não bloqueie").
 *  - basic: swish médio (minion/warrior/demônio/antigo).
 */
export type TellProfile = "swift" | "heavy" | "cast" | "boss" | "unblock" | "basic";
export function tellSound(profile: TellProfile): void {
  const vol = getVolume();
  if (vol <= 0) return;
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  switch (profile) {
    case "swift": // corte agudo e curto
      tone(a, t, 1400, 2200, 0.08, 0.05 * vol);
      noiseBurst(a, t, 0.05, 0.07 * vol, 5200);
      break;
    case "heavy": // THOOM grave que sobe a tensão
      tone(a, t, 70, 110, 0.34, 0.13 * vol);
      noiseBurst(a, t, 0.12, 0.07 * vol, 420);
      break;
    case "cast": // assobio frio ascendente (mira)
      tone(a, t, 600, 1500, 0.42, 0.06 * vol);
      break;
    case "boss": // grave dissonante (duas vozes batendo)
      tone(a, t, 90, 70, 0.5, 0.14 * vol);
      tone(a, t, 96, 75, 0.5, 0.1 * vol);
      noiseBurst(a, t, 0.14, 0.08 * vol, 600);
      break;
    case "unblock": // golpe inquebravel: sino grave + ruido aspero ASCENDENTE (aviso de perigo)
      tone(a, t, 160, 240, 0.4, 0.13 * vol);
      tone(a, t + 0.04, 80, 80, 0.36, 0.1 * vol);
      noiseBurst(a, t, 0.18, 0.09 * vol, 1400);
      break;
    default: // basic: swish médio
      tone(a, t, 700, 1100, 0.12, 0.06 * vol);
      noiseBurst(a, t, 0.06, 0.06 * vol, 3200);
  }
}

/**
 * Aterrissagem da heroína: baque surdo na bota + um sopro de areia. `intensity` 0..1 vem da altura
 * da queda (queda curta = passo leve e quase mudo; queda longa = baque grave e mais longo).
 */
export function landThud(intensity: number): void {
  const vol = getVolume();
  if (vol <= 0) return;
  const a = audio();
  if (!a) return;
  const k = Math.min(1, Math.max(0, intensity));
  const t = a.currentTime;
  tone(a, t, 135 - 55 * k, 52, 0.06 + 0.1 * k, (0.04 + 0.16 * k) * vol);
  noiseBurst(a, t, 0.035 + 0.06 * k, (0.03 + 0.08 * k) * vol, 1500 - 700 * k);
}

/** Clank metálico de escudo (golpe do herói amortecido pela guarda do inimigo). */
export function shieldClank(): void {
  const vol = getVolume();
  if (vol <= 0) return;
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  tone(a, t, 520, 300, 0.09, 0.1 * vol);
  noiseBurst(a, t, 0.05, 0.16 * vol, 3400);
}

/** "Cintilar" da ESQUIVA PERFEITA: assobio agudo e cristalino (quase-colisão recompensada). */
export function perfectDodgeChime(): void {
  const vol = getVolume();
  if (vol <= 0) return;
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  tone(a, t, 1800, 2600, 0.16, 0.06 * vol);
  tone(a, t + 0.03, 2400, 3200, 0.14, 0.05 * vol);
}

/** Carrilhão suave de CURA (essência/poção/braseiro): dois tons ascendentes, quente e curto. */
export function healChime(): void {
  const vol = getVolume();
  if (vol <= 0) return;
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  tone(a, t, 520, 540, 0.18, 0.07 * vol);
  tone(a, t + 0.06, 780, 800, 0.22, 0.06 * vol); // terça/quinta acima (consonante, "alívio")
}

/** "Negativo" curto e baixo: a ação foi recusada (poção com a vida cheia). Dois tons descendo, sem susto. */
export function denyBlip(): void {
  const vol = getVolume();
  if (vol <= 0) return;
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  tone(a, t, 300, 250, 0.09, 0.06 * vol);
  tone(a, t + 0.07, 220, 180, 0.12, 0.06 * vol);
}

/** Som de DANO ao herói: thud abafado e grave (mais "feio" que o acerto). `blocked` = clank metálico. */
export function heroHurt(blocked = false): void {
  const vol = getVolume();
  if (vol <= 0) return;
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  if (blocked) {
    tone(a, t, 320, 180, 0.1, 0.12 * vol);
    noiseBurst(a, t, 0.05, 0.14 * vol, 3200); // clank do escudo
  } else {
    tone(a, t, 120, 50, 0.2, 0.2 * vol);
    noiseBurst(a, t, 0.08, 0.12 * vol, 900); // thud no corpo
  }
}

/** Ruído com envelope (sobe em `att`, cai exponencial) por um filtro passa-baixa/alta/faixa. Base dos sons do gole. */
function shapedNoise(a: AudioContext, t: number, dur: number, gain: number, type: BiquadFilterType, freq: number, att = 0.01): void {
  const len = Math.max(1, Math.floor(a.sampleRate * dur));
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  let b0 = 0;
  for (let i = 0; i < len; i++) {
    const w = Math.random() * 2 - 1;
    b0 = type === "lowpass" ? 0.97 * b0 + 0.03 * w : w; // lowpass: ruído "rosado" (mais grave) antes do filtro
    data[i] = type === "lowpass" ? b0 * 6 : w;
  }
  const src = a.createBufferSource();
  src.buffer = buf;
  const f = a.createBiquadFilter();
  f.type = type;
  f.frequency.value = freq;
  f.Q.value = type === "bandpass" ? 1.2 : 0.7;
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + att);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(a.destination);
  src.start(t);
}

/**
 * SOM DO GOLE (redesenho 4.1). Sintetizado, sem sample, respeita o volume de efeitos (`configureCombatSound`,
 * que já carrega o mudo global). Duas partes, porque o gesto tem duas pontas:
 *  - "cork": no INÍCIO do gesto (o frasco aparece na mão): rolha (clique de 8 ms), pop grave do unguento.
 *  - "sip": no COMMIT aos 0,30 s (a carga foi gasta): Recuperação = 3 goles (ruído rosa abaixo de 300 Hz, 90 ms cada)
 *    + `healChime`; Fúria = 1 gole + sibilo (ruído branco acima de 2 kHz, 150 ms) + "whoomp" (60 Hz, decai 0,4 s);
 *    Unguento = esfregar (ruído 200 ms) + crepitar leve. O cancelamento NÃO chama isto (usa `denyBlip`).
 * Os goles cabem em ~0,35 s depois do commit, para o som acabar com o gesto (0,6 s).
 */
export function playDrink(kind: PotionKind, part: "cork" | "sip" = "sip"): void {
  const vol = getVolume();
  if (vol <= 0) return;
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  const gulp = (at: number, g: number): void => {
    shapedNoise(a, at, 0.09, 0.5 * g * vol, "lowpass", 300, 0.025);
    tone(a, at, 190, 120, 0.09, 0.05 * g * vol);
  };
  if (part === "cork") {
    if (kind === "unguento") {
      tone(a, t, 150, 85, 0.1, 0.1 * vol); // destampar: pop grave
    } else {
      shapedNoise(a, t, 0.008, 0.2 * vol, "bandpass", 2600, 0.001); // rolha: clique de 8 ms
      tone(a, t, 900, 380, 0.03, 0.05 * vol);
    }
    return;
  }
  if (kind === "vida") {
    gulp(t + 0.03, 1);
    gulp(t + 0.14, 0.9);
    gulp(t + 0.25, 0.8);
    tone(a, t + 0.32, 520, 540, 0.18, 0.07 * vol); // healChime, deslocado para depois do último gole
    tone(a, t + 0.38, 780, 800, 0.22, 0.06 * vol);
  } else if (kind === "furia") {
    gulp(t + 0.03, 1);
    shapedNoise(a, t + 0.14, 0.15, 0.16 * vol, "highpass", 2000, 0.02); // sibilo
    tone(a, t + 0.14, 60, 42, 0.4, 0.22 * vol); // whoomp
  } else {
    shapedNoise(a, t, 0.2, 0.2 * vol, "bandpass", 1400, 0.04); // esfregar
    for (let i = 0; i < 3; i++) shapedNoise(a, t + 0.12 + i * 0.06 + Math.random() * 0.02, 0.012, 0.09 * vol, "bandpass", 3200 + i * 500, 0.002); // crepitar
  }
}
