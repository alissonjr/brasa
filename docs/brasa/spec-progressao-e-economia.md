# Spec de Progressão e Economia: Brasa

"Brasa" - dungeon crawler 3D low-poly para navegador, foco em rodar leve. A Acendedora desce
um poço-cripta câmara por câmara, acende os braseiros antigos e luta contra os mortos
despertos ate reavivar a Brasa no fundo. Tom mítico, sóbrio, melancólico; assinatura visual
frio-azul (morte/escuro) contra laranja-quente (Brasa/vida).

Este documento define o que a Acendedora ganha ao descer: o recurso central (a Fagulha que
ela carrega e acumula), o que cada braseiro aceso concede, a lista de melhorias, a moeda e
suas fontes, a economia de risco-recompensa por sala, a relação entre uma descida e a
progressão geral, e a curva de dificuldade ao longo dos 5-7 andares ate o Guardião. É
documento de design de sistemas, não de implementação final: os números são pontos de partida
para iterar, coerentes com a leveza técnica e o tom do canon.

Mestre (não contradizer): [`../projeto-brasa.md`](../projeto-brasa.md) (premissa, loop
sala-a-sala seção 3, orçamento técnico NORMATIVO seção 4, mapeamento sobre o motor seção 6).

Ver também:
[`narrativa-e-historia.md`](narrativa-e-historia.md) (Atos I/II/III, camadas do poço,
categorias de morto, ganchos por andar seção 8);
[`spec-combate.md`](spec-combate.md) (moveset, hitboxes, custos de stamina, números de dano);
[`spec-chefe-guardiao.md`](spec-chefe-guardiao.md) (o chefe do slice);
[`spec-fluxo-e-persistencia.md`](spec-fluxo-e-persistencia.md) (estados, save, autosave de
fim de andar, modelo de dados do save);
[`spec-ui-hud-ux.md`](spec-ui-hud-ux.md) (HUD de Fagulha/vida/luz, tela de escolha de
melhoria);
[`guia-de-estilo-e-glossario.md`](guia-de-estilo-e-glossario.md) (grafia: Fagulha maiúscula
quando recurso, braseiro/câmara minúsculas).

Marcação de PROCEDÊNCIA (canon seção 0):
- [DESIGN] = decisão criativa nossa.
- [CÓDIGO] = observado no código-fonte do protótipo (`prototipo/src`).
- [ASSET] = procede de um pacote de asset existente (KayKit).

Marcação de EXIGÊNCIA (padrão-de-detalhe seção 1):
- [NORMATIVO] = requisito verificável; entra no checklist de aceite.
- [ASPIRACIONAL] = mood/intenção; orienta, não bloqueia.
- [A DEFINIR] = lacuna que precisa de decisão autoral antes de virar normativo.

---

## 1. Filosofia de progressão

Tese [DESIGN]: a Acendedora não fica "mais forte" por planilha; ela fica MAIS LUMINOSA e mais
capaz de afastar o escuro. O recurso e a progressão são uma só coisa, a luz, e a luz é, ao
mesmo tempo, dado de ficção, condição de sobrevivência e moeda de melhoria. Cada braseiro
aceso é um avanço real (a luz desce mais um andar, conforme o canon seção 1) e um avanço de
poder (uma escolha de melhoria). Crescer e progredir geograficamente são o mesmo gesto.

Cinco princípios que toda decisão de progressão respeita [DESIGN]:

1. A luz é o recurso, o poder e o tema. Não inventar uma "moeda de loja" abstrata: o que a
   Acendedora acumula é Fagulha (luz), e o que ela gasta/ganha empurra o escuro. O sistema
   serve a ficção do canon (a luz recua, os mortos despertam), não a contradiz.
2. Poder contido (sem power-fantasy de números). Vida e dano sobem pouco ao longo de uma
   descida; a dificuldade dos andares sobe junto. A vitória continua dependendo de ler o
   combate (telegrafia dos esqueletos, gestão de stamina, espaço), não de um delta de
   atributo que trivialize o andar de cima. Espelha a leveza e a sobriedade do tom.
3. Escolha em vez de acúmulo. Cada braseiro oferece uma ESCOLHA entre melhorias (não todas);
   a escassez gera decisão e identidade de partida. Poucos upgrades, todos significativos,
   sem chuva de itens nem grade de inventário (canon descarta o "loot goblin").
4. Risco que a luz mede. O escuro é perigo e o escuro é tentação: salas opcionais mais
   fundas/escuras dão mais Fagulha e melhores baús, mas custam luz e vida. A economia premia
   quem arrisca com leitura, sem obrigar (princípio anti-grind).
5. Legível e sóbrio. HUD e telas simples (luz, vida, Fagulha; uma tela de escolha de melhoria
   ao acender). Sem barra de XP, sem números flutuantes coloridos. Combina com low-poly e com
   o melancólico-esperançoso.

