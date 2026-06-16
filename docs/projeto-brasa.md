# Brasa - Bíblia do Projeto (virada de tema)

Documento mestre da NOVA direção do jogo. Substitui, para efeito de protótipo, a
premissa de Josué / batalha de Jericó. O MOTOR (código de `prototipo/src`) é
reaproveitado por inteiro; a HISTÓRIA, o mundo, os assets e a estrutura de cena são
novos. Nada da narrativa bíblica (Êxodo, conquista, tabernáculo, arca, muralha,
chefes Rei de Jericó / Jabim, acampamento de Gilgal) volta.

Motivo da virada (decisão de 2026-06-14, registrada em
[`inventario-primitivas-e-migracao-assets.md`](inventario-primitivas-e-migracao-assets.md)):
o tema da Idade do Bronze do Antigo Oriente Próximo quase não tem assets prontos
gratuitos. Jericó exigia fabricar quase todo modelo (à mão com primitivas, ou via
Tripo, caro e lento), o que travou a qualidade. Brasa troca para fantasia low-poly
montada sobre o ecossistema CC0 do KayKit (Kay Lousberg), onde o elenco inteiro e o
cenário inteiro já existem prontos, num só estilo, com esqueleto único, e rodam leve
no navegador. Critério número um do usuário: **rodar leve no navegador**.

Convenção (herdada de [`padrao-de-detalhe.md`](padrao-de-detalhe.md) e do guia de
estilo): pt-BR, sem travessões, sem emojis. Marcação de PROCEDÊNCIA adaptada a uma IP
original: `[DESIGN]` (decisão criativa nossa), `[CÓDIGO]` (observado no código-fonte do
protótipo), `[ASSET]` (procede de um pacote de asset existente). Marcação de EXIGÊNCIA:
`[NORMATIVO]` (entra no aceite, verificável), `[ASPIRACIONAL]` (mood/intenção, não
bloqueia), `[A DEFINIR]` (decisão pendente).

Snapshot: 2026-06-14.

Canon narrativo fechado em 2026-06-15 (heroina Cinza movida pela mentora Marta; Guardiao = a
Primeira Acendedora; final = Sacrificio com ciencia; a Brasa exige uma guarda viva). Ver
[`brasa/narrativa-e-historia.md`](brasa/narrativa-e-historia.md) secao 0 e o plano de
aprofundamento [`brasa/00-aprofundamento-e-roadmap.md`](brasa/00-aprofundamento-e-roadmap.md).

---

## 1. Premissa e mundo

`[DESIGN]` Um reino sobrevive ao frio eterno graças à **Brasa**: uma chama ancestral
que arde no fundo de um poço-cripta de pedra, fundo demais para a luz do sol alcançar.
Enquanto a Brasa arde, a superfície tem calor e vida. A Brasa está morrendo. Conforme
a luz recua poço abaixo, os mortos que foram selados naquelas câmaras ao longo de
gerações **despertam no escuro**.

`[DESIGN]` Você é a última **Acendedora**: a guardiã que ainda carrega uma fagulha do
fogo. Sua missão é **descer**, câmara por câmara, reacender os braseiros antigos de
cada andar (cada braseiro aceso empurra o escuro um pouco mais para baixo e destrava a
passagem seguinte) e chegar ao fundo do poço para reavivar a Brasa antes que a
superfície congele de vez.

`[DESIGN]` `[ASPIRACIONAL]` Tom: mítico, sóbrio, melancólico mas com esperança. A luz é
a personagem silenciosa: cada sala começa quase no escuro e a Acendedora a devolve à
vida ao acender o braseiro. O contraste frio-azul (morte/escuro) contra laranja-quente
(Brasa/vida) é a assinatura visual.

`[DESIGN]` Por que a ficção foi desenhada para casar com a leveza técnica (ver seção
4): cada andar é uma câmara SELADA por uma porta de pedra; a luz só alcança uma câmara
por vez. Logo, o jogo só precisa manter UMA sala carregada de cada vez. A limitação
técnica (não renderizar o mundo inteiro) vira premissa narrativa, não desculpa.

---

## 2. Pilares de design

`[NORMATIVO]` São os critérios de decisão. Qualquer escolha de escopo se mede contra
eles, nesta ordem.

