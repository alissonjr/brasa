/**
 * CAMADA JOGO (Brasa). PRIMITIVAS DE SÍNTESE compartilhadas por sfx, ambiência, música e
 * stingers. Todas recebem o contexto e o nó de saída (assim rodam no AudioContext do jogo
 * e no OfflineAudioContext do teste de regressão) e um instante absoluto `t`.
 *
 * Regras de som da casa (pós "besouro"): ondas senoidais ou triangulares suaves nas camadas
 * sustentadas; sem dente de serra, sem tremolo rápido, sem pares de graves a menos de ~40 Hz
 * um do outro (batimento áspero). Ruído vem de UM buffer por contexto, tocado de
 * deslocamentos aleatórios (nada de alocar buffer por golpe: passos disparam muitas vezes).
 */
import { noiseBuffer, rand, trackSource } from "./audioBus";

export interface FilterSpec {
  type: BiquadFilterType;
  f: number;
  /** Frequência final: varre exponencialmente de f até f1 durante a duração do som. */
  f1?: number;
  q?: number;
}

export interface ToneOpts {
  f: number;
  f1?: number;
  dur: number;
  gain: number;
  type?: OscillatorType;
  attack?: number;
  pan?: number;
  filter?: FilterSpec;
}

export interface NoiseOpts {
  dur: number;
  gain: number;
  kind?: "white" | "pink" | "brown";
  attack?: number;
  filters?: FilterSpec[];
  pan?: number;
}

const FLOOR = 0.0001;

export function midiHz(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}

function applyFilter(ctx: BaseAudioContext, t: number, dur: number, spec: FilterSpec): BiquadFilterNode {
  const f = ctx.createBiquadFilter();
  f.type = spec.type;
  f.frequency.setValueAtTime(spec.f, t);
  if (spec.f1 !== undefined && spec.f1 !== spec.f) f.frequency.exponentialRampToValueAtTime(Math.max(20, spec.f1), t + dur);
  f.Q.value = spec.q ?? 0.7;
  return f;
}

function envelope(ctx: BaseAudioContext, t: number, dur: number, gain: number, attack: number): GainNode {
  const g = ctx.createGain();
  const a = Math.min(attack, dur * 0.8);
  g.gain.setValueAtTime(FLOOR, t);
  g.gain.exponentialRampToValueAtTime(Math.max(FLOOR * 2, gain), t + a);
  g.gain.exponentialRampToValueAtTime(FLOOR, t + dur);
  return g;
}

function tail(ctx: BaseAudioContext, g: GainNode, out: AudioNode, pan: number | undefined, chain: AudioNode[]): void {
  if (pan !== undefined && pan !== 0 && typeof ctx.createStereoPanner === "function") {
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    g.connect(p).connect(out);
    chain.push(p);
  } else {
    g.connect(out);
  }
}

/** Tom com envelope (ataque curto, decaimento exponencial) e glissando opcional. */
export function tone(ctx: BaseAudioContext, out: AudioNode, t: number, o: ToneOpts): void {
  const osc = ctx.createOscillator();
  osc.type = o.type ?? "sine";
  osc.frequency.setValueAtTime(o.f, t);
  if (o.f1 !== undefined && o.f1 !== o.f) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.f1), t + o.dur);
  const g = envelope(ctx, t, o.dur, o.gain, o.attack ?? 0.006);
  const chain: AudioNode[] = [g];
  if (o.filter) {
    const f = applyFilter(ctx, t, o.dur, o.filter);
    osc.connect(f).connect(g);
    chain.push(f);
  } else {
    osc.connect(g);
  }
  tail(ctx, g, out, o.pan, chain);
  osc.start(t);
  osc.stop(t + o.dur + 0.04);
  trackSource(osc, ...chain);
}

/** Rajada de ruído filtrado a partir de um deslocamento aleatório do buffer compartilhado. */
export function noise(ctx: BaseAudioContext, out: AudioNode, t: number, o: NoiseOpts): void {
  const src = ctx.createBufferSource();
  const buf = noiseBuffer(ctx, o.kind ?? "white");
  src.buffer = buf;
  const off = rand() * Math.max(0.01, buf.duration - o.dur - 0.1);
  const g = envelope(ctx, t, o.dur, o.gain, o.attack ?? 0.004);
  const chain: AudioNode[] = [g];
  let node: AudioNode = src;
  for (const spec of o.filters ?? []) {
    const f = applyFilter(ctx, t, o.dur, spec);
    node.connect(f);
    node = f;
    chain.push(f);
  }
  node.connect(g);
  tail(ctx, g, out, o.pan, chain);
  src.start(t, off, o.dur + 0.05);
  trackSource(src, ...chain);
}

/** Ruído em loop com ganho controlável (camadas contínuas de ambiência). Retorna a fonte e o ganho. */
export function noiseLoop(
  ctx: BaseAudioContext,
  out: AudioNode,
  kind: "white" | "pink" | "brown",
  filters: FilterSpec[],
  gain: number,
): { src: AudioBufferSourceNode; gain: GainNode; filters: BiquadFilterNode[]; stop: (t: number) => void } {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, kind);
  src.loop = true;
  const dur = 1;
  let node: AudioNode = src;
  const fs: BiquadFilterNode[] = [];
  for (const spec of filters) {
    const f = applyFilter(ctx, 0, dur, { ...spec, f1: undefined });
    node.connect(f);
    node = f;
    fs.push(f);
  }
  const g = ctx.createGain();
  g.gain.value = gain;
  node.connect(g).connect(out);
  src.start(0, rand() * 3);
  trackSource(src, ...fs, g);
  return {
    src,
    gain: g,
    filters: fs,
    stop: (t: number) => {
      try {
        src.stop(t);
      } catch {
        /* já parado */
      }
    },
  };
}
