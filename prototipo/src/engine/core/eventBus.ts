/**
 * CAMADA ENGINE. Barramento de eventos desacoplado.
 *
 * O JOGO emite eventos de domínio ("checkpoint", "score", ...); a PLATAFORMA
 * (ou outros sistemas) escutam, sem que o jogo conheça quem escuta. Mantém as
 * camadas desacopladas.
 */
export interface EventBus {
  emit<T>(type: string, payload: T): void;
  /** Retorna uma função para cancelar a inscrição. */
  on<T>(type: string, handler: (payload: T) => void): () => void;
}

type Handler = (payload: unknown) => void;

export function createEventBus(): EventBus {
  const handlers = new Map<string, Set<Handler>>();

  return {
    emit<T>(type: string, payload: T): void {
      const set = handlers.get(type);
      if (!set) return;
      for (const h of set) h(payload as unknown);
    },
    on<T>(type: string, handler: (payload: T) => void): () => void {
      let set = handlers.get(type);
      if (!set) {
        set = new Set<Handler>();
        handlers.set(type, set);
      }
      const h = handler as Handler;
      set.add(h);
      return () => {
        set.delete(h);
      };
    },
  };
}
