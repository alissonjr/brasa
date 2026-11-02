import { Color3, PBRMaterial, StandardMaterial } from "@babylonjs/core";
import type { BaseTexture, Material, Node, Scene } from "@babylonjs/core";
import { CellMaterial } from "@babylonjs/materials/cell";

/**
 * CAMADA ENGINE (genérica). Converte materiais LIT (StandardMaterial/PBRMaterial vindos do
 * glTF) para CellMaterial (cel/toon: a luz cai em FAIXAS, não em gradiente). Preserva a
 * textura-atlas e a cor-base, então o atlas do KayKit continua valendo. O CellMaterial do
 * @babylonjs/materials inclui sombra e luz no shader, então o cenário CONTINUA recebendo a
 * sombra PCF da cena.
 *
 * Ver docs/brasa/spec-estilo-visual-render.md §4.1(a). Usado no MUNDO (cenário), NUNCA nos
 * atores (que mantêm StandardMaterial para o emissivo de combate, §4.1b) nem nos emissivos
 * (chamas/feixe/decalques têm disableLighting=true e são pulados por padrão).
 */

export interface ToonOptions {
  /** Faixas suaves (computeHighLevel) vs. duras. Default true (mais suave). */
  highLevel?: boolean;
  /** Pula materiais com disableLighting (emissivos: chamas, feixe, decalques). Default true. */
  skipDisableLighting?: boolean;
  /** Máximo de luzes simultâneas (a cena usa 6 para não descartar a ambiente). Default 6. */
  maxLights?: number;
  /**
   * Cache PERSISTENTE de CellMaterials (sobrevive ao descarte da sala). Com ele, materiais-fonte
   * equivalentes (mesmo nome, cor e textura: o KayKit repete "Stone", "Metal"... em cada glb)
   * viram UM CellMaterial para a cena toda, em vez de um por peça por sala. O dono do cache é
   * quem libera; quem descarta a sala precisa soltar `mesh.material` desses antes de descartar
   * com materiais (ver isCachedToon).
   */
  cache?: Map<string, CellMaterial>;
  /** Tinta por material (só com `cache`): devolve a cor final do material (unifica paleta entre pacotes). */
  recolor?: (name: string, color: Color3) => Color3;
}

/** Lê a textura/cor difusa de um Standard ou PBR (o que houver). */
function readDiffuse(src: Material): { tex: BaseTexture | null; color: Color3 } {
  if (src instanceof StandardMaterial) {
    return { tex: src.diffuseTexture ?? null, color: src.diffuseColor?.clone() ?? Color3.White() };
  }
  if (src instanceof PBRMaterial) {
    return { tex: src.albedoTexture ?? null, color: src.albedoColor?.clone() ?? Color3.White() };
  }
  return { tex: null, color: Color3.White() };
}

function isLit(src: Material): boolean {
  const dl = (src as unknown as { disableLighting?: boolean }).disableLighting;
  return dl !== true;
}

/**
 * Converte a hierarquia para toon, reusando UM CellMaterial por material-fonte (o atlas do
 * KayKit é compartilhado por muitas malhas; o cache evita duplicar materiais). Devolve os
 * CellMaterials criados (para dispose, se preciso).
 */
export function toonifyHierarchy(root: Node, opts: ToonOptions = {}): CellMaterial[] {
  const scene = root.getScene();
  const skipDL = opts.skipDisableLighting ?? true;
  const maxLights = opts.maxLights ?? 6;
  const highLevel = opts.highLevel ?? true;
  const cache = new Map<Material, CellMaterial>();
  const shared = opts.cache;

  for (const mesh of root.getChildMeshes(false)) {
    const src = mesh.material;
    if (!src || src instanceof CellMaterial) continue;
    // Só converte materiais LIT conhecidos. MultiMaterial e afins ficam como estão (evita
    // blank-white se uma malha mesclada trouxe submateriais).
    if (!(src instanceof StandardMaterial || src instanceof PBRMaterial)) continue;
    if (skipDL && !isLit(src)) continue; // emissivos (chamas/feixe/decalque): deixa liso
    let cell = cache.get(src);
    if (!cell) {
      cell = shared ? sharedCell(scene, src, shared, { highLevel, maxLights }, opts.recolor) : makeCell(scene, src, { highLevel, maxLights });
      cache.set(src, cell);
    }
    mesh.material = cell;
  }
  return [...new Set(cache.values())];
}

function sharedCell(
  scene: Scene,
  src: Material,
  shared: Map<string, CellMaterial>,
  o: { highLevel: boolean; maxLights: number },
  recolor?: (name: string, color: Color3) => Color3
): CellMaterial {
  const { tex, color } = readDiffuse(src);
  const key = `${src.name}|${color.r.toFixed(3)},${color.g.toFixed(3)},${color.b.toFixed(3)}|${tex?.name ?? ""}|${src.backFaceCulling ? 1 : 0}`;
  let cell = shared.get(key);
  if (!cell) {
    cell = makeCell(scene, src, o);
    if (recolor) cell.diffuseColor = recolor(src.name, cell.diffuseColor);
    shared.set(key, cell);
  }
  return cell;
}

/**
 * CellMaterial persistente equivalente a um material-fonte LIT (Standard/PBR), ou null se o
 * material não é convertível (emissivo/disableLighting, Multi, desconhecido). Usa o `cache`
 * compartilhado (mesma chave de toonifyHierarchy com `cache`).
 */
export function toonMaterialFor(scene: Scene, src: Material | null, opts: ToonOptions & { cache: Map<string, CellMaterial> }): CellMaterial | null {
  if (!src) return null;
  if (src instanceof CellMaterial) return src;
  if (!(src instanceof StandardMaterial || src instanceof PBRMaterial)) return null;
  if ((opts.skipDisableLighting ?? true) && !isLit(src)) return null;
  return sharedCell(scene, src, opts.cache, { highLevel: opts.highLevel ?? true, maxLights: opts.maxLights ?? 6 }, opts.recolor);
}

/** true se o material é um CellMaterial de um cache persistente (não pode ser descartado com a sala). */
export function isCachedToon(mat: Material | null | undefined, cache: Map<string, CellMaterial>): boolean {
  if (!mat) return false;
  for (const c of cache.values()) if (c === mat) return true;
  return false;
}

function makeCell(scene: Scene, src: Material, o: { highLevel: boolean; maxLights: number }): CellMaterial {
  const { tex, color } = readDiffuse(src);
  const cell = new CellMaterial(src.name + "_cell", scene);
  cell.computeHighLevel = o.highLevel;
  if (tex) cell.diffuseTexture = tex;
  cell.diffuseColor = color;
  cell.backFaceCulling = src.backFaceCulling;
  cell.maxSimultaneousLights = o.maxLights;
  return cell;
}
