# Guia de Estilo e Glossário: Brasa

Documento normativo do editor-chefe / loremaster de Brasa. Garante consistência de
escrita, voz, nomes e terminologia conforme o conteúdo cresce (lore, fichas, specs, UI,
texto de tela, localização). Em caso de conflito entre documentos, este guia prevalece
para questões de grafia, voz e marcação; para conteúdo narrativo, ver
[`narrativa-e-historia.md`](narrativa-e-historia.md); para o canon de premissa e mundo,
ver [`../projeto-brasa.md`](../projeto-brasa.md).

Brasa é uma IP original (dungeon crawler de fantasia low-poly). Não há texto sagrado nem
fonte histórica a respeitar: toda a ficção é nossa. Por isso a marcação de PROCEDÊNCIA é
a adaptada à IP original (seção sobre marcações abaixo): `[DESIGN]` (decisão criativa
nossa), `[CÓDIGO]` (observado no código-fonte do protótipo) e `[ASSET]` (procede de um
pacote de asset CC0 existente). A marcação de EXIGÊNCIA (`[NORMATIVO]`, `[ASPIRACIONAL]`,
`[A DEFINIR]`) é ortogonal e está definida em
[`../padrao-de-detalhe.md`](../padrao-de-detalhe.md). Use as duas em conjunto (ex.:
`[DESIGN][NORMATIVO]`).

Snapshot: 2026-06-14.

---

## 1. Guia de estilo de escrita

### 1.1 Idioma e base
- Idioma de autoria: pt-BR. A localização EN entra depois (seção 6).
- Texto exibido ao jogador: COM acentuação correta. Ids internos (knots, variáveis,
  arquivos, chaves de i18n): SEM acento, em snake_case (seção 3).
- Brasa é IP original: a grafia de nomes próprios é DEFINIDA por nós, não herdada de
  tradição alguma. A lista canônica da seção 7 decide. Ao criar um termo novo, registrar
  aqui antes de usar em qualquer texto, para não gerar variantes.

### 1.2 Regras invioláveis de pontuação e símbolos
- NUNCA usar travessão (—) nem meia-risca / en-dash (–). Em NADA: diálogo, narração,
  cartões de texto, UI, comentários de código, nomes de commit, issues, este e qualquer
  documento. No lugar, usar hífen (-), dois-pontos (:), vírgula (,) ou parênteses ( ),
  conforme o caso.
  - Aposto / inciso: usar vírgulas ou parênteses.
    - Certo: "A Acendedora, a última que restou, desceu ao escuro."
    - Errado: "A Acendedora — a última que restou — desceu ao escuro."
  - Pausa dramática / corte de pensamento: usar reticências (...) ou ponto final.
    - Certo: "A Brasa... ainda respira."
    - Errado: "A Brasa — ainda respira."
  - Intervalos e ligações: usar hífen sem espaço.
    - Certo: "5-7 salas", "frio-azul contra laranja-quente".
    - Errado: "5 — 7 salas".
  - Fala interrompida em diálogo: reticências, nunca travessão.
    - Certo: "Se a luz recuar mais, então..."
    - Errado: "Se a luz recuar mais, então —"
- NUNCA usar emojis. Em nada (diálogo, narração, UI, docs, commits, nomes de asset,
  mensagens de tela). Um braseiro aceso é luz na cena, nunca um emoji de fogo no texto.
