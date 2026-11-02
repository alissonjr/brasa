import { type CharacterSave, readCharacter } from "./character";
import { markFloor, markRead } from "./codex";
import { ANDARES, CHAMAS, type BraseiroAndar, type Chama, braseirosPadrao, formatNo, legacyNoToPlace, parseNo } from "../run/rota";
import { NICHOS_POR_ANTESSALA, markMural } from "./descida";
import { Pocoes, type Pocao } from "../run/pocoes";

/**
 * CAMADA JOGO. Forma do payload `game` dentro do SaveData (a plataforma o trata
 * como opaco). Aqui o jogo define o que guarda e lê de volta com defesa (campos
 * ausentes/corrompidos viram default seguro).
 */
/**
 * Estado da DESCIDA em andamento (run roguelite). Checkpoint = braseiro aceso. Permite
 * fechar o jogo e retomar no andar certo com Fagulha/dádivas/poções. `upgrades` guarda os
 * NOMES das dádivas compradas, reaplicadas em ordem sobre o herói recém-criado ao carregar.
 */
/** Tipo de frasco do cinto e do armário (Recuperação, Fúria, Unguento). */
export type FrascoTipo = "vida" | "furia" | "unguento";
export const FRASCOS: readonly FrascoTipo[] = ["vida", "furia", "unguento"];

/** Cinto: o que a Acendedora bebe (cargas por tipo). */
export interface CintoSave {
  vida: number;
  furia: number;
  unguento: number;
}

export interface RunSave {
  active: boolean;
  floorIndex: number;
  fagulhas: number;
  pocaoVida: number;
  pocaoFuria: number;
  upgrades: string[];
  seed: number; // semente da run (variação determinística de posições/ofertas); 0 = legado
  // --- Exploração (docs/brasa/spec-exploracao-indice.md, seção 5). Todos com default em readRun;
  //     SAVE_SCHEMA_VERSION NÃO sobe (o blob `game` é opaco para a plataforma). ---
  /**
   * Lugar da descida: "antessala@2" ou "camara@2" (índice do andar 0..6). Saves antigos tinham aqui a
   * antecâmara lateral ("estante@2") ou "": `readRun` migra para a antessala certa. Continuar sempre
   * retoma numa antessala (a câmara nunca salva no meio).
   */
  no: string;
  /** Itens já consumidos na antessala atual (não voltam ao retomar nem ao recomeçar depois de uma derrota). */
  gasto: string[];
  /** Braseiro e chama de cada antessala (7 entradas): aceso? e em que a chama foi gasta ("" = ainda no braseiro). */
  braseiros: BraseiroAndar[];
  /** Cinto de poções (redesenho 4.2). `pocaoVida`, `pocaoFuria` e `unguento` continuam como espelho legado. */
  cinto: CintoSave;
  /**
   * Armário (7 x 4 nichos) no formato do modelo `run/pocoes.ts`: "" vazio ou "tipo:origem:flags". Vazio (`[]`)
   * = save sem armário (descida antiga ou nova): `Pocoes.carregar` semeia o conteúdo inicial fixo.
   */
  nichos: string[][];
  /** Reserva da ordem: estoque restante por antessala, [Recuperação, Fúria] (7 x 2). Vazio = estoque cheio. */
  reserva: number[][];
  /** Portas: segredos já achados nesta descida. */
  secretos: string[];
  /** Livros: Sabedoria por Linha (Lâmina, Fogo, Contragolpe), 0-9 cada. Vale só na descida. */
  sabedoria: number[];
  /** Livros: ids lidos nesta descida. */
  livros: string[];
  /** Poções: ingredientes achados e Unguentos preparados. */
  raiz: number;
  cera: number;
  unguento: number;
  /** Poções: HP de Ferida aberta (parte da vida perdida que ainda não fechou). */
  ferida: number;
}

