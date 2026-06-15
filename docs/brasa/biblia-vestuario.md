# Bíblia de Vestuário e Equipamento: Brasa

Dungeon crawler 3D low-poly de fantasia, rodando leve no navegador (empacotamento
Electron), produção solo/indie. A descida de uma Acendedora pelo poço-cripta de pedra,
reacendendo braseiros para empurrar o escuro andar abaixo antes que a superfície
congele. Arte low-poly de cor chapada, coerente com o ecossistema KayKit (CC0), lida
pela assinatura cromática frio-azul contra laranja-quente. Classificação Teen, tom
mítico, sóbrio, melancólico mas com esperança.

Documento de referência para quem cura, ilumina e colore os assets (não há modelagem à
mão em Brasa: o trabalho é adaptar por cor/atlas, não remodelar). Cada item leva as
duas marcações do canon:
- PROCEDÊNCIA: `[DESIGN]` (decisão criativa nossa), `[ASSET]` (procede de pacote CC0
  existente), `[CÓDIGO]` (observado no protótipo).
- EXIGÊNCIA: `[NORMATIVO]` (entra no aceite, verificável), `[ASPIRACIONAL]` (mood, não
  bloqueia), `[A DEFINIR]` (decisão pendente).

Ver também o CANON em [`../projeto-brasa.md`](../projeto-brasa.md), a paleta e a luz em
[`direcao-de-arte.md`](direcao-de-arte.md), a grafia e o glossário em
[`guia-de-estilo-e-glossario.md`](guia-de-estilo-e-glossario.md), a ficção dos
personagens em [`narrativa-e-historia.md`](narrativa-e-historia.md), a iluminação em
[`biblia-iluminacao.md`](biblia-iluminacao.md) e a régua de detalhe em
[`../padrao-de-detalhe.md`](../padrao-de-detalhe.md).

Convenção de escrita: pt-BR, sem travessões, sem emojis.

Snapshot: 2026-06-14.

---

## 0. Princípios gerais: vestir sem remodelar

`[DESIGN]` `[NORMATIVO]` A regra mestra de Brasa separa este documento de uma bíblia de
vestuário comum: NÃO esculpimos roupa. Todo traje já existe na malha KayKit. O figurino
de Brasa é uma disciplina de COR, ATLAS, LUZ e LEITURA DE SILHUETA, não de modelagem,
costura ou simulação de tecido. Onde uma bíblia tradicional descreveria como cortar e
deformar um pano, aqui descrevemos como recolorir um atlas, como a luz fria/quente banha
a peça já modelada, e qual silhueta o asset precisa carregar para ser lido. A âncora
técnica é o canon (seção 4): < 60 draw calls por sala, atlas único por pacote, emissivo
só no fogo.

`[DESIGN]` `[ASSET]` As três bases de personagem, todas KayKit de Kay Lousberg (CC0):
- Acendedora (herói): KayKit Character Pack Adventurers, `Mage.glb` ou `Rogue_Hooded.glb`
  (ambos JÁ em disco em `prototipo/public/models/`).
- Mortos despertos (inimigo comum) e o Guardião (chefe): KayKit Character Pack Skeletons
  (A BAIXAR), esqueleto único compartilhado.
- Animação de todos os humanoides: `AnimationLibrary_Godot_Standard.gltf` (JÁ em disco).

`[DESIGN]` `[NORMATIVO]` As quatro alavancas que temos para "vestir" sem remodelar, em
ordem de preferência (mais barata e mais coerente primeiro):
1. **Recolorir o atlas / trocar o material por slot.** O atlas KayKit já separa pele,
   pano, couro, metal e osso em regiões. Trocar as cores dessas regiões por variante de
   material é o caminho principal. Preserva geometria, peso e a malha CC0 original.
2. **Vertex color.** Degradê barato (capuz mais escuro na dobra, barra mais clara,
   oclusão pintada nas cavidades do osso), praticamente de graça em performance. É o que
   dá "calor" e "frio" sem textura nova.
3. **Emissivo.** Recurso premium da paleta, reservado ao fogo: a fagulha no peito da
   Acendedora, o gume que pega a luz do braseiro, os olhos/runas espectrais dos mortos.
4. **Anexar prop existente.** Trocar a arma na mão (catálogo de armas KayKit), pôr um
   escudo, anexar o prop da fagulha. Encaixe por osso, sem mexer no corpo.

`[DESIGN]` `[NORMATIVO]` O que está PROIBIDO como solução de figurino (quebra o canon de
arte, seção 5 da direção de arte): remodelar corpo ou pano, esculpir peça nova,
adicionar microdetalhe, PBR pesado, textura 2K/4K nova por asset, simulação cara de
tecido. Se uma leitura só sai com geometria nova, ela é rebaixada ou descartada, não
modelada. Exceção só por registro `[A DEFINIR]`.

