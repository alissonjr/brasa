import { type CharacterSave, readCharacter } from "./character";
import { markFloor, markRead } from "./codex";
import { TRANSITIONS, parseNo } from "../run/rota";

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
  /** Portas: escolha em cada transição já decidida ("alcapao" ou o tipo do nó). */
  rota: string[];
  /** Portas: antecâmara em que a descida está ("estante@2": nó e andar de origem) ou "" num andar. */
  no: string;
  /** Portas: itens já consumidos no nó atual (não voltam ao retomar nem ao recomeçar o nó). */
  gasto: string[];
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
export function exploracaoDefaults(): Pick<RunSave, "rota" | "no" | "gasto" | "secretos" | "sabedoria" | "livros" | "raiz" | "cera" | "unguento" | "ferida"> {
  return { rota: [], no: "", gasto: [], secretos: [], sabedoria: [0, 0, 0], livros: [], raiz: 0, cera: 0, unguento: 0, ferida: 0 };
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

function readRun(v: unknown): RunSave {
  const o = (v ?? {}) as Record<string, unknown>;
  const active = o.active === true;
  const floorIndex = Math.max(0, Math.floor(num(o.floorIndex)));
  // Rota: save novo lê o que veio (só ids conhecidos); save antigo, no meio de uma descida, só
  // tinha o alçapão (a única saída que existia): semeia "alcapao" para as transições já feitas.
  const rota = Array.isArray(o.rota)
    ? idList(o.rota, TRANSITIONS).filter((x) => x === "alcapao" || parseNo(`${x}@0`) !== null)
    : active
      ? Array.from({ length: Math.min(floorIndex, TRANSITIONS) }, () => "alcapao")
      : [];
  // Nó: só vale numa descida ativa, com formato válido e a origem igual ao andar salvo
  // (floorIndex é o andar de ORIGEM enquanto se está numa antecâmara).
  const noParsed = typeof o.no === "string" ? parseNo(o.no) : null;
  const no = active && noParsed && noParsed.from === floorIndex ? (o.no as string) : "";
  const sab = Array.isArray(o.sabedoria) && o.sabedoria.length === 3 ? o.sabedoria.map((x) => Math.min(9, Math.max(0, Math.floor(num(x))))) : [0, 0, 0];
  return {
    active,
    floorIndex,
    fagulhas: Math.max(0, Math.floor(num(o.fagulhas))),
    pocaoVida: Math.max(0, Math.floor(num(o.pocaoVida))),
    pocaoFuria: Math.max(0, Math.floor(num(o.pocaoFuria))),
    upgrades: strArray(o.upgrades),
    seed: Math.max(0, Math.floor(num(o.seed))),
    rota,
    no,
    gasto: no ? idList(o.gasto) : [],
    secretos: idList(o.secretos),
    sabedoria: sab,
    livros: idList(o.livros),
    raiz: Math.max(0, Math.floor(num(o.raiz))),
    cera: Math.max(0, Math.floor(num(o.cera))),
    unguento: Math.max(0, Math.floor(num(o.unguento))),
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
    for (let n = 1; n <= run.floorIndex; n++) seeded.push(markRead(n));
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
  };
}
