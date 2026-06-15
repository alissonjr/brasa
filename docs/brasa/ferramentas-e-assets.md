# Ferramentas e Assets - Brasa

Documento de produção. Foco: viabilizar um dungeon crawler 3D low-poly que **rode leve
no navegador**, montado quase inteiro sobre assets CC0 prontos, sem modelagem à mão e sem
Tripo. Pipeline de referência: glTF (`.glb`/`.gltf`) carregado no Babylon.js via
`loadContainer`, com otimização e validação pela skill `blender-python`. Ver também
[`projeto-brasa.md`](../projeto-brasa.md) (CANON, sobretudo seções 4 e 5) e
[`padrao-de-detalhe.md`](../padrao-de-detalhe.md).

Convenção (herdada da bíblia do projeto e do padrão de detalhe): pt-BR, sem travessões,
sem emojis. Marcação de PROCEDÊNCIA: `[DESIGN]` (decisão criativa nossa), `[CÓDIGO]`
(observado no código-fonte do protótipo), `[ASSET]` (procede de um pacote de asset
existente). Marcação de EXIGÊNCIA: `[NORMATIVO]` (entra no aceite, verificável),
`[ASPIRACIONAL]` (mood/intenção, não bloqueia), `[A DEFINIR]` (decisão pendente).

Vocabulário fixo de Brasa (não substituir por sinônimos): Brasa, Acendedora, Guardião,
poço-cripta, câmara/sala, braseiro, porta de pedra selada, mortos despertos/esqueletos,
frio eterno, fagulha.

Snapshot: 2026-06-14.

Aviso sobre licenças, em uma frase: priorizamos CC0 (domínio público, uso comercial livre,
sem atribuição obrigatória) justamente para eliminar a dor de cabeça de crédito e revenda;
mesmo assim mantemos um `CREDITS.txt` por gentileza e rastreabilidade. Confira a licença do
item individual, não só da plataforma.

---

## 1. Por que CC0 e por que KayKit (e o que muda em relação a Josué)

`[DESIGN]` A virada de tema (registrada em [`projeto-brasa.md`](../projeto-brasa.md)) foi
motivada por assets: o tema da Idade do Bronze do Antigo Oriente Próximo quase não tem
pacote pronto gratuito coeso, o que forçava fabricar cada modelo (à mão com primitivas, ou
via Tripo, caro e lento) e travava a qualidade. Brasa troca para fantasia low-poly de
cripta, onde o elenco inteiro e o cenário inteiro já existem prontos, num só estilo, com
esqueleto único, e rodam leve no navegador.

`[DESIGN]` `[NORMATIVO]` Decorrências que este documento herda como regra dura:

1. **ZERO Tripo.** Não gastar créditos de geração por IA. O orçamento de Tripo (~740
   créditos mencionado no inventário) não é usado em Brasa.
2. **ZERO modelagem/primitiva à mão** para gente, inimigos, cenário ou props. Toda forma
   visível vem de pacote CC0 pronto, salvo exceção explicitamente registrada como
   `[A DEFINIR]`. (Graybox de blockout com primitivas é permitido só como andaime
   temporário, nunca como entrega.)
3. **Um estilo só.** Misturar fontes de estilos diferentes quebra a coesão; por isso KayKit
   é a fonte primária e Kenney/Quaternius entram apenas como reforço pontual no mesmo
   registro low-poly chapado.

A consequência prática é que o pipeline de Brasa é principalmente um pipeline de
**ingestão e otimização** de assets prontos, não de autoria. O trabalho da skill
`blender-python` aqui é otimizar/validar/converter, NUNCA esculpir (ver seção 5).

---

## 2. Fontes de assets CC0

### 2.1 KayKit (Kay Lousberg) - fonte primária

`[ASSET]` `[NORMATIVO]` KayKit (kaylousberg.com / kaylousberg.itch.io), licença CC0. É o
ecossistema que já entrou no projeto e que define o estilo. Vantagem decisiva: personagens
e inimigos compartilham um **esqueleto único** e uma **biblioteca de animação comum**, e o
cenário é um kit modular do mesmo autor, o que entrega coesão visual e leveza de carga
quase de graça. Pacotes que importam para Brasa:

