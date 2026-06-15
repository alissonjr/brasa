/**
 * CAMADA ENGINE. Framework mínimo de UI por overlay HTML/CSS sobre o canvas
 * (decisão da spec-ui-hud-ux seção 9: HUD/menus/diálogo em HTML, melhor para texto,
 * i18n e acessibilidade). Genérico: só a estrutura (camadas + pilha de telas), um
 * helper de DOM, e ACESSIBILIDADE/NAVEGAÇÃO de modais (foco gerenciado + preso,
 * ARIA role=dialog/aria-modal, navegação por setas e por gamepad). O visual (tema)
 * e as telas concretas vivem na camada de jogo.
 */

export interface Screen {
  readonly element: HTMLElement;
  onShow?(): void;
  onHide?(): void;
}

type Attrs = Record<string, string | number | boolean | EventListener | undefined>;

/** Helper de criação de DOM. `class` e `text` são atalhos; `on*` vira addEventListener. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Attrs,
  ...children: Array<Node | string>
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === false) continue;
      if (k === "class") node.className = String(v);
      else if (k === "text") node.textContent = String(v);
      else if (k.startsWith("on") && typeof v === "function") {
        node.addEventListener(k.slice(2).toLowerCase(), v);
      } else if (v === true) node.setAttribute(k, "");
      else node.setAttribute(k, String(v));
    }
  }
  for (const c of children) node.append(c);
  return node;
}

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export class UiManager {
  readonly root: HTMLElement;
  /** Camada persistente (HUD: vida, indicador de autosave, prompts). */
  readonly hudLayer: HTMLElement;
  private readonly screenLayer: HTMLElement;
  private readonly stack: Screen[] = [];
  private restoreFocus: HTMLElement | null = null;
  private padRAF = 0;
  private readonly padPrev = { up: false, down: false, a: false };

  constructor(parent: HTMLElement = document.body) {
    this.root = el("div", { class: "ui-root" });
    this.hudLayer = el("div", { class: "ui-hud" });
    this.screenLayer = el("div", { class: "ui-screens" });

    const rs = this.root.style;
    rs.position = "fixed";
    rs.inset = "0";
    rs.pointerEvents = "none";
    rs.zIndex = "20";

    for (const layer of [this.hudLayer, this.screenLayer]) {
      layer.style.position = "absolute";
      layer.style.inset = "0";
      layer.style.pointerEvents = "none";
    }

    this.root.append(this.hudLayer, this.screenLayer);
    parent.appendChild(this.root);

    // Teclado: Tab preso no modal, setas navegam o foco entre controles.
    document.addEventListener("keydown", (e) => this.onKeyDown(e));
  }

  /** Escala visual da UI (overlay HUD + telas). Usa `zoom` (reflui, sem quebrar layout). */
  setUiScale(scale: number): void {
    const s = String(scale);
    this.hudLayer.style.setProperty("zoom", s);
    this.screenLayer.style.setProperty("zoom", s);
  }

  /** Liga/desliga classes genéricas de acessibilidade no root (estilizadas pelo tema). */
  setReducedMotion(on: boolean): void {
    this.root.classList.toggle("reduce-motion", on);
  }
  setHighContrast(on: boolean): void {
    this.root.classList.toggle("high-contrast", on);
  }

  get hasScreens(): boolean {
    return this.stack.length > 0;
  }

  get depth(): number {
    return this.stack.length;
  }

  /** Empilha uma tela modal sobre a atual. */
  push(screen: Screen): void {
    if (this.stack.length === 0) {
      this.restoreFocus = document.activeElement as HTMLElement | null;
    }
    const top = this.stack[this.stack.length - 1];
    if (top) {
      top.element.style.display = "none";
      top.element.setAttribute("aria-hidden", "true");
      top.onHide?.();
    }
    screen.element.style.pointerEvents = "auto";
    screen.element.setAttribute("role", "dialog");
    screen.element.setAttribute("aria-modal", "true");
    const heading = screen.element.querySelector("h1, h2, h3");
    if (heading?.textContent) screen.element.setAttribute("aria-label", heading.textContent);
    this.stack.push(screen);
    this.screenLayer.appendChild(screen.element);
    screen.onShow?.();
    this.focusFirst(screen.element);
    this.startPad();
  }

  /** Volta para a tela anterior na pilha. */
  back(): void {
    const top = this.stack.pop();
    if (!top) return;
    top.onHide?.();
    top.element.remove();
    const next = this.stack[this.stack.length - 1];
    if (next) {
      next.element.style.display = "";
      next.element.removeAttribute("aria-hidden");
      next.onShow?.();
      this.focusFirst(next.element);
    } else {
      this.afterEmpty();
    }
  }

  /** Limpa a pilha e mostra apenas a tela dada. */
  replaceAll(screen: Screen): void {
    this.clear();
    this.push(screen);
  }

  /** Remove todas as telas (volta ao jogo, sem overlay). */
  clear(): void {
    while (this.stack.length) {
      const s = this.stack.pop();
      s?.onHide?.();
      s?.element.remove();
    }
    this.afterEmpty();
  }

  // --- acessibilidade / navegação ---

  private afterEmpty(): void {
    this.stopPad();
    this.restoreFocus?.focus?.();
    this.restoreFocus = null;
  }

  private focusables(container: HTMLElement): HTMLElement[] {
    return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((e) => e.offsetParent !== null);
  }

  private focusFirst(container: HTMLElement): void {
    this.focusables(container)[0]?.focus();
  }

  private moveFocus(dir: 1 | -1): void {
    const top = this.stack[this.stack.length - 1];
    if (!top) return;
    const items = this.focusables(top.element);
    if (!items.length) return;
    const idx = items.indexOf(document.activeElement as HTMLElement);
    const next = (idx + dir + items.length) % items.length;
    items[next]!.focus();
  }

  private onKeyDown(e: KeyboardEvent): void {
    const top = this.stack[this.stack.length - 1];
    if (!top) return;

    if (e.key === "Tab") {
      const items = this.focusables(top.element);
      if (!items.length) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;
      if (!top.element.contains(active)) {
        e.preventDefault();
        first.focus();
      } else if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
      return;
    }

    // Setas navegam entre botões; mas deixa campos (slider/select) usarem as setas.
    const active = document.activeElement as HTMLElement | null;
    const isField = !!active && /^(INPUT|SELECT|TEXTAREA)$/.test(active.tagName);
    if (isField) return;
    if (e.key === "ArrowDown" || e.key === "ArrowRight") {
      e.preventDefault();
      this.moveFocus(1);
    } else if (e.key === "ArrowUp" || e.key === "ArrowLeft") {
      e.preventDefault();
      this.moveFocus(-1);
    }
  }

  // Ponte leve de gamepad para menus: D-pad/analógico move o foco, A confirma.
  // (Input de jogo completo - InputMap por ação - é trabalho à parte.)
  private startPad(): void {
    if (this.padRAF !== 0) return;
    this.padRAF = requestAnimationFrame(() => this.pollPad());
  }

  private stopPad(): void {
    if (this.padRAF !== 0) cancelAnimationFrame(this.padRAF);
    this.padRAF = 0;
  }

  private pollPad(): void {
    if (this.stack.length === 0) {
      this.padRAF = 0;
      return;
    }
    const pads = navigator.getGamepads?.() ?? [];
    let gp: Gamepad | null = null;
    for (const p of pads) if (p) gp = p;
    if (gp) {
      const y = gp.axes[1] ?? 0;
      const down = (gp.buttons[13]?.pressed ?? false) || y > 0.5;
      const up = (gp.buttons[12]?.pressed ?? false) || y < -0.5;
      const a = gp.buttons[0]?.pressed ?? false;
      if (down && !this.padPrev.down) this.moveFocus(1);
      if (up && !this.padPrev.up) this.moveFocus(-1);
      if (a && !this.padPrev.a) (document.activeElement as HTMLElement | null)?.click?.();
      this.padPrev.down = down;
      this.padPrev.up = up;
      this.padPrev.a = a;
    }
    this.padRAF = requestAnimationFrame(() => this.pollPad());
  }
}
