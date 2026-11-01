import { Matrix, Vector3, Viewport } from "@babylonjs/core";
import type { Scene } from "@babylonjs/core";
import type { EventBus } from "@engine";

/**
 * CAMADA JOGO. NÚMEROS DE DANO flutuantes (juiciness de combate). Módulo autocontido: DOM
 * sobre o canvas, projeta a posição 3D do alvo para a tela a cada frame, o número sobe
 * desacelerando e some. Pool fixo de elementos (zero alocação por golpe).
 *
 * Cores por tipo (tokens do design system, game/ui/ds/tokens.css):
 *  - hit   : dano no inimigo, ouro (--gold-200)
 *  - crit  : crítico / ressonância / golpe pelas costas, MAIOR e em brasa (--ember-400)
 *  - burn  : tique de queimadura, pequeno, brasa clara (--ember-300)
 *  - block : golpe amortecido pela guarda, pequeno e neutro (--text-mid)
 *  - hero  : dano no herói, vermelho (--blood-400)
 *  - heal  : cura, verde (--life-400), com "+"
 *
 * Fontes de eventos: o CombatDirector emite `combat:damage` ({amount,x,y,z,kind,big}) para o
 * dano nos inimigos (bindEvents). Dano e cura do HERÓI vêm da variação de vida amostrada em
 * `update(dt, hero)`: assim pega toda fonte (golpe, projétil, poção, essência, braseiro).
 *
 * Acessibilidade: com `reducedMotion` o número NÃO sobe nem "pula": aparece parado no lugar,
 * mantém a leitura e some rápido. Pode ser desligado de vez com setEnabled(false).
 */
export type DamageKind = "hit" | "crit" | "burn" | "block" | "hero" | "heal";

export interface DamagePayload {
  amount: number;
  x: number;
  y: number;
  z: number;
  kind: DamageKind;
  /** Golpe pesado/forte: aumenta o número (sem mudar a cor). */
  big?: boolean;
}

/** Amostra do herói por frame (vida absoluta, vida máxima e posição dos pés). Null = fora do jogo. */
export interface HeroSample {
  hp: number;
  max: number;
  x: number;
  y: number;
  z: number;
}

/** O mínimo que o módulo precisa da engine (estrutural: evita acoplar ao tipo concreto). */
export interface DamageNumbersEngine {
  getRenderWidth(): number;
  getRenderHeight(): number;
  getRenderingCanvas(): HTMLCanvasElement | null;
}

export interface DamageNumbersOptions {
  scene: Scene;
  engine: DamageNumbersEngine;
  /** Lido a cada número novo (as opções podem mudar com o jogo aberto). */
  reducedMotion: () => boolean;
  poolSize?: number;
  parent?: HTMLElement;
}

const STYLE_ID = "damage-numbers-style";
const CSS = `
.dn-layer { position:fixed; inset:0; z-index:19; pointer-events:none; overflow:hidden; }
.dn { position:absolute; left:0; top:0; display:none; white-space:nowrap; user-select:none;
  font-family:var(--font-display,"Cinzel",Georgia,serif); font-weight:800; line-height:1;
  letter-spacing:.02em; will-change:transform,opacity;
  -webkit-text-stroke:3px var(--ink-950,#06080c); paint-order:stroke fill;
  text-shadow:0 2px 3px rgba(0,0,0,.65); }
.dn.on { display:block; }
.dn-hit   { color:var(--gold-200,#ffe0a0); font-size:calc(var(--fs-lg,20px) * 1.2); }
.dn-crit  { color:var(--ember-400,#ff8a2c); font-size:calc(var(--fs-2xl,34px) * 1.1);
  text-shadow:0 0 10px var(--ember-600,#d94e0a), 0 0 22px rgba(255,106,19,.55), 0 2px 3px rgba(0,0,0,.7); }
.dn-burn  { color:var(--ember-300,#ffb259); font-size:var(--fs-sm,14px); }
.dn-block { color:var(--text-mid,#bdb299); font-size:var(--fs-sm,14px); }
.dn-hero  { color:var(--blood-400,#d9473a); font-size:calc(var(--fs-xl,26px) * 1.1);
  text-shadow:0 0 8px rgba(142,42,32,.7), 0 2px 3px rgba(0,0,0,.7); }
.dn-heal  { color:var(--life-400,#7fcf8f); font-size:var(--fs-lg,20px);
  text-shadow:0 0 8px rgba(80,170,100,.5), 0 2px 3px rgba(0,0,0,.7); }
`;

function ensureStyle(): void {
  if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
  const s = document.createElement("style");
  s.id = STYLE_ID;
  s.textContent = CSS;
  document.head.appendChild(s);
}

