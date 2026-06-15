# Spec do Vertical Slice - A Cripta Jogável (Brasa)

Especificação executável do primeiro pedaço jogável de Brasa: a descida pela cripta, de
7 câmaras seladas até reavivar a Brasa. Substitui, para todos os efeitos, o antigo
[`../spec-prototipo-jerico.md`](../spec-prototipo-jerico.md) (era Josué, aposentado pela
virada de tema). Gênero: dungeon crawler 3D em 3a pessoa. Motor: Babylon.js reaproveitado
do protótipo (ver [`../projeto-brasa.md`](../projeto-brasa.md) seção 6). Arte: low-poly
estilizado, contraste frio-azul contra laranja-quente. Plataforma: navegador (foco: rodar
LEVE). Idioma: português.

Documento mestre (CANON, prevalece em conflito): [`../projeto-brasa.md`](../projeto-brasa.md),
sobretudo seções 3 (estrutura sala-a-sala), 4 (orçamento técnico NORMATIVO), 6 (mapeamento
sobre o motor) e 7 (roadmap). Sistemas em
[`game-design-e-sistemas.md`](game-design-e-sistemas.md) (laço de sala/descida, combate,
exploração, braseiro, progressão, ritmo). Tipos de sala e kit modular em
[`biblia-ambientes.md`](biblia-ambientes.md). Luz fria/quente em
[`biblia-iluminacao.md`](biblia-iluminacao.md). Chefe em
[`spec-chefe-guardiao.md`](spec-chefe-guardiao.md). Régua de detalhe e formato de DoD em
[`../padrao-de-detalhe.md`](../padrao-de-detalhe.md).

Convenção: pt-BR, sem travessões, sem emojis. Procedência `[DESIGN]` (decisão nossa),
`[CÓDIGO]` (observado no código do protótipo), `[ASSET]` (procede de pacote CC0).
Exigência `[NORMATIVO]` (entra no aceite, verificável), `[ASPIRACIONAL]` (mood, não
bloqueia), `[A DEFINIR]` (pendência). Vocabulário canônico: Brasa, Acendedora, Guardião,
poço-cripta, câmara/sala, braseiro, porta de pedra selada, mortos despertos/esqueletos,
frio eterno, fagulha.

Snapshot: 2026-06-14.

---

## 0. Propósito: o que este slice precisa provar

`[DESIGN]` O vertical slice NÃO é uma demo bonita. É o experimento que responde, com algo
jogável, as perguntas que decidem o jogo inteiro. Cada decisão abaixo é dimensionada para
responder essas perguntas com o MENOR esforço, não para ser o jogo final:

1. O laço de sala (entrar -> selar -> despertar -> limpar -> acender braseiro -> cruzar)
   prende e dá vontade de descer a próxima câmara?
2. O combate melee reaproveitado (`engine/combat/*`, `game/combat/*`) contra esqueletos
   KayKit é satisfatório e gerenciável de produzir solo?
3. O contraste de luz fria-para-quente ao acender o braseiro vende a vitória da sala?
4. O gerenciador de uma-sala-ativa COM DESCARTE mantém o jogo dentro do orçamento
   (< 60 draw calls/sala, 60 fps desktop / 30 mobile) durante a descida inteira?
5. O pipeline KayKit CC0 (Adventurer + Skeletons + Dungeon Remastered) mais
   `blender-python` (`optimize_asset.py`/`validate_gltf.py`) é produtivo?

`[DESIGN]` Se as respostas forem sim, seguimos para a cripta completa (mais andares,
variantes de esqueleto, talvez salas procedurais). Se o combate melee não fechar, aciona-se
o plano de simplificar verbos e reduzir encontros (ver
[`game-design-e-sistemas.md`](game-design-e-sistemas.md) seção 7), mantendo a descida.

---

## 1. Decisões fechadas (resolvendo os [A DEFINIR] do CANON)

`[DESIGN]` `[NORMATIVO]` O CANON deixou em aberto duas decisões estruturais do slice; esta
spec as FECHA, alinhada às recomendações de `projeto-brasa.md` 3.2:

| Decisão pendente no CANON | Resolução nesta spec | Justificativa |
|---|---|---|
| Nº exato de salas (proposta 5-7) | **7 câmaras**: 1 abertura + 5 de descida + 1 do Guardião | Cabe nos 5-7; dá curva de ritmo completa (ensino, 2 picos, 2 respiros, santuário, clímax) sem inflar escopo |
| Geração: fixa vs procedural | **FIXA, desenhada à mão** (layouts e recheio definidos na seção 3) | Recomendação do CANON; máximo controle de ritmo e de orçamento para provar o laço antes de proceduralizar |

