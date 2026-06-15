# Plano de Produção e Roadmap - Brasa

Como sair da documentação para algo jogável, em ordem, com disciplina de escopo. Pensado
para equipe pequena/solo (possivelmente com apoio de IA), web primeiro. Consolida o canon
numa sequência de execução: traduz o roadmap da seção 7 de [`../projeto-brasa.md`](../projeto-brasa.md)
em marcos com entregáveis verificáveis, dependências, riscos, orçamento de esforço e
critérios de pronto.

Diferença de fundo em relação ao plano de Josué: ali a Fase 0 era montar motor e pipeline
do zero, e o gate maior era PROVAR o feel de combate (M2). Aqui o MOTOR JÁ EXISTE e o feel
de combate JÁ FOI provado no protótipo. O risco mudou de lugar: agora é religar o motor a
um conteúdo novo (assets KayKit, salas modulares, descarte de sala) sem regredir a leveza.
O gate maior de Brasa não é "isto é divertido?", é **"isto continua rodando leve com
conteúdo real e descarte de sala?"**.

Ver [`../projeto-brasa.md`](../projeto-brasa.md) (CANON: seção 4 orçamento técnico, seção 6
mapeamento sobre o motor, seção 7 roadmap, seção 8 DoD), [`spec-vertical-slice-cripta.md`](spec-vertical-slice-cripta.md)
(a descida jogável), [`game-design-e-sistemas.md`](game-design-e-sistemas.md) (laço e
escopo) e [`../padrao-de-detalhe.md`](../padrao-de-detalhe.md) (régua e DoD).

Convenção: pt-BR, sem travessões, sem emojis. Procedência `[DESIGN]`/`[CÓDIGO]`/`[ASSET]`;
exigência `[NORMATIVO]`/`[ASPIRACIONAL]`/`[A DEFINIR]`.

## 1. Filosofia de produção

`[DESIGN]`

- **Religar antes de reescrever.** O combate, a câmera, a física, a FSM, o save e a HUD do
  protótipo são fundação testada (seção 6.1 do canon). Reaproveitar é a regra; só se
  reescreve o que o canon marca como TROCAR (seção 6.2), e só se adiciona o que ele marca
  como ADICIONAR (seção 6.4). Cada linha nova de motor é dívida.
- **Leveza é gate, não aspiração.** O orçamento técnico da seção 4 do canon é requisito de
  aceite: < 60 draw calls por sala, no máximo UMA sala carregada por vez, descarte real ao
  trocar de porta. Mede-se a cada marco com arte, no navegador alvo, não no fim.
- **Vertical slice primeiro.** Uma descida curta e completa (5-7 salas + Guardião +
  reavivar a Brasa) vale mais que muitos andares pela metade. É o artefato que permite
  decidir o resto com algo na mão (pilar 4 do canon).
- **Gray-box antes de baixar arte.** Provar o laço de uma sala com cubos e a Acendedora já
  em disco antes de baixar o Dungeon Kit. Arte modular entra quando o laço fecha.
- **Não apagar Josué até o slice rodar.** Código, cenas, assets e docs da era Josué ficam
  no repo, fora do fluxo da cena nova, até o slice estar de pé. A limpeza é um passe
  próprio (etapa 7), nunca um pré-requisito.
- **Publicar cedo na web.** Medir peso, carga e FPS no navegador alvo a partir do primeiro
  marco com arte real (Marco C).

## 2. Visão geral das fases

`[DESIGN]`

| Fase | Objetivo | Pergunta que responde | Gate de saída |
|---|---|---|---|
| Pré. Decisões | Fechar os `[A DEFINIR]` que travam implementação | "Sei o que construir e onde?" | seção 8 deste doc resolvida |
| 1. Religação (Marcos A-B) | Motor existente dirige conteúdo novo em gray-box | "O motor anima a Acendedora e fecha o laço?" | Marco B: laço de uma sala graybox funciona |
| 2. Arte + slice (Marcos C-F) | Cripta real, esqueleto, descarte, descida completa | "Roda leve com conteúdo real e prende?" | Marco F: slice jogável do início ao fim em 5-8 min, leve |
| 3. Aposentadoria (Marco G) | Tirar Josué do fluxo e do peso | "O repo reflete só Brasa?" | Marco G: nenhum vestígio de Josué na cena/build |

