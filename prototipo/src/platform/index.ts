/**
 * CAMADA PLATAFORMA - API pública (barrel).
 *
 * Meta-serviços que existem em volta do jogo e durariam entre jogos/sessões:
 * usuários, partida salva, pontos, opções. Genérica: não conhece o miolo do jogo.
 * NÃO importa nada de game/. Outras camadas importam só deste barrel (@platform).
 */
export { LocalSaveStore, SAVE_SCHEMA_VERSION } from "./save/saveStore";
export type { SaveStore, SaveData, SaveSlotInfo } from "./save/saveStore";
export { requestPersistentStorage, estimateStorage } from "./save/storagePersistence";
export { ProfileService } from "./profile/profileService";
export type { Profile } from "./profile/profileService";
export { ScoreService } from "./progress/scoreService";
export { AchievementService } from "./progress/achievementService";
export { ProgressionService } from "./progress/progressionService";
export type { ProgressionState } from "./progress/progressionService";
export { SettingsService } from "./settings/settingsService";
export type { Settings, Quality, DialogueSpeed } from "./settings/settingsService";
