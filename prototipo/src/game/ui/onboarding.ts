import type { InputAction, KeyBindings } from "@engine";
import { T, onLanguageChange } from "./strings";
import type { CombatHud, HintChip } from "./combatHud";

/**
 * CAMADA JOGO. Onboarding SEM TEXTO LONGO: dicas curtas de controle (teclas `ds-kbd`) ligadas
 * ao momento, nas duas primeiras salas da primeira partida. Cada dica some quando o jogador
 * faz a ação e nunca mais volta (progresso em localStorage, uma vez por instalação). A faixa
 * visível é a do `CombatHud` (a mesma que já existia); aqui só decidimos O QUE mostrar.
 *
 * Momentos: mover vale em qualquer hora (a primeira sala já começa com um morto desperto); pular
 * só com a sala calma; em combate vêm golpe leve, pesado, esquiva, bloqueio e fogo, no máximo
 * três por vez (nunca a lista toda).
 * Pegar arma (G) e ler (R) já têm avisos próprios junto do objeto; aqui eles só ganham um
 * pulso até o primeiro uso (`pending`) e entram no mesmo progresso.
 */

const STORE_KEY = "brasa.onboarding.v1";
/** Última sala (índice) em que as dicas ainda aparecem; ao passar daqui, aposentam-se de vez. */
const LAST_ROOM = 1;
/** Quantas dicas ficam visíveis ao mesmo tempo. */
const MAX_VISIBLE = 3;
/** Atraso antes de uma dica nova entrar, para não competir com o fade da sala. */
const SHOW_DELAY = 1.4;
/** Soma de segundos visível, por dica, depois da qual ela desiste (só nesta sessão). */
const GIVE_UP = 50;

export type OnboardingStep = "move" | "jump" | "light" | "heavy" | "dodge" | "block" | "ember" | "pickup" | "read";

/** Ordem de apresentação das dicas da faixa; pickup e read não entram (ver acima). */
const STRIP: Array<{ id: OnboardingStep; when: "any" | "calm" | "fight" }> = [
  { id: "move", when: "any" },
  { id: "jump", when: "calm" },
  { id: "light", when: "fight" },
  { id: "heavy", when: "fight" },
  { id: "dodge", when: "fight" },
  { id: "block", when: "fight" },
  { id: "ember", when: "fight" },
];

const ALL_STEPS: OnboardingStep[] = ["move", "jump", "light", "heavy", "dodge", "block", "ember", "pickup", "read"];

/** Ações do mapa de teclas que contam como fazer a dica. */
const ACTIONS: Record<OnboardingStep, InputAction[]> = {
  move: ["forward", "back", "left", "right"],
  jump: ["jump"],
  light: ["attack"],
  heavy: ["heavy"],
  dodge: ["dodge"],
  block: ["block"],
  ember: ["ember"],
  pickup: ["pickup"],
  read: ["interact"],
};

export interface OnboardingContext {
  /** Índice da sala atual (0 = primeira). */
  floor: number;
  enemiesAlive: number;
  nearDrop: boolean;
  nearReadable: boolean;
}

export interface OnboardingOptions {
  hud: CombatHud;
  /** Mapa de teclas ATUAL (respeita o remapeamento). */
  bindings: () => KeyBindings;
  /** Só conta a ação se o jogo está rodando (sem pausa nem menu). */
  isActive: () => boolean;
  /** Armazenamento injetável (testes); o padrão é o localStorage, sempre em try/catch. */
  storage?: Pick<Storage, "getItem" | "setItem">;
}

/** Lê o progresso com desconfiança: qualquer coisa fora do formato vira "nada feito". */
export function readProgress(storage?: Pick<Storage, "getItem">): Set<OnboardingStep> {
  const out = new Set<OnboardingStep>();
  try {
    const raw = storage?.getItem(STORE_KEY);
    if (!raw) return out;
    const data: unknown = JSON.parse(raw);
    const list = data && typeof data === "object" ? (data as { done?: unknown }).done : null;
    if (!Array.isArray(list)) return out;
    for (const id of list) if (typeof id === "string" && (ALL_STEPS as string[]).includes(id)) out.add(id as OnboardingStep);
  } catch {
    /* JSON quebrado ou storage bloqueado: recomeça do zero, sem erro */
  }
  return out;
}

function defaultStorage(): Pick<Storage, "getItem" | "setItem"> | undefined {
  try {
    return typeof localStorage !== "undefined" ? localStorage : undefined;
  } catch {
    return undefined; // acessar localStorage pode lançar (modo privado, cookies bloqueados)
  }
}

export class Onboarding {
  private readonly opts: OnboardingOptions;
  private readonly storage: Pick<Storage, "getItem" | "setItem"> | undefined;
  private readonly done: Set<OnboardingStep>;
  private readonly shown = new Map<OnboardingStep, number>();
  private ctx: OnboardingContext = { floor: 0, enemiesAlive: 0, nearDrop: false, nearReadable: false };
  private readonly waiting = new Map<OnboardingStep, number>();
  private lastSig = "";
  private stripOn = false;

