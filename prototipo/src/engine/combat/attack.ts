/**
 * CAMADA ENGINE (genérica). Anatomia de um ataque em 3 fases (spec-combate §1):
 * antecipação (startup), ativo (active) e recuperação (recovery). Genérico: não
 * conhece o herói nem números do jogo - recebe a temporização e avança por dt.
 *
 * O atacante fica COMPROMETIDO: uma vez iniciado, o ataque corre até o fim (sem
 * cancelamento livre). `isActive` marca a janela em que o golpe causa dano (a
 * detecção de acerto entra no M2.1). `phaseProgress` (0..1) serve para posar o
 * visual ao longo da fase.
 */
export type AttackPhase = "idle" | "startup" | "active" | "recovery";

export interface AttackTiming {
  /** Antecipação em segundos (o "sinal"). */
  startup: number;
  /** Janela ativa em segundos (instante de contato). */
  active: number;
  /** Recuperação em segundos (vulnerabilidade). */
  recovery: number;
}

export class AttackState {
  private phase: AttackPhase = "idle";
  private t = 0; // tempo decorrido na fase atual
  private timing: AttackTiming = { startup: 0, active: 0, recovery: 0 };

  get current(): AttackPhase {
    return this.phase;
  }

  get isActive(): boolean {
    return this.phase === "active";
  }

  get isBusy(): boolean {
    return this.phase !== "idle";
  }

  /** Progresso 0..1 dentro da fase atual (para interpolar a pose do visual). */
  get phaseProgress(): number {
    const d = this.duration(this.phase);
    return d > 0 ? Math.min(1, this.t / d) : 1;
  }

  /** Inicia um ataque. Ignorado (retorna false) se já houver um em andamento (commit). */
  start(timing: AttackTiming): boolean {
    if (this.isBusy) return false;
    this.timing = timing;
    this.phase = "startup";
    this.t = 0;
    return true;
  }

  /** Avança a máquina por dt; resolve várias transições se dt for grande. Retorna a fase resultante. */
  advance(dt: number): AttackPhase {
    if (this.phase === "idle") return this.phase;
    this.t += dt;
    // Cascata de transições (startup -> active -> recovery -> idle).
    let guard = 0;
    while (this.phase !== "idle" && this.t >= this.duration(this.phase) && guard++ < 4) {
      this.t -= this.duration(this.phase);
      this.phase = this.nextPhase(this.phase);
    }
    return this.phase;
  }

  cancel(): void {
    this.phase = "idle";
    this.t = 0;
  }

  private duration(phase: AttackPhase): number {
    switch (phase) {
      case "startup":
        return this.timing.startup;
      case "active":
        return this.timing.active;
      case "recovery":
        return this.timing.recovery;
      default:
        return 0;
    }
  }

  private nextPhase(phase: AttackPhase): AttackPhase {
    switch (phase) {
      case "startup":
        return "active";
      case "active":
        return "recovery";
      case "recovery":
        return "idle";
      default:
        return "idle";
    }
  }
}
