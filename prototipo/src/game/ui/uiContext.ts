import type { KeyBindings, Screen, UiManager } from "@engine";
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
import type { CodexLog } from "../content/codex";

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
  /** Marcas vistas da Crônica (o que já foi lido/alcançado) e o que acabou de ser liberado. */
  codex: CodexLog;
  hasAutosave: boolean;

  /** Estatísticas vivas para a tela de Perfil. */
  playtimeSec(): number;
  /** Texto de objetivo da descida: fonte única, igual no HUD e na pausa. */
  objective(): string;
  /** Personagem do jogador (escolhas da Nova Jornada). */
  character(): CharacterSave;

  continueGame(): void | Promise<void>;
  /** Abre a criação de personagem (Nova Jornada). */
  newGame(): void | Promise<void>;
  /** Confirma a criação e começa uma campanha nova. */
  startNewGame(character: CharacterSave): void | Promise<void>;
  /** Troca de idioma com telas abertas: refaz a tela-base (título ou pausa) e reabre `reopen` por cima. */
  relocalize(reopen: () => Screen): void;
  /** Liga/desliga "reduzir movimento" ao vivo: animações da UI, shake da câmera e molduras de flash. */
  setReducedMotion(on: boolean): void;
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
