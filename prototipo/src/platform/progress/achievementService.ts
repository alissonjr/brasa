/**
 * CAMADA PLATAFORMA. Conquistas (medalhas) desbloqueadas pelo jogador. Genérico
 * por ids de string: o catálogo (nomes/descrições) é conteúdo do jogo (ver
 * game/content/achievements.ts). A persistência é do SaveStore (o jogo inclui os
 * ids desbloqueados no payload do save).
 */
export class AchievementService {
  private readonly unlocked: Set<string>;

  constructor(init?: string[]) {
    this.unlocked = new Set(init ?? []);
  }

  /** Desbloqueia uma conquista. Retorna true se foi a primeira vez (para o toast). */
  unlock(id: string): boolean {
    if (this.unlocked.has(id)) return false;
    this.unlocked.add(id);
    return true;
  }

  has(id: string): boolean {
    return this.unlocked.has(id);
  }

  all(): string[] {
    return [...this.unlocked];
  }

  count(): number {
    return this.unlocked.size;
  }

  /** Recarrega o conjunto inteiro (ex.: ao trocar de slot de save). */
  load(ids: string[]): void {
    this.unlocked.clear();
    for (const id of ids) this.unlocked.add(id);
  }
}
