import type { FrascoTipo } from "../../../content/saveData";
import type { AntessalaKit, Peca } from "./types";
import { ancoras } from "./planta";

/**
 * CAMADA JOGO (Brasa). ARMÁRIO DA ORDEM, objeto 3D (docs/brasa/redesenho-da-descida.md, 4.2): um balcão
 * baixo na parede OESTE (o lado da câmera alta: nada alto aqui) com 4 nichos sobre o tampo, um baú
 * da reserva e velas. Cada nicho mostra o frasco que guarda (`setFrascos`); os frascos são peças do
 * kit num BANCO fundido (aparecem e somem sem draw call extra). O painel, o cinto e o legado são da fase
 * R3 (`run/pocoes.ts`, `ui/armarioUi.ts`): este arquivo só desenha e expõe o ponto de interação.
 */
const MODELO: Record<FrascoTipo, string> = { vida: "bottle_A_green", furia: "bottle_C_brown", unguento: "bottle_B_green" };
const TIPOS: FrascoTipo[] = ["vida", "furia", "unguento"];
const NICHOS = 4;

export function construirArmario(kit: AntessalaKit): Peca {
  const { x, z } = ancoras(kit.def.index).armario;
  kit.placeProp("table", { x, z, rotY: Math.PI / 2, collider: true });
  kit.placeProp("chest", { x: x - 0.1, z: z - 1.7, rotY: Math.PI / 2 + 0.1, collider: true });
  kit.batch("candle_triple", { x: x + 0.1, z: z + 1.0, y: 0.71, rotY: 0.4, scale: 0.8 });
  kit.batch("candle_triple", { x: x + 0.1, z: z - 1.0, y: 0.71, rotY: 2.0, scale: 0.8 });

  // 12 frascos (4 nichos x 3 tipos) em banco: só o do tipo presente fica visível em cada nicho.
  const bancos: number[][] = [];
  for (let n = 0; n < NICHOS; n++) {
    const nz = z + (n - (NICHOS - 1) / 2) * 0.4;
    const ids: number[] = [];
    for (const tipo of TIPOS) {
      const id = kit.bankReserve();
      kit.placeProp(MODELO[tipo], { x: x + 0.05, z: nz, y: 0.71, scale: 0.7, cast: false, dyn: true, bank: id });
      ids.push(id);
    }
    bancos.push(ids);
  }
  let pronto = false;
  let pendente: (FrascoTipo | "")[] = [];
  const aplicar = (tipos: (FrascoTipo | "")[]): void => {
    for (let n = 0; n < NICHOS; n++) TIPOS.forEach((t, i) => kit.bankSet(bancos[n]![i]!, tipos[n] === t));
  };
  return {
    interativos: [{ id: "armario", x: x + 1.5, z, radius: 2.1, y: 1.7, action: "ember", icon: "potion", name: "antArmario" }],
    setFrascos(tipos): void {
      pendente = tipos;
      if (pronto) aplicar(tipos);
    },
    // Os bancos só existem depois da fusão estática (fim da montagem da sala): o primeiro quadro aplica o estado guardado.
    update(): void {
      if (pronto) return;
      pronto = true;
      aplicar(pendente);
    },
  };
}