1. **Leve no navegador acima de tudo.** Mundo contido (uma sala por vez, com descarte
   da anterior), low-poly, atlas único por pacote, instanciamento de inimigos e props.
   Alvo de performance da seção 4 é requisito de aceite, não aspiração.
2. **Construir com o que já existe.** Todo asset vem de pacote CC0 pronto (KayKit em
   primeiro lugar, Kenney/Quaternius como reforço). Não modelar gente, inimigos,
   cenário ou props à mão nem gastar Tripo, salvo exceção registrada como `[A DEFINIR]`.
3. **Reusar o motor, não a história.** O código genérico do protótipo (combate, IA,
   câmera, física, carregamento, save, HUD) é a fundação; ver mapeamento na seção 6.
4. **Loop pequeno e completo antes de conteúdo.** Um vertical slice jogável (uma
   descida curta com começo, combate, acender braseiro, e um fim) vale mais que muitos
   andares pela metade.

---

## 3. Estrutura de jogo: a cripta sala-a-sala

### 3.1 O laço central

`[DESIGN]` `[NORMATIVO]` O laço de uma sala (a unidade de jogo):

1. A Acendedora entra por uma porta de pedra, que se sela atrás dela. A sala está
   penumbra (luz baixa, fria).
2. Os mortos da câmara despertam (1 a N inimigos, conforme o andar).
3. O jogador limpa a sala usando o combate melee existente.
4. Com a sala limpa, o **braseiro** central pode ser aceso (interação). Acendê-lo:
   acende a luz quente da sala, concede recurso/upgrade, e DESTRAVA a porta de saída.
5. A porta de saída abre; ao cruzá-la, a sala anterior é DESCARREGADA e a próxima é
   carregada. Repete.

`[DESIGN]` A descida termina num andar de **chefe** (o Guardião da Brasa apagada). Ao
vencê-lo e acender a Brasa, fecha o vertical slice.

### 3.2 Tipos de sala (vocabulário modular)

`[DESIGN]` Salas montadas com o mesmo kit modular (KayKit Dungeon), variando layout e
recheio. Tipos para o slice:

| Tipo de sala | Conteúdo | Função no ritmo |
|---|---|---|
| Câmara de guarda | 2-4 esqueletos, braseiro | combate base, ensina o laço |
| Corredor / antecâmara | sem combate ou 1 inimigo, baús, armadilha | respiro, recompensa, telegrafia |
| Cisterna / salão | 4-6 inimigos, pilares para usar de cobertura | pico de combate |
| Santuário do braseiro | braseiro maior, escolha de upgrade | recompensa marcada |
| Câmara do Guardião | chefe único | clímax do slice |

`[A DEFINIR]` Quantos andares tem o slice (proposta: 5 a 7 salas, terminando no chefe).
`[A DEFINIR]` Geração: salas fixas desenhadas à mão (mais controle, recomendado para o
slice) vs. montagem procedural a partir de peças (mais rejogável, mais trabalho).
Recomendação `[DESIGN]`: começar FIXO desenhado à mão; proceduralizar depois se valer.

### 3.3 Progressão

`[DESIGN]` `[A DEFINIR]` Recurso central: a fagulha/fogo que a Acendedora carrega. Cada
braseiro aceso dá uma escolha de melhoria (dano, alcance do golpe, vida, raio de luz).
Reaproveitar o que já existe em [`spec-progressao-e-economia.md`](spec-progressao-e-economia.md)
e [`spec-fluxo-e-persistencia.md`](spec-fluxo-e-persistencia.md) onde o sistema for
genérico (moeda, save, escolha de upgrade), descartando o que for específico de Josué.

---

## 4. Orçamento técnico (NORMATIVO) - rodar leve no navegador

`[NORMATIVO]` Estes são os tetos de aceite. Herdam os âncoras globais já documentados
em [`padrao-de-detalhe.md`](padrao-de-detalhe.md) 2.1 e os ajustam ao regime
sala-a-sala, que é mais folgado que mundo aberto.

### 4.1 Quadro e draw calls

- `[NORMATIVO]` 60 fps em desktop médio; 30 fps em mobile médio.
- `[NORMATIVO]` **< 60 draw calls por sala** carregada (mais folgado que o teto de 100
  do mundo aberto porque só uma sala existe por vez; a meta é folga, não estouro).
