import type { AttackTiming } from "@engine";
import type { HitShape } from "./armas/tipos";

/**
 * CAMADA JOGO. Fonte única dos números de combate (spec-combate §6). Iterar o feel =
 * editar este arquivo. Os valores são pontos de partida, não verdades; ajustar no
 * playtest (M2.7). Tempos em SEGUNDOS; dano em pontos; hit stop em frames @60.
 *
 * Nota de responsividade: ataques do JOGADOR têm antecipação curta (latência crítica
 * < 100 ms, spec §0); a antecipação longa (~0,25-1,1 s) é dos INIMIGOS, onde a
 * telegrafia precisa ser lida (entra no M2.3+).
 */
export interface AttackTuning extends AttackTiming {
  damage: number;
  knockback: number;
  /** Frames de hit stop @60 (congela atacante e alvo; câmera/partículas seguem). */
  hitStopFrames: number;
  /** Custo de stamina (de 100); ausente = não consome. */
  staminaCost?: number;
  /** Dano de POISE: o quanto este golpe drena da postura do inimigo (cambaleia ao zerar). */
  poise?: number;
  /** Raio de CLEAVE (m): >0 faz o golpe respingar nos inimigos próximos do impacto (horda). */
  cleave?: number;
  /** Fração da RECUPERAÇÃO a partir da qual esquiva/bloqueio cancelam o golpe (ausente = sem cancelamento). */
  cancelAt?: number;
  /** Avanço (m) do herói para a frente durante antecipação+ativo (lunge; sem alvo ele vai até aqui, com alvo para antes). */
  lunge?: number;
  /** Marcador do golpe (armas capturadas, spec-armas-capturadas §1): o diretor e a animação leem isto, não a identidade do objeto. */
  kind?: "light" | "finisher" | "heavy";
  /** Forma do acerto; ausente = a esfera padrão à frente do herói (um alvo por golpe mais o `cleave`). */
  shape?: HitShape;
  /** Fração do dano do golpe que o RESPINGO (cleave) causa nos vizinhos; ausente = 0,55. */
  cleaveDmg?: number;
  /** Fração do poise do golpe que o respingo causa nos vizinhos; ausente = 0,5. */
  cleavePoise?: number;
  /** Atordoa (cambaleia por `sec`) quem tem poise base de `maxPoise` ou menos, alvo e vizinhos do respingo. */
  stun?: { sec: number; maxPoise: number };
  /** Fio gasto quando o golpe acerta (armas capturadas); ausente = 1, e 2 no pesado. */
  fioCost?: number;
}

export const HERO = {
  maxHealth: 140, // sobrevive a ~8-9 golpes (subido de 100; a vida estava curta na descida)
  maxStamina: 100,
  staminaRegenPerSec: 40,
  staminaRegenDelaySec: 1.0,

  // Janela de buffer de entrada (s): um toque dado até este tempo ANTES de a ação ser possível
  // (fim do golpe ou ponto de cancelamento) dispara assim que ela abre. Conta em tempo de jogo
  // (não passa durante o hit stop), então um toque durante o congelamento não se perde.
  inputBufferSec: 0.15,

  // Ataque leve: snappy (responsivo), comprometido, baixo dano. Combo de até 3 (M2.2).
  // Feel (2026-11): o instante de contato do CLIPE (lâmina cruzando a frente) cai no começo da
  // janela ativa (ver heroModel.ts, PLANO). Ciclo 0,38 s (antes 0,40). Dano 10 -> 9 compensa o
  // ciclo e o hit stop mais curtos (DPS do combo de 3 ~ -1,5% do anterior); poise 10 -> 9 e 14 -> 13
  // mantêm o poise por segundo.
  light: { kind: "light", startup: 0.1, active: 0.05, recovery: 0.23, damage: 9, knockback: 2, hitStopFrames: 3, poise: 9, cancelAt: 0.3, lunge: 0.35 } as AttackTuning,
  // 3a do combo: empurrão (knockback forte) e mais peso (spec-combate §3 "3a com empurrão").
  // Cleave: a finalizadora respinga nos inimigos próximos (resposta de horda do moveset normal).
  lightFinisher: { kind: "finisher", startup: 0.14, active: 0.06, recovery: 0.3, damage: 11, knockback: 6, hitStopFrames: 6, poise: 13, cleave: 2.4, cancelAt: 0.4, lunge: 0.5 } as AttackTuning,
  // Janela para encadear o combo: golpear de novo até aqui após o anterior continua a cadeia.
  comboResetSec: 0.45,

  // Ataque pesado: antecipação longa, knockback forte, hit stop alto, custa stamina.
  heavy: {
    kind: "heavy",
    startup: 0.32,
    active: 0.08,
    recovery: 0.4,
    damage: 26,
    knockback: 6,
    hitStopFrames: 8, // 8 = limiar de "pesado" (quebra guarda) no CombatDirector; antes 10 (167 ms de congelamento)
    cancelAt: 0.5,
    lunge: 0.6,
    staminaCost: 35,
    poise: 34, // o pesado quebra a postura: cambaleia tipos médios de um golpe
    cleave: 2.8, // o pesado varre os inimigos próximos do impacto
  } as AttackTuning,

  // Esquiva (M2.2): i-frames no MIOLO; vulnerável no fim (recovery).
  dodge: {
    durationSec: 0.46, // ~28 frames (antes 0,55)
    iframeStartSec: 0.06, // i-frames ~14 frames (0,06-0,30), claros e logo no começo (antes 0,10-0,30)
    iframeEndSec: 0.3,
    cancelSec: 0.32, // a partir daqui o fim da esquiva cancela em ataque/esquiva (buffer)
    staminaCost: 25,
  },

  // FAGULHA: recurso de fogo em CARGAS DISCRETAS (W6). 3 cargas; 1 carga por Golpe de Fogo;
  // regenera devagar (1 carga a cada ~6 s), recarrega tudo no braseiro e ganha 1 ao matar.
  // regenPerSec e em CARGAS/segundo; emberCost em CARGAS. (Migrado do recurso continuo 0..1.)
  spark: { charges: 3, regenPerSec: 1 / 6, emberCost: 1 },
  // GOLPE DE FOGO (ember): leque de fogo à frente em ARCO/ÁREA, atinge vários, ignora
  // escudo (queima), custa Fagulha (não stamina). arcCos = cos(meio-ângulo) do cone.
  ember: { startup: 0.2, active: 0.1, recovery: 0.34, damage: 22, knockback: 5, range: 5.5, arcCos: 0.5, poise: 16, cancelAt: 0.5 },
} as const;

