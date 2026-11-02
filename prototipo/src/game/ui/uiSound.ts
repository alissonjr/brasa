/**
 * CAMADA JOGO. Sons de UI sintetizados via WebAudio (sem assets): um "tick" suave
 * no hover e um clique mais cheio na ação. Gated pelo volume de efeitos das opções
 * (master x sfx). O AudioContext nasce preguiçosamente no primeiro gesto do usuário
 * (política de autoplay dos navegadores), então o primeiro hover pode sair mudo.
 */

import { audioContext, groupOut, groupVolume, setGroupVolume, jit } from "../audio/audioBus";
import { tone } from "../audio/synth";

/** Liga o volume vivo (lido das opções a cada som). Chamado no boot do app. */
export function configureUiSound(volume: () => number): void {
  setGroupVolume("ui", volume);
}

function blip(freq: number, dur: number, gain: number, type: OscillatorType): void {
  if (groupVolume("ui") <= 0) return;
  const a = audioContext();
  const out = groupOut("ui");
  if (!a || !out) return;
  tone(a, out, a.currentTime + 0.005, { f: freq * jit(0.015), dur, gain, type, attack: 0.008 });
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
