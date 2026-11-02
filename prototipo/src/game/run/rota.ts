/**
 * CAMADA JOGO. ROTA da descida (docs/brasa/redesenho-da-descida.md, seções 2.5, 6.2 e 6.3): a
 * descida é LINEAR e FIXA, 7 antessalas e 7 câmaras na ordem A1 C1 A2 C2 ... A7 C7. Aqui moram o
 * LUGAR em que a Acendedora está (`Place`), o estado vivo da rota (`RouteState`: lugar, o que já
 * foi gasto na antessala, braseiro e chama de cada andar) e as regras de retomada e derrota.
 *
 * PURO de propósito: nenhuma importação do motor nem de `@game`, para ser testável com
 * `node tools/test_exploracao.mjs` e impossível de acoplar a Babylon. Os números do sistema
 * ficam aqui (e só aqui); `tuning.ts` não é tocado.
 *
 * Não há mais plano por semente nem porta lateral: o ofício (Estante, Bancada) de cada antessala
 * é dado fixo em `content/descida.ts`.
 */

/** Quantas antessalas (e quantas câmaras) tem a descida. A antessala A(i) e a câmara C(i) têm o mesmo índice. */
export const ANDARES = 7;

export const ROTA = {
  /** Permanência dentro do gatilho de uma saída secreta (laje) para entrar. */
  commitSec: 0.6,
  /** Permanência diante da porta de pedra da antessala (curta: o mural fica ao lado, não pode cruzar sem querer). */
  portaSec: 0.4,
} as const;

/** PRNG determinístico (mulberry32). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Onde a Acendedora está: na antessala A(index+1) ou na câmara C(index+1) (index 0..6). */
export type Place = { kind: "antessala"; index: number } | { kind: "camara"; index: number };

export function samePlace(a: Place, b: Place): boolean {
  return a.kind === b.kind && a.index === b.index;
}

/** O andar (0..6) de um lugar: a antessala e a câmara do mesmo andar compartilham o índice. */
export function floorOf(p: Place): number {
  return p.index;
}

// --- Formato do campo `no` do save: "antessala@2" ou "camara@2" (índice 0..6). "" = nenhum (descida inativa). ---

export function formatNo(p: Place): string {
  return `${p.kind}@${p.index}`;
}

export function parseNo(no: string): Place | null {
  const m = /^(antessala|camara)@(\d{1,2})$/.exec(no);
  if (!m) return null;
  const index = Number(m[2]);
  return index < ANDARES ? { kind: m[1] as Place["kind"], index } : null;
}

/**
 * Migração de saves ANTIGOS (antes do redesenho). O campo `no` tinha "estante@2" ou "bancada@2"
 * (antecâmara lateral entre o andar 2 e o 3, índice de origem 2): a Acendedora estava a caminho do
 * andar seguinte, então volta à antessala dele. Um save num andar (`no` vazio) volta à antessala
 * desse andar. Devolve null se `no` não for do formato antigo.
 */
export function legacyNoToPlace(no: string): Place | null {
  const m = /^(estante|bancada|esquecida)@(\d{1,2})$/.exec(no);
  if (!m) return null;
  return { kind: "antessala", index: Math.min(ANDARES - 1, Number(m[2]) + 1) };
}

/** A chama do braseiro (uma por andar) alimenta UMA coisa: "" = ainda no braseiro (não gasta). */
export type Chama = "" | "dadiva" | "estante" | "bancada";
export const CHAMAS: readonly Chama[] = ["", "dadiva", "estante", "bancada"];

/** Estado do braseiro da antessala de um andar: aceso? e em que a chama foi gasta. */
export interface BraseiroAndar {
  aceso: boolean;
  chama: Chama;
}

export function braseirosPadrao(): BraseiroAndar[] {
  return Array.from({ length: ANDARES }, () => ({ aceso: false, chama: "" as Chama }));
}

/**
 * Retomada (Continuar): para onde o jogo volta ao carregar. Sempre numa ANTESSALA: se o save
 * estava numa câmara (fechou a aba no meio do combate) volta à antessala desse andar, nunca no
 * meio de uma luta. Sem `no` válido, usa o andar salvo.
 */
export function resumePlace(run: { active: boolean; floorIndex: number; no: string }): Place {
  const parsed = run.active ? parseNo(run.no) : null;
  const index = Math.min(ANDARES - 1, Math.max(0, parsed ? parsed.index : run.floorIndex));
  return { kind: "antessala", index };
}

