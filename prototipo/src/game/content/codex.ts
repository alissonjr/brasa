import type { IllustrationId } from "../ui/ds/illustrations";

/**
 * CAMADA JOGO (Brasa). Crônica: o registro de lore que o jogador acumula, no formato "A Parede".
 * Está organizada POR ANDAR (andar 0 = a boca do poço, andares 1 a 7 = a descida, na ordem do
 * `DESCENT` de main.ts, onde o andar N é o índice N-1). Cada andar guarda:
 *  - o DECALQUE da inscrição daquele andar (a frotagem presa na laje), liberado ao LER a
 *    inscrição (aproximando-se do nicho ou com [R]);
 *  - os NICHOS (personagens, lugares e relatos) que o jogo passa a dizer naquele andar.
 * O estado de "o que já foi visto" é um conjunto de MARCAS (ids de string) guardado no save
 * (`codex` em saveData.ts). Uma entrada está liberada se nasce assim ou se a sua marca já existe.
 *
 * Fonte dos textos: o canon fechado em docs/brasa/narrativa-e-historia.md (seção 0), a ficha de
 * personagens (personagens.md) e o roadmap (00-aprofundamento-e-roadmap.md, 3.3). O eco e a
 * inscrição de cada andar são os mesmos que a descida mostra no jogo (única fonte: aqui).
 * Pontos em aberto no canon (nome do reino, se a ordem ainda existe) NÃO são afirmados.
 */

// --- Marcas (ids guardados no save) ---

/** O jogador chegou ao andar N (1 a 7; é o índice do DESCENT mais um). */
export const markFloor = (n: number): string => `andar:${n}`;
/** O jogador leu a inscrição do andar N (nicho por proximidade ou [R]). */
export const markRead = (n: number): string => `leitura:${n}`;
/** O Guardião caiu e sussurrou a verdade. */
export const MARK_BOSS_DOWN = "guardiao:caiu";

// --- Tipos ---

export type CodexCategory = "personagens" | "lugares" | "relatos";

/** Como a página é liberada: já nasce revelada, ou ao existir uma marca no save. */
export type CodexUnlock = { type: "always" } | { type: "mark"; id: string };

/** Algo com condição de desbloqueio (decalque ou nicho). */
interface Unlockable {
  id: string;
  unlock: CodexUnlock;
}

/** Nicho: pessoa, lugar ou relato. */
export interface CodexEntry extends Unlockable {
  category: CodexCategory;
  /** Andar em que o jogo passa a dizer isto (0 = desde a boca do poço). */
  floor: number;
  title: string;
  /** Linha-resumo (subtítulo do folheto). */
  lead: string;
  /** Parágrafos do verbete. */
  body: string[];
  art: IllustrationId;
}

/** Decalque: a frotagem da inscrição de um andar. */
export interface CodexDecal extends Unlockable {
  title: string;
  /** O eco ouvido ao entrar no andar (legenda do HUD). */
  echo: string;
  /** O texto gravado na pedra, tal como a descida o mostra. */
  inscription: string;
  body: string[];
  art: IllustrationId;
}

export interface CodexFloor {
  /** 0 = boca do poço; 1 a 7 = andares da descida. */
  n: number;
  name: string;
  /** Camada do poço (nome do canon). */
  layer: string;
  layerShort: string;
  decal?: CodexDecal;
  entries: CodexEntry[];
}

// --- Conteúdo ---

