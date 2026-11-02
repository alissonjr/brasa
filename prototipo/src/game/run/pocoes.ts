import { POTIONS } from "../combat/tuning";

/**
 * CAMADA JOGO. Modelo PURO do inventário de poções (sem DOM, sem Babylon): o CINTO (o que a
 * Acendedora bebe), o ARMÁRIO da antessala (4 nichos por andar), a RESERVA da ordem (a banca de
 * hoje) e o LEGADO entre descidas. Docs: redesenho-da-descida.md 4.2 e 4.3,
 * spec-pocoes-e-absorcao.md, spec-exploracao-pocoes-e-bancada.md 4.3 (guarda de desperdício).
 *
 * Regras (todas testadas em tools/test_pocoes.mjs):
 *  - Cinto: um espaço por tipo, com os tetos de hoje (Recuperação 3, Fúria 2, Unguento 2).
 *  - Nicho: vazio ou 1 frasco de qualquer tipo. Retirar é grátis, mas bloqueia com o espaço do
 *    tipo cheio no cinto ("cinto cheio"): nunca se perde frasco por acaso.
 *  - Guardar move 1 do cinto para um nicho vazio. "Deixar para quem descer" MARCA o frasco; o
 *    legado só é gravado ao cruzar a porta de pedra (`cruzarPorta`).
 *  - INVARIANTE do legado (impede frasco infinito e duplicado): `legado[andar]` é exatamente o
 *    conjunto dos frascos de `nichos[andar]` com `gravado`. Retirar um frasco gravado, ou
 *    desmarcá-lo, o tira do legado na hora. Cruzar a porta regrava o legado do andar com o que
 *    está marcado agora.
 *  - Reserva: estoque fixo por antessala, gasto persiste na run (morrer ou Continuar não reabastece).
 *    Comprar vai ao cinto; com o espaço do tipo cheio, vai a um nicho vazio; sem nicho, bloqueia.
 *  - Nova descida: nichos = legado gravado + o frasco de Marta (conteúdo fixo) no primeiro nicho
 *    livre. Com 4 de legado o frasco de Marta não cabe e é omitido (o legado é do jogador).
 */

export type Pocao = "vida" | "furia" | "unguento";
export const POCOES: readonly Pocao[] = ["vida", "furia", "unguento"]; // ordem do cinto: teclas 1, 2, 3

/** Origem do frasco no nicho (só muda o rótulo). */
export type Origem = "marta" | "legado" | "seu";

export interface PocaoDef {
  teto: number; // cargas máximas no cinto
  custo: number | null; // Fagulhas na reserva da ordem; null = não se compra (Unguento: só na Bancada)
}
export const POCAO_DEF: Record<Pocao, PocaoDef> = {
  vida: { teto: POTIONS.vida.cap, custo: POTIONS.vida.cost },
  furia: { teto: POTIONS.furia.cap, custo: POTIONS.furia.cost },
  unguento: { teto: 2, custo: null }, // spec-exploracao-pocoes-e-bancada.md 4.1 (capacidade 2)
};

export const ANTESSALAS = 7;
export const NICHOS_POR_ANTESSALA = 4;
/** Estoque fixo da reserva da ordem por antessala (o Unguento só sai da Bancada). */
export const RESERVA_ESTOQUE: Readonly<Record<"vida" | "furia", number>> = { vida: 2, furia: 1 };
/** Frasco deixado por Marta, por antessala (índice 0 = A1): conteúdo inicial fixo de cada descida. */
export const FRASCO_DE_MARTA: Readonly<Record<number, Pocao>> = { 0: "vida", 2: "unguento", 4: "furia" };
/** Limiares da guarda de desperdício. */
export const FERIDA_MINIMA_FRAC = 0.05; // Unguento: abaixo de 5% da vida máxima de Ferida, não gasta

export interface Frasco {
  tipo: Pocao;
  origem: Origem;
  /** Marcado para quem descer depois (vale ao cruzar a porta). */
  deixar: boolean;
  /** Já está no legado do perfil (foi gravado ao cruzar a porta, ou veio do legado). */
  gravado: boolean;
}
export type Nicho = Frasco | null;
export type Cinto = Record<Pocao, number>;

