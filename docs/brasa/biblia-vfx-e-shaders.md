# Bíblia de VFX e Shaders - Brasa

Direção dos efeitos visuais e dos materiais especiais de Brasa: a CHAMA da Brasa e dos
braseiros, as fagulhas e brasas flutuantes, o efeito de ACENDER (a transição fria para
quente que é o coração do jogo), a DISSOLUÇÃO dos mortos despertos ao morrer, a
telegrafia de ataques por VFX (herói e Guardião), a névoa fria e a poeira da cripta, o
shader de pedra úmida e o VFX do Guardião por fase. Preenche a lacuna entre "como a
cripta é" (`direcao-de-arte.md`) e "como os efeitos e materiais especiais são feitos".

Relacionados: estilo e paleta em [`direcao-de-arte.md`](direcao-de-arte.md); premissa,
laço de sala e orçamento técnico em [`../projeto-brasa.md`](../projeto-brasa.md); régua
de detalhe e Definition of Done em [`../padrao-de-detalhe.md`](../padrao-de-detalhe.md).
Código reaproveitável do motor: `createFlame` em
`prototipo/src/game/props/props.ts` e `ImpactFx` em
`prototipo/src/game/combat/impactFx.ts`.

Marcação de PROCEDÊNCIA: `[DESIGN]` (decisão nossa), `[CÓDIGO]` (observado no
protótipo), `[ASSET]` (procede de pacote CC0). Marcação de EXIGÊNCIA: `[NORMATIVO]`
(entra no aceite), `[ASPIRACIONAL]` (mood/intenção), `[A DEFINIR]` (pendente).

Princípio-mãe `[DESIGN]` `[NORMATIVO]`: **rodar leve no navegador é o critério nº 1**
(`projeto-brasa.md` 2). VFX em Brasa é orçamento de DRAW CALL e de OVERDRAW, nunca de
tris (`padrao-de-detalhe.md` 2.1, linha 78). Em dúvida, escolher o efeito mais barato
que ainda vende o momento. O fogo é a única licença de exuberância do jogo, e mesmo ele
é vendido por material emissivo + partícula barata + uma luz pontual, não por
simulação. Tudo o mais é contido.

---

## 1. Filosofia de VFX em Brasa

`[DESIGN]` `[NORMATIVO]` Quatro regras governam todo efeito deste documento:

1. **O fogo é o herói; tudo o mais cede a ele.** A assinatura do jogo é frio-azul contra
   laranja-quente (`direcao-de-arte.md` 2). O laranja emissivo do fogo precisa ser
   sempre o ponto mais quente e mais brilhante da tela. Por isso nenhum outro efeito
   (faísca de impacto, runa espectral, poeira) pode competir em brilho com a chama: ou
   é mais frio, ou é mais apagado, ou é mais curto.
2. **Orçamento é draw call e overdraw, não tris.** Uma partícula tem ~2 tris e custa
   quase nada em geometria; o que pesa na web é cada emissor ser um draw call e cada
   partícula transparente desenhar pixels sobre pixels (overdraw), que mata o fill rate
   em mobile. Logo: poucos emissores ativos, partículas pequenas e de vida curta, atlas
   e textura procedural compartilhados, blend aditivo só onde o fogo justifica.
3. **Telegrafia antes do estouro.** Todo ataque perigoso (herói pesado, Guardião) tem
   um sinal de VFX ANTES do golpe conectar, legível também sem cor (`padrao-de-detalhe.md`
   2.1, linha 78: "telegrafia antes do estouro"). O VFX serve à leitura de combate
   primeiro, ao espetáculo depois.
4. **Fallback mobile sempre previsto.** Cada ficha declara o que cai primeiro quando o
   orçamento aperta (contagem de partículas, glow, distorção de calor), de modo que o
   efeito DEGRADA com graça em vez de sumir ou travar. Nenhum efeito pode ser
   indispensável à leitura de gameplay e ao mesmo tempo caro: se é indispensável, é
   barato; se é caro, é cortável.

`[DESIGN]` Teto de orçamento de VFX por sala, somado ao teto geral de **< 60 draw calls
por sala** (`projeto-brasa.md` 4.1): no estado de combate, no máximo **3-4 emissores de
partícula ativos simultâneos** mais a fagulha da Acendedora e o fogo do braseiro.
Reaproveitar UMA instância de cada sistema (como o `ImpactFx` faz, uma instância
reposicionada por golpe) em vez de criar emissores por evento.