A decisão sobre ambição (hobby x demo x comercial) e quantos andares além do slice ficam
para DEPOIS do Marco F, com a descida jogável na mão. Espelha a disciplina do plano de
Josué: não decidir o tamanho do mundo antes do vertical slice.

## 3. Fase Pré - Decisões que destravam (checklist)

`[NORMATIVO]` Antes de codar, fechar os `[A DEFINIR]` que bloqueiam (lista completa e quem
decide na seção 8). O mínimo para liberar cada marco:

- [ ] Número de salas do slice fixado (proposta: 5-7) - libera o Marco F.
- [ ] Geração fixa desenhada à mão vs. procedural (recomendação do canon: FIXA) - libera os
      Marcos C e E.
- [ ] Pasta dos novos `.glb`: confirmar `prototipo/public/assets/dungeon_kit/` para o kit e
      `prototipo/public/models/` para personagens - libera o Marco C.
- [ ] Método de obtenção do KayKit Skeletons + Dungeon Remastered (download manual pelo
      usuário vs. automatizado) - libera o Marco C.
- [ ] Destino dos docs de Josué (arquivar em `docs/arquivo-josue/` vs. manter in loco) -
      libera o Marco G.

O que NÃO bloqueia o começo: os modelos KayKit Adventurers + a biblioteca de animação JÁ
estão em disco (`prototipo/public/models/`), então os Marcos A e B podem começar de imediato,
em paralelo com a decisão de download (canon seção 5).

## 4. Marcos até o vertical slice (com tarefas e definição de pronto)

`[DESIGN]` Os sete passos da seção 7 do canon, expandidos em tarefas, dependências e
critério de pronto. Os marcos A-G abaixo mapeiam 1:1 nos passos 1-7 do roadmap canônico.

Marco A - Religar o herói (canon passo 2). Tarefas: apontar `heroModel`/`game/actors/` para
o KayKit Adventurer já em disco (Mage ou Rogue Hooded como Acendedora); ligar a biblioteca
de animação compartilhada (`AnimationLibrary_Godot_Standard.gltf`) ao
`characterController` e ao `heroCombat` atuais; validar blend de locomoção (idle/andar/
correr), ataque, esquiva. Cena de teste numa sala única graybox (cubos). Pronto: a
Acendedora anda, ataca e esquiva sem deslizar os pés, dirigida pelo motor atual, numa sala
graybox. Depende de: Fase Pré (não bloqueante; assets já em disco). Ver canon 6.1, 6.4.

Marco B - Laço de uma sala em gray-box (apoia canon passo 4). Tarefas: porta de pedra que
sela ao entrar; gatilho de despertar dos mortos (ainda usando o `defender.ts` cápsula
atual, sem trocar a malha); braseiro interativo (objeto + ação); ao limpar a sala, acender
o braseiro destrava a porta; abrir a porta dispara a transição. Tudo em gray-box. Pronto: o
laço entrar -> selar -> limpar -> acender -> abrir funciona ponta a ponta com primitivas.
Depende de: Marco A. Ver canon 3.1, 6.4.

Marco C - Uma sala de verdade com o Dungeon Kit (canon passo 3). Tarefas: baixar e otimizar
o Dungeon Remastered Pack (cada `.glb` por `optimize_asset.py` + `validate_gltf.py`, canon
4.5); montar uma Câmara de guarda com paredes/piso/porta/braseiro modulares; instanciar
repetições (thin instances via `sceneKit.ts`/`vegetation.ts`); luz fria que vira quente ao
acender o braseiro (1-2 luzes dinâmicas, sombra desligada nas do braseiro, canon 4.4).
Pronto: uma sala 100% kit modular CC0 (zero primitiva representando arquitetura/props), <
60 draw calls verificado no inspetor, transição de luz fria para quente. PRIMEIRA medição
séria de performance na web. Depende de: Marco B + decisão de pasta/download (Fase Pré).
Ver canon 4.1, 4.2, 4.4, 5, [`biblia-iluminacao.md`](biblia-iluminacao.md),
[`biblia-ambientes.md`](biblia-ambientes.md).

