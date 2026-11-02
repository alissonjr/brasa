/**
 * CAMADA JOGO. MURAIS (fase R5): a PLACA que aparece ao apertar [R] diante da parede-mural da
 * antessala (redesenho da descida, seção 5). Dois painéis lado a lado e a inscrição embaixo:
 *  - "o que foi": a gravura da Crônica (a mesma do decalque), sempre legível;
 *  - "o que vem": os mortos da câmara seguinte (busto + marcas de contagem exatas), o glifo do
 *    perigo, o olho da emboscada, as duas cristas das ondas, a vela da vigília. Só se lê com o
 *    braseiro aceso (estado `lit`); frio, fica no escuro, e o nome acessível não revela nada.
 * "A parede é o futuro, a Crônica é a memória": este módulo só mostra; quem marca `mural:n` na
 * Crônica é a integração (via `onOpen`).
 *
 * Este arquivo também guarda os DADOS dos sete murais (`muralDataFor`), em estrutura simples,
 * para não depender da fase R0. A integração liga `MuralData.vem` à composição real de
 * `content/descida.ts` (a honestidade do mural é por construção: o mural muda com o tuning).
 *
 * Não importa os barris `@engine`/`@game`: só `ds/*`, `strings` e `content/codex`. Assim a página
 * de dev (`mocks/mural/`) roda sem Babylon nem Havok.
 */
import "./ds/mural.css";
import { icon } from "./ds/icons";
import {
  BUST_KINDS,
  HAZARD_KINDS,
  illustration,
  muralVem,
  type BustKind,
  type HazardKind,
  type IllustrationId,
  type MuralFormat,
  type MuralMorto,
  type MuralNext,
} from "./ds/illustrations";
import { CODEX_DESCENT, romanNumeral } from "../content/codex";
import { CAMARAS, type PerigoId } from "../content/descida";
import { F, T, onLanguageChange, type StringKey } from "./strings";

// --- Dados ---

/** O que o mural de uma antessala diz. `andar` é 1 a 7 (a antessala A(n) precede a câmara C(n)). */
export interface MuralData {
  andar: number;
  /** Gravura do painel "o que foi" (a do decalque da Crônica, `muralArt ?? art`). */
  foi: IllustrationId;
  /** O aviso da câmara seguinte. */
  vem: MuralNext;
  /** Inscrição do andar (a mesma de `FLOOR_INSCRIPTIONS`: uma fonte só). PT, como a Crônica. */
  inscricao: string;
}

const PERIGO: Record<PerigoId, HazardKind> = {
  chao_cede: "chao",
  colunas_moveis: "colunas",
  agua: "agua",
  fissura_quente: "fissura",
  arena_encolhe: "arena",
  grades_quentes: "grade",
  tumulo_arrombado: "tumulo",
};

/**
 * "O que vem" gerado da composição REAL da câmara seguinte (`CAMARAS[index]` de `content/descida.ts`):
 * honesto por construção, o mural muda junto com a formação. Os grupos da onda 2 viram o segundo grupo
 * (as duas cristas entre eles); o olho marca o grupo emboscado; a vela, a Vigília; a Guardiã (C7, que é o
 * chefe e não um `SkeletonKind`) entra como busto próprio.
 */
export function vemDaCamara(index: number): MuralNext {
  const cam = CAMARAS[Math.min(CAMARAS.length - 1, Math.max(0, index))]!;
  const ondas: MuralMorto[][] = [[], []];
  for (const g of cam.formacao) {
    const lista = ondas[g.onda === 2 ? 1 : 0]!;
    for (const kind of g.mortos) {
      const m = lista.find((x) => x.kind === kind && !!x.emboscada === !!g.emboscada);
      if (m) m.n += 1;
      else lista.push({ kind, n: 1, ...(g.emboscada ? { emboscada: true } : {}), ...(kind === "sentinela" ? { manto: true } : {}) });
    }
  }
  if (cam.index === CAMARAS.length - 1) ondas[0]!.push({ kind: "guardia", n: 1 });
  const grupos = ondas.filter((l) => l.length > 0);
  const perigos: HazardKind[] = cam.perigos.map((p) => PERIGO[p]);
  if (cam.modo === "vigilia") perigos.push("vigilia");
  return { grupos, perigos };
}

