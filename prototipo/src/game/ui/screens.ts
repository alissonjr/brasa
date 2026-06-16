import "./fonts";
import "./theme.css";
import { DEFAULT_BINDINGS, INPUT_ACTIONS, el, type InputAction, type KeyBindings, type Screen } from "@engine";
import type { DialogueSpeed, Quality } from "@platform";
import { T, setLanguage } from "./strings";
import { uiHover, uiClick } from "./uiSound";
import { ModelStage } from "./modelStage";
import { TitleScene } from "./titleScene";
import type { UiContext } from "./uiContext";
import { LANDMARKS, WORLD_HALF, type LandmarkKind } from "../content/map";
import { CAMPAIGN, chapterName, currentObjective, findChapter, progressPercent } from "../content/campaign";
import { ACHIEVEMENTS } from "../content/achievements";
import {
  CODEX_CATEGORIES,
  codexByCategory,
  codexUnlockedCount,
  isCodexUnlocked,
  type CodexCategory,
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

function backdrop(panelChildren: Array<Node | string>, panelClass = "", backdropClass = ""): HTMLElement {
  return el(
    "div",
    { class: ("menu-backdrop " + backdropClass).trim() },
    el("div", { class: ("menu-panel " + panelClass).trim() }, ...panelChildren)
  );
}

/**
 * Ícones de navegação (line-art gravado; herdam currentColor para acender em ouro).
 * SVG inline porque o helper `el` cria nós HTML, não SVG; injetamos via innerHTML
 * (strings estáticas, sem entrada do usuário).
 */
const ICONS = {
  play: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"><path d="M7 5l12 7-12 7z"/></svg>',
  map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/></svg>',
  book: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M5 4h11a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H5z"/><path d="M9 8h6M9 12h5"/></svg>',
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
  const cls = "btn" + (opts?.variant ? " btn-" + opts.variant : "") + (iconOnly ? " btn-icon" : "");
  const b = el("button", { class: cls });
  if (glyph) {
    const g = el("span", { class: "btn-glyph" });
    g.innerHTML = glyph;
    b.append(g);
  }
  if (iconOnly) {
    b.title = label;
    b.setAttribute("aria-label", label);
  } else {
    b.append(el("span", { class: "btn-label", text: label }));
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

/** Modelo próprio da Acendedora nas vitrines de menu (estático; a câmera é que orbita). */
const ACENDEDORA_PREVIEW_MODEL = "/models/acendedora.glb";

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
      el("p", { class: "title-cine-sub", text: T.subtitle })
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

    this.element = el("div", { class: "menu-backdrop title-cinematic" }, this.scene.element, overlay);
  }

  onShow(): void {
    this.scene.start();
  }

  onHide(): void {
    this.scene.dispose();
  }
}

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
      el("div", { class: "menu-actions" }, ...actions),
      fileInput,
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
      const quando = new Date(s.updatedAt).toLocaleString("pt-BR");
      const info = el(
        "div",
        { class: "slot-info" },
        el("strong", { text: slotLabel(s.slot) }),
        el("span", { text: `${s.summary || T.capitulo} · ${T.pontos}: ${s.points} · ${quando}` })
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
      this.listEl.append(el("div", { class: "slot-row" }, info, el("div", { class: "slot-actions" }, ...acts)));
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

export class OptionsScreen implements Screen {
  readonly element: HTMLElement;

  constructor(ctx: UiContext) {
    const s = ctx.settings.get();

    const slider = (label: string, value: number, onChange: (v: number) => void): HTMLElement => {
      const input = el("input", {
        type: "range",
        min: "0",
        max: "100",
        value: String(Math.round(value * 100)),
        class: "slider",
      });
      input.addEventListener("input", () => onChange(Number(input.value) / 100));
      return el("label", { class: "opt-row" }, el("span", { text: label }), input);
    };

    const toggle = (label: string, checked: boolean, onChange: (v: boolean) => void): HTMLElement => {
      const input = el("input", { type: "checkbox", class: "checkbox" }) as HTMLInputElement;
      input.checked = checked;
      input.addEventListener("change", () => onChange(input.checked));
      return el("label", { class: "opt-row" }, el("span", { text: label }), input);
    };

    const langSel = el(
      "select",
      { class: "select" },
      el("option", { value: "pt", text: "Português" }),
      el("option", { value: "en", text: "English" })
    );
    langSel.value = s.language;
    langSel.addEventListener("change", () => {
      const lang = langSel.value as "pt" | "en";
      ctx.settings.set({ language: lang });
      setLanguage(lang); // troca o idioma da UI em runtime
      ctx.ui.back(); // reabre esta tela já no novo idioma
      ctx.ui.push(new OptionsScreen(ctx));
    });

    const scaleSel = el("select", { class: "select" });
    for (const p of [90, 100, 110, 125]) scaleSel.append(el("option", { value: String(p / 100), text: `${p}%` }));
    scaleSel.value = String(s.uiScale);
    scaleSel.addEventListener("change", () => {
      const v = Number(scaleSel.value);
      ctx.settings.set({ uiScale: v });
      ctx.ui.setUiScale(v);
    });

    // Qualidade gráfica (resolução de render + sombras): aplica ao vivo via ctx.
    const qualitySel = el("select", { class: "select" });
    const qualityLabels: Record<Quality, string> = { baixo: T.qualBaixo, medio: T.qualMedio, alto: T.qualAlto };
    for (const q of ["baixo", "medio", "alto"] as Quality[]) qualitySel.append(el("option", { value: q, text: qualityLabels[q] }));
    qualitySel.value = s.quality;
    qualitySel.addEventListener("change", () => {
      const v = qualitySel.value as Quality;
      ctx.settings.set({ quality: v });
      ctx.setQuality(v);
    });

    // Velocidade do typewriter de diálogo (persiste; a caixa de diálogo consome no futuro).
    const speedSel = el("select", { class: "select" });
    const speedLabels: Record<DialogueSpeed, string> = {
      lento: T.velLento,
      normal: T.velNormal,
      rapido: T.velRapido,
      instantaneo: T.velInstantaneo,
    };
    for (const sp of ["lento", "normal", "rapido", "instantaneo"] as DialogueSpeed[]) {
      speedSel.append(el("option", { value: sp, text: speedLabels[sp] }));
    }
    speedSel.value = s.dialogueSpeed;
    speedSel.addEventListener("change", () => ctx.settings.set({ dialogueSpeed: speedSel.value as DialogueSpeed }));

    this.element = backdrop([
      el("h2", { class: "menu-title", text: T.opcoes }),
      el("div", { class: "opt-section", text: T.audio }),
      slider(T.geral, s.masterVolume, (v) => ctx.settings.set({ masterVolume: v })),
      slider(T.musica, s.musicVolume, (v) => ctx.settings.set({ musicVolume: v })),
      slider(T.efeitos, s.sfxVolume, (v) => ctx.settings.set({ sfxVolume: v })),
      el("p", { class: "opt-note", text: T.audioEmBreve }),
      el("div", { class: "opt-section", text: T.graficos }),
      el("label", { class: "opt-row" }, el("span", { text: T.qualidade }), qualitySel),
      el("div", { class: "opt-section", text: T.dialogo }),
      el("label", { class: "opt-row" }, el("span", { text: T.velocidadeTexto }), speedSel),
      el("p", { class: "opt-note", text: T.dialogoEmBreve }),
      el("div", { class: "opt-section", text: T.controles }),
      btn(T.controles, () => ctx.ui.push(new ControlsScreen(ctx))),
      el("div", { class: "opt-section", text: T.acessibilidade }),
      el("label", { class: "opt-row" }, el("span", { text: T.escalaInterface }), scaleSel),
      toggle(T.reduzirMovimento, s.reducedMotion, (v) => {
        ctx.settings.set({ reducedMotion: v });
        ctx.ui.setReducedMotion(v);
      }),
      toggle(T.altoContraste, s.highContrast, (v) => {
        ctx.settings.set({ highContrast: v });
        ctx.ui.setHighContrast(v);
      }),
      el("label", { class: "opt-row" }, el("span", { text: T.idioma }), langSel),
      btn(T.voltar, () => ctx.ui.back()),
    ]);
  }
}

// --- Pausa ---

export class PauseScreen implements Screen {
  readonly element: HTMLElement;
  constructor(ctx: UiContext) {
    // Pausa enxuta (spec-ui-hud-ux 5.2 + "less is more" soulslike): só Retomar, Crônica,
    // Opções e Sair, com a descida como contexto no topo. Mapa e Perfil seguem no HUD;
    // Salvar/Carregar fica na tela-título (o jogo autossalva no braseiro). Diário sai
    // (o telão de progresso é a própria descida, 2.3), sem quest log.
    this.element = backdrop([
      el("h2", { class: "menu-title", text: T.pausado }),
      el("p", { class: "menu-subtitle", text: currentObjective(ctx.progression.state()) }),
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

// --- Perfil (nome + estatísticas) ---

function statRow(k: string, v: string): HTMLElement {
  return el("div", { class: "stat-row" }, el("span", { class: "k", text: k }), el("span", { class: "v", text: v }));
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
    const input = el("input", { class: "text-input", type: "text", value: p.name, maxlength: "24" }) as HTMLInputElement;
    const save = btn(T.salvar, () => {
      const v = input.value.trim();
      if (!v) return;
      ctx.profile.rename(v);
      const lbl = save.querySelector(".btn-label") ?? save;
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
        statRow(T.dificuldade, difficultyName(ch.difficulty)),
        statRow(T.dom, domName(ch.dom)),
        statRow(T.pontos, String(ctx.score.total)),
        statRow(T.progresso, `${progressPercent(ctx.progression.state())}%`),
        statRow(T.conquistas, `${ctx.achievements.count()}/${ACHIEVEMENTS.length}`),
        statRow(T.tempoDeJogo, fmtTime(ctx.playtimeSec())),
        statRow(T.capitulo, chapterName(ctx.progression.state())),
        statRow(T.membroDesde, new Date(p.createdAt).toLocaleDateString("pt-BR"))
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
      list.append(
        el(
          "div",
          { class: "ach-row" + (unlocked ? " unlocked" : "") },
          el("span", { class: "ach-medal" }),
          el(
            "div",
            { class: "ach-text" },
            el("strong", { text: unlocked ? a.name : "???" }),
            el("span", { text: unlocked ? a.description : T.bloqueada })
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

// --- Mapa da Descida (corte do poço-cripta) ---

const MAP_COLORS: Record<LandmarkKind, string> = {
  entrada: "#7c8a98",
  camara: "#9aa6b3",
  brasa: "#ff8a3c",
};

function mapMarker(c: CanvasRenderingContext2D, x: number, y: number, kind: LandmarkKind): void {
  c.fillStyle = MAP_COLORS[kind];
  c.strokeStyle = "#0c1118";
  c.lineWidth = 1.5;
  if (kind === "camara") {
    c.fillRect(x - 7, y - 7, 14, 14);
    c.strokeRect(x - 7, y - 7, 14, 14);
  } else if (kind === "entrada") {
    c.beginPath();
    c.arc(x, y, 7, 0, Math.PI * 2);
    c.stroke();
  } else {
    // A Brasa: círculo com halo quente.
    const halo = c.createRadialGradient(x, y, 1, x, y, 16);
    halo.addColorStop(0, "rgba(255,138,60,0.9)");
    halo.addColorStop(1, "rgba(255,138,60,0)");
    c.fillStyle = halo;
    c.beginPath();
    c.arc(x, y, 16, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = MAP_COLORS.brasa;
    c.beginPath();
    c.arc(x, y, 6, 0, Math.PI * 2);
    c.fill();
    c.stroke();
  }
}

function legendItem(color: string, label: string): HTMLElement {
  return el("span", {}, el("span", { class: "legend-dot", style: `background:${color}` }), el("span", { text: label }));
}

export class WorldMapScreen implements Screen {
  readonly element: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: UiContext;

  constructor(ctx: UiContext, onBack: () => void = () => ctx.ui.back()) {
    this.ctx = ctx;
    this.canvas = el("canvas", { class: "map-canvas", width: "680", height: "460" }) as HTMLCanvasElement;
    this.element = backdrop(
      [
        el("h2", { class: "menu-title", text: T.mapaTitulo }),
        el("p", { class: "menu-subtitle", text: currentObjective(ctx.progression.state()) }),
        this.canvas,
        el(
          "div",
          { class: "map-legend" },
          legendItem(MAP_COLORS.entrada, "Boca do poço"),
          legendItem(MAP_COLORS.camara, "Câmara"),
          legendItem(MAP_COLORS.brasa, "A Brasa"),
          legendItem("#ffd27a", T.voceEstaAqui)
        ),
        btn(T.fechar, onBack),
      ],
      "map-panel"
    );
  }

  onShow(): void {
    this.draw();
  }

  private draw(): void {
    const c = this.canvas.getContext("2d");
    if (!c) return;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const m = 48;
    // Corte vertical do poço: profundidade = eixo Z do mundo (entrada no topo, Brasa no fundo).
    const toY = (z: number) => m + ((z + WORLD_HALF) / (2 * WORLD_HALF)) * (H - 2 * m);
    const shaftX = W / 2;

    // Fundo frio do poço.
    const g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#1a2230");
    g.addColorStop(1, "#0a0e14");
    c.fillStyle = g;
    c.fillRect(0, 0, W, H);

    // O eixo do poço (parede de pedra fria descendo).
    c.strokeStyle = "rgba(120,140,160,0.5)";
    c.lineWidth = 26;
    c.lineCap = "round";
    c.beginPath();
    c.moveTo(shaftX, toY(-WORLD_HALF + 4));
    c.lineTo(shaftX, toY(WORLD_HALF - 4));
    c.stroke();

    // Marcos da descida + rótulos.
    c.textAlign = "left";
    c.textBaseline = "middle";
    for (const lm of LANDMARKS) {
      const py = toY(lm.z);
      mapMarker(c, shaftX, py, lm.kind);
      c.fillStyle = "#cdd6e0";
      c.font = "15px 'EB Garamond', serif";
      c.fillText(lm.name, shaftX + 22, py);
    }

    // A Acendedora ("Você está aqui"), pela profundidade atual.
    const pp = this.ctx.playerPos();
    const py = toY(pp.z);
    c.fillStyle = "#ffd27a";
    c.beginPath();
    c.arc(shaftX - 22, py, 6, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "#0c1118";
    c.lineWidth = 1.5;
    c.stroke();

    // Indicador de profundidade.
    c.fillStyle = "#7c8a98";
    c.font = "bold 14px Cinzel, serif";
    c.textAlign = "center";
    c.fillText("FUNDO", shaftX, H - m / 2);
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
    Space: "Espaço",
    ShiftLeft: "Shift", ShiftRight: "Shift D.",
    ControlLeft: "Ctrl", ControlRight: "Ctrl D.",
    AltLeft: "Alt", AltRight: "Alt D.",
    Mouse0: "Botão esq.", Mouse1: "Botão meio", Mouse2: "Botão dir.",
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
  potion1: () => "Poção: Recuperação",
  potion2: () => "Poção: Fúria",
  interact: () => "Acender / Interagir",
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
      keyBtn.classList.add("ctrl-key");
      if (this.capturing === action) keyBtn.classList.add("capturing");
      this.listEl.append(
        el("div", { class: "ctrl-row" }, el("span", { class: "ctrl-action", text: ACTION_LABEL[action]() }), keyBtn),
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

// --- Crônica (Codex de lore) ---

const CATEGORY_LABEL: Record<CodexCategory, () => string> = {
  personagens: () => T.catPersonagens,
  lugares: () => T.catLugares,
  relatos: () => T.catRelatos,
};

export class CodexScreen implements Screen {
  readonly element: HTMLElement;

  constructor(ctx: UiContext, onBack: () => void = () => ctx.ui.back()) {
    const state = ctx.progression.state();
    const { unlocked, total } = codexUnlockedCount(state);
    const body = el("div", { class: "codex-body" });

    for (const cat of CODEX_CATEGORIES) {
      const entries = codexByCategory(cat);
      if (!entries.length) continue;
      body.append(el("div", { class: "opt-section", text: CATEGORY_LABEL[cat]() }));
      for (const entry of entries) {
        const open = isCodexUnlocked(entry, state);
        const row = el(
          "div",
          { class: "codex-row" + (open ? "" : " locked") },
          el("span", { class: "codex-seal codex-seal-" + cat }),
          el(
            "div",
            { class: "codex-text" },
            el("strong", { text: open ? entry.title : "???" }),
            el("span", { text: open ? entry.lead : T.registroOculto }),
          ),
        );
        if (open) {
          row.classList.add("clickable");
          row.setAttribute("tabindex", "0");
          const openEntry = (): void => ctx.ui.push(new CodexEntryScreen(ctx, entry.title, entry.body, entry.model));
          row.addEventListener("click", openEntry);
          row.addEventListener("keydown", (e) => {
            if ((e as KeyboardEvent).key === "Enter") openEntry();
          });
        }
        body.append(row);
      }
    }

    this.element = backdrop(
      [
        el("h2", { class: "menu-title", text: T.cronica }),
        el("p", { class: "menu-subtitle", text: `${T.cronicaSubtitulo} (${unlocked}/${total})` }),
        body,
        btn(T.voltar, onBack),
      ],
      "codex-panel",
    );
  }
}

class CodexEntryScreen implements Screen {
  readonly element: HTMLElement;
  private readonly stage?: ModelStage;

  constructor(ctx: UiContext, title: string, bodyText: string, modelUrl?: string) {
    const paras = bodyText.split("\n").map((p) => el("p", { class: "codex-para", text: p }));
    const article = el("div", { class: "codex-article" }, ...paras);

    if (modelUrl) {
      // Verbete imersivo: vitrine 3D girando ao lado do texto (duas colunas).
      this.stage = new ModelStage({ modelUrl, autoRotate: !ctx.settings.get().reducedMotion });
      const stageCol = el(
        "div",
        { class: "codex-stage-col" },
        this.stage.element,
        el("span", { class: "model-stage-hint", text: T.arrasteParaGirar })
      );
      this.element = backdrop(
        [
          el("h2", { class: "menu-title", text: title }),
          el("div", { class: "codex-spread" }, stageCol, el("div", { class: "codex-spread-text" }, article)),
          btn(T.voltar, () => ctx.ui.back()),
        ],
        "codex-panel codex-panel-spread",
      );
    } else {
      this.element = backdrop(
        [el("h2", { class: "menu-title", text: title }), article, btn(T.voltar, () => ctx.ui.back())],
        "codex-panel",
      );
    }
  }

  onShow(): void {
    this.stage?.start();
  }

  onHide(): void {
    this.stage?.dispose();
  }
}

// --- Diário (registro de objetivos da campanha) ---

export class QuestLogScreen implements Screen {
  readonly element: HTMLElement;

  constructor(ctx: UiContext, onBack: () => void = () => ctx.ui.back()) {
    const state = ctx.progression.state();
    const done = new Set(state.objectivesDone);
    const body = el("div", { class: "quest-body" });

    // Mostra o capítulo atual com destaque e os demais como contexto.
    const activeChapter = findChapter(state);
    for (const chapter of CAMPAIGN) {
      const isActive = chapter.id === activeChapter.id;
      const total = chapter.objectives.length;
      const doneN = chapter.objectives.filter((o) => done.has(o.id)).length;
      body.append(
        el(
          "div",
          { class: "quest-chapter" + (isActive ? " active" : "") },
          el("span", { class: "quest-ch-name", text: chapter.name }),
          el("span", { class: "quest-ch-count", text: `${doneN}/${total}` }),
        ),
      );
      let currentMarked = false;
      for (const obj of chapter.objectives) {
        const isDone = done.has(obj.id);
        let cls = "quest-row";
        if (isDone) cls += " done";
        else if (isActive && !currentMarked) {
          cls += " current";
          currentMarked = true;
        }
        body.append(
          el(
            "div",
            { class: cls },
            el("span", { class: "quest-mark", text: isDone ? "✓" : "" }),
            el("span", { class: "quest-text", text: obj.text }),
            el("span", { class: "quest-pts", text: `+${obj.points}` }),
          ),
        );
      }
    }

    const objective = currentObjective(state);
    this.element = backdrop(
      [
        el("h2", { class: "menu-title", text: T.diarioTitulo }),
        el("p", { class: "menu-subtitle", text: objective }),
        body,
        btn(T.voltar, onBack),
      ],
      "quest-panel",
    );
  }
}

// --- Nova Jornada (criação de personagem) ---

function mantoColor(id: string): string {
  return MANTOS.find((m) => m.id === id)?.color ?? MANTOS[0]!.color;
}

export class CharacterCreateScreen implements Screen {
  readonly element: HTMLElement;
  private readonly draft: CharacterSave;
  private readonly stage: ModelStage;

  constructor(ctx: UiContext) {
    const base = ctx.character();
    this.draft = { ...base, name: ctx.profile.current().name || base.name };

    // Vitrine 3D: a Acendedora girando; o manto escolhido tinge a luz do nicho.
    this.stage = new ModelStage({
      modelUrl: ACENDEDORA_PREVIEW_MODEL,
      accent: mantoColor(this.draft.manto),
      autoRotate: !ctx.settings.get().reducedMotion,
    });

    const nameInput = el("input", {
      class: "text-input",
      type: "text",
      value: this.draft.name,
      maxlength: "24",
    }) as HTMLInputElement;
    nameInput.addEventListener("input", () => (this.draft.name = nameInput.value));

    // Cor do manto: amostras selecionáveis.
    const mantoGroup = el("div", { class: "swatch-group" });
    const mantoButtons = MANTOS.map((m) => {
      const b = el(
        "button",
        { class: "swatch", title: m.name },
        el("span", { class: "swatch-dot", style: `background:${m.color}` }),
        el("span", { text: m.name }),
      );
      b.addEventListener("click", () => {
        this.draft.manto = m.id;
        this.stage.setAccent(m.color); // banha a Acendedora na cor do manto, ao vivo
        syncMantos();
      });
      return { id: m.id, b };
    });
    const syncMantos = (): void => {
      for (const { id, b } of mantoButtons) b.classList.toggle("selected", id === this.draft.manto);
    };
    mantoGroup.append(...mantoButtons.map((x) => x.b));
    syncMantos();

    // Dom inicial e Dificuldade: cartões com nome + descrição.
    const domGroup = el("div", { class: "choice-group" });
    const domButtons = DONS.map((d) => {
      const b = el("button", { class: "choice" }, el("strong", { text: d.name }), el("span", { text: d.description }));
      b.addEventListener("click", () => {
        this.draft.dom = d.id;
        syncDom();
      });
      return { id: d.id, b };
    });
    const syncDom = (): void => {
      for (const { id, b } of domButtons) b.classList.toggle("selected", id === this.draft.dom);
    };
    domGroup.append(...domButtons.map((x) => x.b));
    syncDom();

    const diffGroup = el("div", { class: "choice-group" });
    const diffButtons = DIFFICULTIES.map((d) => {
      const b = el("button", { class: "choice" }, el("strong", { text: d.name }), el("span", { text: d.description }));
      b.addEventListener("click", () => {
        this.draft.difficulty = d.id as Difficulty;
        syncDiff();
      });
      return { id: d.id, b };
    });
    const syncDiff = (): void => {
      for (const { id, b } of diffButtons) b.classList.toggle("selected", id === this.draft.difficulty);
    };
    diffGroup.append(...diffButtons.map((x) => x.b));
    syncDiff();

    const form = el(
      "div",
      { class: "create-form" },
      el("div", { class: "field-label", text: T.nomeHeroi }),
      nameInput,
      el("div", { class: "field-label", text: T.corDoManto }),
      mantoGroup,
      el("div", { class: "field-label", text: T.domInicial }),
      domGroup,
      el("div", { class: "field-label", text: T.dificuldade }),
      diffGroup,
    );

    const stageCol = el(
      "div",
      { class: "create-stage-col" },
      this.stage.element,
      el("span", { class: "model-stage-hint", text: T.arrasteParaGirar }),
    );

    this.element = backdrop(
      [
        el("h2", { class: "menu-title", text: T.novaJornada }),
        el("p", { class: "menu-subtitle", text: T.novaJornadaSub }),
        el("div", { class: "create-spread" }, stageCol, form),
        el(
          "div",
          { class: "menu-actions" },
          btn(T.cancelar, () => ctx.ui.back()),
          btn(T.comecar, () => {
            const name = this.draft.name.trim();
            void ctx.startNewGame({ ...this.draft, name: name || base.name });
          }),
        ),
      ],
      "create-panel create-panel-spread",
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
  const b = el(
    "button",
    { class: "hud-pause-btn", title: "Pausar (Esc)" },
    el("span", { class: "glyph", text: "≡" }),
    el("span", { text: T.menu })
  );
  b.addEventListener("pointerenter", uiHover);
  b.addEventListener("click", uiClick);
  b.addEventListener("click", onClick);
  return b;
}

export function createAutosaveIndicator(): { element: HTMLElement; flash: () => void } {
  const element = el("div", { class: "autosave-indicator", text: T.autosalvando });
  let timer = 0;
  const flash = (): void => {
    element.classList.add("show");
    window.clearTimeout(timer);
    timer = window.setTimeout(() => element.classList.remove("show"), 900);
  };
  return { element, flash };
}
