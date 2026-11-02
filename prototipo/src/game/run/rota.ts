/**
 * CAMADA JOGO. ROTA da descida (spec-exploracao-portas-e-salas): o plano de saídas por
 * semente, o nó (antecâmara) em que a Acendedora está, e as regras de retomada e derrota.
 *
 * PURO de propósito: nenhuma importação do motor nem de `@game`, para ser testável com
 * `node tools/test_exploracao.mjs` e impossível de acoplar a Babylon. Os números do sistema
 * ficam aqui (e só aqui); `tuning.ts` não é tocado.
 */

/** Antecâmaras laterais (entre o andar i e o andar i+1). `esquecida` é secreta (fase F3). */
export type NodeKind = "estante" | "bancada" | "esquecida";
/** Uma saída de um andar: o alçapão da Brasa (tela do braseiro) ou a porta de um nó. */
export type ExitKind = "alcapao" | NodeKind;

/** Quantas transições existem: 7 andares dão 6 passagens (0..5); o Guardião não tem saída. */
export const TRANSITIONS = 6;

export const ROTA = {
  /** Permanência dentro do gatilho de uma saída para entrar (R4). */
  commitSec: 0.6,
  /** Distância mínima entre as duas saídas de um andar (R4). */
  minExitSeparation: 9,
  /** Raio do gatilho da porta lateral (colada à parede). */
  doorRadius: 1.8,
  /** Cura própria de cada antecâmara, em fração da vida máxima (R5; o alçapão cura 40%). */
  nodeHealFrac: { estante: 0.25, bancada: 0.2, esquecida: 0 } as Record<NodeKind, number>,
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

/** Sal próprio da rota: o plano não fica correlacionado com o jitter dos inimigos (seed + i*1009). */
const ROUTE_SALT = 0x0a11ce;

/** Os dois tipos que o plano sorteia (a Câmara Esquecida é fixa, não sorteada). */
const PLANNED: NodeKind[] = ["estante", "bancada"];

export interface RoutePlan {
  /** Porta lateral de cada transição (índice = andar de origem). T0 é sempre `null`. */
  side: (NodeKind | null)[];
}

/** Todas as sequências das 5 transições T1..T5 que cumprem R2: no máximo 2 iguais seguidas e
 *  cada tipo entre 1 e 3 vezes. Com 2 tipos, restam exatamente 14. */
export function validSequences(): NodeKind[][] {
  const out: NodeKind[][] = [];
  const n = TRANSITIONS - 1;
  for (let mask = 0; mask < 1 << n; mask++) {
    const seq: NodeKind[] = [];
    for (let b = 0; b < n; b++) seq.push(PLANNED[(mask >> b) & 1]!);
    const count = (k: NodeKind): number => seq.filter((x) => x === k).length;
    if (PLANNED.some((k) => count(k) < 1 || count(k) > 3)) continue;
    let runLen = 1;
    let ok = true;
    for (let i = 1; i < seq.length; i++) {
      runLen = seq[i] === seq[i - 1] ? runLen + 1 : 1;
      if (runLen > 2) ok = false;
    }
    if (ok) out.push(seq);
  }
  return out;
}

let SEQS: NodeKind[][] | null = null;

/** Plano de rota da run (R2). Função pura: a mesma semente dá o mesmo plano (retomar não embaralha). */
export function planRoute(seed: number): RoutePlan {
  SEQS ??= validSequences();
  const rand = mulberry32((seed ^ ROUTE_SALT) >>> 0);
  rand(); // descarta o primeiro valor (sementes vizinhas ficam menos parecidas)
  const seq = SEQS[Math.floor(rand() * SEQS.length)]!;
  return { side: [null, ...seq] };
}

/** Saídas de um andar: o alçapão sempre primeiro (memória muscular), depois a porta, se houver. */
export function exitsFor(plan: RoutePlan, floor: number): ExitKind[] {
  const side = plan.side[floor] ?? null;
  return side ? ["alcapao", side] : ["alcapao"];
}

// --- Formato do campo `no` do save: "estante@2" (nó, andar de origem) ou "" (num andar) ---

export function formatNo(node: NodeKind, from: number): string {
  return `${node}@${from}`;
}

export function parseNo(no: string): { node: NodeKind; from: number } | null {
  const m = /^(estante|bancada|esquecida)@(\d{1,2})$/.exec(no);
  return m ? { node: m[1] as NodeKind, from: Number(m[2]) } : null;
}

/** Onde a Acendedora está: num andar ou numa antecâmara (cujo `from` é o andar de origem). */
export type Place = { kind: "floor"; index: number } | { kind: "node"; node: NodeKind; from: number };

export function samePlace(a: Place, b: Place): boolean {
  if (a.kind === "floor" && b.kind === "floor") return a.index === b.index;
  if (a.kind === "node" && b.kind === "node") return a.node === b.node && a.from === b.from;
  return false;
}

/**
 * R7 Retomada: para onde o jogo volta ao carregar. Entra de novo na antecâmara quando o save
 * está num nó VÁLIDO (corresponde ao plano desta semente, ou é a secreta, e a origem é o andar
 * salvo); qualquer outra coisa cai no andar, nunca num nó inventado.
 */
export function resumePlace(run: { active: boolean; floorIndex: number; no: string }, plan: RoutePlan): Place {
  const floor = Math.max(0, run.floorIndex);
  const parsed = run.active ? parseNo(run.no) : null;
  if (parsed && parsed.from === floor && parsed.from < TRANSITIONS) {
    if (parsed.node === "esquecida" || plan.side[parsed.from] === parsed.node) return { kind: "node", node: parsed.node, from: parsed.from };
  }
  return { kind: "floor", index: floor };
}

/**
 * R8 Derrota: recomeça o lugar em que se morreu. Na antecâmara é o nó (a recompensa já
 * entregue fica em `gasto`, e a emboscada opcional não volta), nunca o andar de origem.
 */
export function retryPlace(place: Place): Place {
  return place;
}

/** Estado salvo da rota (os 3 campos do `RunSave` que as portas possuem). */
export interface RouteSave {
  rota: string[];
  no: string;
  gasto: string[];
}

/** Estado vivo da rota da run. Sem I/O: `main.ts` guarda uma instância e a serializa. */
export class RouteState {
  plan: RoutePlan;
  /** Escolha feita em cada transição já decidida ("alcapao" ou o tipo do nó). */
  rota: string[] = [];
  /** Itens já consumidos no nó atual (não voltam ao retomar nem ao recomeçar o nó). */
  gasto: string[] = [];
  private place: Place = { kind: "floor", index: 0 };

  constructor(seed: number) {
    this.plan = planRoute(seed);
  }

  /** Nova run (ou retomada com semente nova): plano novo, histórico limpo. */
  reset(seed: number): void {
    this.plan = planRoute(seed);
    this.rota = [];
    this.gasto = [];
    this.place = { kind: "floor", index: 0 };
  }

  /** Reaplica o save: devolve o lugar de retomada. `seed` precisa ser a MESMA da run salva. */
  load(run: { active: boolean; floorIndex: number; no: string; rota: string[]; gasto: string[] }, seed: number): Place {
    this.plan = planRoute(seed);
    this.rota = [...run.rota];
    this.gasto = [...run.gasto];
    this.place = resumePlace(run, this.plan);
    if (this.place.kind === "floor") this.gasto = []; // gasto só faz sentido dentro de um nó
    return this.place;
  }

  get current(): Place {
    return this.place;
  }

  get node(): { node: NodeKind; from: number } | null {
    return this.place.kind === "node" ? { node: this.place.node, from: this.place.from } : null;
  }

  /** Entrou num andar (por descida, derrota, retomada ou atalho de dev): sai de qualquer nó. */
  enterFloor(index: number): void {
    this.place = { kind: "floor", index };
    this.gasto = [];
    if (this.rota.length > index) this.rota.length = index; // as escolhas do andar em diante ainda não valem
  }

  /** A Acendedora escolheu uma saída do andar `floor` (alçapão ou porta). */
  choose(floor: number, exit: ExitKind): void {
    this.rota.length = Math.min(this.rota.length, floor);
    while (this.rota.length < floor) this.rota.push("alcapao"); // atalho de dev: o que não foi escolhido foi o alçapão
    this.rota.push(exit);
  }

  /** Entrou na antecâmara. `fresh` zera o gasto (nó novo); retomar e recomeçar o mantêm. */
  enterNode(node: NodeKind, from: number, fresh: boolean): void {
    this.place = { kind: "node", node, from };
    if (fresh) this.gasto = [];
  }

  markSpent(item: string): void {
    if (!this.gasto.includes(item)) this.gasto.push(item);
  }

  isSpent(item: string): boolean {
    return this.gasto.includes(item);
  }

  save(): RouteSave {
    const node = this.node;
    return { rota: [...this.rota], no: node ? formatNo(node.node, node.from) : "", gasto: node ? [...this.gasto] : [] };
  }
}
