import Dexie, { type Table } from "dexie";

/**
 * CAMADA PLATAFORMA. Partida salva (Fase 1: local-first robusto).
 *
 * Genérica: guarda/recupera o save por slot, sem conhecer a estrutura interna do
 * jogo. O JOGO decide O QUE salvar (montando SaveData); a plataforma decide ONDE/COMO.
 *
 * Implementação atual: IndexedDB via Dexie (capacidade grande, escrita transacional
 * atômica, dados estruturados), com:
 * - envelope versionado (schemaVersion) + migração em cadeia;
 * - checksum HMAC anti-edição-casual (ver docs/plataforma-roadmap.md seção 4);
 * - escrita atômica + backup do save anterior (recuperação se corromper);
 * - saneamento no load; export/import de arquivo (backup soberano do usuário).
 *
 * A interface SaveStore não muda: trocar por TauriSaveStore (desktop) ou
 * RemoteSaveStore (Fase 2) não toca o jogo. Supabase está vetado (ver roadmap).
 */

export const SAVE_SCHEMA_VERSION = 3;

/**
 * Envelope do save: SÓ campos genéricos da plataforma. Tudo que é semântica do
 * jogo (capítulo, checkpoint, objetivos, ink, conquistas) vai dentro de `game`,
 * um payload opaco que o JOGO dona e tipa (ver game/content/saveData.ts). Assim a
 * plataforma não conhece o miolo do jogo (regra de camadas).
 */
export interface SaveData {
  schemaVersion: number; // formato do save; dirige a migração
  rev: number; // versão monotônica (sync/LWW e regra "nunca regredir")
  updatedAt: number; // timestamp (Date.now)
  profileId: string;
  points: number; // pontuação genérica (ScoreService)
  playtimeSec: number;
  summary: string; // rótulo curto para a lista de slots (o jogo monta)
  game: Record<string, unknown>; // payload do jogo (forma definida pela camada de jogo)
}

export interface SaveSlotInfo {
  slot: string;
  summary: string;
  points: number;
  updatedAt: number;
}

export interface SaveStore {
  load(slot: string): Promise<SaveData | null>;
  save(slot: string, data: SaveData): Promise<void>;
  list(): Promise<SaveSlotInfo[]>;
  delete(slot: string): Promise<void>;
  /** Exporta um slot como arquivo (backup soberano do usuário). Null se vazio. */
  exportSlot(slot: string): Promise<Blob | null>;
  /** Importa um arquivo de save para um slot; valida e retorna o SaveData. */
  importSlot(slot: string, file: Blob): Promise<SaveData>;
}

// Segredo só do HMAC anti-edição-casual. No bundle => NÃO é anti-cheat sério
// (ver docs/plataforma-roadmap.md seção 4). Single-player: integridade > sigilo.
const HMAC_SECRET = "brasa-save-v1-7c2f1a";

interface SaveRecord {
  slot: string;
  summary: string;
  points: number;
  updatedAt: number;
  data: SaveData;
  checksum: string;
}

class SaveDb extends Dexie {
  // "declare" (e não campo de classe) por causa de useDefineForClassFields=true:
  // um campo comum sobrescreveria a tabela que o Dexie injeta. Ver docs do Dexie.
  declare saves: Table<SaveRecord, string>;
  declare backups: Table<SaveRecord, string>;

  constructor() {
    super("brasa");
    this.version(1).stores({
      saves: "slot, updatedAt",
      backups: "slot",
    });
  }
}

export class LocalSaveStore implements SaveStore {
  private readonly db = new SaveDb();

  async load(slot: string): Promise<SaveData | null> {
    const rec = await this.db.saves.get(slot);
    if (!rec) return null;
    if (await verifyChecksum(rec.data, rec.checksum)) {
      return finalize(rec.data);
    }
    console.warn(`[save] checksum inválido no slot "${slot}"; tentando backup.`);
    const bak = await this.db.backups.get(slot);
    if (bak && (await verifyChecksum(bak.data, bak.checksum))) {
      return finalize(bak.data);
    }
    console.error(`[save] slot "${slot}" corrompido e sem backup válido.`);
    return null;
  }

  async save(slot: string, data: SaveData): Promise<void> {
    const checksum = await computeChecksum(data);
    const rec: SaveRecord = {
      slot,
      summary: data.summary,
      points: data.points,
      updatedAt: data.updatedAt,
      data,
      checksum,
    };
    // Transação atômica: copia o atual para backup e grava o novo num passo só.
    await this.db.transaction("rw", this.db.saves, this.db.backups, async () => {
      const prev = await this.db.saves.get(slot);
      if (prev) await this.db.backups.put({ ...prev });
      await this.db.saves.put(rec);
    });
  }