| Pacote KayKit | O que fornece para Brasa | Status em disco |
|---|---|---|
| Character Pack: Adventurers | A Acendedora (heroína): `Mage.glb` ou `Rogue_Hooded.glb` | JÁ em disco |
| Animation Library (Godot/standard) | Animações compartilhadas de TODOS os humanoides (idle, andar, correr, ataques, hit, morte) | JÁ em disco (`AnimationLibrary_Godot_Standard.gltf`) |
| Character Pack: Skeletons | Os mortos despertos: inimigo comum, variantes (arqueiro, guerreiro) e base do Guardião | JÁ em disco |
| Dungeon Remastered Pack | A cripta modular: paredes, pisos, portas (inclui a porta de pedra selável), escadas, pilares, baús, barris, braseiros, tochas, armadilhas, poções, moedas, mobiliário | JÁ em disco (64 peças; ver 2.5) |
| Halloween Bits | Reforço de tom de cripta/catacumba do MESMO autor: caixões, lápides, túmulos, ossadas, candelabros, relicários (shrine), lanternas, arcos | JÁ em disco (18 peças; ver 2.5) |

`[ASSET]` Notas de aproveitamento por pacote:

- **Adventurers** entrega vários arquétipos rigados no mesmo esqueleto. A Acendedora sai de
  um deles (proposta: `Mage` pela leitura de "portadora de fogo", com `Rogue_Hooded` como
  alternativa de silhueta encapuzada). Os dois já estão em disco, então o herói pode ser
  religado sem baixar nada.
- **Animation Library** é o coração da leveza de personagens: um único conjunto de
  animações serve herói e inimigos (seção 6). Carregar uma biblioteca, não uma por ator.
- **Skeletons** dá os inimigos no mesmo esqueleto, logo aceitam a mesma biblioteca de
  animação. O Guardião (chefe) pode ser uma variante maior/recolorida de esqueleto, dentro
  do teto de 3k-6k tris.
- **Dungeon Remastered** é o kit modular do cenário: cada câmara de Brasa é montada
  encaixando suas peças (atlas único do pacote), o que mantém o teto de < 60 draw calls por
  sala com instanciamento das repetições.

### 2.2 Kenney - reforço

`[ASSET]` Kenney (kenney.nl), CC0, sem atribuição. Estilo low-poly genérico e coeso, útil
como tapa-buraco quando faltar uma peça específica no Dungeon Remastered: por exemplo
Kenney **Dungeon Kit** / **Castle Kit** para uma peça arquitetônica ausente, ou Kenney **UI
Pack** para HUD. O `nature_kit` Kenney JÁ em disco (em
`public/assets/nature_kit/`, ver seção 4) fica de reserva: provavelmente não entra numa
cripta fechada, mas não custa nada manter.

### 2.3 Quaternius - reforço

`[ASSET]` Quaternius (quaternius.com, poly.pizza/u/Quaternius), CC0. Milhares de modelos
low-poly, muitos rigados/animados. Reforço caso se queira um inimigo que NÃO seja
esqueleto (ex.: pacote **Ultimate Monsters**) sem sair do registro low-poly chapado.
Atenção: um monstro Quaternius não compartilha o esqueleto KayKit, então precisaria do seu
próprio conjunto de animação (custo extra de carga) ou de retarget manual; tratar como
exceção, não como norma. A Universal Animation Library da Quaternius foi o placeholder da
era Josué (ver `CREDITS.txt` em disco) e está aposentada em Brasa em favor da KayKit.

`[ASSET]` Pacotes Quaternius concretos verificados (CC0, glTF/FBX/OBJ), úteis como reforço
de PROPS (não de personagens, para não brigar com o esqueleto KayKit):
- **Fantasy Props MegaKit** (200+ props, atlas compartilhado) - quaternius.com/packs/fantasypropsmegakit.html
- **LowPoly Modular Dungeon Pack** (45+ peças modulares de masmorra) - quaternius.itch.io/lowpoly-modular-dungeon-pack
Risco de coesão: o registro low-poly da Quaternius é levemente diferente do KayKit (sombreamento
e proporção). Tratar como tapa-buraco pontual, não fonte primária; preferir sempre a peça
equivalente do KayKit quando existir.