interface Slot {
  el: HTMLElement;
  active: boolean;
  age: number;
  life: number;
  wx: number;
  wy: number;
  wz: number;
  jitter: number; // deslocamento horizontal (px), evita números empilhados
  rise: number; // altura final da subida (px)
  pop: number; // escala de pico do "pulo" inicial
  still: boolean; // reducedMotion no momento do spawn
}

/** Passo máximo aceito por frame: absorve picos (troca de aba) e mantém o número legível em fps baixo. */
const MAX_DT = 1 / 30;
/** Cura de várias fontes pequenas (roubo de vida, etc.) é somada nesta janela antes de aparecer. */
const HEAL_MERGE_SEC = 0.25;

const KIND_LIFE: Record<DamageKind, number> = { hit: 0.85, crit: 1.1, burn: 0.7, block: 0.7, hero: 1.0, heal: 1.0 };
const KIND_RISE: Record<DamageKind, number> = { hit: 54, crit: 78, burn: 34, block: 36, hero: 58, heal: 60 };

export class DamageNumbers {
  private readonly layer: HTMLElement;
  private readonly slots: Slot[] = [];
  private readonly scene: Scene;
  private readonly engine: DamageNumbersEngine;
  private readonly reducedMotion: () => boolean;
  private enabled = true;
  private cursor = 0;
  private activeCount = 0;
  private unbind: (() => void) | null = null;

  // Reuso por frame (sem alocar).
  private readonly world = new Vector3();
  private readonly screen = new Vector3();
  private readonly vp = new Viewport(0, 0, 1, 1);

  // Rastreio de vida do herói (dano/cura).
  private lastHp = -1;
  private lastMax = -1;
  private healPending = 0;
  private healTimer = 0;
  private healPos = { x: 0, y: 0, z: 0 };

  constructor(opts: DamageNumbersOptions) {
    ensureStyle();
    this.scene = opts.scene;
    this.engine = opts.engine;
    this.reducedMotion = opts.reducedMotion;
    this.layer = document.createElement("div");
    this.layer.className = "dn-layer";
    this.layer.setAttribute("aria-hidden", "true");
    (opts.parent ?? document.body).appendChild(this.layer);
    const n = opts.poolSize ?? 28;
    for (let i = 0; i < n; i++) {
      const el = document.createElement("div");
      el.className = "dn";
      this.layer.appendChild(el);
      this.slots.push({ el, active: false, age: 0, life: 1, wx: 0, wy: 0, wz: 0, jitter: 0, rise: 0, pop: 1, still: false });
    }
  }

