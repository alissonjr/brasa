import { el } from "@engine";
import { icon } from "./ds/icons";
import { F, T, onLanguageChange } from "./strings";

/**
 * CAMADA JOGO. HUD de jogo (overlay sobre o canvas), enxuto (spec-ui-hud-ux 2): o selo
 * VERTICAL de profundidade "Câmara N/M" (uma coluna de elos; cada elo aceso é uma câmara
 * já vencida), o ÚNICO texto de objetivo (vem de uma fonte só, `ctx.objective()`), as
 * legendas diegéticas (eco, inscrição, fala), os toasts e o aviso de cena. Sem chip de
 * jogador, sem pontos, sem bússola e sem mapa. Recebe o estado por update().
 */
export interface HudState {
  /** Índice do andar atual (0..total-1). */
  floor: number;
  total: number;
  objective: string;
  /** Está numa antessala (o selo diz "Antessala N"); falso = "Câmara N". */
  antessala?: boolean;
}

/** Que tipo de texto a legenda mostra (muda rótulo e tipografia). */
export type CaptionKind = "eco" | "inscricao" | "voz";

const CAPTION_LABEL: Record<CaptionKind, () => string> = {
  eco: () => T.legendaEco,
  inscricao: () => T.legendaInscricao,
  voz: () => T.legendaVoz,
};

export class GameHud {
  readonly root: HTMLElement;
  private readonly depth: HTMLElement;
  private readonly chain: HTMLElement;
  private readonly numEl: HTMLElement;
  private readonly tagEl: HTMLElement;
  private readonly objectiveEl: HTMLElement;
  private readonly toastLayer: HTMLElement;
  private readonly caption: HTMLElement;
  private readonly captionTag: HTMLElement;
  private readonly captionText: HTMLElement;
  private readonly inscription: HTMLElement;
  private readonly inscriptionTag: HTMLElement;
  private readonly inscriptionText: HTMLElement;
  private readonly sceneEl: HTMLElement;
  private captionKind: CaptionKind = "eco";
  private captionTimer = 0;
  private sceneTimer = 0;
  private links: HTMLElement[] = [];
  private last = { floor: -1, total: -1, objective: "", antessala: false };

  constructor() {
    this.chain = el("ol", { class: "hud-depth__chain", "aria-hidden": "true" });
    this.tagEl = el("span", { class: "ds-label hud-depth__tag", text: T.camara });
    this.numEl = el("span", { class: "hud-depth__n" });
    this.objectiveEl = el("p", { class: "hud-depth__obj" });
    this.depth = el(
      "div",
      { class: "hud-depth", role: "group" },
      this.chain,
      el("div", { class: "hud-depth__text" }, el("div", { class: "hud-depth__head" }, this.tagEl, this.numEl), this.objectiveEl)
    );

    // Legendas: eco (ao entrar), inscrição (perto do nicho) e fala. Ficam à esquerda, sob o
    // selo, longe do centro onde está o combate.
    this.captionTag = el("span", { class: "hud-caption__tag" });
    this.captionText = el("p", { class: "hud-caption__text" });
    this.caption = el("div", { class: "hud-caption", "aria-live": "polite" }, this.captionTag, this.captionText);
    this.inscriptionTag = el("span", { class: "hud-caption__tag", text: T.legendaInscricao });
    this.inscriptionText = el("p", { class: "hud-caption__text" });
    this.inscription = el("div", { class: "hud-caption hud-caption--inscricao", "aria-live": "polite" }, this.inscriptionTag, this.inscriptionText);
    const captions = el("div", { class: "hud-captions" }, this.caption, this.inscription);

    this.sceneEl = el("div", { class: "hud-scene", "aria-live": "polite" });
    this.toastLayer = el("div", { class: "hud-toasts" });
    this.root = el("div", { class: "hud-game" }, this.depth, captions, this.toastLayer, this.sceneEl);

    onLanguageChange(() => {
      this.tagEl.textContent = this.last.antessala ? T.antessala : T.camara;
      this.inscriptionTag.textContent = T.legendaInscricao;
      this.captionTag.textContent = CAPTION_LABEL[this.captionKind]();
      this.last.floor = -1; // refaz o rótulo acessível
      this.last.objective = "";
    });
  }

  setVisible(v: boolean): void {
    this.root.style.display = v ? "" : "none";
  }