### 2.4 O que NÃO usamos em Brasa

`[NORMATIVO]` Para deixar explícito e fechar a porta:
- Tripo / Meshy / qualquer geração 3D por IA: não usar.
- Synty POLYGON e outros pacotes pagos: fora de escopo (Brasa é CC0).
- Sketchfab/Fab/CGTrader avulsos: só se for CC0 e do mesmo estilo, e mesmo assim por
  exceção registrada, porque misturar fontes quebra a coesão.

### 2.5 Obtenção via GitHub e catálogo ingerido (resolve o `[A DEFINIR]` de download)

`[ASSET]` `[NORMATIVO]` Descoberta de produção (2026-06-14): os pacotes KayKit têm espelho
oficial na organização **github.com/KayKit-Game-Assets**, com os modelos versionados e
baixáveis direto (sem login do itch.io e SEM Git LFS - o `raw.githubusercontent.com`
entrega o binário de verdade). Isso resolve o `[A DEFINIR]` do método de obtenção
(seção 5.2) a favor de **download direto por script** a partir do GitHub, mantendo o itch.io
como fonte canônica de referência/licença.

`[ASSET]` Formatos por pacote no GitHub:
- **Dungeon Remastered**: a pasta `Assets/gltf/` traz 203 `.glb` autocontidos
  (`<nome>.gltf.glb`), prontos para uso direto, mesmo atlas.
- **Halloween Bits**: a pasta `Assets/gltf/` traz `.gltf` + `.bin` + uma textura
  compartilhada (`halloweenbits_texture.png`, 1024). Converter para `.glb` por
  `optimize_asset.py` embute a textura.

`[ASSET]` Repositórios CC0 disponíveis na org (para referência futura): Dungeon Remastered,
Character Pack Adventurers, Character Pack Skeletons, Halloween Bits, Furniture Bits,
Restaurant Bits, City Builder Bits, Space Base Bits, Prototype Bits, Medieval Hexagon Pack.
Para Brasa interessam Dungeon Remastered (primário), Halloween Bits (tom de cripta) e, como
reserva, Furniture Bits (mobiliário) e Prototype Bits (blockout).

`[ASSET]` Catálogo ingerido em 2026-06-14 (lote de enriquecimento). Antes: 33 peças do
Dungeon Remastered. Depois:
- **Dungeon Remastered (`public/assets/dungeon_kit/`): 64 peças** (33 + 31 novas do mesmo
  pacote/atlas). As novas: poções/alquimia (`bottle_A_green`, `bottle_A_labeled_green`,
  `bottle_B_green`, `bottle_C_brown`, `candle_triple`, `candle_lit`, `shelf_small_candles`),
  saque (`chest_gold`, `coin_stack_large/medium`, `key`, `keyring`, `sword_shield`,
  `sword_shield_gold`), mobiliário (`shelf_large`, `shelves`, `keg`, `keg_decorated`,
  `trunk_large_A`, `table_long_tablecloth`, `plate_food_A`), estrutura
  (`pillar_decorated`, `column`, `wall_arched`, `wall_archedwindow_open`, `wall_cracked`,
  `floor_tile_grate`, `floor_tile_big_spikes` (armadilha), `barrier`, `barrier_corner`,
  `stairs_wood`).
- **Halloween Bits (`public/assets/halloween_kit/`): 18 peças** filtradas para o tom
  sombrio (sem abóboras/jack-o-lanterns/pinheiros): `coffin`, `coffin_decorated`,
  `gravestone`, `grave_A`, `gravemarker_A`, `bone_A/B/C`, `ribcage`, `skull_candle`,
  `shrine`, `shrine_candles`, `lantern_hanging`, `lantern_standing`, `plaque_candles`,
  `post_skull`, `arch`, `arch_gate`.

Todas as peças novas passaram por `validate_gltf.py` (RESULTADO OK: Y-up, escala, teto de
tris, atlas) e estão com `CREDITS.txt` nas respectivas pastas.