Anti-objetivos explícitos [DESIGN]: nada de grind obrigatório; nada de scaling que torne o
andar 1 trivial no andar 6; nada de inventário de grade, peso ou loja de saque; nada de
"build" que dispense ler os tells do combate (o combate é o coração, ver `spec-combate.md`).

Procedência de motor [CÓDIGO]: a mecânica neutra ja existe em `prototipo/src` e é reusada,
não reescrita. `platform/*` é dono de save/progresso/settings/profile (canon 6.1); o conteúdo
de progressão de Josué em `game/content/campaign.ts` / `world.ts` / `map.ts` é TROCADO por uma
sequência de andares da cripta em `game/content/descent.ts` (canon 6.2 e 6.4), mantendo a
mecânica de escolha de upgrade, moeda e save. Descarta-se o conteúdo de Josué; reaproveita-se
a mecânica.

---

## 2. O recurso central: a Fagulha

### 2.1 O que é

[DESIGN] [NORMATIVO] A Acendedora carrega uma Fagulha viva (canon seção 1): a única fonte de
luz quente que ela emana ao entrar numa câmara fria. No sistema, a Fagulha tem DUAS leituras
que andam juntas:

- Fagulha como LUZ ATIVA (estado contínuo): define o raio de luz quente ao redor da
  Acendedora enquanto ela explora uma sala em penumbra. É um recurso de presença, não um
  número que ela "gasta clicando".
- Fagulha como MOEDA (estado acumulável): pontos de Fagulha (abreviar "PF" na doc, nunca na
  tela) que ela ganha ao limpar salas, abrir baús e derrotar esqueletos, e que os braseiros
  convertem em melhorias permanentes (seção 4 e 5).

[DESIGN] Por que unificar luz e moeda: o canon faz a luz ser o eixo de tudo (a luz recua, os
mortos despertam, o braseiro contém). Ter uma moeda separada brigaria com isso. Então a mesma
substância (fogo/luz) é o que ela emana, o que ela acumula e o que ela investe.

### 2.2 Os três medidores da Acendedora

[DESIGN] [NORMATIVO] A HUD (detalhe em `spec-ui-hud-ux.md`) mostra apenas três medidores, sem
barra de XP:

| Medidor | O que é | Como muda na sala | Base proposta [DESIGN] |
|---|---|---|---|
| Vida | pontos de vida da Acendedora | dano dos esqueletos a reduz; cura por braseiro/consumível | 100 (morre em ~5-6 golpes, alinhar `spec-combate.md`) |
| Vigor (stamina) | pool de esquiva/ataque pesado | gasto e regenerado em combate (constante de feel, NÃO progride por upgrade) | 100 |
| Fagulha (luz) | raio de luz quente ativa + reserva-moeda acumulada | cai devagar no escuro de salas opcionais; recarrega ao acender braseiro | raio base ~6 m; reserva inicia em 0 PF |

[DESIGN] Vigor é constante de feel do combate (como i-frames, hit stop, regen), NÃO eixo de
progressão: mexer nele quebraria o feel validado no protótipo. Isto espelha a regra da spec de
Josué (regen/i-frames/hit-stop fora da economia) e vale aqui sem retema.

### 2.3 A Fagulha como luz que recua (mecânica opcional de risco)

[DESIGN] [A DEFINIR: ativar no slice ou adiar] Proposta de tornar a luz um recurso vivo nas
salas OPCIONAIS mais fundas (corredores/antecâmaras escuras, cisternas laterais, seção 6): ao
entrar numa câmara não-obrigatória, a luz quente da Acendedora começa a recuar lentamente (o
raio encolhe ~0,3 m por segundo ate um piso de ~2 m), encenando o frio comendo a Fagulha.
Acender o braseiro daquela sala restaura o raio cheio e o estabiliza. Isto dá tensão de
risco-recompensa sem timer de tela: quanto mais ela demora no escuro, menos vê os tells.

[DESIGN] Nas salas OBRIGATÓRIAS do caminho principal, a luz NÃO recua por tempo (a Fagulha é
estável): o medo ali é o combate, não o relógio. Esta separação evita punir exploração lenta
do caminho crítico e concentra a mecânica de luz-que-recua onde ela é escolha do jogador.

[A DEFINIR] Se a luz-que-recua complicar leitura ou performance no slice, cortar e manter a
Fagulha só como moeda + raio fixo por melhoria (seção 5). Decidir após o primeiro teste de
sala escura.

---

## 3. Moedas e fontes (de onde vem a Fagulha)

### 3.1 Uma moeda única, fontes diegéticas

[DESIGN] [NORMATIVO] Há UMA moeda: pontos de Fagulha (PF). Não há ouro, gemas, nem moeda
abstrata de loja. As fontes são todas diegéticas (coisas que, na ficção, alimentam o fogo):

