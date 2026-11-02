/**
 * CAMADA JOGO (Brasa). BARRAMENTO DE ÁUDIO ÚNICO. Antes, cada módulo criava o seu próprio
 * AudioContext e ligava direto no destino: sem limitador comum, sem ducking e sem como
 * renderizar tudo offline. Agora há UM contexto e um grafo de mixagem:
 *
 *   grupo (música | ambiência | stinger | sfx | ui)
 *     -> ganho de volume (opções) -> ganho de ducking -> saída do grupo
 *     -> [seco] premix  e  [molhado] envio de reverberação (câmara de pedra) -> premix
 *   premix -> compressor leve -> limitador -> teto suave (-3 dBFS) -> mestre -> destino
 *
 * Volumes: cada grupo lê uma função `() => 0..1` (já multiplicada por mudo, master e
 * música/sfx; ver `main.ts`). O barramento sincroniza os ganhos a cada tique (250 ms) com
 * rampas, então o mudo (tecla M) e os sliders valem ao vivo. Música, ambiência e stinger
 * seguem o volume de MÚSICA; sfx e ui seguem o de EFEITOS.
 *
 * Testabilidade: `setAudioContext(offlineCtx)` injeta um OfflineAudioContext (ver
 * tools/audio/render.mjs), `tickAudio()` roda os tiques à mão (sem setInterval) e
 * `setAudioSeed()` torna o acaso determinístico. O contador de fontes (`audioStats`)
 * conta osciladores/buffers vivos, para provar que trocar de sala não vaza nós.
 */

export type AudioGroup = "music" | "ambience" | "stinger" | "sfx" | "ui";

/** Ganho de calibragem por grupo (loudness relativo; ver docs/brasa/biblia-audio.md §Mixagem). */
export const GROUP_TRIM: Record<AudioGroup, number> = {
  music: 1,
  ambience: 1,
  stinger: 1,
  sfx: 1,
  ui: 0.8,
};

/** Teto do limitador final: -3,2 dBFS (picos do jogo inteiro ficam abaixo de -3 dBFS). */
export const CEILING = 0.69;

interface GroupNodes {
  input: GainNode; // volume das opções * trim
  duck: GainNode; // ducking (só música/ambiência mexem)
}

interface Bus {
  ctx: BaseAudioContext;
  groups: Record<AudioGroup, GroupNodes>;
  reverbSend: GainNode;
  premix: GainNode;
  comp: DynamicsCompressorNode;
  limiter: DynamicsCompressorNode;
  master: GainNode;
}

let bus: Bus | null = null;
let ownsContext = false;
let tickTimer = 0;
const volumeSources: Partial<Record<AudioGroup, () => number>> = {};
const tickListeners = new Set<() => void>();
let duckBaseDb: Record<"music" | "ambience", number> = { music: 0, ambience: 0 };
let duckPulseUntil = 0;
let gestureHooked = false;

// --- acaso (determinístico em teste) ----------------------------------------------------
let rng: () => number = Math.random;
export function rand(): number {
  return rng();
}
export function setAudioSeed(seed: number): void {
  let s = seed >>> 0;
  rng = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
/** Sorteio em [a, b). */
export function rr(a: number, b: number): number {
  return a + (b - a) * rng();
}
/** Variação multiplicativa centrada em 1 (±spread). */
export function jit(spread: number): number {
  return 1 + (rng() * 2 - 1) * spread;
}

// --- contador de fontes vivas -----------------------------------------------------------
const stats = { started: 0, alive: 0, peakAlive: 0 };
export function audioStats(): { started: number; alive: number; peakAlive: number } {
  return { ...stats };
}
/** Registra uma fonte (oscilador/buffer) para a contagem e a limpeza ao terminar. */
export function trackSource(src: AudioScheduledSourceNode, ...chain: AudioNode[]): void {
  stats.started++;
  stats.alive++;
  if (stats.alive > stats.peakAlive) stats.peakAlive = stats.alive;
  src.addEventListener("ended", () => {
    stats.alive--;
    try {
      src.disconnect();
      for (const n of chain) n.disconnect();
    } catch {
      /* já desconectado */
    }
  });
}

// --- construção do grafo ----------------------------------------------------------------
function dbToGain(db: number): number {
  return Math.pow(10, db / 20);
}

function ceilingCurve(): Float32Array<ArrayBuffer> {
  const n = 4096;
  const curve = new Float32Array(n);
  const knee = 0.5;
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * 2 - 1;
    const ax = Math.abs(x);
    const y = ax <= knee ? ax : knee + (CEILING - knee) * Math.tanh((ax - knee) / (CEILING - knee));
    curve[i] = Math.sign(x) * y;
  }
  return curve;
}

