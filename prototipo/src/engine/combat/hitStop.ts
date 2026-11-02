/**
 * CAMADA ENGINE (genérica). Hit stop / hitlag (spec-combate §1, o ingrediente nº 1 de
 * peso): no frame do acerto, atacante e alvo CONGELAM por alguns frames, enquanto a
 * câmera e as partículas seguem em velocidade normal. Implementado como uma escala de
 * tempo: os sistemas de combate avançam por `scale(dt)` (0 enquanto congelado); câmera e
 * VFX usam o dt real.
 */
export class HitStop {
  private remaining = 0;
  private tail = 0; // segundos restantes da "cauda": o tempo volta devagar, não de golpe
  private readonly tailSec: number;
  private readonly tailScale: number;

  /**
   * @param opts.tailSec duração da cauda após o congelamento (0 = sem cauda).
   * @param opts.tailScale escala de tempo no início da cauda (sobe linear até 1).
   */
  constructor(opts: { tailSec?: number; tailScale?: number } = {}) {
    this.tailSec = opts.tailSec ?? 0;
    this.tailScale = opts.tailScale ?? 1;
  }

  /** Congela por `seconds`. Usa o maior pedido (um golpe pesado não é encurtado por um leve). */
  trigger(seconds: number): void {
    this.remaining = Math.max(this.remaining, seconds);
  }

  /** Avança o cronômetro do freeze pelo dt REAL (chamar uma vez por frame). */
  update(realDt: number): void {
    if (this.remaining > 0) {
      this.remaining = Math.max(0, this.remaining - realDt);
      if (this.remaining === 0) this.tail = this.tailSec;
    } else if (this.tail > 0) {
      this.tail = Math.max(0, this.tail - realDt);
    }
  }

  get frozen(): boolean {
    return this.remaining > 0;
  }

  /** dt de combate: 0 enquanto congelado, senão o dt real. */
  scale(realDt: number): number {
    if (this.remaining > 0) return 0;
    if (this.tail > 0 && this.tailSec > 0) return realDt * (this.tailScale + (1 - this.tailScale) * (1 - this.tail / this.tailSec));
    return realDt;
  }
}
