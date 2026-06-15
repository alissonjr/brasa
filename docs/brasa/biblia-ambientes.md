# Bíblia de Ambientes e Cenário - Brasa

Worldbuilding e construção espacial do dungeon crawler "Brasa". Babylon.js + Havok
(motor de `prototipo/src`), low-poly estilizado, frio-azul contra laranja-quente.
Critério número um: rodar leve no navegador (uma sala carregada por vez, com descarte).

Marcação de PROCEDÊNCIA (adaptada a IP original, conforme
[`../projeto-brasa.md`](../projeto-brasa.md)): `[DESIGN]` = decisão criativa nossa;
`[CÓDIGO]` = observado no código do protótipo; `[ASSET]` = procede de um pacote de
asset existente (aqui, KayKit Dungeon Remastered, CC0). Marcação de EXIGÊNCIA:
`[NORMATIVO]` = entra no aceite, verificável; `[ASPIRACIONAL]` = mood/intenção, não
bloqueia; `[A DEFINIR]` = decisão autoral pendente.

Ver também [`biblia-iluminacao.md`](biblia-iluminacao.md),
[`biblia-vfx-e-shaders.md`](biblia-vfx-e-shaders.md),
[`biblia-bestiario.md`](biblia-bestiario.md),
[`spec-vertical-slice-cripta.md`](spec-vertical-slice-cripta.md) e
[`../padrao-de-detalhe.md`](../padrao-de-detalhe.md) (régua de detalhe e DoD).

Nota de escopo: esta é a bíblia mais importante do corpus. Tudo aqui descreve a CRIPTA
(o poço-cripta e o seu kit de salas). Não há mundo aberto, terreno 600x600 nem skydome:
a cripta é fechada e o piso é peça modular (`../projeto-brasa.md` 4.4). Todo o cenário e
todos os props são montados com o KayKit Dungeon Remastered Pack; ZERO primitiva à mão e
ZERO Tripo para arquitetura ou props (`../projeto-brasa.md` 2 e 5).

---

## Parte 1: A anatomia do poço-cripta

Princípio [DESIGN]: o poço-cripta é UM único eixo vertical que afunda na rocha. Não é um
labirinto horizontal; é uma queda. A Acendedora desce, andar por andar, e cada andar é
uma câmara SELADA por uma porta de pedra. A leitura espacial que o jogador deve ter em 2
segundos: "estou mais fundo, mais frio, mais perto da Brasa". A profundidade cresce; o
calor da superfície fica para trás; o escuro azul aperta até o núcleo laranja no fundo.

### 1.1 A queda em andares (a coluna vertical)

- [DESIGN] O poço-cripta é lido como uma coluna de câmaras empilhadas, cada uma um
  patamar selado. Entre câmaras há sempre uma transição vertical (escada ou rampa
  descendente curta), nunca um corredor que sobe: o jogo só desce. A direção é a
  bússola emocional do jogador.
- [DESIGN] [NORMATIVO] Tecnicamente NÃO se renderiza a coluna inteira. Só UMA câmara
  existe carregada por vez (`../projeto-brasa.md` 4.1). A sensação de queda contínua é
  produzida pela transição (a escada some no escuro abaixo), pela atmosfera crescente
  (Parte 8) e pela ficção (a porta de pedra sela atrás), não por geometria contígua.
- [DESIGN] [ASPIRACIONAL] A boca do poço (onde a descida começa) é o último ponto que vê
  luz de cima: uma réstia fria de céu de inverno entrando pela abertura. Daí para baixo,
  só fogo: o que a Acendedora carrega na fagulha e o que ela reacende em cada braseiro.

### 1.2 Zonas de profundidade (o gradiente da queda)

[DESIGN] Três zonas de profundidade dão ao slice uma curva de leitura. São camadas
narrativas e visuais, não números de andar fixos; o `descent.ts` (`../projeto-brasa.md`
6.4) define quantas salas caem em cada zona.

1. **Boca e entulho (raso).** [DESIGN] Logo abaixo da superfície: câmaras meio
   desabadas, escombros, entulho, raízes secas que desceram da boca, restos de quem
   tentou descer antes. Pedra mais clara, juntas largas, sinais de saque antigo. Poucos
   mortos, despertando devagar. A luz do braseiro aqui ainda lembra a luz do dia.
2. **Câmaras seladas (médio).** [DESIGN] O coração da cripta: salas funerárias e
   cisternas que ninguém abriu há gerações. Pedra mais escura e regular, inscrições,
   nichos com ossadas, mais armadilhas, mais mortos e mais densos. O frio-azul domina; o
   braseiro reacendido vira um oásis de laranja num mar de penumbra.
3. **Núcleo da Brasa (fundo).** [DESIGN] O fundo do poço, onde a Brasa arde (ou agoniza).
   Arquitetura ritual, mais monumental: abóbadas, pilares grandes, o santuário do
   braseiro maior e, por fim, a câmara do Guardião. Aqui a paleta inverte: o laranja da
   Brasa é a fonte de luz dominante, o azul recua às bordas. É o destino da descida.

### 1.3 Profundidade crescente: o que muda ao descer (resumo normativo)

