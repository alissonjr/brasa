import type { SkeletonKind } from "../actors/enemies/skeleton";
import type { IllustrationId } from "../ui/ds/illustrations";
import type { StringKey } from "../ui/strings";
import type { FrascoTipo } from "./saveData";

/**
 * CAMADA JOGO (Brasa). DADOS da descida redesenhada (docs/brasa/redesenho-da-descida.md, seções 3
 * e 5.3): as 7 antessalas (A1 a A7) e as 7 câmaras (C1 a C7), na ordem em que se descem. SÓ dados
 * e tipos: nenhuma lógica de cena, nenhuma importação do motor. As outras fases leem daqui:
 *  - R1 (antessala) e R2 (braseiro, chama, ofícios): `ANTESSALAS`;
 *  - R3 (armário): `armarioInicial`, `reserva`, `NICHOS_POR_ANTESSALA`;
 *  - R5 (murais): `mural` (gravuras de "o que foi" e perigos de "o que vem") + `formacao` da câmara;
 *  - R6 (câmaras): `CAMARAS` (planta, marcos, formação, set piece, lição).
 *
 * O texto que o jogador LÊ (inscrição e eco do andar) NÃO mora aqui: continua em `codex.ts`
 * (`FLOOR_INSCRIPTIONS`, `FLOOR_ECHOES`), uma fonte só. Os nomes de exibição são chaves de
 * `strings.ts` (paridade pt/en). Os nomes são de TRABALHO (doc seção 9): o glossário decide.
 * Os textos novos de fala (frase da Sentinela, marginálias de Marta, linha "Mortos despertos") estão
 * PENDENTES e não existem aqui de propósito.
 *
 * Divergência conhecida até a fase R6: `main.ts` ainda acorda os mortos de uma vez, num anel (ROSTER
 * antigo). A `formacao` abaixo é o desenho aprovado; só C1 difere em contagem (2 Mansos aqui, 1 lá).
 */

// --- Tipos comuns ---

/** Ofício de uma antessala: a Estante (livros, vela) ou a Bancada (preparos, pavios). */
export type OficioId = "estante" | "bancada";

/** Bússola em planta (z positivo = norte, x positivo = leste; a entrada fica ao sul). */
export type Ponto = "norte" | "nordeste" | "leste" | "sudeste" | "sul" | "sudoeste" | "oeste" | "noroeste" | "centro";

/** Perigo de cenário anunciado no mural "o que vem" (glifos de `hazard()`). */
export type PerigoId =
  | "chao_cede"
  | "colunas_moveis"
  | "agua"
  | "fissura_quente"
  | "arena_encolhe"
  | "grades_quentes"
  | "tumulo_arrombado";

/** Situação anunciada no mural (glifos): olho = emboscada, duas cristas = ondas, vela = vigília. */
export type SituacaoId = "emboscada" | "ondas" | "vigilia";

/** Quantos mortos de cada tipo a câmara tem (contagem exata, doc seção 9). */
export interface MortoCount {
  kind: SkeletonKind;
  n: number;
}

/** Peças que uma antessala pode ter (doc 2.1). Cada uma vira um arquivo em `scenes/crypt/antessala/` (R1). */
export type PecaId = "escada" | "braseiro" | "armario" | "oficio" | "mural" | "porta" | "grade";

// --- Câmaras ---

/** Quando um grupo de mortos acorda. */
export type Gatilho =
  | { tipo: "entrar" } // ao cruzar a porta de pedra (após o despertar de ~0,9 s)
  | { tipo: "apos"; grupo: string; atrasoSec: number } // quando o grupo `grupo` cai, depois de `atrasoSec`
  | { tipo: "proximidade"; marco: string; raio: number; avisoSec: number } // a Acendedora chega a `raio` m do marco
  | { tipo: "tempo"; apos: "entrar" | string; sec: number; avisoSec: number } // `sec` s depois do evento
  | { tipo: "linhaDeVisao"; marco: string } // ao passar pelo marco (ex.: transepto de C3)
  | { tipo: "estilha" }; // ao colher a estilha (Vigília de C5)

