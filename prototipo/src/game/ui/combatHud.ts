import { el } from "@engine";
import { T, onLanguageChange } from "./strings";

/**
 * CAMADA JOGO. HUD de combate (M2.2): barra de VIDA (canto inferior-esquerdo, placa de
 * argila/bronze) + arco de STAMINA logo acima, e vinheta de dano (meta UI) que pisca ao
 * ser atingido. Vestido conforme spec-ui-hud-ux §2 (não-diegético vestido; vermelho-tijolo
 * para vida, bronze para stamina). Componente autossuficiente: injeta seu próprio CSS uma
 * vez (reaproveitando as variáveis de tema globais), para não disputar os arquivos
 * theme.css/hud.ts que estão sendo co-editados. A stamina some quando cheia (não compete).
 */
const STYLE_ID = "combat-hud-style";
const CSS = `
.combat-hud { position:absolute; left:18px; bottom:50px; width:260px; pointer-events:none;
  font-family:var(--font-display,"Cinzel",Georgia,serif); }
.chud-bar { position:relative; height:18px; border:1px solid var(--gold-700,#5c4115); border-radius:3px;
  background:var(--ink-950,#06080c); box-shadow:inset 0 2px 4px rgba(0,0,0,.7), 0 2px 6px rgba(0,0,0,.45); overflow:hidden; }
.chud-bar + .chud-bar { margin-top:6px; }
/* A barra "assenta" com easing em vez de linear seco. */
.chud-fill { position:absolute; inset:2px; transform-origin:left center; transition:transform .18s cubic-bezier(.34,1.56,.64,1); }
.chud-fill::after { content:""; position:absolute; left:0; right:0; top:0; height:40%;
  background:linear-gradient(180deg,rgba(255,255,255,.28),transparent); }
.chud-health { height:20px; }
.chud-health .chud-fill { background:linear-gradient(180deg,var(--blood-400,#d9473a),var(--blood-600,#8e2a20)); }
.chud-stamina { height:10px; width:200px; opacity:1; transition:opacity .3s ease; }
.chud-stamina .chud-fill { inset:1px; background:linear-gradient(180deg,var(--gold-300,#f2c46d),var(--gold-500,#b5832d)); }
.chud-stamina.full { opacity:0; }
.chud-label { position:absolute; left:9px; top:50%; transform:translateY(-50%); z-index:1;
  font-size:10px; letter-spacing:.22em; color:var(--text-hi,#f3e8d0); text-shadow:0 1px 2px #000; }
/* FAGULHA em CARGAS: fileira de losangos. Cheio = aceso; vazio = consumido; o pip em
   regeneracao preenche por baixo (clip). */
.chud-spark-row { display:flex; align-items:center; gap:9px; margin-top:8px; height:16px; }
.chud-spark-label { font-size:10px; letter-spacing:.22em; color:var(--gold-400,#d9a441); text-shadow:0 1px 2px #000; margin-right:2px; }
.chud-pip { position:relative; width:13px; height:13px; transform:rotate(45deg);
  border:1px solid var(--gold-600,#8a621f); background:rgba(10,13,19,.8); border-radius:3px; overflow:hidden;
  box-shadow:inset 0 0 6px rgba(0,0,0,.6); }
.chud-pip-fill { position:absolute; inset:0; transform-origin:bottom center; transform:scaleY(0);
  background:linear-gradient(0deg,var(--ember-500,#ff6a13),var(--ember-200,#ffd9a8)); transition:transform .15s linear; }
.chud-pip.lit { border-color:var(--ember-200,#ffd9a8); box-shadow:inset 0 0 6px rgba(0,0,0,.4), 0 0 10px rgba(255,138,44,.7); }
/* RESSONÂNCIA: marcas que acendem com o streak de acertos sem apanhar (some quando inativa). */
.chud-reso-row { display:flex; align-items:center; gap:5px; margin-top:7px; height:12px; opacity:0; transition:opacity .2s ease; }
.chud-reso-row.on { opacity:1; }
.chud-reso-label { font-size:9px; letter-spacing:.22em; color:var(--gold-200,#ffe0a0); text-shadow:0 1px 2px #000; margin-right:2px; }
.chud-reso-mark { width:9px; height:12px; transform:skewX(-20deg); background:rgba(40,28,12,.7); border:1px solid var(--gold-600,#8a621f); border-radius:2px; }
.chud-reso-mark.lit { background:linear-gradient(180deg,var(--gold-100,#fff1cf),var(--ember-400,#ff8a2c)); border-color:var(--gold-200,#ffe0a0); box-shadow:0 0 6px rgba(255,174,58,.6); }
.damage-vignette { position:absolute; inset:0; pointer-events:none; opacity:0;
  background:radial-gradient(ellipse at center, transparent 55%, rgba(150,30,20,.55) 100%);
  transition:opacity .4s ease; }
.damage-vignette.show { opacity:1; transition:opacity .06s ease; }
/* Feedback POSITIVO de combate: moldura curta de borda (acerto=ouro, cura=verde, bloqueio=bronze). */
.combat-feedback { position:absolute; inset:0; pointer-events:none; opacity:0;
  box-shadow:inset 0 0 90px 8px rgba(255,196,90,0); transition:opacity .22s ease; }
.combat-feedback.fb-hit { box-shadow:inset 0 0 90px 8px rgba(255,196,90,.45); }
.combat-feedback.fb-heal { box-shadow:inset 0 0 90px 8px rgba(120,220,140,.42); }
.combat-feedback.fb-block { box-shadow:inset 0 0 90px 8px rgba(210,150,70,.45); }
.combat-feedback.fb-perfect { box-shadow:inset 0 0 110px 14px rgba(150,225,255,.55); }
.combat-feedback.show { opacity:1; transition:opacity .05s ease; }
/* Dicas de controle do onboarding (onboarding.ts): fileira discreta de fichas curtas, uma por
   ação ainda não feita; cada ficha acende em ouro e some quando o jogador faz a ação. Fica
   no pé da tela, longe do herói (que fica no centro), e some atrás de qualquer menu. */
.combat-hint { position:absolute; left:50%; bottom:22px; transform:translateX(-50%);
  display:flex; align-items:center; gap:10px; pointer-events:none; white-space:nowrap;
  font-family:var(--font-text,"EB Garamond",Georgia,serif); font-size:15px; color:var(--text-mid,#bdb299);
  transition:opacity .35s ease; }
html.ui-open .combat-hint { opacity:0; }
.chint { display:flex; align-items:center; gap:7px; padding:5px 14px 5px 7px;
  background:rgba(10,13,19,.72); border:1px solid var(--gold-700,#5c4115); border-radius:999px;
  box-shadow:0 6px 16px rgba(0,0,0,.45); opacity:0; transform:translateY(6px);
  transition:opacity .35s ease, transform .35s ease, border-color .25s ease, box-shadow .25s ease; }
.chint.in { opacity:.9; transform:none; }
.chint .ds-kbd { min-width:22px; height:22px; font-size:11px; letter-spacing:.04em; }
.chint.ok { animation:chint-ok .5s ease forwards; border-color:var(--gold-300,#f2c46d); }
@keyframes chint-ok {
  0% { opacity:.9; box-shadow:0 0 0 rgba(255,196,90,0); }
  35% { opacity:1; box-shadow:0 0 16px rgba(255,196,90,.7); }
  100% { opacity:0; transform:translateY(-8px); box-shadow:0 0 10px rgba(255,196,90,.3); }
}
html.reduce-motion .chint { transform:none; transition:opacity .2s ease; }
html.reduce-motion .chint.ok { animation:chint-ok-rm .3s ease forwards; }
@keyframes chint-ok-rm { 0% { opacity:.9; } 100% { opacity:0; } }
/* Pulso até o primeiro uso (G pegar, R ler): só brilho, sem mover nada. */
.ob-pulse.ds-kbd, .ob-pulse .ds-kbd { animation:ob-pulse 1.4s ease-in-out infinite; }
@keyframes ob-pulse { 0%,100% { box-shadow:0 0 0 rgba(255,196,90,0); } 50% { box-shadow:0 0 10px rgba(255,196,90,.85); } }
html.reduce-motion .ob-pulse.ds-kbd, html.reduce-motion .ob-pulse .ds-kbd { animation:none; box-shadow:0 0 8px rgba(255,196,90,.7); }
.hud-callout.ob-pulse { animation:ob-pulse 1.4s ease-in-out infinite; }
html.reduce-motion .hud-callout.ob-pulse { animation:none; box-shadow:0 0 8px rgba(255,196,90,.7); }
`;