| Fonte | Rende (proposta) [DESIGN] | Procedência | Observação |
|---|---|---|---|
| Esqueleto comum (Manso) derrotado | 3-5 PF | [DESIGN] | dropa "cinza quente" que voa para a Acendedora |
| Esqueleto Antigo (mais forte) | 6-10 PF | [DESIGN] | variante de profundidade, ver bestiário |
| Sentinela (elite/pré-chefe) | 15-25 PF | [DESIGN] | raro, andar fundo |
| Limpar a sala (bônus de conclusão) | 5-10 PF | [DESIGN] | pago ao acender o braseiro, não por kill |
| Baú comum | 8-15 PF ou 1 consumível | [DESIGN] [ASSET] baú do Dungeon Kit | corredor/antecâmara |
| Baú selado/profundo (sala opcional) | 20-40 PF ou peça de melhoria | [DESIGN] | exige desvio ao escuro (risco, seção 6) |
| Braseiro aceso (recompensa marcada) | escolha de melhoria, não PF avulso | [DESIGN] | o gasto da Fagulha acontece aqui (seção 4-5) |

[DESIGN] A "cinza quente" / fagulhas que voam do morto derrotado para a Acendedora são VFX de
recompensa (ver `biblia-vfx-e-shaders.md`): coerente com "os mortos viram pó iluminado pela
brasa" do guia de estilo, e dá feedback de loot sem item no chão para catar.

### 3.2 Sem revista de corpo, sem catar do chão

[DESIGN] [NORMATIVO] A PF de esqueletos é creditada AUTOMATICAMENTE ao derrotá-los (a cinza
voa sozinha). Baús são interação explícita (poucos por andar). Não existe varredura de chão
nem revistar cada osso: mantém o foco no combate e no laço entrar -> limpar -> acender ->
abrir porta (canon 3.1), e respeita a sobriedade do tom (sem "loot goblin").

### 3.3 Para onde a Fagulha vai

[DESIGN] [NORMATIVO] A Fagulha acumulada existe para ser GASTA no braseiro da própria descida
(seção 4-5). Ela não é poupança entre partidas por padrão; a discussão de meta-progressão (o
que sobra entre descidas) está na seção 7, marcada [A DEFINIR]. O destino primário e
garantido da Fagulha é a melhoria imediata via braseiro.

---

## 4. O que cada braseiro concede

### 4.1 O braseiro como ponto de escolha

[DESIGN] [NORMATIVO] Acender o braseiro central de uma sala (canon 3.1, passo 4) faz quatro
coisas, nesta ordem:

1. Acende a luz quente da sala (penumbra fria -> sala iluminada quente): leitura de vitória.
2. Cura uma fração da vida da Acendedora (proposta: +25% da Vida máxima), reforçando o
   braseiro como ponto seguro.
3. Abre a tela de ESCOLHA DE MELHORIA: oferece um pequeno leque de melhorias (proposta: 3
   opções sorteadas/curadas, o jogador escolhe 1), pagas com a Fagulha acumulada e/ou
   concedidas como recompensa do andar.
4. DESTRAVA a porta de pedra de saída.

[DESIGN] Nem todo braseiro oferece melhoria do mesmo peso. Tipos de braseiro casados com os
tipos de sala do canon (3.2):

| Braseiro em... | Oferece | Frequência no slice |
|---|---|---|
| Câmara de guarda (obrigatória) | cura + 1 melhoria menor (escolha de 3) | a maioria das salas |
| Santuário do braseiro (recompensa marcada, canon 3.2) | cura + 1 melhoria MAIOR (escolha de 3, valores dobrados) | 1-2 por descida (andar 4 da narrativa) |
| Corredor/antecâmara (respiro) | sem braseiro de melhoria, ou só braseiro-tocha decorativo + baú | salas de respiro |
| Câmara do Guardião | a própria Brasa ao fim (set piece, não melhoria de loja) | clímax |

### 4.2 As categorias de melhoria

[DESIGN] [NORMATIVO] Toda melhoria de braseiro cai numa destas categorias. Cada uma tem uma
curva de valores em 4.3. Cobrem exatamente o que o canon pede (dano, alcance, vida, raio de
luz, etc.):

| Categoria | Efeito | Eixo de fantasia |
|---|---|---|
| Dano | aumenta o dano do golpe melee da Acendedora | bater mais forte |
| Alcance do golpe | aumenta o alcance/hitbox do ataque | acertar de mais longe, segurar espaço |
| Vida | aumenta a Vida máxima (e cura ao adquirir) | aguentar mais |
| Raio de luz | aumenta o raio de luz quente da Fagulha (ver mais cedo, ler tells antes) | enxergar o escuro |
| Vigor de combate | leve aumento da regeneração ou da janela de ações por pool (sobriedade: pequeno) | manter o ritmo |
| Brasa de impacto | adiciona um efeito ao golpe (knockback maior, ou um tique de queima leve) | controle/utilidade |
| Resiliência | leve redução de dano recebido, ou 1 absorção por sala | guarda |

[DESIGN] [ASPIRACIONAL] Cada melhoria tem um nome diegético e uma microlinha de narração ao
ser escolhida (o braseiro como "contador de história", narrativa 7.2): ex. Dano = "Têmpera na
brasa", Raio de luz = "Sopro na Fagulha", Vida = "Calor nas veias". Nunca emoji; o fogo é a
cena, não o texto (guia de estilo 1.2).