`[CÓDIGO]` Integração no montador de sala (`cryptRoom.ts`), feita em 2026-06-14:
- **Dressing instanciado** (`batch()` / `flushBatches()`): props repetidos (caveiras, barris,
  caixas, potes, estandartes, escombros, moedas, pilares) deixam de ser clones e viram UMA
  malha mesclada + thin instances, ou seja **1 draw call por tipo** independentemente da
  quantidade. Colisores invisíveis (sem custo de draw call) são criados à parte para os
  sólidos. Medido headless (`tools/verify_rooms.cjs`): 73-86 props repetidos colapsam em
  14-17 malhas-base por sala. Props únicos seguem por clone (`placeProp`).
- **Dressing por TIPO DE SALA** (`RoomDef.kind`): clusters temáticos
  (`clusterMess`/`clusterStorage`/`clusterAlchemy`/`clusterCatacomb`/`clusterRitual`/
  `clusterTreasure`/`clusterGrime`/`clusterBanners`) ligados por tipo: guarda (refeitório +
  armazém), salão (banquete + alquimia + ritual leve), cisterna (ruína + escombros + ossadas),
  santuário (ritual + catacumba + alquimia), guardião (catacumba imponente + tesouro dourado,
  chão limpo para o combate). Mesmo layout-base; varia QUAIS clusters aparecem e a densidade
  de sujeira. Verificado headless: os 5 tipos montam sem erro de runtime (0 pageerrors).

---

## 3. Licença CC0 e atribuição

`[NORMATIVO]` Todos os pacotes-base de Brasa (KayKit, Kenney, Quaternius) são CC0 1.0
Universal: domínio público, uso comercial livre, modificação livre, SEM atribuição
obrigatória e SEM exigência de manter o asset cru fechado. Isso significa:

- Podemos otimizar, recortar, recolorir e reexportar os modelos livremente.
- Não há obrigação de creditar, mas mantemos a cortesia de registrar a procedência.

`[NORMATIVO]` Política de crédito do projeto: manter um arquivo `CREDITS.txt` em cada pasta
de assets (já existe um em `public/models/` e um `LICENSE_kenney.txt` em
`public/assets/nature_kit/`). Ao trazer um pacote KayKit novo, acrescentar no `CREDITS.txt`
da pasta de destino: nome do pacote, autor (Kay Lousberg), URL, licença (CC0 1.0), data de
download e para que serve em Brasa. Mesmo padrão para reforços Kenney/Quaternius.

`[A DEFINIR]` Tela de créditos no jogo: como CC0 dispensa atribuição, manter uma seção
"Agradecimentos" opcional no menu é decisão de design, não requisito legal. Decidir se
entra no slice.

---

## 4. O que JÁ está em disco

`[CÓDIGO]` `[ASSET]` Auditoria de `prototipo/public/`. Marca o que é KayKit reaproveitável,
o que é reforço CC0 e o que é resíduo de Josué a aposentar.

### 4.1 KayKit já presente (a base de Brasa)

Em `prototipo/public/models/`:
- `Mage.glb` (~3,6 MB) - KayKit Adventurers, candidato a Acendedora.
- `Rogue_Hooded.glb` (~3,6 MB) - KayKit Adventurers, alternativa de Acendedora encapuzada.
- `AnimationLibrary_Godot_Standard.gltf` + `AnimationLibrary_Godot_Standard.bin` (~2,5 MB +
  ~1,6 MB) - a biblioteca de animação compartilhada KayKit. NÃO duplicar por personagem.

`[CÓDIGO]` Estes três bastam para religar o herói no motor atual (`characterController` +
`heroCombat` + biblioteca de animação) e montar uma sala graybox sem baixar nada novo, como
prevê o roadmap (passo 2). Os demais pacotes KayKit (Skeletons, Dungeon Remastered) ainda
precisam ser baixados.

### 4.2 Reforço CC0 já presente

Em `prototipo/public/assets/nature_kit/` (Kenney, CC0, `LICENSE_kenney.txt`): peças de
fazenda/plantação (crops, fences, plant_bushSmall). Reserva; provável não usar numa cripta.

