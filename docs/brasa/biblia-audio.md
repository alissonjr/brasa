# Bíblia de Áudio, Música e Voz - Brasa

Dungeon crawler 3D low-poly para navegador (Babylon.js / WebAudio), estilo CC0 KayKit.
Tom: mítico, sóbrio, melancólico mas com esperança. A assinatura sonora é a oposição
FRIO (morte, escuro, silêncio, eco da pedra) contra QUENTE (Brasa, vida, crepitar do
fogo). Critério número um do projeto: **rodar leve no navegador** - aqui isso significa
áudio em formato web leve, poucas vozes simultâneas e nenhum middleware.

Marcação de PROCEDÊNCIA (herdada de [`projeto-brasa.md`](../projeto-brasa.md)):
`[DESIGN]` = decisão criativa nossa; `[CÓDIGO]` = observado no código do protótipo;
`[ASSET]` = procede de pacote de asset. Marcação de EXIGÊNCIA: `[NORMATIVO]` (entra no
aceite, verificável), `[ASPIRACIONAL]` (mood/intenção, não bloqueia), `[A DEFINIR]`
(decisão pendente).

Ver também [`projeto-brasa.md`](../projeto-brasa.md) (CANON: premissa, loop sala-a-sala,
orçamento técnico), [`direcao-de-arte.md`](direcao-de-arte.md) (paleta frio-quente,
luz como personagem) e [`../padrao-de-detalhe.md`](../padrao-de-detalhe.md) (régua e DoD).

Convenção: pt-BR, sem travessões, sem emojis.

Snapshot: 2026-06-14.

Nota de espírito: Brasa não tem trilha histórica a reconstruir (é fantasia original). A
"autenticidade" aqui é coerência de mundo: o som vende a temperatura. Antes de acender, o
jogador deve OUVIR o frio (silêncio, gotejar, eco longo da pedra, vento do poço subindo).
Quando o braseiro pega, o som "esquenta": o silêncio recua, o crepitar entra próximo e
seco, a música ganha calor. Som é o segundo termômetro da cena, ao lado da luz.

---

## 1. Direção musical

### 1.1 Paleta sonora [DESIGN]

Orquestração mínima, fria e espaçosa, contraposta a um núcleo quente pequeno. Nada de
orquestra sinfônica cheia (peso de memória e anacronismo de tom). Duas famílias que
brigam ao longo de cada sala:

- Paleta FRIA (penumbra, morte, escuro): drone grave sustentado, cordas em harmônicos e
  sul ponticello (som vidrado, sem corpo), sinos/placas metálicas tocadas com arco
  (bowed metal) longe e reverberadas, sopro grave soprado sem nota (ar/respiração da
  pedra), coro feminino em vogal única muito distante e em ppp. Muito espaço, reverb
  longo de catacumba, quase sem ritmo. O frio é silêncio com textura, não melodia.
- Paleta QUENTE (Brasa, vida, braseiro aceso): a mesma instrumentação ganha um núcleo
  próximo e seco: uma harpa/lira pinçada (o motivo da Brasa), tambor de pele grave e
  humano (pulso de coração lento), o crepitar do fogo entrando como cor rítmica, o coro
  abrindo de uma vogal para uma quinta aberta. Reverb encurta (a luz "fecha" o espaço,
  torna a sala íntima). O quente entra por adição de proximidade e calor de timbre, não
  por volume bruto.

`[DESIGN]` O timbre casa com a arte low-poly estilizada: sóbrio, sem brilho excessivo,
graves redondos, agudos contidos. Evitar synth moderno reconhecível (tira o mítico);
preferir timbres acústicos processados (cordas, pele, metal, voz, ar).

### 1.2 O eixo frio-quente como gramática [DESIGN] [NORMATIVO]

Toda a partitura de Brasa se organiza num único eixo de temperatura, mapeável a
parâmetros mensuráveis (entra no aceite):

| Parâmetro | Frio (penumbra/morte) | Quente (braseiro aceso) |
|---|---|---|
| Reverb / tamanho do espaço | longo (cauda ~3-5 s), eco de pedra | curto (cauda ~1 s), sala íntima |
| Registro dominante | grave + agudos vidrados, miolo vazio | miolo preenchido (harpa/coro/pele) |
| Ritmo | nenhum ou pulso ausente | pulso de coração lento, humano |
| Timbre líder | bowed metal / ar / drone | lira pinçada + crepitar próximo |
| Dinâmica | ppp, distante | mp, próxima |
| Coro | vogal única, dissonante leve, longe | quinta aberta, consonante, presente |

`[DESIGN]` A transição frio -> quente NUNCA é um corte: é um crossfade conduzido pelo
evento "braseiro aceso" (ver seção 4). A reavivação da Brasa no fim do slice é o ponto
mais quente de todo o jogo.

### 1.3 Escalas e modos [DESIGN]

Sem teoria histórica a respeitar; a escolha é puramente de mood:

- Base modal menor antiga: eólio e frígio (sóbrio, melancólico, "não maior feliz"). O
  frígio (2a menor exposta) dá o aperto da penumbra e do despertar dos mortos.
- Harmonia por drones e quintas abertas, não por progressões funcionais ricas (a
  funcionalidade soa moderna e quebra o mítico; quintas vazias soam antigas e frias).
