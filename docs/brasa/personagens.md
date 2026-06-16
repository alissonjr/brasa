# Personagens - Brasa

Fichas profundas do elenco de Brasa (dungeon crawler 3D low-poly de fantasia, foco em
rodar leve no navegador). O elenco é deliberadamente enxuto: uma protagonista jogável (a
Acendedora), um chefe (o Guardião), um coro de vozes do passado (as Acendedoras
anteriores, que nunca aparecem como modelo) e um punhado de NPCs de enquadramento
propostos. Por ser enxuto, cada figura é aprofundada ao máximo, na mesma régua de
profundidade das fichas do projeto anterior, mas com conteúdo 100% Brasa.

Documento mestre (canon): [`../projeto-brasa.md`](../projeto-brasa.md). Régua de detalhe e
template de ficha de personagem: [`../padrao-de-detalhe.md`](../padrao-de-detalhe.md)
(campos mínimos na seção 2.2; orçamento técnico na 2.1; template na seção 3). Paleta e
assinatura cromática: [`direcao-de-arte.md`](direcao-de-arte.md). Lore e arco:
[`narrativa-e-historia.md`](narrativa-e-historia.md). Voz e glossário:
[`guia-de-estilo-e-glossario.md`](guia-de-estilo-e-glossario.md).

Convenção (herdada do canon): pt-BR, sem travessões, sem emojis. Marcação de PROCEDÊNCIA:
`[DESIGN]` (decisão criativa nossa), `[CÓDIGO]` (observado no código do protótipo),
`[ASSET]` (procede de um pacote de asset existente). Marcação de EXIGÊNCIA: `[NORMATIVO]`
(entra no aceite, verificável), `[ASPIRACIONAL]` (mood/intenção, não bloqueia),
`[A DEFINIR]` (decisão pendente).

Aviso de honestidade: Brasa é IP original, não há texto-fonte. Todo dado de rosto, corpo,
voz e história é `[DESIGN]`, salvo onde uma escolha vem amarrada a um `[ASSET]` KayKit
(modelo base, esqueleto, biblioteca de animação) ou ao `[CÓDIGO]` do motor. O elenco
inteiro compartilha UM esqueleto e UMA biblioteca de animação por requisito de leveza
(canon 4.3), o que disciplina o que é proponível: nada que exija rig próprio entra sem
virar `[A DEFINIR]` com custo.

Snapshot: 2026-06-14.

---

# 1. A ACENDEDORA - Protagonista jogável

## 1.1 Identidade e papel
- `[DESIGN]` A última **Acendedora**: a guardiã que ainda carrega uma fagulha viva do
  fogo ancestral. Não é rainha nem sacerdotisa de pompa, é a última de uma linhagem de
  funcionárias do fogo, treinada a manter a Brasa acesa e, quando ela falha, a descer e
  reacendê-la. Título, não nome: "Acendedora" é uma função que passa de portadora a
  portadora (ver seção 3).
- `[DESIGN]` Papel jogável: única personagem controlada. Desce o poço-cripta sala por
  sala, limpa os mortos despertos no combate melee, acende o **braseiro** de cada câmara
  (o que devolve a luz quente, destrava a porta de pedra e concede um upgrade) e busca o
  fundo para reavivar a **Brasa** antes que a superfície congele de vez.
- `[DESIGN]` A fagulha que ela carrega é, ao mesmo tempo, premissa, recurso de jogo e
  identidade visual: o único ponto quente num mar azul enquanto a sala está fria
  (direcao-de-arte 2, "regra de ouro cromática"). Ela é luz andando no escuro.
- `[DESIGN]` `[ASPIRACIONAL]` Arco interno: de portadora solitária e exausta de um dever
  herdado a alguém que reaprende, andar a andar, por que o fogo importa. Não há fala dela
  necessária para isso; o arco se conta pela luz que ela devolve e pelos ecos das
  Acendedoras anteriores (seção 3).

## 1.2 Base de asset e técnica
- `[ASSET]` `[NORMATIVO]` Base de modelo: **KayKit Character Pack Adventurers**, variantes
  **Mage** ou **Rogue Hooded** (arquivos `Mage.glb` / `Rogue_Hooded.glb` JÁ presentes em
  `prototipo/public/models/`, canon 5). O capuz e a silhueta encapuzada são o que dá a
  leitura imediata de "figura solitária portando uma luz" (direcao-de-arte 131).
- `[ASSET]` `[NORMATIVO]` Esqueleto e animação compartilhados com TODOS os humanoides:
  `AnimationLibrary_Godot_Standard.gltf` (canon 4.3). A Acendedora não tem rig nem set de
  animação próprios; herda os clipes da biblioteca padrão. Qualquer animação exclusiva
  (ex. acender braseiro, erguer a fagulha) é `[A DEFINIR]` quanto a custo, e a preferência
  é compô-la de clipes existentes antes de autorar nova.
