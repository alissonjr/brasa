import { CAJADO } from "./cajado";
import { CLAVA } from "./clava";
import { LANCA } from "./lanca";
import type { Linha, WeaponDef, WeaponId } from "./tipos";

export * from "./tipos";
export * from "./fio";
export { CAJADO, CLAVA, LANCA };

/** Todas as armas capturadas. Um arquivo por arma; acrescentar uma é registrá-la aqui. */
export const ARMAS: Record<WeaponId, WeaponDef> = { lanca: LANCA, clava: CLAVA, cajado: CAJADO };
export const LISTA_ARMAS: readonly WeaponDef[] = [LANCA, CLAVA, CAJADO];

/** Cor da Linha para o mundo 3D (halo no chão). Os mesmos valores dos tokens `--arma-*` de ui/ds/tokens.css. */
export const COR_DA_LINHA: Record<Linha, string> = {
  lamina: "#f2c46d", // --arma-lamina (ouro, gold-300)
  fogo: "#ff8a2c", // --arma-fogo (brasa, ember-400)
  contragolpe: "#8fd6e6", // --arma-contra (gelo, frost-300)
};

export const isWeaponId = (s: string): s is WeaponId => s in ARMAS;