  /** Escuta `combat:damage` no barramento do jogo. Devolve this para encadear. */
  bindEvents(events: EventBus): this {
    this.unbind?.();
    this.unbind = events.on<DamagePayload>("combat:damage", (p) => this.spawn(p));
    return this;
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) this.clear();
  }

  /** Esconde todos os números (troca de andar, pausa, derrota). */
  clear(): void {
    for (const s of this.slots) this.release(s);
    this.activeCount = 0;
  }

  dispose(): void {
    this.unbind?.();
    this.unbind = null;
    this.layer.remove();
  }

  /** Cria um número na posição de mundo indicada. */
  spawn(p: DamagePayload): void {
    if (!this.enabled) return;
    const value = Math.round(p.amount);
    if (!(value >= 1)) return;
    // Slot livre; se o pool lotou, recicla o mais antigo (round-robin).
    let slot: Slot | null = null;
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[(this.cursor + i) % this.slots.length]!;
      if (!s.active) {
        slot = s;
        this.cursor = (this.cursor + i + 1) % this.slots.length;
        break;
      }
    }
    if (!slot) {
      slot = this.slots[this.cursor]!;
      this.cursor = (this.cursor + 1) % this.slots.length;
      if (slot.active) this.activeCount--;
    }
    const still = this.reducedMotion();
    const crit = p.kind === "crit";
    slot.active = true;
    slot.age = 0;
    slot.still = still;
    slot.life = still ? 0.7 : KIND_LIFE[p.kind];
    slot.wx = p.x;
    slot.wy = p.y;
    slot.wz = p.z;
    slot.jitter = still ? 0 : (Math.random() * 2 - 1) * 16;
    slot.rise = still ? 0 : KIND_RISE[p.kind] * (0.9 + Math.random() * 0.2);
    // Magnitude: números maiores crescem um pouco (0,9x a 1,4x); "big" (pesado) soma mais.
    const mag = Math.min(1.4, 0.9 + p.amount / 90) * (p.big ? 1.18 : 1);
    slot.pop = (crit ? 1.55 : 1.3) * mag;
    const el = slot.el;
    el.className = `dn dn-${p.kind} on`;
    el.textContent = p.kind === "heal" ? `+${value}` : String(value);
    el.dataset.mag = mag.toFixed(3);
    el.style.opacity = "0";
    this.activeCount++;
  }

  /**
   * Avança e posiciona. `dtSec` em segundos REAIS (não o dt de combate: o número continua
   * durante o hit stop). `hero` = amostra da vida do herói neste frame, ou null fora do jogo
   * (limpa os números e reinicia o rastreio, para não gerar cura falsa ao recomeçar).
   */
  update(dtSec: number, hero: HeroSample | null): void {
    const dt = Math.min(Math.max(dtSec, 0), MAX_DT);
    this.trackHero(dt, hero);
    if (this.activeCount <= 0) return;

    const cam = this.scene.activeCamera;
    const canvas = this.engine.getRenderingCanvas();
    if (!cam || !canvas) return;
    const rw = this.engine.getRenderWidth();
    const rh = this.engine.getRenderHeight();
    if (rw <= 0 || rh <= 0) return;
    const rect = canvas.getBoundingClientRect();
    // Coordenadas de render (hardware scaling) -> pixels CSS.
    const sx = rect.width / rw;
    const sy = rect.height / rh;
    cam.viewport.toGlobalToRef(rw, rh, this.vp);
    const transform = this.scene.getTransformMatrix();

    for (const s of this.slots) {
      if (!s.active) continue;
      s.age += dt;
      const t = s.age / s.life;
      if (t >= 1) {
        this.release(s);
        this.activeCount--;
        continue;
      }
      this.world.set(s.wx, s.wy, s.wz);
      Vector3.ProjectToRef(this.world, Matrix.IdentityReadOnly, transform, this.vp, this.screen);
      if (this.screen.z < 0 || this.screen.z > 1) {
        s.el.style.opacity = "0"; // atrás da câmera
        continue;
      }
      let rise = 0;
      let scale = 1;
      let opacity = 1;
      if (s.still) {
        // reducedMotion: parado, só esmaece no fim.
        opacity = t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4;
      } else {
        const e = 1 - Math.pow(1 - t, 3); // easeOutCubic: sobe rápido e desacelera
        rise = s.rise * e;
        // "Pulo" de entrada: 0 -> pico em 12% da vida -> assenta em 1 até 30%.
        if (t < 0.12) scale = 0.4 + (s.pop - 0.4) * (t / 0.12);
        else if (t < 0.3) scale = s.pop + (1 - s.pop) * ((t - 0.12) / 0.18);
        opacity = t < 0.62 ? 1 : 1 - (t - 0.62) / 0.38;
      }
      const mag = Number(s.el.dataset.mag) || 1;
      const x = rect.left + this.screen.x * sx + s.jitter;
      const y = rect.top + this.screen.y * sy - rise;
      s.el.style.transform = `translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) translate(-50%,-50%) scale(${(scale * mag).toFixed(3)})`;
      s.el.style.opacity = opacity.toFixed(3);
    }
  }

  /** Dano/cura do herói a partir da variação de vida entre frames. */
  private trackHero(dt: number, hero: HeroSample | null): void {
    if (!hero) {
      if (this.activeCount > 0) this.clear();
      this.lastHp = -1;
      this.lastMax = -1;
      this.healPending = 0;
      return;
    }
    const head = hero.y + 1.0; // y do herói é o centro da cápsula: +1,0 = topo da cabeça
    if (this.lastHp >= 0 && hero.max === this.lastMax) {
      const diff = hero.hp - this.lastHp;
      if (diff < -0.5) {
        this.spawn({ amount: -diff, x: hero.x, y: head, z: hero.z, kind: "hero" });
      } else if (diff > 0.5 && this.lastHp > 0) {
        // Cura (poção, essência, braseiro, roubo de vida). Reviver depois de morrer (hp anterior 0) não conta.
        this.healPending += diff;
        this.healPos = { x: hero.x, y: head, z: hero.z };
        if (this.healTimer <= 0) this.healTimer = HEAL_MERGE_SEC;
      }
    }
    this.lastHp = hero.hp;
    this.lastMax = hero.max; // vida máxima mudou (upgrade): só rebaseia, sem número
    if (this.healTimer > 0) {
      this.healTimer -= dt;
      if (this.healTimer <= 0 && this.healPending >= 1) {
        this.spawn({ amount: this.healPending, ...this.healPos, kind: "heal" });
        this.healPending = 0;
      } else if (this.healTimer <= 0) {
        this.healPending = 0;
      }
    }
  }

  private release(s: Slot): void {
    if (!s.active && !s.el.classList.contains("on")) return;
    s.active = false;
    s.el.classList.remove("on");
    s.el.style.opacity = "0";
  }
}