  async list(): Promise<SaveSlotInfo[]> {
    const recs = await this.db.saves.toArray();
    return recs
      .map((r) => ({ slot: r.slot, summary: r.summary, points: r.points, updatedAt: r.updatedAt }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  async delete(slot: string): Promise<void> {
    await this.db.transaction("rw", this.db.saves, this.db.backups, async () => {
      await this.db.saves.delete(slot);
      await this.db.backups.delete(slot);
    });
  }

  async exportSlot(slot: string): Promise<Blob | null> {
    const rec = await this.db.saves.get(slot);
    if (!rec) return null;
    const file = {
      brasaSave: true,
      schemaVersion: rec.data.schemaVersion,
      exportedAt: Date.now(),
      data: rec.data,
      checksum: rec.checksum,
    };
    return new Blob([JSON.stringify(file, null, 2)], { type: "application/json" });
  }

  async importSlot(slot: string, file: Blob): Promise<SaveData> {
    const text = await file.text();
    const parsed = JSON.parse(text) as { brasaSave?: boolean; data?: SaveData; checksum?: string };
    if (!parsed || parsed.brasaSave !== true || !parsed.data) {
      throw new Error("Arquivo de save inválido.");
    }
    if (!(await verifyChecksum(parsed.data, parsed.checksum ?? ""))) {
      throw new Error("Save importado com checksum inválido (arquivo adulterado ou corrompido).");
    }
    const data = finalize(parsed.data);
    await this.save(slot, data);
    return data;
  }
}

// --- migração de formato (em cadeia, uma versão por vez) ---
type Bag = Record<string, unknown>;
const migrations: Record<number, (d: Bag) => Bag> = {
  // v1 -> v2: introduz a lista de objetivos concluídos (progressão da campanha).
  1: (d) => ({ ...d, objectives: Array.isArray(d.objectives) ? d.objectives : [] }),
  // v2 -> v3: desacopla o envelope; campos do jogo migram para o payload `game`.
  2: (d) => ({
    schemaVersion: 3,
    rev: d.rev,
    updatedAt: d.updatedAt,
    profileId: d.profileId,
    points: d.points,
    playtimeSec: d.playtimeSec,
    summary: typeof d.chapter === "string" ? d.chapter : "",
    game: {
      chapter: d.chapter ?? "",
      checkpoint: d.checkpoint ?? "",
      objectives: Array.isArray(d.objectives) ? d.objectives : [],
      inkState: d.inkState ?? "",
      achievements: [],
    },
  }),
};

function migrate(data: SaveData): SaveData {
  let d = data as unknown as Bag;
  let v = typeof d.schemaVersion === "number" ? (d.schemaVersion as number) : 1;
  while (v < SAVE_SCHEMA_VERSION) {
    const step = migrations[v];
    if (!step) break;
    d = step(d);
    v += 1;
    d.schemaVersion = v;
  }
  return d as unknown as SaveData;
}

// --- saneamento pós-load (clamp/validação, cair em default seguro) ---
function sanitize(data: SaveData): SaveData {
  const game = data.game && typeof data.game === "object" ? (data.game as Record<string, unknown>) : {};
  return {
    schemaVersion: SAVE_SCHEMA_VERSION,
    rev: numOr(data.rev, 0),
    updatedAt: numOr(data.updatedAt, Date.now()),
    profileId: data.profileId ?? "",
    points: Math.max(0, numOr(data.points, 0)),
    playtimeSec: Math.max(0, numOr(data.playtimeSec, 0)),
    summary: typeof data.summary === "string" ? data.summary : "",
    game,
  };
}

function finalize(data: SaveData): SaveData {
  return sanitize(migrate(data));
}

function numOr(v: unknown, fallback: number): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

// --- checksum: HMAC-SHA256 quando há WebCrypto; sem verificação em dev inseguro ---
async function computeChecksum(data: SaveData): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) return ""; // origem insegura (ex.: http em IP de LAN): grava sem checksum
  const enc = new TextEncoder();
  const key = await subtle.importKey(
    "raw",
    enc.encode(HMAC_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await subtle.sign("HMAC", key, enc.encode(stableStringify(data)));
  return "hmac:" + [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifyChecksum(data: SaveData, checksum: string): Promise<boolean> {
  if (!checksum) return true; // gravado sem checksum (ambiente sem WebCrypto)
  const expected = await computeChecksum(data);
  if (!expected) return true; // não há como verificar agora; não bloquear o jogador
  return expected === checksum;
}

/** Serialização determinística (chaves ordenadas) para o checksum ser estável. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return "[" + value.map(stableStringify).join(",") + "]";
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableStringify(obj[k])).join(",") + "}";
}