/** Derrota: volta à antessala do andar (a câmara é remontada ao cruzar a porta). Na antessala fica onde está. */
export function retryPlace(place: Place): Place {
  return { kind: "antessala", index: place.index };
}

/** Estado salvo da rota (campos do `RunSave` que a rota possui). */
export interface RouteSave {
  no: string;
  gasto: string[];
  braseiros: BraseiroAndar[];
}

/** Estado vivo da rota da run. Sem I/O: `main.ts` guarda uma instância e a serializa. */
export class RouteState {
  /** Itens já consumidos na antessala atual (não voltam ao retomar nem ao recomeçar depois de uma derrota). */
  gasto: string[] = [];
  /** Braseiro e chama de cada antessala (índice = andar). */
  braseiros: BraseiroAndar[] = braseirosPadrao();
  private place: Place = { kind: "antessala", index: 0 };

  /** Nova run: histórico limpo, de volta à antessala A1. */
  reset(): void {
    this.gasto = [];
    this.braseiros = braseirosPadrao();
    this.place = { kind: "antessala", index: 0 };
  }

  /** Reaplica o save: devolve o lugar de retomada (sempre uma antessala). */
  load(run: { active: boolean; floorIndex: number; no: string; gasto: string[]; braseiros: BraseiroAndar[] }): Place {
    this.braseiros = run.braseiros.map((b) => ({ ...b }));
    this.place = resumePlace(run);
    this.gasto = [...run.gasto]; // saves antigos chegam com `gasto` vazio (saveData); o gasto é da antessala do andar salvo
    return this.place;
  }

  get current(): Place {
    return this.place;
  }

  /** O andar atual (0..6). */
  get floor(): number {
    return this.place.index;
  }

  get inAntessala(): boolean {
    return this.place.kind === "antessala";
  }

  /** Entrou na antessala do andar `index`. `fresh` zera o gasto (chegada nova); retomar e recomeçar o mantêm. */
  enterAntessala(index: number, fresh: boolean): void {
    this.place = { kind: "antessala", index };
    if (fresh) this.gasto = [];
  }

  /** Cruzou a porta de pedra: a câmara do andar `index` começa. */
  enterCamara(index: number): void {
    this.place = { kind: "camara", index };
  }

  markSpent(item: string): void {
    if (!this.gasto.includes(item)) this.gasto.push(item);
  }

  isSpent(item: string): boolean {
    return this.gasto.includes(item);
  }

  /** Acendeu o braseiro da antessala `index` (a chama fica disponível, se ainda não foi gasta). */
  acender(index: number): void {
    const b = this.braseiros[index];
    if (b) b.aceso = true;
  }

  /** A chama do andar foi gasta em `em`. Gasta não volta. Devolve false se já estava gasta ou o braseiro está apagado. */
  gastarChama(index: number, em: Exclude<Chama, "">): boolean {
    const b = this.braseiros[index];
    if (!b || !b.aceso || b.chama !== "") return false;
    b.chama = em;
    return true;
  }

  /** A chama ainda está no braseiro (aceso e não gasta). */
  chamaDisponivel(index: number): boolean {
    const b = this.braseiros[index];
    return !!b && b.aceso && b.chama === "";
  }

  save(): RouteSave {
    return {
      no: formatNo(this.place),
      gasto: [...this.gasto], // também dentro da câmara: derrota e Continuar voltam à antessala sem devolver o que foi gasto
      braseiros: this.braseiros.map((b) => ({ ...b })),
    };
  }
}

/** Compromisso de uma saída: o tempo contínuo dentro do gatilho de UMA saída. */
export interface Commit {
  id: string | null;
  t: number;
}

/**
 * Avança o compromisso por `dt` segundos. `inside` é o id da saída cujo gatilho a Acendedora está
 * pisando (ou null). Sair do raio cancela na hora; trocar de saída recomeça. Devolve true no
 * quadro em que completa (e zera, para não repetir).
 */
export function stepCommit(c: Commit, inside: string | null, dt: number, sec: number = ROTA.commitSec): boolean {
  if (inside === null) {
    c.id = null;
    c.t = 0;
    return false;
  }
  if (c.id !== inside) {
    c.id = inside;
    c.t = 0;
  }
  c.t += dt;
  if (c.t >= sec) {
    c.id = null;
    c.t = 0;
    return true;
  }
  return false;
}
