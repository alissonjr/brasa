import { Mesh, StandardMaterial, VertexData } from "@babylonjs/core";
import type { AbstractMesh, Camera, Nullable, Scene } from "@babylonjs/core";

/**
 * CAMADA ENGINE (genérica). Enxuga o PASSE DE PROFUNDIDADE (DepthRenderer) que alimenta o SSAO e o
 * edge-detect de cena. Esse passe redesenha toda malha ativa e, sozinho, era ~30% das chamadas de
 * desenho da sala. Duas ferramentas, sem mexer na imagem final:
 *
 *  1. PROXY ESTÁTICO: o cenário estático (piso, caverna, muros, estrutura...) entra no passe de
 *     profundidade como UMA malha só, só com posições (a profundidade não precisa de normal, cor nem
 *     material). As malhas originais saem do passe (`metadata.depthProxy = true`) e continuam
 *     normais no passe principal, na sombra e no glow. O proxy usa uma `layerMask` que a câmera
 *     não enxerga: o cenário principal nunca o desenha, e o DepthRenderer o recebe por lista própria.
 *  2. EXCLUSÃO: malhas minúsculas ou emissivas que não precisam de linha nem de AO (olhos, orbe da
 *     mão, chamas, pedaços de arma) saem do passe (`metadata.noDepth = true` ou o predicado `skip`).
 *
 * Decisão registrada em docs/brasa/orcamento-de-desempenho.md.
 */

/** Máscara de camada que nenhuma câmera do jogo usa (câmeras usam 0x0FFFFFFF). */
const PROXY_LAYER = 0x20000000;

export interface DepthPassOptions {
  /** Malhas que saem do passe por nome (olhos, orbe, pedaços de arma...). */
  skipName?: RegExp;
}

interface DepthPassState {
  proxies: Set<Mesh>;
  skipName: RegExp | null;
  scratch: AbstractMesh[];
}

const STATE = new WeakMap<Scene, DepthPassState>();

/** Liga o filtro do passe de profundidade da câmera (idempotente). Exige o DepthRenderer já habilitado. */
export function installDepthPass(scene: Scene, camera: Camera, opts: DepthPassOptions = {}): void {
  const renderer = scene.enableDepthRenderer(camera, false); // devolve o já habilitado desta câmera (SSAO e edge-detect o compartilham)
  let st = STATE.get(scene);
  if (st) {
    if (opts.skipName) st.skipName = opts.skipName;
    return;
  }
  st = { proxies: new Set(), skipName: opts.skipName ?? null, scratch: [] };
  STATE.set(scene, st);
  const state = st;
  renderer.getDepthMap().getCustomRenderList = (_pass: number, list: Nullable<readonly AbstractMesh[]>, length: number) => {
    if (!list) return null;
    const out = state.scratch;
    out.length = 0;
    for (let i = 0; i < length; i++) {
      const m = list[i] as AbstractMesh | undefined;
      if (!m) continue;
      const md = m.metadata as { depthProxy?: boolean; noDepth?: boolean } | null;
      if (md && (md.depthProxy || md.noDepth)) continue;
      if (state.skipName && state.skipName.test(m.name)) continue;
      out.push(m);
    }
    for (const p of state.proxies) if (p.isEnabled()) out.push(p);
    return out;
  };
}

export interface DepthProxyHandle {
  mesh: Mesh;
  dispose(): void;
}

/**
 * Funde as malhas dadas (já em seu estado final: matriz de mundo estável, thin instances
 * incluídas) numa malha só de posições e a registra como proxy de profundidade delas.
 * Devolve null se não houver geometria. As malhas de origem NÃO são descartadas: só marcadas.
 */
export function createDepthProxy(scene: Scene, name: string, sources: AbstractMesh[]): DepthProxyHandle | null {
  const st = STATE.get(scene);
  if (!st) return null;
  const pos: number[] = [];
  const idx: number[] = [];
  const marked: AbstractMesh[] = [];
  let vertexCount = 0;
  for (const m of sources) {
    if (!(m instanceof Mesh) || m.getTotalVertices() <= 0) continue;
    const vd = VertexData.ExtractFromMesh(m, false, false);
    if (!vd.positions || !vd.indices) continue;
    const world = m.computeWorldMatrix(true);
    const inst = m.thinInstanceCount > 0 ? m.thinInstanceGetWorldMatrices() : null;
    const mats = inst && inst.length > 0 ? inst.map((im) => im.multiply(world)) : [world];
    const p = vd.positions;
    const ind = vd.indices;
    for (const mt of mats) {
      const mm = mt.m;
      const flip = mt.determinant() < 0;
      for (let i = 0; i < p.length; i += 3) {
        const x = p[i]!, y = p[i + 1]!, z = p[i + 2]!;
        pos.push(
          x * mm[0]! + y * mm[4]! + z * mm[8]! + mm[12]!,
          x * mm[1]! + y * mm[5]! + z * mm[9]! + mm[13]!,
          x * mm[2]! + y * mm[6]! + z * mm[10]! + mm[14]!
        );
      }
      for (let i = 0; i < ind.length; i += 3) {
        if (flip) idx.push(vertexCount + ind[i]!, vertexCount + ind[i + 2]!, vertexCount + ind[i + 1]!);
        else idx.push(vertexCount + ind[i]!, vertexCount + ind[i + 1]!, vertexCount + ind[i + 2]!);
      }
      vertexCount += p.length / 3;
    }
    marked.push(m);
  }
  if (vertexCount === 0) return null;
  const vd = new VertexData();
  vd.positions = pos;
  vd.indices = vertexCount > 65535 ? new Uint32Array(idx) : new Uint16Array(idx);
  const mesh = new Mesh(name, scene);
  vd.applyToMesh(mesh, false);
  const mat = new StandardMaterial(name + "_mat", scene);
  mat.backFaceCulling = false; // profundidade: o mais próximo vence, os dois lados valem
  mesh.material = mat;
  mesh.layerMask = PROXY_LAYER;
  mesh.isPickable = false;
  mesh.alwaysSelectAsActiveMesh = true;
  mesh.freezeWorldMatrix();
  for (const m of marked) m.metadata = { ...(m.metadata as object | null), depthProxy: true };
  st.proxies.add(mesh);
  return {
    mesh,
    dispose(): void {
      st.proxies.delete(mesh);
      mat.dispose();
      mesh.dispose(false, false);
    },
  };
}