/**
 * Morto desperto (placeholder do esqueleto KayKit): melee com escudo que ENSINA
 * bloqueio/flanqueio. Golpe de cima com tell longo e legível (~0,6 s) e recuperação
 * punível. Números de docs/brasa/spec-combate.md.
 */
export const DEFENDER = {
  maxHealth: 60, // ~4-5 golpes leves (§6)
  moveSpeed: 2.4, // m/s ao se aproximar
  attackRange: 2.2, // alcance do golpe de cima
  approachUntil: 2.0, // para de andar e telegrafa quando entra nesse raio
  cooldownSec: 0.5, // pausa após a recuperação (parte da janela de punição)
  // Golpe de cima: antecipação LONGA e legível -> ativo curto -> recuperação punível.
  overhead: { startup: 0.6, active: 0.12, recovery: 0.75, damage: 16, knockback: 0, hitStopFrames: 6 } as AttackTuning,
} as const;

/**
 * POÇÕES (consumíveis comprados na banca do alquimista) e ABSORÇÃO (vida tirada dos
 * inimigos). Ver docs/brasa/spec-pocoes-e-absorcao.md. Números de partida; ajustar no playtest.
 */
export const POTIONS = {
  vida: { healFrac: 0.45, cost: 4, cap: 3 }, // Poção de Recuperação
  furia: { dmgBonus: 0.6, durationSec: 8, cost: 6, cap: 2 }, // Elixir de Fúria
} as const;

/** Tipos de poção que o gole sabe levar à boca (o Unguento aplica no peito; só existe com a Ferida). */
export type PotionKind = "vida" | "furia" | "unguento";

/**
 * O GOLE (docs/brasa/redesenho-da-descida.md 4.1). Beber é um gesto de `durationSec` com janela
 * vulnerável: sem leve, pesado, bloqueio nem fogo; anda a `moveMul` da velocidade; a carga é gasta e
 * o efeito aplica em `commitSec`. Só a esquiva cancela; antes de `commitSec` não gasta a carga.
 */
export const DRINK = { durationSec: 0.6, commitSec: 0.3, moveMul: 0.6 } as const;

/**
 * QUEIMADURA (status do fogo). Aplicada pelo Golpe de Fogo (ember). Dano por segundo ao
 * alvo, faz o queimado receber mais dano e mais knockback. Empilha. Dádivas estendem
 * (Queimador: +duracao, +stack). Ver docs/brasa/00-aprofundamento-e-roadmap.md (3.1).
 */
export const BURN = {
  dps: 2, // dano por segundo
  durationSec: 3, // duracao base
  maxStacks: 2, // empilha ate 2 (4 dano/s)
  dmgTakenBonus: 0.1, // queimado recebe +10% de dano dos golpes do heroi
  knockbackBonus: 0.15, // e +15% de knockback
} as const;

export const ABSORB = {
  // Essência: orbe de cura que dropa do morto e se pega andando por cima.
  essencia: { dropChanceBase: 0.5, healFrac: 0.06, lifeSec: 8, pickupRadius: 1.4 },
  // Dádiva "Sede da Brasa": cada golpe cura esta fração do dano causado (por compra).
  sedeDaBrasa: { lifestealFrac: 0.12 },
} as const;

/** Multiplicador de dano RECEBIDO pela Acendedora por dificuldade (criação -> §7). */
export const DIFFICULTY_DAMAGE_TAKEN: Record<string, number> = {
  faisca: 0.6, // Casual: -40%
  brasa: 1.0, // Normal: valores da tabela
  fornalha: 1.25, // pune mais o erro
};