- `[CÓDIGO]` `[NORMATIVO]` Conduzida pelo `characterController` e pelo `heroCombat`
  atuais (canon 6.1); o `heroModel` é re-apontado para o glb da Acendedora (canon 6.4,
  `game/actors/acendedora.ts` ou re-aponte de `heroModel`).
- `[NORMATIVO]` Orçamento técnico de herói: **1k a 5k tris** (canon 4.2; padrao-de-detalhe
  2.1, faixa herói). KayKit Adventurers já cabe nessa faixa. Topologia limpa do pacote,
  não retopologizar à mão.
- `[A DEFINIR]` Escolher entre **Mage** e **Rogue Hooded** como base canônica da
  Acendedora. Recomendação `[DESIGN]`: **Mage** com cajado lido como "atiçador/porta-fogo"
  (a ponta do cajado guarda a fagulha), pois o cajado dá uma silhueta vertical com um
  ponto alto quente que combina com "porta-luz"; o Rogue Hooded fica como alternativa caso
  o moveset (spec-combate) feche melhor com lâmina curta. Decidir antes de religar o herói
  (canon roadmap 2).
- `[CÓDIGO]` Atualização (2026-06-15): as **vitrines 3D dos menus** (tela-título, criação,
  Crônica) usam um **modelo próprio da Acendedora** (`/models/acendedora.glb`, gerado no
  Tripo e limpo no Blender via `tools/isolate_acendedora.py`) - encapuzada, manto teal, cajado
  com ember na ponta, na intenção de leitura desta ficha. É **estático (sem rig)**, então
  serve só para as vitrines (a câmera orbita).
- `[CÓDIGO]` O **herói EM JOGO** passou a usar o KayKit **Rogue_Hooded** (encapuzado, lê como
  a Acendedora, melhor que o Mage genérico) por ter rig/pesos/animações limpos. Tentamos
  riggar o modelo próprio via auto-rig do Tripo (`tools/tripo_rig.py` + `finalize_acendedora.py`):
  saiu com deformação tipo gelatina (pesos ruins) e defeito de malha (mão dupla); descartado
  para gameplay. Um rig de qualidade do modelo próprio (Mixamo/manual ou auto-rig melhor)
  segue `[A DEFINIR]` com custo. Ver `spec-ui-hud-ux.md` 5.1/5.6.

## 1.3 Características físicas `[DESIGN]` (dentro do que o asset KayKit permite)
- `[DESIGN]` Importante: KayKit é low-poly estilizado de proporção levemente heroica
  (cabeça grande, mãos chapadas, sem detalhe anatômico fino). As descrições abaixo são a
  INTENÇÃO de leitura, não um pedido de remodelar; servem para escolha de variante, cor e
  pose.
- Faixa etária aparente: adulta jovem a meia-idade indefinida, ~30 a 40. O capuz e a luz
  baixa mantêm a idade ambígua de propósito (ela é "uma" Acendedora, ecoa as anteriores).
- Altura/biotipo: estatura média, enxuta e resistente, não atlética de exibição. Leitura
  de caminhante de longa distância no escuro, não de guerreira de arena. Dentro do KayKit
  Adventurer padrão, sem ajuste de escala além do `optimize_asset.py` (canon 4.5).
- Porte: levemente curvado para a frente quando carrega a fagulha em repouso, como quem
  protege uma chama do vento; ergue-se em combate. A mão livre tende a abrigar a luz.
- Rosto: o pouco que se vê sob o capuz. Expressão sóbria, cansada mas firme; olhos como o
  ponto de leitura facial mais legível de perto. `[ASPIRACIONAL]` Um leve reflexo quente
  da fagulha no rosto sempre que ela está em primeiro plano.
- Tom de pele e cabelo: `[A DEFINIR]` dentro das texturas do atlas KayKit Adventurers;
  preferir tom neutro que o capuz cubra, para a personagem ser "qualquer Acendedora". A
  paleta de pele/cabelo não disputa atenção com a fagulha.
- Mãos: chapadas (limitação do asset); a mão da fagulha é o foco. `[ASPIRACIONAL]` Leve
  emissivo quente na palma que segura a luz.
- Marcas: sem cicatrizes modeladas (custo de geometria/textura não se justifica em
  low-poly). A "marca" da Acendedora é a fagulha, não o corpo.
- Voz: ver 1.6.

## 1.4 Vestuário e equipamento
Detalhe pleno e tradução low-poly em [`biblia-vestuario.md`](biblia-vestuario.md) (traje
da Acendedora). Resumo de ficha, de dentro para fora:
- `[ASSET]` `[DESIGN]` Túnica/veste base do Adventurer (Mage ou Rogue Hooded), cor fria e
  apagada (azul-ardósia `#1F3247` a pedra `#6B6660`) para que ela seja parte do mundo frio
  e a fagulha seja o ÚNICO quente sobre ela (direcao-de-arte 2).
