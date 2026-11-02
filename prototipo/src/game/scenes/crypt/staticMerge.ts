import { Mesh, MultiMaterial, StandardMaterial, VertexData } from "@babylonjs/core";
import type { AbstractMesh, Color3, Material, Matrix, Node, Scene } from "@babylonjs/core";

/**
 * CAMADA JOGO (Brasa). Funde o cenário ESTÁTICO da sala (props avulsos clonados, bases de
 * thin instances de parede/pilar/tocha...) em UMA malha por material (e por "projeta sombra").
 * O kit KayKit usa poucos materiais de cor chapada repetidos (Stone, Metal, WoodDark...), então
 * a sala inteira cabe em ~12 draw calls em vez de dezenas de props (cada peça multi-material
 * custava 2 a 4 draw calls por passe: principal, profundidade e sombra).
 *
 * As matrizes de mundo e de cada thin instance são embutidas nos vértices. Quem quer que uma
 * peça continue independente (alçapão, vasos que quebram, cadeira que tomba) a exclui em
 * `eligible`. Malhas skinned, com morph ou sem material ficam como estão.
 */

export interface StaticMergeOptions {
  /** A malha entra na fusão? (já filtrado: tem geometria e material). */
  eligible(m: AbstractMesh): boolean;
  /**
   * Material final de um material-fonte (ex.: o CellMaterial persistente), ou null para deixar a
   * malha intacta. Com `color`, o material é UM só (branco) para todas as cores: a cor vai nos
   * vértices (vertex color), e peças de materiais-fonte diferentes caem na MESMA malha.
   */
  resolve(src: Material): { material: Material; color?: Color3 } | null;
  /** A malha projeta sombra? Fundem-se separadamente (sombra só dos que projetam). */
  casts(m: AbstractMesh): boolean;
  /**
   * Grupo opcional da malha (ex.: um vaso que quebra). As faixas de vértices de cada grupo ficam em
   * `merged[i].ranges`, e a malha fundida sai ATUALIZÁVEL: quem quebra o grupo zera esses vértices.
   */
  tag?(m: AbstractMesh): string | null;
  /**
   * Com `true`, a malha fundida NÃO se divide por "projeta sombra" (1 malha por material: menos draw
   * calls no passe principal) e a geometria das peças que projetam vai para uma malha-sombra à parte,
   * invisível para a câmera (`result.shadowProxy`), que o chamador registra no gerador de sombra.
   */
  shadowProxy?: boolean;
  parent: Node;
}

export interface StaticMergeResult {
  /** Malhas novas (para o chamador registrar casters e rastrear o descarte). */
  merged: { mesh: Mesh; casts: boolean; ranges?: Map<string, { start: number; count: number }[]> }[];
  /** Malhas de origem já descartadas (para tirar da lista de casters). */
  removed: AbstractMesh[];
  /** Geometria só das peças que projetam sombra (só com `opts.shadowProxy`): registrar como caster. */
  shadowProxy: Mesh | null;
}

interface Acc {
  material: Material;
  casts: boolean;
  pos: number[];
  nor: number[];
  uv: number[];
  col: number[] | null;
  hasUv: boolean;
  /** Orientação de face das malhas de origem (o loader glTF marca as dele; o resto usa a padrão). */
  side: number | null;
  idx: number[];
  vertexCount: number;
  ranges: Map<string, { start: number; count: number }[]> | null;
}

function pushTransformed(acc: Acc, vd: VertexData, m: Matrix, flip: boolean, color: Color3 | undefined, range?: { start: number; count: number }): void {
  const p = vd.positions!;
  const n = vd.normals;
  const mm = m.m;
  const base = acc.vertexCount;
  // Submalha: usa só os vértices que os triângulos da faixa referenciam (compacta e reindexa).
  let used: number[] | null = null;
  let remap: Map<number, number> | null = null;
  let ind = vd.indices!;
  if (range) {
    remap = new Map();
    used = [];
    const sub = Array.from(ind as ArrayLike<number>).slice(range.start, range.start + range.count);
    for (const v of sub) if (!remap.has(v)) { remap.set(v, used.length); used.push(v); }
    ind = sub.map((v) => remap!.get(v)!) as unknown as typeof ind;
  }
  const count = used ? used.length : p.length / 3;
  for (let ii = 0; ii < count; ii++) {
    const i = used ? used[ii]! : ii;
    const x = p[i * 3]!, y = p[i * 3 + 1]!, z = p[i * 3 + 2]!;
    acc.pos.push(
      x * mm[0]! + y * mm[4]! + z * mm[8]! + mm[12]!,
      x * mm[1]! + y * mm[5]! + z * mm[9]! + mm[13]!,
      x * mm[2]! + y * mm[6]! + z * mm[10]! + mm[14]!
    );
    if (n) {
      const nx = n[i * 3]!, ny = n[i * 3 + 1]!, nz = n[i * 3 + 2]!;
      const tx = nx * mm[0]! + ny * mm[4]! + nz * mm[8]!;
      const ty = nx * mm[1]! + ny * mm[5]! + nz * mm[9]!;
      const tz = nx * mm[2]! + ny * mm[6]! + nz * mm[10]!;
      const l = Math.hypot(tx, ty, tz) || 1;
      acc.nor.push(tx / l, ty / l, tz / l);
    } else acc.nor.push(0, 1, 0);
    if (vd.uvs) acc.uv.push(vd.uvs[i * 2]!, vd.uvs[i * 2 + 1]!);
    else acc.uv.push(0, 0);
    if (color && acc.col) acc.col.push(color.r, color.g, color.b, 1);
  }
  if (vd.uvs) acc.hasUv = true;
  // espelhamento da MALHA (determinante negativo do mundo) inverte o enrolamento; o das instâncias o Babylon ignora
  if (flip) for (let i = 0; i < ind.length; i += 3) acc.idx.push(base + ind[i]!, base + ind[i + 2]!, base + ind[i + 1]!);
  else for (let i = 0; i < ind.length; i++) acc.idx.push(base + ind[i]!);
  acc.vertexCount += count;
}

