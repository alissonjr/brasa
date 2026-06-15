/**
 * CAMADA JOGO - API pública (barrel).
 *
 * O que é inerente a esta história e a estes personagens (a Acendedora, a descida, narrativa,
 * tuning). Depende de @engine e @platform (pelas APIs públicas); engine e platform
 * NÃO dependem do jogo.
 */
export { Acendedora } from "./actors/acendedora";
export { Skeleton } from "./actors/enemies/skeleton";
export type { SkeletonKind } from "./actors/enemies/skeleton";
export { HeroModel } from "./actors/heroModel";
export { buildCryptGraybox } from "./scenes/crypt/cryptGraybox";
export { buildCryptRoom, setupCryptScene, ensureCryptPieces } from "./scenes/crypt/cryptRoom";
export type { CryptCtx, Room, RoomDef, RoomKind } from "./scenes/crypt/cryptRoom";
export { terrainHeightAt } from "./scenes/world";
export { WORLD_GRAVITY } from "./content/world";
export {
  MainMenuScreen,
  SavesScreen,
  OptionsScreen,
  ControlsScreen,
  PauseScreen,
  ProfileScreen,
  WorldMapScreen,
  AchievementsScreen,
  CodexScreen,
  QuestLogScreen,
  CharacterCreateScreen,
  createAutosaveIndicator,
  createPauseButton,
} from "./ui/screens";
export { configureUiSound } from "./ui/uiSound";
export { configureTitleAmbience, startTitleAmbience, stopTitleAmbience } from "./ui/titleAmbience";
export { GameHud } from "./ui/hud";
export type { HudState } from "./ui/hud";
export type { UiContext } from "./ui/uiContext";
export { T, setLanguage, getLanguage } from "./ui/strings";
export type { Lang } from "./ui/strings";
export { OBJECTIVE_TEXT, CHAPTER_NAME, LANDMARKS, WORLD_HALF, CRYPT_SPAWN } from "./content/map";
export {
  CAMPAIGN,
  DEFAULT_CHAPTER,
  currentObjective,
  chapterName,
  progressPercent,
  allObjectives,
} from "./content/campaign";
export type { Chapter, Objective } from "./content/campaign";
export { ACHIEVEMENTS, achievementForObjective, achievementById } from "./content/achievements";
export type { Achievement } from "./content/achievements";
export { readGameSave } from "./content/saveData";
export type { GameSaveData } from "./content/saveData";
export { CODEX, isCodexUnlocked } from "./content/codex";
export type { CodexEntry, CodexCategory } from "./content/codex";
export { DEFAULT_CHARACTER, readCharacter, MANTOS, DONS, DIFFICULTIES } from "./content/character";
export type { CharacterSave, Difficulty } from "./content/character";
export { CombatDirector } from "./combat/combatDirector";
export { configureCombatSound } from "./combat/combatSound";
export { DIFFICULTY_DAMAGE_TAKEN } from "./combat/tuning";
export { CombatHud } from "./ui/combatHud";