export type Motivo =
  | "andar-invalido"
  | "nicho-invalido"
  | "nicho-vazio"
  | "sem-nicho" // nenhum nicho livre
  | "cinto-cheio" // o espaço do tipo está no teto
  | "cinto-vazio" // não há carga desse tipo no cinto
  | "sem-estoque" // reserva esgotada
  | "sem-fagulha"
  | "nao-vende"; // Unguento na reserva
export type Resultado = { ok: true } | { ok: false; motivo: Motivo };
export type ResultadoGanho = { ok: true; destino: "cinto" | "nicho"; nicho?: number } | { ok: false; motivo: Motivo };
export type ResultadoCompra = { ok: true; custo: number; destino: "cinto" | "nicho"; nicho?: number } | { ok: false; motivo: Motivo };

/** Estado do herói que a guarda de desperdício precisa (o chamador lê do combate). */
export interface EstadoVida {
  /** Vida atual já está no teto (vida máxima menos a Ferida). */
  vidaNoTeto: boolean;
  /** Ferida aberta em fração da vida máxima (0 a 1). Default 0. */
  feridaFrac?: number;
}
export type Uso = "ok" | "vazio" | "vida-cheia" | "sem-ferida";

/** Formato serializável. `run` entra no RunSave; `legado` entra no PERFIL (persiste entre descidas). */
export interface PocoesRunSave {
  /** Cargas no cinto na ordem de POCOES: [vida, furia, unguento]. */
  cinto: number[];
  /** `nichos[andar][nicho]`: "" vazio, ou "tipo:origem:flags" (flags: d = deixar, g = gravado). */
  nichos: string[][];
  /** Estoque RESTANTE da reserva por antessala: [vida, furia]. */
  reserva: number[][];
}
/** `legado[andar]`: tipos deixados (até 4 por antessala). */
export type LegadoSave = string[][];
export interface PocoesSave {
  run: PocoesRunSave;
  legado: LegadoSave;
}

export interface OpcoesDescida {
  /** Cargas de partida do cinto. Default vazio (a Recuperação de Marta mora no nicho de A1). */
  cinto?: Partial<Cinto>;
  /** Sem o frasco de Marta nos nichos (testes). Default true. */
  marta?: boolean;
}

const cintoVazio = (): Cinto => ({ vida: 0, furia: 0, unguento: 0 });
const legadoVazio = (): Pocao[][] => Array.from({ length: ANTESSALAS }, () => []);
const ehPocao = (v: unknown): v is Pocao => v === "vida" || v === "furia" || v === "unguento";
const inteiro = (v: unknown, min: number, max: number): number =>
  typeof v === "number" && Number.isFinite(v) ? Math.min(max, Math.max(min, Math.floor(v))) : min;

export class Pocoes {
  /** O cinto é um objeto ÚNICO e mutável (alias seguro para quem já guarda a referência). */
  readonly cinto: Cinto = cintoVazio();
  readonly nichos: Nicho[][] = [];
  /** Estoque restante da reserva por antessala. */
  readonly reserva: Record<"vida" | "furia", number>[] = [];
  /** Legado do PERFIL: o que persiste entre descidas (ver INVARIANTE no topo). */
  readonly legado: Pocao[][] = legadoVazio();

  constructor(legado?: ReadonlyArray<ReadonlyArray<Pocao>>, op: OpcoesDescida = {}) {
    this.reiniciar(legado, op);
  }

  /** Nova descida (em lugar: preserva a identidade de `cinto`). `legado` default = o atual do perfil. */
  reiniciar(legado?: ReadonlyArray<ReadonlyArray<Pocao>>, op: OpcoesDescida = {}): void {
    if (legado) {
      for (let a = 0; a < ANTESSALAS; a++) this.legado[a] = (legado[a] ?? []).filter(ehPocao).slice(0, NICHOS_POR_ANTESSALA);
    }
    const c = cintoVazio();
    for (const t of POCOES) c[t] = inteiro(op.cinto?.[t], 0, POCAO_DEF[t].teto);
    Object.assign(this.cinto, c);
    this.nichos.length = 0;
    this.reserva.length = 0;
    for (let a = 0; a < ANTESSALAS; a++) {
      const fila: Nicho[] = Array.from({ length: NICHOS_POR_ANTESSALA }, () => null);
      this.legado[a]!.forEach((tipo, i) => (fila[i] = { tipo, origem: "legado", deixar: true, gravado: true }));
      const marta = FRASCO_DE_MARTA[a];
      if (op.marta !== false && marta) {
        const livre = fila.indexOf(null);
        if (livre >= 0) fila[livre] = { tipo: marta, origem: "marta", deixar: false, gravado: false };
      }
      this.nichos.push(fila);
      this.reserva.push({ ...RESERVA_ESTOQUE });
    }
  }