/** Valores de partida dos campos de exploração (descida nova). */
export function exploracaoDefaults(): Pick<RunSave, "no" | "gasto" | "braseiros" | "cinto" | "nichos" | "reserva" | "secretos" | "sabedoria" | "livros" | "raiz" | "cera" | "unguento" | "ferida"> {
  return {
    no: "", gasto: [], braseiros: braseirosPadrao(), cinto: { vida: 0, furia: 0, unguento: 0 }, nichos: [], reserva: [],
    secretos: [], sabedoria: [0, 0, 0], livros: [], raiz: 0, cera: 0, unguento: 0, ferida: 0,
  };
}

export interface GameSaveData {
  chapter: string;
  checkpoint: string;
  objectives: string[];
  inkState: string;
  achievements: string[];
  /** Marcas vistas da Crônica (andares alcançados, inscrições lidas, queda do Guardião). */
  codex: string[];
  character: CharacterSave;
  run: RunSave;
  /**
   * Legado do armário (meta-progressão, doc 4.2): frascos que a Acendedora anterior deixou "para quem
   * descer", por antessala (7 listas de até 4 tipos). Mora FORA de `run` de propósito: sobrevive à descida
   * nova. Gravado só ao cruzar a porta de pedra (`Pocoes.cruzarPorta`).
   */
  legado: Pocao[][];
  /** O modo Vigília não precisa de campo: a câmara nunca salva no meio e a Vigília de C5 recomeça ao cruzar a porta. */
}

function strArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

/** Lista de ids curtos (limita tamanho e quantidade: o blob vem de fora e pode estar corrompido). */
function idList(v: unknown, max = 32): string[] {
  return strArray(v)
    .filter((x) => x.length > 0 && x.length <= 40)
    .slice(0, max);
}

/** Armário de uma run: matriz 7 x 4 de textos curtos; qualquer outra forma vira "sem armário" (o modelo semeia o padrão). */
function readNichos(v: unknown): string[][] {
  if (!Array.isArray(v) || v.length !== ANDARES) return [];
  return v.map((fila) =>
    Array.from({ length: NICHOS_POR_ANTESSALA }, (_, n) => {
      const c = Array.isArray(fila) ? fila[n] : undefined;
      return typeof c === "string" && c.length <= 24 ? c : "";
    })
  );
}

/** Reserva da ordem: 7 pares [Recuperação, Fúria]; forma errada vira "sem reserva gasta" (estoque cheio). */
function readReserva(v: unknown): number[][] {
  if (!Array.isArray(v) || v.length !== ANDARES) return [];
  return v.map((r) => (Array.isArray(r) ? [Math.max(0, Math.floor(num(r[0]))), Math.max(0, Math.floor(num(r[1])))] : [2, 1]));
}

function readBraseiros(v: unknown): BraseiroAndar[] {
  const out = braseirosPadrao();
  if (!Array.isArray(v)) return out;
  for (let a = 0; a < ANDARES; a++) {
    const c = v[a] as Record<string, unknown> | null | undefined;
    if (!c || typeof c !== "object") continue;
    const aceso = c.aceso === true;
    const chama = (CHAMAS as readonly unknown[]).includes(c.chama) ? (c.chama as Chama) : "";
    out[a] = { aceso, chama: aceso ? chama : "" }; // chama gasta sem braseiro aceso não existe
  }
  return out;
}