function ensureStyle(): void {
  if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = CSS;
  document.head.appendChild(s);
}

/** Uma dica de controle: teclas (já com o texto da tecla) e o rótulo curto. */
export interface HintChip {
  id: string;
  keys: string[];
  label: string;
}

export class CombatHud {
  readonly root: HTMLElement;
  readonly vignette: HTMLElement;
  readonly feedback: HTMLElement; // moldura de feedback positivo (acerto/cura/bloqueio)
  readonly hint: HTMLElement;
  private readonly healthFill: HTMLElement;
  private readonly staminaBar: HTMLElement;
  private readonly staminaFill: HTMLElement;
  private readonly sparkRow: HTMLElement;
  private pips: HTMLElement[] = [];
  private pipFills: HTMLElement[] = [];
  private readonly resoRow: HTMLElement;
  private readonly resoMarks: HTMLElement[] = [];
  private lastReso = -1;
  private visible = true;
  private vignetteTimer = 0;
  private feedbackTimer = 0;
  private chips = new Map<string, HTMLElement>();
  private lastHealth = -1;
  private lastStamina = -1;
  private lastSparkKey = "";
  private pipCount = 0;
  private reducedFlashes = false;

  constructor() {
    ensureStyle();
    this.healthFill = el("div", { class: "chud-fill" });
    this.staminaFill = el("div", { class: "chud-fill" });
    const lifeLabel = el("span", { class: "chud-label", text: T.vidaRotulo });
    const health = el("div", { class: "chud-bar chud-health" }, this.healthFill, lifeLabel);
    this.staminaBar = el("div", { class: "chud-bar chud-stamina" }, this.staminaFill);
    const sparkLabel = el("span", { class: "chud-spark-label", text: T.fagulhaRotulo });
    this.sparkRow = el("div", { class: "chud-spark-row" }, sparkLabel);
    const resoLabel = el("span", { class: "chud-reso-label", text: T.ressonanciaRotulo });
    this.resoRow = el("div", { class: "chud-reso-row" }, resoLabel);
    for (let i = 0; i < 5; i++) {
      const mark = el("div", { class: "chud-reso-mark" });
      this.resoRow.appendChild(mark);
      this.resoMarks.push(mark);
    }
    this.root = el("div", { class: "combat-hud" }, health, this.staminaBar, this.sparkRow, this.resoRow);
    this.vignette = el("div", { class: "damage-vignette" });
    this.feedback = el("div", { class: "combat-feedback" });
    this.hint = el("div", { class: "combat-hint" });
    onLanguageChange(() => {
      lifeLabel.textContent = T.vidaRotulo;
      sparkLabel.textContent = T.fagulhaRotulo;
      resoLabel.textContent = T.ressonanciaRotulo;
    });
  }

