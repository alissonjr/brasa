/**
 * CAMADA ENGINE (genérica). Tween mínimo, sem libs externas (o Messenger usa Tween.js em
 * tudo; aqui a versão enxuta). Um Tweens é atualizado uma vez por frame no loop do app com o
 * dt REAL (segue no hit stop). Ver docs/brasa/spec-estilo-visual-render.md §4.2(b).
 */

export type Easing = (t: number) => number;

export const Easings = {
  linear: (t: number): number => t,
  easeOutCubic: (t: number): number => 1 - Math.pow(1 - t, 3),
  easeInOutCubic: (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  easeOutBack: (t: number): number => {
    const c1 = 1.70158;
    const c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  },
  easeOutElastic: (t: number): number => {
    if (t === 0 || t === 1) return t;
    const c4 = (2 * Math.PI) / 3;
    return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
  },
};

interface Entry {
  elapsed: number;
  dur: number;
  ease: Easing;
  onUpdate: (t: number) => void;
  onDone?: () => void;
  dead: boolean;
}

/** Gerenciador de tweens 0..1. `add` para uma curva arbitrária; `to` para props numéricas. */
export class Tweens {
  private entries: Entry[] = [];

  /** Anima de 0 a 1 por `durMs`, chamando onUpdate(t) já com a easing aplicada. */
  add(durMs: number, ease: Easing, onUpdate: (t: number) => void, onDone?: () => void): void {
    this.entries.push({ elapsed: 0, dur: Math.max(1, durMs) / 1000, ease, onUpdate, onDone, dead: false });
  }

  /** Anima props numéricas de um objeto até `target` (lê os valores atuais como início). */
  to(obj: Record<string, number>, target: Record<string, number>, durMs: number, ease: Easing = Easings.easeOutCubic, onDone?: () => void): void {
    const keys = Object.keys(target);
    const from = keys.map((k) => obj[k] ?? 0);
    this.add(
      durMs,
      ease,
      (t) => {
        for (let i = 0; i < keys.length; i++) obj[keys[i]!] = from[i]! + (target[keys[i]!]! - from[i]!) * t;
      },
      onDone
    );
  }

  /** Avança todos os tweens. dtSec em SEGUNDOS (dt real do frame). */
  update(dtSec: number): void {
    if (dtSec <= 0 || this.entries.length === 0) return;
    for (const e of this.entries) {
      e.elapsed += dtSec;
      const raw = e.elapsed >= e.dur ? 1 : e.elapsed / e.dur;
      e.onUpdate(e.ease(raw));
      if (raw >= 1) {
        e.dead = true;
        e.onDone?.();
      }
    }
    if (this.entries.some((e) => e.dead)) this.entries = this.entries.filter((e) => !e.dead);
  }

  clear(): void {
    this.entries.length = 0;
  }
}
