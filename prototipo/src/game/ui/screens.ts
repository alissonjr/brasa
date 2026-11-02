import "./fonts";
import "./ds/tokens.css";
import "./theme.css";
import "./ds/components.css";
import "./ds/codex.css";
import { icon } from "./ds/icons";
import { illustration, type IllustrationId } from "./ds/illustrations";
import { DEFAULT_BINDINGS, INPUT_ACTIONS, el, type InputAction, type KeyBindings, type Screen } from "@engine";
import type { Quality } from "@platform";
import { T, getLanguage, itemText, onLanguageChange, setLanguage, tr } from "./strings";
import { uiHover, uiClick } from "./uiSound";
import { ModelStage } from "./modelStage";
import { TitleScene } from "./titleScene";
import { formatTime, readLeaderboard, submitTime } from "../content/leaderboard";
import type { UiContext } from "./uiContext";
import { progressPercent } from "../content/campaign";
import { ACHIEVEMENTS } from "../content/achievements";
import {
  CODEX_DESCENT,
  CODEX_ENTRIES,
  CODEX_TOTAL,
  codexProgress,
  isCodexUnlocked,
  romanNumeral,
  type CodexCategory,
  type CodexDecal,
  type CodexEntry,
  type CodexFloor,
} from "../content/codex";
import {
  DIFFICULTIES,
  DONS,
  MANTOS,
  difficultyName,
  domName,
  type CharacterSave,
  type Difficulty,
} from "../content/character";

/**
 * CAMADA JOGO. Telas concretas (a "pele" sobre o framework de UI da engine):
 * menu principal, carregar (slots), opções e pausa. Conversam com a plataforma
 * (save/settings) e disparam as ações de fluxo via UiContext.
 */

// --- helpers de tema ---

/**
 * Moldura padrão das telas de menu: painel `.ds-frame` com cabeçalho (título e subtítulo),
 * corpo que rola e rodapé fixo (Voltar/Fechar ou a linha de ações). Assim, em telas longas,
 * o botão de saída nunca some e as cantoneiras da moldura ficam no lugar.
 * Pilhas de botões (pausa) ficam inteiras no corpo, sem rodapé.
 */
function backdrop(panelChildren: Array<Node | string>, panelClass = "", backdropClass = ""): HTMLElement {
  const isEl = (n: Node | string | undefined): n is HTMLElement => typeof n === "object" && n instanceof HTMLElement;
  const kids = [...panelChildren];
  const head: Array<Node | string> = [];
  while (kids.length > 1 && isEl(kids[0]) && (kids[0].matches(".menu-title") || kids[0].matches(".menu-subtitle"))) {
    head.push(kids.shift()!);
  }
  const last = kids[kids.length - 1];
  const prev = kids[kids.length - 2];
  const lastIsAction = isEl(last) && (last.matches(".menu-actions") || last.matches(".ds-btn"));
  const prevIsButton = isEl(prev) && prev.matches(".ds-btn");
  const foot: Array<Node | string> = [];
  if (kids.length > 1 && lastIsAction && !prevIsButton) foot.push(kids.pop()!);
  const parts: Array<Node | string> = [...head];
  if (kids.length) parts.push(el("div", { class: "menu-body" }, ...kids));
  if (foot.length) parts.push(el("div", { class: "menu-foot" }, ...foot));
  return el(
    "div",
    { class: ("menu-backdrop " + backdropClass).trim() },
    el("div", { class: ("ds-frame menu-panel " + panelClass).trim() }, ...parts)
  );
}

/**
 * Ícones de navegação (line-art gravado; herdam currentColor para acender em ouro).
 * SVG inline porque o helper `el` cria nós HTML, não SVG; injetamos via innerHTML
 * (strings estáticas, sem entrada do usuário).
 */
const ICONS = {
  play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M7 5l12 7-12 7z"/></svg>',
  scroll: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M7 4h9a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V6a2 2 0 0 0-2-2h3"/><path d="M9 9h6M9 13h6"/></svg>',
  person: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><circle cx="12" cy="8" r="3.2"/><path d="M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6"/></svg>',
  layers: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M12 3l8 4-8 4-8-4 8-4z"/><path d="M4 12l8 4 8-4"/><path d="M4 16.5l8 4 8-4"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2"/></svg>',
  exit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M14 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4"/><path d="M10 8l-4 4 4 4M6 12h9"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v2M5.4 6.6l1.4 1.4M18.6 6.6l-1.4 1.4M3 13h2M19 13h2"/><circle cx="12" cy="13" r="3.4"/><path d="M3 19h18"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M14 6l-6 6 6 6M8 12h11"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v14M5 12h14"/></svg>',
  upload: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7 9l5-5 5 5M5 20h14"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 4v12M7 11l5 5 5-5M5 20h14"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13M10 11v6M14 11v6"/></svg>',
  save: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 5a1 1 0 0 1 1-1h10l4 4v11a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z"/><path d="M8 4v5h7M8 20v-6h8v6"/></svg>',
} as const;

/** Glifo padrão para rótulos de navegação comuns (Voltar/Fechar), em qualquer idioma. */
function autoGlyph(label: string): string | undefined {
  if (label === T.voltar) return ICONS.back;
  if (label === T.fechar) return ICONS.close;
  return undefined;
}

function btn(
  label: string,
  onClick: () => void,
  opts?: { disabled?: boolean; variant?: "danger" | "primary"; glyph?: string; iconOnly?: boolean }
): HTMLButtonElement {
  const glyph = opts?.glyph ?? autoGlyph(label);
  const iconOnly = !!opts?.iconOnly && !!glyph;
  const cls = "ds-btn" + (opts?.variant ? " ds-btn--" + opts.variant : "") + (iconOnly ? " ds-btn--icon" : "");
  const b = el("button", { class: cls });
  if (glyph) {
    const g = el("span", { class: "ds-btn__glyph" });
    g.innerHTML = glyph;
    b.append(g);
  }
  if (iconOnly) {
    b.title = label;
    b.setAttribute("aria-label", label);
  } else {
    b.append(el("span", { class: "ds-btn__label", text: label }));
  }
  if (opts?.disabled) b.disabled = true;
  b.addEventListener("pointerenter", uiHover);
  b.addEventListener("click", uiClick);
  b.addEventListener("click", onClick);
  return b;
}

// --- Diálogo de confirmação / alerta (temático, substitui window.alert/confirm) ---

export interface ConfirmOpts {
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
}

export class ConfirmDialog implements Screen {
  readonly element: HTMLElement;
  constructor(ctx: UiContext, o: ConfirmOpts) {
    this.element = backdrop(
      [
        el("h2", { class: "menu-title", text: o.title }),
        el("p", { class: "dialog-msg", text: o.message }),
        el(
          "div",
          { class: "menu-actions" },
          btn(T.cancelar, () => ctx.ui.back()),
          btn(
            o.confirmLabel ?? T.confirmar,
            () => {
              ctx.ui.back();
              o.onConfirm();
            },
            o.danger ? { variant: "danger" } : undefined
          )
        ),
      ],
      "dialog-panel"
    );
  }
}

