/**
 * CAMADA JOGO (Brasa). AMBIÊNCIA ADAPTATIVA. O fundo sonoro de cada andar vem de uma
 * AmbienceScene (vento fundo, respiração do poço, gotas, estalos de brasa, rangidos; ver
 * floorAudio.ts) escolhida pelo tema do andar. Ao trocar de andar a cena nova entra com fade
 * de 3 s e a antiga sai e é desmontada (nenhum nó vaza). Além disso:
 *  - camada de PERIGO: sopro grave que sobe com inimigos despertos / fase do chefe, e DUCKING
 *    sustentado da música e da ambiência conforme o peso do combate (audioBus.setCombatWeight);
 *  - batida da BRASA (pulso grave) cuja cadência acelera com a urgência (Brasa quase morta);
 *  - cues pontuais de PRESENÇA: sussurro do eco e agitação dos mortos.
 *
 * Gated pelo volume de MÚSICA (grupo "ambience" do barramento). Contexto preguiçoso (autoplay).
 */
import { audioContext, groupOut, groupVolume, onAudioTick, rr, setCombatWeight, setGroupVolume, rand } from "./audioBus";
import { AmbienceScene } from "./ambienceScene";
import { AMBIENCE_PROFILES, FLOOR_COUNT, currentFloor, currentMood, onFloorChange, onMoodChange, setFloorAudio } from "./floorAudio";
import { noise, noiseLoop, tone } from "./synth";

let scene: AmbienceScene | null = null;
let dangerGain: GainNode | null = null;
let stopDanger: ((t: number) => void) | null = null;
let unsubs: Array<() => void> = [];
let started = false;
let heartTimer = 0; // acumulador para a batida da Brasa
let urgency01 = 0; // 0 calmo, 1 Brasa quase morta -> batida rápida
let danger01 = 0;
let depth01 = 0;

export function configureAmbience(volume: () => number): void {
  setGroupVolume("ambience", volume);
}

function buildScene(fadeIn: number): void {
  try {
    scene = new AmbienceScene(AMBIENCE_PROFILES[currentFloor()]!, fadeIn);
    scene.setMood(currentMood());
  } catch {
    scene = null;
  }
}

/** Constrói as camadas contínuas (idempotente). Chamar ao entrar no jogo. */
export function startAmbience(): void {
  if (started) return;
  const a = audioContext();
  const out = groupOut("ambience");
  if (!a || !out) return;
  started = true;
  buildScene(3);
  // Perigo: sopro grave de ruído (nada de tons: o trítono sustentado antigo zumbia).
  const d = noiseLoop(a, out, "pink", [
    { type: "lowpass", f: 360, q: 0.5 },
    { type: "highpass", f: 70, q: 0.5 },
  ], 0.0001);
  dangerGain = d.gain;
  stopDanger = d.stop;
  unsubs = [
    onAudioTick(() => scene?.tick()),
    onFloorChange(() => {
      const old = scene;
      buildScene(3);
      old?.dispose(3);
    }),
    onMoodChange((m) => scene?.setMood(m)),
  ];
}

/** Atualiza os alvos. depth/danger/urgency em 0..1; `floor` (índice do tema) tem prioridade sobre depth. */
export function setAmbience(s: { depth?: number; danger?: number; urgency?: number; floor?: number }): void {
  depth01 = clamp01(s.depth ?? 0);
  danger01 = clamp01(s.danger ?? 0);
  urgency01 = clamp01(s.urgency ?? 0);
  setFloorAudio(s.floor ?? depth01 * (FLOOR_COUNT - 1));
  const a = audioContext();
  if (!a || !started) return;
  setCombatWeight(danger01);
  dangerGain?.gain.setTargetAtTime(Math.max(0.0001, 0.035 * danger01), a.currentTime, 0.5);
}

/** Avança a batida da Brasa. dtSec em segundos. Cadência acelera com urgência/perigo. */
export function updateAmbience(dtSec: number): void {
  if (!started || dtSec <= 0) return;
  if (groupVolume("ambience") <= 0) return;
  const a = audioContext();
  const out = groupOut("ambience");
  if (!a || !out) return;
  // Intervalo: ~3,4 s calmo -> ~0,55 s no auge (Brasa quase morta ou muita pressão).
  const beat = Math.max(urgency01, danger01 * 0.7);
  const interval = 3.4 - 2.85 * beat;
  heartTimer += dtSec;
  if (heartTimer >= interval) {
    heartTimer = 0;
    heartbeat(a, out, (0.035 + 0.05 * depth01 + 0.06 * beat) * (0.8 + 0.2 * rand()), beat);
  }
}

/** Um "tum" grave (a Brasa pulsando). Mais agudo/curto quando a urgência é alta. */
function heartbeat(a: BaseAudioContext, out: AudioNode, gain: number, beat: number): void {
  const t = a.currentTime + 0.005;
  const f = 54 + 14 * beat;
  tone(a, out, t, { f, f1: f * 0.62, dur: 0.3, gain, attack: 0.015 });
  noise(a, out, t, { dur: 0.08, gain: gain * 0.2, kind: "brown", filters: [{ type: "lowpass", f: 240 }] });
}

/** PRESENÇA: sussurro do eco (ruído filtrado), panorâmico (pan -1..1 = lado do nicho). */
export function playWhisper(pan = 0): void {
  if (groupVolume("ambience") <= 0) return;
  const a = audioContext();
  const out = groupOut("ambience");
  if (!a || !out) return;
  const t = a.currentTime + 0.01;
  noise(a, out, t, {
    dur: 1.3,
    gain: 0.03,
    kind: "pink",
    attack: 0.6,
    filters: [{ type: "bandpass", f: 1400, q: 2.5 }],
    pan: Math.max(-1, Math.min(1, pan)),
  });
}

/** PRESENÇA: agitação dos mortos pré-combate (chocalho de ossos curto, escala com a contagem). */
export function playStir(count: number): void {
  if (groupVolume("ambience") <= 0 || count <= 0) return;
  const a = audioContext();
  const out = groupOut("ambience");
  if (!a || !out) return;
  const t = a.currentTime + 0.01;
  const n = Math.min(6, count);
  for (let k = 0; k < n; k++) {
    noise(a, out, t + rr(0, 0.5), { dur: 0.12, gain: 0.03, filters: [{ type: "bandpass", f: rr(2200, 3600), q: 2 }], pan: rr(-0.6, 0.6) });
  }
}

/** Desmonta a ambiência (fade) e permite um novo startAmbience. */
export function stopAmbience(): void {
  if (!started) return;
  started = false;
  for (const u of unsubs) u();
  unsubs = [];
  scene?.dispose(1.5);
  scene = null;
  const a = audioContext();
  if (a && dangerGain) {
    dangerGain.gain.cancelScheduledValues(a.currentTime);
    dangerGain.gain.setTargetAtTime(0.0001, a.currentTime, 0.3);
    stopDanger?.(a.currentTime + 1.5);
  }
  dangerGain = null;
  stopDanger = null;
  setCombatWeight(0);
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