[DESIGN] [NORMATIVO] Conforme se desce, estes eixos andam juntos (detalhe e curva na
Parte 8). Servem de régua para montar qualquer andar:

| Eixo | Raso (entulho) | Médio (selado) | Fundo (núcleo) |
|---|---|---|---|
| Pedra | clara, gasta, desabada | escura, regular, intacta | ritual, monumental |
| Mortos | poucos, lentos | muitos, densos | elite + Guardião |
| Armadilhas | raras, óbvias | frequentes, escondidas | poucas, mas letais |
| Luz fria de base | menos fria (lembra o dia) | azul profundo | azul recolhido às bordas |
| Fonte de calor | só o braseiro da sala | só o braseiro da sala | a Brasa ilumina tudo |
| Escala da sala | média, irregular | variada | grande, vertical |

---

## Parte 2: O kit modular de cripta (peças, grid, orçamento)

[ASSET] [NORMATIVO] Toda a arquitetura da cripta é montada com peças do **KayKit Dungeon
Remastered Pack** (Kay Lousberg, CC0), o mesmo ecossistema low-poly dos personagens
(`../projeto-brasa.md` 5). Atlas único do pacote; instanciar repetições; nenhuma peça de
arquitetura modelada à mão. As peças do KayKit já cabem com folga no teto de tris.

### 2.1 Regra de grid (proposta de 4 m, a ratificar)

- [DESIGN] [A DEFINIR] **Grid de 4 m** para a planta da câmara (proposta, espelhando o
  grid de muralha de 4 m do projeto antigo, `../biblia-ambientes.md` 132). Pisos,
  paredes e tetos encaixam num módulo de 4 m; uma câmara típica é 3x3 ou 4x4 módulos
  (12x12 m a 16x16 m). Corredores têm 1 módulo de largura (4 m). RATIFICAR contra a
  escala real das peças do KayKit Dungeon Remastered ao baixá-lo: se o pacote vier num
  grid próprio (comum em 4 m ou em múltiplos menores), adotar o do pacote e atualizar
  este número, em vez de reescalar os modelos.
- [DESIGN] [NORMATIVO] Pé-direito de referência: 4 m em câmaras comuns, 6-8 m em salões e
  no santuário/câmara do Guardião (a verticalidade marca importância). Encaixe sempre no
  grid; nada de paredes a esmo.
- [DESIGN] [NORMATIVO] Origem das peças no chão (Y=0), Y-up, escala aplicada, conforme o
  pipeline `optimize_asset.py` + `validate_gltf.py` (`../projeto-brasa.md` 4.5). Pivôs
  consistentes para snap por código.

### 2.2 As peças do kit (catálogo)

[ASSET] [NORMATIVO] Conjunto mínimo de peças para montar qualquer sala do canon. Nomes de
id são nossos (`crypt_*`); cada um mapeia para uma peça equivalente do Dungeon Remastered
(confirmar nome exato do arquivo ao baixar; ver [A DEFINIR] de pasta em
`../projeto-brasa.md` 5).

| Peça (id) | O que é | Tris-alvo | Colisor | Nota de montagem |
|---|---|---|---|---|
| `crypt_floor` | piso modular (1 módulo) | 100-300 | box (chão) | base do grid; instanciar em tabuleiro |
| `crypt_wall` | parede reta (1 módulo) | 100-400 | box | unidade de fechamento; instanciar |
| `crypt_wall_door` | parede com vão de porta de pedra | 200-400 | box (batente) | recebe a porta selável (Parte 3) |
| `crypt_corner` | canto de parede (90 graus) | 100-300 | box | fecha quinas sem sobrepor parede |
| `crypt_stairs` | escada/rampa descendente | 200-400 | mesh/rampa | transição vertical entre câmaras |
| `crypt_ceiling` | teto plano (1 módulo) | 100-300 | sem (ou box alto) | câmaras comuns |
| `crypt_vault` | teto em abóbada (salão/santuário) | 300-500 | sem | marca salas importantes, pé-direito alto |
| `crypt_pillar` | pilar de apoio | 100-400 | box (cilindro) | cobertura em salões; ritmo visual |
| `crypt_grate` | grade de ferro (porta vazada/janela de cela) | 100-300 | box | nichos, celas, telegrafia de inimigo selado |

[DESIGN] [NORMATIVO] A porta de pedra selada (a peça narrativa central das transições)
NÃO é um modelo de cenário estático: é um ator com estado (selada/destravada/aberta),
descrito na Parte 3, encaixada no vão de `crypt_wall_door`.

[ASSET] Variações de cor/desgaste por zona (Parte 1.2) saem por vertex color e por troca
de submalha do mesmo atlas, não por novos modelos: pedra clara e desabada no raso, escura
e regular no médio, ritual no fundo. Mesma malha, paleta diferente.

### 2.3 Orçamento de tris e draw calls da sala

- [DESIGN] [NORMATIVO] **< 60 draw calls por sala carregada** (`../projeto-brasa.md`
  4.1). É o teto duro de aceite, mais folgado que o de mundo aberto porque só existe uma
  sala por vez. Meta é folga, não estouro.
