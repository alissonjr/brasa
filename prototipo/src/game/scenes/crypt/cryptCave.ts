import { Color3, DynamicTexture, Mesh, MeshBuilder, StandardMaterial, Texture, Vector3, VertexData } from "@babylonjs/core";
import type { Scene } from "@babylonjs/core";

/**
 * CAMADA JOGO (Brasa). CAVERNA em volta do santuario (camera alta orbital). Em vez de paredes
 * altas que a camera atravessaria ao girar, a sala fica no fundo de uma caverna: a rocha sobe
 * em rampa por fora do muro baixo, sempre ABAIXO da linha de visao entre a camera (que olha
 * ~43 graus para baixo) e o heroi, entao nada tapa a tela em nenhum angulo e nada precisa
 * subir ou descer. O relevo e facetado (low-poly) e recebe a mesma luz/neblina da sala.
 *
 * Geometria da regra: com o heroi na borda da sala, a linha de visao sobe ~0,82 m por metro
 * em direcao a camera; a rampa sobe ~0,45 m/m (+ leve curvatura), e as rochas por cima tem
 * altura limitada por essa mesma linha. Ver `caveHeight` e `rockCap`.
 */
const REACH = 26; // alcance da rampa alem da borda da sala (m)
const CELL = 2; // lado da celula do relevo (m)
const EDGE = 0.5; // a rampa comeca meio metro alem do eixo das paredes

/** Altura da rampa a `d` metros da borda da sala (d <= 0: dentro, sob a laje). */
export function caveHeight(d: number): number {
  return d <= 0 ? -0.6 : 0.9 + 0.45 * d + 0.012 * d * d;
}

/** Altura maxima de uma rocha sobre a rampa a `d` metros da borda (abaixo da linha de visao). */
function rockCap(d: number): number {
  return d < 14 ? 0.9 * (0.3 + 0.2 * d) : 4;
}

function seeded(seed: number): () => number {
  let a = (seed * 2654435761) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rockTexture(scene: Scene, rnd: () => number): DynamicTexture {
  const size = 256;
  const tex = new DynamicTexture("cavernaTex", { width: size, height: size }, scene, true);
  const c = tex.getContext() as unknown as CanvasRenderingContext2D;
  c.fillStyle = "#6a7282";
  c.fillRect(0, 0, size, size);
  for (let i = 0; i < 260; i++) {
    const cx = rnd() * size;
    const cy = rnd() * size;
    const r = 8 + rnd() * 30;
    const v = 84 + Math.floor(rnd() * 62);
    c.fillStyle = `rgba(${v},${v + 4},${v + 14},0.34)`;
    c.beginPath();
    const n = 5 + Math.floor(rnd() * 3);
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2 + rnd() * 0.5;
      const rr = r * (0.6 + rnd() * 0.5);
      const px = cx + Math.cos(a) * rr;
      const py = cy + Math.sin(a) * rr;
      if (k === 0) c.moveTo(px, py);
      else c.lineTo(px, py);
    }
    c.closePath();
    c.fill();
  }
  c.strokeStyle = "rgba(8,10,16,0.5)";
  c.lineWidth = 1.2;
  for (let i = 0; i < 16; i++) {
    let x = rnd() * size;
    let y = rnd() * size;
    c.beginPath();
    c.moveTo(x, y);
    for (let k = 0; k < 5; k++) {
      x += (rnd() - 0.5) * 46;
      y += (rnd() - 0.5) * 46;
      c.lineTo(x, y);
    }
    c.stroke();
  }
  tex.update();
  tex.wrapU = Texture.WRAP_ADDRESSMODE;
  tex.wrapV = Texture.WRAP_ADDRESSMODE;
  return tex;
}