/** Um grupo de mortos de uma câmara. */
export interface Grupo {
  id: string;
  quando: Gatilho;
  mortos: SkeletonKind[];
  /** Onde nascem: id de um anexo ou marco da planta, ou um `Ponto`; ausente = anel em volta de `enemyAnchor`. */
  de?: string;
  /** Nasce deitado e se levanta (clipe LayToIdle, ex.: túmulo arrombado de C1). */
  deitado?: boolean;
  /** Avisado ao jogador (olho no mural, rangido, cinzas) antes de agir. */
  emboscada?: boolean;
  /** Onda 2 de uma câmara de duas ondas. */
  onda?: 1 | 2;
}

export type AnexoTipo = "nicho" | "galeria" | "braco" | "abside" | "colunata" | "fissura" | "forja" | "plataforma" | "tumulo" | "grade" | "estrado";

/** Anexo de planta (nichos, galerias, braços de transepto, abside...): de onde os mortos SAEM, não onde ficam. */
export interface Anexo {
  id: string;
  tipo: AnexoTipo;
  lado: Ponto;
  /** Profundidade em m (2,5 a 6) quando é recesso na parede; ausente quando não se aplica. */
  fundo?: number;
  nota?: string;
}

/** Marco da câmara: pelo menos um fica no caminho, e um é lido por proximidade ([R]). */
export interface Marco {
  id: string;
  /** Lugar aproximado (a coordenada exata é da planta, em R6). */
  onde: Ponto;
  /** Fica na área jogável (no caminho), não na borda. */
  noCaminho: boolean;
  /** Lido por proximidade com [R] (confirma a inscrição e desbloqueia o texto do decalque). */
  leitura?: boolean;
}

export type CamaraId = "C1" | "C2" | "C3" | "C4" | "C5" | "C6" | "C7";

export interface CamaraDef {
  id: CamaraId;
  /** Índice do andar 0..6 (o mesmo da antessala A(i+1)). */
  index: number;
  nome: StringKey;
  /** Tipo visual já existente em `cryptRoom` (`RoomKind`) enquanto as plantas próprias não existem. */
  kind: "guarda" | "salao" | "cisterna" | "santuario" | "guardiao";
  /** `normal` ou `vigilia` (C5: silêncio ao entrar; os mortos acordam ao colher a estilha). */
  modo: "normal" | "vigilia";
  /** Planta: dimensões em m (múltiplos de 12), forma (id do `pickLayout`) e anexos. */
  planta: { largura: number; profundidade: number; forma: string; anexos: Anexo[]; alcapao: Ponto | null; relicario: Ponto };
  marcos: Marco[];
  /** Formação inicial dos mortos (ondas, emboscadas, vigília). A composição por andar é a de sempre. */
  formacao: Grupo[];
  /** Perigos de cenário e situações que o mural anuncia (e que a câmara tem de cumprir). */
  perigos: PerigoId[];
  situacoes: SituacaoId[];
  /** Set piece da câmara (id estável; a especificação está no doc, seção 3). */
  setPiece: string;
  /** O que a câmara ensina (nota de design, não é texto de jogo). */
  licao: string;
  /** Beat de narrativa do andar. */
  batida: string;
}