`[DESIGN]` `[NORMATIVO]` A unidade do elenco vem da LUZ e da PALETA, não da modelagem.
Mesmo que Acendedora (Adventurers) e mortos (Skeletons) venham de pacotes diferentes, a
luz fria/quente e o fog por sala (autoria nossa) banham tudo na mesma temperatura, e a
paleta normativa da seção 1 mantém todos no mesmo mundo.

---

## 1. Paleta-mestra de vestuário (HEX, herdada da direção de arte)

`[DESIGN]` `[NORMATIVO]` As cores abaixo NÃO são novas: são as âncoras já fixadas na
direção de arte (seção 2.1) e na iluminação, recortadas aqui pelo que toca o figurino.
Vertex color e materiais de traje ficam dentro destas gamas; a validação de cena confere
contra elas. Atribuição de cor por peça vem nas seções 2, 3 e 4.

Quente (a Acendedora viva, a fagulha, o gume aquecido):
- Laranja-brasa núcleo (fagulha, emissivo mais intenso): `#FF7A1A`
- Âmbar-chama (halo quente que viaja com ela, luz da fagulha): `#FFA63D`
- Ouro-fagulha (realce, ponta da faísca, partícula): `#FFD27A`
- Vermelho-tiço (base da chama, brasa que esfria): `#C8401C`

Frio (os mortos, a pedra úmida, o espectral):
- Azul-cripta profundo (ambiente/fog da sala fria): `#0E1A2B`
- Azul-ardósia (sombra de pano e pedra): `#1F3247`
- Azul-aço frio (rim azulado, preenchimento frio): `#3E5C7E`
- Ciano-espectral (olhos/runas dos mortos, gélido, emissivo): `#5FB7C9`

Osso e mortalha (o traje dos mortos despertos):
- Osso-base: `#D8CFB8`
- Osso-encardido (sombra, sujeira nas cavidades): `#A39A82`
- Tecido apodrecido (mortalha, capuz, faixa enrolada): `#3A3530`

Metal (armas, fechos, partes do Guardião):
- Ferro frio (lâmina/elmo no estado frio): `#5A6470`
- Bronze patinado (detalhe antigo, fechos, fivelas): `#7A5A2E`
- Realce de metal aquecido (gume que pega a luz do braseiro): `#C98A3A`

Pano neutro da Acendedora (recebe a temperatura da luz, ver seção 2):
- Lã-cripta escura (manto/capuz, valor baixo, leve azul-frio em sombra): `#2E2A33`
- Linho-cinza envelhecido (túnica interna, sob o manto): `#6E6A63`
- Couro-tiço (cinto, alças, botas, couro escuro de viagem): `#4A3A2E`

`[A DEFINIR]` Conferir os HEX de osso e couro contra os atlas reais dos pacotes KayKit
Skeletons e Adventurers após o download; ajustar a âncora ao atlas em vez de repintar
(preservar atlas é normativo, canon 4.5). As gamas de fogo e de luz/fog, por serem
nossas (emissivo e luz, não atlas), ficam fixas.

---

## 2. A Acendedora: o traje, de dentro para fora

`[DESIGN]` `[ASSET]` `[NORMATIVO]` Base: KayKit Adventurer, `Rogue_Hooded.glb`
(recomendado pelo canon de narrativa, seção 4.1) ou `Mage.glb` (alternativa). A
recomendação de trabalho é Rogue Hooded pela silhueta de peregrina solitária encapuzada,
com a fagulha como única fonte de luz quente que ela emana; o desempate é do canon de
arte pelo teste de silhueta (seção 6). `[A DEFINIR]` ratificar Mage vs Rogue Hooded.

Biotipo e leitura `[DESIGN]`: mulher, idade indefinida (o custo da fagulha a fez parecer
mais consumida do que é). A proporção é a estilizada do pacote (cabeça relativamente
grande, membros simplificados), mantida sem alteração. A leitura em uma frase: peregrina
encapuzada com um único ponto de luz quente no peito, no breu azul.

### 2.1 Peças, de dentro para fora

Mapeadas sobre o que o modelo Rogue Hooded / Mage já tem; a coluna de cor é a única
intervenção. Nada de peça nova.

1. **Túnica interna (camada de baixo).** O corpo de pano que aparece nas aberturas do
   manto e nas mangas. Material lido: linho-cinza envelhecido `#6E6A63`. Função de
   leitura: é o tom neutro mais claro do traje, que dá um respiro de valor sob o manto
   escuro e impede que a Acendedora vire uma mancha preta na sala fria.
2. **Calça / perneira de viagem.** Pernas cobertas para a descida; couro-tiço `#4A3A2E`
   ou lã-cripta escura `#2E2A33`, dessaturadas. Sem cor de acento: as pernas ficam no
   valor baixo para a leitura subir ao capuz e ao peito.
3. **Cinto e alças de couro.** O cinto da Rogue/Mage e quaisquer correias cruzadas:
   couro-tiço `#4A3A2E` com fecho de bronze patinado `#7A5A2E`. É o único metal quente
   discreto do traje fora do gume. Divide visualmente o manto (acima) das pernas
   (abaixo), reforçando a silhueta vertical.