- `[ASSET]` `[DESIGN]` Capuz erguido: elemento de silhueta NORMATIVO (ver 1.8). Mantém o
  rosto na penumbra e dá a vertical de "figura solitária".
- `[ASSET]` `[DESIGN]` Manto/sobreveste se a variante tiver, com barra que pega luz quente
  rasante ao andar (leitura de movimento no escuro).
- `[DESIGN]` `[NORMATIVO]` Ponto quente portátil: a fagulha. Materializa-se como ponta de
  cajado acesa (variante Mage) ou pequeno braseiro de mão/lanterna improvisada (variante
  Rogue). Cor âmbar-chama `#FFA63D`, núcleo `#FF7A1A`, ponta de faísca `#FFD27A`
  (direcao-de-arte 2.1). É a fonte do halo que viaja com ela (direcao-de-arte 168).
- `[ASSET]` `[DESIGN]` Arma: amarrada à escolha de variante e ao [`spec-combate.md`](spec-combate.md).
  Mage = cajado que serve de arma e de porta-fagulha; Rogue Hooded = lâmina(s) curta(s).
  Sem escudo (mãos ocupadas com luz e arma; combate de esquiva, não de bloqueio).
- `[A DEFINIR]` Se a fagulha e a arma são o mesmo objeto (cajado-atiçador) ou objetos
  distintos. Recomendação `[DESIGN]`: o mesmo, para uma silhueta limpa e um ponto quente
  só. Resolver junto com a escolha de variante (1.2).

## 1.5 Mente e psicologia
- `[DESIGN]` Valores: dever, persistência, cuidado com a chama. Não heroísmo glorioso;
  uma teimosia quieta de quem não deixa a luz se apagar porque ninguém mais resta para
  isso.
- Temperamento: contido, econômico, melancólico. Fala pouco (ou nada, se for muda por
  design, ver 1.6). Age mais do que declara.
- Motivações: reavivar a Brasa; impedir o frio eterno e o despertar definitivo dos mortos;
  honrar a linhagem de Acendedoras sem se perder no peso dela.
- Medos/sombras: que a fagulha se apague antes do fundo; que ela seja a última e falhe
  onde as anteriores também falharam (os ecos contam que outras desceram e não voltaram).
  Defeito: solidão escolhida, dificuldade de pedir/aceitar ajuda (relevante se houver NPC
  de enquadramento, seção 4).
- `[ASPIRACIONAL]` Arco: do dever herdado e exausto ao sentido reencontrado; cada braseiro
  aceso é uma pequena reafirmação de que vale descer mais um andar.

## 1.6 Linguagem corporal e movimento (animação)
- `[ASSET]` `[NORMATIVO]` Todos os clipes vêm da `AnimationLibrary_Godot_Standard.gltf`
  (canon 4.3). Selecionar e remapear, não autorar do zero salvo `[A DEFINIR]` justificado.
- Postura/idle: peso baixo, ombros levemente recolhidos, a mão da fagulha protegendo a
  chama; respiração visível na luz que pulsa. Em alerta, a luz se ergue e o corpo se abre.
- Andar/descer: passada cautelosa de quem pisa no escuro, cabeça varrendo a sala; a luz da
  fagulha balança e projeta sombras vivas (a luz como personagem, direcao-de-arte 174).
- Estilo de luta: `[DESIGN]` esquiva e golpes rápidos e econômicos, sem bloqueio de
  escudo. A fagulha pode atiçar o combate (golpe quente) versus os esqueletos. Detalhe e
  hitboxes em [`spec-combate.md`](spec-combate.md).
- Ação-assinatura: `[DESIGN]` `[NORMATIVO]` acender o braseiro. A Acendedora estende a
  fagulha ao braseiro central; a luz quente cresce a partir do centro, o azul recua, a
  sala respira (direcao-de-arte 174). É a animação mais importante do jogo; compor de
  clipes existentes se possível, autorar se necessário (`[A DEFINIR]` de custo).
- Reações: vitória de sala = breve respiro, a Acendedora baixa os ombros e a luz se
  estabiliza quente; dano = a fagulha vacila (a luz quente pisca, leitura de perigo);
  morte = a fagulha se apaga e o azul reconquista a tela (telegrafia de derrota, casa com
  direcao-de-arte 2).
- Voz/registro: `[DESIGN]` `[A DEFINIR]` Recomendação: protagonista quase muda, com no
  máximo respirações, esforço de combate e poucos sussurros, deixando o lore para os ecos
  das anteriores (seção 3) e para NPC de enquadramento (seção 4). Se ganhar voz, registro
  baixo, grave para o porte, cansado mas firme, frases curtas; nunca exclamativo. Tom
  mítico/sóbrio do canon. Confirmar em [`guia-de-estilo-e-glossario.md`](guia-de-estilo-e-glossario.md).

