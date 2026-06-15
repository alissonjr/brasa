/**
 * CAMADA ENGINE (genérica). Hit stop / hitlag (spec-combate §1, o ingrediente nº 1 de
 * peso): no frame do acerto, atacante e alvo CONGELAM por alguns frames, enquanto a
 * câmera e as partículas seguem em velocidade normal. Implementado como uma escala de
 * tempo: os sistemas de combate avançam por `scale(dt)` (0 enquanto congelado); câmera e
 * VFX usam o dt real.
 */
export class HitStop {
  private remaining = 0;

  /** Congela por `seconds`. Usa o maior pedido (um golpe pesado não é encurtado por um leve). */
  trigger(seconds: number): void {
    this.remaining = Math.max(this.remaining, seconds);
  }

  /** Avança o cronômetro do freeze pelo dt REAL (chamar uma vez por frame). */
  update(realDt: number): void {
    if (this.remaining > 0) this.remaining = Math.max(0, this.remaining - realDt);
  }

  get frozen(): boolean {
    return this.remaining > 0;
  }

  /** dt de combate: 0 enquanto congelado, senão o dt real. */
  scale(realDt: number): number {
    return this.remaining > 0 ? 0 : realDt;
  }
}
