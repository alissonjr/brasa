import { Vector3 } from "@babylonjs/core";
import type { Chama } from "../../../run/rota";
import type { AntessalaKit, ChamaRef, Interativo, Peca } from "./types";
import { ancoras } from "./planta";

/**
 * CAMADA JOGO (Brasa). OFÍCIO da antessala, parede LESTE (docs/brasa/redesenho-da-descida.md, 2.1 e
 * 2.4): a ESTANTE (A2, A4 e A6; estantes de livros e a vela da leitura) e a BANCADA (A3, A5 e A6;
 * mesa de preparo e os três pavios). A chama única do andar acende a vela ou os pavios (`setChama`);
 * sem chama o ofício fica frio. A leitura e o preparo (livros, Sabedoria, poções) são fases
 * posteriores: o objeto expõe só o ponto de interação ([E]) e o estado da chama.
 */
export function construirOficio(kit: AntessalaKit): Peca {
  const a = ancoras(kit.def.index);
  const interativos: Interativo[] = [];
  let vela: ChamaRef | null = null;
  const pavios: ChamaRef[] = [];

  if (a.oficio.estante) {
    const { x, z } = a.oficio.estante;
    kit.placeProp("bookcase", { x, z: z - 0.62, rotY: -Math.PI / 2, collider: true });
    kit.placeProp("bookcase", { x, z: z + 0.62, rotY: -Math.PI / 2, collider: true });
    // Atril com a vela da leitura: uma caixa baixa diante das estantes, a vela por cima.
    kit.placeProp("crate", { x: x - 1.5, z, rotY: 0.2, scale: 0.75, collider: true });
    kit.batch("candle_triple", { x: x - 1.5, z, y: 0.75, scale: 0.6 });
    vela = kit.flame(new Vector3(x - 1.5, 1.45, z), 0.5, 0, false);
    vela.ignite = 0;
    interativos.push({ id: "estante", x: x - 2.5, z, radius: 2.1, y: 2.0, action: "ember", icon: "book", name: "antEstante" });
  }
  if (a.oficio.bancada) {
    const { x, z } = a.oficio.bancada;
    kit.placeProp("table", { x: x - 0.1, z, rotY: Math.PI / 2, collider: true });
    kit.batch("candle_triple", { x: x - 0.1, z: z - 0.62, y: 0.71, scale: 0.7 });
    kit.batch("candle_triple", { x: x - 0.1, z, y: 0.71, scale: 0.7 });
    kit.batch("candle_triple", { x: x - 0.1, z: z + 0.62, y: 0.71, scale: 0.7 });
    kit.placeProp("bottle_A_green", { x: x + 0.1, z: z - 0.3, y: 0.71, scale: 0.55, cast: false });
    kit.placeProp("bottle_C_brown", { x: x + 0.1, z: z + 0.3, y: 0.71, scale: 0.55, cast: false });
    kit.placeProp("barrel", { x: x - 0.1, z: z - 1.65, scale: 0.8, collider: true });
    for (const dz of [-0.62, 0, 0.62]) {
      const p = kit.flame(new Vector3(x - 0.1, 1.5, z + dz), 0.42, 0, false);
      p.ignite = 0;
      pavios.push(p);
    }
    interativos.push({ id: "bancada", x: x - 2.1, z, radius: 2.1, y: 1.6, action: "ember", icon: "flame", name: "antBancada" });
  }

  return {
    interativos,
    setChama(chama: Chama): void {
      if (vela) vela.ignite = chama === "estante" ? 1 : 0;
      for (const p of pavios) p.ignite = chama === "bancada" ? 1 : 0;
    },
  };
}
