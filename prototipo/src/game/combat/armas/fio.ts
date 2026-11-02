import type { AttackTuning } from "../tuning";
import type { WeaponDef, WeaponId } from "./tipos";

/**
 * CAMADA JOGO. Regras do FIO (a durabilidade única das armas capturadas), da troca e dos drops, em
 * funções PURAS (sem Babylon, sem relógio): o diretor chama estas mesmas funções, e o teste de Node
 * (tools/test_armas.mjs) cobre o caminho real. Spec: docs/brasa/spec-armas-capturadas.md, 2.6.
 */

/** Pegar a MESMA arma que já se segura recarrega esta fração do Fio máximo. */
export const RECARGA_MESMA = 0.5;
/** Com esta fração do Fio (ou menos) a interface avisa (barra vermelha, ícone de alerta). */
export const FIO_BAIXO = 0.25;
/** Armas no chão ao mesmo tempo: a terceira dissolve a mais antiga. Sem expirar por tempo. */
export const MAX_NO_CHAO = 2;
/** Gasto de Fio do golpe pesado (os demais gastam 1), salvo `fioCost` no próprio golpe. */
export const FIO_PESADO = 2;

/** Uma arma com o seu Fio atual: serve tanto para a que está na mão quanto para a que está no chão. */
export interface ArmaComFio {
  id: WeaponId;
  fio: number;
  max: number;
}

export const novaArma = (def: Pick<WeaponDef, "id" | "fio">): ArmaComFio => ({ id: def.id, fio: def.fio, max: def.fio });

/** Quanto Fio um golpe que ACERTA gasta. Furar vários alvos, ou respingar, não gasta mais. */
export function custoDoGolpe(t: Pick<AttackTuning, "kind" | "fioCost">): number {
  return t.fioCost ?? (t.kind === "heavy" ? FIO_PESADO : 1);
}

/** Gasta Fio (nunca abaixo de zero). `quebrou` = acabou: a arma se desfaz e a espada de bronze volta. */
export function gastarFio(a: ArmaComFio, custo: number): { arma: ArmaComFio; quebrou: boolean } {
  const fio = Math.max(0, a.fio - Math.max(0, custo));
  return { arma: { ...a, fio }, quebrou: fio <= 0 };
}

/** Fio curto: 25% ou menos e ainda inteira (zerado é a quebra, não o aviso). */
export const fioBaixo = (a: ArmaComFio): boolean => a.fio > 0 && a.fio / a.max <= FIO_BAIXO;

export interface ResultadoPegar {
  /** O que fica na mão depois de pegar. */
  mao: ArmaComFio;
  /** A arma que estava na mão e cai aos pés COM O FIO QUE SOBROU (null: mãos vazias ou mesma arma). */
  solta: ArmaComFio | null;
  /** Era a mesma arma: recarregou em vez de trocar (a do chão é consumida e some). */
  recarregou: boolean;
}

/**
 * Pegar uma arma do chão. Mãos vazias: empunha a do chão, com o Fio que ela tinha. Outra arma na mão:
 * TROCA, e a que estava cai aos pés com o Fio que sobrou (dá para voltar a pegá-la). A mesma arma:
 * recarrega 50% do máximo (limite no máximo); a do chão some.
 */
export function pegarArma(mao: ArmaComFio | null, chao: ArmaComFio): ResultadoPegar {
  if (!mao) return { mao: { ...chao }, solta: null, recarregou: false };
  if (mao.id === chao.id) {
    const fio = Math.min(mao.max, mao.fio + Math.ceil(mao.max * RECARGA_MESMA));
    return { mao: { ...mao, fio }, solta: null, recarregou: true };
  }
  return { mao: { ...chao }, solta: { ...mao }, recarregou: false };
}

/** Põe uma arma no chão respeitando o teto: a mais antiga (a primeira da lista) dissolve se passar. */
export function empurrarNoChao<T>(lista: readonly T[], nova: T, max = MAX_NO_CHAO): { lista: T[]; dissolvida: T | null } {
  const out = [...lista, nova];
  const dissolvida = out.length > max ? out.shift()! : null;
  return { lista: out, dissolvida };
}

/**
 * Sorteio do drop ao morrer. `largadaPor` é a tabela da arma (taxa por família); `rand` é injetável
 * (0 a 1) para o teste. Devolve o id da arma ou null.
 */
export function sortearDrop(
  familia: string,
  tabela: readonly { id: WeaponId; largadaPor: readonly { familia: string; taxa: number }[] }[],
  rand: () => number = Math.random
): WeaponId | null {
  for (const w of tabela) {
    const e = w.largadaPor.find((x) => x.familia === familia);
    if (e) return rand() < e.taxa ? w.id : null;
  }
  return null;
}
