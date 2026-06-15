# Técnica: Anatomia Humana para Modelagem de Personagens

Estudo de anatomia aplicada à modelagem de personagens 3D, para que Josué e o elenco
pareçam pessoas de verdade (silhueta, proporção, traços de rosto e corpo) e deformem bem
quando animados. Complementa [`direcao-de-arte.md`](direcao-de-arte.md) (estilo low-poly
estilizado quente), as bíblias de [personagens](personagens/00-indice.md) (que descrevem
físico e movimento de cada um) e [`tecnica-graficos-fisica.md`](tecnica-graficos-fisica.md)
seção 7 (animação). A deformação de roupas tem documento próprio:
[`tecnica-deformacao-de-tecidos.md`](tecnica-deformacao-de-tecidos.md).

Princípio que guia tudo: o que faz uma forma "ler" como humana não é contagem de polígonos,
é proporção correta, marcos anatômicos nos lugares certos e uma silhueta legível. Um
boneco low-poly com proporção certa parece gente; um modelo denso com proporção errada
parece grotesco. Por isso este documento prioriza medidas e marcos, não detalhe.

---

## 1. Proporções do corpo (a cabeça como unidade de medida)

A convenção universal de desenho e modelagem mede o corpo em "cabeças" (head units, Hu): a
altura da cabeça (do topo do crânio à base do queixo) é a régua.

- Adulto realista: 7,5 cabeças de altura. Idealizado/heroico: 8 cabeças (e até 8,5 para
  super-herói). Abaixo de 7 começa a ler como "atarracado/estilizado".
- Por idade: adulto 7,5-8; adolescente 6-7; criança 5,5-6; bebê 3-4. A criança não é um
  adulto em miniatura: a cabeça é proporcionalmente enorme.

Marcos verticais (homem adulto, ~7,5-8 cabeças), de cima para baixo:
- 0: topo da cabeça.
- 1 cabeça: queixo.
- ~1,3: linha dos ombros (base do pescoço/acrômio).
- 2: linha dos mamilos / parte de baixo do peitoral.
- 3: umbigo / cintura natural (fim da caixa torácica).
- ~3,5-4: virilha (o meio do corpo no adulto fica perto da virilha, não do umbigo).
- 4: ponta dos dedos com o braço relaxado / base da pelve.
- ~5,5: joelho.
- 7,5-8: solo (planta do pé).

Larguras e segmentos (homem adulto):
- Ombros: os mais largos do corpo, ~2 a 3 cabeças de largura (no homem ~2-2,3; quanto mais
  largo, mais heroico). Esse é o marcador nº 1 de dimorfismo masculino.
- Caixa torácica: ~1,5-2 cabeças de largura; ovo torácico inclinado.
- Pelve: ~1-1,5 cabeças de largura. No homem a pelve é mais estreita que os ombros (silhueta
  em V invertido moderado); na mulher pelve e ombros se aproximam (silhueta mais em
  ampulheta).
- Braço inteiro (ombro à ponta do dedo): ~3 cabeças. Úmero (braço) ~1,3-1,5; antebraço
  ~1,2; mão ~0,75 (a mão cobre o rosto do queixo à testa).
- Perna: fêmur ~2 cabeças, canela (joelho ao chão) ~2. A perna é ~metade da altura total.
- Pé: ~1 cabeça de comprimento (de lado). Pescoço: ~0,3-0,5.

Dimorfismo (homem x mulher), além de ombros/pelve: homem tem mandíbula mais quadrada,
sobrancelha mais baixa e pesada, pescoço mais grosso, mãos/pés maiores; mulher tem cintura
mais marcada, membros proporcionalmente um pouco mais finos e traços mais suaves. Tratar
como tendências, não regras.

---

## 2. Massas e marcos anatômicos (o que sugerir, mesmo em low-poly)

Não se modela músculo por músculo; modelam-se as grandes massas e os marcos ósseos que
aparecem sob a pele. Em low-poly, sugerir essas massas com poucos planos já lê como corpo.

Grandes massas (do tronco aos membros):
- Caixa torácica: um "ovo" inclinado para frente. Define o peito e as costas.
- Pelve: um bloco/balde, inclinado em sentido oposto à caixa torácica. Entre os dois fica a
  cintura flexível (a única parte mole do tronco).
- Ombro: o deltoide é uma "almofada" arredondada que cobre a junta; o trapézio liga pescoço
  a ombro num diagonal. Errar o ombro é o erro que mais "robotiza" um personagem.
