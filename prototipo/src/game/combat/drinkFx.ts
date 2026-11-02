import { Color4, ParticleSystem, Vector3 } from "@babylonjs/core";
import type { Scene } from "@babylonjs/core";
import { dotTexture } from "./impactFx";
import type { PotionKind } from "./tuning";

/**
 * CAMADA JOGO. VFX do GOLE (redesenho 4.1): uma espiral de partículas que sobe pelo corpo da heroína no
 * momento em que a carga é gasta (aos 0,30 s). Recuperação: verde-ouro, larga e lenta. Fúria: brasa laranja-
 * vermelha, mais estreita e rápida. Unguento: um estalo dourado curto no peito. Duas fitas (dois sistemas de
 * 6 partículas) somam o teto de 12 do orçamento. Com "reduzir movimento" não há partículas (o flash do HUD
 * e o som continuam). Uma instância por cena; os sistemas ficam parados fora do efeito.
 */
interface Look { c1: Color4; c2: Color4; dead: Color4; radius: number; turns: number; sec: number; size: [number, number]; life: [number, number]; rate: number }

const LOOKS: Record<PotionKind, Look> = {
  vida: { c1: new Color4(0.8, 1, 0.45, 1), c2: new Color4(1, 0.85, 0.35, 1), dead: new Color4(0.3, 0.75, 0.25, 0), radius: 0.36, turns: 1.6, sec: 0.8, size: [0.08, 0.15], life: [0.4, 0.55], rate: 12 },
  furia: { c1: new Color4(1, 0.55, 0.12, 1), c2: new Color4(1, 0.25, 0.06, 1), dead: new Color4(0.4, 0.05, 0, 0), radius: 0.3, turns: 2.4, sec: 0.6, size: [0.06, 0.13], life: [0.3, 0.45], rate: 14 },
  unguento: { c1: new Color4(1, 0.88, 0.4, 1), c2: new Color4(0.95, 0.7, 0.25, 1), dead: new Color4(0.5, 0.35, 0.1, 0), radius: 0.12, turns: 0.5, sec: 0.25, size: [0.04, 0.09], life: [0.2, 0.35], rate: 22 },
};

export class DrinkFx {
  private readonly strands: ParticleSystem[];
  private readonly emitters = [new Vector3(), new Vector3()];
  private kind: PotionKind = "vida";
  private t = -1; // s desde o começo do efeito (< 0 = parado)
  private acc = [0, 0];

  constructor(scene: Scene, private readonly reduced: () => boolean) {
    const tex = dotTexture(scene);
    this.strands = [0, 1].map((i) => {
      const ps = new ParticleSystem(`gole_fx_${i}`, 6, scene);
      ps.particleTexture = tex;
      ps.emitter = this.emitters[i]!;
      ps.blendMode = ParticleSystem.BLENDMODE_ADD;
      ps.direction1 = new Vector3(-0.15, 0.5, -0.15);
      ps.direction2 = new Vector3(0.15, 1.1, 0.15);
      ps.minEmitPower = 0.4;
      ps.maxEmitPower = 0.9;
      ps.gravity = new Vector3(0, 0, 0);
      ps.minEmitBox = new Vector3(0, 0, 0);
      ps.maxEmitBox = new Vector3(0, 0, 0);
      ps.emitRate = 0;
      ps.updateSpeed = 0.016;
      return ps;
    });
  }

  /** Dispara o efeito do gole (chamar no commit). Sem partículas com "reduzir movimento". */
  play(kind: PotionKind): void {
    if (this.reduced()) return;
    const look = LOOKS[kind];
    this.kind = kind;
    this.t = 0;
    this.acc[0] = this.acc[1] = 0;
    for (const ps of this.strands) {
      ps.color1 = look.c1;
      ps.color2 = look.c2;
      ps.colorDead = look.dead;
      ps.minSize = look.size[0];
      ps.maxSize = look.size[1];
      ps.minLifeTime = look.life[0];
      ps.maxLifeTime = look.life[1];
      if (!ps.isStarted()) ps.start();
    }
  }

  /** Avança a espiral em volta do corpo: `center` é o centro da cápsula da heroína. */
  update(dt: number, center: Vector3): void {
    if (this.t < 0) return;
    const look = LOOKS[this.kind];
    this.t += dt;
    const u = Math.min(1, this.t / look.sec);
    const ang = u * look.turns * Math.PI * 2;
    const y = center.y - 0.3 + u * 1.0; // dos quadris à altura da cabeça
    for (let i = 0; i < 2; i++) {
      const a = ang + i * Math.PI;
      this.emitters[i]!.set(center.x + Math.cos(a) * look.radius, y, center.z + Math.sin(a) * look.radius);
      this.acc[i]! += look.rate * dt;
      const n = Math.floor(this.acc[i]!);
      if (n > 0) {
        this.acc[i]! -= n;
        this.strands[i]!.manualEmitCount = n;
      }
    }
    if (this.t >= look.sec) {
      this.t = -1;
      for (const ps of this.strands) ps.stop();
    }
  }
}
