/**
 * CAMADA ENGINE. Abstração de input.
 *
 * `InputSource` é a interface mínima que o controlador de personagem consome (eixos +
 * pulo). `CombatInputSource` a estende com ações de combate (edge e hold). `InputState`
 * é a implementação concreta de teclado + mouse: um ACTION MAP remapeável (cada ação tem
 * uma lista de codes - `KeyboardEvent.code` ou `Mouse0/1/2` para botões de mouse).
 *
 * Ações "edge" (pulo, ataque, esquiva, lock-on) são consumidas uma vez por toque
 * (consumePressed); ações "hold" (mover, correr, bloqueio) são lidas por estado
 * (isHeld). O remapeamento (acessibilidade) é exposto via `setBindings`; o jogo persiste
 * em Settings (ver platform/settings) e a ControlsScreen edita.
 */
export interface InputSource {
  /** Eixo frente/trás: +1 = frente, -1 = trás. */
  readonly forward: number;
  /** Eixo lateral: +1 = direita, -1 = esquerda. */
  readonly strafe: number;
  readonly running: boolean;
  /** true uma única vez por toque de pulo. */
  consumeJump(): boolean;
}

/** Porta rica para sistemas de combate (além da locomoção). */
export interface CombatInputSource extends InputSource {
  /** true uma única vez por toque (edge-trigger) da ação. */
  consumePressed(action: InputAction): boolean;
  /** true enquanto a ação está pressionada (hold). */
  isHeld(action: InputAction): boolean;
}

/** Ações de jogo remapeáveis. */
export type InputAction =
  | "forward"
  | "back"
  | "left"
  | "right"
  | "run"
  | "jump"
  | "attack"
  | "heavy"
  | "dodge"
  | "block"
  | "ember"
  | "execute"
  | "ultimate"
  | "pickup"
  | "lockOn"
  | "potion1"
  | "potion2"
  | "interact";

/** Mapa ação -> lista de codes (KeyboardEvent.code ou Mouse0/1/2). O primeiro é o "principal". */
export type KeyBindings = Record<InputAction, string[]>;

export const INPUT_ACTIONS: InputAction[] = [
  "forward",
  "back",
  "left",
  "right",
  "run",
  "jump",
  "attack",
  "heavy",
  "dodge",
  "block",
  "ember",
  "execute",
  "ultimate",
  "pickup",
  "lockOn",
  "potion1",
  "potion2",
  "interact",
];

/** Ações consumidas por toque (não por estado contínuo). */
const EDGE_ACTIONS: InputAction[] = ["jump", "attack", "heavy", "dodge", "ember", "execute", "ultimate", "pickup", "lockOn", "potion1", "potion2"];

export const DEFAULT_BINDINGS: KeyBindings = {
  forward: ["KeyW", "ArrowUp"],
  back: ["KeyS", "ArrowDown"],
  left: ["KeyA", "ArrowLeft"],
  right: ["KeyD", "ArrowRight"],
  run: ["ShiftLeft", "ShiftRight"],
  jump: ["Space"],
  // Combate (graybox, provisório; tudo remappável). Mapa canônico LMB/RMB/Q/Shift/Tab
  // (spec-combate §2) entra conforme cada verbo é ligado, ver docs/plano-m2-combate.md.
  attack: ["Mouse0", "KeyJ"],
  heavy: ["Mouse2", "KeyK"],
  dodge: ["KeyC"],
  block: ["KeyQ"],
  ember: ["KeyE"], // golpe de fogo (gasta Fagulha)
  execute: ["KeyF"], // executar inimigo em vacilo (vida baixa)
  ultimate: ["KeyX"], // ULTIMATE "Erupção": libera com a barra de Brasa cheia
  pickup: ["KeyG"], // pegar a arma dropada pelo inimigo
  lockOn: ["KeyT"],
  potion1: ["Digit1"], // beber Poção de Recuperação
  potion2: ["Digit2"], // beber Elixir de Fúria
  interact: ["KeyR", "Enter"], // segurar para acender a Brasa (hold)
};

export class InputState implements CombatInputSource {
  private keys = new Set<string>();
  private queued = new Set<InputAction>();
  private bindings: KeyBindings = cloneBindings(DEFAULT_BINDINGS);
  private bound = new Set<string>(allCodes(this.bindings));