---

## 2. Decisão de linguagem de material/shader

### 2.1 Base de material `[ASSET]` `[DESIGN]`

- Os modelos vêm do ecossistema KayKit CC0 (`projeto-brasa.md` 5) com seu material PBR
  estilizado de atlas único e cor predominante chapada. NÃO repintar texturas: a leitura
  de "calor" e "frio" vem da LUZ e do EMISSIVO, não de atlas novo (`direcao-de-arte.md`
  4). Isto mantém o orçamento de draw call e evita quebrar o atlas compartilhado.
- Iluminação majoritariamente dinâmica e barata: 1 luz-chave fria por sala (pode ter
  sombra) e 1-2 luzes pontuais quentes do braseiro com sombra DESLIGADA
  (`projeto-brasa.md` 4.4). Sem lightmaps assados na cripta (salas montadas e
  descartadas em runtime; assar não compensa).
- Emissivo é o recurso escasso: reservado ao fogo, à fagulha, ao gume aquecido e às
  runas/olhos espectrais dos mortos (`direcao-de-arte.md` 113-115). Tudo o mais é
  material não-emissivo lido pela luz.

### 2.2 Outline (contorno) `[DESIGN]` `[NORMATIVO]`

Recomendação: SIM, outline seletivo e sutil, coerente com o low-poly caricato do KayKit,
NÃO um cel-shading de traço grosso.
- Contorno escuro fino apenas em: Acendedora, esqueletos, Guardião e props interativos
  (braseiro, porta, baú). NÃO no cenário/terreno (custo de draw call e poluição visual).
- Cor do contorno: azul-ardósia muito escuro (`#1F3247`) em vez de preto puro, para casar
  com a dominância fria da cripta e não brigar com a paleta.
- Espessura constante em tela (não engrossar de perto). No estado quente, a silhueta
  ganha reforço da própria luz do braseiro (rim quente), então o outline pode ser ainda
  mais discreto.
- `[A DEFINIR]` Técnica: Outline Renderer nativo do Babylon vs. inverted-hull leve.
  Medir custo no dispositivo alvo. Fallback mobile: dispensar o outline e sustentar a
  silhueta por rim light frio (`#3E5C7E`) e contraste de valor.

### 2.3 Shader de pedra úmida `[DESIGN]` `[NORMATIVO]`

A cripta é úmida, profunda, fria. A pedra precisa LER como molhada sem custo de shader
caro. Solução barata, em camadas:
- Base: o material KayKit da peça modular, sem repintura, na gama de pedra
  (`#43403B` a `#8A847C`, `direcao-de-arte.md` 93-95).
- Umidade por LUZ, não por shader: a luz-chave fria rasante (`#3E5C7E`) realça as faces
  superiores e cria especular contido nas quinas, que o olho lê como "molhado". O grau
  de especular vem do roughness do próprio material; subir o brilho especular levemente
  nas peças baixas (perto do chão da cisterna) sugere água escorrida.
- Musgo/úmido como acento raro de vertex color esverdecido (`#4A5A47`,
  `direcao-de-arte.md` 96) nas juntas e na base, pintado na malha, não em textura nova.
- `[A DEFINIR]` Poças no chão: decalque escuro com leve reflexo especular (não reflexão
  planar dinâmica, cara) OU simplesmente material de chão com especular alto numa mancha.
  Decidir no protótipo. Fallback mobile: cortar o decalque, manter só o especular do
  material.
- Custo: ZERO partícula, ZERO emissor; é decisão de luz e material. É o shader "especial"
  mais barato do jogo, de propósito.

---

## 3. A CHAMA: Brasa, braseiro e fagulha

O fogo é o investimento de qualidade do jogo e o efeito que mais aparece. Reaproveita e
estende o `createFlame` do protótipo, que já entrega chama estilizada por DOIS CONES
EMISSIVOS sem luz embutida (`props.ts` 143-156, `[CÓDIGO]`): a cena decide a luz. Esse é
exatamente o modelo barato que Brasa quer.

### 3.1 Chama do braseiro (id: chama_braseiro) `[DESIGN]` `[NORMATIVO]`

- Resumo: o fogo de cada braseiro que a Acendedora acende, fonte de calor e luz da sala
  no estado quente.
