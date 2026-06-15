import type { KeyBindings, UiManager } from "@engine";
import type {
  AchievementService,
  ProfileService,
  ProgressionService,
  Quality,
  SaveStore,
  ScoreService,
  SettingsService,
} from "@platform";
import type { CharacterSave } from "../content/character";

/**
 * CAMADA JOGO. Contexto injetado nas telas: os serviços de plataforma de que a UI
 * precisa + as ações de fluxo (implementadas no app/composition root). As telas não
 * conhecem a engine nem a plataforma diretamente; recebem isto.
 */
export interface UiContext {
  ui: UiManager;
  save: SaveStore;
  settings: SettingsService;
  profile: ProfileService;
  score: ScoreService;
  achievements: AchievementService;
  progression: ProgressionService;
  hasAutosave: boolean;

  /** Estatísticas vivas para a tela de Perfil. */
  playtimeSec(): number;
  /** Posição atual do jogador no mundo (para o mapa). */
  playerPos(): { x: number; z: number };
  /** Personagem do jogador (escolhas da Nova Jornada). */
  character(): CharacterSave;

  continueGame(): void | Promise<void>;
  /** Abre a criação de personagem (Nova Jornada). */
  newGame(): void | Promise<void>;
  /** Confirma a criação e começa uma campanha nova. */
  startNewGame(character: CharacterSave): void | Promise<void>;
  /** Aplica a qualidade gráfica ao vivo (resolução de render + sombras). */
  setQuality(q: Quality): void;
  /** Reaplica o remapeamento de teclas ao input em jogo. */
  applyKeyBindings(bindings: Partial<KeyBindings>): void;
  loadSlot(slot: string): void | Promise<void>;
  /** Salva o estado atual no slot dado (slot manual ou sobrescrita). */
  saveToSlot(slot: string): void | Promise<void>;
  resume(): void;
  quitToTitle(): void;
  saveNow(): void | Promise<void>;
}