/** Os dados do mural da antessala do `andar` (1 a 7). Fora da faixa, prende ao mais próximo. */
export function muralDataFor(andar: number): MuralData {
  const n = Math.min(7, Math.max(1, Math.round(andar)));
  const decal = CODEX_DESCENT[n - 1]?.decal;
  return {
    andar: n,
    foi: decal?.muralArt ?? decal?.art ?? "braseiro",
    vem: vemDaCamara(n - 1),
    inscricao: decal?.inscription ?? "",
  };
}

const hazardOf = (d: MuralData): HazardKind[] => d.vem.perigos;
const mortoCount = (d: MuralData): number => d.vem.grupos.flat().reduce((a, m) => a + m.n, 0);

/**
 * A linha de registro do decalque, depois de limpar a câmara (5.5): "Mortos despertos: 4. O chão
 * cedeu." Só estática: sai dos mesmos dados do mural. PENDENTE de revisão de texto (frases em
 * `strings.ts`, `reg_*`).
 */
export function muralRegistro(andar: number): string {
  const d = muralDataFor(andar);
  const parts: string[] = [];
  const guardia = d.vem.grupos.flat().some((m) => m.kind === "guardia");
  parts.push(guardia ? T.cronicaRegistroGuardia : F("cronicaRegistro", { n: mortoCount(d) }));
  if (d.vem.grupos.flat().some((m) => m.emboscada)) parts.push(T.cronicaRegistroEmboscada);
  if (d.vem.grupos.length > 1) parts.push(T.reg_ondas);
  for (const h of hazardOf(d)) {
    const k = `reg_${h}` as StringKey;
    if (k in T) parts.push(T[k]);
  }
  return parts.join(" ");
}

/** Nome de um tipo de morto no idioma ativo. */
export const mortoNome = (kind: BustKind): string => T[`morto_${kind}` as StringKey];
/** Nome de um perigo no idioma ativo. */
export const perigoNome = (kind: HazardKind): string => T[`perigo_${kind}` as StringKey];
export { BUST_KINDS, HAZARD_KINDS };

/** Lista falada do "o que vem" (só no estado aceso): "Manso (2), Demônio (1), emboscada, chão que cede". */
export function muralVemTexto(d: MuralData): string[] {
  const out: string[] = [];
  d.vem.grupos.forEach((g, i) => {
    if (i > 0) out.push(perigoNome("ondas"));
    for (const m of g) {
      const base = F("muralItem", { nome: mortoNome(m.kind), n: m.n });
      const tags = [m.manto ? T.muralManto : "", m.emboscada ? perigoNome("emboscada").toLowerCase() : ""].filter(Boolean);
      out.push(tags.length ? `${base}, ${tags.join(", ")}` : base);
    }
  });
  for (const h of hazardOf(d)) out.push(perigoNome(h));
  return out;
}

/** SVG do painel "o que vem" (pronto para a placa ou para a textura do painel 3D). */
export function muralVemSvg(d: MuralData, format: MuralFormat = "retrato"): string {
  return muralVem(d.vem, format);
}
/** SVG do painel "o que foi" (a gravura do decalque). */
export function muralFoiSvg(d: MuralData, format: MuralFormat = "retrato"): string {
  return illustration(d.foi, format);
}

export type { MuralFormat, MuralMorto, MuralNext, BustKind, HazardKind };

// --- A placa (DOM) ---

export interface MuralPlateOptions {
  /** Esta tecla abre e fecha a placa (default: KeyR). Passe o predicado da ação "interact" remapeada. */
  isToggleKey?: (e: KeyboardEvent) => boolean;
  /** Chamado depois de abrir (a integração marca `mural:n` na Crônica e toca o sussurro). */
  onOpen?: (andar: number, lit: boolean) => void;
  /** Chamado depois de fechar. */
  onClose?: () => void;
}

type Attrs = Record<string, string>;
function h(tag: string, attrs: Attrs = {}, ...kids: Array<Node | string>): HTMLElement {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  for (const kid of kids) node.append(kid);
  return node;
}

let plateSeq = 0;

