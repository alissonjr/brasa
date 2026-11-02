/**
 * CAMADA JOGO (Brasa). PROFUNDIDADE DE SISTEMAS (Bloco 4, spec-estilo-visual-render §4.4a/b):
 * ambiência ADAPTATIVA por WebAudio (sem assets, mesmo padrão de stingers/musicManager).
 * Três camadas contínuas que reagem ao estado do jogo, mais dois cues pontuais de PRESENÇA:
 *  - cama ambiente (drone) que adensa com a PROFUNDIDADE do andar;
 *  - camada de PERIGO que sobe com inimigos despertos / fase do chefe (crossfade suave);
 *  - batida da BRASA (pulso grave) cuja CADÊNCIA acelera com a urgência (Brasa quase morta);
 *  - cue de SUSSURRO (eco espacial, panorâmico) e de AGITAÇÃO dos mortos (pré-combate).
 *
 * Gated pelo volume de MÚSICA (é textura musical). AudioContext próprio e preguiçoso (autoplay).
 */

let ctx: AudioContext | null = null;
let getVolume: () => number = () => 0;

// Nós persistentes das camadas contínuas (criados em start()).
let master: GainNode | null = null;
let droneGain: GainNode | null = null;
let dangerGain: GainNode | null = null;
let started = false;

// Estado-alvo (0..1), suavizado pelas rampas do WebAudio.
let heartTimer = 0; // acumulador para a batida da Brasa
let urgency01 = 0; // 0 calmo, 1 Brasa quase morta -> batida rápida
let danger01 = 0;

export function configureAmbience(volume: () => number): void {
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

function vol(): number {
  return Math.max(0, Math.min(1, getVolume()));
}

/** Constrói as camadas contínuas (idempotente). Chamar ao entrar no jogo. */
export function startAmbience(): void {
  if (started) return;
  const a = audio();
  if (!a) return;
  started = true;

  master = a.createGain();
  master.gain.value = 0.0001;
  master.connect(a.destination);

  // Cama ambiente: dois osciladores graves levemente desafinados + lowpass (drone frio).
  droneGain = a.createGain();
  droneGain.gain.value = 0.0001;
  const lp = a.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 220;
  const d1 = a.createOscillator();
  d1.type = "sine";
  d1.frequency.value = 55;
  const d2 = a.createOscillator();
  d2.type = "sine";
  d2.frequency.value = 55 * 1.002; // batimento quase imperceptível (vivo, sem zumbido)
  d1.connect(lp);
  d2.connect(lp);
  lp.connect(droneGain).connect(master);
  d1.start();
  d2.start();

  // Camada de perigo: trítono dissonante por bandpass (tensão que sobe com o perigo).
  dangerGain = a.createGain();
  dangerGain.gain.value = 0.0001;
  const bp = a.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 160;
  bp.Q.value = 0.6;
  const x1 = a.createOscillator();
  x1.type = "sine";
  x1.frequency.value = 73.4; // ~D2
  const x2 = a.createOscillator();
  x2.type = "sine";
  x2.frequency.value = 103.8; // ~G#2 (trítono: tensão, em tom puro)
  x1.connect(bp);
  x2.connect(bp);
  bp.connect(dangerGain).connect(master);
  x1.start();
  x2.start();
}

/** Atualiza os alvos das camadas. depth/danger/urgency em 0..1. */
export function setAmbience(s: { depth?: number; danger?: number; urgency?: number }): void {
  const a = audio();
  if (!a || !master || !droneGain || !dangerGain) return;
  const v = vol();
  const t = a.currentTime;
  const depth = clamp01(s.depth ?? 0);
  danger01 = clamp01(s.danger ?? 0);
  urgency01 = clamp01(s.urgency ?? 0);

  // Mestre segue o volume de música; rampa curta evita clique.
  master.gain.linearRampToValueAtTime(Math.max(0.0001, 0.3 * v), t + 0.4);
  // Drone adensa com a profundidade.
  droneGain.gain.linearRampToValueAtTime(Math.max(0.0001, (0.14 + 0.18 * depth) * v), t + 0.8);
  // Perigo entra/sai com crossfade.
  dangerGain.gain.linearRampToValueAtTime(Math.max(0.0001, 0.16 * danger01 * v), t + 0.6);
}

/** Avança a batida da Brasa. dtSec em segundos. Cadência acelera com urgência/perigo. */
export function updateAmbience(dtSec: number): void {
  if (!started || dtSec <= 0) return;
  const a = audio();
  if (!a || !master) return;
  const v = vol();
  if (v <= 0) return;
  // Intervalo: ~2,4 s calmo -> ~0,55 s no auge (Brasa quase morta ou muita pressão).
  const beat = Math.max(urgency01, danger01 * 0.7);
  const interval = 2.4 - 1.85 * beat;
  heartTimer += dtSec;
  if (heartTimer >= interval) {
    heartTimer = 0;
    heartbeat(a, 0.12 * v * (0.5 + 0.5 * beat), beat);
  }
}

/** Um "tum" grave (a Brasa pulsando). Mais agudo/curto quando a urgência é alta. */
function heartbeat(a: AudioContext, gain: number, beat: number): void {
  const t = a.currentTime;
  const f = 46 + 14 * beat;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(f, t);
  osc.frequency.exponentialRampToValueAtTime(f * 0.6, t + 0.18);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
  osc.connect(g).connect(master ?? a.destination);
  osc.start(t);
  osc.stop(t + 0.34);
}

/** PRESENÇA: sussurro do eco (ruído filtrado + tom frio), panorâmico (pan -1..1 = lado do nicho). */
export function playWhisper(pan = 0): void {
  const a = audio();
  if (!a) return;
  const v = vol();
  if (v <= 0) return;
  const t = a.currentTime;
  const len = Math.floor(a.sampleRate * 1.3);
  const buf = a.createBuffer(1, len, a.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) {
    const env = Math.sin((i / len) * Math.PI); // sobe e desce (um sopro)
    data[i] = (Math.random() * 2 - 1) * env;
  }
  const src = a.createBufferSource();
  src.buffer = buf;
  const bp = a.createBiquadFilter();
  bp.type = "bandpass";
  bp.frequency.value = 1400;
  bp.Q.value = 2.5;
  const g = a.createGain();
  g.gain.value = 0.025 * v;
  const panner = a.createStereoPanner();
  panner.pan.value = Math.max(-1, Math.min(1, pan));
  src.connect(bp).connect(g).connect(panner).connect(a.destination);
  src.start(t);
}

/** PRESENÇA: agitação dos mortos pré-combate (chocalho de ossos curto, escala com a contagem). */
export function playStir(count: number): void {
  const a = audio();
  if (!a) return;
  const v = vol();
  if (v <= 0 || count <= 0) return;
  const t = a.currentTime;
  const n = Math.min(6, count);
  for (let k = 0; k < n; k++) {
    const dt = (Math.sin((k + 1) * 12.9898) * 43758.5453) % 1;
    const at = t + Math.abs(dt) * 0.5; // espalha no tempo (não uníssono)
    const len = Math.floor(a.sampleRate * 0.12);
    const buf = a.createBuffer(1, len, a.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = a.createBufferSource();
    src.buffer = buf;
    const hp = a.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 2200; // chocalho seco (osso)
    const g = a.createGain();
    g.gain.value = 0.02 * v;
    src.connect(hp).connect(g).connect(a.destination);
    src.start(at);
  }
}

export function stopAmbience(): void {
  const a = audio();
  if (a && master) master.gain.linearRampToValueAtTime(0.0001, a.currentTime + 0.5);
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