## 1.7 Comportamento social
- `[DESIGN]` Praticamente não há sociedade na cripta: ela desce sozinha. Sua interação
  social é com o passado (ecos/inscrições) e, se proposto, com a voz de enquadramento do
  alto do poço (seção 4). Com os mortos despertos, não há diálogo: eles a atacam, ela
  responde; a melancolia vem de ela despertá-los ao trazer luz a câmaras que dormiam.

## 1.8 Notas de design e silhueta
- `[NORMATIVO]` Teste de silhueta em preto: figura encapuzada de pé com um único ponto
  quente (a fagulha) na mão ou na ponta do cajado. Lê-se a 50 m, de costas, no escuro:
  "alguém carregando uma luz". O capuz e o ponto quente são os dois elementos
  inegociáveis da leitura (direcao-de-arte 131).
- `[NORMATIVO]` Paleta: corpo em frios apagados (azul-ardósia `#1F3247`, pedra `#6B6660`);
  o ÚNICO quente sobre ou perto dela é a fagulha (âmbar `#FFA63D`, núcleo `#FF7A1A`, faísca
  `#FFD27A`). Nada mais no traje compete com a chama (direcao-de-arte 2).
- `[ASPIRACIONAL]` A Acendedora deve ler como "a vida e o calor andando", o oposto exato do
  Guardião (seção 2), que é o frio e a pedra parados.
- Poses icônicas: erguer a fagulha para revelar a sala; estender o fogo ao braseiro;
  proteger a chama com a mão livre no idle.
- Percepção desejada: solidão digna, persistência, esperança teimosa. O jogador deve
  querer protegê-la e proteger a luz que ela carrega.

---

# 2. O GUARDIÃO - Chefe (a Brasa apagada no fundo)

Ficha resumida de personagem; leitura de fases, ataques e telegrafia plenos em
[`spec-chefe-guardiao.md`](spec-chefe-guardiao.md).

## 2.1 Identidade e papel
- `[DESIGN]` O **Guardião** é o chefe único do vertical slice, à espera no fundo do
  poço-cripta, na câmara da Brasa apagada (canon 3.1). É o que sobrou de quem deveria
  proteger a Brasa: um guardião que, com o fogo morrendo, virou parte do frio e da pedra
  que devia combater. Não um monstro qualquer, mas o próprio dever pervertido pelo escuro.
- `[DESIGN]` `[A DEFINIR]` Natureza exata: proposta de que o Guardião seja a ARMADURA/forma
  de uma Acendedora anterior (ou do guardião original do poço) que desceu, falhou e não
  voltou, agora habitada pelo frio. Isso amarra o chefe ao lore das vozes do passado
  (seção 3) e torna a luta um espelho sombrio da Acendedora jogável: o que ela pode vir a
  ser se a fagulha se apagar. Recomendação `[DESIGN]`: adotar essa leitura. Confirmar em
  [`narrativa-e-historia.md`](narrativa-e-historia.md) e spec-chefe-guardiao.

## 2.2 Relação com a Brasa apagada
- `[DESIGN]` O Guardião guarda a Brasa que se apagou. Enquanto a Acendedora desce
  reacendendo braseiros (devolvendo luz), o Guardião é o agente do escuro no fundo: a
  presença que mantém a Brasa fria. A luta não é sobre matá-lo por matar, é sobre vencer o
  que impede a chama de voltar.
- `[DESIGN]` `[ASPIRACIONAL]` Tematicamente, ele é a versão derrotada do dever da
  Acendedora; o frio-azul `#0E1A2B`/ciano-espectral `#5FB7C9` é a cor dele, o oposto do
  âmbar dela. Vencê-lo e acender a Brasa fecha o slice (canon 3.1).

## 2.3 Base de asset e técnica
- `[ASSET]` `[NORMATIVO]` Base: **KayKit Character Pack Skeletons** (canon 5, pacote a
  baixar), variante maior/distinta para ler como chefe, ou um esqueleto comum
  re-escalado/recolorido com props adicionais. Compartilha o esqueleto e a biblioteca de
  animação dos demais humanoides (canon 4.3).
- `[NORMATIVO]` Orçamento técnico de chefe: **3k a 6k tris** (canon 4.2; padrao-de-detalhe
  2.1, faixa chefe). Leitura de fase por COR e SILHUETA, não por geometria nova cara.
- `[A DEFINIR]` Quanto da silhueta do Guardião vem do esqueleto base e quanto de props do
  Dungeon Kit (elmo grande, escudo de pedra, braseiro morto às costas). Resolver com
  spec-chefe-guardiao e biblia-bestiario.