/** Monta (ou atualiza) o painel "o que vem" conforme o estado frio/aceso. */
function applyVem(pane: HTMLElement, d: MuralData, lit: boolean, animate: boolean): void {
  const wasLit = pane.classList.contains("is-lit");
  if (!pane.firstChild) {
    const label = h("h3", { class: "ds-label mural-pane__l", id: `mural-vem-${pane.dataset.seq}` });
    label.textContent = T.muralVem;
    const art = h("div", { class: "mural-art" });
    art.innerHTML = muralVemSvg(d);
    const dark = h("p", { class: "mural-dark" });
    dark.textContent = T.muralApagado;
    art.append(dark);
    pane.append(label, art);
  }
  pane.classList.toggle("is-lit", lit);
  pane.classList.toggle("is-cold", !lit);
  // Acessibilidade: frio, o nome acessível não revela os mortos; aceso, há a lista falada.
  pane.querySelector(".mural-sr")?.remove();
  const art = pane.querySelector<HTMLElement>(".mural-art")!;
  pane.querySelector<HTMLElement>(".mural-dark")!.hidden = lit;
  if (lit) {
    pane.removeAttribute("aria-label");
    pane.setAttribute("aria-labelledby", `mural-vem-${pane.dataset.seq}`);
    const list = h("ul", { class: "mural-sr" });
    for (const t of muralVemTexto(d)) list.append(h("li", {}, t));
    pane.append(list);
    if (animate && !wasLit) {
      art.classList.remove("is-rising");
      void art.offsetWidth; // reinicia a animação da luz que sobe
      art.classList.add("is-rising");
      art.addEventListener("animationend", () => art.classList.remove("is-rising"), { once: true });
    }
  } else {
    pane.removeAttribute("aria-labelledby");
    pane.setAttribute("aria-label", T.muralApagadoAria);
  }
}

/**
 * Só o DOM da placa (sem teclado, sem foco): usado pela classe `MuralPlate` e pela página de dev,
 * que mostra os sete andares nos dois estados lado a lado. `vem` é o painel direito, para `applyMuralLit`.
 */
export function buildMuralPlate(d: MuralData, lit: boolean, onClose: () => void = () => {}): { plate: HTMLElement; vem: HTMLElement } {
  const seq = ++plateSeq;
  const nome = T[`muralAntessala${d.andar}` as StringKey];

  const close = h("button", { class: "ds-btn ds-btn--ghost ds-btn--sm mural-close", type: "button" });
  close.innerHTML = `${icon("close", 16)}<span class="ds-btn__label"></span>`;
  close.querySelector(".ds-btn__label")!.textContent = T.fechar;
  close.addEventListener("click", onClose);

  const head = h(
    "header",
    { class: "mural-head" },
    h("div", { class: "mural-head__t" }, h("span", { class: "ds-label" }), h("h2", { class: "ds-h2" })),
    close
  );
  head.querySelector(".ds-label")!.textContent = `${T.andar} ${romanNumeral(d.andar)}`;
  head.querySelector("h2")!.textContent = nome;

  const foi = h("section", { class: "mural-pane mural-pane--foi", "aria-labelledby": `mural-foi-${seq}` });
  const foiLabel = h("h3", { class: "ds-label mural-pane__l", id: `mural-foi-${seq}` });
  foiLabel.textContent = T.muralFoi;
  const foiArt = h("div", { class: "mural-art" });
  foiArt.innerHTML = muralFoiSvg(d);
  foi.append(foiLabel, foiArt);

  const vem = h("section", { class: "mural-pane mural-pane--vem" });
  vem.dataset.seq = String(seq);
  applyVem(vem, d, lit, false);

  const insc = h("blockquote", { class: "mural-insc" }, h("small", {}), h("q", {}));
  insc.querySelector("small")!.textContent = T.cronicaGravada;
  insc.querySelector("q")!.textContent = d.inscricao;

  const foot = h("footer", { class: "mural-foot" });
  foot.append(h("kbd", { class: "ds-kbd" }, "R"), h("kbd", { class: "ds-kbd" }, "Esc"), h("span", { class: "mural-foot__t" }, T.muralFecharDica));

  const plate = h(
    "div",
    {
      class: "mural-plate ds-frame",
      role: "dialog",
      "aria-modal": "true",
      "aria-label": F("muralAria", { n: d.andar, nome }),
      tabindex: "-1",
      "data-andar": String(d.andar),
    },
    head,
    h("div", { class: "mural-panes" }, foi, vem),
    insc,
    foot
  );
  return { plate, vem };
}

