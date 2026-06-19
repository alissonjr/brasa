import { SceneInstrumentation } from "@babylonjs/core";
import type { AbstractEngine, Scene } from "@babylonjs/core";

/**
 * CAMADA DEV (Brasa). Instrumentacao de PERFORMANCE para o gate normativo do projeto
 * (projeto-brasa.md secao 4.1: < 60 draw calls por sala; 60 fps desktop / 30 fps mobile).
 * Mede draw calls + frame time via SceneInstrumentation do Babylon e:
 *  - LOGA no console a contagem de draw calls ao ENTRAR em cada sala (sempre; barato), com
 *    aviso se estourar o teto de 60.
 *  - mostra um OVERLAY ao vivo (draw calls / fps / frame time) sob flag (querystring ?perf
 *    ou toggle por tecla), para nao poluir o jogo normal.
 */
const DRAW_CALL_BUDGET = 60;

export class PerfHud {
  private readonly instr: SceneInstrumentation;
  private readonly el: HTMLElement;
  private visible = false;
  // Log adiado: ao entrar numa sala, espera alguns frames para a contagem estabilizar.
  private pending: { index: number; kind: string; frames: number } | null = null;

  constructor(
    scene: Scene,
    private readonly engine: AbstractEngine
  ) {
    this.instr = new SceneInstrumentation(scene);
    this.instr.captureFrameTime = true;
    this.el = document.createElement("div");
    this.el.style.cssText =
      "position:fixed;right:12px;top:112px;z-index:50;padding:6px 12px;border-radius:8px;" +
      "background:rgba(6,9,14,0.82);color:#bfe6ff;font:600 12px ui-monospace,Menlo,monospace;" +
      "border:1px solid #2a4256;pointer-events:none;text-shadow:0 1px 2px #000;white-space:pre;display:none;";
    document.body.appendChild(this.el);
    // Liga o overlay por querystring ?perf (o toggle por tecla fica a cargo do app).
    if (typeof location !== "undefined" && /[?&]perf\b/.test(location.search)) this.setVisible(true);
  }

  setVisible(v: boolean): void {
    this.visible = v;
    this.el.style.display = v ? "" : "none";
  }
  toggle(): void {
    this.setVisible(!this.visible);
  }

  /** Agenda o log de draw calls da sala recem-entrada (estabiliza em ~8 frames). */
  logRoom(index: number, kind: string): void {
    this.pending = { index, kind, frames: 8 };
  }

  /** Chamar a cada frame (no render loop). */
  update(): void {
    const draws = this.instr.drawCallsCounter.current;
    if (this.pending) {
      this.pending.frames -= 1;
      if (this.pending.frames <= 0) {
        const { index, kind } = this.pending;
        this.pending = null;
        const over = draws >= DRAW_CALL_BUDGET;
        const tag = over ? "ESTOUROU o teto de" : "dentro do teto de";
        console.log(`[perf] sala ${index + 1} (${kind}): ${draws} draw calls (${tag} ${DRAW_CALL_BUDGET})`);
        if (over) console.warn(`[perf] sala ${index + 1} (${kind}) acima de ${DRAW_CALL_BUDGET} draw calls: cortar um cluster ou converter clones em batch.`);
      }
    }
    if (!this.visible) return;
    const ft = this.instr.frameTimeCounter.lastSecAverage; // ms (PrecisionDate)
    const fps = this.engine.getFps();
    const flag = draws >= DRAW_CALL_BUDGET ? " !>=60" : "";
    this.el.textContent = `draw calls: ${draws}${flag}\nfps: ${fps.toFixed(0)}\nframe: ${ft.toFixed(2)} ms`;
  }

  dispose(): void {
    this.instr.dispose();
    this.el.remove();
  }
}