### 4.3 Curva de valores (proposta)

[DESIGN] [A DEFINIR: ratificar no balanceamento] Valores de partida por melhoria, pensados
para "poder contido": ao fim de uma descida de 6-7 braseiros, a Acendedora fica claramente
mais capaz, sem trivializar nada. Base: Vida 100, Dano de golpe ~12 (alinhar `spec-combate.md`).

Melhoria MENOR (Câmara de guarda), por aquisição:

| Categoria | Ganho menor | Custo em Fagulha (proposta) |
|---|---|---|
| Dano | +2 (de ~12, ~+17%) | 25 PF |
| Alcance do golpe | +8% de alcance/hitbox | 25 PF |
| Vida | +12 Vida máx (e cura igual) | 20 PF |
| Raio de luz | +1,0 m de raio | 20 PF |
| Vigor de combate | +8% de regen de Vigor | 20 PF |
| Brasa de impacto | +15% de knockback OU queima leve 1/s por 3 s | 30 PF |
| Resiliência | -5% de dano recebido OU 1 absorção/sala | 30 PF |

Melhoria MAIOR (Santuário do braseiro): mesma lista, ganho dobrado e custo ~1,6x (proposta:
+4 Dano, +20% alcance, +24 Vida, +2,0 m luz, etc.; custos 35-50 PF). Por ser rara (1-2 por
descida), é o ponto onde a partida ganha identidade.

[DESIGN] [NORMATIVO] Tetos por descida (anti power-creep): nenhum eixo pode passar de um teto
duro numa única descida, para garantir o princípio 2. Propostas de teto por descida:

| Eixo | Teto por descida (proposta) |
|---|---|
| Dano | +50% sobre a base |
| Vida | +60% sobre a base (de 100 a ~160) |
| Raio de luz | +4 m sobre a base (de ~6 a ~10) |
| Alcance do golpe | +30% |
| Redução de dano (Resiliência) | -25% (piso de dano sempre > 0) |

Acima do teto, a melhoria daquela categoria some das opções ofertadas (o leque se ajusta), o
que naturalmente diversifica as escolhas no fim da descida.

### 4.4 Economia da escolha (curadoria das 3 opções)

[DESIGN] [NORMATIVO] As 3 opções de cada braseiro NÃO são totalmente aleatórias: são curadas
para sempre dar escolha real (ex.: nunca oferecer 3x a mesma categoria; sempre incluir ao
menos 1 ofensiva e 1 defensiva/utilidade quando ambas estiverem abaixo do teto). Isto evita
oferta "morta" e mantém decisão significativa todo braseiro.

[DESIGN] Custo coberto pela Fagulha do andar: o jogador deve, em geral, ter PF suficiente para
escolher UMA das 3 ao chegar no braseiro (a economia de 3.1 é calibrada para isso, seção 6.3).
Se faltar PF para qualquer opção, o braseiro ainda cura e abre a porta (nunca trava o
progresso); a melhoria perdida é o custo de ter limpado mal a sala ou pulado baús.

---

## 5. Lista/árvore de melhorias

### 5.1 Lista, não árvore de pré-requisitos

[DESIGN] [NORMATIVO] As melhorias são uma LISTA por categoria (seção 4.2), com NÍVEIS
acumuláveis dentro do teto da descida, não uma árvore ampla de pré-requisitos. Justificativa
(mesma da spec de Josué, mecânica neutra): árvore grande é custo de UI, de balanceamento e de
conteúdo; uma lista enxuta entrega escolha sem o peso, e cabe na sobriedade visual. Cada
braseiro sobe 1 nível na categoria escolhida.

### 5.2 Melhorias-assinatura (raras, marcadas)

[DESIGN] [A DEFINIR: quantas entram no slice] Além das 7 categorias incrementais, até 2
melhorias ASSINATURA por descida, ofertadas só em Santuários do braseiro ou como drop de
Sentinela, que mudam o FEEL (não só o número). Exemplos:

- Rastro de brasa: a esquiva deixa um rastro de fogo curto que queima quem atravessa. [DESIGN]
- Pavio longo: o braseiro aceso ilumina TAMBÉM a próxima sala por alguns segundos ao entrar
  (vantagem de leitura no início do próximo combate). [DESIGN]
- Cinza viva: a primeira vez que a Vida zera numa descida, a Fagulha a reacende com pouca vida
  (1 ressurreição por descida). Eco direto da Fagulha que "não se deixa apagar" (guia de
  estilo 1.4). [DESIGN] [A DEFINIR: pode ser forte demais; testar]

[DESIGN] [NORMATIVO] As assinaturas são únicas por descida (não empilham repetidas) e raras de
propósito, para que pegar uma seja um evento (espelha o "Tier IV raro" da spec de Josué).