export const CAMARAS: CamaraDef[] = [
  {
    id: "C1",
    index: 0,
    nome: "camara_c1_nome",
    kind: "guarda",
    modo: "normal",
    planta: {
      largura: 24, profundidade: 24, forma: "quadrado_24",
      anexos: [
        { id: "tumulo_a", tipo: "tumulo", lado: "leste", fundo: 2.5, nota: "selado" },
        { id: "tumulo_arrombado", tipo: "tumulo", lado: "leste", fundo: 2.5, nota: "o do meio, arrombado por dentro" },
        { id: "tumulo_b", tipo: "tumulo", lado: "leste", fundo: 2.5, nota: "selado; o 2o Manso acorda aqui" },
      ],
      alcapao: "noroeste", relicario: "norte",
    },
    marcos: [
      { id: "tumulos", onde: "leste", noCaminho: true },
      { id: "bancos", onde: "centro", noCaminho: true, leitura: true },
      { id: "relicario", onde: "norte", noCaminho: false },
    ],
    formacao: [
      { id: "g1", quando: { tipo: "entrar" }, mortos: ["minion"], de: "tumulo_arrombado", deitado: true },
      { id: "g2", quando: { tipo: "apos", grupo: "g1", atrasoSec: 1.5 }, mortos: ["minion"], de: "tumulo_b", deitado: true },
    ],
    perigos: ["tumulo_arrombado"],
    situacoes: [],
    setPiece: "primeiro_despertar",
    licao: "Ler o tell e punir; sala limpa abre o relicário; a estilha abre o alçapão. Sem prazo, sem flanco.",
    batida: "Os mortos são o povo.",
  },
  {
    id: "C2",
    index: 1,
    nome: "camara_c2_nome",
    kind: "salao",
    modo: "normal",
    planta: {
      largura: 36, profundidade: 24, forma: "largo_36x24",
      anexos: [
        { id: "abside", tipo: "abside", lado: "norte", fundo: 6, nota: "12 x 6; o relicário fica aqui" },
        { id: "colunata_oeste", tipo: "colunata", lado: "oeste" },
        { id: "colunata_leste", tipo: "colunata", lado: "leste" },
      ],
      alcapao: "nordeste", relicario: "norte",
    },
    marcos: [
      { id: "acampamento", onde: "centro", noCaminho: true, leitura: true },
      { id: "fogueira_fria", onde: "centro", noCaminho: true },
      { id: "mochila_e_corda", onde: "centro", noCaminho: true },
    ],
    formacao: [
      { id: "g1", quando: { tipo: "entrar" }, mortos: ["minion", "minion"], de: "colunata_oeste" },
      { id: "g2", quando: { tipo: "proximidade", marco: "acampamento", raio: 3, avisoSec: 1 }, mortos: ["demonio"], de: "abside", emboscada: true },
    ],
    perigos: [],
    situacoes: ["emboscada"],
    setPiece: "eco_das_acendedoras",
    licao: "Flanquear e virar; respeitar uma silhueta mais rápida; o mural é honesto.",
    batida: "Alguém desceu antes.",
  },
  {
    id: "C3",
    index: 2,
    nome: "camara_c3_nome",
    kind: "cisterna",
    modo: "normal",
    planta: {
      largura: 24, profundidade: 48, forma: "corredor_24x48",
      anexos: [
        { id: "braco_leste", tipo: "braco", lado: "leste", fundo: 6, nota: "6 x 12; rampa para a plataforma do arqueiro" },
        { id: "braco_oeste", tipo: "braco", lado: "oeste", fundo: 6, nota: "6 x 12; o Espreitador espera aqui" },
        { id: "plataforma_arqueiro", tipo: "plataforma", lado: "leste", nota: "com parapeito, no braço leste" },
        { id: "canais", tipo: "fissura", lado: "centro", nota: "canais de água rasa ao longo das paredes" },
      ],
      alcapao: "norte", relicario: "norte",
    },
    marcos: [
      { id: "tres_pilares", onde: "centro", noCaminho: true, leitura: true },
      { id: "plataforma", onde: "leste", noCaminho: false },
      { id: "cascata", onde: "norte", noCaminho: false },
    ],
    formacao: [
      { id: "g1", quando: { tipo: "entrar" }, mortos: ["warrior", "minion"] },
      { id: "g2", quando: { tipo: "entrar" }, mortos: ["arqueiro"], de: "plataforma_arqueiro" },
      { id: "g3", quando: { tipo: "linhaDeVisao", marco: "braco_oeste" }, mortos: ["espreitador"], de: "braco_oeste", emboscada: true },
    ],
    perigos: ["chao_cede", "agua"],
    situacoes: ["emboscada"],
    setPiece: "instabilidade",
    licao: "Ler o prazo; escolher entre caçar o arqueiro e correr; cobertura; o Unguento paga a Ferida da pressa.",
    batida: "A dúvida.",
  },
  {
    id: "C4",
    index: 3,
    nome: "camara_c4_nome",
    kind: "salao",
    modo: "normal",
    planta: {
      largura: 24, profundidade: 24, forma: "pilares_24",
      anexos: [
        { id: "nicho_sudoeste", tipo: "nicho", lado: "sudoeste", fundo: 2.5, nota: "o Espreitador sai pelas costas" },
        { id: "nicho_sudeste", tipo: "nicho", lado: "sudeste", fundo: 2.5 },
        { id: "grades", tipo: "grade", lado: "centro", nota: "3 grades no chão com brasa por baixo (zona quente, 4% da vida por segundo a quem fica parado)" },
      ],
      alcapao: "noroeste", relicario: "norte",
    },
    marcos: [
      { id: "coluna_da_primeira", onde: "centro", noCaminho: true, leitura: true },
      { id: "grades_quentes", onde: "centro", noCaminho: true },
      { id: "colunas_moveis", onde: "centro", noCaminho: true },
    ],
    formacao: [
      { id: "g1", quando: { tipo: "entrar" }, mortos: ["conjurador"], de: "norte" },
      { id: "g2", quando: { tipo: "entrar" }, mortos: ["antigo", "warrior", "minion"] },
      { id: "g3", quando: { tipo: "tempo", apos: "entrar", sec: 3, avisoSec: 1 }, mortos: ["espreitador"], de: "nicho_sudoeste", emboscada: true },
    ],
    perigos: ["colunas_moveis", "grades_quentes"],
    situacoes: ["emboscada"],
    setPiece: "colunas_deslizantes",
    licao: "Esperar a janela da coluna para fechar no Conjurador; respeitar o Antigo; não dar as costas à porta; as grades punem ficar parado.",
    batida: "O custo.",
  },
  {
    id: "C5",
    index: 4,
    nome: "camara_c5_nome",
    kind: "santuario",
    modo: "vigilia",
    planta: {
      largura: 36, profundidade: 24, forma: "largo_colunata_36x24",
      anexos: [
        { id: "galeria_oeste", tipo: "galeria", lado: "oeste", fundo: 3, nota: "ossuário; o Arqueiro" },
        { id: "galeria_leste", tipo: "galeria", lado: "leste", fundo: 3, nota: "ossuário; Ladino e Demônio" },
        { id: "abside", tipo: "abside", lado: "norte", fundo: 6, nota: "a segunda ossada; o Brutamonte" },
        { id: "estrado", tipo: "estrado", lado: "centro", nota: "o relicário no centro, rodeado de velas" },
      ],
      alcapao: "sul", relicario: "centro",
    },
    marcos: [
      { id: "ossada_supina", onde: "sul", noCaminho: true, leitura: true },
      { id: "ossada_curvada", onde: "norte", noCaminho: true, leitura: true },
      { id: "velas_votivas", onde: "centro", noCaminho: true },
    ],
    formacao: [
      { id: "g1", quando: { tipo: "estilha" }, mortos: ["brutamonte"], de: "abside" },
      { id: "g2", quando: { tipo: "estilha" }, mortos: ["arqueiro"], de: "galeria_oeste" },
      { id: "g3", quando: { tipo: "estilha" }, mortos: ["rogue", "demonio"], de: "galeria_leste" },
    ],
    perigos: [],
    situacoes: ["vigilia"],
    setPiece: "vigilia",
    licao: "Ler a sala antes de agir; lutar recuando para a saída conhecida; esquivar o inquebrável do Brutamonte; por que preparar antes.",
    batida: "Luto e respiro.",
  },
  {
    id: "C6",
    index: 5,
    nome: "camara_c6_nome",
    kind: "cisterna",
    modo: "normal",
    planta: {
      largura: 24, profundidade: 36, forma: "corredor_24x36",
      anexos: [
        { id: "fissura_oeste", tipo: "fissura", lado: "oeste", fundo: 3, nota: "brasa; esquenta a borda e empurra a luta ao centro" },
        { id: "fissura_leste", tipo: "fissura", lado: "leste", fundo: 3 },
        { id: "forja_leste", tipo: "forja", lado: "leste", nota: "elevada; posto do Arqueiro" },
        { id: "forja_oeste", tipo: "forja", lado: "oeste", nota: "elevada; o Espreitador sai daqui na onda 2" },
        { id: "tumulo_meio", tipo: "tumulo", lado: "norte", nota: "o do meio se abre: a Sentinela" },
      ],
      alcapao: "nordeste", relicario: "norte",
    },
    marcos: [
      { id: "forja", onde: "centro", noCaminho: true, leitura: true },
      { id: "tres_tumulos", onde: "norte", noCaminho: false },
      { id: "fissuras", onde: "leste", noCaminho: false },
    ],
    formacao: [
      { id: "onda1_frente", quando: { tipo: "entrar" }, mortos: ["warrior", "rogue"], onda: 1 },
      { id: "onda1_forja", quando: { tipo: "entrar" }, mortos: ["arqueiro"], de: "forja_leste", onda: 1 },
      // Onda 2: quando a 1a cai, 2 s de silêncio e um rangido. A Sentinela veste o manto da Acendedora.
      { id: "onda2_sentinela", quando: { tipo: "apos", grupo: "onda1_frente", atrasoSec: 2 }, mortos: ["sentinela"], de: "tumulo_meio", deitado: true, onda: 2 },
      { id: "onda2_espreitador", quando: { tipo: "apos", grupo: "onda1_frente", atrasoSec: 2 }, mortos: ["espreitador"], de: "forja_oeste", onda: 2 },
    ],
    perigos: ["fissura_quente"],
    situacoes: ["ondas"],
    setPiece: "ecos_sobrepostos",
    licao: "Esquivar o inquebrável e punir a recuperação; ritmo de mini-chefe antes do Guardião; o custo humano.",
    batida: "A verdade se monta.",
  },
  {
    id: "C7",
    index: 6,
    nome: "camara_c7_nome",
    kind: "guardiao",
    modo: "normal",
    planta: {
      largura: 36, profundidade: 36, forma: "arena_36",
      anexos: [
        { id: "cratera", tipo: "estrado", lado: "centro", nota: "a Brasa no centro, numa cratera baixa; anéis que cedem em 14,5 m e 11 m" },
      ],
      alcapao: null, relicario: "centro",
    },
    marcos: [
      { id: "brasa", onde: "centro", noCaminho: true, leitura: true },
      { id: "braseiros_das_fundadoras", onde: "centro", noCaminho: false },
    ],
    formacao: [{ id: "guardia", quando: { tipo: "entrar" }, mortos: [], de: "centro" }], // a Guardiã é o chefe (combat.addBoss), não um SkeletonKind
    perigos: ["arena_encolhe"],
    situacoes: [],
    setPiece: "reavivar_a_brasa",
    licao: "Tudo: ler, esquivar o inquebrável, reacender, o espaço que encolhe.",
    batida: "O confronto.",
  },
];

