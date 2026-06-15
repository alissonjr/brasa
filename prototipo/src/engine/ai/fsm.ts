/**
 * CAMADA ENGINE (genérica). Utilidades de IA leves para inimigos do protótipo:
 * - StateMachine: estado atual + tempo no estado (transição zera o tempo).
 * - Ticker: acumulador que dispara a cada `interval` (IA decide em TICKS, não todo
 *   frame, conforme o orçamento de perf da spec-combate §4: "IA por máquina de estados
 *   em ticks"). O movimento/animação seguem por frame; só a DECISÃO é em tick.
 */
export class StateMachine<S extends string> {
  private _state: S;
  private _time = 0;

  constructor(initial: S) {
    this._state = initial;
  }

  get state(): S {
    return this._state;
  }

  /** Tempo (s) decorrido no estado atual. */
  get time(): number {
    return this._time;
  }

  is(s: S): boolean {
    return this._state === s;
  }

  /** Transiciona (zera o tempo) se for um estado diferente. */
  to(s: S): void {
    if (s !== this._state) {
      this._state = s;
      this._time = 0;
    }
  }

  advance(dt: number): void {
    this._time += dt;
  }
}

export class Ticker {
  private acc = 0;

  constructor(private readonly interval: number) {}

  /** Acumula dt; retorna true uma vez a cada `interval` decorrido. */
  tick(dt: number): boolean {
    this.acc += dt;
    if (this.acc >= this.interval) {
      this.acc -= this.interval;
      return true;
    }
    return false;
  }
}
