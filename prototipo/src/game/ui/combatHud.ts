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
.chud-fill { position:absolute; inset:0; transform-origin:left center; transition:transform .12s ease; }
.chud-health { height:18px; }
.chud-health .chud-fill { background:linear-gradient(180deg,#c0392b,#8e2a20); }
.chud-stamina { height:9px; width:200px; opacity:1; transition:opacity .3s ease; }
.chud-stamina .chud-fill { background:linear-gradient(180deg,var(--ouro,#e7bd71),var(--bronze,#b5793a)); }
.chud-stamina.full { opacity:0; }
.chud-spark { height:13px; box-shadow:inset 0 0 10px rgba(0,0,0,.5), 0 0 8px rgba(216,112,42,.3); }
.chud-spark .chud-fill { background:linear-gradient(180deg,#ffd089,#d8702a); }
.chud-label { position:absolute; left:7px; top:50%; transform:translateY(-50%);
  font-size:10px; letter-spacing:2px; color:#f6ecd6; text-shadow:0 1px 1px rgba(0,0,0,.6); }
.damage-vignette { position:absolute; inset:0; pointer-events:none; opacity:0;
  background:radial-gradient(ellipse at center, transparent 55%, rgba(150,30,20,.55) 100%);
  transition:opacity .4s ease; }
.damage-vignette.show { opacity:1; transition:opacity .06s ease; }
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
  readonly hint: HTMLElement;
  private readonly healthFill: HTMLElement;
  private readonly staminaBar: HTMLElement;
  private readonly staminaFill: HTMLElement;
  private readonly sparkFill: HTMLElement;
  private visible = true;
  private vignetteTimer = 0;
  private hintTimer = 12; // a dica de controles some após ~12 s de jogo
  private lastHealth = -1;
  private lastStamina = -1;
  private lastSpark = -1;

  constructor() {
    ensureStyle();
    this.healthFill = el("div", { class: "chud-fill" });
    this.staminaFill = el("div", { class: "chud-fill" });
    this.sparkFill = el("div", { class: "chud-fill" });
    const health = el("div", { class: "chud-bar chud-health" }, this.healthFill, el("span", { class: "chud-label", text: "VIDA" }));
    this.staminaBar = el("div", { class: "chud-bar chud-stamina" }, this.staminaFill);
    const spark = el("div", { class: "chud-bar chud-spark" }, this.sparkFill, el("span", { class: "chud-label", text: "FAGULHA" }));
    this.root = el("div", { class: "combat-hud" }, health, this.staminaBar, spark);
    this.vignette = el("div", { class: "damage-vignette" });
    this.hint = el("div", {
      class: "combat-hint",
      text: "Atacar: clique / J    Pesado: dir. / K    Esquiva: C    Fogo: E    Bloqueio: Q",
    });
  }

  setVisible(v: boolean): void {
    if (v === this.visible) return;
    this.visible = v;
    this.root.style.display = v ? "" : "none";
    this.hint.style.display = v ? "" : "none";
  }

  update(healthFraction: number, staminaFraction: number, sparkFraction: number, dt: number): void {
    const h = Math.max(0, Math.min(1, healthFraction));
    const s = Math.max(0, Math.min(1, staminaFraction));
    const f = Math.max(0, Math.min(1, sparkFraction));
    if (h !== this.lastHealth) {
      this.healthFill.style.transform = `scaleX(${h})`;
      this.lastHealth = h;
    }
    if (s !== this.lastStamina) {
      this.staminaFill.style.transform = `scaleX(${s})`;
      this.staminaBar.classList.toggle("full", s >= 0.999);
      this.lastStamina = s;
    }
    if (f !== this.lastSpark) {
      this.sparkFill.style.transform = `scaleX(${f})`;
      this.lastSpark = f;
    }
    if (this.vignetteTimer > 0) {
      this.vignetteTimer -= dt;
      if (this.vignetteTimer <= 0) this.vignette.classList.remove("show");
    }
    if (this.hintTimer > 0) {
      this.hintTimer -= dt;
      if (this.hintTimer <= 0) this.hint.classList.add("faded");
    }
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
