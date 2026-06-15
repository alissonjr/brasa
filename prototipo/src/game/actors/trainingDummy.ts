import { Color3, MeshBuilder, StandardMaterial, TransformNode, Vector3 } from "@babylonjs/core";
import type { Mesh, Scene } from "@babylonjs/core";
import { Health, type Hurtbox } from "@engine";
import type { CombatTarget } from "../combat/combatTarget";
import { HealthBar3D } from "../combat/healthBar3d";

/**
 * CAMADA JOGO. Alvo de treino (M2.1): um POSTE de madeira com travessão e cabeça de estopa
 * (claramente um boneco de treino, não um cilindro nem uma pessoa) - SEM IA. Existe só para
 * responder "acertar é gostoso?" (spec-combate §8): vida, hurtbox e reações de impacto (hit
 * flash, knockback, squash). Ao "morrer", encolhe e renasce após alguns segundos. Sem física
 * (knockback é deslize manual). Reações com o dt de COMBATE (param no hit stop, como o atacante).
 */
const FLASH_SEC = 0.07;
const RESPAWN_SEC = 1.4;
const TORSO_Y = 1.0;

export class TrainingDummy implements CombatTarget {
  readonly health = new Health(60); // spec-combate §6 (defensor)

  private readonly root: TransformNode;
  private readonly woodMat: StandardMaterial;
  private readonly headMat: StandardMaterial;
  private readonly hpBar: HealthBar3D;
  private readonly base: Vector3;
  private readonly center_ = new Vector3();
  private readonly knock = new Vector3();
  private flash = 0;
  private squash = 0;
  private respawn = 0;

  private static readonly FLASH = Color3.FromHexString("#f6e3b0");

  constructor(scene: Scene, spawn: Vector3) {
    this.base = spawn.clone();
    this.root = new TransformNode("trainingDummy", scene);
    this.root.position.copyFrom(spawn);

    this.woodMat = mat(scene, "dummyWood", "#7a5230");
    this.headMat = mat(scene, "dummyHead", "#c9b48a");

    const post = part(MeshBuilder.CreateCylinder("post", { diameter: 0.18, height: 1.45, tessellation: 10 }, scene), this.woodMat, this.root);
    post.position.set(0, 0.72, 0);
    const beam = part(MeshBuilder.CreateBox("beam", { width: 1.0, height: 0.14, depth: 0.14 }, scene), this.woodMat, this.root);
    beam.position.set(0, 1.15, 0);
    const head = part(MeshBuilder.CreateSphere("head", { diameter: 0.34, segments: 8 }, scene), this.headMat, this.root);
    head.position.set(0, 1.6, 0);

    this.hpBar = new HealthBar3D(scene, this.root, 1.95);
  }

  get hurtbox(): Hurtbox {
    this.center_.copyFrom(this.root.position);
    this.center_.y += TORSO_Y;
    return { center: this.center_, radius: 0.65 };
  }

  /** Aplica um acerto: dano + flash + knockback + squash; tomba se morrer. (guardBreak ignorado.) */
  takeHit(damage: number, dir: Vector3, knockback: number, _guardBreak = false): { guarded: boolean } {
    if (!this.health.alive) return { guarded: false };
    const { died } = this.health.damage(damage);
    this.flash = FLASH_SEC;
    this.squash = 1;
    this.knock.set(dir.x * knockback, 0, dir.z * knockback);
    this.hpBar.set(this.health.fraction);
    if (died) this.respawn = RESPAWN_SEC;
    return { guarded: false };
  }

  update(combatDt: number): void {
    this.hpBar.update(combatDt);
    if (combatDt <= 0) return;

    if (this.knock.lengthSquared() > 1e-4) {
      this.root.position.addInPlace(this.knock.scale(combatDt));
      this.knock.scaleInPlace(Math.exp(-combatDt / 0.09));
      if (this.knock.lengthSquared() < 1e-4) this.knock.setAll(0);
    }

    if (this.flash > 0) {
      this.flash = Math.max(0, this.flash - combatDt);
      const t = this.flash / FLASH_SEC;
      const c = TrainingDummy.FLASH;
      this.woodMat.emissiveColor.set(c.r * t, c.g * t, c.b * t);
      this.headMat.emissiveColor.set(c.r * t, c.g * t, c.b * t);
    }

    if (!this.health.alive) {
      this.respawn = Math.max(0, this.respawn - combatDt);
      const k = this.respawn / RESPAWN_SEC;
      this.root.scaling.set(Math.max(0.08, k), Math.max(0.08, k), Math.max(0.08, k));
      if (this.respawn === 0) this.revive();
      return;
    }

    if (this.squash > 0) {
      this.squash = Math.max(0, this.squash - combatDt * 5);
      const s = this.squash;
      this.root.scaling.set(1 + 0.1 * s, 1 - 0.14 * s, 1 + 0.1 * s);
    } else {
      this.root.scaling.set(1, 1, 1);
    }
  }

  private revive(): void {
    this.health.reset();
    this.root.position.copyFrom(this.base);
    this.root.scaling.set(1, 1, 1);
    this.woodMat.emissiveColor.set(0, 0, 0);
    this.headMat.emissiveColor.set(0, 0, 0);
    this.knock.setAll(0);
    this.flash = 0;
    this.squash = 0;
    this.hpBar.set(1);
  }
}

function mat(scene: Scene, name: string, hex: string): StandardMaterial {
  const m = new StandardMaterial(name, scene);
  m.diffuseColor = Color3.FromHexString(hex);
  m.specularColor = Color3.Black();
  m.emissiveColor = Color3.Black();
  return m;
}

function part(m: Mesh, material: StandardMaterial, parent: TransformNode): Mesh {
  m.material = material;
  m.parent = parent;
  m.isPickable = false;
  return m;
}