4. **Manto / túnica externa com capuz (a peça-assinatura).** A peça que define a
   silhueta de peregrina. Material lido: lã-cripta escura `#2E2A33`, valor baixo com leve
   viés azul-frio nas sombras (vertex color) para que a sala fria a "abrace" e o
   contraste com a fagulha seja máximo. O capuz fica erguido por padrão, sombreando o
   rosto: a Acendedora é mais presença e luz que feição.
5. **Capuz (a moldura do rosto).** Parte do manto. Por dentro, um vertex color levemente
   mais quente (`#3A3530` puxando para o âmbar) para que a fagulha do peito devolva um
   calor sutil ao rosto sombreado quando ela está perto do fogo. Lê "há vida sob o
   capuz, mas pouca".
6. **Botas de viagem.** Couro-tiço `#4A3A2E`, cano baixo, sem brilho. Coerentes com a
   descida a pé por pedra fria; nunca metálicas ou ornamentadas.

### 2.2 A fagulha: como a luz se integra ao traje

`[DESIGN]` `[NORMATIVO]` A fagulha é o coração visual da Acendedora e o ponto de
assimetria que a torna reconhecível em preto (canon de silhueta 3). Ela NÃO é um item de
roupa: é a única fonte de luz quente que a heroína emana, e onde ela vai a luz vai. Como
se integra ao traje, em ordem de preferência `[A DEFINIR]` (ratificar com o teste de
silhueta, seção 6, qual carrega melhor a luz):

- **No peito (recomendado).** A fagulha mora no peito da Acendedora como um pequeno
  núcleo de brasa: material emissivo laranja-brasa `#FF7A1A` no centro, halo âmbar
  `#FFA63D`, preso por um engaste de bronze patinado `#7A5A2E` (prop pequeno anexado ao
  osso do peito ou pintado no atlas + emissivo). Casa com a ficção: a fagulha é a luz
  viva dentro dela (narrativa 2.1), não uma tocha que se passa de mão. Vantagem de
  silhueta: o ponto de luz fica centrado e estável, lido de qualquer ângulo.
- **Na mão / palma (alternativa Mage).** Se a base for Mage, a fagulha pode arder na
  palma como magia de fogo, encaixando na pose de conjuração do pacote. Mesma paleta
  emissiva. Vantagem: leitura clara de "portadora de luz"; desvantagem: a luz balança
  com a mão, menos estável na silhueta e some quando o braço está atrás do corpo.
- **Em tocha / lampião (alternativa).** Prop de fogo anexado à mão (catálogo KayKit).
  Encaixa Rogue, mas o canon de glossário diferencia tocha (prop de parede menor) do que
  a heroína carrega; se usada, é a fagulha PRESA num lampião, não uma tocha qualquer.

`[DESIGN]` `[NORMATIVO]` Seja qual for o ponto de anexo, a regra da gangorra (direção de
arte 2) manda: no estado frio da sala, a fagulha é o ÚNICO ponto quente num mar azul, um
halo âmbar `#FFA63D` pequeno que viaja com a Acendedora e ilumina só o que está perto,
sem dissolver a tensão do escuro. É a promessa visual do braseiro que virá. A luz da
fagulha é vendida por emissivo + uma luz pontual barata (sombra desligada), nunca por
iluminação realista (canon 4.4).

`[ASPIRACIONAL]` Conforme a descida e o custo da fagulha (narrativa 4.3), a heroína pode
parecer mais consumida: o vertex color do rosto/mãos puxa para um cinza mais apagado nos
andares fundos, e a fagulha pode oscilar de intensidade. Mood, não bloqueia o aceite.

### 2.3 Leitura de silhueta da Acendedora

`[DESIGN]` `[NORMATIVO]` Silhueta vertical, esguia, encapuzada, com um único ponto de
assimetria: a fagulha. Em preto sólido, a média distância e sob luz baixa, lê-se "pessoa
de pé, encapuzada, com uma luz". O capuz erguido é a marca de contorno (peregrina/
sacerdotisa), e o ponto quente da fagulha é o que distingue a Acendedora de qualquer
outra figura encapuzada. Não pode ser confundida com um esqueleto (contorno cheio, não
vazado) nem com o Guardião (porte menor, mais leve). Ver teste em preto na seção 6.

---

## 3. Os mortos despertos: vestir o mesmo esqueleto para diferenciar inimigos

`[DESIGN]` `[ASSET]` `[NORMATIVO]` Base única: KayKit Character Pack Skeletons, esqueleto
e biblioteca de animação compartilhados (canon 4.3, 5). TODOS os inimigos comuns saem
desta mesma malha; a diferenciação NÃO vem de corpos diferentes, vem de:
1. arma e escudo anexados (prop por osso da mão),
2. peça de armadura/mortalha trocada por cor de atlas,
3. porte/escala dentro de uma janela estreita (não quebrar a animação compartilhada),
4. cor de osso (mais limpo nos recentes, mais encardido nos antigos) e cor/intensidade
   do brilho espectral dos olhos.