export class AlertDialog implements Screen {
  readonly element: HTMLElement;
  constructor(ctx: UiContext, o: { title: string; message: string }) {
    this.element = backdrop(
      [
        el("h2", { class: "menu-title", text: o.title }),
        el("p", { class: "dialog-msg", text: o.message }),
        btn(T.fechar, () => ctx.ui.back()),
      ],
      "dialog-panel"
    );
  }
}

// --- Menu principal ---

// UMA heroína em todas as vitrines (título, criação) e no jogo: Cinza, corpo Quaternius vestido de
// Acendedora (heroina.glb; idle da biblioteca anim.glb).
const ACENDEDORA_PREVIEW_MODEL = "/models/personagens/heroina.glb";
// Criação de personagem: o MESMO modelo e atlas do jogo, para o manto escolhido valer na prévia.
const ACENDEDORA_GAME_MODEL = "/models/personagens/heroina.glb";
// "brasa" é o atlas embutido no glb; os demais são variantes recoloridas (heroModel.applyMantle).
const mantleAtlas = (id: string): string => (id === "brasa" ? "" : `/models/personagens/manto_${id}.jpg`);

/**
 * Cor de destaque do diorama da tela-título: menu "evolutivo". A brasa é o ponto quente
 * de sempre (identidade da tela), mas INTENSIFICA de uma brasa-baixa (ember escuro) para
 * a brasa-plena (laranja-ouro) conforme a Brasa é reacesa. Reflete o progresso sem pedir
 * nada ao jogador, sem nunca perder a assinatura quente (ver spec-ui-hud-ux.md 5.1).
 */
function descentAccent(pct: number): string {
  const t = Math.max(0, Math.min(1, pct / 100));
  const ember = [0x7a, 0x2e, 0x18]; // brasa baixa (vermelho-âmbar escuro)
  const blaze = [0xff, 0xa8, 0x4e]; // brasa plena (laranja-ouro)
  const mix = ember.map((c, i) => Math.round(c + (blaze[i]! - c) * t));
  return "#" + mix.map((v) => v.toString(16).padStart(2, "0")).join("");
}

/** Brasas subindo (decoração das telas de entrada). Sem movimento reduzido, vira camada vazia. */
function emberLayer(reduced: boolean, count = 16): HTMLElement {
  const layer = el("div", { class: "cc-embers", "aria-hidden": "true" });
  if (reduced) return layer;
  for (let i = 0; i < count; i++) {
    const left = 6 + ((i * 53) % 88);
    const size = 2 + (i % 4);
    const dur = 7 + ((i * 37) % 60) / 10;
    const delay = -((i * 29) % 70) / 10;
    layer.append(
      el("span", {
        class: "cc-ember",
        style: `left:${left}%;width:${size}px;height:${size}px;animation-duration:${dur}s;animation-delay:${delay}s`,
      }),
    );
  }
  return layer;
}

/** Opção da tela-título: texto puro (sem caixa) que acende em brasa ao focar/hover. */
function cineOption(
  label: string,
  onClick: () => void,
  opts?: { disabled?: boolean; primary?: boolean }
): HTMLButtonElement {
  const cls = "title-cine-opt" + (opts?.primary ? " primary" : "");
  const b = el("button", { class: cls }, el("span", { class: "title-cine-opt-label", text: label }));
  if (opts?.disabled) b.disabled = true;
  b.addEventListener("pointerenter", uiHover);
  b.addEventListener("click", uiClick);
  b.addEventListener("click", onClick);
  return b;
}

export class MainMenuScreen implements Screen {
  readonly element: HTMLElement;
  private readonly scene: TitleScene;

  constructor(ctx: UiContext) {
    // Tela-título CINEMATOGRÁFICA DIEGÉTICA: a Acendedora diante da Brasa na cripta;
    // o menu é texto que flutua sobre a cena e acende em brasa ao focar (ver
    // titleScene.ts e docs/brasa/spec-ui-hud-ux.md 5.1). Sem tabuletas.
    this.scene = new TitleScene({
      modelUrl: ACENDEDORA_PREVIEW_MODEL,
      accent: descentAccent(progressPercent(ctx.progression.state())),
      reducedMotion: ctx.settings.get().reducedMotion,
    });

    const head = el(
      "div",
      { class: "title-cine-head" },
      el("h1", { class: "title-cine-name", text: T.title }),
      el("p", { class: "title-cine-sub", text: T.subtitle }),
      el("div", { class: "ds-divider title-cine-div" }, el("i"))
    );

    // CTA iluminado: Continuar quando há autosave; senão, Nova Descida.
    const menu = el(
      "nav",
      { class: "title-cine-menu" },
      cineOption(T.continuar, () => void ctx.continueGame(), {
        disabled: !ctx.hasAutosave,
        primary: ctx.hasAutosave,
      }),
      cineOption(T.novoJogo, () => void ctx.newGame(), { primary: !ctx.hasAutosave }),
      cineOption(T.carregar, () => ctx.ui.push(new SavesScreen(ctx))),
      cineOption(T.perfil, () => ctx.ui.push(new ProfileScreen(ctx))),
      cineOption(T.opcoes, () => ctx.ui.push(new OptionsScreen(ctx)))
    );

    const overlay = el(
      "div",
      { class: "title-cine-overlay" },
      head,
      menu,
      el("p", { class: "title-cine-verse", text: T.menuVerso })
    );

    this.element = el(
      "div",
      { class: "menu-backdrop title-cinematic" },
      this.scene.element,
      emberLayer(ctx.settings.get().reducedMotion, 22),
      overlay
    );
  }

  onShow(): void {
    this.scene.start();
  }

  onHide(): void {
    this.scene.dispose();
  }
}

/** Locale das datas, pelo idioma ativo da UI. */
const dateLocale = (): string => (getLanguage() === "en" ? "en-US" : "pt-BR");

// --- Carregar / slots de save ---

const AUTO_SLOT = "auto";

function slotLabel(slot: string): string {
  if (slot === AUTO_SLOT) return T.automatico;
  const m = /^slot-(\d+)$/.exec(slot);
  return m ? `${T.manual} ${m[1]}` : slot;
}

export class SavesScreen implements Screen {
  readonly element: HTMLElement;
  private readonly listEl: HTMLElement;
  private readonly ctx: UiContext;
  private readonly canSave: boolean;