- A esperança entra por uma única abertura: o motivo da Brasa pode resolver de uma 2a
  menor (aperto) para uma 3a menor e, no clímax de reavivar a Brasa, tocar uma 3a MAIOR
  (raio de calor, única cor "quente" harmônica reservada para o fim). Usar a 3a maior com
  parcimônia: ela é o "sol" do jogo e perde força se aparecer cedo.
- Microtonalidade só por bends leves de cordas/voz para o desconforto do frio; nunca como
  afinação base (mantém compatibilidade com samples e mixagem web).

### 1.4 Frio x Quente x Guardião (os três espíritos sonoros) [DESIGN]

- FRIO / mortos despertos / penumbra: drone, bowed metal, ar, coro distante dissonante.
  Sem pulso. A morte não tem ritmo. Quando os esqueletos despertam, uma célula curta e
  seca de percussão de osso/madeira (ver seção 5) "infecta" o frio por baixo.
- QUENTE / Brasa / Acendedora: lira pinçada, pele grave (coração), crepitar, coro
  abrindo em quinta. Tem pulso, tem corpo, tem proximidade. É a única coisa viva que se
  ouve na cripta.
- GUARDIÃO (chefe no fundo): o frio levado ao extremo e dotado de vontade. Drone que
  vira sub-bass com batimento (duas frequências próximas batendo, sensação de ameaça
  física), bowed metal agressivo, coro masculino grave e processado (não feminino: é
  outra presença, mais pesada), percussão de pedra/osso pesada e lenta. O Guardião não
  acelera: ele esmaga devagar. A vitória sobre ele abre espaço para o quente máximo.

---

## 2. Leitmotifs (temas) [DESIGN]

Três motivos curtos (3-5 notas), transponíveis e fragmentáveis, para o sistema adaptativo
citá-los em qualquer camada. Curtos de propósito: cabem em SFX, em stinger e em stem.

1. **Tema da Brasa** (vida, esperança, a Acendedora): célula ascendente de 4 notas em
   eólio, terminando suspensa (sem resolver), tocada em lira/harpa pinçada, próxima e
   seca. É o coração quente do jogo. Fragmento (2 notas) toca a cada braseiro aceso;
   pleno e com 3a MAIOR só ao reavivar a Brasa no fim. Pode aparecer cantarolado/assoprado
   pela voz da Acendedora em momentos de respiro (ver seção 6). É o único tema que
   "esquenta".

2. **Tema da Descida** (a cripta, o peso, descer mais fundo): motivo descendente e lento
   por graus conjuntos, frígio, em drone + bowed metal, sem ritmo definido. Cada vez que
   o jogador cruza uma porta de pedra para a sala seguinte, o tema desce uma transposição
   (meio tom ou um tom abaixo), reforçando que se afunda no poço-cripta. É a moldura
   sonora da progressão: o frio que aumenta andar a andar. Contraponto direto do Tema da
   Brasa (um sobe e esquenta, o outro desce e esfria).

3. **Tema do Guardião** (o chefe, a morte com vontade): não é melodia, é uma SONORIDADE
   assinatura: sub-bass com batimento + cluster grave de coro masculino processado que
   resolve devagar para uma quinta vazia + uma batida única de pedra/osso. "Acorde-peso".
   Tudo na mixagem recua quando ele entra (a sala "prende a respiração"). Aparece como
   stinger curto ao avistar o Guardião e pleno na câmara do chefe. É o extremo frio
   antes do extremo quente.

`[DESIGN]` Entrelaçamento: o Tema da Descida e o Tema da Brasa partilham o eólio/frígio e
soam em tensão (a Acendedora desce contra a corrente do frio). Quando um braseiro acende,
um fragmento da Brasa "vence" momentaneamente o Tema da Descida na mixagem (o quente
empurra o frio para baixo, espelhando a ficção). Na câmara do Guardião, o Tema do Guardião
domina e esmaga os outros; ao vencê-lo e reavivar a Brasa, o Tema da Brasa toma toda a
mixagem em sua forma plena com 3a maior, pela única vez no slice. O arco do som é o arco
da história: frio que recua diante da fagulha.

---

## 3. Música por cena / estado de sala [DESIGN]

A unidade musical de Brasa NÃO é a "cena" linear, é o ESTADO da sala dentro do laço
(entrar -> selar -> despertam -> limpar -> acender braseiro -> trocar). A música é
adaptativa por estado (seção 4). A tabela mapeia cada estado a mood e tratamento.