// --- Antessalas ---

export type AntessalaId = "A1" | "A2" | "A3" | "A4" | "A5" | "A6" | "A7";

/** Frasco que já está num nicho do armário quando a descida começa. */
export interface FrascoInicial {
  tipo: FrascoTipo;
  /** Quem deixou: "marta" (o rótulo literal é texto pendente) ou a ordem das Acendedoras. */
  de: "marta" | "ordem";
}

/** O que o mural da antessala mostra. A GRAVURA de "o que foi" é a do decalque da Crônica (uma fonte). */
export interface MuralDef {
  /** Gravuras de "o que foi" (ids de `illustrations.ts`), na ordem de leitura. */
  foi: IllustrationId[];
  /** "O que vem" é gerado da câmara seguinte (`CAMARAS[index]`: `formacao`, `perigos`, `situacoes`). */
  vemDe: CamaraId;
  /** A silhueta da Guardiã aparece antes do Guardião (A7). */
  silhuetaGuardia?: boolean;
}

export interface AntessalaDef {
  id: AntessalaId;
  /** Índice do andar 0..6. */
  index: number;
  nome: StringKey;
  /** Planta em m. A6 é 12 x 18; as demais, 12 x 12 (a `camara_12`). */
  planta: { largura: number; profundidade: number };
  /** Ofícios presentes (A1 e A7 não têm de propósito; A6 tem os dois). */
  oficios: OficioId[];
  /** Frascos que já estão no armário na primeira visita (conteúdo fixo; o rótulo "de Marta" é texto pendente). */
  armarioInicial: FrascoInicial[];
  /** Reserva da ordem (a banca de hoje): estoque fixo; o Unguento só existe onde há Bancada. */
  reserva: { vida: number; furia: number; unguento: boolean };
  mural: MuralDef;
  /** Peças do dressing da antessala (doc 2.1); o ofício, a grade e a porta variam. */
  pecas: PecaId[];
  /** A1: prólogo guiado, sem combate; a porta de pedra só abre depois do primeiro acender. */
  prologo?: boolean;
  /** A7: uma grade no chão deixa ver o clarão da Brasa lá embaixo. */
  grade?: boolean;
}

