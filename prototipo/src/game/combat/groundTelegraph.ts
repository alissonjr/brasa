import { Color3, Mesh, StandardMaterial, TransformNode, VertexData } from "@babylonjs/core";
import type { Scene } from "@babylonjs/core";

/**
 * CAMADA JOGO. Telégrafo de golpe CORPO A CORPO no CHÃO: um leque (o cone real do golpe,
 * meio-ângulo 60 graus, raio = alcance) que se enche durante a antecipação e pisca no ativo.
 * Da câmera alta o corpo do inimigo é pequeno; o leque no chão é o que se lê (feel, 2026-11).
 * Só existe (e só desenha) enquanto o inimigo ataca: custa 2 draw calls por atacante.
 */
const HALF_ANGLE = Math.PI / 3; // cos 0,5 = o cone de acerto de skeleton.ts
const SEGMENTS = 14;
const LIFT = 0.05; // acima do piso (evita z-fighting)

const mats = new WeakMap<Scene, { normal: StandardMaterial; unblock: StandardMaterial }>();

function material(scene: Scene, hex: string, name: string): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.disableLighting = true;
  m.diffuseColor = Color3.Black();
  m.specularColor = Color3.Black();
  m.emissiveColor = Color3.FromHexString(hex);
  m.backFaceCulling = false;
  m.zOffset = -2; // por cima do piso, sem brigar com ele
  return m;
}

function buildFan(scene: Scene, name: string): Mesh {
  const positions: number[] = [0, 0, 0];
  const indices: number[] = [];
  for (let i = 0; i <= SEGMENTS; i++) {
    const a = -HALF_ANGLE + (2 * HALF_ANGLE * i) / SEGMENTS;
    positions.push(Math.sin(a), 0, Math.cos(a));
    if (i > 0) indices.push(0, i + 1, i); // CCW visto de cima
  }
  const vd = new VertexData();
  vd.positions = positions;
  vd.indices = indices;
  vd.normals = positions.map((_, i) => (i % 3 === 1 ? 1 : 0));
  const m = new Mesh(name, scene);
  vd.applyToMesh(m);
  m.isPickable = false;
  m.metadata = { noOutline: true };
  m.renderingGroupId = 0;
  return m;
}

export class GroundTelegraph {
  private readonly node: TransformNode;
  private readonly base: Mesh;
  private readonly fill: Mesh;
  private readonly range: number;
  private shown = false;

  constructor(private readonly scene: Scene, range: number) {
    this.range = range;
    let set = mats.get(scene);
    if (!set) {
      set = { normal: material(scene, "#ff5a2a", "telegrafo_mat"), unblock: material(scene, "#ffe2a0", "telegrafo_inq_mat") };
      mats.set(scene, set);
    }
    this.node = new TransformNode("telegrafo", scene);
    this.base = buildFan(scene, "telegrafo_base");
    this.fill = buildFan(scene, "telegrafo_fill");
    this.base.parent = this.node;
    this.fill.parent = this.node;
    this.base.material = set.normal;
    this.fill.material = set.normal;
    this.base.visibility = 0.14;
    this.base.scaling.set(range, 1, range);
    this.fill.visibility = 0.4;
    this.node.setEnabled(false);
  }

  /**
   * Atualiza o leque. `phase`/`progress` do AttackState do inimigo; `dirX/dirZ` = direção travada
   * do golpe; `x,y,z` = pé do inimigo. Fora de startup/active o leque some.
   */
  update(phase: string, progress: number, x: number, y: number, z: number, dirX: number, dirZ: number, unblockable: boolean): void {
    if (phase !== "startup" && phase !== "active") {
      if (this.shown) { this.node.setEnabled(false); this.shown = false; }
      return;
    }
    if (!this.shown) { this.node.setEnabled(true); this.shown = true; }
    const set = mats.get(this.scene)!;
    const mat = unblockable ? set.unblock : set.normal;
    this.base.material = mat;
    this.fill.material = mat;
    this.node.position.set(x, y + LIFT, z);
    this.node.rotation.y = Math.atan2(dirX, dirZ);
    if (phase === "startup") {
      // O preenchimento cresce do centro até o alcance: quando encosta na borda, o golpe sai.
      const r = Math.max(0.15, progress) * this.range;
      this.fill.scaling.set(r, 1, r);
      this.fill.visibility = 0.22 + 0.3 * progress;
    } else {
      this.fill.scaling.set(this.range, 1, this.range);
      this.fill.visibility = 0.75;
    }
  }

  hide(): void {
    if (this.shown) { this.node.setEnabled(false); this.shown = false; }
  }

  dispose(): void {
    this.base.dispose(false, false);
    this.fill.dispose(false, false);
    this.node.dispose(false, false);
  }
}
