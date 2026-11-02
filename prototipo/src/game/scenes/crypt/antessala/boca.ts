import { MeshBuilder } from "@babylonjs/core";
import type { AntessalaKit, Peca } from "./types";
import { ancoras } from "./planta";

/**
 * CAMADA JOGO (Brasa). BOCA DA ESCADA (canto sudoeste): por onde a Acendedora chega de cima, no
 * escuro. Uma escada baixa do kit sobe até a parede sul e termina numa boca negra (a escada em
 * caracol segue acima, fora do quadro). Fica BAIXA de propósito: o sudoeste é o lado da câmera alta
 * e uma escada alta tamparia a heroína. Sem interação: é a chegada (o autosave de chegada é do `main.ts`).
 */
export function construirBoca(kit: AntessalaKit): Peca {
  const a = ancoras(kit.def.index);
  const { x, z, len, wid } = a.boca;
  // A escada do kit (4,6 x 6 m, sobe 4,7 m) é achatada: ~2,9 m de largura, ~2,8 m de lenço, 1,2 m de altura.
  kit.placeProp("stairs_wide", { x, z, rotY: Math.PI, sv: [wid / 4.6, 1.2 / 4.7, len / 6], collider: false });
  // Boca escura na parede sul, logo acima do último degrau: a escada sobe para dentro dela.
  const zParede = -a.halfZ + 0.78;
  const boca = MeshBuilder.CreateBox("boca_escada", { width: wid * 0.8, height: 1.7, depth: 0.12 }, kit.scene);
  boca.material = kit.flatMaterial("bocaMat", "#050403");
  boca.position.set(x, 1.2 + 0.85, zParede);
  boca.isPickable = false;
  kit.track(boca);
  // Moldura de pedra baixa dos dois lados (batentes), para a boca ler como vão e não como mancha.
  const par = kit.flatMaterial("bocaBatenteMat", "#5a5f68");
  for (const s of [-1, 1]) {
    const b = MeshBuilder.CreateBox("boca_batente", { width: 0.3, height: 2.0, depth: 0.5 }, kit.scene);
    b.material = par;
    b.position.set(x + s * (wid * 0.4 + 0.15), 1.0 + 0.4, zParede + 0.1);
    b.isPickable = false;
    kit.track(b);
  }
  return { interativos: [] };
}