- Construção em três camadas, da mais barata para a mais cara:
  1. **Núcleo emissivo (geometria):** os dois cones do `createFlame` (cone externo
     `#FF7A1A`/laranja-brasa, cone interno `#FFA63D`/âmbar), emissivo alto, baixíssimo
     custo (poucos tris, sem transparência). É a base que SEMPRE existe, mesmo no
     fallback mais agressivo. Animar por leve escala/rotação senoidal no código (flicker
     de forma) em vez de atlas animado, para não carregar textura.
  2. **Partícula de chama:** 1 emissor aditivo (`BLENDMODE_ADD` como o `ImpactFx`),
     textura de ponto radial procedural (reusar o `dotTexture` de `impactFx.ts`,
     `[CÓDIGO]`), ~14-20 partículas, vida 0,5-0,9 s, subindo com leve viés vertical,
     cor de `#FFA63D` para `#FF7A1A` e morrendo em `#C8401C` (vermelho-tiço). Dá
     movimento e volume à chama de cones.
  3. **Luz pontual quente:** 1 PointLight (`#FFA63D`), com flicker de intensidade
     (ruído suave no código), SOMBRA DESLIGADA (`projeto-brasa.md` 4.4). É o que vende o
     fogo de verdade: a sala inteira reage. No máximo 1-2 luzes quentes por sala.
- Orçamento: 1 emissor + 1 luz pontual + geometria emissiva. Conta como ~1 draw call de
  emissor dentro do teto de 3-4. Glow (GlowLayer) opcional e único na cena, compartilhado
  por todo emissivo quente.
- Leitura: é o ponto mais quente e mais brilhante da sala; o jogador localiza o braseiro
  de qualquer ângulo. No estado frio (apagado), o braseiro é só geometria escura com leve
  rim azul, sem emissivo, sem luz, sem partícula.
- Fallback mobile (em ordem de corte): 1º reduzir partículas a ~8; 2º desligar o glow; 3º
  manter só núcleo emissivo + luz pontual; 4º (extremo) núcleo emissivo + flicker de
  intensidade na luz, zero partícula. A chave SEMPRE preservada é a luz pontual quente,
  porque é ela que executa a transição de estado (seção 5).

### 3.2 Brasa do fundo (id: brasa_fundo) `[DESIGN]` `[ASPIRACIONAL]`

- Resumo: a chama ancestral no fundo do poço-cripta, alvo final da descida. É um braseiro
  "maior e mais sagrado": mesma técnica da chama do braseiro, escalada e com mais peso
  visual, reservada ao clímax.
- Estado moribundo (antes de reacender): chama mínima, baixa, fria nas bordas, luz fraca
  e trêmula, muita névoa fria por perto. Comunica que está MORRENDO sem texto.
- Estado reavivado (fim do slice): clarão (seção 5.3) ampliado, a luz quente domina a
  câmara do Guardião, fecha o vertical slice. Único momento em que o fogo pode "estourar"
  de propósito, porque é o pagamento narrativo de toda a descida.
- Orçamento: como é único e momentâneo (não persiste na sala durante combate), pode
  gastar mais: ~2 emissores + glow reforçado no instante do reavivamento. Medir no
  dispositivo alvo (`projeto-brasa.md` 4.1).

### 3.3 Fagulha da Acendedora (id: fagulha_heroina) `[DESIGN]` `[NORMATIVO]`

- Resumo: o pequeno fogo que a heroína carrega; o ÚNICO ponto quente no estado frio
  (`direcao-de-arte.md` 168-170). Viaja com ela.
- Construção: 1 luz pontual quente fraca de raio curto (`#FFA63D`) presa à Acendedora +
  núcleo emissivo minúsculo (ponta de tocha/lanterna/mão) + emissor opcional de poucas
  fagulhas (~4-6, vida ~0,6 s). Custo deliberadamente baixo, pois está SEMPRE em cena.
- Leitura: num mar azul, é um único ponto laranja que segue o jogador. Esculpe o
  pouco-luz de combate no estado frio e ancora o olhar na heroína. Quando o braseiro
  acende, a fagulha some na luz quente da sala (deixa de ser o único ponto quente).
- Fallback mobile: cortar o emissor de fagulhas, manter luz pontual + núcleo emissivo. A
  luz pontual é inegociável: é a iluminação de combate no estado frio.

### 3.4 Fagulhas e brasas flutuantes (id: brasas_ambiente) `[DESIGN]` `[ASPIRACIONAL]`

