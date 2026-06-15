import { Color4, DynamicTexture, ParticleSystem, Vector3 } from "@babylonjs/core";
import type { Scene } from "@babylonjs/core";

/**
 * CAMADA JOGO. Faísca/poeira de impacto (spec-combate §1, ingrediente de juiciness):
 * uma rajada curta de partículas no ponto do acerto. Estilizado low-poly, sem gore
 * (§DoD). Roda em TEMPO REAL (não congela no hit stop, que para só atacante/alvo).
 * Textura gerada no código (ponto radial), sem asset externo. Uma instância reaproveitada.
 */
export class ImpactFx {
  private readonly ps: ParticleSystem;

  constructor(scene: Scene) {
    this.ps = new ParticleSystem("impactFx", 200, scene);
    this.ps.particleTexture = dotTexture(scene);
    this.ps.emitter = new Vector3(0, 0, 0);
    this.ps.blendMode = ParticleSystem.BLENDMODE_ADD;

    // Faísca de bronze quente esmaecendo para poeira.
    this.ps.color1 = new Color4(1.0, 0.86, 0.5, 1);
    this.ps.color2 = new Color4(0.85, 0.5, 0.2, 1);
    this.ps.colorDead = new Color4(0.4, 0.3, 0.2, 0);

    this.ps.minSize = 0.04;
    this.ps.maxSize = 0.16;
    this.ps.minLifeTime = 0.12;
    this.ps.maxLifeTime = 0.32;

    // Jato em todas as direções com leve viés para cima; gravidade puxa a poeira.
    this.ps.direction1 = new Vector3(-1, 0.4, -1);
    this.ps.direction2 = new Vector3(1, 1.6, 1);
    this.ps.minEmitPower = 1.5;
    this.ps.maxEmitPower = 4.5;
    this.ps.gravity = new Vector3(0, -7, 0);
    this.ps.minEmitBox = new Vector3(-0.05, -0.05, -0.05);
    this.ps.maxEmitBox = new Vector3(0.05, 0.05, 0.05);

    this.ps.emitRate = 0; // só rajadas manuais
    this.ps.updateSpeed = 0.016;
    this.ps.start();
  }

  /** Dispara uma rajada no ponto dado (mais forte em golpes pesados). */
  burst(point: Vector3, count = 16): void {
    (this.ps.emitter as Vector3).copyFrom(point);
    this.ps.manualEmitCount = count;
  }
}

/** Ponto radial branco (alpha no centro -> 0 na borda) para a partícula, gerado em runtime. */
function dotTexture(scene: Scene): DynamicTexture {
  const size = 32;
  const tex = new DynamicTexture("impactDot", size, scene, false);
  const c = tex.getContext() as unknown as CanvasRenderingContext2D;
  const g = c.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  c.fillStyle = g;
  c.fillRect(0, 0, size, size);
  tex.hasAlpha = true;
  tex.update();
  return tex;
}