- [DESIGN] [NORMATIVO] Como caber: **instanciar todas as repetições**. Piso, parede,
  pilar e canto repetidos viram thin instances / instâncias de um mesmo container (o
  protótipo já faz scatter por thin instance em `vegetation.ts` e tem helpers em
  `sceneKit.ts`, `../projeto-brasa.md` 6.1). Uma câmara 4x4 (16 pisos + ~16 paredes + 4
  pilares) deve sair em poucas draw calls, não dezenas.
- [DESIGN] [NORMATIVO] Tetos de tris por classe (de `../projeto-brasa.md` 4.2): peça
  modular de cripta 100-400 tris; prop 100-500; esqueleto comum 1k-3k (malha
  instanciada, esqueleto único compartilhado); Guardião 3k-6k.
- [DESIGN] [NORMATIVO] Materiais: atlas único do Dungeon Remastered compartilhado por
  todas as peças, para que o instancing colapse draw calls. Não introduzir um material
  por peça.

---

## Parte 3: A porta de pedra selada (peça-charneira do loop)

[DESIGN] [NORMATIVO] A porta de pedra é a articulação do laço de jogo
(`../projeto-brasa.md` 3.1): sela a sala ao entrar, só destrava ao acender o braseiro, e
ao cruzá-la a sala anterior é descartada. É a peça que torna a leveza técnica
(uma-sala-por-vez) uma premissa narrativa.

- [ASSET] Modelo: porta/portão de pedra do Dungeon Remastered (ou laje de pedra que desce
  no vão de `crypt_wall_door`). Tris 200-400; colisor box que liga/desliga com o estado.
- [DESIGN] [NORMATIVO] Estados do ator porta:
  1. **Aberta (entrada).** A Acendedora cruza; a porta SELA atrás (anima fechando, colisor
     liga, som grave de pedra). A sala fica em penumbra fria.
  2. **Selada (combate).** Trancada nos dois sentidos enquanto há mortos despertos. Não há
     fuga: limpar a sala é a única saída.
  3. **Destravada (braseiro aceso).** Ao acender o braseiro, a porta de SAÍDA destrava
     (som, fagulha de luz percorrendo a junta). Sinaliza "pode avançar".
  4. **Cruzada (transição).** Ao atravessar a porta de saída, dispara o descarte da sala
     atual e a carga da próxima (Parte 7).
- [DESIGN] [ASPIRACIONAL] Leitura: a porta selada é cor fria e morta; a destravada ganha
  um veio quente (emissivo discreto) sugerindo que o fogo "passou" por ela. Telegrafia
  sem texto.
- [DESIGN] As grades (`crypt_grate`) são a variante translúcida da mesma ideia: deixam o
  jogador VER a próxima ameaça ou recompensa sem alcançá-la ainda (telegrafia).

---

## Parte 4: O braseiro (a peça central)

[DESIGN] [NORMATIVO] O braseiro é o coração de cada sala e do jogo. Acendê-lo é o objetivo
de toda câmara comum; é o que vira a luz de fria para quente, concede upgrade e destrava a
porta (`../projeto-brasa.md` 3.1). Há sempre exatamente um braseiro acendível por câmara
de combate (o santuário tem um maior; a câmara do Guardião tem a própria Brasa).

### 4.1 Ficha do braseiro (id: `crypt_brazier`)

- Resumo [DESIGN]: braseiro de pedra/ferro no centro da câmara; apagado e frio até a
  Acendedora levar a fagulha; aceso, vira a fonte de luz quente da sala.
- Procedência: modelo [ASSET] (braseiro do Dungeon Remastered); comportamento e papel no
  loop [DESIGN]; números de luz [CÓDIGO] (padrão herdado de `gilgal.ts`).
- Orçamento técnico [NORMATIVO]: 100-500 tris (`../projeto-brasa.md` 4.2), colisor box.
  A chama é VFX (partículas + emissivo), orçada em draw call, não em tris (ver
  [`biblia-vfx-e-shaders.md`](biblia-vfx-e-shaders.md)).
- Estados [NORMATIVO]:
  - **Apagado (frio).** Sem chama, sem luz própria. A sala é iluminada só pela luz-chave
    fria e baixa. O braseiro lê como objeto morto, cinza-azulado. É um ponto de interação
    destacado (leve realce/contorno) para o jogador saber que é o objetivo.
  - **Aceso (quente).** Ao interagir (a Acendedora aplica a fagulha), a chama nasce: VFX
    de fogo, 1 luz pontual quente (laranja) ligada, sala recolorida de azul para laranja
    em transição. Concede o upgrade e destrava a porta.
- Iluminação [NORMATIVO]: a luz do braseiro é UMA luz pontual quente, **sem sombra**
  (padrão do protótipo: `gilgal.ts:259-266`, `gilgal.ts:324-330`,
  `../projeto-brasa.md` 4.4). No máximo 1-2 luzes dinâmicas por sala no total (a chave da
  sala pode ter sombra; a do braseiro não). Ver [`biblia-iluminacao.md`](biblia-iluminacao.md).
- Paleta [NORMATIVO]: apagado cinza-azulado frio (proposta `#3A4250`); aceso laranja-quente
  emissivo (proposta `#FF7A1A` a `#FFC24A` no núcleo). Hex marcados como proposta valem
  como [A DEFINIR] até ratificação em [`direcao-de-arte.md`](direcao-de-arte.md).
