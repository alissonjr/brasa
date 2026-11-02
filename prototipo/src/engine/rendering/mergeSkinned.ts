import { Mesh, VertexData } from "@babylonjs/core";
import type { AbstractMesh, Material, Node, Skeleton } from "@babylonjs/core";

/**
 * CAMADA ENGINE (genérica). Funde as partes SKINNED de um personagem que dividem o mesmo
 * esqueleto, o mesmo material e o mesmo pai (braço, perna, corpo, cabeça... do KayKit) numa
 * malha só. Cada parte custa um draw call por passe (principal, profundidade, sombra e
 * contorno); um morto de 9 partes custava ~36 por frame, fundido custa ~8.
 *
 * Os vértices ficam no espaço LOCAL de cada parte (sem baixar a matriz de mundo para dentro
 * deles, como o Mesh.MergeMeshes faz, o que dobraria a transformação do esqueleto). Só
 * funde partes cuja matriz local seja idêntica; senão deixa como está.
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

/** Devolve as malhas fundidas (uma por grupo esqueleto+material). Partes isoladas ficam intactas. */
export function mergeSkinnedParts(root: Node, opts: MergeSkinnedOptions = {}): Mesh[] {
  const groups = new Map<string, Mesh[]>();
  const skelOf = new Map<string, Skeleton>();
  for (const m of root.getChildMeshes(false)) {
    if (!(m instanceof Mesh) || !m.skeleton || m.getTotalVertices() <= 0 || !m.material) continue;
    if (opts.exclude?.test(m.name)) continue;
    const key = `${m.skeleton.uniqueId}|${m.material.uniqueId}|${m.parent?.uniqueId ?? 0}`;
    let g = groups.get(key);
    if (!g) groups.set(key, (g = []));
    g.push(m);
    skelOf.set(key, m.skeleton);
  }
  const out: Mesh[] = [];
  for (const [key, parts] of groups) {
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
    mesh.skeleton = skelOf.get(key)!;
    mesh.numBoneInfluencers = Math.max(...parts.map((p) => p.numBoneInfluencers));
    mesh.isPickable = false;
    mesh.receiveShadows = first.receiveShadows;
    mesh.alwaysSelectAsActiveMesh = true; // pose animada pode sair da caixa do bind-pose
    for (const p of parts) p.dispose(false, false); // não derruba material/texturas compartilhados
    out.push(mesh);
  }
  return out;
}