  // ---------------------------------------------------------------- consultas

  quantos(tipo: Pocao): number {
    return this.cinto[tipo];
  }
  cintoCheio(tipo: Pocao): boolean {
    return this.cinto[tipo] >= POCAO_DEF[tipo].teto;
  }
  /** Primeiro nicho vazio do andar (-1 se não há). */
  nichoLivre(andar: number): number {
    return this.nichos[andar]?.indexOf(null) ?? -1;
  }
  /** Quantos frascos há nos nichos do andar. */
  ocupados(andar: number): number {
    return this.nichos[andar]?.filter((n) => n !== null).length ?? 0;
  }
  /** Estoque restante de `tipo` na reserva do andar (0 para o que a reserva não vende). */
  estoque(andar: number, tipo: Pocao): number {
    return tipo === "unguento" ? 0 : (this.reserva[andar]?.[tipo] ?? 0);
  }
  /** Total de frascos (cinto + nichos de todos os andares): para testes de conservação. */
  total(): number {
    let n = POCOES.reduce((s, t) => s + this.cinto[t], 0);
    for (const fila of this.nichos) n += fila.filter((x) => x !== null).length;
    return n;
  }

  // ------------------------------------------------------------------ usar

  /** Guarda de desperdício (spec 4.3), sem gastar nada. A Fúria é livre. */
  podeUsar(tipo: Pocao, est: EstadoVida): Uso {
    if (this.cinto[tipo] <= 0) return "vazio";
    if (tipo === "vida" && est.vidaNoTeto) return "vida-cheia";
    if (tipo === "unguento" && (est.feridaFrac ?? 0) < FERIDA_MINIMA_FRAC) return "sem-ferida";
    return "ok";
  }
  /** Gasta 1 carga (no gole: o efeito aplica aqui). false se não havia. */
  consumir(tipo: Pocao): boolean {
    if (this.cinto[tipo] <= 0) return false;
    this.cinto[tipo] -= 1;
    return true;
  }
  /** `podeUsar` + `consumir`. Só gasta quando devolve "ok". */
  usar(tipo: Pocao, est: EstadoVida): Uso {
    const r = this.podeUsar(tipo, est);
    if (r === "ok") this.cinto[tipo] -= 1;
    return r;
  }

  // --------------------------------------------------------------- armário

  /** Retira o frasco do nicho para o cinto. Bloqueia com o espaço do tipo cheio. */
  retirar(andar: number, nicho: number): Resultado {
    const f = this.nichos[andar]?.[nicho];
    if (!this.nichos[andar]) return { ok: false, motivo: "andar-invalido" };
    if (f === undefined) return { ok: false, motivo: "nicho-invalido" };
    if (f === null) return { ok: false, motivo: "nicho-vazio" };
    if (this.cintoCheio(f.tipo)) return { ok: false, motivo: "cinto-cheio" };
    if (f.gravado) this.tirarDoLegado(andar, f.tipo); // consumido: não volta na próxima descida
    this.nichos[andar]![nicho] = null;
    this.cinto[f.tipo] += 1;
    return { ok: true };
  }

  /** Guarda 1 carga do cinto em um nicho vazio (o primeiro, ou o pedido). `deixar` já marca o legado. */
  guardar(andar: number, tipo: Pocao, op: { nicho?: number; deixar?: boolean } = {}): ResultadoGanho {
    const fila = this.nichos[andar];
    if (!fila) return { ok: false, motivo: "andar-invalido" };
    if (this.cinto[tipo] <= 0) return { ok: false, motivo: "cinto-vazio" };
    const alvo = op.nicho ?? fila.indexOf(null);
    if (op.nicho === undefined && alvo < 0) return { ok: false, motivo: "sem-nicho" };
    if (!Number.isInteger(alvo) || alvo < 0 || alvo >= fila.length) return { ok: false, motivo: "nicho-invalido" };
    if (fila[alvo] !== null) return { ok: false, motivo: "sem-nicho" };
    this.cinto[tipo] -= 1;
    fila[alvo] = { tipo, origem: "seu", deixar: op.deixar === true, gravado: false };
    return { ok: true, destino: "nicho", nicho: alvo };
  }