Essa é a alavanca central de leitura de inimigo em Brasa: o mesmo esqueleto vira muitos
inimigos pela COR e pela ARMA, sem custo de malha nova. O KayKit Skeletons já traz as
variantes de arma (espada, escudo, arco, lança, machado, dois punhos) prontas como props
encaixáveis.

### 3.1 Leitura de silhueta dos esqueletos

`[DESIGN]` `[NORMATIVO]` Silhueta angular, vazada, "lacunosa": os espaços entre os ossos
quebram o contorno e os distinguem de um humano vivo mesmo em preto. A diferenciação de
silhueta entre variantes é carregada pela ARMA e pelo PORTE no contorno, não pelo corpo:
- com escudo: contorno cheio de um lado (alvo de guarda),
- com arco: silhueta mais aberta, perfil de atirador,
- com lança/haste longa: linha diagonal longa saindo do corpo,
- de dois punhos / arma grande: ombros e braços mais marcados.

`[NORMATIVO]` Nenhum esqueleto pode ser confundido com a Acendedora (que tem contorno
cheio e o ponto quente da fagulha) nem com o Guardião (maior, mais largo, mais pesado).

### 3.2 Variantes por tipo de morto desperto (categorias da narrativa)

`[DESIGN]` As três categorias da ficção (narrativa 3.1) viram três famílias de leitura,
cada uma resolvida por cor + arma + brilho, todas sobre o mesmo esqueleto.

**Os Mansos (câmaras de cima): os mortos recentes e comuns.**
- Osso: osso-base `#D8CFB8`, ainda relativamente limpo (mortos há pouco).
- Mortalha/pano: faixas de tecido apodrecido `#3A3530`, esparsas, restos de roupa comum
  do reino enrolada no corpo. Pouca cobertura: lê "gente comum, recém-selada".
- Arma: improvisada e pobre, prop simples do pacote (porrete, faca curta, mãos nuas, ou
  uma espada velha). Sem escudo, ou escudo de madeira lascada.
- Metal: ferro frio `#5A6470` apagado, sem realce; são os mais fracos.
- Olhos/runas espectrais: ciano-espectral `#5FB7C9` de baixa intensidade, brilho fraco.
  Eles "acabaram de despertar".
- Porte: padrão. Leitura: o primeiro inimigo, o mais inofensivo, o mais humano dos
  mortos.

**Os Antigos (câmaras fundas): mortos de gerações distantes, guerreiros e servos.**
- Osso: osso-encardido `#A39A82`, escurecido nas cavidades por vertex color (mais velhos,
  mais tempo no escuro).
- Mortalha/pano: mais escura e mais degradada, ou substituída por peças de armadura
  antiga trocadas por cor (couro escuro `#4A3A2E`, placas de bronze patinado `#7A5A2E`).
  Lê "guerreiro de outra era".
- Arma: completa e de guerra, prop do pacote (espada + escudo, lança, machado, arco).
  Aqui entra a variedade de arma como diferenciador de SUBTIPO de inimigo no mesmo andar:
  esqueleto-espadachim (espada + escudo), esqueleto-lanceiro (haste longa, alcance),
  esqueleto-arqueiro (arco, ataca à distância), esqueleto-bruto (arma grande de dois
  punhos, mais dano e telegrafia mais lenta).
- Metal: ferro frio `#5A6470` com realce de gume `#C98A3A` quando pega a luz da fagulha/
  braseiro. Mais perigosos, leem "armados de verdade".
- Olhos/runas: ciano-espectral `#5FB7C9` mais intenso que os Mansos.
- Porte: igual ou levemente maior (dentro da janela que não quebra a animação).

**As Sentinelas (câmaras da origem): antigas guardiãs e acólitas da ordem.**
- Osso: osso-encardido `#A39A82`, mas com um tratamento "errado": leve emissivo frio nas
  juntas/inscrições, como se a ordem ainda ardesse fria neles. Carregam "ecos do que a
  heroína é" (narrativa 3.1).
- Mortalha/pano: capuz e manto que ECOAM o traje da Acendedora (mesmo corte de capuz,
  mesma silhueta de peregrina), porém em tecido apodrecido `#3A3530` e azul-ardósia
  `#1F3247`, sem nenhuma fagulha quente: a luz delas é ciano-espectral `#5FB7C9`, fria,
  onde a da Acendedora é âmbar. Esse espelho frio é o gancho de tom: o jogador luta
  contra alguém como ela (narrativa 5.3). Onde a Acendedora tem fagulha quente no peito,
  a Sentinela tem um ponto frio espectral.
- Arma: a mais elaborada e a mais perigosa antes do chefe; pode espelhar uma arma ritual
  da ordem (cajado, lâmina de cerimônia) por escolha de prop do pacote.
- Olhos/runas: ciano-espectral `#5FB7C9` no pico de intensidade entre os comuns.
- Porte: o maior entre os inimigos comuns, ainda abaixo do Guardião.

