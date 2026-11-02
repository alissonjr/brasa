/**
 * CAMADA JOGO (Brasa). MÚSICA dinâmica da descida. Fachada fina sobre o MusicEngine
 * (audio/musicEngine.ts): uma música mínima de poucas notas, em escala modal que muda a cada
 * andar (floorAudio.ts) e por estado:
 *  - frio:    pad aberto e melodia rara (penumbra/exploração);
 *  - combate: quinta vazia, tensão distante e pulso grave lento (sem tremolo);
 *  - quente:  acorde maior e melodia que sobe (braseiro aceso).
 * Crossfades de 2 s entre estados e de ~3 s entre andares. Gated pelo volume de MÚSICA
 * (master x música x mudo), lido ao vivo pelo barramento. O contexto nasce preguiçoso e só
 * soa após o primeiro gesto (política de autoplay).
 */
import { onAudioTick, setGroupVolume } from "./audioBus";
import { MUSIC_PROFILES, currentFloor, onFloorChange, setMood, type MusicState } from "./floorAudio";
import { MusicEngine } from "./musicEngine";

export type { MusicState };

let engine: MusicEngine | null = null;
let unsubs: Array<() => void> = [];
let state: MusicState = "frio";

export function configureMusic(volume: () => number): void {
  setGroupVolume("music", volume);
}

/** Inicia a trilha (idempotente). Começa no estado frio, no andar corrente. */
export function startMusic(): void {
  if (engine) return;
  try {
    state = "frio";
    setMood("frio");
    engine = new MusicEngine(MUSIC_PROFILES[currentFloor()]!);
  } catch {
    engine = null; // sem WebAudio
    return;
  }
  const e = engine;
  unsubs = [onAudioTick(() => e.tick()), onFloorChange((f) => e.setProfile(MUSIC_PROFILES[f]!))];
}

/** Troca o estado musical (crossfade ~2 s). Também move a ambiência (floorAudio.setMood). */
export function setMusicState(s: MusicState): void {
  if (s === state) return;
  state = s;
  setMood(s);
  engine?.setState(s);
}

/** Para a música (fade-out) e solta os nós. Idempotente. */
export function stopMusic(): void {
  if (!engine) return;
  for (const u of unsubs) u();
  unsubs = [];
  engine.stop(1.2);
  engine = null;
  state = "frio";
  setMood("frio");
}