  /** Marca ou desmarca o frasco como legado (`on` omitido alterna). Desmarcar um já gravado o tira do legado. */
  marcarLegado(andar: number, nicho: number, on?: boolean): Resultado {
    const fila = this.nichos[andar];
    if (!fila) return { ok: false, motivo: "andar-invalido" };
    const f = fila[nicho];
    if (f === undefined) return { ok: false, motivo: "nicho-invalido" };
    if (f === null) return { ok: false, motivo: "nicho-vazio" };
    const quer = on ?? !f.deixar;
    if (!quer && f.gravado) {
      this.tirarDoLegado(andar, f.tipo);
      f.gravado = false;
    }
    f.deixar = quer;
    return { ok: true };
  }

  /** Um frasco ganho dentro da antessala (Bancada): cinto, ou nicho se o espaço do tipo está cheio. */
  receber(andar: number, tipo: Pocao): ResultadoGanho {
    if (!this.nichos[andar]) return { ok: false, motivo: "andar-invalido" };
    if (!this.cintoCheio(tipo)) {
      this.cinto[tipo] += 1;
      return { ok: true, destino: "cinto" };
    }
    const livre = this.nichoLivre(andar);
    if (livre < 0) return { ok: false, motivo: "sem-nicho" };
    this.nichos[andar]![livre] = { tipo, origem: "seu", deixar: false, gravado: false };
    return { ok: true, destino: "nicho", nicho: livre };
  }

  /** Antecipa se `receber` caberia (para a Bancada bloquear o preparo sem gastar ingredientes). */
  cabe(andar: number, tipo: Pocao): boolean {
    return this.nichos[andar] !== undefined && (!this.cintoCheio(tipo) || this.nichoLivre(andar) >= 0);
  }

  /** Compra na reserva da ordem. Não debita Fagulhas: devolve o custo e quem chama debita. */
  comprar(andar: number, tipo: Pocao, fagulhas: number): ResultadoCompra {
    if (!this.reserva[andar]) return { ok: false, motivo: "andar-invalido" };
    const custo = POCAO_DEF[tipo].custo;
    if (custo === null || tipo === "unguento") return { ok: false, motivo: "nao-vende" };
    if (this.estoque(andar, tipo) <= 0) return { ok: false, motivo: "sem-estoque" };
    if (fagulhas < custo) return { ok: false, motivo: "sem-fagulha" };
    if (!this.cabe(andar, tipo)) return { ok: false, motivo: this.cintoCheio(tipo) ? "sem-nicho" : "cinto-cheio" };
    const r = this.receber(andar, tipo);
    if (!r.ok) return r;
    this.reserva[andar]![tipo] -= 1;
    return { ok: true, custo, destino: r.destino, nicho: r.nicho };
  }

  // ---------------------------------------------------------------- legado

  /**
   * Cruzou a porta de pedra do andar: grava o legado com o que está MARCADO agora (e só isso).
   * Devolve o legado do andar; quem chama persiste `toSave().legado` no perfil.
   */
  cruzarPorta(andar: number): Pocao[] {
    const fila = this.nichos[andar];
    if (!fila) return [];
    const novo: Pocao[] = [];
    for (const f of fila) {
      if (!f) continue;
      f.gravado = f.deixar;
      if (f.deixar) novo.push(f.tipo);
    }
    this.legado[andar] = novo.slice(0, NICHOS_POR_ANTESSALA);
    return [...this.legado[andar]!];
  }

  private tirarDoLegado(andar: number, tipo: Pocao): void {
    const l = this.legado[andar];
    const i = l ? l.indexOf(tipo) : -1;
    if (l && i >= 0) l.splice(i, 1);
  }

  // ------------------------------------------------------------- serialização

