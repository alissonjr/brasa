/**
 * CAMADA JOGO. Som de impacto sintetizado via WebAudio (sem assets), espelhando o padrão
 * de game/ui/uiSound.ts: um "thunk" de bronze em camadas (tom percussivo grave + rajada de
 * ruído filtrado). Gated pelo volume de efeitos das opções (master x sfx). Atende, em nível
 * mínimo, o "som em camadas" do feel de combate (spec-combate §1); a sonoplastia final
 * (samples) é trabalho do trilho de áudio. AudioContext preguiçoso (política de autoplay).
 */
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