  /** Troca o mapa de teclas (remapeamento). Aceita mapa parcial; ações ausentes mantêm o padrão. */
  setBindings(b: Partial<KeyBindings>): void {
    this.bindings = { ...cloneBindings(DEFAULT_BINDINGS), ...sanitizeBindings(b) };
    this.bound = new Set(allCodes(this.bindings));
  }

  getBindings(): KeyBindings {
    return cloneBindings(this.bindings);
  }

  attach(target: HTMLElement | Window = window): void {
    target.addEventListener("keydown", this.onKeyDown as EventListener);
    target.addEventListener("keyup", this.onKeyUp as EventListener);
    // Mouse no window: botões funcionam mesmo sob pointer lock (combate).
    window.addEventListener("mousedown", this.onMouseDown);
    window.addEventListener("mouseup", this.onMouseUp);
    window.addEventListener("contextmenu", this.onContextMenu);
  }

  detach(target: HTMLElement | Window = window): void {
    target.removeEventListener("keydown", this.onKeyDown as EventListener);
    target.removeEventListener("keyup", this.onKeyUp as EventListener);
    window.removeEventListener("mousedown", this.onMouseDown);
    window.removeEventListener("mouseup", this.onMouseUp);
    window.removeEventListener("contextmenu", this.onContextMenu);
  }

  /** Registra um code pressionado; enfileira as ações edge ligadas a ele. Retorna se é code mapeado. */
  private press(code: string): boolean {
    if (!this.keys.has(code)) {
      for (const a of EDGE_ACTIONS) {
        if (this.bindings[a].includes(code)) this.queued.add(a);
      }
    }
    this.keys.add(code);
    return this.bound.has(code);
  }

  private onKeyDown = (e: KeyboardEvent): void => {
    if (this.press(e.code)) e.preventDefault();
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.code);
  };

  // Botões de mouse não dão preventDefault (não quebrar clique de UI / pointer lock);
  // só o menu de contexto (botão direito) é suprimido durante o jogo.
  private onMouseDown = (e: MouseEvent): void => {
    this.press(`Mouse${e.button}`);
  };

  private onMouseUp = (e: MouseEvent): void => {
    this.keys.delete(`Mouse${e.button}`);
  };

  private onContextMenu = (e: MouseEvent): void => {
    if (this.bound.has("Mouse2")) e.preventDefault();
  };

  private active(action: InputAction): boolean {
    for (const code of this.bindings[action]) if (this.keys.has(code)) return true;
    return false;
  }

  get forward(): number {
    return (this.active("forward") ? 1 : 0) - (this.active("back") ? 1 : 0);
  }

  get strafe(): number {
    return (this.active("right") ? 1 : 0) - (this.active("left") ? 1 : 0);
  }

  get running(): boolean {
    return this.active("run");
  }

  isHeld(action: InputAction): boolean {
    return this.active(action);
  }

  consumePressed(action: InputAction): boolean {
    if (this.queued.has(action)) {
      this.queued.delete(action);
      return true;
    }
    return false;
  }

  consumeJump(): boolean {
    return this.consumePressed("jump");
  }

  /** Descarta toques enfileirados (ex.: ao entrar/retomar o jogo, evita golpe-fantasma de cliques de menu). */
  clearPressed(): void {
    this.queued.clear();
  }
}

function cloneBindings(b: KeyBindings): KeyBindings {
  const out = {} as KeyBindings;
  for (const a of INPUT_ACTIONS) out[a] = [...(b[a] ?? [])];
  return out;
}

function allCodes(b: KeyBindings): string[] {
  return INPUT_ACTIONS.flatMap((a) => b[a]);
}

/** Mantém só ações conhecidas com listas de strings não vazias (defesa contra save corrompido). */
function sanitizeBindings(b: Partial<KeyBindings>): Partial<KeyBindings> {
  const out: Partial<KeyBindings> = {};
  for (const a of INPUT_ACTIONS) {
    const v = b[a];
    if (Array.isArray(v)) {
      const codes = v.filter((c): c is string => typeof c === "string" && c.length > 0);
      if (codes.length) out[a] = codes;
    }
  }
  return out;
}