  toSave(): PocoesSave {
    return { run: this.toSaveRun(), legado: this.toSaveLegado() };
  }
  toSaveRun(): PocoesRunSave {
    return {
      cinto: POCOES.map((t) => this.cinto[t]),
      nichos: this.nichos.map((fila) => fila.map((f) => (f ? `${f.tipo}:${f.origem}:${f.deixar ? "d" : ""}${f.gravado ? "g" : ""}` : ""))),
      reserva: this.reserva.map((r) => [r.vida, r.furia]),
    };
  }
  toSaveLegado(): LegadoSave {
    return this.legado.map((l) => [...l]);
  }

  /**
   * Leitura DEFENSIVA (o blob vem de fora), EM LUGAR: preserva a identidade de `cinto` (quem guarda
   * a referência, como o alias `inv` do main.ts, continua válido). Campos ausentes viram o padrão de
   * uma descida nova, tetos e tamanhos são respeitados, tipos desconhecidos somem. `run` ausente
   * (save antigo) cai em `antigo` (os campos pocaoVida, pocaoFuria e unguento do RunSave de hoje).
   * O legado vem do perfil.
   */
  carregar(run?: unknown, legado?: unknown, antigo?: { pocaoVida?: unknown; pocaoFuria?: unknown; unguento?: unknown }): void {
    const o = run && typeof run === "object" ? (run as Record<string, unknown>) : null;
    this.reiniciar(Pocoes.lerLegado(legado), { marta: !o });
    if (!o) {
      // save sem o campo novo: só as cargas antigas (nichos e reserva de descida nova)
      this.cinto.vida = inteiro(antigo?.pocaoVida, 0, POCAO_DEF.vida.teto);
      this.cinto.furia = inteiro(antigo?.pocaoFuria, 0, POCAO_DEF.furia.teto);
      this.cinto.unguento = inteiro(antigo?.unguento, 0, POCAO_DEF.unguento.teto);
      return;
    }
    const cinto = Array.isArray(o.cinto) ? o.cinto : [];
    POCOES.forEach((t, i) => (this.cinto[t] = inteiro(cinto[i], 0, POCAO_DEF[t].teto)));
    const nichos = Array.isArray(o.nichos) ? o.nichos : [];
    for (let a = 0; a < ANTESSALAS; a++) {
      const fila = Array.isArray(nichos[a]) ? (nichos[a] as unknown[]) : [];
      for (let n = 0; n < NICHOS_POR_ANTESSALA; n++) this.nichos[a]![n] = Pocoes.lerNicho(fila[n]);
      // reconcilia com o perfil: `gravado` só vale se o legado do andar ainda tem aquele frasco
      const sobra = [...this.legado[a]!];
      for (const f of this.nichos[a]!) {
        if (!f || !f.gravado) continue;
        const i = sobra.indexOf(f.tipo);
        if (i >= 0) sobra.splice(i, 1);
        else f.gravado = false;
      }
    }
    const reserva = Array.isArray(o.reserva) ? o.reserva : [];
    for (let a = 0; a < ANTESSALAS; a++) {
      const r = Array.isArray(reserva[a]) ? (reserva[a] as unknown[]) : [];
      this.reserva[a] = Array.isArray(reserva[a])
        ? { vida: inteiro(r[0], 0, RESERVA_ESTOQUE.vida), furia: inteiro(r[1], 0, RESERVA_ESTOQUE.furia) }
        : { ...RESERVA_ESTOQUE };
    }
  }

  /** Versão estática de `carregar` (instância nova). */
  static fromSave(run?: unknown, legado?: unknown, antigo?: { pocaoVida?: unknown; pocaoFuria?: unknown; unguento?: unknown }): Pocoes {
    const p = new Pocoes();
    p.carregar(run, legado, antigo);
    return p;
  }

  static lerLegado(v: unknown): Pocao[][] {
    const src = Array.isArray(v) ? v : [];
    return Array.from({ length: ANTESSALAS }, (_, a) => {
      const l = Array.isArray(src[a]) ? (src[a] as unknown[]) : [];
      return l.filter(ehPocao).slice(0, NICHOS_POR_ANTESSALA);
    });
  }

  private static lerNicho(v: unknown): Nicho {
    if (typeof v !== "string" || v.length === 0 || v.length > 24) return null;
    const [tipo, origem, flags = ""] = v.split(":");
    if (!ehPocao(tipo)) return null;
    const org: Origem = origem === "marta" || origem === "legado" ? origem : "seu";
    return { tipo, origem: org, deixar: flags.includes("d"), gravado: flags.includes("g") };
  }
}
