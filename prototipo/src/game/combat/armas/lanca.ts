import type { WeaponDef } from "./tipos";

/**
 * Lança da Guarda (spec-armas-capturadas 2.4.1). Verbo: ALCANCE E LINHA. A ponta fura todos os alvos
 * na linha à frente; em troca tem zona morta (alvo colado leva 60% do dano) e nenhum respingo radial.
 * Números da spec como ponto de partida (conta 2.7: combo de 3 = 30 de dano em 1,40 s = 21,4 por
 * segundo, -7% contra o bronze; pesado 24 em 0,80 s = 30,0, -8%). O alcance efetivo é 2,35 m (a
 * ponta da cápsula, raio incluído) contra 1,70 m do bronze; em fila de 3 inimigos rende até x3.
 * Golpes COMPLETOS (nada herdado da espada de bronze).
 */
// Cápsula de 0,5 a 1,9 m com raio 0,45: a ponta alcança 2,35 m do herói.
const LINHA = { kind: "linha", from: 0.5, to: 1.9, radius: 0.45, deadZone: { dist: 0.9, mul: 0.6 } } as const;

export const LANCA: WeaponDef = {
  id: "lanca",
  linha: "lamina",
  traco: "linha",
  largadaPor: [
    { familia: "warrior", taxa: 0.4 },
    // Provisório até a leva do Escudo: a Sentinela largava a espada capturada (removida).
    { familia: "sentinela", taxa: 0.6 },
  ],
  fio: 16,
  unidade: "golpes",
  medidores: { alcance: 5, peso: 2, ritmo: 3 },
  // "Estocada": 0,43 s de ciclo, 8 de dano.
  light: { kind: "light", startup: 0.12, active: 0.05, recovery: 0.26, damage: 8, knockback: 1.5, hitStopFrames: 3, poise: 7, cancelAt: 0.3, lunge: 0.2, shape: LINHA },
  // "Estocada funda" (3o golpe): 0,54 s, 14 de dano, fura.
  finisher: { kind: "finisher", startup: 0.16, active: 0.06, recovery: 0.32, damage: 14, knockback: 5, hitStopFrames: 6, poise: 12, cancelAt: 0.4, lunge: 0.3, shape: LINHA },
  // "Arremeto": 0,80 s, 24 de dano, avança 2,4 m (cobre distância), 30 de estamina, quebra guarda (hitstop 8).
  heavy: { kind: "heavy", startup: 0.3, active: 0.08, recovery: 0.42, damage: 24, knockback: 6, hitStopFrames: 8, poise: 30, cancelAt: 0.5, lunge: 2.4, staminaCost: 30, shape: LINHA },
  // "Estocada de brasa": linha de 7,0 m (arcCos 0,93) em vez de leque; o mesmo ciclo de 0,64 s do Golpe de Fogo.
  ember: { startup: 0.2, active: 0.1, recovery: 0.34, damage: 22, knockback: 5, range: 7.0, arcCos: 0.93, poise: 16, cancelAt: 0.5 },
  // Em pé: a haste sobe ao lado do corpo (rotação PI em X, medida no mock).
  hold: { pos: [-0.035, 0.01, 0], rot: [Math.PI, 0, 0] },
};