- Resumo: pontinhos de brasa subindo do braseiro aceso e pairando no ar quente, vida do
  ambiente no estado quente.
- Construção: 1 emissor aditivo lento, ~6-10 partículas, vida longa (~2-3 s), subindo
  devagar com deriva lateral, cor ouro-fagulha (`#FFD27A`) esmaecendo para apagado.
  Tamanho minúsculo. Reusa a textura de ponto procedural.
- Leitura: ambiência, não gameplay. Reforça "a sala está viva e quente". NUNCA no estado
  frio (a sala fria não tem brasas no ar).
- Fallback mobile: cortar inteiro. É o primeiro a cair, pois é puro enfeite.

---

## 4. VFX de combate (feel)

Estende o `ImpactFx` do protótipo (`[CÓDIGO]`), que já é uma instância única de
ParticleSystem aditivo, cap 200, ~16 partículas por golpe, vida 0,12-0,32 s, faísca de
bronze quente esmaecendo para poeira, com textura de ponto procedural. Em Brasa a paleta
de impacto recalibra para a cripta fria.

| Efeito | Visual | Técnica | Quando |
|---|---|---|---|
| Impacto de acerto | Faísca curta + flash quente no alvo | Rajada do `ImpactFx` (~12-16 part., vida ~0,2 s) + flash de material ~80 ms | Todo golpe que conecta |
| Acerto em esqueleto | Estilhaço de OSSO claro (`#D8CFB8`) + flash | Mesma instância, cor de partícula osso/poeira; sem sangue realista | Golpe em morto desperto |
| Aparar/bloqueio | Centelha fria de ferro + anel curto | Rajada radial pequena (~8 part.) cor ferro-frio (`#5A6470`) + som | Bloqueio/parry |
| Poeira de passo/recuo | Tufo baixo de poeira/cinza | Emissor leve no pé, cor poeira (`#7C746A`) | Correr/rolar/knockback |
| Rastro de golpe pesado | Trilha curta no arco | Trail mesh fino, fade rápido; gume aquecido (`#C98A3A`) se a fagulha tocar a lâmina | Golpe pesado/habilidade |
| Sangue | NÃO usar respingo realista | Substituir por flash + estilhaço de osso + tufo de poeira | - |
| Morte de esqueleto | Dissolução em pó/escuro (seção 6) | ver seção 6 | Vida 0 |
| Telegrafia de ataque | Brilho na arma/ponta + (acessível) sinal no chão | Emissivo pulsante + decalque opcional | Antes do golpe inimigo |

`[NORMATIVO]` Regras: poucas partículas por impacto; priorizar flash + som + hit stop
(que já existem no motor: `hitStop`, `combatSound`, `impactFx`, `projeto-brasa.md`
6.1), que vendem mais que volume de partícula. O impacto é QUENTE (faísca laranja/ouro)
para reforçar que a heroína traz o fogo, mas curto e pequeno, para nunca competir com o
braseiro. Tudo legível também sem cor (silhueta da faísca, flash de valor, som).

---

## 5. O efeito de ACENDER (a transição fria para quente)

`[DESIGN]` `[NORMATIVO]` É o momento mais importante do jogo (`direcao-de-arte.md`
174-176): a sala limpa, o jogador interage com o braseiro e a luz FRIA vira QUENTE,
crescendo do centro. Não é só ligar uma luz: é uma sequência coreografada de VFX e luz
que precisa SENTIR como recompensa. Orçamento: é um pico momentâneo (segundos), pode
gastar mais que o estado de combate, mas tem de voltar ao orçamento normal quando
assenta.

### 5.1 Sequência (id: acender_braseiro) `[DESIGN]` `[NORMATIVO]`

Três beats, ~1,5 a 2,5 s no total:

1. **Captura (frio, antecipação):** ao interagir, a fagulha da Acendedora se inclina em
   direção ao braseiro; um fio quente curto sai dela rumo ao núcleo do braseiro (1
   emissor breve, ~6-8 partículas ouro-fagulha). A sala continua azul. ~0,3-0,5 s.
2. **Ignição (o clarão):** o núcleo do braseiro acende de uma vez; um CLARÃO breve
   (flash de exposição/bloom curto, ~0,15-0,25 s) marca o instante. A luz pontual quente
   nasce no centro com intensidade baixa.
