/**
 * CAMADA JOGO (Brasa). Personagem do jogador: as escolhas feitas na Nova Descida
 * (criação) e como são lidas de volta do save com defesa. É dado de JOGO (parte do
 * payload `game` do SaveData), não da plataforma.
 *
 * Escopo do protótipo: nome, cor do manto (cosmético; a assinatura da Acendedora é o
 * brasa-alaranjado contra a pedra fria), um dom inicial (sabor, sem bônus mecânico
 * ainda) e a dificuldade. Mantém a porta aberta para atributos/aparência reais sem
 * mexer na forma do save. Textos em PT (ver campaign.ts/codex.ts).
 */
export type Difficulty = "faisca" | "brasa" | "fornalha";

export interface CharacterSave {
  name: string;
  manto: string; // id em MANTOS
  dom: string; // id em DONS
  difficulty: Difficulty;
}

export interface MantoOption {
  id: string;
  name: string;
  /** Cor de exibição (amostra na UI). */
  color: string;
}

export interface DomOption {
  id: string;
  name: string;
  description: string;
}

export interface DifficultyOption {
  id: Difficulty;
  name: string;
  description: string;
}

/** Cores de manto. O brasa-alaranjado é a cor-assinatura da Acendedora (ver bíblia de vestuário). */
export const MANTOS: MantoOption[] = [
  { id: "brasa", name: "Brasa alaranjada", color: "#d8702a" },
  { id: "cinza", name: "Cinza de fogueira", color: "#6b6660" },
  { id: "noite", name: "Azul do poço", color: "#2f4a6b" },
  { id: "ferro", name: "Ferro frio", color: "#48505a" },
];

/** Dom inicial: ênfase narrativa da heroína (sabor por ora; pode virar bônus depois). */
export const DONS: DomOption[] = [
  { id: "luz", name: "Luz", description: "A fagulha que a Acendedora carrega arde um pouco mais firme no escuro." },
  { id: "memoria", name: "Memória", description: "O legado das Acendedoras anteriores: ler inscrições e ecos do poço." },
  { id: "calor", name: "Calor", description: "O fôlego que não congela: resistir mais ao frio que avança." },
];

export const DIFFICULTIES: DifficultyOption[] = [
  { id: "faisca", name: "Faísca", description: "Para acompanhar a descida com folga. Mortos brandos." },
  { id: "brasa", name: "Brasa", description: "O equilíbrio pretendido. Desafio justo, vitória por leitura." },
  { id: "fornalha", name: "Fornalha", description: "Pouca margem para erro. O escuro cobra cada descuido." },
];

export const DEFAULT_CHARACTER: CharacterSave = {
  name: "Acendedora",
  manto: "brasa",
  dom: "luz",
  difficulty: "brasa",
};

function pick<T extends { id: string }>(list: T[], id: unknown, fallback: T): T {
  return (typeof id === "string" && list.find((o) => o.id === id)) || fallback;
}

/** Lê o personagem do payload com defesa (campos ausentes/corrompidos viram default). */
export function readCharacter(blob: Record<string, unknown> | undefined): CharacterSave {
  const o = (blob && typeof blob === "object" ? blob : {}) as Record<string, unknown>;
  return {
    name: typeof o.name === "string" && o.name.trim() ? o.name.trim().slice(0, 24) : DEFAULT_CHARACTER.name,
    manto: pick(MANTOS, o.manto, MANTOS[0]!).id,
    dom: pick(DONS, o.dom, DONS[0]!).id,
    difficulty: pick(DIFFICULTIES, o.difficulty, DIFFICULTIES[1]!).id,
  };
}

export function mantoName(id: string): string {
  return pick(MANTOS, id, MANTOS[0]!).name;
}
export function domName(id: string): string {
  return pick(DONS, id, DONS[0]!).name;
}
export function difficultyName(id: string): string {
  return pick(DIFFICULTIES, id, DIFFICULTIES[1]!).name;
}