  /** Acessibilidade: desliga as moldura de feedback (mantém só o som). */
  setReducedFlashes(on: boolean): void {
    this.reducedFlashes = on;
  }

  /** Ressonância (W6/Tier2): mostra o streak de acertos sem apanhar; oculto quando inativa. */
  setResonance(streak: number, active: boolean): void {
    const s = active ? Math.max(0, Math.min(this.resoMarks.length, Math.round(streak))) : -1;
    if (s === this.lastReso) return;
    this.lastReso = s;
    this.resoRow.classList.toggle("on", active && s > 0);
    for (let i = 0; i < this.resoMarks.length; i++) this.resoMarks[i]!.classList.toggle("lit", i < s);
  }

  setVisible(v: boolean): void {
    if (v === this.visible) return;
    this.visible = v;
    this.root.style.display = v ? "" : "none";
    this.hint.style.display = v ? "" : "none";
  }

  /** (Re)constrói os pips de Fagulha quando o número de cargas máximas muda. */
  private ensurePips(max: number): void {
    if (this.pipCount === max) return;
    for (const p of this.pips) p.remove();
    this.pips = [];
    this.pipFills = [];
    for (let i = 0; i < max; i++) {
      const fill = el("div", { class: "chud-pip-fill" });
      const pip = el("div", { class: "chud-pip" }, fill);
      this.sparkRow.appendChild(pip);
      this.pips.push(pip);
      this.pipFills.push(fill);
    }
    this.pipCount = max;
  }