| Estado de sala | Mood | Instrumentação / tratamento | Intensidade / modo |
|---|---|---|---|
| Penumbra tensa (entrou, porta selou) | frio, claustrofóbico, espera | drone grave + bowed metal distante + ambiente (gotejar/vento do poço) audível por cima; sem pulso; reverb longo | baixa; Tema da Descida fragmentado; o silêncio é o protagonista |
| Despertar dos mortos | arrepio, ameaça nascendo | sobre o bed frio, entra célula seca de osso/madeira + sopro grave crescente + um sussurro do passado; coro distante ganha 2a menor | sobe rápido de baixa para média; stinger de despertar marca o frame |
| Combate | tenso, urgente mas sóbrio (não heroico) | pulso de pele grave acelera, percussão de osso, bowed metal agressivo, drone com batimento leve; ainda sem grande melodia (morte não canta) | média-alta; corta a melodia, prioriza ritmo e atrito; loops curtos |
| Sala limpa, braseiro apagado | alívio frágil, vazio | combate recua por crossfade; volta o bed frio mas com a tensão drenada; janela de calma antes de acender | baixa; "vácuo" de respiro; convida à interação do braseiro |
| Acender o braseiro (transição-chave) | esperança, calor entrando | crescendo curto: crepitar do fogo entra próximo e seco, reverb encurta, fragmento do Tema da Brasa na lira, coro abre de vogal para quinta; o frio recua na mixagem | pico quente local; stinger de "fagulha pega"; é o momento mais bonito da sala |
| Braseiro aceso (alívio quente) | quente, íntimo, breve descanso | bed quente: lira + pele lenta (coração) + crepitar como cor + coro consonante em ppp; reverb curto, sala íntima | baixa-média; recompensa sonora; dura pouco antes da porta abrir |
| Câmara do Guardião (clímax) | peso, ameaça máxima, depois triunfo | Tema do Guardião pleno (sub-bass batendo, coro masculino grave, pedra/osso); ao vencer e reavivar a Brasa, corte para quase silêncio e então Tema da Brasa pleno com 3a maior | máxima na luta; resolução por contraste (silêncio antes do calor) |

`[DESIGN]` Princípio transversal: clímax por CONTRASTE dinâmico (silêncio antes do calor),
não por volume contínuo. A reavivação da Brasa é precedida por um vácuo de quase silêncio
para que o tema quente exploda em alívio. O frio é vendido por subtração; o quente, por
proximidade e calor de timbre, não por decibéis.

---

## 4. Música adaptativa / dinâmica [DESIGN] [NORMATIVO]

`[DESIGN]` Vertical layering (stems sobrepostos) como espinha dorsal, exatamente como o
modelo do código do protótipo (music manager por crossfade de volume): stems no mesmo
BPM/tom, todos em loop sincronizado, sobem/descem por volume conforme o estado da sala, sem
interromper o fluxo. É o mais barato e robusto na web e o que casa com o regime
sala-a-sala.

`[DESIGN]` Modelo de estados POR SALA (cada sala carrega seu pacote leve de stems e o
descarta junto com a sala, ver seção 7):

1. `bed_frio` (drone + bowed metal + ar): sempre audível enquanto a sala está fria.
2. `tension` (sopro crescente + célula de osso + sussurro): sobe no despertar.
3. `combat` (pulso de pele + percussão de osso + batimento): sobe no combate, desce ao
   limpar a sala.
4. `bed_quente` (lira + pele-coração + crepitar musical + coro em quinta): entra por
   crossfade no evento "braseiro aceso", cruzando com a queda do `bed_frio`.

`[DESIGN]` Transições por crossfade de volume com shape logarítmico (`setVolume` no
Babylon), exatamente como o music manager descrito no doc de áudio do projeto irmão e já
previsto no motor. O evento "braseiro aceso" é o gatilho central: dispara o crossfade
`bed_frio` -> `bed_quente` e o stinger da fagulha.

`[DESIGN]` Horizontal resequencing (trocar de peça inteira) só na entrada da câmara do
Guardião e na reavivação final da Brasa, cortando em ponto musical. Usar pouquíssimo: o
resto é tudo crossfade vertical.

`[DESIGN]` Stingers curtos (sobre a música corrente, não a interrompem): despertar dos
mortos, fagulha pega (braseiro acendeu), avistar o Guardião, reavivar a Brasa.

`[DESIGN]` [NORMATIVO] Viabilidade web: sem middleware (FMOD/Wwise não rodam nativamente
no navegador). Implementar/reusar um "music manager" em JS que controla volumes de N stems
em loop, dirigido pelos eventos do laço de sala (entrar, despertar, limpar, acender, sair),
publicados no `eventBus` do motor (`engine/core/eventBus`, ver
[`projeto-brasa.md`](../projeto-brasa.md) seção 6.1).

`[NORMATIVO]` Custo principal = memória de stems decodificados. Limitar a 3-4 stems ativos
por sala; carregar com a sala e DESCARTAR ao cruzar a porta, espelhando o gerenciador de
salas com descarte (seção 4.1 do canon). Música e ambiente longos sempre em streaming.

---

## 5. SFX - paleta de efeitos [DESIGN]

Foley gravado seco e processado. Cada SFX-chave também serve ao eixo frio-quente: a
maioria é fria e seca (pedra, osso, eco); o fogo é o único quente e próximo.

### 5.1 SFX-chave de Brasa

- **Passos na pedra** [DESIGN] [NORMATIVO]: passo seco com cauda de eco curto na sala
  fechada (a pedra responde). 4-6 variações + leve aleatoriedade de pitch/volume. Passos
  da Acendedora distintos dos dos esqueletos (osso/raspar, ver abaixo). Espacializados:
  ecoam mais na penumbra (sala fria, vazia) e menos com o braseiro aceso (a luz "fecha" o
  espaço; espelha o reverb da música).