3. **Expansão (frio recua, quente cresce):** ao longo de ~1-2 s a intensidade e o raio da
   luz pontual quente sobem do centro para fora; a luz-chave fria abaixa e dessatura; os
   volumes de pedra ganham faces quentes e sombras longas; entram as brasas flutuantes
   (3.4). A sala "respira". Quando assenta, o estado quente é o novo regime e a porta de
   saída destrava (`projeto-brasa.md` 3.1).

### 5.2 Ondas de calor (id: heat_haze) `[DESIGN]` `[ASPIRACIONAL]`

- Distorção de calor sutil subindo do braseiro aceso, só de perto, opcional.
- Técnica: leve refração/distorção de tela localizada acima da chama (não tela inteira).
  É um efeito CARO de fill rate; por isso é a primeira coisa a cair no fallback.
- Fallback mobile: cortar inteiro. O fogo se sustenta sem ele. Nunca depender do heat
  haze para nenhuma leitura.

### 5.3 O clarão (id: clarao) `[DESIGN]` `[NORMATIVO]`

- O flash breve do beat 2. Vendido por bloom curto + subida momentânea de exposição +
  expansão rápida da luz pontual, NÃO por uma esfera de partículas grande (cara em
  overdraw).
- Versão ampliada e única para o reavivamento da Brasa do fundo (3.2), como pagamento do
  clímax. Esse é o único clarão que pode encher a tela.
- Fallback mobile: substituir o bloom por uma simples subida-e-queda rápida de
  intensidade da luz pontual (sem post-process). Mantém o "snap" do acender sem custo de
  pós-processo.

`[DESIGN]` Transição inversa (calor murchando): se um andar mais fundo precisar mostrar a
luz recuando (a Brasa morrendo), é a sequência 5.1 ao contrário: o quente esfria,
desatura, recolhe ao centro e apaga, o azul reocupa a sala. Mesmo custo, sentido oposto.

---

## 6. Dissolução dos mortos despertos (morte do esqueleto)

`[DESIGN]` `[NORMATIVO]` Os esqueletos não sangram nem caem como corpos: ao morrer, eles
se DESFAZEM (`projeto-brasa.md` 1: "os mortos despertam"; ao perder a animação que os
sustenta, viram pó e escuro). É a morte de gameplay mais frequente do jogo e tem de ser
barata e legível. Sem gore.

### 6.1 Ficha (id: dissolucao_esqueleto)

- Resumo: o esqueleto se dissolve em pó/escuro de baixo para cima ao chegar a vida 0.
- Construção, do mais barato ao mais caro:
  1. **Dissolve por shader de alpha/erosão:** fade dirigido por uma textura de ruído
     (dissolve threshold subindo) na malha do esqueleto, varrendo de baixo para cima.
     Borda do dissolve com leve realce frio (ciano-espectral `#5FB7C9`) ou tiço apagado,
     curtíssimo. É barato (um material, sem partícula) e é a base que sempre existe.
  2. **Poeira de osso:** 1 rajada do emissor de impacto reaproveitado, ~10-14 partículas
     cor osso/poeira (`#A39A82` a `#7C746A`), caindo com gravidade e esmaecendo. Dá o
     "pó".
  3. **Sopro de escuro:** as runas/olhos espectrais (`#5FB7C9`) que animavam o morto se
     apagam por último, marcando que a animação que o sustentava acabou. Pequeno, frio.
- Orçamento: 1 material de dissolve + 1 rajada do emissor já existente (instância única,
  reposicionada, como o `ImpactFx`). Não cria emissor por morte. A malha é removida ao
  fim do dissolve, devolvendo o draw call.
- `[A DEFINIR]` Duração do dissolve: proposta 0,5-0,8 s (rápido o bastante para não
  travar o combate, lento o bastante para ler). Ratificar no profiling.
- Leitura: inequívoca de que o inimigo morreu (some), sem gore, coerente com "mortos
  voltando ao pó". Legível sem cor (o esqueleto desaparece, os olhos apagam).
- Fallback mobile: cortar a poeira de osso (passo 2); manter só o dissolve por shader +
  apagar das runas. Em fallback extremo, fade simples de opacidade + apagar das runas.

---

## 7. Telegrafia de ataques por VFX

`[DESIGN]` `[NORMATIVO]` Princípio do `padrao-de-detalhe.md` (2.1, linha 78): telegrafia
ANTES do estouro. Todo golpe perigoso anuncia por VFX, legível também sem cor. A
telegrafia é VFX indispensável, logo é barata.

