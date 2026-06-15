/**
 * CAMADA APP. Streaming de mundo por proximidade: adia a construção das regiões
 * pesadas para quando o jogador chega perto, em vez de montar tudo no boot.
 *
 * Granularidade = região (cada builder de cena monta uma). Não há descarte em v1:
 * o objetivo é não pagar o custo de carga todo de uma vez. O gerenciador vive só
 * aqui, na camada app; os builders de cena não mudam. Cada região é idempotente
 * (carrega uma única vez; em falha, volta a "idle" para permitir nova tentativa).
 */

export interface StreamRegion {
  /** Identificador da região. */
  name: string;
  /** Centro da região no mundo (XZ). */
  cx: number;
  cz: number;
  /** Raio de gatilho: se o jogador entrar nele e a região estiver ociosa, carrega. */
  loadRadius: number;
  /** Constrói a região (assíncrono ou não). Capturado uma vez. */
  load: () => void | Promise<void>;
}

type RegionState = "idle" | "loading" | "loaded";

export class WorldStreaming {
  private readonly state = new Map<string, RegionState>();

  constructor(private readonly regions: StreamRegion[]) {
    for (const r of regions) this.state.set(r.name, "idle");
  }

  /** Carrega uma região agora (ex.: crítica no boot), de forma idempotente. */
  async ensure(name: string): Promise<void> {
    if (this.state.get(name) !== "idle") return;
    const region = this.regions.find((r) => r.name === name);
    if (!region) throw new Error("[streaming] região desconhecida: " + name);
    this.state.set(name, "loading");
    try {
      await region.load();
      this.state.set(name, "loaded");
      console.log(`[streaming] região carregada: ${name}`);
    } catch (err) {
      this.state.set(name, "idle"); // permite retentar numa próxima passagem
      console.error(`[streaming] falha ao carregar ${name}:`, err);
    }
  }

  /**
   * Chamado no loop de jogo: dispara a carga das regiões ociosas cujo gatilho de
   * proximidade foi atingido pela posição do jogador.
   */
  update(x: number, z: number): void {
    for (const r of this.regions) {
      if (this.state.get(r.name) !== "idle") continue;
      if (Math.hypot(x - r.cx, z - r.cz) <= r.loadRadius) void this.ensure(r.name);
    }
  }

  isLoaded(name: string): boolean {
    return this.state.get(name) === "loaded";
  }
}