  constructor(ctx: UiContext, opts?: { canSave?: boolean }) {
    this.ctx = ctx;
    this.canSave = opts?.canSave ?? false;
    this.listEl = el("div", { class: "slot-list" });

    const fileInput = el("input", { type: "file", accept: "application/json", class: "hidden-file" });
    fileInput.addEventListener("change", async () => {
      const f = fileInput.files?.[0];
      if (!f) return;
      try {
        await ctx.save.importSlot(await this.nextManualSlot(), f); // importa para um slot novo
        await this.refresh();
      } catch (err) {
        ctx.ui.push(
          new AlertDialog(ctx, { title: T.erro, message: (err instanceof Error ? err.message : String(err)) })
        );
      }
      fileInput.value = "";
    });

    const actions: Array<Node> = [];
    if (this.canSave) actions.push(btn(T.novoSave, () => void this.doNewSave(), { glyph: ICONS.plus }));
    actions.push(btn(T.importar, () => fileInput.click(), { glyph: ICONS.upload }));
    actions.push(btn(T.voltar, () => ctx.ui.back()));

    this.element = backdrop([
      el("h2", { class: "menu-title", text: this.canSave ? T.salvarCarregar : T.carregar }),
      this.listEl,
      fileInput,
      el("div", { class: "menu-actions" }, ...actions),
    ]);
  }

  onShow(): void {
    void this.refresh();
  }

  private async nextManualSlot(): Promise<string> {
    const slots = await this.ctx.save.list();
    const nums = slots
      .map((s) => /^slot-(\d+)$/.exec(s.slot)?.[1])
      .filter((n): n is string => n !== undefined)
      .map(Number);
    return `slot-${(nums.length ? Math.max(...nums) : 0) + 1}`;
  }

  private async doNewSave(): Promise<void> {
    await this.ctx.saveToSlot(await this.nextManualSlot());
    await this.refresh();
  }

  private async refresh(): Promise<void> {
    this.listEl.replaceChildren();
    const slots = await this.ctx.save.list();
    if (slots.length === 0) {
      this.listEl.append(el("p", { class: "empty", text: T.semSaves }));
      return;
    }
    for (const s of slots) {
      const quando = new Date(s.updatedAt).toLocaleString(dateLocale());
      const info = el(
        "div",
        { class: "slot-info" },
        el("strong", { text: slotLabel(s.slot) }),
        el("span", { text: `${s.summary || T.capitulo} · ${quando}` })
      );
      // Ações por slot como botões só-ícone (compactos; rótulo vai em title/aria-label).
      const acts: Array<Node> = [
        btn(T.continuar, () => void this.ctx.loadSlot(s.slot), { glyph: ICONS.play, iconOnly: true }),
      ];
      if (this.canSave && s.slot !== AUTO_SLOT) {
        acts.push(btn(T.sobrescrever, () => void this.doSaveTo(s.slot), { glyph: ICONS.save, iconOnly: true }));
      }
      acts.push(btn(T.exportar, () => void this.doExport(s.slot), { glyph: ICONS.download, iconOnly: true }));
      acts.push(
        btn(
          T.apagar,
          () =>
            this.ctx.ui.push(
              new ConfirmDialog(this.ctx, {
                title: T.apagarTitulo,
                message: `${slotLabel(s.slot)} - ${T.apagarMsg}`,
                confirmLabel: T.apagar,
                danger: true,
                onConfirm: () => void this.doDelete(s.slot),
              })
            ),
          { variant: "danger", glyph: ICONS.trash, iconOnly: true }
        )
      );
      this.listEl.append(el("div", { class: "ds-row slot-row" }, info, el("div", { class: "slot-actions" }, ...acts)));
    }
  }

  private async doSaveTo(slot: string): Promise<void> {
    await this.ctx.saveToSlot(slot);
    await this.refresh();
  }

  private async doExport(slot: string): Promise<void> {
    const blob = await this.ctx.save.exportSlot(slot);
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = el("a", { href: url, download: `brasa-save-${slot}.json` });
    a.click();
    URL.revokeObjectURL(url);
  }

  private async doDelete(slot: string): Promise<void> {
    await this.ctx.save.delete(slot);
    await this.refresh();
  }
}

// --- Opções ---

type OptionsTab = "audio" | "controles" | "graficos" | "idioma" | "acessibilidade";

export class OptionsScreen implements Screen {
  readonly element: HTMLElement;