### 5.3 Conjunto essencial (cortar o resto se faltar tempo)

[DESIGN] [NORMATIVO] O mínimo para o slice funcionar: as categorias Dano, Vida e Raio de luz
(as três mais legíveis e mais temáticas), a cura ao acender o braseiro, e a tela de escolha de
3. Alcance, Vigor, Brasa de impacto, Resiliência e as assinaturas são expansão. Raio de luz NÃO
é cortável: é a melhoria que mais amarra progressão ao tema (ver mais = afastar o escuro).

---

## 6. Economia de risco-recompensa e curva de dificuldade

### 6.1 Risco-recompensa por sala

[DESIGN] [NORMATIVO] O caminho principal (salas obrigatórias) é calibrado para ser vencível
sem desvios; os desvios (salas opcionais) é que carregam o risco-recompensa:

- Salas obrigatórias (Câmara de guarda, Cisterna/salão): combate do caminho crítico, Fagulha
  e braseiro garantidos. A luz é estável (seção 2.3).
- Salas opcionais (antecâmaras escuras, cisternas laterais, atrás de porta extra): mais
  esqueletos e/ou Antigos, baú selado (20-40 PF ou peça de melhoria), e a luz-que-recua
  (seção 2.3) cobrando leitura. Recompensa maior, perigo maior, sempre puláveis.

[DESIGN] A decisão central do jogador a cada bifurcação: "desço ao escuro por mais Fagulha
(comprar a próxima melhoria) ou sigo seguro?" Isto é a economia de risco do jogo, e ela honra
o tema (a luz mede a coragem).

### 6.2 Curva de dificuldade pelos 5-7 andares

[DESIGN] [NORMATIVO] A dificuldade sobe em sincronia com o poder (princípio 2), casada com os
Atos e camadas do poço da narrativa (narrativa seção 8). Tabela de partida para 7 andares
(comprimir para 5 fundindo 2-3 e 5-6 se o canon fechar em 5):

| # | Camada / Ato | Inimigos (qtd e tipo) | Fagulha-alvo do andar | Braseiro | Dificuldade |
|---|---|---|---|---|---|
| 1 | Boca/Cima, Ato I | 2-3 Mansos | ~15-25 PF | menor (ensina o laço) | baixa, tutorial do laço luz/escuro |
| 2 | Cima, Ato I | 1-2 Mansos + 1 baú | ~15-30 PF | menor + respiro | baixa, telegrafia/respiro |
| 3 | Funda, Ato II | 4-6 Mansos/Antigos (pico) | ~30-45 PF | menor | media-alta, pico de combate |
| 4 | Funda, Ato II | 3-4 Antigos | ~35-55 PF | MAIOR (Santuário) | media; recompensa marcada |
| 5 | Funda/Origem, Ato III | salão + 1 Sentinela (pré-chefe opcional) | ~40-65 PF | menor/maior | alta; "luta contra uma como ela" |
| 6 | Origem, Ato III | 3-4 Antigos + armadilhas | ~40-60 PF | MAIOR (Santuário) | alta; verdade/preço da fagulha |
| 7 | Brasa, Ato III | Guardião (chefe) | reavivar a Brasa (fim) | a própria Brasa | clímax |

[DESIGN] [NORMATIVO] Regras da curva:

- Cada nova ameaça (Antigo no andar 3, Sentinela no 5, armadilha no 6, Guardião no 7) entra com
  um andar que a ENSINA antes de exigir (mesmo princípio do `spec-combate.md`: o inimigo é um
  quebra-cabeça que ensina um verbo).
- O ganho de poder do jogador (melhorias) nunca abre folga grande sobre a subida de
  dificuldade: um andar de cima mal jogado ainda mata. Sem one-shot do conteúdo anterior.
- O limite de ate ~8 esqueletos skinned animando por sala (canon 4.3, [ASPIRACIONAL]/[A
  DEFINIR]) é teto de performance, não só de design: a curva de "qtd de inimigos" acima
  respeita esse teto.
- Acessibilidade (modos de assistência em `spec-ui-hud-ux.md`) modula a dificuldade SEM mexer
  na economia/progressão: são eixos independentes.

### 6.3 Calibragem da oferta vs. custo

[DESIGN] [A DEFINIR: ratificar no balanceamento] A Fagulha-alvo de cada andar (coluna acima) é
calibrada para que o jogador possa comprar ~1 melhoria menor por braseiro do caminho
principal, e mais 1 se explorar o opcional. Ao fim de 7 andares: ~5-7 melhorias menores + 1-2
maiores, batendo nos tetos de 1-2 eixos e deixando os outros parciais. Isto produz partidas
com identidade diferente sem estourar o poder contido.

---

## 7. Progressão dentro da descida vs. entre descidas (meta-progressão)

### 7.1 Dentro de uma descida (garantido, NORMATIVO)