function readRun(v: unknown): RunSave {
  const o = (v ?? {}) as Record<string, unknown>;
  const active = o.active === true;
  let floorIndex = Math.max(0, Math.floor(num(o.floorIndex)));
  // Lugar. Save novo: "antessala@i" / "camara@i" (o andar vem do índice). Save antigo: "estante@2" era a
  // antecâmara lateral entre o andar 2 e o 3, então a Acendedora volta à antessala do andar seguinte;
  // sem `no`, estava num andar: volta à antessala dele. O `gasto` antigo era do nó e se perde.
  const rawNo = typeof o.no === "string" ? o.no : "";
  const novo = active ? parseNo(rawNo) : null;
  const legado = active && !novo ? legacyNoToPlace(rawNo) : null;
  let no = "";
  let gasto: string[] = [];
  if (novo) {
    floorIndex = novo.index;
    no = formatNo(novo);
    gasto = idList(o.gasto);
  } else if (active) {
    if (legado) floorIndex = legado.index;
    floorIndex = Math.min(ANDARES - 1, floorIndex);
    no = formatNo({ kind: "antessala", index: floorIndex });
  }
  const sab = Array.isArray(o.sabedoria) && o.sabedoria.length === 3 ? o.sabedoria.map((x) => Math.min(9, Math.max(0, Math.floor(num(x))))) : [0, 0, 0];
  const pocaoVida = Math.max(0, Math.floor(num(o.pocaoVida)));
  const pocaoFuria = Math.max(0, Math.floor(num(o.pocaoFuria)));
  const unguento = Math.max(0, Math.floor(num(o.unguento)));
  // Cinto: save novo lê o objeto; save antigo (sem o campo) nasce dos contadores legados.
  const c = (o.cinto ?? null) as Record<string, unknown> | null;
  const cinto: CintoSave =
    c && typeof c === "object"
      ? { vida: Math.min(9, Math.max(0, Math.floor(num(c.vida)))), furia: Math.min(9, Math.max(0, Math.floor(num(c.furia)))), unguento: Math.min(9, Math.max(0, Math.floor(num(c.unguento)))) }
      : { vida: pocaoVida, furia: pocaoFuria, unguento };
  return {
    active,
    floorIndex,
    fagulhas: Math.max(0, Math.floor(num(o.fagulhas))),
    pocaoVida,
    pocaoFuria,
    upgrades: strArray(o.upgrades),
    seed: Math.max(0, Math.floor(num(o.seed))),
    no,
    gasto,
    braseiros: readBraseiros(o.braseiros),
    cinto,
    nichos: readNichos(o.nichos),
    reserva: readReserva(o.reserva),
    secretos: idList(o.secretos),
    sabedoria: sab,
    livros: idList(o.livros),
    raiz: Math.max(0, Math.floor(num(o.raiz))),
    cera: Math.max(0, Math.floor(num(o.cera))),
    unguento,
    ferida: Math.max(0, num(o.ferida)),
  };
}

/**
 * Marcas da Crônica. Save novo: lê `codex` como veio. Save antigo (sem o campo): quem já estava
 * numa descida passou pelos andares até o atual e leu (ou pôde ler) os já deixados para trás,
 * então semeia essas marcas: a descida não volta atrás, e a leitura nunca foi guardada.
 */
function readCodex(o: Record<string, unknown>, run: RunSave): string[] {
  if (Array.isArray(o.codex)) return strArray(o.codex);
  const seeded: string[] = [];
  if (run.active) {
    for (let n = 1; n <= run.floorIndex + 1; n++) seeded.push(markFloor(n));
    for (let n = 1; n <= run.floorIndex; n++) {
      seeded.push(markRead(n));
      seeded.push(markMural(n)); // quem leu a inscrição do andar já passou pela parede dele: a gravura do decalque vem junto
    }
  }
  return seeded;
}

export function readGameSave(blob: Record<string, unknown> | undefined): GameSaveData {
  const o = blob ?? {};
  const run = readRun(o.run);
  return {
    chapter: typeof o.chapter === "string" ? o.chapter : "",
    checkpoint: typeof o.checkpoint === "string" ? o.checkpoint : "",
    objectives: strArray(o.objectives),
    inkState: typeof o.inkState === "string" ? o.inkState : "",
    achievements: strArray(o.achievements),
    codex: readCodex(o, run),
    character: readCharacter(o.character as Record<string, unknown> | undefined),
    run,
    legado: Pocoes.lerLegado(o.legado),
  };
}