- **Despertar dos esqueletos** [DESIGN] [NORMATIVO]: hero SFX de arrepio. Camadas:
  estalo/clique de osso seco + raspar de pedra (a tampa/laje saindo) + um sopro de ar
  frio + uma nota grave de bowed metal curta. Sincronizado ao frame da animação de
  despertar e ao stinger musical de tensão. Cada esqueleto que se levanta dispara uma
  variação mais leve; o primeiro da sala é o pleno.

- **Impactos de combate** [DESIGN] [NORMATIVO]: impacto contra osso (estalo seco,
  "tac/crack", não o tine metálico do aço; esqueleto é osso e cota velha). Camadas por
  tipo de golpe: corte (whoosh + impacto seco), pancada (impacto surdo). Osso quebrando/
  desmoronando quando o esqueleto cai (clatter de ossos no chão de pedra). Hooks de hitStop
  e impactFx já existem no motor (`game/combat/impactFx`, `combatSound` - ver canon 6.1):
  re-apontar para os samples de osso de Brasa.

- **Crepitar do braseiro ao acender** [DESIGN] [NORMATIVO]: hero SFX quente, o oposto de
  tudo. Camadas: a fagulha pegando (whoosh curto de ignição) + crepitar próximo e seco
  que cresce + um "uffff" grave de calor enchendo a sala. Sincronizado ao acender da luz
  quente e ao crossfade musical para `bed_quente`. Depois de aceso, um loop de crepitar
  baixo e próximo fica espacializado no braseiro (cor quente persistente da sala). É o som
  mais reconfortante do jogo: o jogador deve querer ouvi-lo.

- **Porta de pedra selada arrastando** [DESIGN] [NORMATIVO]: laje pesada raspando pedra
  contra pedra (rumble grave + raspagem áspera + impacto final surdo quando assenta). Dois
  usos: a porta SELANDO atrás da Acendedora ao entrar (gatilho do estado de penumbra
  tensa, com peso de "sem volta") e a porta de saída ABRINDO ao acender o braseiro (mesma
  textura, sensação de alívio/liberação). Espacializado na porta.

- **Ambiente da cripta** [DESIGN] [NORMATIVO]: leito de ambiente em loop, sempre presente
  na penumbra: gotejar de água esparso e reverberado (cisterna/poço) + um vento grave e
  surdo subindo do fundo do poço-cripta (o ar frio que sobe). Esparso e baixo, mas nunca
  ausente: o silêncio total seria menos opressor que o gotejar que marca o tempo. Recua
  (não some) quando o braseiro acende, dando lugar ao crepitar.

### 5.2 SFX do Guardião [DESIGN]

`[DESIGN]` Passos pesados de pedra/osso (rumble + impacto), respiração/rosnado grave e
processado, golpes lentos com whoosh largo e impacto sub-bass; um "estalar" do próprio
corpo do chefe (osso/pedra sob tensão) que telegrafa ataques. Sincronia: cada golpe pesado
do Guardião casa com uma batida do Tema do Guardião na música. Ao ser derrotado: colapso
(desmoronar de pedra/osso + cauda longa de poeira) e então silêncio para o calor entrar.

### 5.3 SFX de interface e fagulha [DESIGN]

`[DESIGN]` A fagulha que a Acendedora carrega tem um sussurro/zumbido quente baixíssimo,
quase subliminar, espacializado nela (lembra que ela é a única fonte de calor antes do
braseiro). Sons de UI sóbrios e quentes (escolha de upgrade no braseiro: um tilintar
quente curto, não eletrônico). Coleta de recurso: cor quente discreta.

---

## 6. Voz e silêncio da Acendedora [DESIGN]

`[DESIGN]` `[NORMATIVO]` A Acendedora é primordialmente SILENCIOSA. Ela não narra; o jogo
não tem narrador onisciente. O silêncio dela é caracterização: é a última, desce sozinha,
fala pouco. Isso também resolve custo de voz no protótipo (zero dublagem agora).

`[DESIGN]` Vocalizações não-verbais (não são fala, são foley vocal, leves e baratos de
produzir, sem localização): esforço no golpe e ao levar dano, respiração que muda com o
frio (ofegar curto na penumbra; um suspiro de alívio quando o braseiro acende e o calor a
toca). Opcional `[ASPIRACIONAL]`: a Acendedora cantarola/assopra baixinho o Tema da Brasa
nos momentos de respiro (braseiro aceso), como quem se aquece - a única "melodia humana"
do jogo, fragmentada e frágil.

`[A DEFINIR]` Se a versão completa terá fala plena da Acendedora (poucas linhas, em
momentos-chave) ou se ela permanece muda no estilo de protagonista silencioso. Recomendação
`[DESIGN]`: mantê-la muda; o mundo fala por sussurros (seção 6.1) e a voz dela seria mais
forte se guardada para um único momento (reavivar a Brasa). Decidir na versão completa.

### 6.1 Sussurros do passado como lore sonora [DESIGN]

`[DESIGN]` A história do reino e das Acendedoras anteriores NÃO é contada por texto
expositivo nem por narrador: é semeada como SUSSURROS do passado, fragmentos vocais que a
Brasa/as câmaras "lembram". Tratamento:

- Sussurros curtos (uma frase ou meia frase), voz processada (reverberada, distante,
  às vezes feminina - Acendedoras passadas, às vezes uma multidão sussurrante), disparados
  por gatilho: entrar numa sala-chave, acender um braseiro específico, avistar o Guardião.
- São lore opcional e ambiental: o jogador não precisa "entender tudo"; o mood vem antes
  da informação. Soam como memória da pedra, não como diálogo.
- `[NORMATIVO]` Sempre legendados (acessibilidade, seção 8), já que carregam o pouco de
  texto narrativo que o jogo tem. Em pt-BR no protótipo.
- `[A DEFINIR]` Conteúdo exato dos sussurros (roteiro de fragmentos de lore). Depende da
  narrativa fina do slice; marcar como pendência de texto, não de áudio.

`[DESIGN]` `[ASPIRACIONAL]` O calor reativa a memória: quando o braseiro acende, os
sussurros podem ficar momentaneamente mais nítidos (a luz e o calor "lembram"), reforçando
que a Brasa é memória viva do reino. Esfriou, esqueceu; aqueceu, lembrou.

### 6.2 O Guardião e os esqueletos [DESIGN]

`[DESIGN]` Esqueletos: sem fala, só foley (estalos de osso, ataque, queda). O Guardião:
sem fala articulada no protótipo; respiração/rosnado grave processado e, opcionalmente,
um único sussurro ameaçador na entrada da câmara (mesma família dos sussurros do passado,
mas grave e hostil). `[A DEFINIR]` se o Guardião ganha falas na versão completa.

---

## 7. Mixagem, implementação e orçamento [DESIGN] [NORMATIVO]

### 7.1 Engine e roteamento

`[DESIGN]` Babylon Audio Engine v2 (sobre WebAudio) como principal, integrando
mesh/câmera/listener e som espacial, sem manter dois grafos WebAudio. Reusar o que o motor
já provê. Buses (`CreateAudioBusAsync`) para grupos: Música, SFX, Voz/Sussurros, Ambiente.

`[NORMATIVO]` `unlockAsync` no primeiro clique/toque antes de tocar qualquer áudio
(browsers exigem interação). SFX curtos em memória (`CreateSoundAsync`, buffer
compartilhado, limite de instâncias); música/ambiente/sussurros longos em
`CreateStreamingSoundAsync`, `{ loop: true }` nos beds. Fades via `setVolume(target,
{ duration, shape: Logarithmic })`. Espacial via `{ spatialEnabled: true }` +
`sound.spatial.attach(mesh)` (braseiro, porta, fagulha, esqueletos, Guardião); listener
na câmera/Acendedora.

### 7.2 Número de vozes simultâneas (orçamento de canais) [NORMATIVO]

`[NORMATIVO]` Brasa é leve por contar canais. Tetos por sala:

| Grupo | Vozes/canais simultâneos (teto) | Observação |
|---|---|---|
| Música (stems) | 3-4 | bed_frio, tension, combat, bed_quente; em crossfade, não somam picos |
| Ambiente | 1-2 | leito de gotejar/vento em loop |
| SFX de combate | <= 6-8 ativos | pool com limite de instâncias; roubo de voz por prioridade |
| Voz/Sussurros | 1-2 | sussurros não se sobrepõem em multidão real, é 1 leito processado |
| Total de vozes WebAudio simultâneas | alvo <= 16, teto 24 | folga; medir em mobile médio |

`[DESIGN]` Pooling e roubo de voz (voice stealing) por prioridade quando estourar: impactos
de combate cedem a hero SFX (despertar, fagulha, porta). Limitar instâncias de passos.

### 7.3 Formatos e loudness [NORMATIVO]

`[NORMATIVO]` Formato web leve: webm (Opus) com fallback mp3 para música/ambiente/voz; SFX
em wav no dev, ogg/webm (Opus) em produção. Entregar arrays de fontes e deixar a engine
escolher (Chrome só aceita Opus via WebAudio em `audio/webm; codecs=opus`, não em .ogg/
Opus). Loudness padronizado em -16 LUFS; mono para SFX espacializados e voz, estéreo só
para beds de música/ambiente. Nomeação por estado/evento para o music manager e por
personagem/linha para futura localização.

### 7.4 Orçamento de memória [NORMATIVO]

`[NORMATIVO]` Stems decodificados em RAM são o maior custo: 3-4 stems por sala, carregados
e DESCARTADOS junto com a sala (espelha o gerenciador de salas com descarte do canon, 4.1).
Música/ambiente/sussurros sempre em streaming. SFX em memória com buffer compartilhado e
limite de instâncias. Pré-decodificar no `unlockAsync`. Agrupar SFX espaciais em poucos
buses. Nenhum áudio de sala inativa permanece carregado.

---

## 8. Acessibilidade [DESIGN] [NORMATIVO]

`[DESIGN]` Brasa é sóbrio e silencioso; a informação que chega por som precisa chegar
também por outro canal.

- `[NORMATIVO]` Legendas de SFX (closed captions de efeitos) opcionais: rótulos curtos para
  os SFX-chave que carregam informação de gameplay, no estilo "[porta de pedra arrastando]",
  "[esqueletos despertando]", "[braseiro crepitando]", "[passos atrás]". Em pt-BR no
  protótipo. Ligáveis/desligáveis nas opções.