`[DESIGN]` `[NORMATIVO]` Decisões dependentes herdadas de
[`game-design-e-sistemas.md`](game-design-e-sistemas.md), fechadas para o slice:

- Upgrades **só dentro da descida** (não persistem entre descidas; sem meta-progressão).
- Derrota: **reinício da descida do topo** (run curta; sem checkpoint no slice).
- Uma só curva de dificuldade (sem níveis selecionáveis).
- Sem habilidade de fagulha (golpe de luz) no slice: só ataque leve + esquiva + travar
  alvo opcional. `[A DEFINIR]` reabrir após medir o combate base.

`[A DEFINIR]` (pendências que NÃO bloqueiam a planta, mas o aceite registra):
- Acender o braseiro: instantâneo vs canalização de ~1s. Recomendação `[DESIGN]`:
  canalização curta (~0.8s) por cerimônia; medir se atrapalha o ritmo.
- Consumível de cura (fagulha menor) nos respiros. Recomendação `[DESIGN]`: incluir 1 cura
  no slice (sala 3, respiro), para tornar a barganha do respiro mais aguda; rebaixar se
  desbalancear.

---

## 2. Fluxo do slice (passo a passo do que o jogador faz)

`[DESIGN]` `[NORMATIVO]`

1. **Título e contexto.** Tela-título simples -> texto curto: o frio eterno avança, a Brasa
   morre no fundo do poço-cripta, os mortos despertam no escuro; você é a última
   Acendedora e carrega a fagulha. Overlay de UI, sem cena 3D dedicada.
2. **Topo do poço-cripta (Sala 1, abertura).** Spawn da Acendedora. Tutorial implícito
   (seção 5): andar, câmera, primeiro esqueleto fraco, primeiro braseiro. Ensina o laço
   inteiro sem texto de tutorial.
3. **Descida (Salas 2 a 6).** Cada câmara aplica o laço de sala (seção 4). O ritmo alterna
   pico de combate, respiro e marco de recompensa conforme a curva da seção 3. A cada
   braseiro a Acendedora ganha fagulha e (nos santuários) escolhe um upgrade; o raio de
   luz cresce.
4. **Câmara do Guardião (Sala 7, clímax).** Chefe único (ver
   [`spec-chefe-guardiao.md`](spec-chefe-guardiao.md)). Combate longo, leitura de fases por
   silhueta e cor. Não há braseiro comum: o objetivo é o próprio Guardião.
5. **Reavivar a Brasa (desfecho).** Vencido o Guardião, a Acendedora leva a fagulha à Brasa
   apagada no fundo do poço; a luz quente sobe pelo poço (set piece, ver
   [`spec-set-pieces.md`](spec-set-pieces.md)). Tela de desfecho com estatísticas da descida
   (salas, tempo, esqueletos, dano levado) e texto de fecho. Fim do vertical slice.
6. **Morte.** Se a vida da Acendedora chega a zero a fagulha se apaga: tela de derrota ->
   reinício da descida do topo (Sala 1), sem save.

`[DESIGN]` Tempo-alvo de jogo: 6 a 10 minutos por descida bem-sucedida. Suficiente para
sentir o laço repetido, a curva de poder e o desfecho.

---

## 3. Planta da cripta: a sequência das 7 câmaras (FIXA)

`[DESIGN]` `[NORMATIVO]` Sequência fixa, em sentido único, porta a porta. Cada linha é uma
sala montada 100% com o Dungeon Remastered Pack (zero primitiva representando arquitetura ou
prop) e povoada com esqueletos KayKit instanciados. As contagens de inimigos respeitam o
teto aspiracional de <= 8 esqueletos animando por sala. A coluna "ganho" é o que o jogador
leva ao acender o braseiro.

