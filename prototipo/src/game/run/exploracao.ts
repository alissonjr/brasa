import type { RunSave } from "../content/saveData";
import type { NodeKind } from "./rota";

/**
 * CAMADA JOGO. Ponto de encontro dos sistemas de exploração (portas, livros, poções, cenário)
 * com `app/main.ts` (docs/brasa/spec-exploracao-indice.md, seção 5). Cada sistema vive em
 * módulo próprio, implementa `ExploracaoHooks` e se registra com UMA linha; o `main.ts` só
 * dispara os eventos abaixo e nunca conhece o sistema por dentro.
 */
export interface ExploracaoHooks {
  onEnterFloor?(i: number): void;
  onEnterNode?(kind: NodeKind, fromIndex: number): void;
  onFragmentTaken?(): void; // as saídas abrem
  onHeroDied?(): void;
  update?(dt: number): void; // dt de combate (hit-stop não conta)
  snapshot?(): Partial<RunSave>; // grava o que o sistema possui
  restore?(run: RunSave): void; // reaplica (idempotente)
}

/**
 * Campos do `RunSave` que os sistemas registrados possuem (os que `snapshot` pode devolver).
 * `rota`, `no` e `gasto` NÃO entram: pertencem ao `RouteState` que o `main.ts` guarda.
 */
const OWNED: (keyof RunSave)[] = ["secretos", "sabedoria", "livros", "raiz", "cera", "unguento", "ferida"];

/**
 * Registro de sistemas. Também CARREGA os campos de exploração do save lido: o que nenhum
 * sistema registrado possui continua sendo gravado como veio (nada se perde enquanto um sistema
 * ainda não existe nesta versão do jogo); um `snapshot` de sistema sobrescreve o carregado.
 */
export class ExploracaoRegistry {
  private systems: ExploracaoHooks[] = [];
  private carried: Partial<RunSave> = {};

  /** Registra um sistema. Chamar ANTES da restauração do boot, para `onEnterFloor` não perder a primeira sala. */
  register(h: ExploracaoHooks): void {
    this.systems.push(h);
  }

  onEnterFloor(i: number): void {
    for (const s of this.systems) s.onEnterFloor?.(i);
  }
  onEnterNode(kind: NodeKind, fromIndex: number): void {
    for (const s of this.systems) s.onEnterNode?.(kind, fromIndex);
  }
  onFragmentTaken(): void {
    for (const s of this.systems) s.onFragmentTaken?.();
  }
  onHeroDied(): void {
    for (const s of this.systems) s.onHeroDied?.();
  }
  update(dt: number): void {
    for (const s of this.systems) s.update?.(dt);
  }

  /** Reaplica o save: guarda os campos e avisa cada sistema. */
  restore(run: RunSave): void {
    this.carried = {};
    for (const k of OWNED) (this.carried as Record<string, unknown>)[k] = run[k];
    for (const s of this.systems) s.restore?.(run);
  }

  /** Descida nova: esquece o que foi carregado (os sistemas zeram o seu próprio estado). */
  forget(): void {
    this.carried = {};
  }

  /** Campos de exploração para gravar: o carregado, sobrescrito pelo que cada sistema possui. */
  snapshot(): Partial<RunSave> {
    const out: Partial<RunSave> = { ...this.carried };
    for (const s of this.systems) Object.assign(out, s.snapshot?.());
    return out;
  }
}