[DESIGN] [NORMATIVO] Toda a progressão das seções 4-5 é DENTRO de uma descida: começa do zero
(Acendedora base) e cresce ate o Guardião. Uma descida é uma unidade completa de progressão,
coerente com o pilar do canon "loop pequeno e completo antes de conteúdo" (canon 2.4). O slice
alvo entrega isto inteiro: descer, acumular Fagulha, escolher melhorias, vencer o Guardião,
reavivar a Brasa (fim).

### 7.2 Entre descidas (meta-progressão) [A DEFINIR]

[DESIGN] [A DEFINIR: definir após o slice rodar] Decisão de gênero em aberto: Brasa é uma
campanha LINEAR (uma descida, vitória definitiva, sem repetir) ou um roguelite (morrer/vencer
reinicia a descida com algo retido)? O canon não fecha isto; a narrativa fala em "descida"
única e finais escolhidos (narrativa 5.5), o que sugere linear para o slice. Opções, com
recomendação:

- Opção A (recomendada para o slice) [DESIGN]: LINEAR. Sem meta-progressão. Morrer recarrega o
  último autosave de andar (ver 8); vencer encerra o slice. Mais simples, casa com a narrativa
  de descida única, é o menor risco e o que o roadmap pede primeiro (canon 7).
- Opção B (pós-slice, se quisermos rejogabilidade): roguelite leve. Ao morrer, a Acendedora
  perde as melhorias da descida, mas uma fração da Fagulha total vira "Brasa retida" que
  desbloqueia melhorias de PARTIDA permanentes num santuário-base (ex.: começar com +X Vida, ou
  uma assinatura desbloqueada). Casaria com a ficção de "cada Acendedora que tombou alimenta a
  próxima" (restos de Acendedora anterior, narrativa 8 andar 5). Requer geração de salas e
  balanceamento de loop longo, ambos [A DEFINIR] no canon (3.2).

[DESIGN] [NORMATIVO] Enquanto a Opção B não for ratificada, o slice é Opção A: nenhuma
persistência de poder entre descidas; a única persistência é o autosave de andar dentro da
descida em curso (seção 8). Registrar a escolha aqui antes de implementar meta-progressão.

---

## 8. Relação com save e persistência

[DESIGN] [NORMATIVO] A progressão se liga ao fluxo definido em
[`spec-fluxo-e-persistencia.md`](spec-fluxo-e-persistencia.md). Mapeamento (re-tema do save de
Josué, mecânica neutra; o "capítulo" de Josué vira "andar" de Brasa):

- O autosave de FIM DE ANDAR substitui o "autosave de fim de capítulo": ao acender o braseiro
  e cruzar a porta de pedra para o próximo andar, o jogo salva (marco firme de progresso da
  descida). É o ponto seguro do RETRY.
- Morte da Acendedora -> GAME_OVER -> RETRY recarrega o início do andar atual (último autosave),
  sem passar por menu (espelha o RETRY de checkpoint da spec de fluxo). Na Opção A (seção 7), o
  jogador reentra no andar com a Fagulha e melhorias que tinha ao começá-lo.
- Reavivar a Brasa (vencer o Guardião) dispara o equivalente ao `#fim_capitulo`: tela de
  desfecho/final escolhido (narrativa 5.5) e fim do slice.

[DESIGN] [NORMATIVO] O que o save de Brasa contém (campos, não formato final; deriva do modelo
da spec de fluxo seção 5):

- andar atual / id do ponto seguro (qual porta de pedra foi a última cruzada);
- estado da Acendedora: Vida máx atual, níveis por categoria de melhoria, assinaturas
  adquiridas, raio de luz atual;
- reserva de Fagulha (PF) acumulada;
- (se Opção B) Brasa retida persistente, em registro próprio separado do save da descida.

[DESIGN] [CÓDIGO] `platform/*` (canon 6.1) ja é dono de save/progresso; reusar como está,
gravando os campos acima. Tamanho-alvo: poucas dezenas de KB, JSON, sem binário (herdado da
spec de fluxo). Settings (volume, assistências) vivem em registro próprio, fora do save de
progressão.

---

## 9. Recorte do slice (o mínimo que nasce certo)

[DESIGN] [NORMATIVO] Para não furar o escopo do vertical slice (canon seção 7), o mínimo de
progressão a entregar:

- Fagulha como medidor de luz (raio) + moeda (PF), na HUD com Vida e Vigor. Sem barra de XP.
- Fonte de Fagulha por esqueleto derrotado (cinza voa) + baús; sem catar do chão.
- Braseiro que cura, abre a tela de escolha de 3 e destrava a porta.
- Categorias essenciais (5.3): Dano, Vida, Raio de luz, com a curva de 4.3.
- Save de fim de andar + RETRY do andar (seção 8); progressão LINEAR (Opção A da seção 7).
- Curva de dificuldade dos 5-7 andares (6.2) ate o Guardião.

[DESIGN] Adiar ate o slice rodar: meta-progressão / roguelite (7.2 Opção B), luz-que-recua se
complicar (2.3), assinaturas além de 1-2, categorias não-essenciais (Alcance, Vigor, Brasa de
impacto, Resiliência), e geração procedural de salas (canon 3.2 [A DEFINIR]).

