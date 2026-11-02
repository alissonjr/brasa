/**
 * CAMADA ENGINE - API pública (barrel).
 *
 * Genérica e reutilizável: poderia servir a qualquer action-RPG 3D em 3a pessoa
 * na web. NÃO importa nada de game/ nem de platform/. Outras camadas devem
 * importar SOMENTE deste barrel (@engine), nunca por caminho profundo.
 */
export { createEngine } from "./rendering/createEngine";
// Pipeline estilizado (toon/tinta + AO + finalização + edge-detect). Ver
// docs/brasa/spec-estilo-visual-render.md. Genérico: o jogo decide cores/intensidades.
export { toonifyHierarchy, toonMaterialFor, flatColorOf, isCachedToon } from "./rendering/toon";
export type { ToonOptions } from "./rendering/toon";
export { addOutline, outlineHierarchy, clearOutline } from "./rendering/outline";
export type { OutlineOptions } from "./rendering/outline";
export { getContactShadows, ContactShadows } from "./rendering/contactShadows";
export { getActorLight, ActorLight } from "./rendering/actorLight";
export type { ActorLightOptions } from "./rendering/actorLight";
export type { ContactShadowHandle } from "./rendering/contactShadows";
export { installDepthPass, createDepthProxy } from "./rendering/depthPass";
export type { DepthPassOptions, DepthProxyHandle } from "./rendering/depthPass";
export { drawSkinnedLast } from "./rendering/renderOrder";
export { mergeSkinnedParts } from "./rendering/mergeSkinned";
export type { MergeSkinnedOptions } from "./rendering/mergeSkinned";
export { enableSsao } from "./rendering/ssao";
export type { SsaoOptions, SsaoHandle } from "./rendering/ssao";
export { addFinishingPass, setFinishingGrain } from "./rendering/finishingPass";
export type { FinishingOptions, FinishingHandle, FinishingGrain } from "./rendering/finishingPass";
export { addSceneOutline } from "./rendering/sceneOutline";
export { createLightPool, createLightPoolBatch } from "./rendering/lightPool";
export type { LightPoolOptions, LightPoolSpec, LightPoolBatch } from "./rendering/lightPool";
export type { SceneOutlineOptions, SceneOutlineHandle } from "./rendering/sceneOutline";
export { Tweens, Easings } from "./core/tween";
export type { Easing } from "./core/tween";
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
export { loadContainer, createHdrEnvironment, disposeOrphanSkeletons } from "./assets/assetService";
export type { HdrEnvOptions } from "./assets/assetService";
export { assetUrl } from "./assets/assetUrl";
