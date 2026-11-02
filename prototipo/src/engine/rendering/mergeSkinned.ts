import { Mesh, VertexData } from "@babylonjs/core";
import type { AbstractMesh, Material, Node } from "@babylonjs/core";

/**
 * CAMADA ENGINE (genérica). Funde as partes SKINNED de um personagem que dividem a MESMA
 * instância de Skeleton, o mesmo material e o mesmo pai, numa malha só. Cada parte custa um
 * draw call por passe (principal, profundidade, sombra, contorno); n partes fundidas em 1
 * cortam ~4n chamadas por ator.
 *
 * API: `mergeSkinnedParts(root, { exclude? })` -> Mesh[] (as malhas fundidas; as partes
 * originais são descartadas SEM derrubar material/texturas). Chamar depois de instanciar o
 * modelo e ANTES de ligar contorno/sombra (os novos Mesh não herdam isso).
 *
 * Os vértices ficam no espaço LOCAL de cada parte (sem baixar a matriz de mundo para dentro
 * deles, como o Mesh.MergeMeshes faz, o que dobraria a transformação do esqueleto).
 *
 * LIMITE (medido em 2026-11): os GLB do KayKit (Rogue_Hooded, Skeleton_*) exportam UMA skin
 * por parte, cada qual com matrizes de bind-inverso DIFERENTES (o osso "hips" tem bind-inverso
 * distinto em cada skin). Essas partes têm Skeleton próprio, portanto NÃO são fundidas aqui
 * (fundir com o esqueleto de uma delas desmonta o personagem: braços e tronco colapsam). Já os
 * modelos de uma skin só (Quaternius: demon + tridente, orc + arma, mushroomking + chapéu)
 * compartilham o Skeleton e fundem de forma exata.
 */

export interface MergeSkinnedOptions {
  /** Partes que NÃO entram na fusão (por nome, regex). Ex.: olhos, que brilham à parte. */
  exclude?: RegExp;
}

function sameMatrix(a: AbstractMesh, b: AbstractMesh): boolean {
  const ma = a.computeWorldMatrix(true).m;
  const mb = b.computeWorldMatrix(true).m;
  for (let i = 0; i < 16; i++) if (Math.abs(ma[i]! - mb[i]!) > 1e-5) return false;
  return true;
}

/** Devolve as malhas fundidas (uma por grupo esqueleto+material+pai). Partes isoladas ficam intactas. */
export function mergeSkinnedParts(root: Node, opts: MergeSkinnedOptions = {}): Mesh[] {
  const groups = new Map<string, Mesh[]>();
  for (const m of root.getChildMeshes(false)) {
    if (!(m instanceof Mesh) || !m.skeleton || m.getTotalVertices() <= 0 || !m.material) continue;
    if (opts.exclude?.test(m.name)) continue;
    const key = `${m.skeleton.uniqueId}|${m.material.uniqueId}|${m.parent?.uniqueId ?? 0}`;
    let g = groups.get(key);
    if (!g) groups.set(key, (g = []));
    g.push(m);
  }
  const out: Mesh[] = [];
  for (const parts of groups.values()) {
    if (parts.length < 2) continue;
    const first = parts[0]!;
    if (!parts.every((p) => sameMatrix(first, p))) continue;
    const datas = parts.map((p) => VertexData.ExtractFromMesh(p, true, true));
    const merged = datas[0]!.merge(datas.slice(1), true, true);
    const mesh = new Mesh(`${first.name}_fundido`, first.getScene());
    merged.applyToMesh(mesh, false);
    mesh.parent = first.parent;
    mesh.position.copyFrom(first.position);
    if (first.rotationQuaternion) mesh.rotationQuaternion = first.rotationQuaternion.clone();
    else mesh.rotation.copyFrom(first.rotation);
    mesh.scaling.copyFrom(first.scaling);
    mesh.material = first.material as Material;
    mesh.skeleton = first.skeleton;
    mesh.numBoneInfluencers = Math.max(...parts.map((p) => p.numBoneInfluencers));
    mesh.isPickable = false;
    mesh.receiveShadows = first.receiveShadows;
    mesh.alwaysSelectAsActiveMesh = true; // pose animada pode sair da caixa do bind-pose
    for (const p of parts) p.dispose(false, false); // não derruba material/texturas compartilhados
    out.push(mesh);
  }
  return out;
}