---

## 10. Recomendação final

[DESIGN] Recurso e progressão são UMA coisa: a Fagulha (luz), que a Acendedora emana, acumula
e investe. Sem moeda abstrata, sem barra de XP, sem inventário de grade: a luz é o tema, o
recurso e o poder, fiel ao canon.

Eixos de poder, em ordem de peso: (1) as MELHORIAS escolhidas no braseiro (Dano, Vida, Raio de
luz como núcleo; demais como expansão); (2) o RAIO DE LUZ como progressão que amarra poder ao
tema (ver mais = afastar o escuro); (3) leitura de combate e gestão de risco, que nenhum
upgrade dispensa. Poder contido: tetos por descida garantem que o andar de cima nunca vire
trivial.

Economia: uma moeda diegética (Fagulha), creditada por esqueleto/baú/limpeza, gasta no
braseiro por escolha de 3 melhorias curadas. Risco-recompensa concentrado nas salas opcionais
escuras (mais Fagulha, mais perigo, sempre puláveis). Curva de dificuldade casada com os Atos
e camadas do poço, ate o Guardião.

Escopo: progressão LINEAR completa dentro de uma descida (seção 9), com save de fim de andar e
RETRY. Meta-progressão entre descidas fica [A DEFINIR] ate o slice provar o loop; construir
roguelite antes disso seria scope creep. A descida única, com começo, melhorias, chefe e o
acender da Brasa, é o que valida o sistema.

---

## Checklist de aceite (Definition of Done)

`[NORMATIVO]` Cada item recebe sim/não honesto.

Recurso central: a Fagulha (seção 2)
- [ ] A Acendedora tem um recurso único, a Fagulha, com dupla leitura: luz ativa (raio quente) e moeda acumulável (PF). [DESIGN][NORMATIVO]
- [ ] A HUD mostra exatamente três medidores (Vida, Vigor, Fagulha) e nenhuma barra de XP. [DESIGN][NORMATIVO]
- [ ] Vigor é constante de feel do combate e NÃO é eixo de progressão (não há upgrade que mude regen/i-frames/hit-stop). [DESIGN][NORMATIVO]
- [ ] A grafia segue o glossário: Fagulha maiúscula quando é o recurso; braseiro/câmara/porta de pedra minúsculas. [DESIGN][NORMATIVO]

Moedas e fontes (seção 3)
- [ ] Há uma única moeda (pontos de Fagulha); não existe ouro, gema nem moeda abstrata de loja. [DESIGN][NORMATIVO]
- [ ] Fagulha vem de: esqueleto derrotado (cinza voa, crédito automático), limpar a sala, e baús; sem revista de corpo nem catar do chão. [DESIGN][NORMATIVO]
- [ ] Esqueletos não sangram: a recompensa é cinza/pó iluminado pela brasa (coerente com guia de estilo). [DESIGN][ASSET][NORMATIVO]
- [ ] O destino primário e garantido da Fagulha é a melhoria via braseiro da própria descida. [DESIGN][NORMATIVO]

O que o braseiro concede (seção 4)
- [ ] Acender o braseiro: acende a luz quente da sala, cura uma fração da Vida (proposta +25%), abre a escolha de melhoria e destrava a porta de pedra. [DESIGN][NORMATIVO]
- [ ] A tela de escolha oferece um leque pequeno (proposta 3 opções) das quais o jogador escolhe 1; nunca trava o progresso se faltar Fagulha (braseiro ainda cura e abre porta). [DESIGN][NORMATIVO]
- [ ] As melhorias cobrem as categorias do canon: dano, alcance, vida, raio de luz, vigor de combate, brasa de impacto, resiliência. [DESIGN][NORMATIVO]
- [ ] Existem braseiros maiores (Santuário do braseiro) com melhoria de maior peso, raros (1-2 por descida). [DESIGN][NORMATIVO]
- [ ] As 3 opções são curadas (nunca 3x a mesma categoria; equilíbrio ofensivo/defensivo quando ambos abaixo do teto). [DESIGN][NORMATIVO]

Curva de valores e tetos (seção 4.3)
- [ ] Cada categoria tem curva de valores e custo em Fagulha proposta (menor e maior), a ratificar no balanceamento. [DESIGN][A DEFINIR: ratificação no balanceamento]
- [ ] Há tetos duros por descida por eixo (Dano +50%, Vida +60%, Raio de luz +4 m, Alcance +30%, redução de dano -25% com piso > 0); ao bater o teto, a categoria sai da oferta. [DESIGN][NORMATIVO]

Lista/árvore de melhorias (seção 5)
- [ ] Melhorias são uma LISTA por categoria com níveis acumuláveis, não árvore de pré-requisitos. [DESIGN][NORMATIVO]
- [ ] Há ate 2 melhorias-assinatura por descida (mudam o feel, não só número), únicas e raras. [DESIGN][NORMATIVO]
- [ ] O conjunto essencial está presente: Dano, Vida, Raio de luz, cura ao acender e tela de escolha de 3; Raio de luz não é cortável. [DESIGN][NORMATIVO]