- Dimensão [NORMATIVO]: braseiro comum ~1,2 m de altura, base ~1 m; braseiro do santuário
  ~2 m, mais imponente; a Brasa (câmara do Guardião) é o maior, hero prop.
- Intenção / mood [ASPIRACIONAL]: o instante de acender é o respiro emocional da sala. O
  azul morto cede ao laranja vivo; a Acendedora "devolve a vida" àquele andar. É a
  recompensa sensorial, não só mecânica.
- Pendências [A DEFINIR]: curva de transição de cor (tempo, easing) fica para a bíblia de
  iluminação/VFX; valor exato dos hex e do raio de luz a ratificar.
- Ver também: [`biblia-iluminacao.md`](biblia-iluminacao.md),
  [`biblia-vfx-e-shaders.md`](biblia-vfx-e-shaders.md),
  [`spec-progressao-e-economia.md`](spec-progressao-e-economia.md) (o upgrade por braseiro).

---

## Parte 5: Fichas por tipo de sala (o canon)

[DESIGN] [NORMATIVO] Os cinco tipos de sala do canon (`../projeto-brasa.md` 3.2). Cada
ficha traz gancho de gameplay, dimensão, props obrigatórios, condição de luz e aceite,
nos campos exigidos por `../padrao-de-detalhe.md` 2.2. Todas montadas com o mesmo kit
modular (Parte 2), variando layout, recheio e zona de profundidade (Parte 1.2).

Orçamento padrão de todas: < 60 draw calls/sala, peças instanciadas, 1-2 luzes
dinâmicas, 1 sala carregada por vez (`../projeto-brasa.md` 4).

### 5.1 Câmara de guarda (id: `room_guard`)

- Resumo [DESIGN]: a sala-tipo que ensina o laço. Combate base curto, um braseiro, saída.
- Gancho de gameplay [DESIGN] [NORMATIVO]: entrar, ser selada, 2-4 esqueletos despertam,
  limpar com o melee, acender o braseiro, destravar e sair. É o tutorial vivo do loop.
- Dimensão [NORMATIVO]: ~12x12 m (3x3 módulos de 4 m), pé-direito 4 m. Planta simples,
  quadrada ou em L curto, sem cobertura complexa.
- Props obrigatórios [NORMATIVO]: 1 `crypt_brazier` central; 2-4 esqueletos (mortos
  despertos); porta de pedra de entrada (sela) e de saída (destrava); escombros/ossadas de
  ambientação. Zona raso ou início do médio (Parte 1.2).
- Condição de luz [NORMATIVO]: começa em penumbra fria (azul, baixa); ao acender o
  braseiro, vira laranja-quente. 1 luz-chave fria + 1 do braseiro.
- Intenção / mood [ASPIRACIONAL]: claustrofóbica mas legível; o jogador entende em segundos
  que limpar + acender = avançar.
- Aceite: ver checklist ao fim do doc (bloco "Câmara de guarda").

### 5.2 Corredor / antecâmara (id: `room_corridor`)

- Resumo [DESIGN]: sala de respiro entre picos. Sem combate ou um inimigo só; recompensa e
  telegrafia.
- Gancho de gameplay [DESIGN] [NORMATIVO]: travessia tensa de baixo combate; baús com
  recurso; uma armadilha telegrafada para ensinar o jogador a ler o chão; vista por grade
  da ameaça seguinte. Controla o ritmo (vale entre dois picos).
- Dimensão [NORMATIVO]: corredor de 4 m de largura por 12-20 m de comprimento (1 módulo de
  largura), ou antecâmara pequena ~8x8 m. Linear, dirige o olhar para a saída.
- Props obrigatórios [NORMATIVO]: 1-2 baús; ao menos 1 armadilha (placa de piso, espinhos,
  ou dardo) telegrafada; `crypt_grate` mostrando a próxima sala; tochas de parede;
  escombros. Pode não ter braseiro (corredor) ou ter um pequeno (antecâmara).
- Condição de luz [NORMATIVO]: penumbra fria contínua com tochas pontuais; se houver
  braseiro, acende ao fim. Mantém o frio para contraste com o pico seguinte.
- Intenção / mood [ASPIRACIONAL]: alívio cauteloso; recompensar a exploração sem baixar a
  guarda. A armadilha ensina, não pune de surpresa.
- Aceite: ver checklist (bloco "Corredor / antecâmara").

### 5.3 Cisterna / salão (id: `room_cistern`)

- Resumo [DESIGN]: o pico de combate. Sala grande, mais inimigos, pilares de cobertura.
- Gancho de gameplay [DESIGN] [NORMATIVO]: 4-6 esqueletos; pilares (`crypt_pillar`) que o
  jogador usa de cobertura e para quebrar linha de visão/agrupar inimigos. O confronto
  mais intenso da zona. Respeitar o teto de skinned simultâneos (<= 8/sala,
  `../projeto-brasa.md` 4.3).
- Dimensão [NORMATIVO]: ~16x16 m (4x4 módulos), pé-direito 6-8 m com `crypt_vault`. Pode
  ter desnível raso (cisterna seca) ou água rasa decorativa (sem natação).