| # | Nome (id) | Tipo | Inimigos | Props de cena | Braseiro | Armadilha | Ganho (ao acender) |
|---|---|---|---|---|---|---|---|
| 1 | Topo do poço (`abertura`) | Câmara de guarda | 1 esqueleto base, lento | piso/parede modular, escada de descida ao fundo, 1 tocha apagada | 1 braseiro pequeno, central | nenhuma (tutorial) | fagulha base; destrava saída; luz quente ensina o sinal de vitória |
| 2 | Antecâmara dos ossos (`antecamara_1`) | Corredor / antecâmara | nenhum (respiro) ou 1 esqueleto isolado | corredor estreito, 1 baú, grade de espinhos no piso | 1 braseiro pequeno ao fim | espinhos telegrafados (placa que sobe) | fagulha extra do baú (opcional, atrás da armadilha); destrava saída |
| 3 | Cisterna inundada (`cisterna_1`) | Cisterna / salão | 3 a 4 esqueletos | salão amplo, 4 pilares de cobertura, piso com água rasa decorativa | 1 braseiro médio, central | nenhuma (pilares são a tática) | fagulha; 1 consumível de cura `[A DEFINIR]`; destrava saída |
| 4 | Santuário da chama fria (`santuario_1`) | Santuário do braseiro | nenhum (recompensa marcada) | nicho cerimonial, 2 tochas, mosaico no piso | 1 braseiro GRANDE, elevado | nenhuma | fagulha + ESCOLHA de upgrade (2-3 eixos, seção 6); raio de luz cresce |
| 5 | Salão dos guardas mortos (`cisterna_2`) | Cisterna / salão | 5 a 6 esqueletos (pico) | salão maior, 6 pilares, 2 esqueletos com arma diferente (mesmo atlas) | 1 braseiro médio, central | espinhos numa faixa do piso (telegrafados) | fagulha; destrava saída |
| 6 | Antecâmara do Guardião (`antecamara_2`) | Corredor / antecâmara | 1 a 2 esqueletos rápidos | corredor descendente, 1 baú, portão de pedra grande ao fim (a câmara do chefe) | 1 braseiro pequeno | nenhuma (respiro antes do chefe) | fagulha + ESCOLHA de upgrade final (santuário leve); abre o portão do Guardião |
| 7 | Câmara do Guardião (`guardiao`) | Câmara do Guardião | 1 chefe (Guardião da Brasa apagada) | câmara ampla circular, a Brasa apagada ao centro/fundo, escombros de cobertura | a própria Brasa (acende no fim) | mecânicas do chefe (ver spec do chefe) | reavivar a Brasa = FIM do slice |