### 7.1 Herói (Acendedora) (id: telegrafia_heroi) `[DESIGN]` `[NORMATIVO]`

- Golpe pesado/habilidade: a fagulha quente "carrega" na arma antes do golpe (emissivo
  pulsante na lâmina, gume aquecido `#C98A3A`), depois o rastro (4) no arco. Comunica ao
  jogador o timing do próprio golpe forte.
- Custo: emissivo pulsante (sem emissor extra) + o trail já contabilizado em combate.

### 7.2 Esqueleto comum (id: telegrafia_esqueleto) `[DESIGN]` `[NORMATIVO]`

- Antes do ataque: brilho frio pulsante na arma/garra (emissivo `#5FB7C9`) + leve
  antecipação de pose (animação compartilhada). Marcador opcional no chão (decalque)
  para acessibilidade.
- Custo: emissivo pulsante, zero emissor. A pose faz metade do trabalho.

### 7.3 Guardião (id: telegrafia_guardiao) `[DESIGN]` `[NORMATIVO]`

- Cada ataque grande tem um sinal mais forte e mais longo que o do esqueleto comum
  (chefe = mais janela de leitura): acúmulo de emissivo na arma/corpo + decalque de zona
  no chão (ataque de área) ANTES do golpe, com cor coerente à fase (seção 8). O decalque
  cresce/pulsa e estoura no impacto.
- Custo: 1 decalque/projeção por ataque telegrafado + emissivo pulsante. Decalque é mais
  barato que volume de partícula e é a forma mais legível de telegrafar área.
- Fallback mobile: manter o decalque de zona e o emissivo (são a leitura); cortar
  partículas decorativas do acúmulo.

`[NORMATIVO]` Toda telegrafia é legível sem depender de cor: por forma (decalque de
zona), por pulso/timing (ritmo do emissivo) e por pose. A cor é reforço, não a
informação única (acessibilidade, `padrao-de-detalhe.md` 2.2).

---

## 8. VFX do Guardião por fase

`[DESIGN]` `[NORMATIVO]` O Guardião da Brasa apagada é o clímax (`projeto-brasa.md` 3.1).
A leitura de fase vem por SILHUETA e COR (`projeto-brasa.md` 4.2; `direcao-de-arte.md`
138), reforçada por VFX. `[A DEFINIR]` Número exato de fases (proposta: 2-3). Esboço por
fase, do frio ao quente conforme a Brasa que ele guarda reage:

| Fase | Estado | Assinatura VFX | Telegrafia |
|---|---|---|---|
| 1 (gélido) | Guardião pleno, Brasa apagada | Runas/olhos ciano-espectral (`#5FB7C9`), aura fria fraca, nenhuma chama | Acúmulo frio na arma + decalque de zona azulado |
| 2 (tiço) | Sob pressão, fogo começa a vazar | Fendas emissivas em tiço (`#C8401C`) abrindo no corpo; runas piscam entre ciano e laranja | Decalque cresce, cor migra para laranja, janela mais curta |
| 3 (em chamas) `[A DEFINIR]` | Última fase | Corpo com vazamento laranja-brasa (`#FF7A1A`), brasas flutuantes ao redor, luz pontual quente nascendo nele | Ataques mais rápidos, decalque laranja intenso; clarão entre fases |

- Transição de fase: um pequeno clarão (5.3) marca a virada, e a paleta do Guardião
  desliza um passo do frio para o quente, espelhando a Brasa que ele guarda voltando à
  vida. A morte do Guardião dispara o reavivamento da Brasa do fundo (3.2) e o clarão
  ampliado, fechando o slice.
- Orçamento: o Guardião é um único ator; pode concentrar mais VFX que um esqueleto comum
  (é o pico do combate), mas ainda dentro do teto da sala. Reusar emissor de impacto e
  emissor de brasas; não criar um emissor por fase, e sim trocar parâmetros (cor, taxa)
  do mesmo.
- Fallback mobile: leitura de fase por COR do emissivo e SILHUETA preservada sempre;
  cortar brasas flutuantes e reduzir partículas de acúmulo; manter decalque de telegrafia.

---

## 9. Névoa fria e poeira da cripta

`[DESIGN]` `[NORMATIVO]` A atmosfera fria, úmida e parada da câmara selada, no estado
frio. É ambiência, não gameplay, então é barata e some no fallback.