  constructor(ctx: UiContext, initialTab: OptionsTab = "audio") {
    const s = ctx.settings.get();

    // Deslizante do design system: o preenchimento em brasa segue o valor via --p.
    const slider = (label: string, value: number, onChange: (v: number) => void): HTMLElement => {
      const input = el("input", {
        type: "range",
        min: "0",
        max: "100",
        value: String(Math.round(value * 100)),
        class: "ds-range",
        "aria-label": label,
      });
      const paint = (): void => input.style.setProperty("--p", `${input.value}%`);
      paint();
      input.addEventListener("input", () => {
        paint();
        onChange(Number(input.value) / 100);
      });
      return el("label", { class: "opt-row opt-row--range" }, el("span", { text: label }), input);
    };

    // Interruptor do design system (span.ds-toggle com o input escondido dentro).
    const toggle = (label: string, checked: boolean, onChange: (v: boolean) => void): HTMLElement => {
      const input = el("input", { type: "checkbox", role: "switch" }) as HTMLInputElement;
      input.checked = checked;
      input.addEventListener("change", () => onChange(input.checked));
      return el(
        "label",
        { class: "opt-row" },
        el("span", { text: label }),
        el("span", { class: "ds-toggle" }, input, el("span"))
      );
    };

    const langSel = el(
      "select",
      { class: "ds-select", "aria-label": T.idioma },
      el("option", { value: "pt", text: "Português" }),
      el("option", { value: "en", text: "English" })
    );
    langSel.value = s.language;
    langSel.addEventListener("change", () => {
      const lang = langSel.value as "pt" | "en";
      ctx.settings.set({ language: lang });
      setLanguage(lang); // troca o idioma da UI em runtime
      ctx.relocalize(() => new OptionsScreen(ctx, "idioma")); // refaz a tela de baixo e reabre aqui
    });

    const scaleSel = el("select", { class: "ds-select", "aria-label": T.escalaInterface });
    for (const p of [90, 100, 110, 125]) scaleSel.append(el("option", { value: String(p / 100), text: `${p}%` }));
    scaleSel.value = String(s.uiScale);
    scaleSel.addEventListener("change", () => {
      const v = Number(scaleSel.value);
      ctx.settings.set({ uiScale: v });
      ctx.ui.setUiScale(v);
    });

    // Qualidade gráfica (resolução de render + sombras): aplica ao vivo via ctx.
    const qualitySel = el("select", { class: "ds-select", "aria-label": T.qualidade });
    const qualityLabels: Record<Quality, string> = { baixo: T.qualBaixo, medio: T.qualMedio, alto: T.qualAlto };
    for (const q of ["baixo", "medio", "alto"] as Quality[]) qualitySel.append(el("option", { value: q, text: qualityLabels[q] }));
    qualitySel.value = s.quality;
    qualitySel.addEventListener("change", () => {
      const v = qualitySel.value as Quality;
      ctx.settings.set({ quality: v });
      ctx.setQuality(v);
    });

    // Abas (spec-ui-hud-ux 5.3): Áudio, Controles, Gráficos, Idioma, Acessibilidade. Cada aba é
    // um painel; só o ativo aparece (o resto fica `hidden`, fora do foco e das setas).
    const tabs: Array<{ id: OptionsTab; label: string; rows: Array<Node> }> = [
      {
        id: "audio",
        label: T.audio,
        rows: [
          slider(T.geral, s.masterVolume, (v) => ctx.settings.set({ masterVolume: v })),
          slider(T.musica, s.musicVolume, (v) => ctx.settings.set({ musicVolume: v })),
          slider(T.efeitos, s.sfxVolume, (v) => ctx.settings.set({ sfxVolume: v })),
        ],
      },
      { id: "controles", label: T.controles, rows: [btn(T.remapear, () => ctx.ui.push(new ControlsScreen(ctx)))] },
      { id: "graficos", label: T.graficos, rows: [el("label", { class: "opt-row" }, el("span", { text: T.qualidade }), qualitySel)] },
      { id: "idioma", label: T.idioma, rows: [el("label", { class: "opt-row" }, el("span", { text: T.idioma }), langSel)] },
      {
        id: "acessibilidade",
        label: T.acessibilidade,
        rows: [
          el("label", { class: "opt-row" }, el("span", { text: T.escalaInterface }), scaleSel),
          toggle(T.reduzirMovimento, s.reducedMotion, (v) => {
            ctx.settings.set({ reducedMotion: v });
            ctx.setReducedMotion(v);
          }),
          toggle(T.altoContraste, s.highContrast, (v) => {
            ctx.settings.set({ highContrast: v });
            ctx.ui.setHighContrast(v);
          }),
        ],
      },
    ];
    const tablist = el("div", { class: "ds-tabs", role: "tablist", "aria-label": T.opcoes });
    const panels = el("div", { class: "opt-panels" });
    const tabEls = new Map<OptionsTab, HTMLElement>();
    const panelEls = new Map<OptionsTab, HTMLElement>();
    const select = (id: OptionsTab): void => {
      for (const t of tabs) {
        const on = t.id === id;
        tabEls.get(t.id)!.setAttribute("aria-selected", String(on));
        tabEls.get(t.id)!.tabIndex = on ? 0 : -1;
        panelEls.get(t.id)!.hidden = !on;
      }
    };
    for (const t of tabs) {
      const tab = el("button", { class: "ds-tab", type: "button", role: "tab", id: `opt-tab-${t.id}`, "aria-controls": `opt-panel-${t.id}`, text: t.label });
      tab.addEventListener("pointerenter", uiHover);
      tab.addEventListener("click", () => {
        uiClick();
        select(t.id);
      });
      const panel = el("div", { class: "opt-panel", role: "tabpanel", id: `opt-panel-${t.id}`, "aria-labelledby": `opt-tab-${t.id}` }, ...t.rows);
      tabEls.set(t.id, tab);
      panelEls.set(t.id, panel);
      tablist.append(tab);
      panels.append(panel);
    }
    select(initialTab);

    this.element = backdrop([el("h2", { class: "menu-title", text: T.opcoes }), tablist, panels, btn(T.voltar, () => ctx.ui.back())]);
  }
}

// --- Pausa ---

export class PauseScreen implements Screen {
  readonly element: HTMLElement;
  constructor(ctx: UiContext) {
    // Pausa enxuta (spec-ui-hud-ux 5.2 + "less is more" soulslike): só Retomar, Crônica,
    // Opções e Sair, com o objetivo da descida no topo (o MESMO texto do HUD, `ctx.objective()`).
    // Perfil e Salvar/Carregar ficam na tela-título (o jogo autossalva no braseiro).
    this.element = backdrop([
      el("h2", { class: "menu-title", text: T.pausado }),
      el("p", { class: "menu-subtitle", text: ctx.objective() }),
      btn(T.retomar, () => ctx.resume(), { variant: "primary", glyph: ICONS.play }),
      btn(T.cronica, () => ctx.ui.push(new CodexScreen(ctx)), { glyph: ICONS.scroll }),
      btn(T.opcoes, () => ctx.ui.push(new OptionsScreen(ctx)), { glyph: ICONS.gear }),
      btn(
        T.sairTitulo,
        () =>
          ctx.ui.push(
            new ConfirmDialog(ctx, {
              title: T.sairConfirmaTitulo,
              message: T.sairMsg,
              confirmLabel: T.sairTitulo,
              danger: true,
              onConfirm: () => ctx.quitToTitle(),
            })
          ),
        { variant: "danger", glyph: ICONS.exit }
      ),
    ]);
  }
}

// --- Vitória (A Brasa foi reavivada): leaderboard de tempos da descida ---

export class VictoryScreen implements Screen {
  readonly element: HTMLElement;

  constructor(ctx: UiContext, runSeconds: number, timed = true) {
    // timed=false (descida retomada de save) não entra no leaderboard, só exibe.
    const rank = timed ? submitTime(runSeconds) : -1;
    const times = readLeaderboard(); // top 5 já ordenado (melhor primeiro)

    const board = el("div", { class: "score-list" });
    if (times.length === 0) {
      board.append(el("p", { class: "empty", text: T.semTempos }));
    } else {
      times.forEach((t, i) => {
        const isRun = i === rank;
        board.append(
          el(
            "div",
            { class: "ds-row score-row" + (isRun ? " current" : "") },
            el("span", { class: "score-rank", text: `${i + 1}.` }),
            el("span", { class: "score-time", text: formatTime(t) }),
            el("span", { class: "score-tag", text: isRun ? T.estaCorrida : "" })
          )
        );
      });
    }

    this.element = backdrop(
      [
        el("h2", { class: "menu-title", text: T.brasaReavivada }),
        el("p", { class: "menu-subtitle", text: T.vitoriaSub }),
        el(
          "div",
          { class: "profile-stats" },
          statRow(T.tempoDaDescida, formatTime(runSeconds))
        ),
        el("div", { class: "opt-section", text: T.melhoresTempos }),
        board,
        btn(T.sairTitulo, () => ctx.quitToTitle(), { variant: "primary", glyph: ICONS.exit }),
      ],
      "victory-panel"
    );
  }
}

// --- Derrota (A fagulha apagou) ---