- Props obrigatórios [NORMATIVO]: 4+ `crypt_pillar` em ritmo; 1 `crypt_brazier` central
  (maior visibilidade); 4-6 esqueletos; barris/ossadas; possível desnível de cisterna.
  Zona médio (Parte 1.2).
- Condição de luz [NORMATIVO]: azul profundo de base; o braseiro aceso transforma o salão
  num oásis quente; as colunas projetam volumes (sem sombra dinâmica nas luzes pontuais).
- Intenção / mood [ASPIRACIONAL]: grandiosidade fria e perigosa; o jogador sente que entrou
  no coração da cripta. Pico de adrenalina antes do respiro.
- Aceite: ver checklist (bloco "Cisterna / salão").

### 5.4 Santuário do braseiro (id: `room_shrine`)

- Resumo [DESIGN]: a sala de recompensa marcada. Braseiro maior; escolha de upgrade
  destacada.
- Gancho de gameplay [DESIGN] [NORMATIVO]: combate leve ou nenhum; o foco é o braseiro
  maior e a escolha de melhoria (dano, alcance, vida, raio de luz da fagulha,
  `../projeto-brasa.md` 3.3). Marco de progressão sentido como "altar".
- Dimensão [NORMATIVO]: ~12x12 a 14x14 m, pé-direito alto (6-8 m, `crypt_vault`),
  composição axial dirigindo ao braseiro ao fundo.
- Props obrigatórios [NORMATIVO]: 1 `crypt_brazier` GRANDE (~2 m) em destaque axial;
  pilares enquadrando; inscrições nas paredes (Parte 6); pouca ou nenhuma ossada (lugar
  "limpo", reverente); UI de escolha de upgrade ao acender.
- Condição de luz [NORMATIVO]: penumbra solene; ao acender, luz quente forte e central,
  quase cerimonial. O braseiro do santuário ilumina mais que o comum.
- Intenção / mood [ASPIRACIONAL]: respiro sagrado; o lugar onde a descida "respira fundo".
  Mítico e melancólico, mas esperançoso (tom do canon).
- Aceite: ver checklist (bloco "Santuário do braseiro").

### 5.5 Câmara do Guardião (id: `room_guardian`)

- Resumo [DESIGN]: o clímax do slice. Arena única do chefe Guardião, no fundo, junto à
  Brasa.
- Gancho de gameplay [DESIGN] [NORMATIVO]: porta sela atrás; o Guardião (chefe único,
  `spec-chefe-guardiao.md`) desperta; ao vencê-lo, a Acendedora acende/reaviva a Brasa,
  encerrando a descida (`../projeto-brasa.md` 3.1). Sem fuga, sem braseiro comum: a Brasa
  é o objetivo.
- Dimensão [NORMATIVO]: a maior sala, ~20x20 m ou mais (5x5 módulos), pé-direito 8 m+,
  abóbada e pilares monumentais. Arena com espaço para o moveset do chefe.
- Props obrigatórios [NORMATIVO]: a **Brasa** (hero prop, braseiro/fornalha central
  ancestral, apagada/agonizante no início); pilares grandes; arquitetura ritual da zona
  fundo; o Guardião. Sem baús nem armadilhas (a sala é o confronto puro).
- Condição de luz [NORMATIVO]: a paleta INVERTE (Parte 1.2): a Brasa agonizante dá um
  laranja fraco e bruxuleante no centro, azul nas bordas; ao reavivá-la no fim, explode em
  luz quente plena (set piece, `spec-set-pieces.md`). Respeitar 1-2 luzes dinâmicas.
- Intenção / mood [ASPIRACIONAL]: o destino de tudo. Solene, monumental, o ponto mais
  fundo e mais quente. A vitória é a luz voltando ao reino.
- Aceite: ver checklist (bloco "Câmara do Guardião").

---

## Parte 6: Props da cripta (set dressing instanciável)

[ASSET] [NORMATIVO] Peças avulsas do Dungeon Remastered, instanciadas. Cada prop sólido
ganha colisor box; tris 100-500 (`../projeto-brasa.md` 4.2). Instanciar repetições para
caber em < 60 draw calls.

- **Baús (`prop_chest`).** Recompensa (recurso/fagulha). Estados aberto/fechado; pode
  esconder armadilha (baú-isca). Telegrafa exploração premiada.
- **Barris e jarros (`prop_barrel`, `prop_jar`).** Ambientação e quebráveis com pequeno
  drop. Agrupar em cantos; instanciar.
- **Ossadas (`prop_bones`).** Restos espalhados; ambientação da morte selada. Adensam no
  médio/fundo (Parte 1.2). Sugerem de onde os esqueletos "se levantaram".
- **Tochas de parede (`prop_torch`).** Luz pontual fria/morta quando a sala está apagada;
  ambientação. Atenção ao orçamento de luzes dinâmicas: tochas decorativas usam emissivo +
  VFX barato, não luz dinâmica própria, salvo a 1-2 permitidas por sala.
- **Armadilhas (`trap_*`).** Placa de piso, espinhos, dardo, fosso. Telegrafadas no
  corredor/antecâmara (5.2); mais escondidas e letais no fundo. Hazard de leitura de chão.
  Colisor/trigger por física do motor.
