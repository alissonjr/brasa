/**
 * CAMADA JOGO. Sons de UI sintetizados via WebAudio (sem assets): um "tick" suave
 * no hover e um clique mais cheio na ação. Gated pelo volume de efeitos das opções
 * (master x sfx). O AudioContext nasce preguiçosamente no primeiro gesto do usuário
 * (política de autoplay dos navegadores), então o primeiro hover pode sair mudo.
 */

type Ctx = AudioContext;

let ctx: Ctx | null = null;
let getVolume: () => number = () => 0; // master x sfx; 0 até ser configurado

/** Liga o volume vivo (lido das opções a cada som). Chamado no boot do app. */
export function configureUiSound(volume: () => number): void {
  getVolume = volume;
}

function audio(): Ctx | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function blip(freq: number, dur: number, gain: number, type: OscillatorType): void {
  const vol = getVolume();
  if (vol <= 0) return;
  const a = audio();
  if (!a) return;
  const t = a.currentTime;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  const peak = Math.max(0.0002, gain * vol);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

/** Tick discreto ao passar o mouse sobre um controle. */
export function uiHover(): void {
  blip(640, 0.05, 0.04, "triangle");
}

/** Clique mais encorpado ao acionar (duas vozes: corpo + brilho). */
export function uiClick(): void {
  blip(400, 0.12, 0.1, "triangle");
  blip(820, 0.08, 0.045, "sine");
}
