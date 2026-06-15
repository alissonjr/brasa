import type { ProgressionState } from "@platform";

/**
 * CAMADA JOGO (Brasa). Codex/Crônica: o registro de lore que o jogador acumula.
 * Personagens, lugares e relatos do mundo de Brasa, revelados conforme a descida
 * avança. É só CONTEÚDO + a regra de desbloqueio; o estado de quem já foi revelado é
 * DERIVADO da progressão (objetivos concluídos), então não precisa de persistência
 * própria. Base nas bíblias: docs/brasa/narrativa-e-historia.md, docs/brasa/personagens.md.
 */
export type CodexCategory = "personagens" | "lugares" | "relatos";

/** Como a entrada é desbloqueada: já nasce revelada, ou ao concluir um objetivo. */
export type CodexUnlock = { type: "always" } | { type: "objective"; objectiveId: string };

export interface CodexEntry {
  id: string;
  category: CodexCategory;
  title: string;
  /** Linha-resumo (subtítulo) mostrada na lista. */
  lead: string;
  /** Corpo do verbete (parágrafos separados por \n). */
  body: string;
  /** glb opcional para a vitrine 3D do verbete (personagem que gira, ou prop). */
  model?: string;
  unlock: CodexUnlock;
}

export const CODEX: CodexEntry[] = [
  // --- Personagens ---
  {
    id: "acendedora",
    category: "personagens",
    title: "A Acendedora",
    lead: "A última guardiã que ainda carrega o fogo.",
    body:
      "Acendedora não é nome, é função: a que mantém o fogo. A última delas guarda no peito " +
      "uma fagulha viva da Brasa, a chama que segura o reino inteiro contra o frio eterno. " +
      "Quando a luz começa a recuar poço abaixo, é ela quem desce, câmara por câmara, " +
      "reacendendo os braseiros que as anteriores deixaram apagar.\n" +
      "Não desce por glória, e já nem por esperança: desce porque foi a única que sobrou. Se " +
      "a Brasa apagar de vez, a superfície congela, as noites não terminam e os mortos sobem.\n" +
      "Carrega pouco: o manto, o cajado que guarda a fagulha na ponta, e o costume de não " +
      "olhar para trás. O escuro do poço é longo demais para se medir em coragem; mede-se em " +
      "quantos braseiros ainda dá para acender antes do frio chegar ao coração.",
    model: "/models/acendedora.glb",
    unlock: { type: "always" },
  },
  {
    id: "acendedoras-passadas",
    category: "personagens",
    title: "As Acendedoras anteriores",
    lead: "Vozes e inscrições deixadas na pedra.",
    body:
      "Antes dela, outras desceram. Algumas reacenderam a Brasa e voltaram grisalhas; outras " +
      "ficaram no escuro e viraram parte dele. O que restou são marcas riscadas na pedra, " +
      "braseiros meio acesos e ecos que ainda sussurram a quem tem ouvido para o passado.\n" +
      "\"Não confie na sala quente. O calor mente: é só a Brasa lembrando do que perdeu.\" " +
      "A inscrição segue, raspada fundo, perto do terceiro braseiro.\n" +
      "Outra, mais abaixo, é quase um pedido: \"Se você está lendo isto, eu não voltei. Acenda " +
      "assim mesmo. Acenda por mim.\" Não há assinatura. Nenhuma delas assinava; o título não " +
      "deixa espaço para nome.",
    model: "/models/Rogue_Hooded.glb",
    unlock: { type: "objective", objectiveId: "aproximar-braseiro" },
  },
  {
    id: "guardiao",
    category: "personagens",
    title: "O Guardião",
    lead: "O que vela a Brasa apagada no fundo.",
    body:
      "No fundo do poço, junto da Brasa moribunda, algo a vela. Não deixa que se apague de " +
      "vez, nem que se reacenda: prende a chama no exato limiar entre a vida e o frio, e ali " +
      "a segura há tempo demais para ter nome.\n" +
      "Dizem os ecos que ele já desceu como Acendedor, muito antes, e que chegou ao fundo " +
      "como todos chegam: tarde demais. Diante da Brasa apagando, não teve coragem de " +
      "reacendê-la nem de deixá-la morrer, e o limiar o prendeu junto com ela. Guardar virou " +
      "a única coisa que ainda sabe fazer.\n" +
      "Para reavivar a Brasa, a Acendedora terá de fazer o que ele não fez: escolher.",
    model: "/models/Skeleton_Warrior.glb",
    unlock: { type: "objective", objectiveId: "alcancar-fundo" },
  },

  // --- Lugares ---
  {
    id: "poco-cripta",
    category: "lugares",
    title: "O poço-cripta",
    lead: "A descida de pedra até a Brasa.",
    body:
      "Um poço fundo demais para o sol, escavado em câmaras seladas ao longo de gerações. " +
      "Cada andar foi fechado por uma porta de pedra; a luz só alcança uma câmara por vez, e " +
      "a passagem seguinte só cede a quem devolve calor à atual.\n" +
      "Não foi feito para descer, foi feito para guardar. Cada sala selada foi, um dia, um " +
      "túmulo ou um depósito de coisas que ninguém queria perto da superfície. A descida da " +
      "Acendedora é, no fundo, uma profanação necessária: abrir o que foi fechado para chegar " +
      "ao que foi escondido mais fundo de tudo.\n" +
      "Quanto mais fundo, mais frio, mais escuro, e mais perto da Brasa.",
    unlock: { type: "always" },
  },
  {
    id: "camara-guarda",
    category: "lugares",
    title: "A câmara de guarda",
    lead: "A primeira sala da descida.",
    body:
      "Logo abaixo da boca do poço, uma sala de pedra com um braseiro frio ao centro. Foi " +
      "feita para deter quem descia; agora, com o mundo invertido, detém o que sobe.\n" +
      "Acender o braseiro devolve a luz à câmara, empurra o azul para as bordas e destrava a " +
      "porta seguinte. É também a primeira lição da descida: aqui a luz não é conforto, é " +
      "chave. Toda porta do poço se abre com fogo, não com força.",
    unlock: { type: "objective", objectiveId: "entrar-cripta" },
  },
  {
    id: "a-brasa",
    category: "lugares",
    title: "A Brasa",
    lead: "A chama ancestral no fundo de tudo.",
    body:
      "No fundo do poço arde, ou agoniza, a Brasa: a chama que aquece o reino inteiro lá em " +
      "cima. Não é metáfora. É uma única brasa do tamanho de um punho, e dela depende cada " +
      "verão, cada colheita, cada noite que tem fim.\n" +
      "Ninguém sabe quem a acendeu primeiro, nem do quê. Sabe-se apenas que nunca pode apagar, " +
      "e que sozinha, sem quem a alimente, ela apaga. Por isso a ordem das Acendedoras; por " +
      "isso a descida; por isso tudo.\n" +
      "Reavivá-la é a razão da descida. E é mais difícil do que parece: uma brasa quase morta " +
      "não quer voltar a arder. Tem que ser convencida.",
    unlock: { type: "objective", objectiveId: "alcancar-fundo" },
  },

  // --- Relatos ---
  {
    id: "frio-eterno",
    category: "relatos",
    title: "O frio eterno",
    lead: "Por que o reino depende de uma só chama.",
    body:
      "Conta-se que o mundo lá fora morreria de frio se não fosse a Brasa, guardada no fundo " +
      "da terra desde antes da memória. As estações da superfície são, na verdade, o pulso " +
      "dessa chama: quando ela enfraquece, o gelo desce dos montes e as noites não terminam.\n" +
      "Os velhos da superfície não chamam de inverno. Chamam de \"o frio que lembra\", porque " +
      "diz a lenda que ele não é ausência de calor, e sim algo antigo e paciente que existia " +
      "antes do fogo e quer o mundo de volta como era: parado, branco, calado. A Brasa é a " +
      "única coisa que um dia disse não.",
    unlock: { type: "always" },
  },
  {
    id: "despertar-dos-mortos",
    category: "relatos",
    title: "O despertar dos mortos",
    lead: "O que o escuro acorda nas câmaras.",
    body:
      "Os que foram selados nas câmaras dormiam enquanto havia luz. Conforme a Brasa recua, o " +
      "escuro toma cada sala e eles se erguem, sem rosto e sem descanso, repetindo gestos de " +
      "uma vida que já esqueceram.\n" +
      "Não são malvados; são frios. Atacam quem traz calor pelo mesmo motivo que a mariposa " +
      "busca a chama: porque é a única coisa que ainda sentem. A luz do braseiro os detém; a " +
      "fagulha da Acendedora os enfrenta. Cair para eles não é morrer, é esfriar, e quem " +
      "esfria no poço levanta junto na próxima vez que o escuro passar.",
    model: "/models/Skeleton_Minion.glb",
    unlock: { type: "objective", objectiveId: "aproximar-braseiro" },
  },

  {
    id: "a-fagulha",
    category: "relatos",
    title: "A fagulha",
    lead: "A única luz que desce com ela.",
    body:
      "A fagulha é um pedaço vivo da própria Brasa, confiado a cada Acendedora no dia em que " +
      "assume o título. Cabe na mão, pesa menos que uma moeda e nunca apaga enquanto a " +
      "portadora respira.\n" +
      "Enquanto a sala está fria, ela é o único ponto quente num mar de azul: é por isso que " +
      "os mortos a procuram e é por isso que a Acendedora nunca está totalmente no escuro. " +
      "Dela vem o golpe de fogo, a luz que reacende os braseiros e o teimoso lembrete de que " +
      "o frio ainda não venceu.\n" +
      "Dizem que, quando uma Acendedora morre longe da Brasa, a fagulha não morre com ela: " +
      "espera, na pedra, a próxima mão.",
    unlock: { type: "always" },
  },
  {
    id: "os-braseiros",
    category: "lugares",
    title: "Os braseiros",
    lead: "As fogueiras que destravam a descida.",
    body:
      "Em cada câmara há um braseiro, posto ali pelas primeiras Acendedoras como degraus de " +
      "luz para quem viesse depois. Aceso, ele transforma a sala: o azul recua, a porta de " +
      "pedra cede e, por um instante, o poço lembra o que é ser quente.\n" +
      "Acender um braseiro é também o respiro da descida: a sala limpa, a Brasa um pouco mais " +
      "perto e a chance de fortalecer a fagulha antes do próximo escuro. Quem desce aprende a " +
      "contar a jornada não em salas, mas em braseiros: cada um aceso é uma promessa de que " +
      "ainda dá para ir mais fundo.",
    unlock: { type: "objective", objectiveId: "entrar-cripta" },
  },
];

export const CODEX_CATEGORIES: CodexCategory[] = ["personagens", "lugares", "relatos"];

/** Uma entrada está revelada se nasce assim ou se seu objetivo já foi concluído. */
export function isCodexUnlocked(entry: CodexEntry, state: ProgressionState): boolean {
  if (entry.unlock.type === "always") return true;
  return state.objectivesDone.includes(entry.unlock.objectiveId);
}

export function codexByCategory(category: CodexCategory): CodexEntry[] {
  return CODEX.filter((e) => e.category === category);
}

/** Quantas entradas já foram reveladas / total (para o cabeçalho da Crônica). */
export function codexUnlockedCount(state: ProgressionState): { unlocked: number; total: number } {
  return { unlocked: CODEX.filter((e) => isCodexUnlocked(e, state)).length, total: CODEX.length };
}