Em `prototipo/public/assets/models/` (modelos PBR avulsos, era Josué): `ceramic_vase_03`,
`dead_tree_trunk`, `wild_rooibos_bush`, `namaqualand_boulder_03`, `sand_rocks_small_01`,
`stone_fire_pit`. Tema de deserto/semiárido: fora de Brasa, salvo `stone_fire_pit` que, se
o estilo casar, poderia servir de base de braseiro (verificar coesão; preferir o braseiro
do Dungeon Remastered). Em `assets/hdri/` e `assets/textures/sand_01/`: ambiente de mundo
aberto de Josué, não usado na cripta fechada.

### 4.3 Resíduo de Josué a aposentar (não apagar ainda)

`[CÓDIGO]` Em `public/models/`: `josue.glb`, `aldeao.glb`, `eleazar.glb`, `arca.glb`,
`muralha.glb`, `jerico_muralha.glb`, `portao.glb`, `tabernaculo.glb`, `tenda*.glb`,
`casa_adobe*.glb`, `jarro.glb`, `tabun.glb`, `palmeira.glb`, `ovelha.glb`, `cabra.glb` e as
pastas `fauna/` e `npc/`. Não entram na cena de Brasa. Conforme a bíblia (seção 6.3), não
apagar agora: arquivar quando o vertical slice rodar. O `CREDITS.txt` atual descreve a
Universal Animation Library da Quaternius (placeholder de Josué), também aposentada.

---

## 5. Pipeline de asset (do download ao Babylon)

`[NORMATIVO]` Todo `.glb`/`.gltf` que entra em Brasa percorre estas etapas. As etapas 2 e 3
são feitas pela skill global `blender-python` (Blender 4.5.x headless, bpy), cujo papel
aqui é otimizar e validar, NUNCA esculpir.

### 5.1 Visão geral

```
[1] Baixar o pacote CC0 (KayKit/Kenney/Quaternius)        (A DEFINIR: manual vs automatizado)
        |
[2] Otimizar/converter pela skill:  optimize_asset.py     (escala, Y-up, decimar, KTX2, Draco)
        |
[3] Validar pela skill:             validate_gltf.py       (Y-up, escala, teto de tris, atlas)
        |
[4] Acomodar na pasta correta de public/ + atualizar CREDITS.txt
        |
[5] Instanciar no Babylon via loadContainer (assetService) e helpers de sceneKit
```

### 5.2 Etapa 1 - obter o pacote

`[ASSET]` Os baixáveis do KayKit vêm tipicamente em `.zip` pelo itch.io, contendo os
modelos em glTF/`.glb` (e variantes Godot/Unity). Baixamos só os formatos glTF.

`[RESOLVIDO 2026-06-14]` Método de obtenção: **download direto por script a partir do
espelho GitHub** `github.com/KayKit-Game-Assets` (sem login do itch.io e sem Git LFS;
`raw.githubusercontent.com` entrega o binário). Substitui a hipótese anterior de download
manual pelo zip do itch.io. Detalhes e catálogo ingerido na seção 2.5. O itch.io segue como
fonte canônica de referência/licença.

### 5.3 Etapa 2 - otimizar/converter (`optimize_asset.py`)

`[NORMATIVO]` Cada `.glb` novo passa por `optimize_asset.py` da skill `blender-python`, que
deve garantir:
- **Escala aplicada** e coerente com o motor (transforms aplicados, sem fatores residuais).
- **Y-up** (orientação que o Babylon espera ao importar glTF).
- **Decimação/redução de polígonos** quando o modelo exceder o teto da seção 4.2 da bíblia
  (peça modular 100-400 tris; prop 100-500; herói 1k-5k; esqueleto 1k-3k; chefe 3k-6k).
  KayKit já costuma caber nesses números com folga, então a decimação é exceção.
- **Texturas em KTX2/Basis** e **geometria Draco** quando o ganho de tamanho/banda
  compensar (avaliar caso a caso; um kit modular pequeno pode não compensar a perda de
  qualidade do KTX2). Ver [`tecnica-graficos-fisica.md`](../tecnica-graficos-fisica.md) se
  existir doc técnico correspondente em Brasa.
