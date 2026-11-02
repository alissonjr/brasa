import type { AttackTuning } from "../tuning";

/**
 * CAMADA JOGO. Tipos das ARMAS CAPTURADAS (docs/brasa/spec-armas-capturadas.md). Só dados puros:
 * nada aqui importa o Babylon, para que as regras (Fio, troca, drops) possam ser testadas em Node
 * (tools/test_armas.mjs). Uma arma é um objeto `WeaponDef` que traz os golpes COMPLETOS (leve,
 * finalizadora, pesado e o especial), nunca um "delta" sobre a espada de bronze: assim nenhum campo
 * da base (cancelAt, lunge, cleave) vaza sem querer para a arma nova.
 */

/** Armas que o herói pode capturar. As demais (adaga, besta, machado, escudo) entram nas próximas levas. */
export type WeaponId = "lanca" | "clava" | "cajado";

/** Linha de Sabedoria da arma (cor do halo, do ícone e do chip). Lâmina, Fogo ou Contragolpe. */
export type Linha = "lamina" | "fogo" | "contragolpe";

/** Rótulo de comportamento (chip do cartão): o verbo da arma em uma palavra. */
export type Traco = "linha" | "esmagar" | "area";

/** Unidade do Fio na interface (a barra é a mesma; muda só a palavra ao lado do número). */
export type FioUnidade = "golpes" | "cargas";

/**
 * Forma do acerto de um golpe. Sem `shape`, vale a esfera padrão à frente do herói (um alvo por golpe
 * mais o respingo `cleave`), que é o que a espada de bronze usa.
 *  - esfera: a esfera padrão com `radius` próprio (a clava é mais larga).
 *  - linha: cápsula na frente do herói, de `from` a `to` metros (a ponta inclui o raio), fura TODOS os
 *    alvos. `deadZone`: alvo cuja superfície está a menos de `dist` do herói leva só `mul` do dano.
 *  - cone: leque a partir do herói (alcance `reach`, `arcCos` = cos do meio-ângulo), até `maxTargets`.
 *    O arco largo do machado (140 graus) é um cone; entra com a próxima leva.
 */
export type HitShape =
  | { kind: "esfera"; radius: number }
  | { kind: "linha"; from: number; to: number; radius: number; deadZone?: { dist: number; mul: number } }
  | { kind: "cone"; reach: number; arcCos: number; maxTargets: number };

/** Golpe de fogo (especial) reformado pela arma: o mesmo formato de `HERO.ember`. */
export interface EmberTuning {
  startup: number;
  active: number;
  recovery: number;
  damage: number;
  knockback: number;
  range: number;
  arcCos: number;
  poise: number;
  cancelAt: number;
}

/** Pose de empunhadura no osso `hand_r` (a espada de bronze usa pos (-0.035, 0.01, 0) e rot (PI/2, 0, 0)). */
export interface HoldPose {
  pos: [number, number, number];
  rot: [number, number, number];
}

/** Medidores do cartão (régua 1 a 5; a espada de bronze é 3, 3, 3). */
export interface Medidores {
  alcance: number;
  peso: number;
  ritmo: number;
}

export interface WeaponDef {
  id: WeaponId;
  linha: Linha;
  traco: Traco;
  /** Famílias de morto (`SkeletonKind`) que a largam, com a taxa de drop de cada uma (0 a 1). */
  largadaPor: { familia: string; taxa: number }[];
  /** Durabilidade total (o Fio). Cada golpe que acerta gasta `fioCost` (padrão: 1, o pesado 2). */
  fio: number;
  unidade: FioUnidade;
  medidores: Medidores;
  /** Golpes completos. `kind` marca leve, finalizadora e pesado (o diretor e a animação leem o marcador). */
  light: AttackTuning;
  finisher: AttackTuning;
  heavy: AttackTuning;
  /** Especial (tecla do Golpe de Fogo). Ausente = o da espada de bronze. */
  ember?: EmberTuning;
  hold: HoldPose;
  /** Cada golpe que acerta lança uma bola de fogo amiga (o cajado de antes; sai com a leva do cajado). */
  fogoAoAcertar?: number;
}
