/**
 * CAMADA PLATAFORMA. Pontuação do jogador (score). Genérico: o JOGO decide quando
 * pontuar; a plataforma acumula. A persistência é do SaveStore (o jogo monta o
 * SaveData incluindo os pontos). Conquistas ficam no AchievementService (separado,
 * para não confundir com a progressão de capítulo - ver ProgressionService).
 */
export class ScoreService {
  private points: number;

  constructor(initialPoints = 0) {
    this.points = initialPoints;
  }

  get total(): number {
    return this.points;
  }

  add(delta: number): void {
    this.points += delta;
  }

  /** Redefine os pontos (ex.: ao carregar outro slot de save). */
  reset(points = 0): void {
    this.points = points;
  }
}
