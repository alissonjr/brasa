import { HERO } from "../tuning";
import type { WeaponDef } from "./tipos";

/**
 * Cajado de Cinza, VERSÃO DE TRANSIÇÃO (spec-armas-capturadas, leva do cajado ainda não feita). Mantém o
 * comportamento de antes: golpes iguais aos do bronze, e cada golpe que acerta lança uma bola de fogo
 * amiga (18 de dano). Muda só a durabilidade, que passou ao Fio: 3 cargas (as de antes; o Fio de 8 da
 * spec espera a mecânica nova do Orbe e da Coluna). Cada golpe gasta 1 carga, também o pesado.
 */
export const CAJADO: WeaponDef = {
  id: "cajado",
  linha: "fogo",
  traco: "area",
  largadaPor: [
    { familia: "conjurador", taxa: 0.6 },
    // Provisório: o demônio já largava cajado; a spec final não o faz largar nada.
    { familia: "demonio", taxa: 0.5 },
  ],
  fio: 3,
  unidade: "cargas",
  medidores: { alcance: 4, peso: 2, ritmo: 2 },
  light: { ...HERO.light, fioCost: 1 },
  finisher: { ...HERO.lightFinisher, fioCost: 1 },
  heavy: { ...HERO.heavy, fioCost: 1 },
  hold: { pos: [-0.035, 0.01, 0], rot: [Math.PI, 0, 0] },
  fogoAoAcertar: 18,
};
