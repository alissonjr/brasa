/**
 * CAMADA ENGINE (genérica). Vida de um combatente: pontos atuais/máximos, dano e
 * morte. Não conhece o jogo (números vêm do jogo, ver game/combat/tuning.ts).
 */
export class Health {
  private _current: number;
  private _max: number;

  constructor(max: number) {
    this._max = max;
    this._current = max;
  }

  get max(): number {
    return this._max;
  }

  /** Aumenta a vida máxima (upgrade) e cura o mesmo tanto. */
  raiseMax(by: number): void {
    if (by <= 0) return;
    this._max += by;
    this._current += by;
  }

  get current(): number {
    return this._current;
  }

  get alive(): boolean {
    return this._current > 0;
  }

  /** Fração 0..1 (para barras de vida). */
  get fraction(): number {
    return this.max > 0 ? this._current / this.max : 0;
  }

  /** Aplica dano; retorna `{ died: true }` se a vida cruzou para zero AGORA. */
  damage(amount: number): { died: boolean } {
    if (amount <= 0 || !this.alive) return { died: false };
    this._current = Math.max(0, this._current - amount);
    return { died: this._current === 0 };
  }

  heal(amount: number): void {
    if (amount <= 0) return;
    this._current = Math.min(this.max, this._current + amount);
  }

  reset(to: number = this.max): void {
    this._current = Math.max(0, Math.min(this.max, to));
  }
}
