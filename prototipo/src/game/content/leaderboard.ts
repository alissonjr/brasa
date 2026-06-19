/**
 * CAMADA JOGO (Brasa). LEADERBOARD LOCAL de speedrun (rejogabilidade, 00-roadmap 3.6): os
 * 5 melhores TEMPOS (segundos) de descida VENCIDA. Persistido em localStorage (try/catch,
 * sem tocar o save Dexie/HMAC), local e offline. Independe do slot de save: sobrevive a
 * jogos novos e a fechar o navegador.
 */
const KEY = "brasa.leaderboard.v1";
const TOP_N = 5;

function read(): number[] {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter((x): x is number => typeof x === "number" && Number.isFinite(x) && x > 0).slice(0, TOP_N);
  } catch {
    return [];
  }
}

function write(times: number[]): void {
  try {
    if (typeof localStorage !== "undefined") localStorage.setItem(KEY, JSON.stringify(times));
  } catch {
    /* localStorage indisponivel (modo privado): ignora silenciosamente */
  }
}

/** Tempos atuais (segundos), em ordem crescente (melhor primeiro), no máximo TOP_N. */
export function readLeaderboard(): number[] {
  return read().sort((a, b) => a - b).slice(0, TOP_N);
}

/**
 * Registra um tempo de descida vencida. Retorna o índice (0-based) no ranking se entrou no
 * top 5, ou -1 se não entrou. Persiste o novo top 5.
 */
export function submitTime(seconds: number): number {
  if (!(seconds > 0)) return -1;
  const times = read();
  times.push(seconds);
  times.sort((a, b) => a - b);
  const top = times.slice(0, TOP_N);
  write(top);
  const rank = top.indexOf(seconds);
  return rank;
}

/** Formata segundos como m:ss (para a tela de vitória). */
export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}