/**
 * Tela de derrota. O fluxo de jogo a anexa direto ao body (acima do HUD), então ela se
 * remove sozinha ao escolher; as ações de jogo vêm por callback.
 */
export class DefeatScreen implements Screen {
  readonly element: HTMLElement;

  constructor(_ctx: UiContext, o: { onRetry: () => void; onQuit: () => void }) {
    const done = (next: () => void) => () => {
      this.element.remove();
      next();
    };
    this.element = backdrop(
      [
        el("h2", { class: "menu-title", text: T.fagulhaApagou }),
        el("p", { class: "menu-subtitle", text: T.derrotaSub }),
        el(
          "div",
          { class: "menu-actions" },
          btn(T.tentarNovamente, done(o.onRetry), { variant: "primary", glyph: ICONS.play }),
          btn(T.sairTitulo, done(o.onQuit), { glyph: ICONS.exit })
        ),
      ],
      "dialog-panel defeat-panel"
    );
  }
}

// --- Perfil (nome + estatísticas) ---

function statRow(k: string, v: string): HTMLElement {
  return el("div", { class: "ds-row stat-row" }, el("span", { class: "k", text: k }), el("span", { class: "v", text: v }));
}

function fmtTime(sec: number): string {
  const s = Math.max(0, Math.round(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m ${s % 60}s`;
}

export class ProfileScreen implements Screen {
  readonly element: HTMLElement;

  constructor(ctx: UiContext, onBack: () => void = () => ctx.ui.back()) {
    const p = ctx.profile.current();
    const ch = ctx.character();
    const input = el("input", { class: "ds-input ds-input--sm", type: "text", value: p.name, maxlength: "24", "aria-label": T.nome }) as HTMLInputElement;
    const save = btn(T.salvar, () => {
      const v = input.value.trim();
      if (!v) return;
      ctx.profile.rename(v);
      const lbl = save.querySelector(".ds-btn__label") ?? save;
      lbl.textContent = T.salvo;
      window.setTimeout(() => (lbl.textContent = T.salvar), 900);
    });

    this.element = backdrop([
      el("h2", { class: "menu-title", text: T.perfil }),
      el("div", { class: "field-label", text: T.nome }),
      el("div", { class: "name-row" }, input, save),
      el(
        "div",
        { class: "profile-stats" },
        statRow(T.dificuldade, tr("dif_", `${ch.difficulty}_n`, difficultyName(ch.difficulty))),
        statRow(T.dom, tr("dom_", `${ch.dom}_n`, domName(ch.dom))),
        statRow(T.progresso, `${progressPercent(ctx.progression.state())}%`),
        statRow(T.conquistas, `${ctx.achievements.count()}/${ACHIEVEMENTS.length}`),
        statRow(T.tempoDeJogo, fmtTime(ctx.playtimeSec())),
        statRow(T.capitulo, T.nomeCapitulo),
        statRow(T.membroDesde, new Date(p.createdAt).toLocaleDateString(dateLocale()))
      ),
      el(
        "div",
        { class: "menu-actions" },
        btn(T.conquistas, () => ctx.ui.push(new AchievementsScreen(ctx))),
        btn(T.cronica, () => ctx.ui.push(new CodexScreen(ctx))),
        btn(T.voltar, onBack)
      ),
    ]);
  }
}

// --- Conquistas ---

export class AchievementsScreen implements Screen {
  readonly element: HTMLElement;

  constructor(ctx: UiContext, onBack: () => void = () => ctx.ui.back()) {
    const list = el("div", { class: "ach-list" });
    for (const a of ACHIEVEMENTS) {
      const unlocked = ctx.achievements.has(a.id);
      const txt = itemText("ach_", a);
      list.append(
        el(
          "div",
          { class: "ds-row ach-row" + (unlocked ? " unlocked" : " locked") },
          el("span", { class: "ach-medal" }),
          el(
            "div",
            { class: "ach-text" },
            el("strong", { text: unlocked ? txt.name : "???" }),
            el("span", { text: unlocked ? txt.description : T.bloqueada })
          )
        )
      );
    }
    this.element = backdrop([
      el("h2", { class: "menu-title", text: T.conquistas }),
      el("p", { class: "menu-subtitle", text: `${ctx.achievements.count()}/${ACHIEVEMENTS.length}` }),
      list,
      btn(T.voltar, onBack),
    ]);
  }
}

// --- Controles (remapeamento de teclas) ---

function codeLabel(code: string): string {
  if (code.startsWith("Key")) return code.slice(3);
  if (code.startsWith("Digit")) return code.slice(5);
  const specials: Record<string, string> = {
    ArrowUp: "↑",
    ArrowDown: "↓",
    ArrowLeft: "←",
    ArrowRight: "→",
    Space: T.tcEspaco,
    ShiftLeft: "Shift", ShiftRight: T.tcShiftD,
    ControlLeft: "Ctrl", ControlRight: T.tcCtrlD,
    AltLeft: "Alt", AltRight: T.tcAltD,
    Mouse0: T.tcMouseEsq, Mouse1: T.tcMouseMeio, Mouse2: T.tcMouseDir,
  };
  return specials[code] ?? code;
}

const ACTION_LABEL: Record<InputAction, () => string> = {
  forward: () => T.acFrente,
  back: () => T.acTras,
  left: () => T.acEsq,
  right: () => T.acDir,
  run: () => T.acCorrer,
  jump: () => T.acPular,
  attack: () => T.acAtaque,
  heavy: () => T.acPesado,
  dodge: () => T.acEsquiva,
  block: () => T.acBloqueio,
  ember: () => T.acFagulha,
  lockOn: () => T.acLockon,
  potion1: () => T.acPocao1,
  potion2: () => T.acPocao2,
  interact: () => T.acInteragir,
  execute: () => T.acExecutar,
  ultimate: () => T.acUltimate,
  pickup: () => T.acPegar,
};

/** Mescla o remapeamento salvo (parcial) sobre o padrão da engine. */
function effectiveBindings(saved: Record<string, string[]>): KeyBindings {
  const merged: KeyBindings = { ...DEFAULT_BINDINGS };
  for (const a of INPUT_ACTIONS) {
    const v = saved[a];
    merged[a] = Array.isArray(v) && v.length ? [...v] : [...DEFAULT_BINDINGS[a]];
  }
  return merged;
}

export class ControlsScreen implements Screen {
  readonly element: HTMLElement;
  private readonly listEl: HTMLElement;
  private readonly ctx: UiContext;
  private bindings: KeyBindings;
  private capturing: InputAction | null = null;

  constructor(ctx: UiContext) {
    this.ctx = ctx;
    this.bindings = effectiveBindings(ctx.settings.get().keyBindings);
    this.listEl = el("div", { class: "ctrl-list" });
    this.element = backdrop([
      el("h2", { class: "menu-title", text: T.controles }),
      this.listEl,
      el(
        "div",
        { class: "menu-actions" },
        btn(T.restaurarPadrao, () => this.restoreDefaults()),
        btn(T.voltar, () => ctx.ui.back()),
      ),
    ]);
    this.render();
  }

  onHide(): void {
    this.stopCapture();
  }

  private render(): void {
    this.listEl.replaceChildren();
    for (const action of INPUT_ACTIONS) {
      const keyText = this.capturing === action ? T.pressioneTecla : this.bindings[action].map(codeLabel).join(" / ");
      const keyBtn = btn(keyText, () => this.startCapture(action));
      keyBtn.classList.add("ctrl-key", "ds-btn--sm");
      if (this.capturing === action) keyBtn.classList.add("capturing");
      this.listEl.append(
        el("div", { class: "ds-row ctrl-row" }, el("span", { class: "ctrl-action", text: ACTION_LABEL[action]() }), keyBtn),
      );
    }
  }

  private startCapture(action: InputAction): void {
    this.stopCapture();
    this.capturing = action;
    this.render();
    window.addEventListener("keydown", this.onCapture, { capture: true });
  }

  private stopCapture(): void {
    if (this.capturing === null) return;
    this.capturing = null;
    window.removeEventListener("keydown", this.onCapture, { capture: true } as EventListenerOptions);
  }

  private onCapture = (e: KeyboardEvent): void => {
    // Intercepta antes da navegação por teclado do UiManager (e do jogo).
    e.preventDefault();
    e.stopImmediatePropagation();
    const action = this.capturing;
    this.stopCapture();
    if (!action) return;
    if (e.code !== "Escape") {
      this.bindings = { ...this.bindings, [action]: [e.code] };
      this.persist();
    }
    this.render();
  };

  private restoreDefaults(): void {
    this.stopCapture();
    this.bindings = { ...DEFAULT_BINDINGS };
    this.ctx.settings.set({ keyBindings: {} });
    this.ctx.applyKeyBindings(this.bindings);
    this.render();
  }

  private persist(): void {
    // Guarda só o que difere do padrão (mantém o save enxuto e à prova de futuro).
    const diff: Record<string, string[]> = {};
    for (const a of INPUT_ACTIONS) {
      if (this.bindings[a].join(",") !== DEFAULT_BINDINGS[a].join(",")) diff[a] = this.bindings[a];
    }
    this.ctx.settings.set({ keyBindings: diff });
    this.ctx.applyKeyBindings(this.bindings);
  }
}

// --- Crônica: A Parede (Codex de lore) ---

const CATEGORY_LABEL: Record<CodexCategory, () => string> = {
  personagens: () => T.catPessoa,
  lugares: () => T.catLugar,
  relatos: () => T.catRelato,
};

/** Inclinação (graus) de cada decalque preso na pedra: nenhum fica perfeitamente reto. */
const SLAB_TILT = [-1.6, 1.1, -0.7, 1.5, -1.2, 0.8, -0.5];

/** O que o folheto mostra: um decalque de andar ou um nicho. */
interface CodexPage {
  art: IllustrationId;
  title: string;
  /** Linha em itálico sob o título (o eco do andar, ou o resumo do nicho). */
  verse: string;
  body: string[];
  /** Duas pontas do selo no alto do folheto (ex.: "Andar I" e a camada do poço). */
  seal: [string, string];
  caption: string;
  /** Texto gravado na pedra (só nos decalques). */
  stone?: string;
}

function decalPage(f: CodexFloor, d: CodexDecal): CodexPage {
  return {
    art: d.art,
    title: d.title,
    verse: d.echo,
    body: d.body,
    seal: [`${T.andar} ${romanNumeral(f.n)}`, f.layer],
    caption: `${T.andar} ${romanNumeral(f.n)} · ${f.name}`,
    stone: d.inscription,
  };
}

function entryPage(e: CodexEntry): CodexPage {
  return {
    art: e.art,
    title: e.title,
    verse: e.lead,
    body: e.body,
    seal: [CATEGORY_LABEL[e.category](), e.floor > 0 ? `${T.andar} ${romanNumeral(e.floor)}` : T.cronicaDesdeBoca],
    caption: e.title,
  };
}

/** Cabeçalho de uma faixa da parede: rótulo, fio ornamentado e uma contagem à direita. */
function codexFaixa(label: string, right: string, extra = ""): HTMLElement {
  return el(
    "div",
    { class: ("codex-faixa " + extra).trim() },
    el("span", { class: "ds-label", text: label }),
    el("span", { class: "ds-divider" }),
    el("span", { class: "ds-label codex-faixa__r", text: right })
  );
}

export class CodexScreen implements Screen {
  readonly element: HTMLElement;
  /** Última laje/nicho aberta: o foco volta a ela quando o folheto fecha. */
  private opener: HTMLElement | null = null;

  constructor(ctx: UiContext, onBack: () => void = () => ctx.ui.back()) {
    const log = ctx.codex;
    const fresh = log.takeFresh(); // o que foi liberado desde a última vez: papel cai, nicho acende
    const prog = codexProgress(log);
    const open = (node: HTMLElement, page: CodexPage): void => {
      this.opener = node;
      ctx.ui.push(new CodexEntryScreen(ctx, page));
    };
    // O "novo" só vale para a primeira exibição: ao fim da animação, tira a classe, para o
    // papel não cair de novo quando o folheto fecha e esta tela volta a aparecer.
    const settle = (node: HTMLElement, animated: HTMLElement): void => {
      animated.addEventListener("animationend", (e) => {
        if (e.target === animated) node.classList.remove("is-new");
      });
    };

    const steps = el("div", { class: "codex-steps" });
    CODEX_DESCENT.forEach((f, i) => {
      const num = romanNumeral(f.n);
      const d = f.decal;
      const readNow = !!d && isCodexUnlocked(d, log);
      const next = CODEX_DESCENT[i + 1]?.decal;
      const lit = readNow && !!next && isCodexUnlocked(next, log);
      const style = `--k:${i};--rot:${SLAB_TILT[i] ?? 0}deg`;
      if (d && readNow) {
        const paper = el("span", { class: "codex-paper" });
        const q = el("q", { text: d.inscription });
        paper.append(q, el("small", { text: d.title }));
        const slab = el(
          "button",
          {
            class: "codex-slab" + (lit ? " is-lit" : "") + (fresh.has(d.id) ? " is-new" : ""),
            type: "button",
            style,
            "aria-label": `${T.andar} ${num}: ${d.title}`,
          },
          el("span", { class: "codex-slab__n" }, el("b", { text: num }), el("span", { text: f.layerShort })),
          paper
        );
        slab.addEventListener("pointerenter", uiHover);
        slab.addEventListener("click", () => {
          uiClick();
          open(slab, decalPage(f, d));
        });
        if (fresh.has(d.id)) settle(slab, q);
        steps.append(slab);
      } else {
        const vago = el("span", { class: "codex-vago" });
        vago.innerHTML = icon("lock", 22);
        vago.append(el("span", { text: T.cronicaLajeVazia }));
        steps.append(
          el(
            "div",
            { class: "codex-slab is-empty", style, role: "img", "aria-label": `${T.andar} ${num}, ${T.cronicaSemDecalque}` },
            el("span", { class: "codex-slab__n" }, el("b", { text: num }), el("span")),
            vago
          )
        );
      }
    });

    const niches = el("div", { class: "codex-niches" });
    for (const e of CODEX_ENTRIES) {
      const lit = isCodexUnlocked(e, log);
      const arch = el("span", { class: "codex-niche__arch" });
      arch.innerHTML = illustration(e.art);
      if (lit) {
        const niche = el(
          "button",
          {
            class: "codex-niche" + (fresh.has(e.id) ? " is-new" : ""),
            type: "button",
            "aria-label": `${CATEGORY_LABEL[e.category]()}: ${e.title}`,
          },
          arch,
          el("span", { class: "codex-niche__t", text: e.title }),
          el("span", { class: "codex-niche__s", text: CATEGORY_LABEL[e.category]() })
        );
        niche.addEventListener("pointerenter", uiHover);
        niche.addEventListener("click", () => {
          uiClick();
          open(niche, entryPage(e));
        });
        if (fresh.has(e.id)) settle(niche, arch);
        niches.append(niche);
      } else {
        const vela = el("span", { class: "codex-niche__vela" });
        vela.innerHTML = icon("flame", 20);
        arch.append(vela);
        const where = `${T.andar} ${romanNumeral(e.floor)}`;
        niches.append(
          el(
            "div",
            { class: "codex-niche is-empty", role: "img", "aria-label": `${T.cronicaApagado}, ${where}` },
            arch,
            el("span", { class: "codex-niche__t", text: T.cronicaApagado }),
            el("span", { class: "codex-niche__s", text: where })
          )
        );
      }
    }

    const wall = el(
      "section",
      { class: "codex-wall", "aria-label": T.cronicaPedra },
      codexFaixa(T.cronicaPedra, `${T.cronicaDecalques} ${prog.decals}/${CODEX_TOTAL.decals}`),
      steps,
      codexFaixa(T.cronicaNichos, `${T.cronicaRegistros} ${prog.entries}/${CODEX_TOTAL.entries}`, "codex-faixa--nichos"),
      niches
    );

    this.element = backdrop(
      [
        el("h2", { class: "menu-title", text: T.cronica }),
        el("p", { class: "menu-subtitle", text: T.cronicaSubtitulo }),
        wall,
        btn(T.voltar, onBack),
      ],
      "codex-panel"
    );
  }

  onShow(): void {
    // O UiManager foca o primeiro controle logo depois deste gancho; adia um quadro para
    // devolver o foco à laje/nicho que o jogador abriu.
    const o = this.opener;
    const body = this.element.querySelector<HTMLElement>(".menu-body");
    requestAnimationFrame(() => {
      if (o) o.focus();
      else if (body) body.scrollTop = 0; // primeira vez: começa no topo da parede
    });
  }
}

/** O folheto: a gravura impressa em papel velho, com o texto ao lado. Esc/Voltar fecham. */
class CodexEntryScreen implements Screen {
  readonly element: HTMLElement;

  constructor(ctx: UiContext, page: CodexPage) {
    const back = btn(T.voltar, () => ctx.ui.back());
    back.classList.add("ds-btn--ghost");

    const plate = el("div", { class: "codex-folheto__plate" });
    plate.innerHTML = illustration(page.art);
    const figure = el("figure", { class: "codex-folheto__img" }, plate, el("figcaption", { text: page.caption }));

    const text = el(
      "div",
      { class: "codex-folheto__txt" },
      el("h2", { text: page.title }),
      el("p", { class: "codex-folheto__ver", text: page.verse }),
      ...page.body.map((p) => el("p", { class: "codex-folheto__par", text: p }))
    );
    if (page.stone) {
      text.append(el("div", { class: "codex-folheto__pedra" }, el("small", { text: T.cronicaGravada }), page.stone));
    }

    this.element = el(
      "div",
      { class: "menu-backdrop codex-veu" },
      el(
        "article",
        { class: "codex-folheto" },
        el(
          "div",
          { class: "codex-folheto__bar" },
          back,
          el("div", { class: "codex-folheto__sel" }, el("span", { text: page.seal[0] }), el("span", { text: page.seal[1] }))
        ),
        el("div", { class: "codex-folheto__scroll" }, figure, text)
      )
    );
  }
}

// --- Nova Jornada (criação de personagem) ---

function mantoColor(id: string): string {
  return MANTOS.find((m) => m.id === id)?.color ?? MANTOS[0]!.color;
}

const CC_DOM_ICON: Record<string, string> = { luz: "spark", memoria: "eye", calor: "flame" };
const CC_DIFF_FLAMES: Record<string, number> = { faisca: 1, brasa: 2, fornalha: 3 };

export class CharacterCreateScreen implements Screen {
  readonly element: HTMLElement;
  private readonly draft: CharacterSave;
  private readonly stage: ModelStage;

  constructor(ctx: UiContext) {
    const base = ctx.character();
    // Nome padrão da heroína: o dela (Cinza, canon §0) ou o do personagem salvo; o perfil do
    // jogador ("Jogador") não vira nome da Acendedora.
    this.draft = { ...base };
    const reduced = ctx.settings.get().reducedMotion;

    // Herói grande e interativo: a Acendedora gira; o manto escolhido tinge a luz do nicho.
    this.stage = new ModelStage({
      modelUrl: ACENDEDORA_GAME_MODEL,
      accent: mantoColor(this.draft.manto),
      mantleTextureUrl: mantleAtlas(this.draft.manto),
      autoRotate: !reduced,
    });

    const steps = [
      { label: T.passoAparencia, sub: T.passoAparenciaSub },
      { label: T.passoDom, sub: T.passoDomSub },
      { label: T.passoDificuldade, sub: T.passoDificuldadeSub },
    ];
    let step = 0;

    const heroName = el("div", { class: "cc-hero-name", text: this.draft.name });
    const stepper = el("div", { class: "ds-steps" });
    const heading = el("h2", { class: "ds-h1 cc-heading" });
    const sub = el("p", { class: "ds-lead cc-sub" });
    const content = el("div", { class: "cc-content" });
    const actions = el("div", { class: "cc-actions" });

    // --- Passo 1: nome + manto ---
    const buildAparencia = (): HTMLElement => {
      const nameInput = el("input", {
        class: "ds-input",
        type: "text",
        value: this.draft.name,
        maxlength: "24",
        placeholder: T.nomeAcendedoraDica,
        "aria-label": T.nomeHeroi,
      }) as HTMLInputElement;
      nameInput.addEventListener("input", () => {
        this.draft.name = nameInput.value;
        heroName.textContent = nameInput.value.trim() || base.name;
      });
      nameInput.addEventListener("keydown", (e) => {
        if ((e as KeyboardEvent).key === "Enter") goTo(1);
      });
      const swatches = el("div", { class: "cc-swatches" });
      const buttons = MANTOS.map((m, i) => {
        const b = el(
          "button",
          { class: "ds-swatch ds-rise", title: tr("manto_", m.id, m.name), style: `--i:${i};--c:${m.color}` },
          el("span", { class: "ds-swatch__dot" }),
          el("span", { text: tr("manto_", m.id, m.name) }),
        );
        b.addEventListener("pointerenter", uiHover);
        b.addEventListener("click", () => {
          uiClick();
          this.draft.manto = m.id;
          this.stage.setAccent(m.color);
          this.stage.setMantleTexture(mantleAtlas(m.id));
          sync();
        });
        return { id: m.id, b };
      });
      const sync = (): void => {
        for (const { id, b } of buttons) b.classList.toggle("selected", id === this.draft.manto);
      };
      swatches.append(...buttons.map((x) => x.b));
      sync();
      window.setTimeout(() => nameInput.focus({ preventScroll: true }), 60);
      return el(
        "div",
        { class: "cc-step" },
        el("div", { class: "ds-label cc-field", text: T.nomeHeroi }),
        nameInput,
        el("div", { class: "ds-label cc-field", text: T.corDoManto }),
        swatches,
      );
    };

    // --- Passos 2 e 3: cartas altas ---
    const buildCards = (
      items: Array<{ id: string; name: string; description: string }>,
      current: () => string,
      choose: (id: string) => void,
      icon: (id: string) => string,
    ): HTMLElement => {
      const wrap = el("div", { class: "cc-cards" });
      const cards = items.map((it, i) => {
        const iconEl = el("div", { class: "ds-card__icon" });
        iconEl.innerHTML = icon(it.id);
        const b = el(
          "button",
          { class: "ds-card ds-rise", style: `--i:${i}` },
          iconEl,
          el("strong", { class: "ds-card__title", text: it.name }),
          el("span", { class: "ds-card__text", text: it.description }),
        );
        b.addEventListener("pointerenter", uiHover);
        b.addEventListener("click", () => {
          uiClick();
          choose(it.id);
          sync();
        });
        return { id: it.id, b };
      });
      const sync = (): void => {
        for (const { id, b } of cards) b.classList.toggle("selected", id === current());
      };
      wrap.append(...cards.map((x) => x.b));
      sync();
      return el("div", { class: "cc-step ds-slide" }, wrap);
    };

    const buildDom = (): HTMLElement =>
      buildCards(
        DONS.map((d) => ({ id: d.id, ...itemText("dom_", d) })),
        () => this.draft.dom,
        (id) => (this.draft.dom = id),
        (id) => icon(CC_DOM_ICON[id] ?? "spark", 46),
      );
    const buildDificuldade = (): HTMLElement =>
      buildCards(
        DIFFICULTIES.map((d) => ({ id: d.id, ...itemText("dif_", d) })),
        () => this.draft.difficulty,
        (id) => (this.draft.difficulty = id as Difficulty),
        (id) => icon("flame", 46).repeat(CC_DIFF_FLAMES[id] ?? 1),
      );

    const builders = [buildAparencia, buildDom, buildDificuldade];

    const renderStepper = (): void => {
      stepper.replaceChildren();
      steps.forEach((s, i) => {
        const cls = "ds-step" + (i === step ? " current" : i < step ? " done" : "");
        const b = el(
          "button",
          { class: cls, disabled: i > step, "aria-label": s.label },
          el("i"),
          el("span", { text: s.label }),
        );
        b.addEventListener("click", () => i < step && goTo(i));
        stepper.append(b);
        if (i < steps.length - 1) stepper.append(el("span", { class: "ds-steps__line" + (i < step ? " done" : "") }));
      });
    };

    const renderActions = (): void => {
      actions.replaceChildren();
      actions.append(btn(step === 0 ? T.cancelar : T.voltar, () => (step === 0 ? ctx.ui.back() : goTo(step - 1))));
      if (step < steps.length - 1) {
        actions.append(btn(T.proximo, () => goTo(step + 1), { variant: "primary" }));
      } else {
        actions.append(
          btn(
            T.comecar,
            () => {
              const name = this.draft.name.trim();
              void ctx.startNewGame({ ...this.draft, name: name || base.name });
            },
            { variant: "primary" },
          ),
        );
      }
    };

    const goTo = (n: number): void => {
      step = Math.max(0, Math.min(steps.length - 1, n));
      heading.textContent = steps[step]!.label;
      sub.textContent = steps[step]!.sub;
      content.replaceChildren(builders[step]!());
      renderStepper();
      renderActions();
    };
    goTo(0);

    const embers = emberLayer(reduced);

    this.element = el(
      "div",
      { class: "cc-root" },
      el("div", { class: "cc-hero" }, this.stage.element, embers, heroName, el("span", { class: "cc-hero-hint", text: T.arrasteParaGirar })),
      el(
        "div",
        { class: "cc-side" },
        el("div", { class: "ds-label cc-title", text: T.novaJornada }),
        stepper,
        heading,
        sub,
        content,
        actions,
      ),
    );
  }

  onShow(): void {
    this.stage.start();
  }

  onHide(): void {
    this.stage.dispose();
  }
}

// --- Indicador de autosave (HUD) ---

/** Botão "Menu" persistente no HUD do jogo (abre a pausa). Discoverável e tocável. */
export function createPauseButton(onClick: () => void): HTMLElement {
  const label = el("span", { text: T.menu });
  const b = el("button", { class: "hud-pause-btn", title: T.pausarTitulo }, el("span", { class: "glyph", text: "≡" }), label);
  onLanguageChange(() => {
    b.title = T.pausarTitulo;
    label.textContent = T.menu;
  });
  b.addEventListener("pointerenter", uiHover);
  b.addEventListener("click", uiClick);
  b.addEventListener("click", onClick);
  return b;
}

export function createAutosaveIndicator(): { element: HTMLElement; flash: () => void } {
  const element = el("div", { class: "autosave-indicator", text: T.autosalvando });
  onLanguageChange(() => (element.textContent = T.autosalvando));
  let timer = 0;
  const flash = (): void => {
    element.classList.add("show");
    window.clearTimeout(timer);
    timer = window.setTimeout(() => element.classList.remove("show"), 900);
  };
  return { element, flash };
}
