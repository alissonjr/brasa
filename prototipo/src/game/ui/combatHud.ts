import { el } from "@engine";

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
.combat-hud { position:absolute; left:18px; bottom:18px; width:240px; pointer-events:none;
  font-family:"Cinzel",Georgia,serif; }
.chud-bar { position:relative; height:16px; border:1px solid var(--borda-clara,#9c7339);
  border-radius:4px; background:rgba(20,14,8,.72); box-shadow:inset 0 1px 0 rgba(246,227,176,.14),
  inset 0 0 10px rgba(0,0,0,.5); overflow:hidden; }
.chud-bar + .chud-bar { margin-top:6px; }
/* ESTILO (Bloco 2): a barra "assenta" com easing (cubic-bezier) em vez de linear seco. */
.chud-fill { position:absolute; inset:0; transform-origin:left center; transition:transform .18s cubic-bezier(.34,1.56,.64,1); }
.chud-health { height:18px; }
.chud-health .chud-fill { background:linear-gradient(180deg,#c0392b,#8e2a20); }
.chud-stamina { height:9px; width:200px; opacity:1; transition:opacity .3s ease; }
.chud-stamina .chud-fill { background:linear-gradient(180deg,var(--ouro,#e7bd71),var(--bronze,#b5793a)); }
.chud-stamina.full { opacity:0; }
.chud-label { position:absolute; left:7px; top:50%; transform:translateY(-50%);
  font-size:10px; letter-spacing:2px; color:#f6ecd6; text-shadow:0 1px 1px rgba(0,0,0,.6); }
/* FAGULHA em CARGAS: fileira de pips (losangos). Cheio = aceso; vazio = consumido; o pip
   em regeneracao preenche por baixo (clip). */
.chud-spark-row { display:flex; align-items:center; gap:7px; margin-top:7px; height:16px; }
.chud-spark-label { font-size:10px; letter-spacing:2px; color:#f6ecd6; text-shadow:0 1px 1px rgba(0,0,0,.6); margin-right:2px; }
.chud-pip { position:relative; width:14px; height:14px; transform:rotate(45deg);
  border:1px solid #9c7339; background:rgba(20,14,8,.72); border-radius:3px; overflow:hidden;
  box-shadow:inset 0 0 6px rgba(0,0,0,.5); }
.chud-pip-fill { position:absolute; inset:0; transform-origin:bottom center; transform:scaleY(0);
  background:linear-gradient(0deg,#ffd089,#ff8a2c); transition:transform .15s linear; }
.chud-pip.lit { border-color:#ffd089; box-shadow:inset 0 0 6px rgba(0,0,0,.4), 0 0 8px rgba(255,138,44,.55); }
/* RESSONÂNCIA: marcas que acendem com o streak de acertos sem apanhar (some quando inativa). */
.chud-reso-row { display:flex; align-items:center; gap:5px; margin-top:7px; height:12px; opacity:0; transition:opacity .2s ease; }
.chud-reso-row.on { opacity:1; }
.chud-reso-label { font-size:9px; letter-spacing:2px; color:#ffe0a0; text-shadow:0 1px 1px rgba(0,0,0,.6); margin-right:2px; }
.chud-reso-mark { width:9px; height:12px; transform:skewX(-20deg); background:rgba(40,28,12,.7); border:1px solid #8a6a38; border-radius:2px; }
.chud-reso-mark.lit { background:linear-gradient(180deg,#fff0c0,#ffae3a); border-color:#ffd089; box-shadow:0 0 6px rgba(255,174,58,.6); }
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
.combat-hint { position:absolute; left:50%; bottom:22px; transform:translateX(-50%);
  pointer-events:none; font-family:"Cinzel",Georgia,serif; font-size:12px; letter-spacing:1px;
  color:#f0e2c4; text-shadow:0 1px 2px rgba(0,0,0,.7); background:rgba(20,14,8,.55);
  border:1px solid rgba(216,169,59,.28); border-radius:20px; padding:6px 16px; white-space:nowrap;
  opacity:.9; transition:opacity 1s ease; }
.combat-hint.faded { opacity:0; }
`;

function ensureStyle(): void {
  if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = CSS;
  document.head.appendChild(s);
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
  private hintTimer = 12; // a dica de controles some após ~12 s de jogo
  private lastHealth = -1;
  private lastStamina = -1;
  private lastSparkKey = "";
  private pipCount = 0;
  private reducedFlashes = false;

  constructor() {
    ensureStyle();
    this.healthFill = el("div", { class: "chud-fill" });
    this.staminaFill = el("div", { class: "chud-fill" });
    const health = el("div", { class: "chud-bar chud-health" }, this.healthFill, el("span", { class: "chud-label", text: "VIDA" }));
    this.staminaBar = el("div", { class: "chud-bar chud-stamina" }, this.staminaFill);
    this.sparkRow = el("div", { class: "chud-spark-row" }, el("span", { class: "chud-spark-label", text: "FAGULHA" }));
    this.resoRow = el("div", { class: "chud-reso-row" }, el("span", { class: "chud-reso-label", text: "RESSONÂNCIA" }));
    for (let i = 0; i < 5; i++) {
      const mark = el("div", { class: "chud-reso-mark" });
      this.resoRow.appendChild(mark);
      this.resoMarks.push(mark);
    }
    this.root = el("div", { class: "combat-hud" }, health, this.staminaBar, this.sparkRow, this.resoRow);
    this.vignette = el("div", { class: "damage-vignette" });
    this.feedback = el("div", { class: "combat-feedback" });
    this.hint = el("div", {
      class: "combat-hint",
      text: "Atacar: clique / J    Pesado: dir. / K    Esquiva: C    Fogo: E    Bloqueio: Q    Alvo: T",
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
    if (this.hintTimer > 0) {
      this.hintTimer -= dt;
      if (this.hintTimer <= 0) this.hint.classList.add("faded");
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

  /** Dispensa a dica de controles imediatamente (ex.: após o 1o ataque). */
  dismissHint(): void {
    this.hintTimer = 0;
    this.hint.classList.add("faded");
  }

  /** Pisca a vinheta de dano (chamado quando o herói é atingido - a partir do M2.3). */
  flashDamage(): void {
    this.vignette.classList.add("show");
    this.vignetteTimer = 0.35;
  }
}