- Coxa e panturrilha como duas massas fusiformes (gordas no meio, finas nas pontas); a
  panturrilha interna desce mais que a externa.
- Braço: bíceps/tríceps como fuso; antebraço grosso perto do cotovelo, afina no pulso.

Marcos ósseos visíveis (úteis para posicionar planos): clavículas (V na base do pescoço),
sulco do esterno, espinha ilíaca (os dois "ossos do quadril" à frente), patela (joelho),
maléolos (tornozelo), cotovelo, processo do punho.

Gesto e linha de ação: todo corpo vivo tem uma curva dominante (a "line of action") e
peso assimétrico (contrapposto: quadril de um lado sobe, ombro do mesmo lado desce). Uma
pose 100% simétrica e reta lê como manequim. Mesmo em idle, dar um leve contrapposto e
respiração vende vida mais que qualquer detalhe de malha.

---

## 3. Proporções e construção do rosto (método Loomis)

O rosto é onde o olho humano é mais exigente; pequenas proporções erradas viram "estranho".
O método de Andrew Loomis constrói a cabeça a partir de formas simples e marcos medidos.

Construção da cabeça: uma esfera (o crânio) com as laterais achatadas, mais o bloco da
mandíbula/queixo pendurado embaixo. A cabeça não é uma bola: é mais alta que larga e mais
profunda que larga.

Os terços do rosto (de frente), iguais entre si:
- da linha do cabelo à sobrancelha;
- da sobrancelha à base do nariz;
- da base do nariz à base do queixo.

Marcos horizontais:
- Os olhos ficam na metade da altura da cabeça (erro clássico: colocá-los alto demais).
- A largura do rosto é ~5 olhos; o espaço entre os olhos é 1 olho.
- A base do nariz é ~1 olho de largura (asas do nariz alinhadas com os cantos internos dos
  olhos).
- A boca: os cantos costumam alinhar com o centro das pupilas; a linha entre os lábios fica
  ~1/3 da distância do nariz ao queixo.
- As orelhas vão da linha da sobrancelha à base do nariz (entre os dois terços do meio).

Planos do rosto: pensar a face em planos (frente, laterais, plano de baixo do nariz, plano
do maxilar) dá estrutura mesmo com pouca geometria. As "quinas" entre planos (maçãs do
rosto, arco da sobrancelha, ângulo da mandíbula) são o que dá definição masculina. Para o
Josué (mandíbula marcada, sobrancelha grossa e reta, maçãs definidas, nariz reto), exagerar
levemente esses planos é o que o faz ler como "comandante" e não como rosto genérico.

---

## 4. Mãos e pés (resumo)

- Mão: a palma é ~quadrada; os dedos somam ~o mesmo comprimento da palma; o polegar opõe e
  parte mais abaixo. Em low-poly, uma "mitene" (polegar separado, demais dedos juntos) já
  funciona a distância; dedos separados só em close.
- Pé: cunha com arco interno; o calcanhar é uma massa; os dedos ocupam só a ponta. Para
  sandálias do projeto, modela-se o volume do pé e a tira por cima.

---

## 5. Topologia e deformação (por que a malha precisa de "loops")

Quando o personagem é animado por esqueleto, a malha precisa dobrar sem amassar. A regra de
ouro: edge loops em volta de cada junta, acompanhando como ela dobra.

- Joelho e cotovelo (dobram num eixo só): três loops na dobra (um na prega + dois de apoio
  dos lados). Sem isso, o membro "estrangula" ao dobrar.
- Ombro, quadril, pulso, tornozelo, pescoço, base dos dedos: zonas de alta deformação;
  concentrar geometria ali, deixar áreas rígidas (caixa torácica, crânio) com poucos
  polígonos.
- Edge flow: os loops devem seguir os músculos e as pregas naturais; loops que circundam o
  membro permitem o "pinch" controlado da dobra. Evitar triângulos e polos (vértices com
  muitos edges) nas zonas que dobram.

Para low-poly: a estratégia é "põe a geometria onde dobra". Um braço pode ser quase um tubo,
desde que tenha alguns loops no cotovelo. Isso casa com o orçamento web (personagem
1k-5k tris, ver [`tecnica-graficos-fisica.md`](tecnica-graficos-fisica.md) seção 9).

---

## 6. Tradução para low-poly estilizado (web)

