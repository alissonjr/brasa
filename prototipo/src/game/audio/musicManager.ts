/**
 * CAMADA JOGO (Brasa). MÚSICA dinâmica por CAMADAS, sintetizada via WebAudio (sem assets,
 * coerente com titleAmbience/combatSound). Três camadas em loop contínuo, com crossfade
 * logarítmico por ESTADO (biblia-audio: vertical layering):
 *  - frio:   só o leito grave (penumbra/exploração).
 *  - combate: sobe a camada tensa (pulso/tremolo) ao entrar em combate.
 *  - quente:  crossfade para um pad morno (terça maior) ao acender o braseiro.
 * Gated pelo volume de MÚSICA (master x música), lido ao vivo. AudioContext preguiçoso
 * (política de autoplay): só soa após o primeiro gesto.
 */
export type MusicState = "frio" | "combate" | "quente";

let ctx: AudioContext | null = null;
let getVolume: () => number = () => 0;

let master: GainNode | null = null;
let bedGain: GainNode | null = null;
let tensionGain: GainNode | null = null;
let warmGain: GainNode | null = null;
let nodes: AudioNode[] = [];
let volTimer = 0;
let running = false;
let state: MusicState = "frio";

export function configureMusic(volume: () => number): void {
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

function targetMaster(): number {
  return 0.16 * Math.max(0, Math.min(1, getVolume()));
}

function voices(a: AudioContext, dest: GainNode, list: Array<{ f: number; type: OscillatorType; g: number }>): void {
  for (const v of list) {
    const osc = a.createOscillator();
    const g = a.createGain();
    osc.type = v.type;
    osc.frequency.value = v.f;
    g.gain.value = v.g;
    osc.connect(g).connect(dest);
    osc.start();
    nodes.push(osc, g);
  }
}

/** Inicia o leito musical (idempotente). Começa no estado frio. */
export function startMusic(): void {
  if (running) return;
  const a = audio();
  if (!a) return;
  running = true;
  const t = a.currentTime;

  master = a.createGain();
  master.gain.setValueAtTime(0.0001, t);
  master.gain.linearRampToValueAtTime(targetMaster(), t + 1.5);
  master.connect(a.destination);

  // Filtro grave comum (abafa, como pedra).
  const lp = a.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 900;
  lp.Q.value = 0.6;
  lp.connect(master);
  nodes.push(lp);

  // Camadas (cada uma com seu gain, crossfade por estado).
  bedGain = a.createGain();
  bedGain.gain.value = 0.9; // frio liga o leito
  bedGain.connect(lp);
  voices(a, bedGain, [
    { f: 55, type: "sine", g: 0.6 },
    { f: 55 * 1.003, type: "sine", g: 0.4 },
    { f: 82.4, type: "triangle", g: 0.22 },
  ]);

  tensionGain = a.createGain();
  tensionGain.gain.value = 0.0001; // sobe em combate
  tensionGain.connect(lp);
  voices(a, tensionGain, [
    { f: 110, type: "sawtooth", g: 0.12 },
    { f: 146.83, type: "sawtooth", g: 0.1 }, // quarta tensa
  ]);
  // Tremolo na camada tensa (pulso de combate).
  const lfo = a.createOscillator();
  const lfoGain = a.createGain();
  lfo.frequency.value = 4.5;
  lfoGain.gain.value = 0.5;
  lfo.connect(lfoGain).connect(tensionGain.gain);
  lfo.start(t);
  nodes.push(lfo, lfoGain);

  warmGain = a.createGain();
  warmGain.gain.value = 0.0001; // sobe ao acender o braseiro
  warmGain.connect(lp);
  voices(a, warmGain, [
    { f: 110, type: "sine", g: 0.3 },
    { f: 138.59, type: "sine", g: 0.22 }, // terça MAIOR (calor/esperança)
    { f: 164.81, type: "sine", g: 0.18 }, // quinta
  ]);

  nodes.push(lp);
  applyState(0.01);
  volTimer = window.setInterval(() => {
    if (master && ctx) master.gain.setTargetAtTime(targetMaster(), ctx.currentTime, 0.3);
  }, 400);
}

function applyState(ramp: number): void {
  const a = ctx;
  if (!a || !bedGain || !tensionGain || !warmGain) return;
  const tg = { frio: [0.9, 0.0001, 0.0001], combate: [0.5, 0.9, 0.0001], quente: [0.6, 0.0001, 0.9] }[state];
  const now = a.currentTime;
  bedGain.gain.setTargetAtTime(tg[0]!, now, ramp);
  // a tensão tem tremolo somado pelo LFO; o alvo é a base sobre a qual ele oscila
  tensionGain.gain.setTargetAtTime(tg[1]!, now, ramp);
  warmGain.gain.setTargetAtTime(tg[2]!, now, ramp);
}

/** Troca o estado musical (crossfade ~0,8s). */
export function setMusicState(s: MusicState): void {
  if (s === state) return;
  state = s;
  if (running) applyState(0.8);
}

/** Para a música (fade-out) e desmonta o grafo. Idempotente. */
export function stopMusic(): void {
  if (!running) return;
  running = false;
  window.clearInterval(volTimer);
  const a = ctx;
  if (a && master) {
    const t = a.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setValueAtTime(master.gain.value, t);
    master.gain.linearRampToValueAtTime(0.0001, t + 0.6);
  }
  const toStop = nodes;
  const old = master;
  nodes = [];
  master = bedGain = tensionGain = warmGain = null;
  state = "frio";
  window.setTimeout(() => {
    for (const n of toStop) {
      const osc = n as OscillatorNode;
      if (typeof osc.stop === "function") {
        try {
          osc.stop();
        } catch {
          /* já parado */
        }
      }
      n.disconnect();
    }
    old?.disconnect();
  }, 700);
}
