import { Color3, MeshBuilder, StandardMaterial } from "@babylonjs/core";
import type { DynamicTexture, Mesh } from "@babylonjs/core";
import { createMuralTexture } from "../../../ui/muralTexture";
import type { AntessalaKit, Peca } from "./types";
import { ancoras } from "./planta";

/**
 * CAMADA JOGO (Brasa). MURAL (docs/brasa/redesenho-da-descida.md, 5.1 e 5.6): dois painéis de pedra nos
 * dois lados da porta de pedra, na parede norte. À esquerda "o que foi" (a gravura do decalque da
 * Crônica), à direita "o que vem" (os mortos e o perigo da câmara seguinte, gerado da composição real).
 * Cada painel é UM plano com a textura da fase R5 (`createMuralTexture`) no canal emissivo: o frio e o aceso
 * são intensidade da textura, não pixel. Frio: o esquerdo se lê a meia-luz, o direito fica no escuro.
 * Aceso: a luz sobe do esquerdo para o direito (`setLit`). A placa legível (DOM) abre com [R] (`main.ts`).
 * As texturas morrem com a sala.
 */
const FRIO = { foi: 0.24, vem: 0.05 };

export function construirMural(kit: AntessalaKit): Peca {
  const a = ancoras(kit.def.index);
  const andar = kit.def.index + 1;
  const pedra = kit.flatMaterial("muralPedra", "#555a63");
  const niveis: { foi: DynamicTexture | null; vem: DynamicTexture | null } = { foi: null, vem: null };
  const mats: Record<"foi" | "vem", StandardMaterial> = { foi: novoMat("muralFoiMat"), vem: novoMat("muralVemMat") };
  let morto = false;
  let k = 0;

  function novoMat(nome: string): StandardMaterial {
    const m = new StandardMaterial(nome, kit.scene);
    m.disableLighting = true;
    m.diffuseColor = Color3.Black();
    m.specularColor = Color3.Black();
    m.backFaceCulling = false;
    return m;
  }

  const painel = (lado: "foi" | "vem", c: { x: number; z: number }): Mesh => {
    // Laje de pedra atrás e, na frente dela, o plano da gravura (levemente voltado para a câmera do sudoeste).
    const laje = MeshBuilder.CreateBox(`mural_laje_${lado}`, { width: 3.6, height: 2.2, depth: 0.32 }, kit.scene);
    laje.material = pedra;
    laje.position.set(c.x, 0.4 + 1.1, c.z);
    laje.rotation.y = lado === "foi" ? 0.22 : 0.22;
    laje.isPickable = false;
    laje.receiveShadows = true;
    kit.ctx.shadow.addShadowCaster(laje);
    kit.track(laje);
    const plano = MeshBuilder.CreatePlane(`mural_${lado}`, { width: 3.2, height: 1.6 }, kit.scene);
    plano.material = mats[lado];
    plano.rotation.y = 0.22;
    // a frente da laje aponta para -z (sul): o plano fica 0,17 m na frente dela, no eixo girado
    plano.position.set(c.x - Math.sin(0.22) * 0.17, 0.4 + 1.15, c.z - Math.cos(0.22) * 0.17);
    plano.isPickable = false;
    plano.metadata = { noOutline: true, noDepth: true };
    kit.track(plano);
    return plano;
  };
  painel("foi", a.muralFoi);
  painel("vem", a.muralVem);

  const aplicar = (): void => {
    const foi = Math.min(1, Math.max(0, k / 0.5));
    const vem = Math.min(1, Math.max(0, (k - 0.35) / 0.6));
    if (niveis.foi) niveis.foi.level = FRIO.foi + (1 - FRIO.foi) * foi;
    if (niveis.vem) niveis.vem.level = FRIO.vem + (1 - FRIO.vem) * vem;
  };
  for (const lado of ["foi", "vem"] as const) {
    void createMuralTexture(kit.scene, andar, lado).then((tex) => {
      if (morto) {
        tex.dispose();
        return;
      }
      niveis[lado] = tex;
      mats[lado].emissiveTexture = tex;
      aplicar();
    });
  }

  return {
    interativos: [{ id: "mural", x: a.leituraMural.x, z: a.leituraMural.z, radius: 3.2, y: 3.0, action: "interact", icon: "scroll", name: "antMural" }],
    setLit(v: number): void {
      k = v;
      aplicar();
    },
    dispose(): void {
      morto = true;
      niveis.foi?.dispose();
      niveis.vem?.dispose();
    },
  };
}