- **Atlas único preservado** por pacote: não explodir o material atlas em vários, para não
  estourar draw calls.

### 5.4 Etapa 3 - validar (`validate_gltf.py`)

`[NORMATIVO]` Cada `.glb` novo passa por `validate_gltf.py`, que confirma objetivamente:
Y-up, escala aplicada, contagem de tris dentro do teto do tipo, atlas preservado, e que o
arquivo abre sem erro. Um asset que falha a validação não entra na cena. Esta etapa é o que
torna verificável o item de DoD "cada `.glb` novo passou por `optimize_asset.py` +
`validate_gltf.py`".

### 5.5 Etapa 4 - organização de pastas

`[A DEFINIR]` `[DESIGN]` Proposta de layout (espelha o padrão atual e a bíblia seção 5),
confirmar antes de baixar:

```
prototipo/public/
  models/                         (personagens, como hoje)
    Mage.glb                      (Acendedora)            JA
    Rogue_Hooded.glb              (alternativa)           JA
    AnimationLibrary_Godot_Standard.gltf (+ .bin)         JA
    Skeleton_*.glb                (inimigos + Guardiao)   BAIXAR
    CREDITS.txt                   (atualizar)
  assets/
    dungeon_kit/                  (KayKit Dungeon Remastered, espelha nature_kit/)  BAIXAR
      wall_*.glb, floor_*.glb, door_*.glb, brazier_*.glb, ...
      CREDITS.txt
    nature_kit/                   (Kenney, reserva)       JA
```

Personagens (herói, esqueletos, Guardião) ficam em `public/models/`. O kit modular do
cenário vai para `public/assets/dungeon_kit/`, espelhando o `public/assets/nature_kit/` que
já existe. Isso mantém a convenção atual e separa "ator" de "cenário".

### 5.6 Etapa 5 - instanciar no Babylon

`[CÓDIGO]` O carregamento já existe no motor e é reaproveitado sem mudança de tema:
- `engine/assets/assetService` expõe `loadContainer` (importa o `.glb` num AssetContainer,
  permitindo instanciar várias cópias sem recarregar o arquivo).
- `game/scenes/sceneKit.ts` traz os helpers `loadContainer`/`placeModel`/colisores e
  instâncias; `vegetation.ts` traz template + scatter por thin instance, úteis para
  espalhar props e inimigos repetidos da cripta com baixo custo de draw call.
- Repetições de peça modular e de inimigo comum DEVEM ser instâncias (thin instance ou
  instâncias do AssetContainer), não cópias independentes, para respeitar < 60 draw calls
  por sala e o esqueleto/animação compartilhados.

`[NORMATIVO]` Descarte: ao cruzar a porta de pedra para a próxima sala, o gerenciador de
salas descarta malhas, materiais, texturas instanciadas e corpos de física da sala
anterior (uma sala ativa por vez, bíblia seção 4.1). Carregar não basta: tem que liberar.

---

## 6. Animação compartilhada e retarget

`[ASSET]` `[NORMATIVO]` Todos os humanoides de Brasa (Acendedora + esqueletos + Guardião)
compartilham o MESMO esqueleto KayKit e a MESMA biblioteca de animação
(`AnimationLibrary_Godot_Standard.gltf`). Isso é o que evita carregar conjuntos de animação
distintos por personagem e mantém a leveza.

`[ASSET]` Como funciona na prática, porque os personagens e a biblioteca vêm separados:

1. A `AnimationLibrary` contém apenas as ações (idle, andar, correr, ataques, hit, morte)
   sobre o esqueleto-padrão KayKit, sem malha de personagem.
2. Cada personagem KayKit (Adventurers, Skeletons) usa esse mesmo esqueleto-padrão.
3. No Babylon, carregamos a biblioteca uma vez e aplicamos suas `AnimationGroup` ao
   esqueleto do personagem instanciado. Como os esqueletos são idênticos (mesma hierarquia
   e nomes de osso), a aplicação é direta: não há retarget de osso a osso quando o esqueleto
   é o mesmo. O "retarget" de Brasa é, na maioria dos casos, apenas religar a mesma
   biblioteca em outra malha do mesmo rig.