`[ASPIRACIONAL]` Profundidade do andar lida no figurino: quanto mais fundo, mais
encardido o osso, mais degradada e mais fria a mortalha, mais intenso o brilho espectral.
A roupa conta a idade do morto sem uma linha de texto.

`[A DEFINIR]` Quais props de arma exatos o KayKit Skeletons traz (confirmar no pacote
após baixar) e quais subtipos entram no vertical slice (proposta: espadachim, lanceiro,
arqueiro, bruto). Mapear cada subtipo ao comportamento na FSM (`enemies/skeleton.ts`).

---

## 4. O Guardião: a aparência do chefe

`[DESIGN]` `[ASSET]` `[NORMATIVO]` Base: KayKit Skeletons, variante maior / o "boss" do
pacote, ou um esqueleto comum reescalado e revestido (3k-6k tris, canon 4.2). Mesmo
esqueleto e mesma animação base dos comuns, para não carregar conjunto novo; a
diferenciação é toda de PORTE, COR, ARMA GRANDE e UMA MARCA DE FASE legível no contorno
(direção de arte 3).

Ficção que o figurino serve `[DESIGN]`: o Guardião é o Guardião da Brasa apagada, voz
antiga e grave, de dever amargo e luto, não de ódio (glossário; narrativa 1.5). A
proposta narrativa forte (narrativa 5.4, `[A DEFINIR]`) é que o Guardião foi uma
Acendedora anterior (a Primeira, ou a última antes desta) que desceu, deu a fagulha à
Brasa e ficou presa, virando guardiã exausta e prisioneira da chama. O traje deve deixar
essa tragédia legível: ele é o que a Acendedora pode se tornar.

### 4.1 Peças e leitura do Guardião

- **Porte e silhueta.** Maior, mais largo e mais pesado que qualquer inimigo comum. Em
  preto, lê "isto é o chefe" antes de qualquer cor (canon de silhueta 3). A marca de fase
  no contorno é um braseiro apagado embutido no peito/torso (ver abaixo) ou uma arma
  grande de assinatura.
- **Osso.** Osso-encardido `#A39A82`, o mais antigo e desgastado de todos, com oclusão
  pesada nas cavidades por vertex color. Ele é o mais velho dos mortos.
- **Manto/mortalha.** Um manto pesado que ecoa o da Acendedora, mas em ruína: lã-cripta
  escura `#2E2A33` e azul-ardósia `#1F3247`, esfarrapado, longo, que aumenta a massa da
  silhueta. Se a leitura "ele foi uma Acendedora" for ratificada, o corte do capuz/manto
  cita o traje da heroína, fechando o espelho temático.
- **O braseiro apagado embutido (a marca de fase).** No peito do Guardião, onde a
  Acendedora carrega a fagulha quente, o Guardião carrega um braseiro/engaste APAGADO:
  metal bronze patinado `#7A5A2E` e ferro frio `#5A6470`, com a luz morta. É o coração
  visual do chefe: a fagulha que ele já entregou, o calor que se esgotou. Esse é o ponto
  de leitura de fase.
- **Olhos/runas.** Ciano-espectral `#5FB7C9`, mas mais profundo e mais intenso que
  qualquer Sentinela: a luz fria mais forte do elenco.
- **Arma.** Grande, de assinatura, prop do pacote (lâmina pesada, maça, cajado-arma).
  Ferro frio `#5A6470` com realce aquecido `#C98A3A` quando pega a luz dos braseiros da
  arena. Pesada o bastante para justificar a telegrafia lenta do moveset de chefe.

### 4.2 Leitura de fase por cor `[DESIGN]` `[ASPIRACIONAL]`

A leitura de fase do chefe (régua de detalhe: chefe lido por silhueta/cor) é resolvida
por cor e emissivo, não por troca de malha:
- Fase 1 (frio pleno): braseiro do peito morto, runas ciano `#5FB7C9` calmas.
- Fase 2 (agitado/ferido): as runas pulsam mais intensas; o gume da arma esquenta
  (`#C98A3A`) ao golpear perto dos braseiros acesos da arena.
- Momento de rendição/derrota: coerente com o tom (mortos retornam ao repouso, sem gore,
  guia de estilo 1.6), o Guardião não explode: a luz fria se apaga, o braseiro do peito
  pode receber por um instante um âmbar `#FFA63D` (a fagulha devolvida) e ele tomba/
  dissolve em pó iluminado pela brasa. É luto, não troféu.

`[A DEFINIR]` Ratificar a identidade do Guardião (era a Primeira Acendedora? a anterior?)
porque ela decide o quanto o manto cita o traje da heroína. Confirmar se o pacote KayKit
Skeletons traz uma variante grande pronta ou se o Guardião é um esqueleto comum
reescalado + manto + arma grande.

---

## 5. Coerência de paleta com a direção de arte: a regra frio contra quente