## 2.4 Leitura de fases (silhueta e cor)
Detalhe pleno em [`spec-chefe-guardiao.md`](spec-chefe-guardiao.md). Princípio de ficha:
- `[DESIGN]` `[NORMATIVO]` As fases se leem por COR e SILHUETA (canon 4.2, "leitura de fase
  por cor/silhueta"), não por trocar o modelo. Proposta de progressão:
  - Fase fria (inicial): o Guardião é puro frio, azul-cripta `#0E1A2B`, olhos/runas em
    ciano-espectral `#5FB7C9`; lento, pesado, parte da pedra.
  - Fase de fenda (intermediária): rachaduras quentes começam a aparecer nele conforme a
    Acendedora o pressiona, vermelho-tiço `#C8401C` vazando das juntas (a Brasa querendo
    voltar mesmo nele).
  - Fase final: o calor que a Acendedora traz o destrava; clímax e queda dão lugar ao
    acender da Brasa.
- `[A DEFINIR]` Número exato de fases e gatilhos (vida/tempo/braseiros), em spec-chefe-guardiao.

## 2.5 Notas de design e silhueta
- `[NORMATIVO]` Teste de silhueta em preto: massa larga, baixa e pesada, ancorada ao chão
  (o oposto da vertical leve e encapuzada da Acendedora). Lê-se "parede que se move", "a
  pedra e o frio que ganharam corpo".
- `[NORMATIVO]` Paleta: frios `#0E1A2B`/`#1F3247`, runas/olhos ciano `#5FB7C9`, com o
  quente entrando apenas como dano/fenda nas fases avançadas (`#C8401C`). Espelho cromático
  exato da Acendedora.
- `[ASPIRACIONAL]` Percepção desejada: peso, inevitabilidade, e uma melancolia (ele já foi
  guardião do fogo). A vitória sobre ele deve sentir-se como libertação, não triunfo
  cruel, fiel ao tom mítico/sóbrio do canon.

---

# 3. VOZES E FIGURAS DO PASSADO - as Acendedoras anteriores

`[DESIGN]` Coro de lore, NÃO modelos jogáveis. As Acendedoras anteriores desceram este
mesmo poço em gerações passadas. Algumas reacenderam a Brasa e voltaram; outras falharam e
não voltaram (e uma delas pode ser o Guardião, seção 2.1). Elas contam o lore sem nunca
aparecerem como personagem renderizado, o que é também uma escolha de leveza: zero custo
de modelo/rig.

## 3.1 Como aparecem (sem modelo)
- `[DESIGN]` `[NORMATIVO]` Por **inscrições** gravadas na pedra das câmaras (texto/relevo
  no kit modular ou em decals), lidas pela Acendedora ao passar. Custo: textura/decal, não
  personagem.
- `[DESIGN]` `[NORMATIVO]` Por **ecos**: sussurros/vozes em áudio disparados em pontos da
  descida (ver [`biblia-audio.md`](biblia-audio.md)). Falam frases curtas, fragmentárias,
  do que viveram aqui. Custo: áudio, não modelo.
- `[DESIGN]` `[ASPIRACIONAL]` Opcionalmente, vultos de luz fria (silhueta em ciano-espectral
  `#5FB7C9`, sem malha de personagem, só um shader/sprite/luz) que somem ao se aproximar
  delas. Marcar `[A DEFINIR]` se entram no slice (custo de VFX, ver biblia-vfx-e-shaders).

## 3.2 Função narrativa
- `[DESIGN]` Entregam o lore (o que é a Brasa, por que o frio veio, o que houve com quem
  desceu antes), telegrafam perigo ("não acendas o braseiro do salão fundo sem...",
  fragmentos de aviso) e dão peso emocional: a Acendedora não é a primeira, e o fracasso é
  real e habita o fundo.
- `[DESIGN]` `[ASPIRACIONAL]` Tom: mítico, melancólico, fragmentário. Vozes que poderiam
  ser a própria Acendedora num futuro possível. Não expõem tudo; insinuam.

## 3.3 Vozes propostas (arquétipos, todas `[DESIGN]` `[A DEFINIR]`)
Propostas de "personalidades" do coro, para dar variedade aos ecos. Nenhuma vira modelo;
são timbres e conteúdos de inscrição/áudio. Confirmar número e identidade em
narrativa-e-historia e biblia-audio.
- A Primeira: voz mais antiga, quase litúrgica, que estabeleceu o dever de descer e
  acender. Fala em sentenças de fundação ("Enquanto a Brasa arder, haverá manhã").
- A que Falhou: voz que desceu, hesitou e perdeu a fagulha; tom de aviso e arrependimento.
  Candidata a ser o Guardião (seção 2.1).
- A Cartógrafa: voz prática, que gravou nas paredes o caminho e os perigos (suas inscrições
  funcionam como dicas de level design diegéticas).
- A Última-antes-de-você: voz mais recente e mais próxima, quase contemporânea da
  Acendedora jogável; o elo direto que passou a fagulha adiante.
- `[A DEFINIR]` Quantas vozes entram no slice (recomendação `[DESIGN]`: 2 a 4 timbres
  distintos para não diluir), e quais inscrições/ecos casam com quais salas (mapear junto
  com spec-vertical-slice-cripta).

---

# 4. NPC DE ENQUADRAMENTO `[DESIGN]` - A Voz do Poço

`[DESIGN]` `[A DEFINIR]` Proposta de um único NPC de enquadramento para dar moldura à
descida sem inflar o elenco nem o custo. Não jogável, não combatente, possivelmente sem
modelo. A recomendação é tê-lo apenas em VOZ, do alto do poço, falando para a Acendedora
enquanto ela desce.

## 4.1 Identidade e papel propostos
- `[DESIGN]` A **Voz do Poço** (nome de trabalho, `[A DEFINIR]`): quem ficou na superfície
  e fala para a Acendedora de cima, na boca do poço-cripta. Pode ser a guardiã idosa que a
  treinou e já não pode descer, ou a última voz da comunidade que ainda resiste ao frio lá
  em cima. Dá objetivo, contexto e companhia humana numa descida solitária.
- `[DESIGN]` Função de jogo: tutorial diegético (explica o laço de acender braseiros sem
  HUD intrusivo), marcador de progresso ("mais um braseiro e o frio recua um andar") e
  âncora emocional (alguém esperando lá em cima). Espelha, em IP original, o papel de NPC
  de orientação/briefing do projeto anterior, sem nada de Josué.

## 4.2 Como aparece (custo mínimo)
- `[DESIGN]` `[NORMATIVO se adotado]` Apenas VOZ (áudio) e, no máximo, um foco de luz fria
  vinda de cima na primeira sala (a boca do poço). Sem modelo de personagem, sem rig: custo
  zero de geometria, casa com o pilar de leveza (canon 2).
- `[DESIGN]` `[A DEFINIR]` Se ganha presença visual (uma silhueta na boca do poço na
  abertura/fechamento), tratar como set piece em [`spec-set-pieces.md`](spec-set-pieces.md),
  não como personagem renderizado na cripta.

## 4.3 Voz e registro
- `[DESIGN]` `[A DEFINIR]` Registro: caloroso mas grave, de quem confia na Acendedora e
  teme por ela; contraponto humano à frieza da cripta. Frases curtas, espaçadas (não
  tagarela). Tom mítico/sóbrio do canon. Definir em guia-de-estilo-e-glossario e biblia-audio.

## 4.4 Pendências do NPC
- `[A DEFINIR]` Se a Voz do Poço entra no slice (recomendação `[DESIGN]`: SIM, em áudio
  apenas, por baixo custo e alto ganho de moldura e tutorial diegético).
- `[A DEFINIR]` Identidade exata (mentora idosa vs comunidade da superfície) e se sua voz
  se cruza/contrasta com os ecos das Acendedoras anteriores (seção 3).
- `[A DEFINIR]` Se há mais de um NPC de enquadramento. Recomendação `[DESIGN]`: NÃO, manter
  o elenco enxuto; um só basta para a moldura.

---

# 5. Contraste do elenco (resumo de design)

`[DESIGN]` O elenco de Brasa se organiza por um eixo único: LUZ/CALOR/VIDA contra
ESCURO/FRIO/MORTE.
- Silhuetas: Acendedora vertical, leve, encapuzada, com um ponto quente (a fagulha);
  Guardião largo, baixo, pesado, ancorado, frio. Lê-se cada um a 50 m, de costas, no
  escuro. Os esqueletos comuns (em [`biblia-bestiario.md`](biblia-bestiario.md)) são o coro
  da morte entre os dois.
- Paletas: Acendedora = frios apagados no corpo + âmbar `#FFA63D` na fagulha; Guardião =
  azul-cripta `#0E1A2B` + ciano `#5FB7C9`, com quente só como dano. Espelho cromático
  exato (direcao-de-arte 2).
- Presença: a Acendedora aparece como modelo jogável; o Guardião como modelo de chefe; as
  Acendedoras anteriores NUNCA aparecem (só inscrição/eco); a Voz do Poço, no máximo, como
  áudio e luz. Custo de elenco mantido mínimo, fiel ao pilar de leveza (canon 2).
- Eixo dramático: a Acendedora é o que o Guardião já foi; vencê-lo e reacender a Brasa é
  recusar o destino que o consumiu. As vozes do passado são as outras que andaram esse fio.

---

## Checklist de aceite (Definition of Done)

Cada item abaixo é `[NORMATIVO]` e verificável, derivado das fichas acima. Régua de
orçamento técnico em [`../padrao-de-detalhe.md`](../padrao-de-detalhe.md) seção 2.1; campos
mínimos de ficha de personagem na seção 2.2 do mesmo documento.

### A Acendedora (protagonista)
- [ ] Modelo base é KayKit Adventurer (Mage ou Rogue Hooded), arquivo já em `prototipo/public/models/` `[ASSET][NORMATIVO]`
- [ ] Compartilha esqueleto e a biblioteca `AnimationLibrary_Godot_Standard.gltf` com todos os humanoides (sem rig/animação próprios não justificados) `[ASSET][NORMATIVO]`
- [ ] Conduzida pelo `characterController` e `heroCombat` atuais, com `heroModel` re-apontado `[CÓDIGO][NORMATIVO]`
- [ ] Orçamento técnico dentro de 1k-5k tris (canon 4.2; padrao-de-detalhe 2.1) `[NORMATIVO]`
- [ ] Capuz erguido presente como elemento de silhueta `[DESIGN][NORMATIVO]`
- [ ] Corpo em frios apagados (azul-ardósia `#1F3247` / pedra `#6B6660`); nenhum quente no traje compete com a fagulha `[DESIGN][NORMATIVO]`
- [ ] A fagulha é o único ponto quente sobre/perto dela no estado frio (âmbar `#FFA63D`, núcleo `#FF7A1A`, faísca `#FFD27A`), com halo de luz que viaja junto `[DESIGN][NORMATIVO]`
- [ ] Teste de silhueta em preto passa: figura encapuzada de pé com um único ponto quente, legível a 50 m de costas no escuro `[DESIGN][NORMATIVO]`
- [ ] Sem escudo; combate de esquiva e golpes econômicos conforme [`spec-combate.md`](spec-combate.md) `[DESIGN][NORMATIVO]`
- [ ] Ação-assinatura de acender o braseiro implementada (estende a fagulha, luz quente cresce do centro, azul recua) `[DESIGN][NORMATIVO]`
- [ ] Reação de dano (a fagulha vacila) e de morte (a fagulha se apaga, azul reconquista a tela) presentes `[DESIGN][NORMATIVO]`
- [ ] Ficha completa com os campos mínimos da seção 2.2 (papel, biotipo/medidas, paleta, silhueta, vestuário com link, moveset com link, voz com link) `[NORMATIVO]`
- [ ] `[A DEFINIR]` resolvidos: variante Mage vs Rogue Hooded; fagulha e arma mesmo objeto ou distintos; protagonista muda ou com voz `[NORMATIVO]`
- [ ] Sem travessões e sem emojis em qualquer texto exibido `[NORMATIVO]`

### O Guardião (chefe)
- [ ] Modelo base é KayKit Skeletons (chefe), compartilha esqueleto e biblioteca de animação dos humanoides `[ASSET][NORMATIVO]`
- [ ] Orçamento técnico dentro de 3k-6k tris (canon 4.2; padrao-de-detalhe 2.1) `[NORMATIVO]`
- [ ] Leitura de fase por cor e silhueta, sem troca de modelo (frio `#0E1A2B` / ciano `#5FB7C9` base; quente `#C8401C` só como fenda/dano nas fases avançadas) `[DESIGN][NORMATIVO]`
- [ ] Teste de silhueta em preto passa: massa larga, baixa, pesada, ancorada (oposto da Acendedora) `[DESIGN][NORMATIVO]`
- [ ] É o chefe único do slice, na câmara da Brasa apagada; vencê-lo destrava o acender da Brasa (fim do slice) `[DESIGN][NORMATIVO]`
- [ ] Detalhe de fases, ataques e telegrafia presentes em [`spec-chefe-guardiao.md`](spec-chefe-guardiao.md) `[NORMATIVO]`
- [ ] `[A DEFINIR]` resolvidos: natureza (Acendedora/guardião anterior consumido pelo frio); nº de fases e gatilhos; props de silhueta `[NORMATIVO]`
- [ ] Sem travessões e sem emojis em qualquer texto exibido `[NORMATIVO]`

### Vozes e figuras do passado
- [ ] Lore das Acendedoras anteriores entregue SEM modelo de personagem (apenas inscrição/decal e/ou eco de áudio) `[DESIGN][NORMATIVO]`
- [ ] Ecos/inscrições mapeados às salas da descida em conjunto com [`spec-vertical-slice-cripta.md`](spec-vertical-slice-cripta.md) e [`biblia-audio.md`](biblia-audio.md) `[DESIGN][NORMATIVO]`
- [ ] `[A DEFINIR]` resolvidos: nº de timbres (recomendação 2-4); vultos de luz fria entram ou não; elo de uma das vozes com o Guardião `[NORMATIVO]`
- [ ] Sem travessões e sem emojis em qualquer texto exibido `[NORMATIVO]`

### NPC de enquadramento (a Voz do Poço)
- [ ] Decisão registrada de adoção no slice (recomendação: sim, apenas em áudio) `[DESIGN][NORMATIVO]`
- [ ] Se adotado, presença com custo mínimo: voz e, no máximo, foco de luz fria na boca do poço; sem modelo de personagem na cripta `[DESIGN][NORMATIVO]`
- [ ] Voz/registro definidos em [`guia-de-estilo-e-glossario.md`](guia-de-estilo-e-glossario.md) e [`biblia-audio.md`](biblia-audio.md) `[NORMATIVO]`
- [ ] `[A DEFINIR]` resolvidos: identidade (mentora vs comunidade); presença visual em set piece ou não; um só NPC de enquadramento `[NORMATIVO]`
- [ ] Sem travessões e sem emojis em qualquer texto exibido `[NORMATIVO]`

### Transversal ao elenco
- [ ] Eixo de contraste luz/calor/vida contra escuro/frio/morte legível entre Acendedora e Guardião (silhueta e paleta espelhadas) `[DESIGN][NORMATIVO]`
- [ ] Todos os humanoides compartilham UM esqueleto e UMA biblioteca de animação (canon 4.3) `[ASSET][NORMATIVO]`
- [ ] Cada `.glb` novo passou por `optimize_asset.py` + `validate_gltf.py` (canon 4.5) `[NORMATIVO]`
- [ ] Itens `[A DEFINIR]` resolvidos ou explicitamente adiados com registro `[NORMATIVO]`

---

## Ver também
- [`../projeto-brasa.md`](../projeto-brasa.md) - canon mestre (premissa, loop, orçamento, assets).
- [`../padrao-de-detalhe.md`](../padrao-de-detalhe.md) - régua de detalhe, template de ficha, DoD.
- [`direcao-de-arte.md`](direcao-de-arte.md) - paleta frio/quente, silhueta, assinatura cromática.
- [`narrativa-e-historia.md`](narrativa-e-historia.md) - lore, arco da Acendedora, vozes do passado.
- [`guia-de-estilo-e-glossario.md`](guia-de-estilo-e-glossario.md) - voz, registro, glossário canônico.
- [`biblia-vestuario.md`](biblia-vestuario.md) - traje da Acendedora, leitura dos esqueletos.
- [`biblia-bestiario.md`](biblia-bestiario.md) - mortos despertos (esqueletos e variantes).
- [`biblia-audio.md`](biblia-audio.md) - ecos, leitmotifs, SFX da fagulha e do braseiro.
- [`biblia-vfx-e-shaders.md`](biblia-vfx-e-shaders.md) - chama, fagulhas, vultos de luz fria.
- [`spec-combate.md`](spec-combate.md) - moveset e hitboxes da Acendedora.
- [`spec-chefe-guardiao.md`](spec-chefe-guardiao.md) - fases, ataques e telegrafia do Guardião.
- [`spec-vertical-slice-cripta.md`](spec-vertical-slice-cripta.md) - a descida de 5-7 salas + chefe.
- [`spec-set-pieces.md`](spec-set-pieces.md) - acender a Brasa, despertares, queda.
</content>
</invoke>

---

## CANON FECHADO W1/W5 (2026-06-15) - fichas ratificadas

Fecha os `[A DEFINIR]` de identidade. Detalhe e roadmap em
[`00-aprofundamento-e-roadmap.md`](00-aprofundamento-e-roadmap.md). Encenação já no código
(ecos por andar, falas do confronto): ver `narrativa-e-historia.md` seção 0.

### Cinza (a Acendedora)
`[NORMATIVO]` "Acendedora" é o título herdado; o NOME próprio é **Cinza**. Voz quase muda: 1
frase rara por andar (ex.: "Outro braseiro. Mais um andar."). Veste o capuz (Rogue_Hooded).
Linguagem corporal cansada mas firme. Motivação: desce porque **Marta** (a mentora) não pôde
descer de novo e morre do frio na superfície; busca reavivar a Brasa E saber o que houve com
quem desceu antes dela.

### Marta (a Voz do Poço)
`[NORMATIVO]` Mentora idosa de Cinza, Acendedora da geração passada. Voltou gasta demais para
descer outra vez; agora morre do frio lá em cima. So AUDIO (sem rig). Marca o tempo: a cada
braseiro aceso, relata o frio recuando. Frase-âncora: "Se não eu, então tu." Da urgência
emocional sem cutscene. `[A DEFINIR]`: quantas falas entram no slice (proposta: 2-3 chave).

### O Guardião (a Primeira Acendedora)
`[NORMATIVO]` Antes: a primeira a descer, venceu e reacendeu a Brasa. Sacrifício: descobriu que
a chama só arde com uma guarda viva dentro dela; escolheu ficar. Agora: corpo consumido pelo
fogo eterno, esperando libertação ou sucessora. Não é maldade: testa Cinza para saber se deve
passar o fardo ou impedi-la. Encenação (já no código): fala ao surgir ("Esperei tanto que
esqueci meu nome. Qual é o teu?") e sussurra ao cair ("Vai. Acende a Brasa... e não a deixes
sozinha, como eu fiquei.").

### Vozes do passado (ecos)
`[DESIGN]` 3-4 arquétipos com frase-assinatura (a Primeira, a que Falhou, a Cartógrafa, a
Última-antes-de-você). Os ecos por andar (`ECHOES` em `main.ts`) encenam o arco de revelação.
