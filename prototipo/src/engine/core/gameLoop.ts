/**
 * CAMADA ENGINE. Relógio de passo fixo para a lógica determinística.
 *
 * O "feel" do combate usa tempos em segundos/frames (hit stop, i-frames,
 * telegrafia). Para ser igual em qualquer FPS, a lógica de gameplay determinística
 * deve rodar num acumulador de passo fixo (padrão 60 Hz), separada do render, com
 * o visual interpolando por damping. Ainda não está plugado no M0 (o movimento usa
 * o passo da física); será usado a partir do combate (M2).
 */
export class GameClock {
  private acc = 0;

  constructor(private readonly step = 1 / 60) {}

  /**
   * Acumula o tempo real do frame e chama fixedUpdate em passos fixos.
   * Faz clamp do acumulador para evitar "espiral da morte" em quedas de FPS.
   */
  tick(deltaSeconds: number, fixedUpdate: (stepSeconds: number) => void): void {
    this.acc += deltaSeconds;
    if (this.acc > 0.25) this.acc = 0.25;
    while (this.acc >= this.step) {
      fixedUpdate(this.step);
      this.acc -= this.step;
    }
  }
}
