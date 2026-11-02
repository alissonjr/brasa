import { MeshBuilder, StandardMaterial, Color3, Animation } from "@babylonjs/core";
import type { GlowLayer, Mesh, TransformNode, Scene } from "@babylonjs/core";
import { createLightPool } from "@engine";
import type { DoorSpot } from "./cryptLayouts";

/**
 * CAMADA JOGO (Brasa). Porta lateral de um andar: o efeito de luz que acompanha o portao de
 * pedra (que e uma peca do kit, colocada por cryptRoom e fundida ao cenario estatico).
 * Dois meshes so, ambos emissivos e sem luz pontual: um veu na boca do portao e uma poca de luz
 * no chao, na cor da antecamara. Nascem apagados e acendem junto do alcapao (R1).
 * Cor tambem nunca e o unico canal: o icone, o nome e a forma (arco x anel) distinguem as saidas.
 */
/** Tom da luz de uma porta. Peça reaproveitável: a fase R1 a usa como brilho da porta de pedra da antessala. */
export type DoorTone = "estante" | "bancada" | "esquecida";

export const DOOR_COLOR: Record<DoorTone, string> = {
  estante: "#f2c46d", // --gold-300
  bancada: "#7fcf8f", // --life-400
  esquecida: "#8fd6e6", // --frost-300
};

const VEIL_ALPHA = 0.6;

export interface SideDoorFx {
  setOpen(open: boolean): void;
  /** Solta o veu do GlowLayer (as malhas morrem com a sala; o glow nao as esquece sozinho). */
  dispose(): void;
}

export function buildSideDoor(scene: Scene, glow: GlowLayer, parent: TransformNode, spot: DoorSpot, kind: DoorTone): SideDoorFx {
  const col = DOOR_COLOR[kind];
  const veilMat = new StandardMaterial("porta_veu_mat", scene);
  veilMat.diffuseColor = Color3.Black();
  veilMat.specularColor = Color3.Black();
  veilMat.emissiveColor = Color3.FromHexString(col).scale(0.55); // com o brilho (glow) por cima, a cor cheia estoura em branco
  veilMat.disableLighting = true;
  veilMat.backFaceCulling = false;
  veilMat.alpha = 0;
  const veil: Mesh = MeshBuilder.CreatePlane("porta_veu", { width: 2.6, height: 1.0 }, scene);
  veil.material = veilMat;
  veil.rotation.y = Math.PI / 2; // plano normal a X (a porta fica na parede leste)
  veil.position.set(spot.x - 0.25, 0.62, spot.z);
  veil.isPickable = false;
  veil.parent = parent;
  veil.setEnabled(false);
  glow.addIncludedOnlyMesh(veil);

  const pool = createLightPool(scene, { radius: 3.0, color: col, alpha: 0.5, y: 0.19 });
  pool.position.set(spot.x - 2.0, 0.19, spot.z);
  pool.parent = parent;
  pool.setEnabled(false);

  return {
    setOpen(open: boolean): void {
      if (open && !veil.isEnabled()) {
        veil.setEnabled(true);
        pool.setEnabled(true);
        Animation.CreateAndStartAnimation("porta_in", veilMat, "alpha", 60, 22, 0, VEIL_ALPHA, 0);
      } else if (!open) {
        veil.setEnabled(false);
        pool.setEnabled(false);
        veilMat.alpha = 0;
      }
    },
    dispose(): void {
      glow.removeIncludedOnlyMesh(veil);
    },
  };
}