export function mergeStaticByMaterial(scene: Scene, root: Node, opts: StaticMergeOptions): StaticMergeResult {
  const accs = new Map<string, Acc>();
  const removed: AbstractMesh[] = [];
  const sh: Acc = { material: null as unknown as Material, casts: true, pos: [], nor: [], uv: [], col: null, hasUv: false, side: null, idx: [], vertexCount: 0, ranges: null };
  for (const m of root.getChildMeshes(false)) {
    if (!(m instanceof Mesh) || m.skeleton || m.morphTargetManager) continue;
    if (!m.material || m.getTotalVertices() <= 0 || !m.isEnabled() || !opts.eligible(m)) continue;
    const multi = m.material instanceof MultiMaterial;
    // resolve TODOS os (sub)materiais antes de tocar a malha: tudo ou nada
    const subs = multi ? (m.material as MultiMaterial).subMaterials : [m.material];
    const resolved = subs.map((sm) => (sm ? opts.resolve(sm) : null));
    type Res = { material: Material; color?: Color3 };
    const usedSubs = multi ? m.subMeshes.map((sub) => sub.materialIndex) : [0];
    if (usedSubs.some((i) => !resolved[i])) continue;
    const vd = VertexData.ExtractFromMesh(m, false, false);
    if (!vd.positions || !vd.indices) continue;
    const casts = opts.casts(m);
    const world = m.computeWorldMatrix(true);
    const inst = m.thinInstanceCount > 0 ? m.thinInstanceGetWorldMatrices() : null;
    const mats = inst && inst.length > 0 ? inst.map((im) => im.multiply(world)) : [world];
    const flip = world.determinant() < 0;
    const side = m.overrideMaterialSideOrientation ?? null;
    const parts: { res: Res; range?: { start: number; count: number } }[] = multi
      ? m.subMeshes.map((sub) => ({ res: resolved[sub.materialIndex]!, range: { start: sub.indexStart, count: sub.indexCount } }))
      : [{ res: resolved[0]! }];
    for (const part of parts) {
      const key = `${part.res.material.uniqueId}|${opts.shadowProxy ? 0 : casts ? 1 : 0}|${side}`;
      let acc = accs.get(key);
      if (!acc) accs.set(key, (acc = { material: part.res.material, casts, side, pos: [], nor: [], uv: [], col: part.res.color ? [] : null, hasUv: false, idx: [], vertexCount: 0, ranges: null }));
      if (opts.shadowProxy && casts) for (const mt of mats) pushTransformed(sh, vd, mt, flip, undefined, part.range);
      const tag = opts.tag?.(m) ?? null;
      for (const mt of mats) {
        const start = acc.vertexCount;
        pushTransformed(acc, vd, mt, flip, part.res.color, part.range);
        if (tag !== null) {
          if (!acc.ranges) acc.ranges = new Map();
          const list = acc.ranges.get(tag) ?? [];
          list.push({ start, count: acc.vertexCount - start });
          acc.ranges.set(tag, list);
        }
      }
    }
    removed.push(m);
  }
  const merged: StaticMergeResult["merged"] = [];
  let k = 0;
  for (const acc of accs.values()) {
    const vd = new VertexData();
    vd.positions = acc.pos;
    vd.normals = acc.nor;
    if (acc.hasUv) vd.uvs = acc.uv;
    if (acc.col) vd.colors = acc.col;
    vd.indices = acc.vertexCount > 65535 ? new Uint32Array(acc.idx) : new Uint16Array(acc.idx);
    const mesh = new Mesh(`cenario_${acc.material.name}_${acc.casts ? "c" : "n"}_${k++}`, scene);
    vd.applyToMesh(mesh, acc.ranges !== null);
    mesh.hasVertexAlpha = false;
    mesh.material = acc.material;
    if (acc.side !== null) mesh.overrideMaterialSideOrientation = acc.side;
    mesh.parent = opts.parent;
    mesh.isPickable = false;
    mesh.receiveShadows = true;
    mesh.freezeWorldMatrix();
    merged.push({ mesh, casts: acc.casts, ranges: acc.ranges ?? undefined });
  }
  let shadowProxy: Mesh | null = null;
  if (sh.vertexCount > 0) {
    const vd = new VertexData();
    vd.positions = sh.pos;
    vd.normals = sh.nor;
    vd.indices = sh.vertexCount > 65535 ? new Uint32Array(sh.idx) : new Uint16Array(sh.idx);
    shadowProxy = new Mesh("proxy_sombra", scene);
    vd.applyToMesh(shadowProxy, false);
    shadowProxy.material = new StandardMaterial("proxy_sombra_mat", scene);
    shadowProxy.layerMask = 0x20000000; // a câmera não o desenha; o mapa de sombra recebe-o por lista própria
    shadowProxy.parent = opts.parent;
    shadowProxy.isPickable = false;
    shadowProxy.metadata = { noDepth: true }; // fica fora do proxy de profundidade (nao e desenhado de fato)
    shadowProxy.freezeWorldMatrix();
  }
  for (const m of removed) m.dispose(false, false);
  return { merged, removed, shadowProxy };
}
