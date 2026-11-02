/**
 * CAMADA JOGO (Brasa). Ambiente sonoro PROCEDURAL da tela-título (sem assets): um pad quente
 * em ré eólio com uma melodia esparsa de sino (MusicEngine) sobre um fundo de vento fraco e
 * estalos ocasionais de brasa (AmbienceScene). Substitui o antigo drone de 55 Hz, que soava
 * como zumbido. Vive no barramento comum (audio/audioBus.ts), então o limitador e o mudo
 * valem aqui também.
 *
 * Gated pelo volume de MÚSICA das opções (master x música), lido ao vivo. O contexto nasce
 * preguiçosamente e só toca após o primeiro gesto (política de autoplay): a tela-título fica
 * muda até o primeiro hover/clique e então o ambiente entra.
 */
import { onAudioTick, setGroupVolume } from "../audio/audioBus";
import { AmbienceScene } from "../audio/ambienceScene";
import { MusicEngine } from "../audio/musicEngine";
import { TITLE_AMBIENCE, TITLE_MUSIC } from "../audio/floorAudio";

let engine: MusicEngine | null = null;
let scene: AmbienceScene | null = null;
let unsub: (() => void) | null = null;

/** Liga o volume vivo (lido das opções). Chamado no boot do app. */
export function configureTitleAmbience(volume: () => number): void {
  setGroupVolume("music", volume);
  setGroupVolume("ambience", volume);
}

/** Inicia (ou retoma) o ambiente da tela-título. Idempotente. */
export function startTitleAmbience(): void {
  if (engine) return;
  try {
    engine = new MusicEngine(TITLE_MUSIC, { fadeIn: 3, fixedState: "frio" });
    scene = new AmbienceScene(TITLE_AMBIENCE, 3);
  } catch {
    engine = null;
    scene = null;
    return;
  }
  const e = engine;
  const s = scene;
  unsub = onAudioTick(() => {
    e.tick();
    s.tick();
  });
}

/** Para o ambiente com fade-out e desmonta o grafo. Idempotente. */
export function stopTitleAmbience(): void {
  if (!engine) return;
  unsub?.();
  unsub = null;
  engine.stop(0.8);
  scene?.dispose(0.8);
  engine = null;
  scene = null;
}