- `[NORMATIVO]` No máximo UMA sala de jogo carregada por vez. A sala anterior é
  descartada (malhas, materiais, texturas instanciadas, corpos de física) ao cruzar a
  porta. Isto é o coração da leveza e o que o `worldStreaming.ts` atual NÃO faz (ele só
  adia carga, sem descarte - ver seção 6).

### 4.2 Geometria

`[NORMATIVO]` Tetos por tipo (low-poly KayKit já cabe nestes números com folga):

| Elemento | Tris-alvo | Observação |
|---|---|---|
| Peça modular de cripta (parede, piso, porta) | 100-400 | atlas único do pacote; instanciar repetições |
| Prop (braseiro, baú, barril, tocha) | 100-500 | colisor de caixa quando sólido |
| Acendedora (herói) | 1k-5k | KayKit Adventurers já está nessa faixa |
| Inimigo comum (esqueleto) | 1k-3k | mesma malha instanciada; esqueleto único compartilhado |
| Chefe (Guardião) | 3k-6k | leitura de fase por cor/silhueta |

### 4.3 Personagens e animação

- `[NORMATIVO]` Todos os humanoides (herói e inimigos) compartilham o MESMO esqueleto e
  a MESMA biblioteca de animação (`AnimationLibrary_Godot_Standard.gltf`, já no projeto,
  padrão KayKit). Isso evita carregar conjuntos de animação distintos por personagem.
- `[ASPIRACIONAL]` Limitar inimigos skinned animando ao mesmo tempo (proposta: <= 8 por
  sala) para conter custo de skinning na CPU; ratificar como `[A DEFINIR]` após medir.

### 4.4 Iluminação e física

- `[NORMATIVO]` Luz quente do braseiro: no máximo 1-2 luzes dinâmicas POR SALA, sombra
  desligada nessas luzes pontuais (padrão já usado em `gilgal.ts:259-266`,
  `gilgal.ts:324-330`). A luz-chave da sala pode ter sombra; as do braseiro não.
- `[NORMATIVO]` Sem terreno procedural 600x600 (`world.ts`) e sem skydome de mundo
  aberto na cripta: a sala é fechada, o piso é peça modular. Isso remove o maior custo
  fixo da cena de Josué.
- `[NORMATIVO]` Corpos de física só nas paredes/colisores da sala atual e nos atores
  vivos. Descartar ao trocar de sala.

### 4.5 Pipeline de asset

- `[NORMATIVO]` Todo `.glb` novo passa pela skill `blender-python` (`optimize_asset.py`)
  e por `validate_gltf.py`: escala aplicada, Y-up, dentro do teto de tris, atlas
  preservado. Texturas em KTX2/Basis e geometria Draco quando o ganho compensar (ver
  [`tecnica-graficos-fisica.md`](tecnica-graficos-fisica.md)).

---

## 5. Plano de assets (tudo CC0, sem Tripo)

`[ASSET]` `[NORMATIVO]` Fonte primária: **KayKit** de Kay Lousberg (kaylousberg.com /
kaylousberg.itch.io), licença CC0. É o ecossistema que já entrou no projeto: os
modelos `Mage.glb`, `Rogue_Hooded.glb` e `AnimationLibrary_Godot_Standard.gltf` em
`prototipo/public/models/` SÃO KayKit (Character Pack: Adventurers + a biblioteca de
animação padrão). Pacotes a usar:

| Pacote KayKit | Para que serve em Brasa | Status |
|---|---|---|
| Character Pack: Adventurers | a Acendedora (heroína: Mage ou Rogue Hooded) | `Mage.glb`/`Rogue_Hooded.glb` JÁ em disco |
| Animation Library (Godot/standard) | animações compartilhadas de todos os humanoides | `AnimationLibrary_Godot_Standard.gltf` JÁ em disco |
| Character Pack: Skeletons | os mortos despertos (inimigo comum + variantes + o Guardião) | BAIXAR |
| Dungeon Remastered Pack | a cripta modular (paredes, pisos, portas, escadas, baús, barris, braseiros, tochas, armadilhas) | BAIXAR |

`[ASSET]` Reforço, se faltar peça específica (mesmo estilo low-poly, todos CC0):
Kenney (kenney.nl) Dungeon Kit / Castle Kit; Quaternius (quaternius.com) Ultimate
Monsters, caso se queira um inimigo que não seja esqueleto. O `nature_kit` Kenney já em
disco fica de reserva (provável não usar numa cripta).

