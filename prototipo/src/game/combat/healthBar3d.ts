import { DynamicTexture, Mesh, MeshBuilder, StandardMaterial, Color3 } from "@babylonjs/core";
import type { Scene, TransformNode } from "@babylonjs/core";

/**
 * CAMADA JOGO. Barra de vida flutuante de inimigo (billboard que encara a câmera). Aparece
 * quando o alvo leva dano e some após alguns segundos (não polui a tela; a doc de UI evita
 * HUD sempre-visível e números de dano flutuantes, mas uma barra de vida de inimigo é leitura
 * legítima do progresso do combate). Acompanha o alvo por posição (não parentada, para o
 * billboard não brigar com a rotação do inimigo).
 */
const W = 128;
const H = 24;
const SHOW_SEC = 3.5;

export class HealthBar3D {
  private readonly plane: Mesh;
  private readonly tex: DynamicTexture;
  private readonly yOffset: number;
  private timer = 0;
  private last = -1;

  constructor(scene: Scene, private readonly target: TransformNode, yOffset: number) {
    this.yOffset = yOffset;
    this.tex = new DynamicTexture("hpbarTex", { width: W, height: H }, scene, false);
    this.tex.hasAlpha = true;

    const mat = new StandardMaterial("hpbarMat", scene);
    mat.diffuseTexture = this.tex;
    mat.useAlphaFromDiffuseTexture = true;
    mat.emissiveColor = Color3.White();
    mat.disableLighting = true;
    mat.backFaceCulling = false;

    this.plane = MeshBuilder.CreatePlane("hpbar", { width: 1.2, height: 0.2 }, scene);
    this.plane.material = mat;
    this.plane.billboardMode = Mesh.BILLBOARDMODE_ALL;
    this.plane.isPickable = false;
    this.plane.visibility = 0;
    this.draw(1);
  }

  /** Libera a malha e a textura (ao descartar o inimigo). */
  dispose(): void {
    this.plane.dispose();
    this.tex.dispose();
  }

  /** Marca uma mudança de vida (mostra a barra por alguns segundos). */
  set(fraction: number): void {
    if (fraction !== this.last) {
      this.draw(fraction);
      this.last = fraction;
    }
    this.timer = SHOW_SEC;
  }

  /** Reposiciona acima do alvo e controla o fade. */
  update(dt: number): void {
    this.plane.position.set(this.target.position.x, this.target.position.y + this.yOffset, this.target.position.z);
    if (this.timer > 0) {
      this.timer -= dt;
      this.plane.visibility = Math.min(1, this.timer * 2);
    } else if (this.plane.visibility !== 0) {
      this.plane.visibility = 0;
    }
  }

  private draw(frac: number): void {
    const f = Math.max(0, Math.min(1, frac));
    const c = this.tex.getContext() as unknown as CanvasRenderingContext2D;
    c.clearRect(0, 0, W, H);
    c.fillStyle = "rgba(10,8,4,0.82)";
    c.fillRect(2, 2, W - 4, H - 4);
    c.fillStyle = f > 0.5 ? "#7db83a" : f > 0.25 ? "#e7bd71" : "#c0392b";
    c.fillRect(4, 4, (W - 8) * f, H - 8);
    c.strokeStyle = "#9c7339";
    c.lineWidth = 2;
    c.strokeRect(2, 2, W - 4, H - 4);
    this.tex.update();
  }
}
