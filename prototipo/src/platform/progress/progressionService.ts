/**
 * CAMADA PLATAFORMA. Estado de progressão da campanha (genérico, por ids de
 * string): capítulo atual, checkpoint de retomada e objetivos concluídos. NÃO
 * conhece o conteúdo do jogo (quais capítulos/objetivos existem) - isso é da
 * camada de jogo (game/content/campaign.ts). A persistência é do SaveStore (o
 * jogo monta o SaveData incluindo este estado).
 */
export interface ProgressionState {
  chapterId: string;
  checkpointId: string;
  objectivesDone: string[];
}

export class ProgressionService {
  private chapterId: string;
  private checkpointId: string;
  private readonly done: Set<string>;

  constructor(init?: Partial<ProgressionState>) {
    this.chapterId = init?.chapterId ?? "";
    this.checkpointId = init?.checkpointId ?? "";
    this.done = new Set(init?.objectivesDone ?? []);
  }

  get chapter(): string {
    return this.chapterId;
  }

  get checkpoint(): string {
    return this.checkpointId;
  }

  setChapter(chapterId: string, checkpointId = ""): void {
    this.chapterId = chapterId;
    this.checkpointId = checkpointId;
  }

  reachCheckpoint(checkpointId: string): void {
    this.checkpointId = checkpointId;
  }

  isDone(objectiveId: string): boolean {
    return this.done.has(objectiveId);
  }

  /** Marca um objetivo como concluído. Retorna true se foi a primeira vez. */
  completeObjective(objectiveId: string): boolean {
    if (this.done.has(objectiveId)) return false;
    this.done.add(objectiveId);
    return true;
  }

  doneCount(): number {
    return this.done.size;
  }

  /** Recarrega o estado inteiro (ex.: ao trocar de slot de save). */
  load(state: Partial<ProgressionState>): void {
    this.chapterId = state.chapterId ?? "";
    this.checkpointId = state.checkpointId ?? "";
    this.done.clear();
    for (const id of state.objectivesDone ?? []) this.done.add(id);
  }

  state(): ProgressionState {
    return {
      chapterId: this.chapterId,
      checkpointId: this.checkpointId,
      objectivesDone: [...this.done],
    };
  }
}
