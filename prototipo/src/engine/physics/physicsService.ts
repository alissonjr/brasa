import { HavokPlugin } from "@babylonjs/core";
import type { Scene, Vector3 } from "@babylonjs/core";
import HavokPhysics from "@babylonjs/havok";

/**
 * CAMADA ENGINE. Carrega o módulo WASM do Havok e habilita a física v2 na cena.
 *
 * A gravidade é injetada (valor de tuning do JOGO, ver game/content/world.ts), para
 * a engine de física não embutir nada específico do jogo.
 *
 * O build ESM do Havok localiza o .wasm via `new URL("HavokPhysics.wasm",
 * import.meta.url)`; o Vite resolve esse asset no dev e no build (com o pacote
 * em optimizeDeps.exclude, ver vite.config.ts).
 */
export async function enableHavokPhysics(scene: Scene, gravity: Vector3): Promise<HavokPlugin> {
  const havok = await HavokPhysics();
  const plugin = new HavokPlugin(true, havok);
  scene.enablePhysics(gravity, plugin);
  return plugin;
}