/** Nichos do armário em cada antessala. */
export const NICHOS_POR_ANTESSALA = 4;

const PECAS_BASE: PecaId[] = ["escada", "braseiro", "armario", "mural", "porta"];

export const ANTESSALAS: AntessalaDef[] = [
  {
    id: "A1", index: 0, nome: "antessala_a1_nome",
    planta: { largura: 12, profundidade: 12 },
    oficios: [],
    armarioInicial: [{ tipo: "vida", de: "marta" }],
    reserva: { vida: 2, furia: 1, unguento: false },
    mural: { foi: ["marta", "poco"], vemDe: "C1" },
    pecas: PECAS_BASE,
    prologo: true,
  },
  {
    id: "A2", index: 1, nome: "antessala_a2_nome",
    planta: { largura: 12, profundidade: 12 },
    oficios: ["estante"],
    armarioInicial: [],
    reserva: { vida: 2, furia: 1, unguento: false },
    mural: { foi: ["manto"], vemDe: "C2" },
    pecas: [...PECAS_BASE, "oficio"],
  },
  {
    id: "A3", index: 2, nome: "antessala_a3_nome",
    planta: { largura: 12, profundidade: 12 },
    oficios: ["bancada"],
    armarioInicial: [{ tipo: "unguento", de: "marta" }],
    reserva: { vida: 2, furia: 1, unguento: true },
    mural: { foi: ["eco"], vemDe: "C3" },
    pecas: [...PECAS_BASE, "oficio"],
  },
  {
    id: "A4", index: 3, nome: "antessala_a4_nome",
    planta: { largura: 12, profundidade: 12 },
    oficios: ["estante"],
    armarioInicial: [],
    reserva: { vida: 2, furia: 1, unguento: false },
    mural: { foi: ["preco"], vemDe: "C4" },
    pecas: [...PECAS_BASE, "oficio"],
  },
  {
    id: "A5", index: 4, nome: "antessala_a5_nome",
    planta: { largura: 12, profundidade: 12 },
    oficios: ["bancada"],
    armarioInicial: [{ tipo: "furia", de: "ordem" }],
    reserva: { vida: 2, furia: 1, unguento: true },
    mural: { foi: ["duas"], vemDe: "C5" },
    pecas: [...PECAS_BASE, "oficio"],
  },
  {
    id: "A6", index: 5, nome: "antessala_a6_nome",
    planta: { largura: 12, profundidade: 18 },
    oficios: ["estante", "bancada"],
    armarioInicial: [],
    reserva: { vida: 2, furia: 1, unguento: true },
    mural: { foi: ["brasa"], vemDe: "C6" },
    pecas: [...PECAS_BASE, "oficio"],
  },
  {
    id: "A7", index: 6, nome: "antessala_a7_nome",
    planta: { largura: 12, profundidade: 12 },
    oficios: [],
    armarioInicial: [],
    reserva: { vida: 2, furia: 1, unguento: false },
    mural: { foi: ["guardia"], vemDe: "C7", silhuetaGuardia: true },
    pecas: [...PECAS_BASE, "grade"],
    grade: true,
  },
];

