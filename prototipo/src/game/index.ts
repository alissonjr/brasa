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
export type { CryptCtx, Room, RoomDef, RoomKind, RoomDoor } from "./scenes/crypt/cryptRoom";
export { terrainHeightAt } from "./scenes/world";
export { WORLD_GRAVITY } from "./content/world";
export {
  MainMenuScreen,
  SavesScreen,
  OptionsScreen,
  ControlsScreen,
  PauseScreen,
  ProfileScreen,
  AchievementsScreen,
  CodexScreen,
  CharacterCreateScreen,
  VictoryScreen,
  DefeatScreen,
  createAutosaveIndicator,
  createPauseButton,
} from "./ui/screens";
export { configureUiSound } from "./ui/uiSound";
export { mountMuteButton } from "./ui/muteButton";
export { openBoonShop } from "./ui/boonShop";
export { ExitMarkers } from "./ui/exitMarkers";
export type { ExitMarkerDef } from "./ui/exitMarkers";
export { installDesktopNotice } from "./ui/desktopNotice";
export { configureTitleAmbience, startTitleAmbience, stopTitleAmbience } from "./ui/titleAmbience";
export { configureMusic, startMusic, stopMusic, setMusicState } from "./audio/musicManager";
export { configureStingers, playStinger } from "./audio/stingers";
export { configureAmbience, startAmbience, setAmbience, updateAmbience, playWhisper, playStir, stopAmbience } from "./audio/adaptiveAmbience";
export { GameHud } from "./ui/hud";
export type { HudState } from "./ui/hud";
export type { UiContext } from "./ui/uiContext";
export { T, F, itemText, tr, setLanguage, getLanguage, onLanguageChange } from "./ui/strings";
export type { Lang, StringKey } from "./ui/strings";
export { CRYPT_SPAWN } from "./content/map";
export {
  CAMPAIGN,
  DEFAULT_CHAPTER,
  progressPercent,
  allObjectives,
} from "./content/campaign";
export type { Chapter, Objective } from "./content/campaign";
export { ACHIEVEMENTS, achievementForObjective, achievementById } from "./content/achievements";
export type { Achievement } from "./content/achievements";
export { readGameSave, exploracaoDefaults } from "./content/saveData";
export type { GameSaveData, RunSave } from "./content/saveData";
export { ExploracaoRegistry } from "./run/exploracao";
export type { ExploracaoHooks } from "./run/exploracao";
export { RouteState, ROTA, exitsFor, planRoute, formatNo, parseNo, stepCommit, TRANSITIONS } from "./run/rota";
export type { NodeKind, ExitKind, Place, RoutePlan, Commit } from "./run/rota";
export { readLeaderboard, submitTime, formatTime } from "./content/leaderboard";
export {
  CODEX_FLOORS,
  CODEX_ENTRIES,
  CodexLog,
  FLOOR_ECHOES,
  FLOOR_INSCRIPTIONS,
  MARK_BOSS_DOWN,
  isCodexUnlocked,
  markFloor,
  markRead,
} from "./content/codex";
export type { CodexEntry, CodexCategory, CodexFloor, CodexDecal } from "./content/codex";
export { DEFAULT_CHARACTER, readCharacter, MANTOS, DONS, DIFFICULTIES, mantoColor } from "./content/character";
export type { CharacterSave, Difficulty } from "./content/character";
export { CombatDirector } from "./combat/combatDirector";
export { configureCombatSound, healChime, denyBlip } from "./combat/combatSound";
export { DIFFICULTY_DAMAGE_TAKEN, POTIONS, ABSORB } from "./combat/tuning";
export { CombatHud } from "./ui/combatHud";
export { Onboarding } from "./ui/onboarding";
export { DamageNumbers } from "./ui/damageNumbers";
