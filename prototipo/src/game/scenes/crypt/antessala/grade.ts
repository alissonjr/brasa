import { Color3, MeshBuilder, StandardMaterial } from "@babylonjs/core";
import type { AntessalaKit, Peca } from "./types";
import { ancoras } from "./planta";

/**
 * CAMADA JOGO (Brasa). GRADE DO LIMIAR (só A7, docs/brasa/redesenho-da-descida.md 3.7): uma grade de ferro no
 * chão deixa ver o clarão da Brasa lá embaixo, a verticalidade do poço antes do chefe. Um plano emissivo
 * sob as barras (pulsa devagar) e as barras fundidas ao cenário. Sem interação.
 */
export function construirGrade(kit: AntessalaKit): Peca {
  const a = ancoras(kit.def.index);
  const x = a.halfX - 2.4;
  const z = 1.2;
  const lado = 2.6;
  const luz = new StandardMaterial("grade_clarao_mat", kit.scene);
  luz.disableLighting = true;
  luz.diffuseColor = Color3.Black();
  luz.specularColor = Color3.Black();
  luz.emissiveColor = Color3.FromHexString("#ff6a1c").scale(0.5);
  const clarao = MeshBuilder.CreateGround("grade_clarao", { width: lado, height: lado }, kit.scene);
  clarao.material = luz;
  clarao.position.set(x, 0.02, z);
  clarao.isPickable = false;
  clarao.metadata = { noOutline: true, noDepth: true };
  kit.ctx.glow.addIncludedOnlyMesh(clarao);
  kit.track(clarao);
  const ferro = kit.flatMaterial("gradeFerro", "#16171b");
  const n = 7;
  for (let i = 0; i < n; i++) {
    const t = -lado / 2 + (lado * (i + 0.5)) / n;
    for (const [w, d, px, pz] of [[0.09, lado, x + t, z], [lado, 0.09, x, z + t]] as const) {
      const barra = MeshBuilder.CreateBox("grade_barra", { width: w, height: 0.07, depth: d }, kit.scene);
      barra.material = ferro;
      barra.position.set(px, 0.06, pz);
      barra.isPickable = false;
      kit.track(barra);
    }
  }
  return {
    interativos: [],
    update(t: number): void {
      luz.emissiveColor = Color3.FromHexString("#ff6a1c").scale(0.45 + 0.15 * Math.sin(t * 1.6) + 0.04 * Math.sin(t * 5.3));
    },
    dispose(): void {
      kit.ctx.glow.removeIncludedOnlyMesh(clarao);
    },
  };
}