`[DESIGN]` `[NORMATIVO]` Todo o figurino obedece à assinatura cromática do canon
(direção de arte 2): azul e laranja quase nunca aparecem na mesma saturação ao mesmo
tempo. Aplicado ao vestuário:

- **A Acendedora é o calor; o resto é frio.** O único quente saturado que ela carrega é
  a fagulha (e o gume aquecido quando pega a luz). Seu pano é dessaturado e de valor
  baixo justamente para que a fagulha seja sempre o ponto mais quente da tela. Os mortos
  e o Guardião não têm NENHUM quente próprio: a luz deles é ciano-espectral frio.
- **A gangorra por estado de sala.** Na sala fria (selada, mortos despertando), o
  figurino da Acendedora some no azul ambiente e só a fagulha arde; os esqueletos leem
  azul-acinzentados com olhos ciano. Quando o braseiro acende e a sala vira quente, o
  pano da Acendedora ganha faces âmbar, o couro e o bronze esquentam, e o azul recua para
  as dobras e sombras. O figurino é pintado pela luz da sala, não por cor própria
  saturada.
- **Pano neutro recebe a temperatura.** Os tons de pano (lã-cripta `#2E2A33`,
  linho-cinza `#6E6A63`, couro-tiço `#4A3A2E`) são deliberadamente neutros e de valor
  baixo: existem para RECEBER o frio ou o quente da luz da sala, como a pedra modular
  faz. A cor do traje quase nunca é o protagonista; a luz é.
- **Emissivo é o único quente garantido.** Mesmo quando a luz da sala está barata, o
  emissivo carrega a cor: a fagulha sempre arde âmbar, os olhos dos mortos sempre brilham
  ciano. Emissivo só no fogo e no espectral, com parcimônia, para que o fogo seja sempre
  o ponto mais quente da tela (direção de arte 5).
- **Os Santuários do Braseiro podem ter um acento frio sagrado.** Coerente com a exceção
  aspiracional do canon (direção de arte 2.1), o figurino das Sentinelas guardiãs nesses
  andares pode permitir o ciano-espectral `#5FB7C9` como "presença" antiga, sem quebrar a
  gangorra (continua frio, não introduz quente concorrente).

---

## 6. Tradução low-poly e teste de silhueta

`[DESIGN]` `[NORMATIVO]` Como não modelamos nada, a tradução low-poly aqui é a disciplina
de fazer a leitura caber no que o atlas e o vertex color permitem, dentro do orçamento:

- **Tecido, capuz, mortalha:** vêm prontos na malha KayKit (planos largos, poucas
  dobras). O "tecido" é vendido por gradiente de sombreamento e vertex color (dobra mais
  escura, barra mais clara), nunca por simulação. Sem cloth dinâmico caro: o que esvoaçar
  (barra do manto da Acendedora, manto do Guardião) é resolvido pela animação do pacote
  ou por uma cadeia curta de ossos (`springBoneChain` já existe no motor), não por
  solver de pano. No máximo o herói e o chefe têm movimento de pano falseado; os
  esqueletos comuns ficam rígidos.
- **Osso, faixa, mortalha rasgada:** textura/atlas do pacote Skeletons sobre malha lisa;
  o "encardido" e o "rasgado" são vertex color e cor de atlas, não geometria nova.
- **Metal (armas, fechos, braseiro do peito):** cor chapada + realce aquecido pintado/
  emissivo quando pega a luz; sem mapas PBR.
- **Reuso é a espinha dorsal:** uma malha de esqueleto + catálogo de armas-prop + vertex
  color + troca de material por slot cobre os Mansos, os Antigos, as Sentinelas e a base
  do Guardião. Uma malha de Adventurer cobre a Acendedora. O elenco inteiro de Brasa sai
  de duas bases + props + cor.

### 6.1 Teste de silhueta em preto `[NORMATIVO]`

Critério verificável (direção de arte 3.1): renderizar cada ator em preto chapado sobre
fundo neutro e identificar a classe sem cor nem textura.
- Acendedora: vertical, encapuzada, contorno cheio, com o ponto da fagulha.
- Esqueleto: angular, vazado, lacunoso; subtipo lido pela arma/porte no contorno.
- Guardião: maior, mais largo e pesado que qualquer comum, com a marca de fase no
  contorno (arma grande ou braseiro do peito).

Aprova se um observador distingue Acendedora / esqueleto / Guardião sem cor. Esqueletos
não podem ser confundidos com a Acendedora; o Guardião não pode ser confundido com um
esqueleto comum aumentado. Reprovou, ajusta-se porte, pose-base, arma ou acessório de
silhueta antes de seguir (nunca remodelando o corpo).

---

## 7. Kits de vestuário para o vertical slice

`[DESIGN]` `[ASSET]` Fichas-resumo, no formato de kit, prontas para a montagem.