  update(healthFraction: number, staminaFraction: number, sparkCharges: number, sparkMax: number, dt: number): void {
    const h = Math.max(0, Math.min(1, healthFraction));
    const s = Math.max(0, Math.min(1, staminaFraction));
    if (h !== this.lastHealth) {
      this.healthFill.style.transform = `scaleX(${h})`;
      this.lastHealth = h;
    }
    if (s !== this.lastStamina) {
      this.staminaFill.style.transform = `scaleX(${s})`;
      this.staminaBar.classList.toggle("full", s >= 0.999);
      this.lastStamina = s;
    }
    // Fagulha em pips: cada pip cheio = 1 carga; o pip parcial mostra a regeneração em curso.
    this.ensurePips(Math.max(1, Math.round(sparkMax)));
    const c = Math.max(0, Math.min(this.pipCount, sparkCharges));
    const key = c.toFixed(2);
    if (key !== this.lastSparkKey) {
      for (let i = 0; i < this.pipCount; i++) {
        const fillFrac = Math.max(0, Math.min(1, c - i));
        this.pipFills[i]!.style.transform = `scaleY(${fillFrac})`;
        this.pips[i]!.classList.toggle("lit", fillFrac >= 0.999);
      }
      this.lastSparkKey = key;
    }
    if (this.vignetteTimer > 0) {
      this.vignetteTimer -= dt;
      if (this.vignetteTimer <= 0) this.vignette.classList.remove("show");
    }
    if (this.feedbackTimer > 0) {
      this.feedbackTimer -= dt;
      if (this.feedbackTimer <= 0) this.feedback.classList.remove("show");
    }
  }

  /** Moldura de feedback positivo (~200 ms). Ignorada se "reduzir flashes" estiver ligado. */
  private flash(cls: "fb-hit" | "fb-heal" | "fb-block" | "fb-perfect"): void {
    if (this.reducedFlashes) return;
    this.feedback.classList.remove("fb-hit", "fb-heal", "fb-block", "fb-perfect");
    this.feedback.classList.add(cls, "show");
    this.feedbackTimer = cls === "fb-perfect" ? 0.28 : 0.2;
  }
  /** Acerto que causou dano: borda dourada curta (recompensa de ritmo). */
  flashHit(): void {
    this.flash("fb-hit");
  }
  /** Cura (essência/poção/braseiro): brilho verde. */
  flashHeal(): void {
    this.flash("fb-heal");
  }
  /** Bloqueio/parry bem-sucedido: tinta de bronze. */
  flashBlock(): void {
    this.flash("fb-block");
  }
  /** Esquiva perfeita: clarão ciano (quase-colisão recompensada). */
  flashPerfect(): void {
    this.flash("fb-perfect");
  }

  /**
   * Mostra exatamente estas dicas de controle (ver onboarding.ts). Ficha que sai da lista
   * foi cumprida (ou o momento passou): acende em ouro e some; ficha nova entra suave.
   */
  setHints(items: HintChip[]): void {
    const keep = new Set(items.map((i) => i.id));
    for (const [id, node] of this.chips) {
      if (keep.has(id)) continue;
      this.chips.delete(id);
      node.classList.add("ok");
      window.setTimeout(() => node.remove(), 500);
    }
    items.forEach((item, i) => {
      let node = this.chips.get(item.id);
      if (!node) {
        node = el("div", { class: "chint" });
        this.chips.set(item.id, node);
        this.hint.append(node);
        const fresh = node;
        window.requestAnimationFrame(() => fresh.classList.add("in"));
      }
      node.replaceChildren(
        ...item.keys.map((k) => el("span", { class: "ds-kbd", text: k })),
        el("span", { text: item.label }),
      );
      node.style.order = String(i);
    });
  }

  /** Pisca a vinheta de dano (chamado quando o herói é atingido - a partir do M2.3). */
  flashDamage(): void {
    this.vignette.classList.add("show");
    this.vignetteTimer = 0.35;
  }
}