### 9.1 Névoa fria (id: nevoa_fria)

- Construção: NÃO volumetria pesada. Fog de cena na gama azul-cripta (`#0E1A2B` a
  `#1F3247`, `direcao-de-arte.md` 81-82) para a profundidade fria, mais 1 emissor lento
  e raríssimo de névoa baixa rasteira (billboards grandes, muito translúcidos, ~4-6
  partículas, vida longa ~4-6 s) perto do chão da cisterna/salão. Cor azul-acinzentada
  fria.
- Leitura: "frio eterno", profundidade, a sala respirando devagar antes de acender. No
  estado quente, a névoa fria recua (o calor a dissipa) e cede lugar às brasas
  flutuantes (3.4).
- Orçamento: o fog é gratuito (estado de cena); o emissor de névoa é 1 dos 3-4 emissores
  e tem taxa baixa. Overdraw é o risco (billboards grandes translúcidos), então poucos e
  bem transparentes.
- Fallback mobile: manter o fog (grátis e essencial à profundidade fria); cortar o
  emissor de névoa rasteira inteiro.

### 9.2 Poeira suspensa (id: poeira_cripta)

- Construção: motas mínimas de poeira pairando no facho da luz-chave fria (~6-8
  partículas, deriva muito lenta, cor poeira `#7C746A` apagada). Reforça "ar parado de
  lugar selado há muito".
- Leitura: ambiência sutil; aparece sobretudo onde a luz-chave corta o breu.
- Fallback mobile: cortar inteiro.

---

## 10. Recorte do protótipo (vertical slice)

`[DESIGN]` O que é imprescindível para o slice (`projeto-brasa.md` 7) e o que pode
esperar:

Imprescindível:
- A chama do braseiro (3.1) e a fagulha da Acendedora (3.3): sustentam a assinatura
  cromática e a iluminação de combate.
- O efeito de ACENDER (5): é o coração do laço de sala e do jogo.
- A dissolução do esqueleto (6): morte do inimigo mais frequente.
- A telegrafia (7) de herói, esqueleto e Guardião.
- Névoa/fog frio (9.1) no mínimo via fog de cena.
- VFX do Guardião por fase (8) no clímax.

Pode esperar / aspiracional (corta no slice se apertar):
- Ondas de calor (5.2), brasas flutuantes (3.4), poeira suspensa (9.2), poças de pedra
  úmida (2.3). São polimento.

`[NORMATIVO]` Medir draw calls, overdraw e fps no dispositivo alvo a partir do momento em
que houver uma sala montada com braseiro aceso (`projeto-brasa.md` 7, etapa 3), e a cada
emissor adicionado.

---

## Checklist de aceite (Definition of Done)

`[NORMATIVO]` Cada item recebe sim/não honesto. Orçamento de VFX é medido em draw calls e
overdraw, não em tris (`padrao-de-detalhe.md` 2.1, linha 78).

Filosofia e orçamento (seção 1):
- [ ] VFX tratado como orçamento de draw call e overdraw, nunca de tris [DESIGN][NORMATIVO]
- [ ] No estado de combate, no máximo 3-4 emissores de partícula ativos simultâneos, além da fagulha e do braseiro [DESIGN][NORMATIVO]
- [ ] O fogo é sempre o ponto mais quente e brilhante da tela; nenhum outro efeito compete em brilho com a chama [DESIGN][NORMATIVO]
- [ ] Cada efeito declara fallback mobile e degrada com graça [DESIGN][NORMATIVO]
- [ ] Instâncias únicas de sistema reposicionadas por evento (não emissor por golpe/morte), no padrão do ImpactFx [CÓDIGO][NORMATIVO]