export const CODEX_FLOORS: CodexFloor[] = [
  {
    n: 0,
    name: "A boca do poço",
    layer: "A superfície",
    layerShort: "Boca",
    entries: [
      {
        id: "cinza",
        category: "personagens",
        floor: 0,
        title: "A Acendedora",
        lead: "Quem desce. Fala pouco.",
        body: [
          "Acendedora é o título herdado, e quem o carrega escolhe o próprio nome. Carrega no peito uma fagulha viva da Brasa e desce o poço de capuz, falando quase nada.",
          "Desce porque Marta, a mentora que a criou, voltou da sua descida gasta demais para descer outra vez e agora morre de frio na superfície. Desce para reavivar a Brasa e para saber o que houve com quem desceu antes dela.",
        ],
        art: "cinza",
        unlock: { type: "always" },
      },
      {
        id: "poco-cripta",
        category: "lugares",
        floor: 0,
        title: "O poço-cripta",
        lead: "A descida de pedra até a Brasa.",
        body: [
          "Um poço vertical de pedra, escavado em câmaras seladas, que desce da superfície até o fundo onde arde a Brasa. Cada andar é uma câmara fechada por uma porta de pedra, e a luz só alcança uma câmara por vez.",
          "Antes de ser masmorra, é um cemitério sagrado. As Câmaras de Cima guardam os mortos mais recentes; as Fundas, os mais antigos; as da Origem, o coração da ordem das Acendedoras. No fim, a Brasa.",
        ],
        art: "poco",
        unlock: { type: "always" },
      },
      {
        id: "frio-eterno",
        category: "relatos",
        floor: 0,
        title: "O frio eterno",
        lead: "O estado natural do mundo.",
        body: [
          "Não é o inverno, que passa. É o jeito natural das coisas: a vida é a exceção, e a exceção tem um único motivo, a Brasa.",
          "Quando a luz recua, o Escuro não ataca: apenas volta a ocupar o que sempre foi dele. O reino sobrevive num anel de calor em volta da boca do poço, e quanto mais longe dela, mais a geada toma.",
        ],
        art: "frio",
        unlock: { type: "always" },
      },
      {
        id: "fagulha",
        category: "relatos",
        floor: 0,
        title: "A fagulha",
        lead: "A única luz que desce com ela.",
        body: [
          "Uma brasa viva alojada no peito da portadora, ligada à Brasa no fundo do poço. Só uma pessoa a carrega por vez.",
          "Por isso só a Acendedora reacende o fogo morto das câmaras: ele só reconhece a fagulha da linhagem. E carregá-la consome. Quem a leva não envelhece como os outros; gasta-se.",
        ],
        art: "fagulha",
        unlock: { type: "always" },
      },
    ],
  },
  {
    n: 1,
    name: "A câmara de guarda",
    layer: "Câmaras de Cima",
    layerShort: "De Cima",
    decal: {
      id: "decalque-1",
      title: "Os nomes nos bancos",
      echo: "Lê os nomes gravados nos bancos. Foram teu povo, antes do frio.",
      inscription: "Aqui jaz a guarda da chama. Foram teu povo, antes do frio.",
      body: [
        "Nos bancos da primeira câmara há nomes gravados. É o povo do reino, enterrado com reverência perto da Brasa para repousar na luz.",
        "Os selos nunca foram prisão: foram proteção, um gesto de amor. Um dos túmulos, porém, foi arrombado por dentro. É o ponto exato onde a luz recuou e os mortos começaram a despertar.",
      ],
      art: "mortos",
      unlock: { type: "mark", id: markRead(1) },
    },
    entries: [
      {
        id: "mortos-selados",
        category: "personagens",
        floor: 1,
        title: "Os mortos selados",
        lead: "O povo, deitado na luz.",
        body: [
          "Gente do próprio reino, enterrada com reverência perto da Brasa para repousar na claridade. Os selos nunca foram prisão: foram proteção, um gesto de amor.",
          "Quando a luz recua, o escuro os reclama e eles se levantam. Atacam a Acendedora porque a fagulha é o único calor que ainda sentem. Quanto mais fundo se desce, mais antigos e mais fortes eles são. Vencê-los é devolvê-los ao repouso.",
        ],
        art: "mortos",
        unlock: { type: "mark", id: markRead(1) },
      },
    ],
  },
  {
    n: 2,
    name: "O salão",
    layer: "Câmaras de Cima",
    layerShort: "De Cima",
    decal: {
      id: "decalque-2",
      title: "O manto rasgado",
      echo: "Um manto rasgado. Uma fagulha apagada no chão. Alguém desceu antes de ti.",
      inscription: "Outra desceu por estas escadas. Não a vimos voltar.",
      body: [
        "Junto à parede jaz um manto igual ao da Acendedora, rasgado na altura do peito. Ao lado, no chão, uma fagulha que já foi viva e agora está apagada.",
        "É a prova de que outra Acendedora desceu antes e não voltou. Entender o que houve com quem foi antes é parte do que leva a Acendedora poço abaixo.",
      ],
      art: "manto",
      unlock: { type: "mark", id: markRead(2) },
    },
    entries: [],
  },
  {
    n: 3,
    name: "A cisterna",
    layer: "Câmaras Fundas",
    layerShort: "Fundas",
    decal: {
      id: "decalque-3",
      title: "A que já estava aqui",
      echo: "Dizem que ela foi a primeira. Dizem que já ardia aqui quando a primeira desceu.",
      inscription: "Quem acendeu a primeira Brasa? A pedra não responde.",
      body: [
        "As inscrições da cisterna se contradizem. Uma fala de uma mulher que acendeu a primeira chama. Outra, da própria luz tomando forma. Outra jura que nunca houve primeira, que sempre houve fogo.",
        "O poço guarda o mito inteiro e não escolhe nenhum. De onde veio a Brasa, a pedra não diz.",
      ],
      art: "eco",
      unlock: { type: "mark", id: markRead(3) },
    },
    entries: [],
  },
  {
    n: 4,
    name: "O salão",
    layer: "Câmaras Fundas",
    layerShort: "Fundas",
    decal: {
      id: "decalque-4",
      title: "O preço",
      echo: "A Brasa não pede lenha. Pede quem a alimente por dentro.",
      inscription: "A chama cobra em carne: uma vida por geração.",
      body: [
        "Aqui a pedra deixa de lamentar e faz a conta. A Brasa não arde por si: alimenta-se da fagulha viva de uma portadora, e cada geração entrega uma.",
        "É o preço do calor que ainda sobe do poço, e ninguém o paga de graça.",
      ],
      art: "preco",
      unlock: { type: "mark", id: markRead(4) },
    },
    entries: [],
  },
  {
    n: 5,
    name: "O santuário",
    layer: "Câmaras Fundas",
    layerShort: "Fundas",
    decal: {
      id: "decalque-5",
      title: "Duas que desceram",
      echo: "Dois conjuntos de ossos. Um voltou até a porta. O outro desceu mais fundo.",
      inscription: "Que descanses, tu que voltaste. E tu, que desceste mais.",
      body: [
        "No santuário repousam os restos de duas Acendedoras. Uma voltou até a porta e ali ficou. A outra passou por ela e seguiu poço abaixo.",
        "É um respiro na descida. A pedra deixa uma bênção para as duas: a que voltou e a que desceu mais.",
      ],
      art: "duas",
      unlock: { type: "mark", id: markRead(5) },
    },
    entries: [],
  },
  {
    n: 6,
    name: "A cisterna",
    layer: "Câmaras da Origem",
    layerShort: "Da Origem",
    decal: {
      id: "decalque-6",
      title: "O peso",
      echo: "“Se não eu, então tu.” Era o que Marta dizia.",
      inscription: "Não temas o fundo. Teme ficar.",
      body: [
        "Três ecos se sobrepõem na cisterna e, entre os pilares, já se vê lá embaixo o clarão da Brasa. Na parede há um aviso gravado.",
        "Marta é a mentora que criou a Acendedora: desceu na geração passada e voltou gasta demais para descer de novo. “Se não eu, então tu” era o que ela dizia.",
      ],
      art: "poco",
      unlock: { type: "mark", id: markRead(6) },
    },
    entries: [
      {
        id: "marta",
        category: "personagens",
        floor: 6,
        title: "Marta",
        lead: "A mentora da Acendedora.",
        body: [
          "Acendedora da geração passada. Criou a Acendedora. Voltou da sua descida gasta demais para tentar de novo e hoje morre de frio na superfície.",
          "“Se não eu, então tu.” É o que Marta dizia.",
        ],
        art: "marta",
        unlock: { type: "mark", id: markFloor(6) },
      },
      {
        id: "a-brasa",
        category: "lugares",
        floor: 6,
        title: "A Brasa",
        lead: "A chama no fundo de tudo.",
        body: [
          "A única luz e o único calor do mundo. Não é o sol: é uma chama física, num lugar físico, e pode apagar. Tudo o que vive, vive porque ela ainda arde.",
          "Não é eterna por natureza. Arde porque é alimentada, e hoje definha: faz tempo demais que ninguém renova a fagulha no fundo.",
        ],
        art: "brasa",
        unlock: { type: "mark", id: markFloor(6) },
      },
    ],
  },
  {
    n: 7,
    name: "A câmara da Brasa",
    layer: "A Brasa",
    layerShort: "A Brasa",
    decal: {
      id: "decalque-7",
      title: "A que ficou",
      echo: "No fundo, a primeira Acendedora ainda arde. E te esperava.",
      inscription: "Ela ainda guarda o fogo. Liberta-a, ou toma seu lugar.",
      body: [
        "No fundo, junto da Brasa, arde alguém. Ao ver a Acendedora, diz que esperou tanto que esqueceu o próprio nome, e pergunta o dela.",
        "A inscrição propõe duas saídas: libertá-la, ou tomar o seu lugar. A escolha é da Acendedora.",
      ],
      art: "guardia",
      unlock: { type: "mark", id: markRead(7) },
    },
    entries: [
      {
        id: "a-primeira",
        category: "personagens",
        floor: 7,
        title: "A Primeira",
        lead: "Aquela que guarda o fogo.",
        body: [
          "A primeira Acendedora, e o Guardião da Brasa. Desceu há gerações, venceu e reacendeu a chama. Descobriu então o preço: a Brasa só arde se alguém fica presa dentro dela, alimentando-a com a própria fagulha. Escolheu ficar, e o tempo a consumiu.",
          "Não atacou por maldade. Testou a Acendedora para saber se devia passar o fardo ou impedi-la de repetir o erro. Ao cair, sussurrou: “Vai. Acende a Brasa... e não a deixes sozinha, como eu fiquei.”",
        ],
        art: "guardia",
        unlock: { type: "mark", id: MARK_BOSS_DOWN },
      },
    ],
  },
];

