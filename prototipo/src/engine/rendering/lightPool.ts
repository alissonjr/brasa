import { Color3, Constants, DynamicTexture, Mesh, MeshBuilder, StandardMaterial, VertexBuffer, VertexData } from "@babylonjs/core";
import type { Scene } from "@babylonjs/core";

/**
 * CAMADA ENGINE (genérica). "Poça de luz": disco achatado, aditivo e sem iluminação, com
 * gradiente radial, que simula o halo de uma fonte quente no chão (tocha, braseiro,
 * lanterna). Barato (1 malha, sem luz real) e dá o contraste quente/frio que a luz de
 * ponto sozinha não entrega em visão alta. Cada poça tem material e textura próprios, então
 * `mesh.dispose(false, true)` (ou o dispose do pai com materiais) a libera por completo.
 */
export interface LightPoolOptions {
  /** Raio do halo, em unidades de mundo. */
  radius: number;
  /** Cor do halo (hex). */
  color: string;
  /** Opacidade máxima no centro (0..1). */
  alpha: number;
  /** Altura sobre o piso. */
  y?: number;
}

/** Gradiente radial da poça (queda suave e longa, sem aro na borda), como textura de opacidade. */
function makePoolTexture(scene: Scene): DynamicTexture {
  const tex = new DynamicTexture("poolTex", { width: 128, height: 128 }, scene, false);
  const ctx = tex.getContext() as CanvasRenderingContext2D;
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  // Queda suave e longa (sem aro visível na borda): curva ~gaussiana em vários degraus.
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.2, "rgba(255,255,255,0.72)");
  g.addColorStop(0.42, "rgba(255,255,255,0.34)");
  g.addColorStop(0.65, "rgba(255,255,255,0.12)");
  g.addColorStop(0.85, "rgba(255,255,255,0.03)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  tex.update();
  tex.hasAlpha = true;
  return tex;
}

export function createLightPool(scene: Scene, o: LightPoolOptions): Mesh {
  const tex = makePoolTexture(scene);

  const mat = new StandardMaterial("poolMat", scene);
  mat.disableLighting = true;
  mat.emissiveColor = Color3.FromHexString(o.color);
  mat.diffuseColor = Color3.Black();
  mat.specularColor = Color3.Black();
  mat.opacityTexture = tex;
  mat.alpha = o.alpha;
  mat.alphaMode = Constants.ALPHA_ADD;
  mat.backFaceCulling = false;
  mat.zOffset = -2;

  const disc = MeshBuilder.CreateDisc("poca_de_luz", { radius: o.radius, tessellation: 40 }, scene);
  disc.rotation.x = Math.PI / 2;
  disc.position.y = o.y ?? 0.08;
  disc.material = mat;
  disc.isPickable = false;
  disc.receiveShadows = false;
  disc.metadata = { noOutline: true }; // o halo não leva contorno de tinta
  return disc;
}

export interface LightPoolSpec {
  x: number;
  z: number;
  /** Raio do halo, em unidades de mundo. */
  r: number;
  /** Cor do halo (hex). */
  color: string;
  /** Opacidade máxima inicial (0..1). */
  alpha: number;
}

export interface LightPoolBatch {
  /** Malha única (1 draw call) com todas as poças. */
  mesh: Mesh;
  /** Muda a opacidade da poça `i` (aplicada no próximo `flush`). */
  setAlpha(i: number, alpha: number): void;
  /** Escala a poça `i` em torno do seu centro (aplicada no próximo `flush`). */
  setScale(i: number, k: number): void;
  /** Envia ao GPU o que mudou (cor/opacidade/posições). Barato: poucos vértices. */
  flush(): void;
}

/**
 * Várias poças de luz numa malha só (1 draw call para todas, qualquer cor): cada poça é um quad
 * com o gradiente radial (o disco antigo só recortava o círculo que o gradiente já zera na borda),
 * a cor vai nos vértices (RGB) e a opacidade no alfa do vértice. Material aditivo, sem iluminação,
 * como createLightPool. Devolve null se não houver poças.
 */
export function createLightPoolBatch(scene: Scene, specs: LightPoolSpec[], y = 0.08): LightPoolBatch | null {
  if (specs.length === 0) return null;
  const n = specs.length;
  const pos = new Float32Array(n * 12);
  const base = new Float32Array(n * 12); // posições na escala 1 (para reescalar)
  const col = new Float32Array(n * 16);
  const uv = new Float32Array(n * 8);
  const idx = new Uint16Array(n * 6);
  const centers: [number, number][] = [];
  const corners: [number, number][] = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  const uvs: [number, number][] = [[0, 0], [1, 0], [1, 1], [0, 1]];
  for (let i = 0; i < n; i++) {
    const s = specs[i]!;
    const c = Color3.FromHexString(s.color);
    centers.push([s.x, s.z]);
    for (let k = 0; k < 4; k++) {
      const o = i * 12 + k * 3;
      base[o] = s.x + corners[k]![0] * s.r;
      base[o + 1] = y;
      base[o + 2] = s.z + corners[k]![1] * s.r;
      pos[o] = base[o]!; pos[o + 1] = base[o + 1]!; pos[o + 2] = base[o + 2]!;
      const co = i * 16 + k * 4;
      col[co] = c.r; col[co + 1] = c.g; col[co + 2] = c.b; col[co + 3] = s.alpha;
      uv[i * 8 + k * 2] = uvs[k]![0];
      uv[i * 8 + k * 2 + 1] = uvs[k]![1];
    }
    // enrolamento voltado para cima (o material desliga o culling de qualquer jeito)
    const v = i * 4;
    idx.set([v, v + 2, v + 1, v, v + 3, v + 2], i * 6);
  }
  const vd = new VertexData();
  vd.positions = Array.from(pos);
  vd.indices = Array.from(idx);
  vd.uvs = Array.from(uv);
  vd.colors = Array.from(col);
  vd.normals = Array.from({ length: n * 12 }, (_, i) => (i % 3 === 1 ? 1 : 0));
  const mesh = new Mesh("poca_de_luz_lote", scene);
  vd.applyToMesh(mesh, true);
  mesh.hasVertexAlpha = true;
  mesh.isPickable = false;
  mesh.receiveShadows = false;
  mesh.metadata = { noOutline: true, noDepth: true }; // o halo não leva contorno de tinta
  const mat = new StandardMaterial("poolBatchMat", scene);
  mat.disableLighting = true;
  mat.emissiveColor = Color3.White(); // a cor vem dos vértices
  mat.diffuseColor = Color3.Black();
  mat.specularColor = Color3.Black();
  mat.opacityTexture = makePoolTexture(scene);
  mat.alphaMode = Constants.ALPHA_ADD;
  mat.backFaceCulling = false;
  mat.zOffset = -2;
  mesh.material = mat;
  let colDirty = false;
  let posDirty = false;
  return {
    mesh,
    setAlpha(i, alpha): void {
      for (let k = 0; k < 4; k++) col[i * 16 + k * 4 + 3] = alpha;
      colDirty = true;
    },
    setScale(i, k): void {
      const [cx, cz] = centers[i]!;
      for (let v = 0; v < 4; v++) {
        const o = i * 12 + v * 3;
        pos[o] = cx + (base[o]! - cx) * k;
        pos[o + 2] = cz + (base[o + 2]! - cz) * k;
      }
      posDirty = true;
    },
    flush(): void {
      if (colDirty) { mesh.updateVerticesData(VertexBuffer.ColorKind, col); colDirty = false; }
      if (posDirty) { mesh.updateVerticesData(VertexBuffer.PositionKind, pos); posDirty = false; }
    },
  };
}