  /** Legenda transitória (eco, fala, leitura). Substitui a anterior; some sozinha. */
  say(kind: CaptionKind, text: string, holdMs: number): void {
    window.clearTimeout(this.captionTimer);
    this.captionKind = kind;
    this.caption.dataset.kind = kind;
    this.captionTag.textContent = CAPTION_LABEL[kind]();
    this.captionText.textContent = text;
    this.caption.classList.toggle("on", text.length > 0);
    this.captionTimer = window.setTimeout(() => this.caption.classList.remove("on"), holdMs);
  }

  /** Inscrição gravada na pedra: fica enquanto a Acendedora está perto do nicho. */
  setInscription(text: string | null): void {
    if (text) this.inscriptionText.textContent = text;
    this.inscription.classList.toggle("on", !!text);
  }

  /** Texto de cena grande e central, só para momentos sem combate (a vitória). */
  scene(text: string, holdMs: number): void {
    window.clearTimeout(this.sceneTimer);
    this.sceneEl.textContent = text;
    this.sceneEl.classList.add("on");
    this.sceneTimer = window.setTimeout(() => this.sceneEl.classList.remove("on"), holdMs);
  }

  /** Mostra um toast transitório (ex.: conquista desbloqueada). */
  notify(title: string, subtitle: string): void {
    const toast = el(
      "div",
      { class: "hud-toast", role: "status" },
      el("span", { class: "toast-label", text: T.conquistaDesbloqueada }),
      el("strong", { class: "toast-title", text: title }),
      el("span", { class: "toast-desc", text: subtitle })
    );
    this.toastLayer.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));
    window.setTimeout(() => {
      toast.classList.remove("show");
      window.setTimeout(() => toast.remove(), 400);
    }, 3600);
  }

  /** Aviso curto de jogo (pílula `ds-toast`), ex.: estilha recuperada. */
  toast(text: string, holdMs = 3200): void {
    const toast = el("div", { class: "ds-toast hud-codex-toast", role: "status" }, el("span", { text }));
    this.toastLayer.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));
    window.setTimeout(() => {
      toast.classList.remove("show");
      window.setTimeout(() => toast.remove(), 400);
    }, holdMs);
  }

  /** Aviso "Nova página na Crônica" (pílula `ds-toast`), com os títulos do que foi liberado. */
  notifyCodex(titles: string): void {
    const glyph = el("span", { class: "hud-codex-toast__glyph" });
    glyph.innerHTML = icon("scroll", 18);
    const toast = el(
      "div",
      { class: "ds-toast hud-codex-toast", role: "status" },
      glyph,
      el("span", {}, el("b", { text: T.cronicaNovaPagina }), el("span", { text: `: ${titles}` }))
    );
    this.toastLayer.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));
    window.setTimeout(() => {
      toast.classList.remove("show");
      window.setTimeout(() => toast.remove(), 400);
    }, 4600);
  }

  update(s: HudState): void {
    if (s.total !== this.last.total) {
      this.chain.replaceChildren();
      this.links = [];
      for (let i = 0; i < s.total; i++) {
        const li = el("li", { class: "hud-link" });
        this.chain.appendChild(li);
        this.links.push(li);
      }
      this.last.total = s.total;
      this.last.floor = -1;
    }
    const ant = s.antessala === true;
    if (ant !== this.last.antessala) {
      this.tagEl.textContent = ant ? T.antessala : T.camara;
      this.last.antessala = ant;
      this.last.floor = -1; // refaz o rótulo acessível
    }
    if (s.floor !== this.last.floor) {
      this.links.forEach((li, i) => {
        li.classList.toggle("is-done", i < s.floor);
        li.classList.toggle("is-current", i === s.floor);
      });
      // Quanto mais fundo, mais frio o tom do selo (direção de arte: andares fundos são frios).
      this.depth.style.setProperty("--cold", `${Math.round((s.floor / Math.max(1, s.total - 1)) * 70)}%`);
      this.numEl.innerHTML = "";
      this.numEl.append(el("b", { text: String(s.floor + 1) }), el("i", { text: `/${s.total}` }));
      this.depth.setAttribute("aria-label", F(ant ? "antessalaAria" : "camaraAria", { n: s.floor + 1, t: s.total }));
      this.last.floor = s.floor;
    }
    if (s.objective !== this.last.objective) {
      this.objectiveEl.textContent = s.objective;
      this.last.objective = s.objective;
    }
  }
}
