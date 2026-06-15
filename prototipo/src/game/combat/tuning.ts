import type { AttackTiming } from "@engine";

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
}

export const HERO = {
  maxHealth: 100, // morre em ~5-6 golpes inimigos (§6)
  maxStamina: 100,
  staminaRegenPerSec: 40,
  staminaRegenDelaySec: 1.0,

  // Ataque leve: snappy (responsivo), comprometido, baixo dano. Combo de até 3 (M2.2).
  light: { startup: 0.12, active: 0.06, recovery: 0.22, damage: 10, knockback: 2, hitStopFrames: 4 } as AttackTuning,
  // 3a do combo: empurrão (knockback forte) e mais peso (spec-combate §3 "3a com empurrão").
  lightFinisher: { startup: 0.16, active: 0.07, recovery: 0.3, damage: 12, knockback: 6, hitStopFrames: 7 } as AttackTuning,
  // Janela para encadear o combo: golpear de novo até aqui após o anterior continua a cadeia.
  comboResetSec: 0.45,

  // Ataque pesado: antecipação longa, knockback forte, hit stop alto, custa stamina.
  heavy: {
    startup: 0.32,
    active: 0.08,
    recovery: 0.4,
    damage: 26,
    knockback: 6,
    hitStopFrames: 10,
    staminaCost: 35,
  } as AttackTuning,

  // Esquiva (M2.2): i-frames no MIOLO; vulnerável no fim (recovery).
  dodge: {
    durationSec: 0.55, // ~30-36 frames
    iframeStartSec: 0.1, // i-frames ~10-12 frames no miolo
    iframeEndSec: 0.3,
    staminaCost: 25,
  },

  // FAGULHA: recurso de fogo (0..1) que regenera devagar e recarrega no braseiro.
  spark: { max: 1, regenPerSec: 0.16, emberCost: 0.34 },
  // GOLPE DE FOGO (ember): leque de fogo à frente em ARCO/ÁREA, atinge vários, ignora
  // escudo (queima), custa Fagulha (não stamina). arcCos = cos(meio-ângulo) do cone.
  ember: { startup: 0.26, active: 0.1, recovery: 0.42, damage: 22, knockback: 5, range: 5.5, arcCos: 0.5 },
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

/** Multiplicador de dano RECEBIDO pela Acendedora por dificuldade (criação -> §7). */
export const DIFFICULTY_DAMAGE_TAKEN: Record<string, number> = {
  faisca: 0.6, // Casual: -40%
  brasa: 1.0, // Normal: valores da tabela
  fornalha: 1.25, // pune mais o erro
};