`[A DEFINIR]` Onde acomodar os novos `.glb`: proposta de manter o padrão atual de
`prototipo/public/models/` para assets de personagem e criar
`prototipo/public/assets/dungeon_kit/` para o kit modular (espelhando
`public/assets/nature_kit/`). Confirmar antes de baixar.

`[A DEFINIR]` Os baixáveis do KayKit costumam vir em zip pelo itch.io. Decidir o método
de obtenção (download manual pelo usuário vs. automatizado) antes da fase de
implementação. Os modelos JÁ presentes (Adventurers + animações) bastam para começar a
religar o herói sem bloquear.

---

## 6. Mapeamento sobre o motor existente

`[CÓDIGO]` Auditoria de `prototipo/src` dividindo o código em REUSAR (genérico, fica
como está ou quase), TROCAR (lógica fica, conteúdo muda) e APOSENTAR (específico de
Josué, sai da cena de jogo). Nada é deletado sem confirmação; "aposentar" = tirar do
fluxo do novo jogo.

### 6.1 Reusar como está (motor genérico)

`[CÓDIGO]` Sem tema, valem para Brasa diretamente:
- `engine/*` inteiro: `combat/` (attack, hitbox, health, hitStop), `ai/fsm`,
  `camera/thirdPersonCamera`, `character/characterController`, `physics/physicsService`,
  `rendering/createEngine`, `input/inputState`, `assets/assetService` (`loadContainer`),
  `world/lighting`, `core/gameLoop`, `core/eventBus`, `ui/uiManager`.
- `game/combat/*`: combatTarget, heroCombat, combatDirector, combatSound, impactFx,
  healthBar3d, tuning.
- `game/actors/`: `humanoid`, `springBoneChain`, `weapons`, `heroModel` (re-apontar para
  o glb da Acendedora), `trainingDummy`.
- `platform/*` inteiro (save, progresso, settings, profile).
- `game/ui/*` (re-textar strings; trocar tema visual em `theme.css`).
- `game/scenes/sceneKit.ts` (helpers `loadContainer`/`placeModel`/colisores/instâncias),
  `vegetation.ts` (template + scatter por thin instance) - úteis para instanciar props
  e inimigos da cripta.

### 6.2 Trocar (lógica reaproveitável, conteúdo novo)

- `app/worldStreaming.ts` -> **gerenciador de salas COM DESCARTE.** O atual carrega
  regiões por proximidade e explicitamente "não há descarte em v1"
  (`worldStreaming.ts:6`). Brasa exige descartar a sala anterior ao entrar na próxima
  (seção 4.1). Reescrever para um modelo de uma-sala-ativa.
- `game/actors/enemies/defender.ts` -> inimigo esqueleto. Hoje é cápsula + caixas com
  pivô animado por código (já marcado para virar personagem rigado no inventário, Tier
  C). Trocar pela malha KayKit Skeleton + animação compartilhada, mantendo a FSM.
- `game/content/campaign.ts`, `content/world.ts`, `content/map.ts` -> nova progressão de
  andares da cripta no lugar do mapa de Josué.
- `game/content/codex.ts`, `achievements.ts`, `saveData.ts` -> re-textar conteúdo,
  manter mecânica.

### 6.3 Aposentar (específico de Josué, fora da cena nova)

`[CÓDIGO]` Não entram em Brasa; manter no repo até a virada estar validada, depois
remover num passe de limpeza:
- `game/scenes/jericho.ts` (a cidade de ~2500 primitivas), `gilgal.ts` (acampamento),
  `cityLife.ts`, `desertDressing.ts`, `masonry.ts`, `cityAssets.ts`.
- `game/scenes/world.ts` (terreno 600x600) e `engine/world/sky.ts` (skydome de mundo
  aberto) - não usados na cripta fechada.
- `game/props/props.ts` (forja, oráculo, poço, arca, etc.: props bíblicos).
- `game/actors/josue.ts` (substituído pela Acendedora).
- Assets bíblicos parados em `public/models/` (muralha, portao, tabernaculo, arca,
  tenda*, aldeao, eleazar, casa_adobe*, jarro, tabun, jerico_muralha, ovelha, cabra,
  palmeira, josue) - não apagar ainda; arquivar quando o slice rodar.

