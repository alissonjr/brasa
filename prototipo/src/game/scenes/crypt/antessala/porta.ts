import { buildDoorFx } from "../cryptDoor";
import type { AntessalaKit, Peca } from "./types";
import { ancoras } from "./planta";

/**
 * CAMADA JOGO (Brasa). PORTA DE PEDRA (docs/brasa/redesenho-da-descida.md, 2.1 e 2.3): o portão `wall_gate_door`
 * do kit no centro da parede norte, com o véu e a poça de luz de `cryptDoor.ts` na cor do braseiro. Fechada,
 * é o vão escuro; ao aproximar (e, em A1, só depois do primeiro acender) o véu e a poça sobem. Cruzar
 * sela atrás e a câmara começa: a decisão e o gatilho (0,4 s) são do `main.ts`.
 */
export function construirPorta(kit: AntessalaKit): Peca {
  const a = ancoras(kit.def.index);
  // O portão de pedra do kit (4 m de largura, 4 m de altura) no lugar do segmento de muro central.
  kit.placeProp("wall_gate_door", { x: a.porta.x, z: a.porta.z, rotY: 0, sv: [1, 0.75, 1], collider: false, cast: true });
  const fx = buildDoorFx(kit.scene, kit.ctx.glow, kit.root, { x: a.porta.x, z: a.porta.z - 0.75, nx: 0, nz: -1, width: 1.7, height: 1.9, y: 1.05, poolRadius: 3.2 }, "ember");
  return {
    interativos: [],
    setPorta: (open: boolean) => fx.setOpen(open),
    dispose: () => fx.dispose(),
  };
}