- `[NORMATIVO]` Sussurros do passado SEMPRE legendados (carregam o lore narrativo, seção
  6.1).
- `[NORMATIVO]` Controles de volume independentes por bus (Música, SFX, Voz/Sussurros,
  Ambiente) nas opções, reusando o `platform/settings` do motor.
- `[ASPIRACIONAL]` Indicador visual de direção de som para eventos relevantes fora da tela
  (ex.: despertar/passos atrás da Acendedora), para quem joga com áudio baixo ou tem perda
  auditiva. Casa com a leitura de luz da direção de arte.
- `[ASPIRACIONAL]` Como o eixo frio-quente é redundante com a luz (frio = escuro/azul,
  quente = laranja), jogadores com baixa audição ainda leem a temperatura da sala pela
  iluminação. Manter essa redundância de propósito.

---

## 9. Fichas por cena sonora [DESIGN]

Fichas no formato do template de áudio do padrão de detalhe (leitmotif/instrumentos; por
cena; adaptativo; SFX-chave). Cada uma termina alimentando o checklist da seção 10.

### Ficha 1 - Sala em penumbra (id: cena_penumbra_tensa)
- Resumo [DESIGN]: a Acendedora entrou, a porta selou, a sala está fria e quase escura;
  espera tensa antes do despertar.
- Leitmotif: Tema da Descida fragmentado.
- Instrumentação/mood [ASPIRACIONAL]: frio, claustrofóbico; drone grave + bowed metal
  distante + leito de ambiente (gotejar + vento do poço) por cima; sem pulso; reverb longo
  de pedra. O silêncio é o protagonista.
- Adaptativo [NORMATIVO]: stem `bed_frio` no volume cheio; demais stems em zero.
- SFX-chave [NORMATIVO]: porta de pedra selando atrás (gatilho de entrada); passos na pedra
  com eco; ambiente de gotejar/vento; sussurro do fundo, esparso.
- Mood [ASPIRACIONAL]: o jogador deve sentir frio e "sem volta" antes de qualquer ameaça.

### Ficha 2 - Combate (id: cena_combate)
- Resumo [DESIGN]: os mortos despertaram; a Acendedora limpa a sala no combate melee.
- Leitmotif: nenhum melódico pleno (a morte não canta); célula de osso percussiva.
- Instrumentação/mood [ASPIRACIONAL]: tenso, urgente, sóbrio (não heroico); pulso de pele
  grave, percussão de osso, bowed metal agressivo, drone com batimento leve.
- Adaptativo [NORMATIVO]: `tension` sobe no despertar; `combat` sobe durante a luta; ambos
  recuam por crossfade ao limpar a sala (volta o respiro de `bed_frio` drenado).
- SFX-chave [NORMATIVO]: despertar dos esqueletos (hero SFX + stinger, sincronizado ao
  frame); impactos contra osso (corte/pancada); ossos desmoronando na queda; esforço/dano
  vocal da Acendedora (foley não-verbal).
- Mood [ASPIRACIONAL]: atrito e perigo, sem épico de orquestra; a morte é fria e seca.

### Ficha 3 - Acender o braseiro (id: cena_acender_braseiro)
- Resumo [DESIGN]: sala limpa; a Acendedora acende o braseiro central; a luz vira quente,
  destrava a porta. Momento emocional da sala.
- Leitmotif: fragmento do Tema da Brasa (2 notas, lira pinçada).
- Instrumentação/mood [ASPIRACIONAL]: esperança, calor entrando; crepitar próximo e seco,
  reverb encurta, coro abre de vogal para quinta; o frio recua na mixagem.
- Adaptativo [NORMATIVO]: evento "braseiro aceso" dispara crossfade logarítmico
  `bed_frio` -> `bed_quente` + stinger de fagulha pega. Depois, `bed_quente` em
  volume baixo-médio (alívio quente).
- SFX-chave [NORMATIVO]: crepitar do braseiro ao acender (hero SFX: ignição + crepitar
  crescente + "uffff" de calor); loop de crepitar espacializado no braseiro depois; porta
  de saída destravando/arrastando; suspiro de alívio da Acendedora; sussurros podem ficar
  mais nítidos (ASPIRACIONAL).
- Mood [ASPIRACIONAL]: o som mais reconfortante do jogo; recompensa por subtração do frio.

### Ficha 4 - Câmara do Guardião (id: cena_guardiao)
- Resumo [DESIGN]: andar de chefe; o Guardião da Brasa apagada; clímax do slice; vencê-lo
  e reavivar a Brasa fecha o jogo.
- Leitmotif: Tema do Guardião (sonoridade-peso) na luta; Tema da Brasa pleno com 3a MAIOR
  na reavivação (única vez no jogo).
- Instrumentação/mood [ASPIRACIONAL]: peso e ameaça máxima; sub-bass com batimento, coro
  masculino grave processado, percussão de pedra/osso lenta; depois, triunfo quente por
  contraste após quase silêncio.