// --- Derivados ---

/** Todos os nichos, por andar e na ordem em que o jogo os revela. */
export const CODEX_ENTRIES: CodexEntry[] = CODEX_FLOORS.flatMap((f) => f.entries);

/** Andares da descida (1 a 7), cada um com o seu decalque. */
export const CODEX_DESCENT: CodexFloor[] = CODEX_FLOORS.filter((f) => f.n >= 1);

/** Eco por andar (índice do DESCENT): a legenda ouvida ao entrar. Única fonte, usada por main.ts. */
export const FLOOR_ECHOES: string[] = CODEX_DESCENT.map((f) => f.decal?.echo ?? "");

/** Inscrição por andar (índice do DESCENT): o texto gravado na pedra. Única fonte, usada por main.ts. */
export const FLOOR_INSCRIPTIONS: string[] = CODEX_DESCENT.map((f) => f.decal?.inscription ?? "");

/** Quantas páginas (decalques + nichos) a Crônica tem no total. */
export const CODEX_TOTAL: { decals: number; entries: number } = {
  decals: CODEX_DESCENT.filter((f) => f.decal).length,
  entries: CODEX_ENTRIES.length,
};

/** Algo que sabe responder se uma marca já existe (um Set de ids, ou o CodexLog). */
export interface SeenMarks {
  has(id: string): boolean;
}