4. Retarget de verdade (mapear ossos entre esqueletos diferentes) só seria necessário para
   um ator fora do ecossistema KayKit (ex.: um monstro Quaternius da seção 2.3). Esse caso
   é exceção e custa carga extra; evitar no slice.

`[A DEFINIR]` Confirmar, ao integrar, que o esqueleto dos pacotes Skeletons e Adventurers é
idêntico ao da Animation Library Godot/standard (mesma nomenclatura de ossos). Se a versão
Godot da biblioteca divergir da versão de personagens, padronizar todos na mesma exportação
KayKit antes de integrar.

`[ASPIRACIONAL]` Limitar inimigos skinned animando ao mesmo tempo (proposta <= 8 por sala)
para conter custo de skinning na CPU; ratificar como `[A DEFINIR]` após medir.

---

## 7. Ferramentas do pipeline

`[CÓDIGO]` `[ASSET]` Pilha enxuta, toda livre/gratuita:

- **Babylon.js + Havok** (em `prototipo/`): o motor. Carrega glTF via `loadContainer`,
  faz render, física, câmera, combate e HUD. É reaproveitado de Josué por inteiro (bíblia
  seção 6). Nenhuma troca de engine.
- **Vite**: bundler/dev-server do protótipo. Serve `public/` em desenvolvimento e empacota
  para web no build. Os assets ficam sob `public/` para serem servidos como estáticos.
- **Blender 4.5.x headless (skill `blender-python`)**: roda `optimize_asset.py` e
  `validate_gltf.py` via bpy, sem GUI. Papel restrito a otimizar/converter/validar assets
  CC0 prontos; NUNCA esculpir gente, inimigos ou props. (O Blender headless está instalado
  pelo usuário em `~/.local/blender`, conforme memória do projeto.)
- **Git** para versionar; binários grandes (`.glb`, texturas) preferencialmente sob Git LFS
  se o repositório passar a pesar. `[A DEFINIR]` adotar LFS ou não.

Ferramentas de IA de geração (Tripo, Meshy etc.): NÃO fazem parte do pipeline de Brasa.

---

## 8. Pilha recomendada e ordem de adoção

`[DESIGN]` Princípio: um estilo low-poly coeso (KayKit) + leveza acima de tudo + tudo CC0.
Não misturar fontes de estilos diferentes.

1. **Engine e pipeline**: Babylon.js + Havok (já montado) + Vite + skill `blender-python`
   para otimizar/validar + Git (LFS se necessário).
2. **Base visual coesa**: KayKit. Adventurers + Animation Library JÁ em disco; baixar
   Skeletons e Dungeon Remastered.
3. **Reforço CC0**: Kenney (Dungeon/Castle Kit, UI Pack) e Quaternius (Ultimate Monsters)
   só para tapar lacuna pontual, no mesmo registro low-poly.
4. **Pipeline de ingestão**: para cada asset novo, `optimize_asset.py` -> `validate_gltf.py`
   -> pasta correta -> `CREDITS.txt` -> instanciar via `loadContainer`.

`[DESIGN]` Ordem de adoção (cada passo entrega algo rodando, espelha o roadmap da bíblia
seção 7):
1. Religar a Acendedora com o KayKit Adventurer já em disco + a Animation Library, no
   `characterController`/`heroCombat` atuais, numa sala graybox.
2. Baixar e ingerir o Dungeon Remastered; montar uma Câmara de guarda real (< 60 draw
   calls, luz fria -> quente ao acender o braseiro).
3. Baixar e ingerir o Skeletons; trocar `defender.ts` pela malha de esqueleto na FSM atual,
   com a animação compartilhada.
4. Gerenciador de salas com descarte; encadear 2 salas e medir draw calls/fps na troca.
5. Slice completo: 5-7 salas + chefe Guardião + acender a Brasa.