### 6.4 Adicionar (novo)

- `game/scenes/crypt/` : gerador/montador de sala modular a partir do Dungeon Kit;
  catálogo de tipos de sala (seção 3.2); a porta selável e o braseiro interativo.
- `game/actors/acendedora.ts` (ou re-apontar `heroModel`) e `enemies/skeleton.ts`.
- `game/content/descent.ts` : a sequência de andares do slice.

---

## 7. Roadmap até o vertical slice

`[DESIGN]` Ordem proposta, cada etapa entrega algo rodando:

1. **Doc + decisões** (este documento). Fechar os `[A DEFINIR]` de número de salas,
   geração fixa vs. procedural, pasta de assets e método de download. (em curso)
2. **Religar o herói.** Acendedora = KayKit Adventurer já em disco, com a biblioteca de
   animação, dirigida pelo `characterController` e `heroCombat` atuais. Cena de teste
   numa sala única graybox.
3. **Uma sala de verdade.** Montar uma `Câmara de guarda` com o Dungeon Kit (após
   baixá-lo): paredes/piso/porta/braseiro modulares, < 60 draw calls, luz fria -> quente
   ao acender.
4. **Inimigo esqueleto.** Trocar `defender.ts` pela malha KayKit Skeleton na FSM atual;
   validar o laço limpar-sala -> acender braseiro -> abrir porta.
5. **Gerenciador de salas com descarte.** Encadear 2 salas com carga/descarte; medir
   draw calls e fps na troca.
6. **Slice completo.** 5-7 salas encadeadas + chefe Guardião + acender a Brasa (fim).
7. **Limpeza.** Aposentar o código e os assets de Josué (seção 6.3) e atualizar o
   inventário.

---

## 8. Checklist de aceite (Definition of Done) - virada e vertical slice

`[NORMATIVO]` Cada item recebe sim/não honesto.

- [ ] Documento de premissa, mundo e tom de Brasa escrito e aprovado (este doc).
- [ ] `[A DEFINIR]` da seção 3.2 e 5 resolvidos (nº de salas, geração, pasta/asset).
- [ ] Acendedora jogável com modelo KayKit + animações compartilhadas, no motor atual.
- [ ] Pelo menos uma sala montada 100% com kit modular CC0 (zero primitiva representando
      arquitetura/props), dentro de < 60 draw calls.
- [ ] Inimigo esqueleto rigado (KayKit) na FSM existente, com combate funcional.
- [ ] Gerenciador de salas mantém no máximo UMA sala carregada; a anterior é descartada
      (malhas, materiais, física) ao avançar - verificável no inspetor de cena.
- [ ] Laço completo de uma sala funciona: entrar -> selar -> limpar -> acender braseiro
      (luz fria vira quente) -> abrir porta -> trocar de sala.
- [ ] Vertical slice tem começo, descida de 5-7 salas, chefe e um fim (acender a Brasa).
- [ ] 60 fps desktop / 30 fps mobile médio mantidos durante a descida.
- [ ] Cada `.glb` novo passou por `optimize_asset.py` + `validate_gltf.py`.
- [ ] Nenhuma narrativa, asset ou prop de Josué aparece na cena de jogo de Brasa.
- [ ] Sem travessões, sem emojis em qualquer texto exibido (guia de estilo 1.2).

---

## 9. O que acontece com a documentação da era Josué

`[DESIGN]` Os docs bíblicos (`narrativa-e-historia.md`, `spec-prototipo-jerico.md`,
`spec-chefe-*`, `biblia-ambientes.md`, `guia-criar-josue-gratis.md`, etc.) NÃO são
apagados agora. Eles guardam trabalho de sistemas (combate, progressão, fluxo, UI,
áudio, iluminação) que em parte é genérico e será reaproveitado por referência. Quando
o vertical slice de Brasa estiver de pé, fazer um passe que: (a) extraia o que é
genérico para specs neutras de tema, (b) arquive o que é puramente de Josué. Marcar
isso como tarefa de limpeza, não bloqueio. `[A DEFINIR]`: confirmar com o usuário se
prefere arquivar (mover para `docs/arquivo-josue/`) ou manter in loco.