Marco D - Inimigo esqueleto na FSM (canon passo 4). Tarefas: baixar e otimizar o Character
Pack Skeletons; trocar a cápsula do `defender.ts` pela malha KayKit Skeleton, mantendo a
FSM (`engine/ai/fsm`) e a animação compartilhada; ligar hitbox/vida/dano/morte ao combate
existente. Pronto: o esqueleto rigado luta na FSM atual e o laço limpar-sala -> acender
braseiro -> abrir porta funciona com inimigo real. Depende de: Marco C. Ver canon 6.2, 4.3,
[`biblia-bestiario.md`](biblia-bestiario.md), [`spec-combate.md`](spec-combate.md).

Marco E - Gerenciador de salas com descarte (canon passo 5; o gate de leveza). Tarefas:
reescrever `app/worldStreaming.ts` (hoje carrega por proximidade e explicitamente "não há
descarte em v1") para um modelo de UMA-SALA-ATIVA; ao cruzar a porta, descartar a sala
anterior (malhas, materiais, texturas instanciadas, corpos de física) e carregar a próxima;
catálogo de tipos de sala (canon 3.2) em `game/content/descent.ts`. Pronto: encadear 2
salas com carga/descarte; o inspetor de cena confirma no máximo UMA sala carregada por vez;
draw calls e fps medidos na troca, dentro do orçamento. GATE: se a leveza não se sustentar
na troca, otimizar aqui antes de escalar para 5-7 salas. Depende de: Marco D. Ver canon
4.1, 6.2, 6.4.

Marco F - Slice completo (canon passo 6). Tarefas: montar a descida de 5-7 salas encadeadas
variando os tipos da tabela 3.2 do canon (câmara de guarda, corredor/antecâmara, cisterna/
salão, santuário do braseiro); chefe Guardião na câmara final; set piece de reavivar a
Brasa como fim; escolha de upgrade por braseiro (reaproveitar o genérico de
[`spec-progressao-e-economia.md`](spec-progressao-e-economia.md)); retry de combate; build
web publicado. Pronto: alguém joga do início ao fim em 5-8 min, sem travar, mantendo 60 fps
desktop / 30 fps mobile médio durante a descida, e entende que reacendeu a Brasa. Depende
de: Marco E. Ver canon 3.1, 3.3, [`spec-vertical-slice-cripta.md`](spec-vertical-slice-cripta.md),
[`spec-chefe-guardiao.md`](spec-chefe-guardiao.md), [`spec-set-pieces.md`](spec-set-pieces.md).

Marco G - Aposentadoria de Josué (canon passo 7). Detalhado na seção 6 deste doc. Pronto:
nenhum código, asset, prop, cena ou string de Josué no fluxo da cena de jogo nem no peso do
build; inventário atualizado. Depende de: Marco F validado (a virada precisa estar provada
antes de remover a rede de segurança). Ver canon 6.3, 9.

## 5. Ordem de implementação (grafo de dependências)

`[DESIGN]`

```
Fase Pre (decisoes da secao 8)
   v
Marco A: religar heroi KayKit (motor existente)        [assets ja em disco]
   v
Marco B: laco de uma sala em gray-box (porta+braseiro)
   v
Marco C: uma sala real com Dungeon Kit (< 60 draw calls)   <- 1a medicao de performance web
   v
Marco D: inimigo esqueleto KayKit na FSM existente
   v
Marco E: gerenciador de salas COM DESCARTE             <- GATE de leveza (uma sala por vez)
   v
Marco F: slice de 5-7 salas + Guardiao + reavivar a Brasa
   v
Marco G: aposentar codigo/assets/docs de Josue
```

Regra: cada marco só entra quando o anterior está "pronto" o bastante para sustentá-lo. Não
baixar e montar arte (Marco C) antes do laço fechar em gray-box (Marco B). Não escalar para
5-7 salas (Marco F) antes do descarte provar a leveza com 2 salas (Marco E).

## 6. O passe de aposentadoria de Josué (Marco G, detalhado)

`[DESIGN]` `[CÓDIGO]` A regra do canon (seção 6.3 e 9): nada é deletado até o slice rodar;
"aposentar" = tirar do fluxo da cena nova; o passe acontece DEPOIS do Marco F validado.
Três frentes:

Código (canon 6.3). Tirar do fluxo do novo jogo e então remover no passe:
- Cenas: `game/scenes/jericho.ts` (a cidade de ~2500 primitivas), `gilgal.ts`,
  `cityLife.ts`, `desertDressing.ts`, `masonry.ts`, `cityAssets.ts`.
- Mundo aberto: `game/scenes/world.ts` (terreno 600x600) e `engine/world/sky.ts` (skydome).
- Props bíblicos: `game/props/props.ts` (forja, oráculo, poço, arca).
- Herói antigo: `game/actors/josue.ts` (substituído pela Acendedora no Marco A).

Assets (canon 6.3). Modelos bíblicos parados em `public/models/` (muralha, portao,
tabernaculo, arca, tenda*, aldeao, eleazar, casa_adobe*, jarro, tabun, jerico_muralha,
ovelha, cabra, palmeira, josue): arquivar, não apagar de imediato. Verificar que saíram do
peso do build (não embarcados). Atualizar o inventário em
[`../inventario-primitivas-e-migracao-assets.md`](../inventario-primitivas-e-migracao-assets.md).

Docs (canon 9). `[A DEFINIR]` Confirmar com o usuário: arquivar os docs de Josué em
`docs/arquivo-josue/` vs. manter in loco. Antes de arquivar, extrair o que é genérico
(combate, progressão, fluxo, UI, áudio, iluminação) para specs neutras de tema, conforme o
canon. É tarefa de limpeza, não bloqueio.

Critério de pronto do Marco G: ver checklist da seção 9 (itens de aposentadoria).

## 7. Orçamento de tempo/esforço por marco (relativo)

`[DESIGN]` `[ASPIRACIONAL]` Em esforço RELATIVO (unidades de 1 = um marco leve de religação),
não em datas. Serve para sequenciar e detectar quando um marco está estourando, não como
promessa de calendário.

| Marco | Esforço relativo | Onde mora o custo | Maior risco do marco |
|---|---|---|---|
| Pré. Decisões | 0,5 | conversa + registro, sem código | decidir sem dado e travar marco depois |
| A. Religar herói | 1 | retarget/encaixe da animação no controller | esqueleto/escala KayKit não casar com o controller |
| B. Laço gray-box | 1,5 | porta selável + braseiro + destravar saída | estado do laço (selar/abrir) frágil |
| C. Sala real Dungeon Kit | 2 | download, otimização, montagem modular, luz | estourar draw calls; download/licença |
| D. Inimigo esqueleto | 1,5 | trocar malha mantendo a FSM e a animação | retarget do esqueleto inimigo; custo de skinning |
| E. Gerenciador com descarte | 2,5 | reescrever streaming p/ uma-sala-ativa + descarte real | vazamento de memória/física ao descartar |
| F. Slice completo | 3 | montar 5-7 salas, chefe, fim, retry, build, polimento | volume de conteúdo + manter fps na descida |
| G. Aposentar Josué | 1 | tirar do fluxo, arquivar, medir peso, inventário | quebrar o build ao remover; arquivar errado |

Leitura: o custo concentra-se em E (descarte, o coração da leveza) e F (volume de conteúdo
do slice). A. e G. são os marcos leves. Se A. ou B. estourarem além do dobro do estimado, é
sinal de que o casamento motor-asset (retarget/escala) é mais difícil que o previsto e o
risco de retarget da seção 8.3 se materializou.

## 8. Riscos e mitigação

`[DESIGN]`

### 8.1 Download e obtenção de assets

- Risco: o KayKit Skeletons + Dungeon Remastered vêm em zip pelo itch.io; método de
  obtenção `[A DEFINIR]` (canon 5). Sem eles, os Marcos C e D ficam bloqueados.
- Mitigação: decidir o método na Fase Pré ANTES de chegar no Marco C; começar os Marcos A e
  B com os Adventurers + animações JÁ em disco, sem esperar o download; confirmar a licença
  CC0 de cada pacote no ato do download e registrar a procedência.

### 8.2 Performance / leveza (o maior risco de Brasa)

- Risco: estourar < 60 draw calls por sala, ou o descarte de sala não liberar de fato
  malhas/materiais/física (vazamento que cresce a cada porta cruzada). O `worldStreaming.ts`
  atual NÃO descarta (canon 4.1, 6.2).
- Mitigação: instanciar repetições (thin instances) e atlas único por pacote; 1-2 luzes
  dinâmicas por sala com sombra desligada nas do braseiro (canon 4.4); medir draw calls e
  fps no inspetor a CADA marco com arte (C em diante), no navegador alvo; tratar o Marco E
  como GATE: confirmar no inspetor que só UMA sala fica carregada e que a memória não cresce
  ao trocar de sala antes de escalar para o slice.

### 8.3 Retarget de animação

- Risco: a biblioteca de animação compartilhada (`AnimationLibrary_Godot_Standard.gltf`)
  não casar limpo com o esqueleto do herói ou do Skeleton inimigo (escala, eixos, nomes de
  bone), causando deformação ou deslize de pés. O canon exige que TODOS os humanoides
  compartilhem o mesmo esqueleto e a mesma biblioteca (canon 4.3).
- Mitigação: validar o fluxo no Marco A com o herói antes de depender dele para o inimigo no
  Marco D; passar cada `.glb` por `optimize_asset.py` + `validate_gltf.py` (escala aplicada,
  Y-up, atlas preservado, canon 4.5); como os pacotes são todos KayKit no mesmo padrão de
  rig, o risco é baixo, mas validar cedo evita descobrir tarde.

### 8.4 Regressão de motor (dívida de religação)

- Risco: ao reescrever `worldStreaming.ts` e trocar `defender.ts`, quebrar combate, save ou
  câmera que hoje funcionam (canon 6.1, 6.2).
- Mitigação: religar antes de reescrever (filosofia, seção 1); mexer só no que o canon marca
  como TROCAR/ADICIONAR; manter o que é REUSAR intocado; refatorar entre marcos, não acumular.

### 8.5 Scope creep no slice

- Risco: inflar o Marco F com salas, inimigos ou sistemas além do necessário para provar o
  laço.
- Mitigação: número de salas fixado na Fase Pré (5-7); recusar tipos de sala fora da tabela
  3.2; geração FIXA desenhada à mão no slice (proceduralizar só depois, se valer).

### 8.6 Esgotamento solo

- Risco: marcos longos sem vitória visível.
- Mitigação: marcos curtos com entregável rodando (cada um da seção 4 produz algo
  jogável/medível); A e B começam sem depender de download; comemorar cada build publicado.

## 9. Critérios de pronto por marco (resumo verificável)

`[NORMATIVO]` Derivados do DoD do canon (seção 8). Cada item recebe sim/não honesto.

- Marco A: Acendedora KayKit anda/ataca/esquiva pelo motor atual, sem deslizar os pés, em
  sala graybox.
- Marco B: laço entrar -> selar -> limpar -> acender braseiro -> abrir porta funciona em
  gray-box.
- Marco C: uma sala 100% kit modular CC0 (zero primitiva em arquitetura/props), < 60 draw
  calls no inspetor, luz fria vira quente ao acender; cada `.glb` passou por
  `optimize_asset.py` + `validate_gltf.py`.
- Marco D: esqueleto KayKit rigado luta na FSM existente; o laço fecha com inimigo real.
- Marco E: gerenciador mantém no máximo UMA sala carregada; a anterior é descartada (malhas,
  materiais, física), verificável no inspetor; draw calls e fps dentro do orçamento na troca.
- Marco F: slice com começo, descida de 5-7 salas, Guardião e fim (reavivar a Brasa); 60 fps
  desktop / 30 fps mobile médio na descida; jogável do início ao fim em 5-8 min; build web
  publicado.
- Marco G: nenhuma narrativa, asset, prop, cena ou string de Josué na cena de jogo nem no
  peso do build; assets bíblicos arquivados; inventário atualizado; docs de Josué tratados
  conforme decisão da seção 8.

## 10. Lista de [A DEFINIR] abertos e quem decide

`[A DEFINIR]` Decisões pendentes que travam ou orientam a produção. Quem decide: o usuário é
o autor/produtor (decisões de design e de processo); a equipe de implementação (você +
IA) executa e recomenda. Todas devem ser fechadas como manda o
[`../padrao-de-detalhe.md`](../padrao-de-detalhe.md) seção 1 (um `[A DEFINIR]` em aberto
impede o "pronto" do marco que depende dele).

| # | Decisão pendente | Onde nasce | Recomendação | Quem decide | Trava qual marco |
|---|---|---|---|---|---|
| 1 | Número de salas do slice | canon 3.2 | 5-7, terminando no Guardião | usuário (design) | F |
| 2 | Geração fixa à mão vs. procedural | canon 3.2 | FIXA no slice; proceduralizar depois se valer | usuário (design) | C, E, F |
| 3 | Pasta dos novos `.glb` | canon 5 | `public/assets/dungeon_kit/` (kit) + `public/models/` (personagem) | usuário (processo) | C |
| 4 | Método de download KayKit (Skeletons + Dungeon Remastered) | canon 5 | confirmar; manual pelo usuário se automatizar for atrito | usuário (processo) | C, D |
| 5 | Recurso central / progressão (fagulha e upgrades por braseiro) | canon 3.3 | reusar o genérico de spec-progressao-e-economia; descartar o específico de Josué | usuário (design) | F |
| 6 | Teto de esqueletos skinned animando por sala | canon 4.3 | <= 8 por sala; ratificar após medir no Marco D/E | usuário, após medição | E, F |
| 7 | Acendedora = Mage ou Rogue Hooded | canon 5 | Rogue Hooded (silhueta de capuz casa com o tom) | usuário (design) | A |
| 8 | Destino dos docs de Josué (arquivar vs. in loco) | canon 9 | arquivar em `docs/arquivo-josue/` após extrair o genérico | usuário (processo) | G |

Os itens 1, 2, 3 e 4 são os que travam a primeira metade da produção e devem fechar na Fase
Pré. Os itens 6 e 7 podem fechar mais tarde (6 depende de medição; 7 só atrasa o Marco A).
O item 8 só importa para o Marco G.

## 11. Próxima ação concreta

`[DESIGN]` Fechar os `[A DEFINIR]` 1-4 da seção 10 (Fase Pré) e iniciar o Marco A: apontar o
herói para o KayKit Adventurer já em disco e dirigi-lo com o motor atual numa sala graybox.
É o menor passo que tira a virada do papel, não depende de download e já valida o casamento
motor-asset (o risco da seção 8.3). Tudo o que vem depois está encadeado nas seções 4 e 5.

## Checklist de aceite (Definition of Done) - plano de produção

`[NORMATIVO]` Cada item recebe sim/não honesto.

- [ ] Marcos A-G definidos com entregável verificável e ordem de dependência explícita
      (seções 4 e 5).
- [ ] Cada marco mapeia 1:1 num passo do roadmap do canon (seção 7 de `../projeto-brasa.md`).
- [ ] Critério de pronto por marco escrito e derivado do DoD do canon (seção 9).
- [ ] Riscos de download, performance/leveza e retarget de animação cobertos com mitigação
      (seção 8).
- [ ] Passe de aposentadoria de Josué descrito (código, assets, docs) e posicionado APÓS o
      slice validado (seção 6, Marco G).
- [ ] Orçamento de esforço relativo por marco presente, sem prometer datas (seção 7).
- [ ] Todos os `[A DEFINIR]` abertos listados com recomendação e quem decide (seção 10).
- [ ] Gate de leveza (Marco E, descarte de sala) marcado explicitamente como bloqueante
      antes de escalar para o slice.
- [ ] Sem travessões, sem emojis em qualquer texto exibido (guia de estilo 1.2).
- [ ] Itens [A DEFINIR] deste plano resolvidos ou explicitamente adiados com registro.
