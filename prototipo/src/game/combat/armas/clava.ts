import type { WeaponDef } from "./tipos";

/**
 * Clava do Bruto (spec-armas-capturadas 2.4.5). Verbo: ESMAGAR. Tudo é lento e legível, SEM lunge e SEM
 * cancelamento (esquiva e bloqueio não interrompem a recuperação: ela compromete). Em troca, o leve já
 * cambaleia médios em 2 golpes e o pesado é um terremoto que atordoa em área. Conta 2.7: combo 2 leves +
 * finalizadora = 54 de dano em 1,94 s = 27,8 por segundo (+21% contra o bronze); pesado 40 em 1,00 s
 * (+23%) e metade nos vizinhos. É a que mais bate e a que mais expõe. Golpes COMPLETOS (sem herança).
 * Substitui o smash de 10 s e 5 cargas de antes: o Fio é o único relógio.
 */
const PANCADA = { kind: "esfera", radius: 0.85 } as const;

export const CLAVA: WeaponDef = {
  id: "clava",
  linha: "lamina",
  traco: "esmagar",
  largadaPor: [
    { familia: "brutamonte", taxa: 1.0 },
    // Provisórios até a leva do Machado e do Escudo: o Antigo e o Pesado já largavam clava.
    { familia: "antigo", taxa: 0.7 },
    { familia: "heavy", taxa: 0.7 },
  ],
  fio: 10,
  unidade: "golpes",
  medidores: { alcance: 2, peso: 5, ritmo: 1 },
  // "Pancada" (golpes 1 e 2): 0,60 s, 16 de dano, 20 de poise, sem lunge e sem cancelAt.
  light: { kind: "light", startup: 0.18, active: 0.07, recovery: 0.35, damage: 16, knockback: 4, hitStopFrames: 5, poise: 20, shape: PANCADA },
  // "Quebra" (3o golpe): 0,74 s, 22 de dano, respingo de 2,4 m, quebra guarda (hitstop 8).
  finisher: { kind: "finisher", startup: 0.24, active: 0.08, recovery: 0.42, damage: 22, knockback: 7, hitStopFrames: 8, poise: 35, cleave: 2.4, shape: PANCADA },
  // "Esmagar": 1,00 s, 40 de dano, respingo de 50% (dano e poise) em 3,0 m, atordoa 0,5 s quem tem poise 65 ou menos.
  heavy: {
    kind: "heavy", startup: 0.5, active: 0.08, recovery: 0.42, damage: 40, knockback: 8, hitStopFrames: 10, poise: 60, staminaCost: 35,
    cleave: 3.0, cleaveDmg: 0.5, cleavePoise: 0.5, stun: { sec: 0.5, maxPoise: 65 }, shape: PANCADA,
  },
  // "Chão em brasa": 360 graus, 3,4 m, o mesmo ciclo de 0,64 s do Golpe de Fogo.
  ember: { startup: 0.2, active: 0.1, recovery: 0.34, damage: 22, knockback: 5, range: 3.4, arcCos: -1, poise: 16, cancelAt: 0.5 },
  hold: { pos: [-0.035, 0.01, 0], rot: [Math.PI / 2, 0, 0] },
};
