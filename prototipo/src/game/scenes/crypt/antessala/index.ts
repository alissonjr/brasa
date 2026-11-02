import type { AntessalaHandle, AntessalaKit, Interativo, Peca } from "./types";
import { construirBoca } from "./boca";
import { construirBraseiro } from "./braseiro";
import { construirArmario } from "./armario";
import { construirOficio } from "./oficio";
import { construirMural } from "./mural";
import { construirPorta } from "./porta";

export type { AntessalaHandle, AntessalaKit, Interativo, InteracaoId } from "./types";
export { ancoras } from "./planta";

/**
 * CAMADA JOGO (Brasa). Monta as peças da antessala sobre o casco que `cryptRoom.ts` já preparou
 * (docs/brasa/redesenho-da-descida.md, 2.1): boca da escada, braseiro, armário, ofício (Estante ou
 * Bancada), mural e porta de pedra. Um arquivo por peça; aqui só se juntam os resultados.
 */
export function buildAntessala(kit: AntessalaKit): AntessalaHandle {
  const pecas: Peca[] = [construirBoca(kit), construirBraseiro(kit), construirArmario(kit), construirOficio(kit), construirMural(kit), construirPorta(kit)];
  const interativos: Interativo[] = pecas.flatMap((p) => p.interativos);
  return {
    interativos,
    setLit: (k) => pecas.forEach((p) => p.setLit?.(k)),
    setChama: (c) => pecas.forEach((p) => p.setChama?.(c)),
    setPorta: (o) => pecas.forEach((p) => p.setPorta?.(o)),
    setFrascos: (t) => pecas.forEach((p) => p.setFrascos?.(t)),
    update: (t) => pecas.forEach((p) => p.update?.(t)),
    dispose: () => pecas.forEach((p) => p.dispose?.()),
  };
}