  constructor(opts: OnboardingOptions) {
    this.opts = opts;
    this.storage = opts.storage ?? defaultStorage();
    this.done = readProgress(this.storage);
    window.addEventListener("keydown", (e) => {
      if (!e.repeat) this.onCode(e.code);
    });
    window.addEventListener("mousedown", (e) => this.onCode(`Mouse${e.button}`));
    onLanguageChange(() => (this.lastSig = ""));
  }

  /** A dica ainda não foi cumprida (usada para o pulso em G e R). */
  pending(step: OnboardingStep): boolean {
    return !this.done.has(step);
  }

  /** Marca tudo como feito (ex.: opção de ajuda ou reinício do tutorial em DEV). */
  reset(): void {
    this.done.clear();
    this.shown.clear();
    this.save();
    this.lastSig = "";
  }

  private save(): void {
    try {
      this.storage?.setItem(STORE_KEY, JSON.stringify({ v: 1, done: [...this.done] }));
    } catch {
      /* quota ou modo privado: segue só em memória nesta sessão */
    }
  }

  private complete(step: OnboardingStep): void {
    if (this.done.has(step)) return;
    this.done.add(step);
    this.save();
  }

  private onCode(code: string): void {
    if (!this.opts.isActive()) return;
    const b = this.opts.bindings();
    for (const step of ALL_STEPS) {
      if (this.done.has(step)) continue;
      if (!ACTIONS[step].some((a) => b[a]?.includes(code))) continue;
      if (step === "pickup" && !this.ctx.nearDrop) continue;
      if (step === "read" && !this.ctx.nearReadable) continue;
      this.complete(step);
    }
  }

  /** Chamado todo quadro de jogo. `dt` em segundos. */
  update(dt: number, ctx: OnboardingContext): void {
    this.ctx = ctx;
    if (ctx.floor > LAST_ROOM) {
      // Passou das primeiras salas: aposenta o que sobrou, para sempre.
      if (this.done.size < ALL_STEPS.length) {
        for (const s of ALL_STEPS) this.done.add(s);
        this.save();
      }
    }
    const fight = ctx.enemiesAlive > 0;
    const wanted = STRIP.filter((s) => !this.done.has(s.id) && (this.shown.get(s.id) ?? 0) < GIVE_UP && (s.when === "any" || (s.when === "fight") === fight))
      .slice(0, MAX_VISIBLE)
      .map((s) => s.id);
    // Dica nova só entra depois de um respiro; as que já estão na tela ficam como estão.
    for (const id of [...this.waiting.keys()]) if (!wanted.includes(id)) this.waiting.delete(id);
    const active = this.opts.isActive();
    for (const id of wanted) this.waiting.set(id, (this.waiting.get(id) ?? 0) + dt);
    const list = active ? wanted.filter((id) => (this.waiting.get(id) ?? 0) >= SHOW_DELAY) : [];
    for (const id of list) this.shown.set(id, (this.shown.get(id) ?? 0) + dt);
    const chips = list.map((id) => this.chip(id));
    const sig = chips.map((c) => `${c.id}:${c.keys.join("+")}:${c.label}`).join("|");
    if (sig === this.lastSig) return;
    this.lastSig = sig;
    this.stripOn = chips.length > 0;
    this.opts.hud.setHints(chips);
  }

  get stripVisible(): boolean {
    return this.stripOn;
  }

  private chip(id: OnboardingStep): HintChip {
    const b = this.opts.bindings();
    const first = (a: InputAction): string => b[a]?.find((c) => !c.startsWith("Mouse")) ?? b[a]?.[0] ?? "?";
    switch (id) {
      case "move":
        return { id, keys: [moveKeys(b)], label: T.obMover };
      case "jump":
        return { id, keys: [keyCap(first("jump"))], label: T.obPular };
      case "light":
        return { id, keys: [keyCap(first("attack"))], label: T.dicaAtacar };
      case "heavy":
        return { id, keys: [keyCap(first("heavy"))], label: T.dicaPesado };
      case "dodge":
        return { id, keys: [keyCap(first("dodge"))], label: T.dicaEsquiva };
      case "block":
        return { id, keys: [keyCap(first("block"))], label: T.dicaBloqueio };
      default:
        return { id, keys: [keyCap(first("ember"))], label: T.dicaFogo };
    }
  }
}

/** WASD (ou o que o jogador remapeou) numa tecla só: "WASD" ou setas. */
function moveKeys(b: KeyBindings): string {
  const codes = [b.forward[0], b.left[0], b.back[0], b.right[0]].map((c) => c ?? "?");
  return codes.map(keyCap).join("");
}

/** Texto curto de uma tecla (KeyboardEvent.code) ou botão do mouse. */
function keyCap(code: string): string {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  const special: Record<string, string> = {
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→",
    Space: T.tcEspaco,
    ShiftLeft: "Shift",
    ShiftRight: "Shift",
    Mouse0: T.tcClique,
    Mouse2: T.tcDir,
  };
  return special[code] ?? code;
}