Risco-recompensa e dificuldade (seção 6)
- [ ] O caminho principal é vencível sem desvios; salas opcionais escuras dão mais Fagulha/baú melhor a mais risco e são sempre puláveis. [DESIGN][NORMATIVO]
- [ ] A dificuldade sobe em sincronia com o poder pelos 5-7 andares, casada com Atos/camadas do poço; nenhum ganho torna trivial o andar anterior (sem one-shot do conteúdo de cima). [DESIGN][NORMATIVO]
- [ ] Cada nova ameaça (Antigo, Sentinela, armadilha, Guardião) entra num andar que a ensina antes de exigir. [DESIGN][NORMATIVO]
- [ ] A contagem de inimigos por sala respeita o teto de performance (<= ~8 skinned por sala, canon 4.3). [DESIGN][NORMATIVO]
- [ ] Acessibilidade modula a dificuldade sem mexer na economia/progressão (eixos independentes). [DESIGN][NORMATIVO]

Dentro vs. entre descidas (seção 7)
- [ ] A progressão de uma descida começa do zero e cresce ate o Guardião (unidade completa). [DESIGN][NORMATIVO]
- [ ] O slice é LINEAR (Opção A): sem persistência de poder entre descidas ate a meta-progressão ser ratificada. [DESIGN][NORMATIVO]
- [ ] A meta-progressão (roguelite leve, Opção B) está registrada como decisão pendente, não implementada antes do slice. [DESIGN][A DEFINIR: definir após o slice rodar]

Save e persistência (seção 8)
- [ ] Autosave de fim de andar ao cruzar a porta de pedra; RETRY recarrega o início do andar atual sem passar por menu. [DESIGN][NORMATIVO]
- [ ] O save contém andar/ponto seguro, estado da Acendedora (Vida máx, níveis de melhoria, assinaturas, raio de luz) e reserva de Fagulha; reusa `platform/*`. [DESIGN][CÓDIGO][NORMATIVO]
- [ ] Reavivar a Brasa dispara o desfecho/fim do slice (equivalente a fim de capítulo). [DESIGN][NORMATIVO]

Escopo do slice (seção 9)
- [ ] O slice entrega Fagulha (luz+moeda), fonte por esqueleto/baú, braseiro com escolha de 3, categorias essenciais, save de andar e curva dos 5-7 andares ate o Guardião. [DESIGN][NORMATIVO]
- [ ] Itens adiados (meta-progressão, luz-que-recua se complicar, categorias não-essenciais, procedural) registrados como adiamento. [DESIGN][NORMATIVO]

Transversais (padrão de detalhe, seção 4)
- [ ] Sem travessões, sem emojis em qualquer texto exibido (guia de estilo 1.2). [NORMATIVO]
- [ ] Itens [A DEFINIR] resolvidos ou explicitamente adiados com registro. [NORMATIVO]

Pendências [A DEFINIR]
- [ ] Números de progressão da seção 4.3 e da economia da seção 6 (curva, custos, tetos, Fagulha-alvo por andar); ratificar/ajustar no balanceamento. [DESIGN][A DEFINIR: ratificação no balanceamento]
- [ ] Luz-que-recua nas salas opcionais (seção 2.3): ativar no slice ou adiar; decidir após o primeiro teste de sala escura. [DESIGN][A DEFINIR]
- [ ] Meta-progressão entre descidas (seção 7.2): linear (Opção A) vs. roguelite leve (Opção B); definir após o slice rodar. [DESIGN][A DEFINIR]
- [ ] Quantas melhorias-assinatura e quais entram no slice (seção 5.2); "Cinza viva" (auto-reacender) pode ser forte demais, testar. [DESIGN][A DEFINIR]

---

## ATUALIZAÇÃO W2 (2026-06-15) - árvore de dádivas no código

`[CÓDIGO]` `[NORMATIVO]` As 5 dádivas planas viraram uma ÁRVORE de 9 em 3 ramos, com oferta
curada no braseiro (1 de cada ramo + Lasca grátis). Detalhe e custos em
[`00-aprofundamento-e-roadmap.md`](00-aprofundamento-e-roadmap.md) 3.1.

| Ramo | Dádivas |
|---|---|
| Agressão | Golpista (+12% dano), Queimador (Queimadura +2s/+1 stack), Sede da Brasa (roubo de vida) |
| Defesa | Revestimento (cap de dano 22), Fôlego (+25 stamina), Pele de Brasa (+25 vida) |
| Utilidade | Fagulha Perene (regen +60%), Ressonância (acertos encadeados +30% dano), Braseiro Quente (cura 60% ao acender) |

Matriz de economia (PF por andar x custo) permanece a referência da seção anterior; a
curadoria por ramo garante que nenhuma visita ofereça 3 do mesmo tipo.
