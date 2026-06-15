# Técnica: Como Criar o Nosso Próprio Personagem (Josué)

Resposta à pergunta "dá para criar o nosso próprio personagem e qual a dificuldade?".
Sim, dá - e hoje não exige virar escultor 3D. Este documento mapeia o pipeline, a
dificuldade real de cada etapa, as ferramentas (incluindo IA), o fluxo recomendado para
um solo com auxílio de IA, e como o resultado se conecta ao nosso loader Babylon.

Complementa [`tecnica-anatomia-humana.md`](tecnica-anatomia-humana.md) (proporção/anatomia),
[`tecnica-deformacao-de-tecidos.md`](tecnica-deformacao-de-tecidos.md) (roupa/cloth),
[`biblia-vestuario.md`](biblia-vestuario.md) (KIT A - Josué) e
[`personagens/01-lideres-israelitas.md`](personagens/01-lideres-israelitas.md) (o visual do
Josué). A referência de como ele deve ser já está escrita; falta produzir a malha.

---

## 1. O pipeline de um personagem 3D (e onde mora a dificuldade)

Toda criação de personagem passa por estas etapas. A dificuldade "do zero, à mão" é alta;
com as ferramentas certas, cada etapa fica fácil ou automática.

| Etapa | O que é | À mão (Blender puro) | Com ferramenta certa |
|---|---|---|---|
| 1. Concept/referência | Definir o visual | - | Já temos (bíblias) |
| 2. Modelagem da malha | Esculpir/modelar o corpo | Difícil (semanas/meses de skill) | Fácil: gerador paramétrico ou IA |
| 3. UV + textura | "Desembrulhar" e pintar | Médio | Automático (IA) ou atlas |
| 4. Rig (esqueleto) | Criar os ossos | Difícil | Automático (auto-rig) |
| 5. Skinning (pesos) | Vincular malha aos ossos | Médio-difícil | Automático |
| 6. Animação | Idle/andar/correr/atacar | Difícil | Grátis (Mixamo) ou IA |
| 7. Export + integração | glTF -> Babylon | Fácil | Fácil (nosso loader pronto) |

Veredito honesto: virar artista de personagem = meses. Mas produzir um Josué próprio,
rigado, vestido e animado, como solo com IA = de algumas horas a poucos dias, sem skill de
escultura. O gargalo hoje não é técnico, é DIREÇÃO DE ARTE: iterar até ficar bom e "com
cara de Josué". A roupa que não atravessa o corpo vem de graça quando ela é parte da malha
skinned (etapas 4-5), que é o certo (ver deformação-de-tecidos).

---

## 2. Caminhos para a etapa difícil (modelagem) sem esculpir

### A. IA: texto/imagem -> 3D (mais rápido para um Josué único)
- Meshy: texto/imagem -> malha texturizada game-ready, com AUTO-RIG embutido (~30s) e
  biblioteca de animação. Exporta glb/FBX. Melhor "tudo em um" para quem não modela.
- Tripo: geração muito rápida (segundos), topologia otimizada para jogo e rig de 1 clique.
- Rodin (Hyper3D): foco em humano hiper-realista (rosto/cabelo/roupa), qualidade alta;
  rig em passo separado.
- Fluxo: gerar um concept de Josué (Midjourney/Firefly/SD a partir das bíblias) -> image-to-3D
  -> auto-rig -> animação -> glb.
- Cuidado: rosto, mãos e topologia da IA ainda saem irregulares; quase sempre pede uma
  limpeza no Blender. Qualidade "bom placeholder a decente", melhorando rápido. Conferir
  licença/uso comercial de cada serviço.

### B. Gerador paramétrico de humano (mais controle, realista, grátis)
- MakeHuman 2 / MPFB 2 (plugin de Blender): gera um humano realista por sliders (idade,
  porte, etc.), permite anexar cabelo e ROUPAS, e exporta glTF com esqueleto "GameEngine".
  Ótimo para um corpo realista base. A túnica/manto de época pode precisar ser modelada
  (simples no Blender) ou feita em cloth.
- Resultado: humano realista, proporção correta, rigado - exatamente o que faltava nos
  assets prontos (que eram ou realistas-nus ou vestidos-fofos).

### C. Manual no Blender (controle total, exige skill/tempo)
- Modelar/esculpir + retopo + UV + texturizar. É o ideal de qualidade e identidade, mas é
  a opção de maior esforço/skill. Recomendável só com tempo ou ajuda de artista.