KIT A - ACENDEDORA (heroína jogável):
- Base: KayKit Adventurer `Rogue_Hooded.glb` (recomendado) ou `Mage.glb`. `[A DEFINIR]`.
- Túnica interna linho-cinza `#6E6A63`; manto/capuz lã-cripta escura `#2E2A33`; pernas e
  botas couro-tiço `#4A3A2E`; cinto couro com fecho bronze `#7A5A2E`.
- Fagulha: núcleo emissivo laranja-brasa `#FF7A1A`, halo âmbar `#FFA63D`, no peito
  (recomendado) ou na mão (Mage). Único quente da heroína; luz pontual barata,
  sombra desligada.
- Leitura: peregrina encapuzada com um ponto de luz no peito; a luz É a personagem.

KIT B - ESQUELETO COMUM (inimigo, 3 famílias + subtipos por arma):
- Base: KayKit Skeletons, esqueleto e animação compartilhados. Diferenciação por cor +
  arma + porte + brilho dos olhos, nunca por corpo novo.
- Mansos: osso-base `#D8CFB8` limpo, mortalha esparsa `#3A3530`, arma pobre, olhos ciano
  fraco `#5FB7C9`.
- Antigos: osso-encardido `#A39A82`, armadura por cor (couro/bronze), arma de guerra
  completa (espadachim/lanceiro/arqueiro/bruto), gume com realce `#C98A3A`, olhos ciano
  intenso.
- Sentinelas: osso-encardido com inscrições frias, capuz/manto ecoando a Acendedora em
  azul-ardósia `#1F3247` e ponto FRIO no peito (não fagulha), arma ritual, olhos ciano no
  pico.
- Leitura: morto vazado e lacunoso; idade e perigo lidos pela cor e pela arma.

KIT C - GUARDIÃO (chefe único):
- Base: KayKit Skeletons variante grande ou comum reescalado (3k-6k tris). `[A DEFINIR]`.
- Osso-encardido `#A39A82` (o mais antigo); manto pesado em ruína `#2E2A33`/`#1F3247`
  citando a Acendedora; braseiro APAGADO embutido no peito (bronze `#7A5A2E` + ferro frio
  `#5A6470`, luz morta) como marca de fase; arma grande de assinatura; olhos ciano
  `#5FB7C9` no máximo do elenco.
- Derrota por elipse: a luz fria apaga, um instante de âmbar `#FFA63D` no peito (fagulha
  devolvida), tomba/dissolve em pó iluminado. Luto, não troféu.
- Leitura: maior, mais pesado, tragédia legível (ele é o que a Acendedora pode virar).

---

## Checklist de aceite (Definition of Done)

`[NORMATIVO]` Cada item recebe sim/não honesto. `[ASPIRACIONAL]` orienta mas não bloqueia;
`[A DEFINIR]` em aberto impede o "pronto" ou vira adiamento registrado. Ver
padrao-de-detalhe seções 1, 2.2 e 4.

### Princípio: vestir sem remodelar (seção 0)
- [ ] Nenhum corpo, pano ou peça de roupa foi remodelado/esculpido; toda intervenção é
      cor de atlas, vertex color, emissivo ou prop anexado [DESIGN][NORMATIVO]
- [ ] Sem PBR pesado e sem textura 2K/4K nova por asset fora de exceção registrada
      [DESIGN][NORMATIVO]
- [ ] Acendedora sobre KayKit Adventurer (Rogue Hooded/Mage); mortos e Guardião sobre
      KayKit Skeletons; todos no esqueleto e animação compartilhados [ASSET][NORMATIVO]

### Acendedora (KIT A, seção 2)
- [ ] Peças nomeadas de dentro para fora: túnica interna, calça/perneira, cinto/alças,
      manto com capuz, capuz, botas [DESIGN][NORMATIVO]
- [ ] Paleta de pano dentro das âncoras: linho-cinza `#6E6A63`, lã-cripta `#2E2A33`,
      couro-tiço `#4A3A2E`, fecho bronze `#7A5A2E` [DESIGN][NORMATIVO]
- [ ] Fagulha presente como único quente saturado da heroína, emissivo laranja-brasa
      `#FF7A1A` / âmbar `#FFA63D`, com luz pontual de sombra desligada [DESIGN][NORMATIVO]
- [ ] No estado frio da sala, a fagulha é o único ponto quente num mar azul (regra da
      gangorra) [DESIGN][NORMATIVO]
- [ ] Capuz erguido por padrão; silhueta vertical encapuzada com ponto de luz no peito
      [DESIGN][NORMATIVO]
- [ ] `[A DEFINIR]` ratificado: Mage vs Rogue Hooded e ponto de anexo da fagulha (peito/
      mão/lampião) [A DEFINIR]

### Mortos despertos (KIT B, seção 3)
- [ ] Todos os esqueletos saem da mesma malha; diferenciação por cor + arma + porte +
      brilho dos olhos, nunca por corpo novo [DESIGN][NORMATIVO]
- [ ] Mansos: osso-base `#D8CFB8` limpo, mortalha esparsa `#3A3530`, arma pobre, olhos
      ciano `#5FB7C9` fracos [DESIGN][NORMATIVO]
