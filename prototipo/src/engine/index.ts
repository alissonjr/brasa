/**
 * CAMADA ENGINE - API pública (barrel).
 *
 * Genérica e reutilizável: poderia servir a qualquer action-RPG 3D em 3a pessoa
 * na web. NÃO importa nada de game/ nem de platform/. Outras camadas devem
 * importar SOMENTE deste barrel (@engine), nunca por caminho profundo.
 */
export { createEngine } from "./rendering/createEngine";
export { enableHavokPhysics } from "./physics/physicsService";
export { InputState, DEFAULT_BINDINGS, INPUT_ACTIONS } from "./input/inputState";
export type { InputSource, CombatInputSource, InputAction, KeyBindings } from "./input/inputState";
export { AttackState, Health, HitStop, overlapSpheres } from "./combat";
export type { AttackPhase, AttackTiming, Hurtbox } from "./combat";
export { StateMachine, Ticker } from "./ai/fsm";
export { ThirdPersonCamera } from "./camera/thirdPersonCamera";
export { CharacterController } from "./character/characterController";
export type { CharacterVisual, YawOrientationProvider } from "./character/characterController";
export { createEventBus } from "./core/eventBus";
export type { EventBus } from "./core/eventBus";
export { GameClock } from "./core/gameLoop";
export { UiManager, el } from "./ui/uiManager";
export type { Screen } from "./ui/uiManager";
export { createGradientSky } from "./world/sky";
export type { SkyColors } from "./world/sky";
export { createSun, createAmbient, createShadows } from "./world/lighting";
export type { SunOptions, AmbientOptions, ShadowOptions } from "./world/lighting";
export { loadContainer, createHdrEnvironment } from "./assets/assetService";
export type { HdrEnvOptions } from "./assets/assetService";
export { assetUrl } from "./assets/assetUrl";