- **Escombros e entulho (`prop_rubble`).** Pedra caída, raízes secas, restos de saque.
  Densos na zona raso (boca/entulho), raros no fundo ritual. Vendem a profundidade.
- **Inscrições (`prop_inscription`).** Relevos/glifos nas paredes (lore ambiental, sem
  texto longo). Mais frequentes no médio/fundo; marcam o santuário e a câmara do Guardião.
  Saem por textura no atlas, não por geometria nova.

[DESIGN] Regra de procedência: se faltar um prop específico no Dungeon Remastered, buscar
no reforço CC0 (Kenney Dungeon/Castle Kit) no mesmo estilo, registrando como [A DEFINIR];
NUNCA modelar à mão nem gastar Tripo (`../projeto-brasa.md` 2 e 5).

---

## Parte 7: Regra normativa - uma sala carregada por vez (com descarte)

[CÓDIGO] [DESIGN] [NORMATIVO] É a regra de leveza mais importante do jogo e da cripta. O
coração da performance (`../projeto-brasa.md` 4.1).

- [NORMATIVO] No máximo **UMA** sala de jogo carregada por vez. Ao cruzar a porta de
  saída, a sala anterior é DESCARTADA: malhas, materiais, texturas instanciadas e corpos
  de física daquela câmara são liberados antes (ou durante) a carga da próxima.
- [CÓDIGO] [NORMATIVO] O `worldStreaming.ts` atual NÃO faz isso: ele só adia carga por
  proximidade e declara "não há descarte em v1" (`worldStreaming.ts:6`). Brasa exige
  reescrevê-lo para um **gerenciador de salas com descarte** (modelo de uma-sala-ativa),
  conforme `../projeto-brasa.md` 6.2 e o novo `game/scenes/crypt/` de 6.4.
- [NORMATIVO] Corpos de física só nas paredes/colisores da sala atual e nos atores vivos;
  descartar ao trocar de sala (`../projeto-brasa.md` 4.4).
- [NORMATIVO] Verificável: no inspetor de cena do Babylon, ao avançar uma sala, a contagem
  de malhas/materiais/corpos da sala anterior cai a zero; as draw calls voltam ao patamar
  de uma sala só (< 60). Esse teste é item de aceite do gerenciador de salas
  (`../projeto-brasa.md` 8).
- [DESIGN] A porta de pedra selada (Parte 3) é o gatilho narrativo e técnico do descarte:
  a ficção (a porta sela atrás) justifica o jogo nunca precisar manter duas salas vivas.

---

## Parte 8: Progressão de atmosfera ao descer

[DESIGN] [ASPIRACIONAL] A atmosfera é a narrativa silenciosa da queda. Acompanha as zonas
de profundidade (Parte 1.2) e a régua da Parte 1.3. Não bloqueia o aceite (é mood), mas
orienta arte, luz, áudio e VFX. Os valores normativos (luzes, hex) ficam em
[`biblia-iluminacao.md`](biblia-iluminacao.md) e [`direcao-de-arte.md`](direcao-de-arte.md).

- **Cor.** [ASPIRACIONAL] Quanto mais fundo, mais frio e azul a luz de base, e mais
  precioso (mais contrastante) o laranja do braseiro reacendido. No fundo, a Brasa inverte
  tudo: o quente vira a base e o azul recua. A assinatura frio-azul vs laranja-quente do
  canon (`../projeto-brasa.md` 1) se intensifica na descida.
- **Som.** [ASPIRACIONAL] O silêncio aperta; o gotejar e o vento de poço somem dando lugar
  ao zumbido grave do fundo. O acender do braseiro traz um calor sonoro (ver
  [`biblia-audio.md`](biblia-audio.md)).
- **Densidade.** [ASPIRACIONAL] Menos entulho e mais ordem ritual ao descer: do caos
  desabado da boca à arquitetura intencional do núcleo. Mais mortos, mais inscrições, mais
  monumentalidade.
- **Ritmo de leitura.** [ASPIRACIONAL] Cada sala começa quase no escuro frio e termina em
  luz quente: a microcurva (medo -> alívio) repetida dá o pulso da descida; a macrocurva
  (raso claro -> médio gelado -> fundo em chamas) dá o arco do slice.

---

## Parte 9: Kit de montagem mínimo do slice (peças e reuso)

[ASSET] [DESIGN] [NORMATIVO] Conjunto mínimo para montar a descida de 5-7 salas + chefe
(`../projeto-brasa.md` 3.1 e 7). Todas do Dungeon Remastered, atlas único, instanciadas.

Estrutura modular (9): `crypt_floor`, `crypt_wall`, `crypt_wall_door`, `crypt_corner`,
`crypt_stairs`, `crypt_ceiling`, `crypt_vault`, `crypt_pillar`, `crypt_grate`.

Atores/charneiras (2): `crypt_door_sealed` (porta de pedra com estados, Parte 3),
`crypt_brazier` (braseiro comum + variante grande de santuário + a Brasa hero, Parte 4).

Props (7): `prop_chest`, `prop_barrel`/`prop_jar`, `prop_bones`, `prop_torch`,
`trap_*` (placa/espinhos/dardo), `prop_rubble`, `prop_inscription`.