- [ ] Antigos: osso-encardido `#A39A82`, armadura por cor (couro `#4A3A2E`/bronze
      `#7A5A2E`), arma de guerra, gume com realce `#C98A3A`, olhos ciano intensos
      [DESIGN][NORMATIVO]
- [ ] Subtipos por arma legíveis na silhueta: espadachim, lanceiro, arqueiro, bruto
      [DESIGN][NORMATIVO]
- [ ] Sentinelas: capuz/manto que ecoam a Acendedora em azul-ardósia `#1F3247`, ponto
      FRIO no peito (não fagulha), olhos ciano no pico [DESIGN][NORMATIVO]
- [ ] Nenhum morto tem quente saturado próprio; a luz deles é ciano-espectral fria
      [DESIGN][NORMATIVO]
- [ ] `[A DEFINIR]` confirmado: props de arma do pacote KayKit Skeletons e subtipos do
      slice mapeados na FSM [A DEFINIR]

### Guardião (KIT C, seção 4)
- [ ] Maior, mais largo e pesado que qualquer comum; mesmo esqueleto/animação base
      [ASSET][NORMATIVO]
- [ ] Osso-encardido `#A39A82` (o mais antigo); manto pesado em ruína `#2E2A33`/`#1F3247`
      [DESIGN][NORMATIVO]
- [ ] Braseiro APAGADO embutido no peito (bronze `#7A5A2E` + ferro frio `#5A6470`, luz
      morta) como marca de fase no contorno [DESIGN][NORMATIVO]
- [ ] Arma grande de assinatura com gume que esquenta `#C98A3A` perto dos braseiros
      [DESIGN][NORMATIVO]
- [ ] Olhos ciano `#5FB7C9` no máximo de intensidade do elenco [DESIGN][NORMATIVO]
- [ ] Derrota por elipse (apaga, instante de âmbar, dissolve em pó), sem gore
      [DESIGN][NORMATIVO]
- [ ] Leitura de fase por cor/emissivo, sem troca de malha [DESIGN][ASPIRACIONAL]
- [ ] `[A DEFINIR]` ratificado: identidade do Guardião (quanto o manto cita a heroína) e
      variante grande do pacote vs reescala [A DEFINIR]

### Coerência de paleta frio contra quente (seção 5)
- [ ] Azul e laranja nunca na mesma saturação ao mesmo tempo; gangorra por estado de sala
      visível no figurino [DESIGN][NORMATIVO]
- [ ] Pano da Acendedora dessaturado e de valor baixo, recebendo a temperatura da luz; só
      a fagulha (e gume aquecido) é o quente [DESIGN][NORMATIVO]
- [ ] Emissivo restrito a fagulha, gume aquecido e olhos/runas espectrais [DESIGN][NORMATIVO]
- [ ] `[A DEFINIR]` HEX de osso e couro conferidos contra os atlas reais do KayKit
      (ajustar âncora ao atlas, não repintar) [A DEFINIR]

### Tradução low-poly e silhueta (seção 6)
- [ ] Tecido/capuz/mortalha vendidos por gradiente e vertex color, sem simulação cara de
      pano; cloth falseado só no herói e no chefe [DESIGN][NORMATIVO]
- [ ] Osso/faixa/metal em cor chapada + atlas + vertex color, sem geometria nova nem mapas
      PBR [DESIGN][NORMATIVO]
- [ ] Reuso: duas bases (Adventurer + Skeleton) + props de arma + cor cobrem o elenco
      inteiro [DESIGN][NORMATIVO]
- [ ] Teste de silhueta em preto aprovado: Acendedora, esqueleto (com subtipos) e Guardião
      distinguíveis sem cor nem textura [DESIGN][NORMATIVO]

### Orçamento técnico (canon seção 4.2)
- [ ] Acendedora 1k-5k tris; esqueleto comum 1k-3k; Guardião 3k-6k [NORMATIVO]
- [ ] Esqueletos comuns instanciados da mesma malha; < 60 draw calls por sala mantido
      [NORMATIVO]
- [ ] Cada `.glb` novo passou por `optimize_asset.py` + `validate_gltf.py` (escala, Y-up,
      atlas preservado, KTX2/Draco quando compensar) [NORMATIVO]
- [ ] 60 fps desktop / 30 fps mobile médio mantidos com o elenco em tela [NORMATIVO]

### Higiene de processo
- [ ] Nenhum asset, prop, cor ou peça de Josué/deserto/bíblico aparece no figurino de
      Brasa [DESIGN][NORMATIVO]
- [ ] Vocabulário do glossário respeitado (Acendedora, Guardião, esqueleto, mortos
      despertos, fagulha, braseiro) e capitalização correta [NORMATIVO]
- [ ] Sem travessões, sem emojis em qualquer texto exibido (guia de estilo 1.2)
      [NORMATIVO]
- [ ] Itens [A DEFINIR] resolvidos ou explicitamente adiados com registro [NORMATIVO]