### Roupa de verdade (a túnica e o manto de Josué)
- O certo: a roupa é malha skinned ao mesmo esqueleto (deforma com o corpo, não atravessa).
- Para cloth realista: Marvelous Designer (padrão da indústria para fazer roupa como costura
  real) -> exportar -> skinned. Partes esvoaçantes (barra do manto) podem ganhar spring
  bones em runtime (ver deformação-de-tecidos).

---

## 3. Rig e animação automáticos (etapas 4-6 sem dor)

- Mixamo (Adobe, grátis): sobe a malha em T-pose, auto-rig, e aplica um catálogo de
  animações (idle/andar/correr/atacar). Saída FBX/glb. Limite: exige T-pose.
- AccuRIG 2 (Reallusion, grátis) e Tripo/Meshy (auto-rig próprio) são alternativas.
- Para o nosso caso, Mixamo cobre a locomoção do protótipo de graça; já carregamos
  AnimationGroups por nome no Babylon.

---

## 4. Fluxo recomendado para este projeto

Objetivo: um Josué realista, vestido, rigado e animado, com esforço solo realista.

Recomendação primária (rápida, única): IA imagem->3D.
1. Gerar 2-3 concepts de Josué a partir das bíblias (comandante israelita, túnica ocre,
   manto terra-avermelhado, barba aparada, bandolete; ver 01-lideres 1.3/1.8).
2. Meshy (image-to-3D + auto-rig + animação) OU Tripo -> exportar glb.
3. (Se preciso) limpar topologia/escala no Blender; garantir T-pose para Mixamo se for
   animar lá.
4. Dropar o glb em `prototipo/public/models/` e trocar `MODEL_URL` + nomes das animações em
   `src/game/actors/heroModel.ts`. (Integração já pronta.)

Recomendação alternativa (mais controle, grátis, realista): MakeHuman 2 / MPFB 2 para o
corpo + roupa simples no Blender (ou Marvelous) -> Mixamo para animar -> glb -> mesmo plug.

Em ambos: a passada de arte final (M4) pode refazer/elevar o modelo. O placeholder atual no
app é um humano de proporção realista (Quaternius) só para não travar a navegação.

O que a Claude faz: toda a parte de código (loader, encaixe de escala, blend de animação,
spring bones para capa, anexar acessórios aos ossos) e a orientação passo a passo. O que
exige você (ou um artista): rodar as ferramentas de GUI/nuvem (Meshy/MakeHuman/Mixamo) e a
direção de arte. Não dá para esculpir/operar essas ferramentas dentro do chat.

---

## 5. Dificuldade resumida (para decidir)

- Tecnicamente difícil? Não mais. Auto-rig e geradores tiram o peso das etapas 2-6.
- Custa caro? Caminhos grátis existem (MakeHuman + Mixamo + Blender). IA tem tiers grátis e
  pagos; conferir licença comercial.
- Quanto tempo? Um placeholder próprio decente: horas a 1-2 dias. Um Josué "hero asset"
  polido: dias a semanas, conforme exigência e iteração de arte.
- Maior risco: não a técnica, e sim filtrar/curar o resultado para ficar bom e fiel
  (sobretudo rosto e mãos na IA; e o tom respeitoso/histórico do projeto).

---

## Fontes

Geradores de IA 3D e auto-rig
- https://www.meshy.ai/features/text-to-3d
- https://www.meshy.ai/blog/best-ai-tools-for-3d-game-assets
- https://www.tripo3d.ai/content/en/guide/the-best-character-creator-auto-rig-tools
- https://www.3daistudio.com/3d-generator-ai-comparison-alternatives-guide/best-text-to-3d-generators-2026

Geradores paramétricos (humano realista)
- https://static.makehumancommunity.org/mpfb/docs/exporting.html
- https://www.cgchannel.com/2025/03/check-out-open-source-blender-character-generation-plugin-mpfb-2/
- https://store.steampowered.com/app/4676360/Makehuman_2/

Rig e animação
- https://helpx.adobe.com/creative-cloud/help/mixamo-rigging-animation.html
- https://magazine.reallusion.com/2025/07/30/accurig-2-vs-mixamo-smarter-auto-rigging-for-3d-animators/
- https://rebusfarm.net/blog/how-to-use-mixamo-with-blender-full-beginner-guide