/** Liberado se nasce assim ou se a marca já está no save. */
export function isCodexUnlocked(item: { unlock: CodexUnlock }, seen: SeenMarks): boolean {
  return item.unlock.type === "always" || seen.has(item.unlock.id);
}

/** Contagem de páginas liberadas, para o cabeçalho da Crônica. */
export function codexProgress(seen: SeenMarks): { decals: number; entries: number } {
  return {
    decals: CODEX_DESCENT.filter((f) => f.decal && isCodexUnlocked(f.decal, seen)).length,
    entries: CODEX_ENTRIES.filter((e) => isCodexUnlocked(e, seen)).length,
  };
}

/** Algarismo romano (andares 1 a 7 da Parede). */
export function romanNumeral(n: number): string {
  const table: Array<[number, string]> = [
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let out = "";
  let rest = n;
  for (const [v, s] of table) {
    while (rest >= v) {
      out += s;
      rest -= v;
    }
  }
  return out || "0";
}

// --- Estado vivo (marcas vistas + o que acabou de ser liberado) ---

/**
 * As marcas que o jogador já viu, mais a lista do que foi liberado desde a última vez que a
 * Crônica foi aberta (para o papel cair e o nicho acender uma única vez). Só as marcas vão
 * para o save; o "novo" vive na sessão.
 */
export class CodexLog implements SeenMarks {
  private readonly seen = new Set<string>();
  private fresh = new Set<string>();

  constructor(ids: string[] = []) {
    for (const id of ids) this.seen.add(id);
  }

  has(id: string): boolean {
    return this.seen.has(id);
  }

  all(): string[] {
    return [...this.seen];
  }

  /** Recarrega tudo (trocar de slot, jogo novo). Não conta como "novo". */
  load(ids: string[]): void {
    this.seen.clear();
    this.fresh = new Set();
    for (const id of ids) this.seen.add(id);
  }

  /**
   * Registra uma marca. `added` diz se ela era nova (para gravar o save) e `titles` traz os
   * títulos das páginas que ela acabou de liberar, para o aviso "Nova página na Crônica".
   */
  mark(id: string): { added: boolean; titles: string[] } {
    if (this.seen.has(id)) return { added: false, titles: [] };
    this.seen.add(id);
    const titles: string[] = [];
    for (const f of CODEX_FLOORS) {
      const d = f.decal;
      if (d && d.unlock.type === "mark" && d.unlock.id === id) {
        this.fresh.add(d.id);
        titles.push(d.title);
      }
      for (const e of f.entries) {
        if (e.unlock.type === "mark" && e.unlock.id === id) {
          this.fresh.add(e.id);
          titles.push(e.title);
        }
      }
    }
    return { added: true, titles };
  }

  /** O que foi liberado desde a última abertura da Crônica (e zera a lista). */
  takeFresh(): Set<string> {
    const out = this.fresh;
    this.fresh = new Set();
    return out;
  }
}