Material e shader (seção 2):
- [ ] Atlas KayKit preservado sem repintura; calor/frio lidos por luz e emissivo, não por textura nova [ASSET][NORMATIVO]
- [ ] Emissivo reservado a fogo, fagulha, gume aquecido e runas/olhos espectrais [DESIGN][NORMATIVO]
- [ ] Outline (se ativo) só em Acendedora, esqueletos, Guardião e props interativos, nunca no cenário; cor azul-ardósia escura (#1F3247), espessura constante em tela [DESIGN][NORMATIVO]
- [ ] Shader de pedra úmida resolvido por luz/especular + vertex color de musgo, sem reflexão planar dinâmica nem partícula [DESIGN][NORMATIVO]

A CHAMA (seção 3):
- [ ] Chama do braseiro em três camadas (núcleo emissivo de cones + 1 emissor aditivo + 1 luz pontual quente sem sombra), reusando createFlame e dotTexture [CÓDIGO][NORMATIVO]
- [ ] No máximo 1-2 luzes dinâmicas quentes por sala, sombra desligada [NORMATIVO]
- [ ] Braseiro apagado é só geometria escura com rim azul (sem emissivo, luz ou partícula) [DESIGN][NORMATIVO]
- [ ] Fagulha da Acendedora é o único ponto quente no estado frio e some na luz quente ao acender [DESIGN][NORMATIVO]
- [ ] Luz pontual quente do braseiro e da fagulha são inegociáveis (preservadas em qualquer fallback) [DESIGN][NORMATIVO]

VFX de combate (seção 4):
- [ ] Impacto por rajada do ImpactFx (~12-16 partículas, ~0,2 s) + flash de material ~80 ms, priorizando flash + som + hit stop sobre volume de partícula [CÓDIGO][NORMATIVO]
- [ ] Sem respingo de sangue realista; substituído por flash + estilhaço de osso + poeira [DESIGN][NORMATIVO]
- [ ] Faísca de impacto quente porém curta e pequena, nunca competindo com o braseiro [DESIGN][NORMATIVO]

Acender (seção 5):
- [ ] Sequência de acender em três beats (captura, clarão, expansão), com a luz quente crescendo do centro e o azul recuando [DESIGN][NORMATIVO]
- [ ] Acender destrava a porta de saída ao assentar no estado quente [DESIGN][NORMATIVO]
- [ ] Clarão vendido por bloom curto + exposição + expansão da luz pontual, não por esfera de partículas [DESIGN][NORMATIVO]
- [ ] Ondas de calor (heat haze) opcionais e cortáveis primeiro; nenhuma leitura depende delas [DESIGN][NORMATIVO]

Dissolução (seção 6):
- [ ] Esqueleto morre por dissolve de shader (varredura de baixo para cima) + poeira de osso + apagar das runas, sem gore [DESIGN][NORMATIVO]
- [ ] Malha removida ao fim do dissolve, devolvendo o draw call [DESIGN][NORMATIVO]
- [ ] Morte legível sem cor (some, olhos apagam) [DESIGN][NORMATIVO]

Telegrafia (seção 7):
- [ ] Todo golpe perigoso (herói pesado, esqueleto, Guardião) tem sinal de VFX antes do impacto [DESIGN][NORMATIVO]
- [ ] Telegrafia do Guardião usa decalque de zona + emissivo, com janela de leitura maior que a do esqueleto comum [DESIGN][NORMATIVO]
- [ ] Toda telegrafia legível sem depender de cor (forma, pulso/timing, pose) [DESIGN][NORMATIVO]

Guardião por fase (seção 8):
- [ ] Leitura de fase por silhueta + cor, deslizando do frio (ciano-espectral) ao quente (laranja-brasa) conforme as fases [DESIGN][NORMATIVO]
- [ ] Transição de fase marcada por clarão; morte dispara o reavivamento da Brasa do fundo + clarão ampliado [DESIGN][NORMATIVO]
- [ ] VFX por fase por troca de parâmetros de emissor reusado, não emissor novo por fase [DESIGN][NORMATIVO]

Atmosfera (seção 9):
- [ ] Névoa fria por fog de cena azul-cripta (essencial) + emissor raro de névoa rasteira (cortável); poeira suspensa cortável [DESIGN][NORMATIVO]
- [ ] No estado quente, névoa fria recua e cede lugar às brasas flutuantes [DESIGN][NORMATIVO]

Orçamento e estilo (transversal):
- [ ] 60 fps desktop / 30 fps mobile mantidos com os VFX ativos; cena < 60 draw calls por sala (projeto-brasa 4.1) [NORMATIVO]
- [ ] VFX medidos no dispositivo alvo a cada emissor adicionado, a partir da sala com braseiro aceso [DESIGN][NORMATIVO]
- [ ] Sem travessões, sem emojis em qualquer texto exibido [NORMATIVO]
- [ ] Itens [A DEFINIR] (técnica de outline, poças, duração do dissolve, número de fases do Guardião) resolvidos ou explicitamente adiados com registro [NORMATIVO]