[DESIGN] Com ~18 peças (mais variações de cor por zona) monta-se os cinco tipos de sala
do canon e a coluna inteira do slice: câmara de guarda (tutorial), corredor/antecâmara
(respiro), cisterna/salão (pico), santuário (recompensa) e câmara do Guardião (clímax). O
mesmo `crypt_floor`/`crypt_wall`/`crypt_pillar` serve toda a cripta; só mudam paleta, recheio
e zona. Reuso máximo, modelagem zero.

[DESIGN] [NORMATIVO] Padronizar o atlas único e o pipeline de instâncias ANTES de montar
salas em volume, para que o teto de < 60 draw calls valha desde a primeira câmara.

---

## Checklist de aceite (Definition of Done)

Cada item é um [NORMATIVO] verificável derivado das Partes 1 a 9. Cada bloco fecha com um
item de orçamento técnico que referencia o teto do canon (`../projeto-brasa.md` 4.1-4.2 e
`../padrao-de-detalhe.md` 2.1). Itens [A DEFINIR] marcam decisões autorais pendentes. Ver
o template em `../padrao-de-detalhe.md` seção 4.

### Anatomia do poço-cripta - ver Parte 1
- [ ] A descida é um eixo vertical: cada andar é uma câmara selada, a transição entre andares só desce (escada/rampa) [DESIGN][NORMATIVO]
- [ ] A coluna inteira NUNCA é renderizada de uma vez; a queda é vendida por transição, atmosfera e ficção, não por geometria contígua [DESIGN][NORMATIVO]
- [ ] As três zonas de profundidade legíveis: boca/entulho (raso), câmaras seladas (médio), núcleo da Brasa (fundo) [DESIGN][NORMATIVO]
- [ ] A profundidade crescente muda pedra, número de mortos, armadilhas, luz fria de base e escala conforme a régua da Parte 1.3 [DESIGN][NORMATIVO]

### Kit modular de cripta - ver Parte 2
- [ ] Toda a arquitetura montada com KayKit Dungeon Remastered (CC0), atlas único, zero primitiva à mão e zero Tripo [ASSET][NORMATIVO]
- [ ] As 9 peças do kit presentes: `crypt_floor`, `crypt_wall`, `crypt_wall_door`, `crypt_corner`, `crypt_stairs`, `crypt_ceiling`, `crypt_vault`, `crypt_pillar`, `crypt_grate` [ASSET][NORMATIVO]
- [ ] Cada peça modular dentro de 100-400 tris, com colisor conforme a tabela 2.2 [NORMATIVO]
- [ ] Repetições instanciadas (thin instances / container) para colapsar draw calls [DESIGN][NORMATIVO]
- [ ] Variação de zona por vertex color/atlas, não por novos modelos [ASSET][NORMATIVO]
- [ ] [A DEFINIR] Grid ratificado: proposta de 4 m confirmada ou trocada pelo grid real do pacote ao baixá-lo [DESIGN][A DEFINIR]

### Porta de pedra selada - ver Parte 3
- [ ] Porta como ator com 4 estados: aberta (entrada que sela), selada (trancada no combate), destravada (ao acender o braseiro), cruzada (dispara descarte) [DESIGN][NORMATIVO]
- [ ] Colisor liga/desliga conforme o estado; sem fuga enquanto há mortos despertos [DESIGN][NORMATIVO]
- [ ] Telegrafia visual: selada fria/morta, destravada com veio quente [DESIGN][ASPIRACIONAL]
- [ ] `crypt_grate` usada como telegrafia (ver a próxima ameaça/recompensa sem alcançar) [DESIGN][NORMATIVO]

### Braseiro - ver Parte 4
- [ ] Exatamente 1 braseiro acendível por câmara de combate; santuário com um maior; câmara do Guardião com a Brasa [DESIGN][NORMATIVO]
- [ ] Dois estados: apagado/frio (sem luz própria, objeto morto destacado como objetivo) e aceso/quente (chama, luz pontual quente, upgrade, destrava porta) [DESIGN][NORMATIVO]
- [ ] Luz do braseiro pontual e SEM sombra; no máximo 1-2 luzes dinâmicas por sala no total [CÓDIGO][NORMATIVO]
- [ ] Acender vira a sala de azul-frio para laranja-quente em transição [DESIGN][NORMATIVO]
- [ ] 100-500 tris + colisor box; a chama orçada em draw call (VFX), não em tris [NORMATIVO]

### Câmara de guarda - ver 5.1
- [ ] ~12x12 m (3x3 módulos), pé-direito 4 m [DESIGN][NORMATIVO]
- [ ] 2-4 esqueletos despertam ao selar; 1 braseiro central; portas de entrada e saída [DESIGN][NORMATIVO]
- [ ] Luz começa penumbra fria e vira quente ao acender o braseiro [DESIGN][NORMATIVO]
- [ ] Tris e draw calls dentro do alvo (`../projeto-brasa.md` 4.1-4.2) [NORMATIVO]