`[DESIGN]` Curva de ritmo resultante (respeita "nunca dois picos máximos seguidos sem
respiro", `game-design-e-sistemas.md` 7):

```
Sala:    1        2          3          4            5         6           7
Tipo:    ensino   respiro    pico médio recompensa   pico alto respiro     CLÍMAX
Ameaça:  ▁        ▁          ▄          ▁            █         ▂           ███ (chefe)
Poder:   base     +fagulha   +cura      +UPGRADE     (usa)     +UPGRADE    (usa tudo)
```

`[DESIGN]` Composição dos esqueletos por parâmetro de FSM, nunca por modelo novo
(`game-design-e-sistemas.md` 3, 7): base (sala 1), normal (3, 6), com arma diferente do
mesmo atlas (5), rápido/agressivo (6). Variação por escala, cor de atlas, arma e parâmetros,
conforme CANON 4.3.

`[A DEFINIR]` Posições exatas (XZ) de spawn de herói, esqueletos, baús, braseiro e gatilhos
por sala: definir como empties nomeados no `.glb` de cada sala (padrão Blender->Babylon do
protótipo) na fase de implementação. A planta acima é normativa quanto a TIPO, contagem e
ganho; a topologia métrica de cada sala é detalhe de montagem.

---

## 4. O laço de uma sala (contrato de cena)

`[DESIGN]` `[NORMATIVO]` Toda sala 1 a 6 implementa a máquina de estados de sala definida em
[`game-design-e-sistemas.md`](game-design-e-sistemas.md) 2.1, na ordem fixa
`SELANDO -> COMBATE -> LIMPA -> ACESA -> SAINDO`. A sala 7 (Guardião) substitui o bloco
`COMBATE` pela luta de chefe e o `ACESA` pelo reavivar da Brasa.

| Estado | Gatilho de entrada | O que acontece | Luz | Saída |
|---|---|---|---|---|
| `SELANDO` | herói cruza a porta de entrada | porta de pedra fecha atrás (som grave), câmara em penumbra | 1 luz-chave fria, azul, raio curto | esqueletos despertam -> `COMBATE` |
| `COMBATE` | despertar telegrafado dos mortos | esqueletos atacam; combate melee; braseiro inerte | fria | último esqueleto morre -> `LIMPA` |
| `LIMPA` | zero esqueletos vivos | braseiro fica interagível (prompt); herói livre para vasculhar | fria | interação no braseiro -> `ACESA` |
| `ACESA` | interação (canalização ~0.8s `[A DEFINIR]`) | luz fria vira quente; paga recompensa; destrava porta de saída | quente, laranja, raio maior | herói cruza a saída -> `SAINDO` |
| `SAINDO` | herói cruza a porta de saída | dispara descarte da sala atual e carga da próxima (seção 7) | (transição) | próxima sala entra em `SELANDO` |

`[NORMATIVO]` Pré-condição do braseiro: só fica interagível em `LIMPA`. Tentar acender com
esqueletos vivos não responde (ou dica "a câmara ainda não está segura"). Os três efeitos do
acender (luz quente; recompensa; destrava saída) disparam na mesma batida.

`[CÓDIGO]` Estado por sala vive no gerenciador de salas (seção 7); HUD, áudio e luz leem
esse estado. Reusa `core/eventBus` para os eventos `sala:limpa`, `braseiro:aceso`,
`sala:saindo`.

---

## 5. Tutorial implícito (Salas 1 e 2)

`[DESIGN]` `[NORMATIVO]` Nada de caixas de tutorial nem texto explicativo. O ensino é a
própria geometria e o ritmo das duas primeiras salas, na ordem em que o jogador precisa
aprender cada verbo:

- **Sala 1 (Topo do poço), ensina o laço inteiro de forma segura:**
  - Spawn em penumbra fria, com a saída visivelmente selada: ensina que a luz é o recurso e
    que não há volta. O jogador anda e gira a câmera para ler a sala (locomoção + câmera).
  - 1 esqueleto único, lento, com telegrafia exagerada do golpe: ensina ataque leve e
    esquiva sem punir. Vida do herói folgada aqui.
  - Após limpar, o braseiro pulsa/brilha frio chamando atenção (affordance visual): ensina a
    interação de acender. Ao acender, a luz vira quente e a porta abre: ensina o pagamento
    do laço (luz, recurso, saída) de uma vez.
- **Sala 2 (Antecâmara dos ossos), ensina respiro e barganha:**
  - Sem combate obrigatório (ou 1 esqueleto isolado): ensina que nem toda sala é luta.
  - 1 baú com fagulha extra atrás de uma armadilha de espinhos telegrafada: ensina a
    barganha opcional do respiro (arriscar pela recompensa) e a ler armadilhas (a placa
    sobe antes de ferir). Ensina que armadilha avisa antes de causar dano (telegrafia
    honesta, pilar 5).

`[ASPIRACIONAL]` O tutorial deve ser invisível: um jogador atento não percebe que foi
ensinado, só sente que a cripta "explicou sozinha". Affordances visuais (braseiro que
pulsa, espinhos que prefiguram) substituem texto.

---

## 6. Progressão e ganhos por braseiro (no slice)

`[DESIGN]` `[NORMATIVO]` Reaproveita a mecânica genérica de moeda/escolha-de-upgrade do
motor (`platform/*`, `spec-progressao-e-economia.md`), com a fagulha como recurso. Distribuição
fixa dos ganhos pela descida:

| Sala | Tipo de ganho | Conteúdo |
|---|---|---|
| 1 abertura | fagulha base | recurso inicial; sem escolha |
| 2 antecâmara | fagulha extra opcional | 1 baú atrás de armadilha |
| 3 cisterna | fagulha + cura | recurso + 1 consumível de cura `[A DEFINIR]` |
| 4 santuário | ESCOLHA de upgrade | 1 entre 2-3 eixos (ver abaixo) |
| 5 salão | fagulha | recurso, sem escolha (sala de pico, foco no combate) |
| 6 antecâmara | ESCOLHA de upgrade final | 1 entre 2-3 eixos; prepara para o chefe |
| 7 Guardião | fim | reavivar a Brasa |

`[DESIGN]` `[NORMATIVO]` Eixos de upgrade oferecidos nos santuários (salas 4 e 6),
do `game-design-e-sistemas.md` 6, ajustando parâmetros existentes (sem malhas/efeitos novos):

| Eixo | Efeito | Onde mexe |
|---|---|---|
| Dano | golpe melee mais forte | tuning de combate (`game/combat/tuning`) |
| Alcance do golpe | hitbox de ataque maior | hitbox do `heroCombat` |
| Vida | mais vida máxima | health do herói |
| Raio de luz | luz da Acendedora alcança mais longe | raio da luz-chave da Acendedora |

`[DESIGN]` Os upgrades valem só nesta descida (sem persistência). O raio de luz cresce a
cada braseiro mesmo sem escolha explícita (progressão temática dupla: ver mais e empurrar o
escuro), em incremento pequeno fixo por sala.

---

## 7. Gerenciador de salas com descarte (contrato técnico)

`[CÓDIGO]` `[NORMATIVO]` Reescrita de `app/worldStreaming.ts`. O atual carrega regiões por
proximidade e explicitamente NÃO descarta ("Não há descarte em v1",
`worldStreaming.ts:5`). Brasa precisa do oposto: UMA sala ativa por vez, descartando a
anterior ao cruzar a porta. Esta é a peça central da leveza (CANON 4.1) e o item de aceite
mais importante do slice.

### 7.1 Modelo de uma-sala-ativa

`[DESIGN]` `[NORMATIVO]`

- Uma lista ordenada e fixa das 7 salas (`game/content/descent.ts`, ver CANON 6.4), cada
  uma com um builder que monta a cena da sala a partir do `.glb` modular + spawns.
- Estados por sala: `idle` (não carregada) -> `loading` -> `active` -> `discarded`.
  Diferença crucial frente ao atual: o estado terminal `discarded` e a transição
  `active -> discarded` que libera recursos.
- Invariante NORMATIVO: no máximo UMA sala em `active` a qualquer instante. A próxima só
  entra em `loading` durante a transição de porta; a anterior vai para `discarded` assim
  que a nova estiver `active`.

### 7.2 Sequência de transição (cruzar a porta)

`[DESIGN]` `[NORMATIVO]` Ao herói cruzar a porta de saída (estado de sala `SAINDO`):

1. Carregar a próxima sala (builder do `descent.ts`), idealmente atrás de um fade/elipse
   curto de descida (o jogador desce a escada/corredor enquanto carrega).
2. Reposicionar a Acendedora no spawn de entrada da nova sala; nova sala entra em `SELANDO`.
3. DESCARTAR a sala anterior por completo: dispose de malhas, materiais, texturas
   instanciadas, corpos de física (paredes e atores), luzes da sala, e remover seus atores
   da lista do combate/IA. Soltar referências para o GC.
4. Verificação NORMATIVA: depois do passo 3, o inspetor de cena mostra apenas os nós da
   sala nova (mais os persistentes: herói, câmera, HUD). Nenhum nó da sala anterior
   permanece.

`[CÓDIGO]` `[NORMATIVO]` Corpos de física só existem nas paredes/colisores da sala ativa e
nos atores vivos; são descartados junto (CANON 4.4). Sem terreno procedural 600x600 e sem
skydome (aposentados, CANON 6.3): a sala fechada é o mundo inteiro a cada momento.

### 7.3 Critérios de performance por sala

`[NORMATIVO]` Tetos de aceite, herdados do CANON seção 4, verificados POR SALA:

- **< 60 draw calls** com a sala carregada (folga, não estouro). Peças modulares repetidas
  instanciadas (thin instances via `sceneKit`/`vegetation`); atlas único do Dungeon Pack.
- **No máximo 1 sala de jogo carregada por vez**, com descarte da anterior (7.2).
- **60 fps desktop médio / 30 fps mobile médio**, mantidos inclusive no instante da troca
  de sala (medir o pico de carga/descarte).
- **1-2 luzes dinâmicas por sala**: 1 luz-chave (fria em combate, vira quente ao acender),
  mais no máximo 1 do braseiro; sombra desligada nas pontuais do braseiro (padrão do
  protótipo). Salas de pico não somam luzes além desse teto.
- **<= 8 esqueletos animando ao mesmo tempo** por sala (aspiracional, CANON 4.3); a planta
  da seção 3 respeita (máximo 6 na sala 5).
- Tris dentro dos tetos do CANON 4.2 (peça modular 100-400; prop 100-500; Acendedora
  1k-5k; esqueleto 1k-3k; Guardião 3k-6k). Todo `.glb` novo passa por `optimize_asset.py`
  + `validate_gltf.py`.

---

## 8. A câmara do Guardião e o desfecho (Sala 7)

`[DESIGN]` `[NORMATIVO]` A sétima câmara é o clímax e quebra o laço comum: não tem braseiro
de sala nem despertar de horda. Detalhe do chefe em
[`spec-chefe-guardiao.md`](spec-chefe-guardiao.md); aqui fica o contrato de cena no slice.

- **Entrada e selagem.** A Acendedora cruza o portão de pedra grande (aberto na sala 6); ele
  se sela atrás. Câmara ampla, fria, a Brasa apagada visível ao centro/fundo como promessa.
- **Combate de chefe.** 1 Guardião único (esqueleto-chefe KayKit, tris 3k-6k, leitura de
  fases por silhueta/cor). Usa a mesma FSM/combate, com parâmetros próprios. Escombros servem
  de cobertura. `[A DEFINIR]` número de fases e mecânicas exatas: na spec do chefe.
- **Reavivar a Brasa (set piece de desfecho).** Vencido o Guardião, a Brasa fica interagível.
  A Acendedora leva a fagulha; a Brasa pega: a luz quente sobe pelo poço-cripta, invertendo o
  frio de uma vez (ver [`spec-set-pieces.md`](spec-set-pieces.md)). É o único fim do slice.
- **Tela de desfecho.** Overlay de UI: estatísticas da descida (salas vencidas, tempo,
  esqueletos derrotados, dano levado, upgrades escolhidos) e texto de fecho sóbrio e
  esperançoso. Opção de reiniciar a descida.

`[NORMATIVO]` A sala do Guardião respeita o orçamento por sala (seção 7.3): o chefe é UM
ator skinned, dentro do teto de luzes e draw calls; não há horda concorrente.

---

## 9. Sistemas necessários (checklist do slice)

`[CÓDIGO]` Estado: o motor do protótipo é reaproveitado (CANON 6). Itens marcados [x] já
existem como mecânica genérica; [ ] são trabalho do slice (re-textura, troca de conteúdo ou
reescrita pontual).

Núcleo:
- [x] Controlador de personagem 3a pessoa (cápsula cinemática Havok) e câmera orbital com
      damping/colisão (`engine/character`, `engine/camera`).
- [x] Combate melee: hitbox, vida, dano, hit-stop, feedback de impacto, morte do inimigo
      (`engine/combat/*`, `game/combat/*`).
- [x] IA de inimigo por FSM (percepção -> aproximar -> atacar com telegrafia -> recuo)
      (`engine/ai/fsm`).
- [x] Carregamento de glTF + AnimationGroups; instanciamento (`engine/assets`,
      `game/scenes/sceneKit`, `vegetation`).
- [x] Save/progresso/settings (`platform/*`); HUD base e fluxo de telas (`game/ui/*`,
      `core/gameLoop`).
- [ ] Acendedora = KayKit Adventurer (re-apontar `heroModel`/`acendedora.ts`) com a
      biblioteca de animação compartilhada.
- [ ] Inimigo esqueleto: trocar `defender.ts` (cápsula+caixas) pela malha KayKit Skeleton
      mantendo a FSM.
- [ ] Gerenciador de salas com descarte (reescrita de `worldStreaming.ts`; seção 7).
- [ ] Salas modulares: `game/scenes/crypt/` (montador de sala do Dungeon Kit; porta de
      pedra selável; braseiro interativo).
- [ ] Sequência da descida: `game/content/descent.ts` (as 7 salas, seção 3).
- [ ] Braseiro: estado, interação (canalização `[A DEFINIR]`), troca de luz fria->quente,
      pagamento de recompensa, destrava da saída.
- [ ] Armadilha de espinhos telegrafada (salas 2 e 5).
- [ ] Escolha de upgrade no santuário (salas 4 e 6), 2-3 eixos (seção 6).
- [ ] HUD do slice: vida da Acendedora, recurso fagulha, prompt de interagir; indicador de
      estado da sala (selada/limpa/acesa) sutil.
- [ ] Telas de título, desfecho (estatísticas) e derrota; reinício da descida.
- [ ] Chefe Guardião e set piece de reavivar a Brasa (specs próprias).

NÃO incluir no slice: meta-progressão entre descidas; salas procedurais; variantes de
inimigo além de parâmetro/arma; armas à distância; níveis de dificuldade; localização EN;
backtracking; mais de uma sala carregada.

---

## 10. Câmera, controles e áudio (herdados)

`[CÓDIGO]` `[NORMATIVO]` Câmera de 3a pessoa orbital atrás da Acendedora, com damping e
colisão (não atravessa parede da cripta). Controles: WASD mover (relativo à câmera), mouse
girar câmera, botão esquerdo atacar, esquiva (recuo com i-frames curtos), E interagir
(braseiro/baú), trava de alvo opcional, Esc pausar. Toque (web mobile) desejável, pode ficar
para depois do desktop estar bom.

`[ASPIRACIONAL]` Áudio (ver [`biblia-audio.md`](biblia-audio.md)): porta de pedra selando
(grave), ossos despertando (seco), impacto de combate, estalo do fogo pegando ao acender,
trilha que respira fundo no momento morno do braseiro e volta tensa ao cruzar a saída.

---

## 11. Riscos e mitigação

`[DESIGN]`
- **Descarte vazando memória:** o item mais arriscado e o mais importante. Mitigar medindo
  draw calls e contagem de nós no inspetor a CADA troca de sala, desde 2 salas encadeadas
  (roadmap CANON passo 5), antes de montar as 7.
- **Feel de combate:** mitigar priorizando feedback (hit-stop, partícula, som) antes de
  qualquer arte de sala. O combate já existe; o risco é o ajuste de tuning contra o
  esqueleto KayKit.
- **Escopo inflando:** resistir a procedural, variantes e meta-progressão. O slice responde
  5 perguntas (seção 0), nada mais.
- **Pipeline KayKit:** validar export/otimização (`optimize_asset.py`/`validate_gltf.py`) já
  ao religar o herói (roadmap passo 2), para não descobrir problema tarde.
- **Repetição cansando:** 7 salas com o mesmo kit podem parecer iguais; mitigar pela curva
  de ritmo (seção 3), pela variação de tipo de sala e pelo crescimento visível de poder e
  luz a cada braseiro.

---

## Checklist de aceite (Definition of Done) do vertical slice

`[NORMATIVO]` Cada item recebe sim/não honesto. Derivado das seções 1 a 10. Procedência
`[DESIGN]`/`[CÓDIGO]`/`[ASSET]`. Itens `[A DEFINIR]` impedem o "pronto" enquanto em aberto
(ou viram adiamento registrado).

### Estrutura e decisões fechadas

- [ ] Slice tem exatamente 7 câmaras na sequência fixa da seção 3: 1 abertura + 5 de descida + 1 do Guardião [DESIGN][NORMATIVO] (seções 1, 3)
- [ ] Geração FIXA desenhada à mão: layouts e recheio das 7 salas conforme a planta, sem montagem procedural [DESIGN][NORMATIVO] (seções 1, 3)
- [ ] Upgrades valem só dentro da descida (sem meta-progressão); derrota reinicia do topo; uma só curva de dificuldade [DESIGN][NORMATIVO] (seção 1)

### Laço de sala (salas 1 a 6)

- [ ] Ao entrar, a porta de pedra de trás se sela e a sala fica em penumbra com 1 luz-chave fria [DESIGN][NORMATIVO] (seção 4)
- [ ] Os mortos despertam de forma telegrafada e o combate melee limpa a sala [CÓDIGO][NORMATIVO] (seções 4, 9)
- [ ] O braseiro só fica interagível com a sala LIMPA (zero esqueletos vivos) [DESIGN][NORMATIVO] (seção 4)
- [ ] Acender o braseiro dispara na mesma batida: luz fria vira quente, paga recompensa, destrava a porta de saída [DESIGN][NORMATIVO] (seção 4)
- [ ] Máquina de estados de sala SELANDO -> COMBATE -> LIMPA -> ACESA -> SAINDO implementada e legível por HUD/áudio/luz [DESIGN][NORMATIVO] (seção 4)

### Planta concreta (seção 3)

- [ ] Sala 1 (abertura): 1 esqueleto lento, braseiro pequeno, sem armadilha, tutorial do laço [DESIGN][NORMATIVO]
- [ ] Sala 2 (antecâmara): respiro, baú com fagulha atrás de armadilha de espinhos telegrafada [DESIGN][NORMATIVO]
- [ ] Sala 3 (cisterna): 3-4 esqueletos, 4 pilares de cobertura, braseiro médio [DESIGN][NORMATIVO]
- [ ] Sala 4 (santuário): sem combate, braseiro grande, escolha de upgrade (2-3 eixos) [DESIGN][NORMATIVO]
- [ ] Sala 5 (salão, pico): 5-6 esqueletos (1-2 com arma diferente do mesmo atlas), 6 pilares, faixa de espinhos [DESIGN][NORMATIVO]
- [ ] Sala 6 (antecâmara do Guardião): 1-2 esqueletos rápidos, baú, escolha de upgrade final, abre o portão do Guardião [DESIGN][NORMATIVO]
- [ ] Sala 7 (Guardião): 1 chefe único, sem horda, a Brasa apagada presente como objetivo [DESIGN][NORMATIVO]
- [ ] Toda arquitetura e prop das 7 salas vem do Dungeon Remastered Pack (CC0), zero primitiva à mão [ASSET][NORMATIVO]
- [ ] Todo inimigo é o esqueleto KayKit instanciado (mesma malha/esqueleto/biblioteca de animação), variando por parâmetro/arma/cor [ASSET][NORMATIVO]

### Tutorial implícito

- [ ] Salas 1 e 2 ensinam locomoção, câmera, ataque, esquiva, acender braseiro e ler armadilha sem caixa de tutorial nem texto explicativo [DESIGN][NORMATIVO] (seção 5)
- [ ] Affordance visual (braseiro pulsa frio chamando interação; espinhos prefiguram o dano) presente [DESIGN][NORMATIVO] (seção 5)

### Progressão

- [ ] Fagulha acumula ao acender braseiros e de baús; serve de recurso de progressão [DESIGN][NORMATIVO] (seção 6)
- [ ] Santuários (salas 4 e 6) oferecem escolha entre 2-3 eixos: dano, alcance, vida, raio de luz [DESIGN][NORMATIVO] (seção 6)
- [ ] Raio de luz da Acendedora cresce a cada braseiro aceso (incremento fixo por sala) [DESIGN][NORMATIVO] (seção 6)

### Gerenciador de salas com descarte (o item central)

- [ ] No máximo UMA sala de jogo carregada por vez [CÓDIGO][NORMATIVO] (seções 7, 7.3)
- [ ] Ao cruzar a porta de saída, a sala anterior inteira (malhas, materiais, texturas, física, atores, luzes) é descartada; verificável no inspetor de cena (só restam nós da sala nova + herói/câmera/HUD) [CÓDIGO][NORMATIVO] (seção 7.2)
- [ ] `worldStreaming.ts` reescrito para o modelo uma-sala-ativa com estado terminal de descarte [CÓDIGO][NORMATIVO] (seções 7.1, 9)
- [ ] Sequência das 7 salas em `game/content/descent.ts` [CÓDIGO][NORMATIVO] (seção 7.1)

### Performance por sala

- [ ] < 60 draw calls com qualquer sala carregada [CÓDIGO][NORMATIVO] (seção 7.3)
- [ ] 1-2 luzes dinâmicas por sala, sombra desligada nas pontuais do braseiro [CÓDIGO][NORMATIVO] (seção 7.3)
- [ ] <= 8 esqueletos animando ao mesmo tempo por sala (a planta respeita: máx. 6) [ASPIRACIONAL] (seção 7.3)
- [ ] 60 fps desktop / 30 fps mobile médio, mantidos inclusive na troca de sala [CÓDIGO][NORMATIVO] (seção 7.3)
- [ ] Cada `.glb` novo passou por optimize_asset.py + validate_gltf.py, dentro dos tetos de tris do CANON [ASSET][NORMATIVO] (seção 7.3)

### Câmara do Guardião e desfecho

- [ ] Sala do Guardião sela atrás, tem 1 chefe único e a Brasa apagada como objetivo, sem horda concorrente [DESIGN][NORMATIVO] (seção 8)
- [ ] Vencer o Guardião libera reavivar a Brasa; a luz quente sobe pelo poço (set piece de desfecho) [DESIGN][NORMATIVO] (seção 8)
- [ ] Tela de desfecho com estatísticas da descida e texto de fecho; opção de reiniciar [DESIGN][NORMATIVO] (seções 2, 8)
- [ ] Morte da Acendedora (vida zero) leva a tela de derrota e reinício da descida do topo, sem save [DESIGN][NORMATIVO] (seções 1, 2)

### Fluxo, HUD e texto

- [ ] Fluxo título -> contexto -> descida (7 salas) -> Guardião -> reavivar a Brasa -> desfecho, jogável ponta a ponta [DESIGN][NORMATIVO] (seção 2)
- [ ] Tempo-alvo de uma descida bem-sucedida entre 6 e 10 minutos [DESIGN][NORMATIVO] (seção 2)
- [ ] HUD exibe vida da Acendedora, recurso fagulha e prompt de interagir [DESIGN][NORMATIVO] (seção 9)
- [ ] Câmera de 3a pessoa segue com damping e colisão (não atravessa parede) [CÓDIGO][NORMATIVO] (seção 10)
- [ ] Nenhuma narrativa, asset ou prop da era Josué aparece na cena de jogo [DESIGN][NORMATIVO] (CANON 8)
- [ ] Texto do slice em português, sem travessões e sem emojis em qualquer texto exibido (guia de estilo 1.2) [NORMATIVO]
- [ ] Orçamento técnico dentro do alvo (tris e draw calls do CANON 4 / padrao-de-detalhe 2.1) [NORMATIVO]
- [ ] Itens [A DEFINIR] resolvidos ou explicitamente adiados com registro (canalização do braseiro; consumível de cura; habilidade de fagulha; posições/empties por sala; fases do Guardião) [NORMATIVO]
