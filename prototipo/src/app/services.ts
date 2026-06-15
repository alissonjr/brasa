import { createEventBus, type EventBus } from "@engine";
import {
  AchievementService,
  LocalSaveStore,
  ProfileService,
  ProgressionService,
  ScoreService,
  SettingsService,
  type SaveStore,
} from "@platform";

/**
 * CAMADA APP. Container dos serviços de PLATAFORMA + barramento de eventos.
 *
 * O composition root monta isto e injeta no que precisar. Vai crescer para o
 * GameContext completo (incluindo scene/input/camera/clock da engine) descrito em
 * docs/tecnica-arquitetura.md seção 5.1 conforme o jogo evolui.
 */
export interface Platform {
  save: SaveStore;
  settings: SettingsService;
  score: ScoreService;
  achievements: AchievementService;
  progression: ProgressionService;
  profile: ProfileService;
  events: EventBus;
}

export function buildPlatform(): Platform {
  return {
    save: new LocalSaveStore(),
    settings: new SettingsService(),
    score: new ScoreService(),
    achievements: new AchievementService(),
    progression: new ProgressionService(),
    profile: new ProfileService(),
    events: createEventBus(),
  };
}