/** Monta o relevo da caverna e as rochas soltas. Devolve as malhas (o chamador as prende na sala). */
export function buildCave(scene: Scene, o: { halfX: number; halfZ: number; seed: number }): Mesh[] {
  const rnd = seeded(o.seed * 977 + 13);
  const mat = new StandardMaterial("cavernaMat", scene);
  mat.diffuseTexture = rockTexture(scene, rnd);
  mat.diffuseColor = Color3.FromHexString("#5d6676"); // basalto frio, mais escuro que o piso: a rocha recua
  mat.emissiveColor = Color3.FromHexString("#0f131b"); // piso minimo de luz: nao some no escuro nem estoura
  mat.specularColor = Color3.Black();

  const dist = (x: number, z: number): number =>
    Math.hypot(Math.max(Math.abs(x) - o.halfX - EDGE, 0), Math.max(Math.abs(z) - o.halfZ - EDGE, 0));
  const inRoom = (x: number, z: number): boolean => Math.abs(x) <= o.halfX + EDGE && Math.abs(z) <= o.halfZ + EDGE;

  // Relevo: grade regular, altura = rampa + ruido que cresce com a distancia.
  const nx = Math.ceil((o.halfX + EDGE + REACH) / CELL);
  const nz = Math.ceil((o.halfZ + EDGE + REACH) / CELL);
  const cols = nx * 2 + 1;
  const rows = nz * 2 + 1;
  const positions: number[] = [];
  const uvs: number[] = [];
  for (let iz = 0; iz < rows; iz++) {
    for (let ix = 0; ix < cols; ix++) {
      const x = (ix - nx) * CELL;
      const z = (iz - nz) * CELL;
      const d = dist(x, z);
      const noise = inRoom(x, z) ? 0 : (rnd() - 0.5) * (0.5 + 0.14 * d);
      positions.push(x, caveHeight(d) + noise, z);
      uvs.push(x / 7, z / 7);
    }
  }
  const indices: number[] = [];
  for (let iz = 0; iz < rows - 1; iz++) {
    for (let ix = 0; ix < cols - 1; ix++) {
      const a = iz * cols + ix;
      const b = a + 1;
      const c = a + cols;
      const e = c + 1;
      indices.push(a, b, c, b, e, c); // anti-horario visto de cima (a face de cima e a frontal)
    }
  }
  const terrain = new Mesh("caverna", scene);
  const vd = new VertexData();
  vd.positions = positions;
  vd.indices = indices;
  vd.uvs = uvs;
  const normals: number[] = [];
  VertexData.ComputeNormals(positions, indices, normals);
  vd.normals = normals;
  vd.applyToMesh(terrain);
  terrain.convertToFlatShadedMesh(); // facetado: leitura low-poly e luz por face
  terrain.material = mat;
  terrain.receiveShadows = true;
  terrain.isPickable = false;
  terrain.metadata = { noOutline: true };

  // Rochas e estalagmites soltos na rampa (fundidos numa malha so), sempre dentro do teto de altura.
  const parts: Mesh[] = [];
  for (let i = 0; i < 150; i++) {
    const x = (rnd() * 2 - 1) * (o.halfX + EDGE + 20);
    const z = (rnd() * 2 - 1) * (o.halfZ + EDGE + 20);
    const d = dist(x, z);
    if (inRoom(x, z) || d < 1.2 || d > 20) continue;
    const h = Math.min(rockCap(d), 0.5 + rnd() * 2.6);
    const w = h * (0.7 + rnd() * 0.9);
    const spike = rnd() < 0.35 && d > 4;
    const m = spike
      ? MeshBuilder.CreateCylinder(`estalagmite_${i}`, { diameterTop: 0, diameterBottom: Math.max(0.5, w * 0.7), height: h, tessellation: 5 }, scene)
      : MeshBuilder.CreatePolyhedron(`rocha_${i}`, { type: 3, size: 0.5 }, scene);
    if (!spike) m.scaling.set(w, h, w * (0.8 + rnd() * 0.4));
    m.rotation.y = rnd() * Math.PI * 2;
    const base = caveHeight(d);
    m.position = new Vector3(x, base - h * 0.12 + (spike ? h / 2 : h * 0.4), z);
    m.bakeCurrentTransformIntoVertices();
    parts.push(m);
  }
  const rocks = parts.length ? Mesh.MergeMeshes(parts, true, true) : null;
  if (rocks) {
    rocks.name = "rochas_caverna";
    rocks.convertToFlatShadedMesh();
    rocks.material = mat;
    rocks.isPickable = false;
    rocks.receiveShadows = true;
    rocks.metadata = { noOutline: true };
  }
  return rocks ? [terrain, rocks] : [terrain];
}