/** Acende (ou apaga) o painel direito de uma placa já montada; a luz sobe de baixo para cima. */
export function applyMuralLit(vem: HTMLElement, d: MuralData, lit: boolean): void {
  applyVem(vem, d, lit, true);
}

export class MuralPlate {
  private readonly root: HTMLElement;
  private readonly opts: MuralPlateOptions;
  private plate: HTMLElement | null = null;
  private vemPane: HTMLElement | null = null;
  private data: MuralData | null = null;
  private lit = false;
  private openedAt = 0;
  private restore: HTMLElement | null = null;
  private readonly off: () => void;
  private readonly onKey = (e: KeyboardEvent): void => this.handleKey(e);

  /** `host`: elemento posicionado (position != static) que cobre a tela de jogo, ex.: a camada de HUD. */
  constructor(host: HTMLElement, opts: MuralPlateOptions = {}) {
    this.opts = opts;
    this.root = h("div", { class: "mural-root", hidden: "" });
    host.append(this.root);
    // Trocar o idioma com a placa aberta refaz o texto (os desenhos não têm texto).
    this.off = onLanguageChange(() => {
      if (this.data) this.render();
    });
  }

  get isOpen(): boolean {
    return this.plate !== null;
  }

  /** Abre a placa do andar `andar` (1 a 7); `lit` = braseiro aceso. Se já aberta, só atualiza. */
  open(andar: number, lit: boolean): void {
    const wasOpen = this.isOpen;
    this.data = muralDataFor(andar);
    this.lit = lit;
    if (!wasOpen) {
      this.restore = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      this.openedAt = performance.now();
      document.addEventListener("keydown", this.onKey, true);
    }
    this.render();
    this.root.hidden = false;
    this.plate?.focus({ preventScroll: true });
    if (!wasOpen) this.opts.onOpen?.(this.data.andar, lit);
  }

  /** Abre se fechada, fecha se aberta. */
  toggle(andar: number, lit: boolean): void {
    if (this.isOpen) this.close();
    else this.open(andar, lit);
  }

  /** Acende (ou apaga) o painel "o que vem" com a placa aberta: a luz sobe de baixo para cima. */
  setLit(lit: boolean): void {
    if (!this.data || !this.vemPane || lit === this.lit) return;
    this.lit = lit;
    applyVem(this.vemPane, this.data, lit, true);
  }

  close(): void {
    if (!this.plate) return;
    document.removeEventListener("keydown", this.onKey, true);
    this.plate = null;
    this.vemPane = null;
    this.data = null;
    this.root.hidden = true;
    this.root.replaceChildren();
    const back = this.restore;
    this.restore = null;
    if (back && back.isConnected) back.focus({ preventScroll: true });
    this.opts.onClose?.();
  }

  dispose(): void {
    if (this.isOpen) this.close();
    this.off();
    this.root.remove();
  }

  // --- interno ---

  private handleKey(e: KeyboardEvent): void {
    if (!this.plate || e.timeStamp <= this.openedAt) return; // o toque que abriu não fecha
    const toggle = this.opts.isToggleKey ?? ((ev: KeyboardEvent) => ev.code === "KeyR");
    if (e.key === "Escape" || toggle(e)) {
      e.preventDefault();
      e.stopImmediatePropagation();
      if (!e.repeat) this.close();
      return;
    }
    if (e.key === "Tab") {
      // Um só controle (fechar): o foco gira entre ele e a própria placa.
      e.preventDefault();
      const btn = this.plate.querySelector<HTMLElement>(".mural-close");
      if (btn && document.activeElement !== btn) btn.focus();
      else this.plate.focus({ preventScroll: true });
    }
  }

  private render(): void {
    const d = this.data;
    if (!d) return;
    const hadFocus = this.plate !== null && this.root.contains(document.activeElement);
    const { plate, vem } = buildMuralPlate(d, this.lit, () => this.close());
    this.root.replaceChildren(plate);
    this.plate = plate;
    this.vemPane = vem;
    if (hadFocus) plate.focus({ preventScroll: true });
  }
}