`[DESIGN]` Ponto de maior alavancagem: como Adventurers e a Animation Library já estão em
disco, o passo 1 (herói jogável animado) não depende de nenhum download nem decisão
pendente; pode começar imediatamente e validar o motor antes de qualquer ingestão nova.

---

## 9. Cuidados recorrentes

- Conferir que cada item é CC0 antes de trazer (KayKit/Kenney/Quaternius são; avulsos de
  Sketchfab/Fab podem não ser).
- Não duplicar a Animation Library por personagem: uma cópia, compartilhada.
- Não explodir o atlas único de um pacote em vários materiais (estoura draw calls).
- Avaliar KTX2/Draco caso a caso: nem todo kit modular pequeno compensa a conversão.
- Sempre passar por `optimize_asset.py` + `validate_gltf.py`; um asset não validado não
  entra na cena.
- Manter o `CREDITS.txt` da pasta atualizado a cada pacote novo.
- Carregar uma sala por vez E descartar a anterior (carregar sem descartar não cumpre o
  orçamento).

---

## 10. Fontes

Assets 3D (CC0)
- https://kaylousberg.com/ , https://kaylousberg.itch.io/
- https://github.com/KayKit-Game-Assets (espelho oficial, download direto sem login/LFS)
- https://kaylousberg.itch.io/kaykit-dungeon-remastered (primário do cenário)
- https://kaylousberg.itch.io/kaykit-halloween-bits (tom de cripta/catacumba)
- https://kenney.nl/
- https://quaternius.com/ , https://poly.pizza/u/Quaternius
- https://quaternius.com/packs/fantasypropsmegakit.html (reforço de props)
- https://quaternius.itch.io/lowpoly-modular-dungeon-pack (reforço modular)
- https://poly.pizza/ (busca de modelos CC0 avulsos, conferir licença item a item)
- https://opengameart.org/ (filtrar por CC0; conferir licença item a item)

Licença
- https://creativecommons.org/publicdomain/zero/1.0/

Pipeline e engine
- https://www.babylonjs.com/ (loadContainer / AssetContainer)
- https://www.blender.org/ (skill blender-python, headless 4.5.x)
- https://vite.dev/
- glTF 2.0: https://www.khronos.org/gltf/ ; KTX2/Basis: https://www.khronos.org/ktx/ ;
  Draco: https://google.github.io/draco/

---

## Checklist de aceite (Definition of Done) - Ferramentas e Assets

`[NORMATIVO]` Cada item recebe sim/não honesto.

- [ ] Fonte primária é KayKit CC0; nenhum asset visível foi gerado por Tripo/IA ou
      modelado à mão com primitivas (salvo exceção registrada como `[A DEFINIR]`).
- [ ] Acendedora usa um KayKit Adventurer (`Mage.glb` ou `Rogue_Hooded.glb`) já em disco.
- [ ] Esqueletos (inimigo comum + Guardião) vêm do KayKit Skeletons.
- [ ] Cenário montado com o KayKit Dungeon Remastered, atlas único, instanciando
      repetições.
- [ ] Todos os humanoides compartilham um esqueleto e a `AnimationLibrary_Godot_Standard`
      (uma cópia da biblioteca, não uma por personagem).
- [ ] Cada `.glb` novo passou por `optimize_asset.py` + `validate_gltf.py` (escala aplicada,
      Y-up, dentro do teto de tris, atlas preservado).
- [ ] Personagens em `public/models/`; kit modular em `public/assets/dungeon_kit/`.
- [ ] `CREDITS.txt` da pasta atualizado com pacote, autor, URL, licença CC0 e data.
- [ ] KTX2/Draco aplicados apenas onde o ganho compensou (decisão registrada).
- [ ] Gerenciador de salas carrega UMA sala e descarta a anterior (malhas, materiais,
      física) ao avançar.
- [ ] `[A DEFINIR]` do método de download (manual vs automatizado) resolvido ou adiado com
      registro.
- [ ] `[A DEFINIR]` da pasta de assets, do uso de Git LFS e da paridade de esqueleto
      Skeletons/Adventurers/AnimationLibrary resolvidos ou adiados com registro.
- [ ] Sem travessões, sem emojis em qualquer texto exibido (guia de estilo 1.2).
