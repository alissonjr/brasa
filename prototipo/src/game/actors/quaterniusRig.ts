import { ImportMeshAsync, TransformNode } from "@babylonjs/core";
import type { AnimationGroup, Node, Scene } from "@babylonjs/core";
import "@babylonjs/loaders/glTF";
import { assetUrl } from "@engine";

/**
 * CAMADA JOGO (Brasa). Rig compartilhado dos personagens humanoides (heroína e mortos): família
 * Quaternius (Universal Base Characters + Modular Outfits Fantasy, CC0), 23 ossos sem dedos.
 * As animações vêm de UMA biblioteca (anim.glb: clipes das Universal Animation Library 1 e 2,
 * CC0) e são RETARGETADAS por nome de osso para cada instância: o clipe é clonado com um
 * conversor de alvo que troca o nó da biblioteca pelo osso de mesmo nome do personagem.
 * Ver tools/personagens/ (gerar.py) e public/models/CREDITS.txt.
 */
export const PERSONAGENS_DIR = "/models/personagens/";

const libs = new WeakMap<Scene, Promise<AnimationGroup[]>>();

/** Carrega a biblioteca de clipes uma vez por cena (os nós ficam parados e sem malha). */
export function loadAnimLibrary(scene: Scene): Promise<AnimationGroup[]> {
  let p = libs.get(scene);
  if (!p) {
    p = ImportMeshAsync(assetUrl(PERSONAGENS_DIR + "anim.glb"), scene, { pluginExtension: ".glb" }).then((r) => {
      for (const g of r.animationGroups) g.stop();
      for (const m of r.meshes) m.setEnabled(false);
      return r.animationGroups;
    });
    libs.set(scene, p);
  }
  return p;
}

/**
 * Clona os clipes pedidos para o personagem cujo esqueleto vive sob `root`. `wanted` mapeia o
 * nome LÓGICO (idle, walk, ...) para o nome do clipe na biblioteca. Clipes ausentes são
 * ignorados (o chamador cai no idle).
 */
export function retargetClips<K extends string>(
  lib: AnimationGroup[], root: TransformNode, tag: string, wanted: Record<K, string>,
): Partial<Record<K, AnimationGroup>> {
  const nos = new Map<string, TransformNode>();
  for (const n of root.getChildTransformNodes(false)) nos.set(n.name, n as TransformNode);
  // Alvo de descarte para ossos que o personagem não tem (nó órfão, sem custo visual).
  const lixo = new TransformNode("lixo_" + tag, root.getScene());
  lixo.parent = root;
  const out: Partial<Record<K, AnimationGroup>> = {};
  for (const k of Object.keys(wanted) as K[]) {
    const g = lib.find((l) => l.name === wanted[k]);
    if (!g) continue;
    const c = g.clone(`${tag}_${k}`, (t) => nos.get((t as { name: string }).name) ?? lixo, true);
    c.stop();
    out[k] = c;
  }
  return out;
}

/** Olhos do corpo Quaternius são um remendo de pele ao redor do globo: sem contorno de tinta (viraria "óculos"). */
export function semContornoNosOlhos(root: Node): void {
  for (const m of root.getChildMeshes(false)) if (/olhos/i.test(m.name)) m.metadata = { ...(m.metadata ?? {}), noOutline: true };
}