- Aspas: usar aspas duplas retas (") para citação / fala dentro de narração; aspas simples
  para citação dentro de citação. Não usar aspas curvas tipográficas em texto de jogo
  (evita problemas de fonte / encoding); em documentos, manter padrão simples e
  consistente.
- Hífen é o único traço permitido. Em faixas numéricas, hífen sem espaço (1-2 luzes,
  100-400 tris). Nunca usar travessão em faixas.

### 1.3 Tom de voz (geral)
- Classificação Teen. Tom MÍTICO e SÓBRIO: melancólico, mas com esperança. Não é horror
  de sustos baratos nem grimdark niilista. É a vigília solitária de quem desce ao escuro
  para reacender uma chama que pode salvar a superfície. A morte é presença constante e
  digna, nunca gore gratuito.
- Registro: elevado mas legível. Frases curtas e de peso na narração; cadência de fábula
  ou lenda contada à beira do fogo. Evitar arcaísmo gratuito (sem mesóclise, sem "haveis
  de"): o sabor mítico vem do ritmo, das imagens (frio, brasa, descida, pedra) e da
  economia de palavras, não de português antigo.
- Pouca fala, muito silêncio. Brasa é um jogo de poucas palavras: a luz, a pedra e o som
  contam mais que diálogo. Quando o texto fala, fala pouco e devagar. O escuro não é
  preenchido com tagarelice.
- Esperança contida. Mesmo no andar mais frio, há sempre a fagulha. O tom nunca cai em
  desespero total nem em deboche. A Acendedora persiste; o jogo persiste com ela.
- Respeito aos mortos. Os mortos despertos não são monstros para zombar. Foram gente,
  selados ali por gerações. A narração os trata com gravidade, não com nojo nem chacota.
  Vencê-los é devolvê-los ao repouso, não "exterminar bichos".

### 1.4 Como narrar a lore
- A lore de Brasa se revela por GOTAS, não por paredões de texto. Inscrições em pedra,
  uma linha de narração ao acender um braseiro, o nome de uma câmara, o estado de um
  corpo. O jogador monta o passado; o jogo não o despeja.
- Mostrar pela cena antes de contar pela palavra: uma sala mais fria, um braseiro há mais
  tempo apagado, ossos mais antigos quanto mais fundo se desce. A descida é o próprio
  texto.
- A narração é em terceira pessoa, sóbria, atemporal, levemente litúrgica. Observa sem
  sentenciar; guarda o pudor (elipse) nos momentos duros (ver 1.6). Não faz piada, não
  julga, não usa gíria. Modelo de tom: "Cada porta que se sela é uma escolha que não tem
  volta. A Acendedora segue descendo."
- O passado fala por enigma e fragmento, nunca por exposição completa. Quem selou as
  câmaras, por que a Brasa morre, quem foi o Guardião: revelar o suficiente para dar peso,
  guardar o bastante para dar mistério. Onde o canon ainda não decidiu, marcar
  `[A DEFINIR]` e não inventar à toa em texto de jogo.

### 1.5 Registro de diálogo
Brasa tem pouquíssimas vozes. Defina cada uma e não as misture.

- A Acendedora (voz interior, sóbria e resoluta): fala pouco, quase só consigo mesma ou
  com o fogo. Tom de vigília: cansada mas firme, sem autopiedade. Frases curtas. Não
  bravateia, não chora, não explica demais. `[DESIGN]` `[A DEFINIR]`: definir se a
  Acendedora tem voz audível (linhas faladas) ou se é silenciosa e só a narração a
  acompanha. Recomendação: silenciosa ou quase, com raras linhas de peso, coerente com
  "pouca fala, muito silêncio" (1.3).
- Vozes do passado (eco, inscrição, sussurro): quem selou as câmaras, antigas Acendedoras,
  o Guardião antes de cair. Registro de lenda gravada: solene, fragmentário, às vezes em
  segunda pessoa dirigida a quem desce ("Tu que carregas a fagulha, não a deixes apagar").
  Sempre econômico e enigmático; nunca tagarela, nunca moderno, nunca explica a mecânica
  com todas as letras.
- O Guardião (chefe): voz grave, antiga, de quem foi guardião e foi esquecido. Não é vilão
  cuspindo ameaças: é gravidade e luto. Pode falar pouco antes ou durante o combate. Tom
  de quem cumpre um dever amargo, não de quem odeia.
- A narração não é personagem: nunca dialoga, nunca opina em primeira pessoa, nunca quebra
  a quarta parede.

Como manter a consistência de fala:
- Antes de escrever uma linha, pergunte: "isto soaria gravado em pedra fria, ou soaria
  num bate-papo?" Em Brasa, só o primeiro serve.
- Nenhuma voz faz piada, gíria ou ironia leve. O humor não tem lugar no tom mítico-sóbrio
  de Brasa (diferença deliberada em relação a projetos com alívio cômico).
- Teste de uma linha: se a fala pudesse vir de um jogo de fantasia genérico qualquer,
  reescreva até soar de Brasa (fogo, frio, descida, pedra, vigília).

### 1.6 O escuro, os mortos e a violência por elipse
- O escuro é a ameaça central, tratado com respeito e não como susto barato. Sem jump
  scares baratos, sem estética de terror trash. O medo de Brasa é o medo do frio que
  avança e da luz que recua, não o de um monstro pulando na cara.
- Os mortos despertos: combate sóbrio. Ao serem vencidos, retornam ao repouso (dissolvem,
  tombam, viram pó iluminado pela brasa), NUNCA explodem em sangue. Ver técnica de
  dissolução em [`biblia-vfx-e-shaders.md`](biblia-vfx-e-shaders.md).
- Violência (Teen): sem gore, sem desmembramento, sem sangue em jato, sem agonia
  prolongada. Esqueletos não sangram; o golpe decisivo se lê por som, reação e
  dissolução, não por ferida. Combate é coreografia, não açougue.
- Elipse nos momentos duros: o que for pesado demais (a origem do selamento das câmaras,
  o destino do Guardião) se narra por sugestão, fragmento e silêncio. "Alguns silêncios o
  jogo guarda para si."
- O fim é esperança, não triunfo macabro: acender a Brasa é devolver calor à superfície e
  repouso aos mortos, não vencer uma guerra.

### 1.7 Capitalização de termos de Brasa
- Maiúscula inicial (nomes próprios e conceitos únicos do mundo): Brasa (a chama
  ancestral), Acendedora (o papel / título da heroína), Guardião (o chefe), Fagulha
  (quando for a fagulha sagrada que a Acendedora carrega, ver verbete).
- Minúscula (substantivos comuns, mesmo que centrais): braseiro, poço-cripta, câmara,
  sala, porta de pedra, mortos despertos, esqueleto, frio eterno, descida, tocha, baú,
  pilar. São coisas do mundo, não nomes próprios.
- Casos de fronteira (decididos para não derivar):
  - "a Brasa" (maiúscula) é a chama ancestral única no fundo do poço. "brasa" / "brasas"
    (minúscula) são brasas comuns de um braseiro. No texto de jogo, quase sempre é a
    primeira: na dúvida, é A Brasa.
  - "fagulha" em geral é minúscula (faísca de fogo); "Fagulha" maiúscula só quando for o
    recurso / dádiva que a Acendedora carrega e gasta. Ver verbete fagulha / Fagulha.
  - "Guardião" maiúscula quando é o chefe (o Guardião da Brasa apagada); "guardião"
    minúscula em sentido comum ("foi guardião daquele andar").
- Cargos e funções genéricas: minúscula (a guardiã, o morto, o esqueleto), salvo quando
  viram título fixo de personagem em ficha.

### 1.8 Números e medidas
- Números por extenso de zero a dez em texto narrativo; algarismos a partir de 11.
  Exceções: contagens dramáticas podem ir por extenso para ritmo ("sete câmaras a
  descer"); UI, specs e fichas usam algarismos.
- Números de design / técnicos (salas, tris, draw calls, fps): sempre algarismos em specs
  e fichas (5-7 salas, < 60 draw calls, 60 fps). Faixas com hífen sem espaço.
- Sem datas históricas reais em Brasa (mundo de fantasia atemporal). Se a lore precisar de
  cronologia interna, usar termos do mundo ("gerações atrás", "antes do frio") e não
  calendário real; marcar `[A DEFINIR]` o que faltar decidir.
- Horas e duração de UI: algarismos.

---

## 2. Voz de cada voz (guia rápido para roteiristas)

Resumo de 1-2 linhas por voz, para abrir qualquer sessão de escrita. Detalhe completo em
[`personagens.md`](personagens.md) e [`narrativa-e-historia.md`](narrativa-e-historia.md).
Brasa é deliberadamente parca em vozes: este é o elenco quase inteiro.

- A Acendedora (vigília sóbria e resoluta): fala pouco, quase só consigo ou com o fogo.
  Cansada mas firme, sem autopiedade, sem bravata. Frases curtas. Ex. (se tiver voz):
  "Mais uma porta. Mais um braseiro." `[A DEFINIR]`: voz audível vs. silenciosa.
- Vozes do passado (lenda gravada): solenes, fragmentárias, enigmáticas, às vezes em
  segunda pessoa dirigidas a quem desce. Nunca tagarelas, nunca modernas. Ex.: "Tu que
  carregas a fagulha, não a deixes apagar."
- O Guardião (gravidade e luto): voz antiga e grave, de dever amargo, não de ódio. Fala
  pouco, no momento certo. Ex.: "Eu guardei o que sobrou. Vai ver o que sobrou de mim."
- Narrador (voz atemporal das pedras): terceira pessoa, sóbrio, levemente litúrgico,
  observa sem sentenciar, guarda o pudor nos momentos duros. Não faz piada, não opina, não
  usa gíria. Ex.: "A porta se sela. A sala respira no escuro, à espera da fagulha."

Como manter a consistência:
- Releia estes resumos antes de escrever. Pergunte: "esta linha soaria nesta voz?"
- Não troque registros: o Guardião não é tagarela; a narração não opina; nenhuma voz faz
  piada.
- Em Brasa, na dúvida entre falar e calar, calar. O silêncio é parte do tom.

---

## 3. Convenções técnicas de nomes

Princípio mestre: separar o que a MÁQUINA lê do que o JOGADOR lê.

### 3.1 Ids internos (código, dados, conteúdo)
- Ids de sala, de andar, de inimigo, de prop, de upgrade, variáveis de estado, nomes de
  arquivo: snake_case, SEM acento, ASCII puro, em pt-BR sem diacrítico. Ex.:
  `acendedora`, `guardiao`, `poco_cripta`, `camara_de_guarda`, `braseiro`, `porta_pedra`,
  `morto_desperto`, `esqueleto`, `fagulha`, `descida`, `frio_eterno`.
- Sem espaços, sem maiúsculas, sem hífen em ids (hífen só em texto exibido). Sem ç, sem
  til, sem acento: "Acendedora" vira `acendedora`; "Guardião" vira `guardiao`;
  "poço-cripta" vira `poco_cripta`; "câmara" vira `camara`.
- Booleanos de estado: prefixo de ação no passado ou predicado claro: `acendeu_*`,
  `selou_*`, `derrotou_*`, `tem_*`, `entrou_*`. Ex.: `acendeu_braseiro_andar3`,
  `derrotou_guardiao`.
- Enums em string: valores também snake_case sem acento (ex.: tipo_sala =
  "camara_de_guarda" | "corredor" | "cisterna" | "santuario" | "camara_do_guardiao").

### 3.2 Texto exibido (nomes de tela, narração, UI)
- COM acentuação e pontuação corretas em pt-BR. Ex.: nome de exibição "Acendedora",
  "Guardião da Brasa", "Câmara de Guarda", "Santuário do Braseiro".
- Manter o par estável: cada elemento tem UM id interno (snake_case sem acento) e UM nome
  de exibição (legível, acentuado). Um termo = um id + um nome de exibição.

### 3.3 Nomes de asset
- Padrão: `categoria_nome_variante` em snake_case sem acento. Coerente com os pacotes CC0
  do canon (KayKit Dungeon, Skeletons, Adventurers). Ex.: `wall_straight`, `floor_tile`,
  `door_stone`, `brazier`, `chest`, `barrel`, `torch`, `pillar`, `trap_spikes`.
- Personagens / modelos: usar o id como raiz (ex.: `acendedora`, `guardiao`, `skeleton`,
  `skeleton_warrior`). Modelos KayKit já em disco mantêm seu nome de origem (`Mage.glb`,
  `Rogue_Hooded.glb`, `AnimationLibrary_Godot_Standard.gltf`); ao re-apontar para a
  Acendedora, documentar o vínculo, não renomear o arquivo CC0 sem necessidade.
- Sufixos úteis: forma (`_square`, `_round`), estado (`_lit`, `_unlit`, `_rubble`,
  `_broken`), variante (`_a`, `_b`), LOD (`_lod0`).

### 3.4 Chaves de localização (i18n)
- Formato hierárquico com ponto, snake_case sem acento, minúsculas:
  `escopo.subescopo.chave`. Ex.: `ui.hud.fagulha`, `ui.menu.continuar`,
  `lore.glossario.brasa.titulo`, `lore.glossario.brasa.def`,
  `narracao.andar1.entrada`, `narracao.braseiro.acende`.
- A chave NUNCA muda quando o texto muda (a chave é id; o valor é o texto traduzível). Não
  colocar conteúdo na chave (evitar `ui.botao_descer_agora`); usar id semântico estável.
- Uma chave por idioma-base; o valor pt-BR é a referência; o EN herda a mesma chave.
- Pluralização e variáveis: placeholders nomeados ({n}, {sala}), nunca concatenar frases
  (quebra a tradução). Marcar onde há gênero / plural para a localização tratar. Atenção:
  "Acendedora" é feminino; preservar concordância nas chaves que se refiram a ela.

---

## 4. Glossário canônico de Brasa

Glossário NORMATIVO de termos do mundo de Brasa. Ordem alfabética. Cada verbete traz:
definição, grafia preferida (maiúscula / minúscula), o que NÃO dizer, e exemplo de uso. A
forma canônica aqui padroniza todo o corpus: lore, fichas, specs, UI, i18n. Ao introduzir
um termo novo, adicione um verbete aqui antes de usá-lo em qualquer texto. Marcação de
procedência entre colchetes (`[DESIGN]` para invenções nossas, `[ASSET]` quando o termo
nomeia uma peça de pacote CC0).

- Acendedora [DESIGN]: o papel e título da heroína jogável, a última guardiã que ainda
  carrega uma fagulha do fogo; desce o poço-cripta para reacender os braseiros e reavivar
  a Brasa. Grafia: maiúscula sempre (é título / nome de papel). Feminino: "a Acendedora",
  "a última Acendedora". Id interno: `acendedora`. NÃO dizer: "acendedor" (é mulher, é
  feminino), "a heroína" no texto de jogo (usar Acendedora), "a maga" / "a ladina" (são
  os modelos CC0 de origem, não o nome no mundo). Exemplo de uso: "A Acendedora cruza a
  porta e a pedra se fecha às suas costas."

- braseiro [DESIGN][ASSET]: a estrutura de fogo no centro de cada sala; acendê-lo
  (interação, após limpar a sala) acende a luz quente, concede recurso / upgrade e
  destrava a porta de saída. Grafia: minúscula (substantivo comum). Plural: braseiros. Id
  interno: `braseiro`. Estados de asset: `_unlit` (apagado, luz fria) e `_lit` (aceso, luz
  quente). NÃO dizer: "fogueira" (é estrutura de pedra / metal, não lenha ao relento),
  "altar" (não é objeto de culto), "tocha" (tocha é o item de parede menor, ver tocha).
  Exemplo de uso: "Com a sala limpa, o braseiro aceita a fagulha e a luz fria vira quente."

- Brasa [DESIGN]: a chama ancestral que arde no fundo do poço-cripta, fundo demais para a
  luz do sol alcançar; enquanto arde, a superfície tem calor e vida. Está morrendo, e por
  isso os mortos despertam no escuro. Grafia: maiúscula sempre quando for A chama
  ancestral (que é quase sempre, e dá nome ao jogo). "brasa" / "brasas" minúscula só para
  brasas comuns de um braseiro qualquer. Id interno: `brasa`. NÃO dizer: "a chama sagrada"
  como nome (descrever pode, nomear é Brasa), "o fogo eterno" (o eterno é o frio, ver frio
  eterno), "a tocha-mãe". Exemplo de uso: "A Brasa ainda arde, mas a luz recua poço abaixo
  a cada geração."

- câmara [DESIGN]: cada andar selado do poço-cripta, uma sala de pedra fechada por porta
  de pedra; sinônimo prático de "sala" no contexto da cripta. Grafia: minúscula. Plural:
  câmaras. Id interno: `camara`. Usar "câmara" para o sentido de andar selado / unidade da
  descida (Câmara de Guarda, Câmara do Guardião como nomes de tipo levam maiúscula por
  serem rótulos de tipo de sala); usar "sala" para a unidade de jogo / técnica (uma sala
  carregada por vez). NÃO dizer: "quarto", "cômodo", "nível" (nível é vocabulário de UI /
  RPG, não do mundo), "masmorra" (ver poço-cripta / cripta). Exemplo de uso: "Cada câmara
  se sela atrás da Acendedora; só o braseiro devolve a luz."

- cripta [DESIGN]: o conjunto subterrâneo de câmaras seladas que forma o cenário do jogo;
  forma curta de poço-cripta. Grafia: minúscula. Id interno: `cripta`. NÃO dizer:
  "dungeon" (é o nome do pacote de asset, não do mundo: dizer cripta no texto de jogo),
  "calabouço", "masmorra" (não é prisão), "catacumba" como nome fixo (descrever pode).
  Exemplo de uso: "A cripta desce em câmaras, cada uma mais fria que a anterior."

- descida [DESIGN]: o ato e a estrutura de descer o poço-cripta câmara por câmara, do topo
  ao fundo; é a forma e o arco do jogo. Grafia: minúscula. Id interno: `descida`. NÃO
  dizer: "campanha", "fase" (no sentido de level externo), "run" / "corrida" no texto de
  jogo (run pode em jargão de design interno, não em narração). Exemplo de uso: "A descida
  termina na câmara do Guardião, no fundo, junto à Brasa."

- fagulha / Fagulha [DESIGN]: a faísca de fogo que a Acendedora carrega e usa para acender
  os braseiros; o recurso central de progressão. Grafia: "fagulha" minúscula em uso geral
  (faísca de fogo, a chama que ela leva na mão); "Fagulha" maiúscula apenas quando for o
  recurso / dádiva nomeado da mecânica (HUD, ficha). Na dúvida em texto de jogo, minúscula.
  Id interno: `fagulha`. NÃO dizer: "faísca" como nome fixo (descrever pode), "centelha"
  como nome, "mana" / "energia" (jargão genérico que mata o tom). Exemplo de uso: "Resta
  uma fagulha na palma da Acendedora; basta uma para reacender um braseiro."

- frio eterno [DESIGN]: a ameaça que avança quando a Brasa enfraquece; o congelamento da
  superfície e o avanço do escuro poço abaixo. Grafia: minúscula (não é nome próprio).
  Id interno: `frio_eterno`. NÃO dizer: "inverno eterno" (evitar a colisão com IPs
  famosas), "a Geada" como entidade nomeada (o frio é condição, não personagem), "as
  trevas eternas". Exemplo de uso: "Se a Brasa apagar, o frio eterno toma a superfície e
  o escuro sobe."

- Guardião [DESIGN]: o chefe da descida, o Guardião da Brasa apagada, no fundo do poço;
  voz antiga e grave, de dever amargo, não de ódio. Vencê-lo e acender a Brasa fecha o
  vertical slice. Grafia: maiúscula quando é o chefe (o Guardião); minúscula em sentido
  comum ("foi guardião daquele andar"). Id interno: `guardiao`. NÃO dizer: "o boss" (no
  texto de jogo; boss só em jargão de design), "o vilão" / "o inimigo final" como nome,
  "o monstro" (não é monstro genérico, é tragédia). Exemplo de uso: "No fundo, o Guardião
  espera, fiel a um dever que já não tem volta."

- mortos despertos [DESIGN]: os mortos selados nas câmaras ao longo de gerações, que
  despertam no escuro conforme a luz recua; o conjunto dos inimigos da cripta. Grafia:
  minúscula. Singular: "morto desperto". Id interno: `morto_desperto`. NÃO dizer:
  "zumbis" (registro errado, moderno e trash), "mortos-vivos" (aceitável em descrição
  técnica, mas preferir "mortos despertos" no texto de jogo), "monstros". Exemplo de uso:
  "Quando a luz recua, os mortos despertos se levantam da pedra fria."

- poço-cripta [DESIGN]: o poço vertical de pedra, fundo demais para o sol, no fundo do
  qual arde a Brasa; o mundo inteiro do jogo, dividido em câmaras seladas. Grafia:
  minúscula, com hífen (poço-cripta), nunca travessão. Forma curta: cripta ou "o poço".
  Id interno: `poco_cripta`. NÃO dizer: "poço cripta" (sem hífen), "poço/cripta", "abismo"
  como nome fixo, "fosso". Exemplo de uso: "A Brasa arde no fundo do poço-cripta, onde a
  luz do sol nunca chegou."

- porta de pedra (selada) [DESIGN][ASSET]: a porta de pedra que fecha cada câmara; sela-se
  atrás da Acendedora ao entrar e só destrava quando o braseiro da sala é aceso. Grafia:
  minúscula ("porta de pedra"; "porta selada" quando o foco é o estado). Id interno:
  `porta_pedra`. Estados de asset: `door_stone_sealed` / `door_stone_open`. NÃO dizer:
  "portão" (portão é grande / duplo; aqui é porta), "comporta", "laje" (a laje é genérica).
  Exemplo de uso: "A porta de pedra se sela atrás dela; só a luz do braseiro a abrirá."

- sala [DESIGN][CÓDIGO]: a unidade de jogo e técnica: o espaço carregado de cada vez, com
  no máximo UMA sala ativa por vez (a anterior é descartada ao avançar). No mundo, uma
  sala é uma câmara; em design / código, "sala" é a palavra padrão. Grafia: minúscula.
  Plural: salas. Id interno: `sala`. Tipos de sala (rótulos, maiúscula): Câmara de Guarda,
  Corredor / Antecâmara, Cisterna / Salão, Santuário do Braseiro, Câmara do Guardião. NÃO
  dizer: "mapa", "level" / "nível" como sinônimo de sala. Exemplo de uso: "Só uma sala
  vive por vez; cruzar a porta apaga a anterior e acende a próxima."

- esqueleto [DESIGN][ASSET]: o inimigo comum, principal forma dos mortos despertos; malha
  KayKit Skeleton instanciada, esqueleto único compartilhado. Grafia: minúscula. Plural:
  esqueletos. Id interno: `esqueleto` (asset `skeleton`, variantes `skeleton_warrior`
  etc.). NÃO dizer: "caveira" (caveira é só o crânio), "ossada" como nome do inimigo,
  "zumbi". Exemplo de uso: "Dois esqueletos se erguem na penumbra da câmara de guarda."

- tocha [DESIGN][ASSET]: a luz menor de parede, prop de ambientação e leitura de espaço,
  distinta do braseiro central. Grafia: minúscula. Id interno: `tocha` (asset `torch`).
  NÃO dizer: "braseiro" (o braseiro é a estrutura central interativa; a tocha é prop de
  parede), "lampião". Exemplo de uso: "Tochas mortas pontilham o corredor, esperando uma
  fagulha que talvez não venha."

Termos próximos já em uso (não centrais, mas padronizados para evitar deriva):
- baú [ASSET]: prop de recompensa (asset `chest`). Minúscula. NÃO dizer "cofre", "arca".
- barril [ASSET]: prop de cenário (asset `barrel`). Minúscula.
- pilar [DESIGN][ASSET]: coluna de cobertura nas salas de pico de combate (asset
  `pillar`). Minúscula. NÃO dizer "coluna" alternando: usar pilar.
- armadilha [DESIGN][ASSET]: perigo de cenário (espinhos, etc.; asset `trap_*`). Minúscula.
- superfície [DESIGN]: o mundo de cima, que tem calor e vida enquanto a Brasa arde, e que
  congela se ela apagar. Minúscula. NÃO dizer "o reino de cima" como nome fixo.
- vertical slice [DESIGN]: jargão de produção (a fatia jogável de 5-7 salas + chefe + acender
  a Brasa). Manter em inglês em docs de processo; NÃO usar em texto de jogo.

---

## 5. Padrão de grafia: nomes e termos de Brasa

Lista canônica. Como Brasa é IP original, NÃO há tradição externa a seguir: a forma à
esquerda é a oficial e qualquer variante à direita é proibida em texto novo. Em texto
exibido, sempre a forma canônica acentuada; o id interno deriva dela sem acento (seção 3).

### 5.1 Conceitos e lugares do mundo
- Brasa (a chama ancestral; não "a Chama", "o Fogo Eterno"). Id: `brasa`.
- poço-cripta (com hífen; não "poço cripta", "poço/cripta", "abismo"). Id: `poco_cripta`.
- cripta (forma curta; não "dungeon", "masmorra", "calabouço" em texto de jogo). Id:
  `cripta`.
- câmara (não "quarto", "cômodo", "nível"). Id: `camara`.
- sala (unidade de jogo / técnica; não "mapa", "level"). Id: `sala`.
- braseiro (não "fogueira", "altar"). Id: `braseiro`.
- porta de pedra (não "portão", "comporta"). Id: `porta_pedra`.
- fagulha / Fagulha (não "faísca", "centelha", "mana"). Id: `fagulha`.
- descida (não "campanha", "run" em texto de jogo). Id: `descida`.
- frio eterno (não "inverno eterno", "a Geada"). Id: `frio_eterno`.
- superfície (não "o reino de cima"). Id: `superficie`.

### 5.2 Vozes e seres
- Acendedora (feminino, título / papel; não "acendedor", "a heroína", "a maga"). Id:
  `acendedora`.
- Guardião (o chefe; não "o boss", "o vilão", "o monstro" em texto de jogo). Id:
  `guardiao`.
- mortos despertos (não "zumbis", "monstros"). Id: `morto_desperto`.
- esqueleto (não "caveira", "ossada", "zumbi"). Id: `esqueleto` (asset `skeleton`).
- tocha (não "lampião"). Id: `tocha` (asset `torch`).
- baú (não "cofre", "arca"). Id: `bau` (asset `chest`).

Princípio: ao introduzir um nome novo de Brasa, defina a grafia aqui (e o verbete na seção
4) ANTES de usar em qualquer texto, para não criar variantes. Em IP original, somos a
única fonte de verdade: a inconsistência só pode vir de nós.

---

## 6. Notas de localização (PT -> EN)

### 6.1 O que NUNCA traduzir
- Ids internos (de sala, inimigo, prop, upgrade, variáveis, chaves de i18n, nomes de
  asset) NUNCA mudam por idioma. São neutros e permanentes; só o VALOR do texto muda.
- Nomes de asset CC0 de origem (`Mage.glb`, `Rogue_Hooded.glb`,
  `AnimationLibrary_Godot_Standard.gltf`, peças do Dungeon / Skeletons pack) são neutros e
  fixos.

### 6.2 Tabela-espelho de nomes (PT <-> EN)
Como Brasa é IP original, definimos nós o par fixo de cada nome. Nunca deixar o tradutor
improvisar. Proposta `[DESIGN]` (ratificar):
- Brasa <-> Ember (a chama ancestral; manter "Brasa" como possível nome próprio da IP, ou
  traduzir para "the Ember": `[A DEFINIR]` se o título do jogo se internacionaliza ou se
  "Brasa" vira nome próprio invariável como marca).
- Acendedora <-> Kindler (feminino; the Kindler / the last Kindler).
- Guardião <-> Warden (the Warden of the dead Ember).
- poço-cripta <-> the crypt-well (ou the deep crypt). `[A DEFINIR]` forma final.
- braseiro <-> brazier.
- fagulha / Fagulha <-> spark / Spark.
- mortos despertos <-> the woken dead.
- esqueleto <-> skeleton. frio eterno <-> the eternal cold.
- câmara <-> chamber. sala <-> room. descida <-> the descent.
- porta de pedra <-> stone door. tocha <-> torch.

Registrar o par definitivo aqui antes da fase de localização; cada nome com par fixo
PT<->EN, sem improviso.

### 6.3 Comprimento de texto e UI
- EN costuma ser mais curto que PT (-15% a -20% em média), mas labels de UI podem inverter.
  Reservar folga: botões e HUD com no mínimo +30% de largura sobre o texto pt-BR mais
  longo.
- Nunca embutir texto em texturas / sprites de UI: tudo via chave de i18n para permitir
  re-layout por idioma.
- Caixas de narração: projetar para o texto pt-BR (geralmente o mais longo) e prever quebra
  / rolagem; não cortar a linha de lore.
- Evitar concatenação de strings e ordem fixa de palavras; usar placeholders nomeados ({n},
  {sala}). Preservar concordância de gênero (Acendedora é feminino em pt-BR).

### 6.4 Tom na tradução
- O registro mítico-sóbrio (seção 1.3) vale em qualquer idioma. A tradução EN deve soar de
  lenda gravada, não de fantasia genérica. Frases curtas, economia, sem gíria, sem humor.
- Inscrições no MUNDO 3D (pedra, parede) são ARTE, não i18n: tratar como textura
  decorativa, não como string traduzível, salvo quando forem legíveis e significativas
  (então validar e marcar como asset).

---

## 7. Lista canônica de grafias (para colar no topo de qualquer documento)

Regras invioláveis: NUNCA travessão (—) nem meia-risca (–); usar hífen, dois-pontos,
vírgula ou parênteses. NUNCA emojis. Texto exibido COM acento; ids internos snake_case SEM
acento. Tom mítico e sóbrio; pouca fala, muito silêncio. Violência por elipse, sem gore,
mortos retornam ao repouso (Teen). Procedência: `[DESIGN]` / `[CÓDIGO]` / `[ASSET]`.
Exigência: `[NORMATIVO]` / `[ASPIRACIONAL]` / `[A DEFINIR]`.

Nomes e seres (exibição | id interno):
Acendedora | acendedora ; Guardião | guardiao ; mortos despertos | morto_desperto ;
esqueleto | esqueleto (asset skeleton) ; tocha | tocha (asset torch) ; baú | bau (asset
chest).

Conceitos e lugares (exibição | id interno):
Brasa | brasa ; poço-cripta | poco_cripta ; cripta | cripta ; câmara | camara ;
sala | sala ; braseiro | braseiro ; porta de pedra | porta_pedra ; fagulha/Fagulha |
fagulha ; descida | descida ; frio eterno | frio_eterno ; superfície | superficie.

Tipos de sala (rótulos, maiúscula): Câmara de Guarda | camara_de_guarda ;
Corredor / Antecâmara | corredor ; Cisterna / Salão | cisterna ;
Santuário do Braseiro | santuario ; Câmara do Guardião | camara_do_guardiao.

Capitalização-chave: maiúscula em Brasa, Acendedora, Guardião (chefe), Fagulha (recurso
nomeado); minúscula em braseiro, poço-cripta, câmara, sala, porta de pedra, mortos
despertos, esqueleto, frio eterno, descida, tocha, fagulha (faísca comum).

EN espelho (proposta, ratificar): Ember, Kindler, Warden, crypt-well, brazier, spark,
woken dead, skeleton, eternal cold, chamber, room, descent, stone door, torch.

---

## Checklist de aceite (Definition of Done)

`[NORMATIVO]` Cada item recebe sim / não honesto. O guia de estilo só está "pronto" quando
o corpus o segue.

- [ ] `[NORMATIVO]` Nenhum travessão (—) nem en-dash (–) em qualquer texto do corpus de
      Brasa (lore, fichas, specs, UI, i18n, commits): verificável por busca.
- [ ] `[NORMATIVO]` Nenhum emoji em qualquer texto do corpus de Brasa.
- [ ] `[NORMATIVO]` Todo texto exibido ao jogador usa acentuação correta de pt-BR; todo id
      interno é snake_case ASCII sem acento (seção 3).
- [ ] `[NORMATIVO]` Todo termo central do mundo (Brasa, Acendedora, Guardião, poço-cripta,
      câmara, sala, braseiro, porta de pedra, mortos despertos, esqueleto, frio eterno,
      fagulha, descida, tocha) tem verbete no glossário (seção 4) com grafia, "o que NÃO
      dizer" e exemplo.
- [ ] `[NORMATIVO]` Capitalização segue a seção 1.7 / 7 (maiúscula: Brasa, Acendedora,
      Guardião, Fagulha-recurso; minúscula: braseiro, poço-cripta, câmara, etc.).
- [ ] `[NORMATIVO]` Cada nome / termo de Brasa tem par fixo nome de exibição + id interno
      na lista canônica (seção 7), sem variantes soltas no corpus.
- [ ] `[NORMATIVO]` Toda voz (Acendedora, vozes do passado, Guardião, narrador) tem
      registro definido (seção 1.5 / 2) e nenhuma faz piada, gíria ou ironia leve.
- [ ] `[NORMATIVO]` Nenhum texto de jogo descreve violência gráfica: mortos retornam ao
      repouso (dissolvem / tombam), sem sangue, sem gore (seção 1.6).
- [ ] `[NORMATIVO]` Lore narrada por gotas (inscrição, linha curta, estado de cena), sem
      paredão de exposição (seção 1.4).
- [ ] `[NORMATIVO]` Marcações usadas corretamente: procedência `[DESIGN]` / `[CÓDIGO]` /
      `[ASSET]` e exigência `[NORMATIVO]` / `[ASPIRACIONAL]` / `[A DEFINIR]`, combináveis.
- [ ] `[NORMATIVO]` Chaves de i18n são ids semânticos estáveis (não mudam com o texto) e
      preservam concordância de gênero da Acendedora (seção 3.4 / 6.3).
- [ ] `[DESIGN]` `[A DEFINIR]` Definida a voz da Acendedora (audível com raras linhas vs.
      silenciosa) e registrada na ficha de personagem.
- [ ] `[DESIGN]` `[A DEFINIR]` Definido o par PT<->EN definitivo de cada nome próprio
      (Brasa/Ember, Acendedora/Kindler, Guardião/Warden, poço-cripta) na seção 6.2.
- [ ] `[DESIGN]` `[A DEFINIR]` Definida a cronologia interna do mundo (termos como
      "gerações atrás" vs. calendário) onde a lore precisar (seção 1.8).
- [ ] `[A DEFINIR]` Itens em aberto desta lista resolvidos ou explicitamente adiados com
      registro.