- Adaptativo [NORMATIVO]: horizontal resequencing para a peça do Guardião na entrada (corte
  em ponto musical); ao derrotá-lo, corte para quase silêncio e então resequencing para o
  Tema da Brasa pleno (reavivar a Brasa).
- SFX-chave [NORMATIVO]: stinger e sussurro hostil ao avistar o Guardião; passos pesados de
  pedra/osso; golpes com sub-bass; estalar de corpo que telegrafa ataque; colapso do
  Guardião (desmoronar + poeira) ao morrer; explosão quente de reavivar a Brasa.
- Mood [ASPIRACIONAL]: a morte com vontade esmagando devagar, derrotada pela fagulha; o
  ponto mais quente do jogo encerra o silêncio.

---

## 10. Setup de áudio recomendado para o vertical slice

`[DESIGN]` Foco no laço de uma sala mais a câmara do Guardião, com o número mínimo de
assets de áudio para o slice 5-7 salas rodar.

Música (pacote de stems adaptativos por sala, mesmo BPM/tom, loop, webm-Opus + mp3,
descartado com a sala):
1. `bed_frio` - drone + bowed metal + ar (sempre tocando na penumbra).
2. `tension` - sopro crescente + célula de osso + sussurro (sobe no despertar).
3. `combat` - pulso de pele + percussão de osso + batimento (sobe na luta).
4. `bed_quente` - lira (Tema da Brasa) + pele-coração + crepitar musical + coro em quinta
   (entra por crossfade ao acender o braseiro).
+ Peça do Guardião (resequencing) e Reavivar a Brasa (Tema da Brasa pleno, 3a maior).
+ Stingers: despertar, fagulha pega, avistar Guardião, reavivar a Brasa.

SFX do slice: passos na pedra (Acendedora e esqueletos, com eco); despertar dos esqueletos;
impactos contra osso + ossos caindo; crepitar do braseiro ao acender + loop de crepitar;
porta de pedra arrastando (selar e abrir); ambiente de gotejar + vento do poço; foley vocal
não-verbal da Acendedora; zumbido quente da fagulha; SFX do Guardião (passos, golpes,
colapso).

Voz: nenhuma fala dublada no protótipo (Acendedora muda). Sussurros do passado como leito
vocal processado em pt-BR, legendados; foley vocal não-verbal da Acendedora.

Implementação: Babylon Audio v2; `unlockAsync` no primeiro clique; buses Música/SFX/Voz/
Ambiente; music manager por crossfade logarítmico dirigido pelos eventos do laço de sala no
`eventBus`; listener na câmera; braseiro/porta/fagulha/esqueletos/Guardião espaciais;
streaming para música/ambiente/sussurros; SFX em memória com buffer compartilhado e limite
de instâncias; carga/descarte de áudio acoplados ao gerenciador de salas.

---

## 11. Checklist de aceite (Definition of Done)

`[NORMATIVO]` Derivado deste doc no formato do padrão de detalhe
([`../padrao-de-detalhe.md`](../padrao-de-detalhe.md) seção 4). Cada item recebe sim/não
honesto, verificável por escuta ou inspeção de assets/configuração.

Direção musical e eixo frio-quente (seções 1-2):
- [ ] Orquestração mínima, fria e espaçosa (drone, bowed metal, ar, coro distante) contra
      núcleo quente pequeno (lira, pele-coração, crepitar, coro em quinta); sem orquestra
      sinfônica cheia [DESIGN][NORMATIVO]
- [ ] Eixo frio-quente mapeado a parâmetros mensuráveis (reverb longo->curto, miolo vazio->
      cheio, sem pulso->pulso, ppp distante->mp próximo) e aplicado [DESIGN][NORMATIVO]
- [ ] Base modal menor antiga (eólio/frígio) com harmonia por drones e quintas abertas, sem
      progressões funcionais modernas [DESIGN][NORMATIVO]
- [ ] 3a maior reservada exclusivamente para a reavivação da Brasa (única cor harmônica
      quente do jogo) [DESIGN][NORMATIVO]
- [ ] Três leitmotifs presentes e fragmentáveis: Tema da Brasa (sobe/esquenta), Tema da
      Descida (desce/esfria, transpõe a cada porta), Tema do Guardião (sonoridade-peso)
      [DESIGN][NORMATIVO]
- [ ] Tema da Brasa pleno com 3a maior apenas ao reavivar a Brasa; Tema do Guardião esmaga
      os outros na câmara do chefe [DESIGN][NORMATIVO]

Música por estado de sala (seção 3):
- [ ] Penumbra tensa: `bed_frio` cheio, silêncio com textura, ambiente audível, sem pulso
      [DESIGN][NORMATIVO]
- [ ] Despertar: stinger + `tension` sobem sincronizados ao frame do despertar
      [DESIGN][NORMATIVO]
- [ ] Combate: pulso e percussão prioritários, sem grande melodia; recua ao limpar a sala
      [DESIGN][NORMATIVO]
- [ ] Acender o braseiro: crossfade `bed_frio`->`bed_quente` + stinger de fagulha, reverb
      encurta, frio recua na mixagem [DESIGN][NORMATIVO]
- [ ] Câmara do Guardião: Tema do Guardião pleno na luta; quase silêncio e Tema da Brasa
      pleno na reavivação (clímax por contraste, não por volume) [DESIGN][NORMATIVO]