/** Resposta ao impulso sintética de uma câmara de pedra (ruído decaindo, mais escuro na cauda). */
function makeImpulse(ctx: BaseAudioContext, seconds: number): AudioBuffer {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < len; i++) {
      const t = i / len;
      const white = rng() * 2 - 1;
      const k = 0.55 - 0.4 * t; // a cauda vai ficando mais escura
      lp += (white - lp) * k;
      d[i] = lp * Math.pow(1 - t, 2.6) * (i < 200 ? i / 200 : 1);
    }
  }
  return buf;
}

export function buildBus(ctx: BaseAudioContext): Bus {
  const premix = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -22;
  comp.knee.value = 14;
  comp.ratio.value = 2.2;
  comp.attack.value = 0.02;
  comp.release.value = 0.28;
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -6;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.09;
  const shaper = ctx.createWaveShaper();
  shaper.curve = ceilingCurve();
  shaper.oversample = "4x";
  const master = ctx.createGain();
  premix.connect(comp).connect(limiter).connect(shaper).connect(master).connect(ctx.destination);

  // Reverberação compartilhada (câmara de pedra), só como envio.
  const convolver = ctx.createConvolver();
  convolver.buffer = makeImpulse(ctx, 2.4);
  const wetLp = ctx.createBiquadFilter();
  wetLp.type = "lowpass";
  wetLp.frequency.value = 3200;
  const reverbSend = ctx.createGain();
  reverbSend.gain.value = 1;
  reverbSend.connect(convolver).connect(wetLp).connect(premix);

  const wetAmount: Record<AudioGroup, number> = { music: 0.45, ambience: 0.3, stinger: 0.5, sfx: 0.22, ui: 0.08 };
  const mk = (g: AudioGroup): GroupNodes => {
    const input = ctx.createGain();
    input.gain.value = 0.0001;
    const duck = ctx.createGain();
    duck.gain.value = 1;
    const wet = ctx.createGain();
    wet.gain.value = wetAmount[g];
    input.connect(duck);
    duck.connect(premix);
    duck.connect(wet).connect(reverbSend);
    return { input, duck };
  };
  const groups = { music: mk("music"), ambience: mk("ambience"), stinger: mk("stinger"), sfx: mk("sfx"), ui: mk("ui") };
  return { ctx, groups, reverbSend, premix, comp, limiter, master };
}

function hookGesture(): void {
  if (gestureHooked || typeof window === "undefined") return;
  gestureHooked = true;
  const kick = (): void => {
    if (bus && bus.ctx instanceof AudioContext && bus.ctx.state === "suspended") void bus.ctx.resume();
  };
  for (const ev of ["pointerdown", "keydown", "touchstart"]) window.addEventListener(ev, kick, { passive: true });
}

/** Injeta um contexto externo (OfflineAudioContext) e monta o barramento nele. Só para testes. */
export function setAudioContext(ctx: BaseAudioContext): void {
  disposeBus();
  ownsContext = false;
  bus = buildBus(ctx);
  syncVolumes(true);
}

function disposeBus(): void {
  if (tickTimer) window.clearInterval(tickTimer);
  tickTimer = 0;
  bus = null;
}

function ensureBus(): Bus | null {
  if (bus) return bus;
  if (typeof window === "undefined") return null;
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  const ctx = new AC({ latencyHint: "interactive" });
  ownsContext = true;
  bus = buildBus(ctx);
  hookGesture();
  syncVolumes(true);
  tickTimer = window.setInterval(tickAudio, 250);
  if (import.meta.env?.DEV) (window as unknown as { __brasaAudio?: unknown }).__brasaAudio = { stats: audioStats, bus: () => bus, ctx };
  return bus;
}

/** Contexto compartilhado (preguiçoso; retoma se suspenso). Nulo sem WebAudio. */
export function audioContext(): BaseAudioContext | null {
  const b = ensureBus();
  if (!b) return null;
  if (ownsContext && b.ctx instanceof AudioContext && b.ctx.state === "suspended") void b.ctx.resume();
  return b.ctx;
}