// --- Marcas da Crônica (seção 2.5) ---
// Mesmo formato de `markFloor`/`markRead` de `codex.ts` (n = andar de 1 a 7). A Crônica (R5) as lê.

/** O jogador leu o mural da antessala A(n). Desbloqueia a GRAVURA do decalque do andar n. */
export const markMural = (n: number): string => `mural:${n}`;
/** O jogador acendeu o braseiro da antessala A(n). */
export const markAcendeu = (n: number): string => `acendeu:${n}`;
/** A Sentinela de C6 caiu (nicho "A que Falhou"). */
export const MARK_SENTINELA_CAIU = "sentinela:caiu";

// --- Eventos da plataforma (`platform.events`) emitidos pelo laço novo ---
// R0 define os nomes e as cargas; cada fase emite os seus. `antessala:enter` já sai em R0.

export const EVT = {
  antessalaEnter: "antessala:enter",
  braseiroLit: "braseiro:lit",
  muralRead: "mural:read",
  armarioChange: "armario:change",
  waveStart: "wave:start",
} as const;

export interface EvtAntessalaEnter { index: number; id: AntessalaId; fresh: boolean }
export interface EvtBraseiroLit { index: number }
export interface EvtMuralRead { index: number }
export interface EvtArmarioChange { index: number }
export interface EvtWaveStart { index: number; grupo: string; onda: 1 | 2 | null }