- Silhueta primeiro: o personagem tem de ser reconhecível em preto (eco de
  [`biblia-vestuario.md`](biblia-vestuario.md) seção 6). Proporção e silhueta carregam o
  realismo; o detalhe entra por normal map e textura, não por malha.
- Smooth vs flat shading: para corpo/rosto, usar normais suavizadas (smooth) para a malha
  baixa não parecer facetada; usar flat/hard edges de propósito só em metal, pedra e
  cristas duras. Misturar (smoothing groups) é o segredo do "low-poly que não parece de
  papelão".
- Formas-base orgânicas: preferir esferas, cápsulas e cilindros com afunilamento (taper)
  no lugar de caixas para membros e tronco; a quina dura é o que faz parecer robô. Cápsula
  para membros dá juntas arredondadas de graça.
- Exagero controlado: estilizado pede leve exagero dos marcos (mandíbula, ombros, mãos) e
  simplificação do resto. Exagero coerente lê como "estilo"; proporção aleatória lê como
  "erro".
- Olhos e boca: mesmo simplificados, têm de estar na posição certa (seção 3). Em low-poly,
  muitas vezes melhor sugerir órbita/sobrancelha/lábio com plano e cor do que cravar
  detalhe que vai brigar com a resolução.

Limite honesto do procedural por primitivas: empilhar caixas/cápsulas por código chega num
"manequim estilizado" decente, mas não numa pessoa fotorrealista. Para um humano
convincente de verdade, o caminho é uma malha esculpida e retopologizada, riggada a um
esqueleto (o plano do projeto: Synty/Quaternius + Mixamo com retarget, ver
[`spec-prototipo-jerico.md`](spec-prototipo-jerico.md) seção 9 e
[`ferramentas-e-assets.md`](ferramentas-e-assets.md)). Este estudo serve tanto para guiar o
gray-box procedural quanto para avaliar/ajustar um modelo pronto.

---

## 7. Aplicação ao Josué (alvos concretos)

Da bíblia ([`personagens/01-lideres-israelitas.md`](personagens/01-lideres-israelitas.md)
1.3): ~1,75-1,78 m, mesomorfo atlético, ombros largos, V moderado, "soldado de campo, não
fisiculturista", porte ereto, pescoço/trapézio fortes.

Tradução para medidas (alvo ~1,76 m, 7,5 cabeças, cabeça ~0,235 m):
- Ombros: ~2,2 cabeças de largura (~0,52 m) - largos, mas sem exagero de herói de quadrinho.
- Cintura: ~1,2 cabeças; V moderado (ombro/cintura ~1,8).
- Pernas começam em ~0,9 m do chão (metade do corpo perto da virilha).
- Joelho ~0,48 m; barra da túnica na altura do joelho (coerente com o KIT A).
- Braços relaxados com as mãos chegando ~0,75 m do chão.
- Cabeça: mais alta que larga; mandíbula marcada e sobrancelha pesada (planos exagerados);
  barba aparada cobrindo o terço inferior; olhos na metade da altura da cabeça.
- Massas a sugerir mesmo sob o equipamento: deltoides (sob os pauldrons de escama), peito,
  panturrilhas (pernas à mostra abaixo do joelho), antebraços (mangas curtas).
- Postura: leve contrapposto e respiração no idle; passada longa e firme, tronco estável
  (linguagem corporal da bíblia 1.6), nunca rígido e simétrico.

---

## Fontes

Proporções do corpo
- https://anatomy4sculptors.com/blog/about-human-proportions-calculator/
- https://cgtyphoon.com/fundamentals/proportions-of-the-male-human-body/
- https://www.cs22.space/character-proportions
- https://www.whizzystudios.com/post/how-to-achieve-realistic-proportions-in-3d-character-modeling
- https://www.creativecomicart.com/measuring-human-proportion.html

Proporções e construção do rosto (Loomis)
- https://bingedrawing.com/portrait/loomis-method/
- https://rockynook.com/article/understanding-the-loomis-method-to-drawing-portraits/
- https://gvaat.com/blog/how-to-draw-the-head-using-the-loomis-method-a-step-by-step-guide/

Topologia e deformação
- https://topologyguides.com/
- https://cgtyphoon.com/topology/human-knee-topology/
- https://thundercloud-studio.com/article/topology-for-low-poly-game-characters/
- https://www.tripo3d.ai/blog/collect/understanding-the-importance-of-good-topology-in-character-rigging-eavg_kokrna