/** Entrada de um grupo (conecte as vozes aqui). */
export function groupOut(g: AudioGroup): AudioNode | null {
  const b = ensureBus();
  return b ? b.groups[g].input : null;
}

/** Liga a função de volume vivo de um grupo (já com mudo e master embutidos). */
export function setGroupVolume(g: AudioGroup, fn: () => number): void {
  volumeSources[g] = fn;
}
export function groupVolume(g: AudioGroup): number {
  const v = volumeSources[g]?.() ?? 0;
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

function syncVolumes(instant = false): void {
  if (!bus) return;
  const t = bus.ctx.currentTime;
  for (const g of Object.keys(bus.groups) as AudioGroup[]) {
    const target = Math.max(0.0001, groupVolume(g) * GROUP_TRIM[g]);
    const p = bus.groups[g].input.gain;
    if (instant) p.setValueAtTime(target, t);
    else p.setTargetAtTime(target, t, 0.06);
  }
}

// --- ducking ----------------------------------------------------------------------------
function applyDuck(tc: number): void {
  if (!bus) return;
  const t = bus.ctx.currentTime;
  const pulse = t < duckPulseUntil ? 1 : 0;
  const m = dbToGain(duckBaseDb.music - 2.5 * pulse);
  const a = dbToGain(duckBaseDb.ambience - 2 * pulse);
  bus.groups.music.duck.gain.setTargetAtTime(m, t, tc);
  bus.groups.ambience.duck.gain.setTargetAtTime(a, t, tc);
}

/** Ducking SUSTENTADO conforme o peso do combate (0..1): música até -4 dB, ambiência até -6 dB. */
export function setCombatWeight(w01: number): void {
  const w = w01 < 0 ? 0 : w01 > 1 ? 1 : w01;
  duckBaseDb = { music: -4 * w, ambience: -6 * w };
  applyDuck(0.5);
}

/** Ducking CURTO (golpe pesado, rugido do chefe): abaixa música/ambiência e solta em ~hold s. */
export function duckPulse(holdSec = 0.35): void {
  if (!bus) return;
  duckPulseUntil = bus.ctx.currentTime + holdSec;
  applyDuck(0.02);
}

// --- tique ------------------------------------------------------------------------------
export function onAudioTick(fn: () => void): () => void {
  tickListeners.add(fn);
  return () => tickListeners.delete(fn);
}

/** Um tique do áudio: volumes, ducking que solta e agendadores de música/ambiência. */
export function tickAudio(): void {
  if (!bus) return;
  syncVolumes();
  applyDuck(0.25);
  for (const fn of tickListeners) fn();
}

export function masterNode(): GainNode | null {
  return bus ? bus.master : null;
}

// --- buffers de ruído compartilhados -----------------------------------------------------
const noiseCache = new WeakMap<BaseAudioContext, Record<"white" | "pink" | "brown", AudioBuffer>>();

function fillNoise(buf: AudioBuffer, kind: "white" | "pink" | "brown"): void {
  const out = buf.getChannelData(0);
  const n = out.length;
  const x = 4096; // emenda circular: o loop não estala
  const src = new Float32Array(n + x);
  const m = src.length;
  if (kind === "white") {
    for (let i = 0; i < m; i++) src[i] = rng() * 2 - 1;
  } else if (kind === "pink") {
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < m; i++) {
      const w = rng() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      src[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  } else {
    let last = 0;
    for (let i = 0; i < m; i++) {
      last = (last + 0.02 * (rng() * 2 - 1)) / 1.02;
      src[i] = last * 3.5;
    }
  }
  for (let i = 0; i < n; i++) {
    if (i >= x) out[i] = src[i]!;
    else {
      const k = i / x;
      out[i] = src[i]! * k + src[n + i]! * (1 - k);
    }
  }
}

/** Ruído branco/rosa/marrom de 4 s, criado uma vez por contexto e tocado de deslocamentos aleatórios. */
export function noiseBuffer(ctx: BaseAudioContext, kind: "white" | "pink" | "brown"): AudioBuffer {
  let rec = noiseCache.get(ctx);
  if (!rec) {
    const make = (k: "white" | "pink" | "brown"): AudioBuffer => {
      const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 4), ctx.sampleRate);
      fillNoise(b, k);
      return b;
    };
    rec = { white: make("white"), pink: make("pink"), brown: make("brown") };
    noiseCache.set(ctx, rec);
  }
  return rec[kind];
}