Música adaptativa (seção 4):
- [ ] Vertical layering como espinha dorsal: 3-4 stems no mesmo BPM/tom em loop, crossfade
      logarítmico por estado, sem interromper o fluxo [DESIGN][NORMATIVO]
- [ ] Music manager em JS sem middleware, dirigido pelos eventos do laço de sala no
      `eventBus` (entrar/despertar/limpar/acender/sair) [DESIGN][NORMATIVO]
- [ ] Horizontal resequencing só na entrada do Guardião e na reavivação da Brasa, em ponto
      musical [DESIGN][NORMATIVO]
- [ ] Stems carregam e descartam junto com a sala; nenhum stem de sala inativa em RAM
      [DESIGN][NORMATIVO]

SFX-chave (seção 5):
- [ ] Passos na pedra com eco, 4-6 variações + aleatoriedade; eco maior na penumbra, menor
      com braseiro aceso; Acendedora distinta dos esqueletos [DESIGN][NORMATIVO]
- [ ] Despertar dos esqueletos como hero SFX (osso + raspar de pedra + ar frio + bowed
      metal) sincronizado ao frame e ao stinger [DESIGN][NORMATIVO]
- [ ] Impactos de combate contra osso (estalo seco, não tine metálico de aço) + ossos
      desmoronando na queda [DESIGN][NORMATIVO]
- [ ] Crepitar do braseiro ao acender como hero SFX (ignição + crepitar crescente + calor),
      depois loop espacializado no braseiro [DESIGN][NORMATIVO]
- [ ] Porta de pedra arrastando (selar ao entrar; abrir ao acender), espacializada
      [DESIGN][NORMATIVO]
- [ ] Ambiente de gotejar + vento do poço em loop, sempre presente na penumbra, recuando ao
      acender [DESIGN][NORMATIVO]
- [ ] SFX do Guardião: passos pesados, golpes com sub-bass, telegrafia por estalar, colapso
      com poeira [DESIGN][NORMATIVO]

Voz, silêncio e sussurros (seção 6):
- [ ] Acendedora silenciosa no protótipo (sem dublagem); apenas foley vocal não-verbal
      (esforço, dano, respiração, suspiro de alívio) [DESIGN][NORMATIVO]
- [ ] Sussurros do passado como lore sonora: voz processada e distante, por gatilho, sempre
      legendados, em pt-BR [DESIGN][NORMATIVO]
- [ ] `[A DEFINIR]` de fala plena da Acendedora e falas do Guardião registrados e adiados
      para a versão completa [DESIGN][NORMATIVO]

Mixagem, implementação e orçamento (seção 7):
- [ ] Babylon Audio v2 como principal, buses Música/SFX/Voz/Ambiente; `unlockAsync` no
      primeiro clique [DESIGN][NORMATIVO]
- [ ] Teto de vozes simultâneas respeitado (música 3-4, ambiente 1-2, SFX combate <=6-8,
      voz/sussurros 1-2; total alvo <=16) com pooling e roubo de voz por prioridade
      [DESIGN][NORMATIVO]
- [ ] Formatos webm (Opus) + fallback mp3 para música/ambiente/voz; SFX ogg/webm em
      produção; -16 LUFS; nomeação por estado/evento e personagem/linha [DESIGN][NORMATIVO]
- [ ] 3-4 stems por sala em RAM, descartados com a sala; música/ambiente/sussurros em
      streaming; SFX em memória com buffer compartilhado [DESIGN][NORMATIVO]

Acessibilidade (seção 8):
- [ ] Legendas de SFX-chave opcionais (porta, despertar, braseiro, passos) em pt-BR,
      ligáveis nas opções [DESIGN][NORMATIVO]
- [ ] Sussurros do passado sempre legendados [DESIGN][NORMATIVO]
- [ ] Volume independente por bus nas opções (reusando `platform/settings`)
      [DESIGN][NORMATIVO]

Estilo:
- [ ] Sem travessões, sem emojis em qualquer texto exibido (guia de estilo) [NORMATIVO]
- [ ] Itens [A DEFINIR] resolvidos ou explicitamente adiados com registro [NORMATIVO]

---

## ATUALIZAÇÃO W6 (2026-06-15) - momentos sonoros prioritários

`[DESIGN]` Alvo de áudio da onda W6 (trilha adaptativa já em implementação: `configureMusic`/
`setMusicState` com estados frio/combate/quente). Momentos a cobrir:

- **Stingers:** despertar dos mortos (metálico, sobe 1 semitom), Fagulha pega (lira ascendente),
  avistar o Guardião (grave intimidador), reavivar a Brasa (crescimento dramático).
- **SFX por tipo de inimigo (assinatura de tell):** minion = swish agudo; warrior = swish +
  bronze ao erguer; heavy = THOOM grave; conjurador = assobio frio; espreitador = sopro de dash.
  Essencial porque a sala é escura: a leitura do tell não pode depender só de cor.
- **Cambaleio do Guardião (W3):** som agudo de "cega" + batida grave ao reacender (sinal de
  janela de dano dobrado).
- **Ecos do passado:** voz reverberada (decay ~3,5 s), filtrada (sem graves), legendada no HUD.