### Corredor / antecâmara - ver 5.2
- [ ] Corredor de 4 m de largura por 12-20 m, ou antecâmara ~8x8 m, linear [DESIGN][NORMATIVO]
- [ ] Sem combate ou 1 inimigo; 1-2 baús; ao menos 1 armadilha telegrafada; grade mostrando a sala seguinte [DESIGN][NORMATIVO]
- [ ] Luz fria contínua com tochas pontuais; mantém o frio para contraste [DESIGN][NORMATIVO]
- [ ] Tris e draw calls dentro do alvo (`../projeto-brasa.md` 4.1-4.2) [NORMATIVO]

### Cisterna / salão - ver 5.3
- [ ] ~16x16 m (4x4 módulos), pé-direito 6-8 m com abóbada [DESIGN][NORMATIVO]
- [ ] 4-6 esqueletos; 4+ pilares de cobertura; 1 braseiro central; teto de <= 8 skinned simultâneos respeitado [DESIGN][NORMATIVO]
- [ ] Azul profundo de base; braseiro aceso vira o salão num oásis quente [DESIGN][NORMATIVO]
- [ ] Tris e draw calls dentro do alvo (`../projeto-brasa.md` 4.1-4.2) [NORMATIVO]

### Santuário do braseiro - ver 5.4
- [ ] ~12x12 a 14x14 m, pé-direito alto, composição axial até o braseiro grande [DESIGN][NORMATIVO]
- [ ] Combate leve ou nenhum; braseiro GRANDE (~2 m) em destaque; escolha de upgrade ao acender [DESIGN][NORMATIVO]
- [ ] Inscrições nas paredes; pouca ou nenhuma ossada (lugar reverente) [DESIGN][NORMATIVO]
- [ ] Penumbra solene que vira luz quente forte e central ao acender [DESIGN][NORMATIVO]
- [ ] Tris e draw calls dentro do alvo (`../projeto-brasa.md` 4.1-4.2) [NORMATIVO]

### Câmara do Guardião - ver 5.5
- [ ] A maior sala, ~20x20 m+, pé-direito 8 m+, abóbada e pilares monumentais [DESIGN][NORMATIVO]
- [ ] Porta sela atrás; o Guardião desperta; vencer e reavivar a Brasa encerra a descida [DESIGN][NORMATIVO]
- [ ] A Brasa como hero prop central (apagada/agonizante no início); sem baús nem armadilhas [DESIGN][NORMATIVO]
- [ ] Paleta INVERTE: laranja agonizante no centro, azul nas bordas; reavivar explode em luz quente plena (set piece) [DESIGN][NORMATIVO]
- [ ] 1-2 luzes dinâmicas respeitadas; tris e draw calls dentro do alvo (`../projeto-brasa.md` 4.1-4.2) [NORMATIVO]

### Props da cripta - ver Parte 6
- [ ] Props do Dungeon Remastered presentes: baús, barris/jarros, ossadas, tochas, armadilhas, escombros, inscrições [ASSET][NORMATIVO]
- [ ] Cada prop sólido com colisor box; 100-500 tris; repetições instanciadas [NORMATIVO]
- [ ] Armadilhas telegrafadas no corredor/antecâmara e mais letais/escondidas no fundo [DESIGN][NORMATIVO]
- [ ] Escombros densos na zona raso e raros no fundo ritual (vendem a profundidade) [DESIGN][NORMATIVO]
- [ ] Inscrições por textura no atlas, não por geometria nova [ASSET][NORMATIVO]

### Uma sala por vez com descarte - ver Parte 7
- [ ] No máximo UMA sala carregada por vez; ao cruzar a porta, a anterior é descartada (malhas, materiais, texturas, física) [CÓDIGO][NORMATIVO]
- [ ] `worldStreaming.ts` reescrito como gerenciador de salas com descarte (não só adiamento de carga) [CÓDIGO][NORMATIVO]
- [ ] Verificável no inspetor: contagem de malhas/materiais/corpos da sala anterior cai a zero; draw calls voltam a < 60 [NORMATIVO]
- [ ] A porta de pedra selada é o gatilho narrativo e técnico do descarte [DESIGN][NORMATIVO]

### Progressão de atmosfera - ver Parte 8
- [ ] Luz de base mais fria/azul ao descer; laranja do braseiro mais contrastante; a Brasa inverte a paleta no fundo [DESIGN][ASPIRACIONAL]
- [ ] Microcurva por sala (escuro frio -> luz quente) e macrocurva da descida (raso claro -> médio gelado -> fundo em chamas) [DESIGN][ASPIRACIONAL]

### Kit de montagem mínimo do slice - ver Parte 9
- [ ] Estrutura (9), atores/charneiras (2: porta selada + braseiro/Brasa), props (7) presentes e suficientes para os 5 tipos de sala [ASSET][DESIGN][NORMATIVO]
- [ ] Atlas único e pipeline de instâncias padronizados antes de montar salas em volume [DESIGN][NORMATIVO]
- [ ] Cada `.glb` novo passou por `optimize_asset.py` + `validate_gltf.py` (`../projeto-brasa.md` 4.5) [NORMATIVO]
- [ ] Sem travessões, sem emojis em qualquer texto exibido (guia de estilo) [NORMATIVO]
- [ ] Itens [A DEFINIR] resolvidos ou explicitamente adiados com registro (grid de 4 m; pasta de assets) [A DEFINIR]
