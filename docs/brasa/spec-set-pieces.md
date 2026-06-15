# Spec de Set Pieces (momentos roteirizados da descida)

Os grandes momentos encenados de **Brasa**: o que são, como são disparados, como a Acendedora
(o jogador) participa e o que cada um exige de câmera, luz, áudio e VFX. Set piece aqui é um
evento de alto valor dramático e produção dedicada, distinto do laço comum de sala (entrar,
selar, limpar, acender, sair). Em Brasa, set piece nunca é cutscene cara: é o laço de sala
levado ao pico, com telegrafia e um input da heroína no centro.

O CANON mestre (premissa, loop sala-a-sala, orçamento de performance NORMATIVO) está em
[`../projeto-brasa.md`](../projeto-brasa.md) e prevalece em qualquer conflito; este documento
NÃO o contradiz, apenas detalha os momentos roteirizados. A régua de detalhe e os templates de
ficha e de DoD seguem [`../padrao-de-detalhe.md`](../padrao-de-detalhe.md). A ficção que estes
set pieces encenam está em [`narrativa-e-historia.md`](narrativa-e-historia.md) (atos da
descida, ganchos de lore, identidade do Guardião, finais).

Relacionados: o laço de sala em [`../projeto-brasa.md`](../projeto-brasa.md) 3.1; o gerenciador
de salas com descarte em [`../projeto-brasa.md`](../projeto-brasa.md) 4.1 e 6.2; o chefe em
[`spec-chefe-guardiao.md`](spec-chefe-guardiao.md); a chama, as fagulhas e a dissolução dos
mortos em [`biblia-vfx-e-shaders.md`](biblia-vfx-e-shaders.md); a luz fria vs quente e o regime
de luzes por sala em [`biblia-iluminacao.md`](biblia-iluminacao.md); os SFX da descida e do
fogo em [`biblia-audio.md`](biblia-audio.md); os estados e o save em
[`spec-fluxo-e-persistencia.md`](spec-fluxo-e-persistencia.md); a descida jogável de 5-7 salas
em [`spec-vertical-slice-cripta.md`](spec-vertical-slice-cripta.md).

Convenção (herdada do canon): pt-BR, sem travessões, sem emojis. Procedência
`[DESIGN]`/`[CÓDIGO]`/`[ASSET]`; exigência `[NORMATIVO]`/`[ASPIRACIONAL]`/`[A DEFINIR]`.
Snapshot: 2026-06-14.

---

## 0. Princípios de set piece

1. `[DESIGN]` `[NORMATIVO]` Participação, não só assistir: sempre que possível a Acendedora
   FAZ algo no momento-chave (cruzar a porta, acender o braseiro no tempo certo, reavivar a
   Brasa), em vez de só ver uma cutscene. O input vende o momento. Em Brasa, o gesto recorrente
   e sagrado é ACENDER: a mão que leva a fagulha ao fogo morto.
2. `[DESIGN]` `[NORMATIVO]` O sobrenatural pesa porque é raro e contido. A luz que recua, os
   mortos que despertam e a Brasa que revive são tratados com assombro e parcimônia, nunca como
   "poder do herói" repetível. A única magia da heroína é a fagulha no peito, e ela serve para
   acender, não para destruir (ver tom em [`narrativa-e-historia.md`](narrativa-e-historia.md)
   6).
3. `[DESIGN]` `[NORMATIVO]` Telegrafia e construção: a tensão sobe (áudio, luz que se apaga,
   câmera, ritmo) ANTES do estouro. O silêncio e o escuro súbitos antes do despertar valem mais
   que o estrondo. A assinatura de Brasa é a alternância frio-azul (ameaça) e laranja-quente
   (alívio); o set piece joga com essa gangorra.
4. `[DESIGN]` `[NORMATIVO]` Barato e robusto, porque rodar leve no navegador é o pilar número
   um (canon 2 e 4). Preferir animação roteirizada + luz + partículas modestas + áudio a
   simulação física pesada. Física só onde o caos vende (poucos blocos num desabamento), o
   resto é animado/assado. Nenhum set piece pode estourar o teto de < 60 draw calls por sala
   nem o de 1-2 luzes dinâmicas por sala (canon 4.1, 4.4).
5. `[DESIGN]` `[NORMATIVO]` Violência por elipse e sobriedade: a heroína não "mata monstros",
   faz os mortos do próprio povo dormirem de novo (ver
   [`narrativa-e-historia.md`](narrativa-e-historia.md) 3.3). Os mortos vencidos se DISSOLVEM
   em cinzas/fagulhas (VFX), não sangram; nada gráfico, coerente com o low-poly estilizado e o
   tom de luto.
6. `[DESIGN]` `[NORMATIVO]` Reaproveitar, não inventar custo. Todo set piece se monta com o que
   o motor e os pacotes CC0 já dão: a porta de pedra selável, o braseiro interativo, o kit
   modular KayKit Dungeon, os esqueletos KayKit na FSM existente, e o sistema de luz por sala.
   Set piece é coreografia desses elementos, não asset novo.

---

## 1. Anatomia comum (contrato técnico)

`[DESIGN]` Todo set piece é orquestrado por um gatilho no mundo (volume ou evento de sala) e
roda num estado roteirizado de PLAYING ou num CUTSCENE leve, devolvendo o controle ao fim. Em
Brasa não há motor de narrativa Ink; o disparo é por eventos de sala emitidos pelo gerenciador
de salas e pelo `eventBus` existente (ver [`../projeto-brasa.md`](../projeto-brasa.md) 6.1).

- `[DESIGN]` Disparo: um trigger volume na sala (ex.: pisar no centro), um evento de estado da
  sala (sala_limpa, braseiro_aceso) OU o início/fim de carregamento de sala (porta cruzada).
  Ao terminar, o set piece devolve o controle e marca a flag de progresso correspondente.
- `[DESIGN]` Fases internas tipicamente: (a) construção/telegrafia (luz recua, áudio sobe,
  câmera prepara), (b) input do jogador (a ação-chave: cruzar, acender, reavivar), (c)
  estouro/resolução (despertar, transição de luz, colapso, dissolução), (d) rescaldo e
  devolução do controle (luz estabiliza, HUD volta, save no ponto seguro).
- `[DESIGN]` Câmera: sequência dedicada e curta, com opção de PULAR a construção e o rescaldo,
  exceto a janela de input (a ação-chave nunca é pulável). Reusa
  `engine/camera/thirdPersonCamera` com pontos de mira roteirizados.
- `[DESIGN]` `[NORMATIVO]` Determinismo: o resultado é fixo (a porta sempre sela, os mortos
  sempre despertam, a Brasa sempre revive). Só o desempenho/estilo do jogador varia. Evita
  estado inconsistente no save: salvar SÓ depois, no ponto seguro (porta destravada, braseiro
  aceso), nunca no meio do estouro.
- `[DESIGN]` `[NORMATIVO]` Orçamento: nenhum set piece excede < 60 draw calls por sala nem 1-2
  luzes dinâmicas por sala (canon 4.1, 4.4). Partículas com teto por momento, definido em
  [`biblia-vfx-e-shaders.md`](biblia-vfx-e-shaders.md). A luz é o efeito principal, não a
  partícula: barata e dramática.

`[DESIGN]` Campos sugeridos de uma definição de set piece (dados, não formato final):
```
SetPiece {
  id                      // ex.: "acender_braseiro"
  trigger                 // volume | eventoDeSala (sala_limpa, porta_cruzada, etc.)
  cameraSequence          // id da sequência de câmera (curta, pulável fora do input)
  inputBeat?              // a ação da Acendedora (tipo, janela, tecla/gesto)
  lightCue[]              // transições de luz (fria->quente, recuo, pulso da Brasa)
  vfx[]                   // ids de efeitos (fagulhas, cinzas, poeira, dissolução)
  sfxTimeline[]           // cues sincronizados (selo de pedra, sopro de frio, ignição)
  outcomeFlag             // flag de progresso ao concluir
  skippable: bool         // construção/rescaldo sim; janela de input nunca
}
```

---

## 2. Catálogo de set pieces (na ordem da descida)

`[DESIGN]` Sete set pieces propostos, todos cabendo no slice de 5-7 salas (canon 3.2) e na
leveza técnica. Espelham os atos da descida em
[`narrativa-e-historia.md`](narrativa-e-historia.md) 5 e 8. A procedência é `[DESIGN]` salvo
nota; cada um termina com seu critério de aceite, consolidado na seção 6.

### 2.1 A Descida inicial: a porta que se sela (id: descida_inicial)

- Resumo: a Acendedora cruza a primeira porta de pedra para dentro do poço-cripta; a porta se
  fecha e se sela atrás dela. O ponto sem volta: a partir daqui só se vai para baixo. Encena o
  início do laço do canon (a sala se sela atrás dela) e o beat de abertura do Ato I
  ([`narrativa-e-historia.md`](narrativa-e-historia.md) 5.2).
- Gatilho: cruzar o volume da soleira da primeira câmara (após o vestíbulo/boca do poço, se
  houver, ver [`narrativa-e-historia.md`](narrativa-e-historia.md) 1.2).
- Participação do jogador: a Acendedora ANDA até a soleira e a cruza (input de movimento comum,
  não há QTE). O peso vem da câmera e do som, não de um botão extra. `[A DEFINIR]` se há um
  beat opcional de "soprar/avivar a fagulha no peito" antes de cruzar, como gesto de coragem.
- Construção de tensão: ao se aproximar, a câmera baixa e enquadra a porta de pedra alta; a luz
  morna da boca do poço fica para trás; à frente, só penumbra fria. Áudio: vento da superfície
  some, dá lugar ao silêncio da pedra e a um gotejar distante.
- Estouro/resolução: cruzada a soleira, a porta de pedra desce/gira e se SELA com um baque
  grave (selo de pedra). Por um instante a fagulha no peito da heroína é a única luz em cena.
  Telegrafa toda a regra do jogo num gesto: ela trouxe a luz para dentro do escuro.
- Técnica/orçamento: porta = peça modular KayKit Dungeon com animação assada de fechar
  (keyframes), sem física. Um baque de áudio + leve tremor de câmera. A fagulha já é a luz da
  heroína (ponto de luz quente do canon de personagem). Custo desprezível: 1 animação, 1 SFX,
  0 partícula obrigatória. Pulável: a aproximação sim, o fechar da porta sim; mas o save só
  ocorre depois de selada.
- Critério de aceite: ver 6.2.
- Ver também: [`narrativa-e-historia.md`](narrativa-e-historia.md) 5.2;
  [`biblia-iluminacao.md`](biblia-iluminacao.md) (penumbra de entrada).

### 2.2 O primeiro Despertar dos mortos (id: primeiro_despertar)

- Resumo: na primeira câmara de guarda selada, a luz fria recua mais um palmo e os mortos
  selados DESPERTAM pela primeira vez diante do jogador. É o momento que ensina, pela prática,
  a regra "o escuro abriga os mortos, a luz os contém"
  ([`narrativa-e-historia.md`](narrativa-e-historia.md) 1.4, 3.3).
- Gatilho: evento de sala disparado logo após a porta selar (2.1), com a heroína já dentro.
- Participação do jogador: assiste a telegrafia (curta) e então COMBATE. O despertar é o
  prólogo do primeiro combate; a ação-chave do jogador é sobreviver e limpar a sala usando o
  melee existente (ver [`spec-combate.md`](spec-combate.md)). Não é cutscene passiva: termina
  com o controle nas mãos do jogador no instante em que o primeiro morto se ergue.
- Construção de tensão: a pouca luz fria que havia AFUNDA visivelmente (a luz-chave da sala
  esmaece por 1-2 s), o azul domina, um sopro de frio (SFX) atravessa a câmara. Silêncio. Então
  ossos rangem: as formas dos mortos (esqueletos KayKit, parados como props até aqui) se movem
  e se levantam. Telegrafia clara antes de qualquer ataque: o jogador vê cada um acordar antes
  de ser ameaçado.
- Estouro/resolução: os mortos (os Mansos, 2-4 nesta primeira sala, canon 3.2) ativam a FSM de
  combate e avançam atraídos pela fagulha. O set piece termina e vira combate comum.
- Técnica/orçamento: os esqueletos já estão na sala como instâncias da MESMA malha/esqueleto
  KayKit (canon 4.2, 4.3), iniciados num estado "dormente" (pose de jazigo, animação parada);
  o despertar é só a troca para a animação de levantar + ativação da FSM (reusa
  `defender.ts` -> `skeleton.ts`, canon 6.2). VFX: opcional, um leve pó/fagulha fria ao se
  erguerem. O efeito caro é a LUZ que recua, e isso é só uma curva de intensidade na luz-chave
  (sem luz nova). Pulável: a telegrafia sim; o combate é gameplay, não se pula.
- Critério de aceite: ver 6.3.
- Ver também: [`narrativa-e-historia.md`](narrativa-e-historia.md) 1.4 e 3;
  [`biblia-bestiario.md`](biblia-bestiario.md) (os mortos);
  [`biblia-vfx-e-shaders.md`](biblia-vfx-e-shaders.md) (pó/fagulha do despertar).

### 2.3 Acender o braseiro: do frio ao quente (id: acender_braseiro)

- Resumo: com a câmara limpa, a Acendedora leva a fagulha ao braseiro central; o fogo morto
  pega, a luz da sala vira de azul-frio para laranja-quente, e a porta de saída se destrava. É
  o beat de ALÍVIO recorrente da descida, o gesto sagrado do jogo, e o coração do laço do canon
  (canon 3.1). É o set piece mais repetido (uma vez por andar) e o que dá o ritmo emocional.
- Gatilho: evento sala_limpa habilita a interação de acender no braseiro (prompt de uso).
- Participação do jogador: a ação-chave é ACENDER: o jogador segura/pressiona o input de
  interação junto ao braseiro. `[A DEFINIR]` se há um beat de tempo (segurar até a fagulha
  pegar) ou ignição instantânea; recomendação `[DESIGN]`: um curto segurar (1-1.5 s) com a
  fagulha do peito esticando-se até o fogo, para que o jogador SINTA o gesto. Nunca pulável.
- Construção de tensão: o contraste. Antes de acender, a sala fica em seu ponto mais frio e
  silencioso, com a vitória do combate ainda no ar mas o escuro ainda dono do espaço. O
  prompt de acender brilha discreto no braseiro. A heroína se aproxima; a fagulha no peito
  pulsa mais forte perto do fogo morto (telegrafia de que vai pegar).
- Estouro/resolução: a fagulha toca o braseiro e o fogo PEGA. Em ~1 s a luz quente sobe: a
  luz-chave fria some, a luz quente do braseiro (1-2 luzes dinâmicas, canon 4.4) acende, as
  cores da sala viram laranja, sobe um calor visível (leve distorção/partícula de fagulhas
  subindo). Alívio musical (ver [`biblia-audio.md`](biblia-audio.md)). A porta de saída
  destrava com um clique de pedra. Se a fagulha concede upgrade aqui, a escolha aparece após o
  acender (ver [`spec-progressao-e-economia.md`](spec-progressao-e-economia.md)).
- Técnica/orçamento: a transição fria->quente é LUZ, não partícula: cross-fade de cor e
  intensidade entre a luz-chave fria e a luz quente do braseiro (padrão já usado no projeto,
  ver canon 4.4 e [`biblia-iluminacao.md`](biblia-iluminacao.md)). VFX modesto: um emissor de
  fagulhas/brasas subindo do braseiro (teto baixo de partículas) + leve glow. Sombra desligada
  nas luzes do braseiro (canon 4.4). Este é o efeito mais barato e mais valioso do jogo:
  priorizar polimento aqui. Save: ponto seguro, ocorre após acender (estado estável).
- Critério de aceite: ver 6.4.
- Ver também: canon 3.1 e 4.4; [`biblia-iluminacao.md`](biblia-iluminacao.md) (transição
  fria->quente); [`biblia-vfx-e-shaders.md`](biblia-vfx-e-shaders.md) (fagulhas, glow);
  [`biblia-audio.md`](biblia-audio.md) (alívio); [`narrativa-e-historia.md`](narrativa-e-historia.md)
  7.2 (o braseiro como memória).

### 2.4 A câmara que cede: armadilha ou desabamento (id: camara_cede)

- Resumo: numa câmara funda (cisterna/salão), o peso do tempo e do escuro se manifesta no
  cenário: uma seção de teto/parede DESABA, ou uma armadilha antiga dispara, mudando o espaço
  de combate. É o único set piece de "caos físico" do slice, deliberadamente raro e contido.
  Encena que o poço está velho e engasgado (Ato II,
  [`narrativa-e-historia.md`](narrativa-e-historia.md) 5.3).
- Gatilho: volume no piso da câmara funda, OU evento durante o pico de combate (ex.: ao chegar
  a metade dos mortos limpos), para que o desabamento reconfigure a luta.
- Participação do jogador: ESQUIVAR/SAIR da zona telegrafada a tempo. A ação-chave é
  reposicionar-se (mover, usar a esquiva do combate) antes do estouro; quem fica na marca é
  empurrado/atordoado (dano leve não-letal, coerente com o tom sem gore). Após o desabamento, o
  espaço muda (entulho vira cobertura ou bloqueia uma rota), e o combate continua sobre o novo
  layout.
- Construção de tensão: telegrafia inequívoca ANTES do estouro: poeira fina cai do teto na
  zona afetada, um rangido grave de pedra sob pressão, rachaduras que aparecem (decal/textura),
  a luz tremula. Um beat de silêncio. Só então cede. O jogador sempre tem tempo de ler e sair.
- Estouro/resolução: a seção desaba. A maioria das peças cai por animação assada de queda
  (keyframes); POUCOS blocos (3-5) caem com física Havok (impulso) para o caos crível, dentro
  do orçamento de física da sala (canon 4.4). Nuvem de poeira (partículas) cobre o miolo e
  esconde a transição animado<->físico. Rescaldo: poeira assenta, a luz se estabiliza, o
  entulho fica como geometria estática (colisor de caixa).
- Técnica/orçamento: peças modulares KayKit pré-posicionadas para a queda; só 3-5 corpos
  físicos, descartados quando assentam (viram estáticos) para não pesar o resto da sala.
  Poeira = um emissor com teto baixo. Sem nova luz dinâmica: usar as que a sala já tem,
  tremulando. Pulável: a telegrafia NÃO (é gameplay, o jogador precisa reagir); a câmera não
  tira o controle. `[A DEFINIR]` se este set piece é fixo numa sala específica do slice ou um
  módulo reutilizável que pode aparecer em mais de uma câmara funda; recomendação `[DESIGN]`:
  um por slice, fixo, para preservar a raridade e o orçamento.
- Critério de aceite: ver 6.5.
- Ver também: canon 4.4 (física por sala); [`biblia-ambientes.md`](biblia-ambientes.md) (kit
  modular, cisterna/salão); [`biblia-vfx-e-shaders.md`](biblia-vfx-e-shaders.md) (poeira).

### 2.5 O Encontro com o Guardião: entrada na arena (id: encontro_guardiao)

- Resumo: a Acendedora cruza para a Câmara da Brasa e encontra o Guardião pela primeira vez. É
  a entrada na arena do chefe: a apresentação que estabelece a ameaça e a revelação (o Guardião
  é uma Acendedora anterior, ver [`narrativa-e-historia.md`](narrativa-e-historia.md) 5.4). O
  set piece é a "abertura solene" antes do duelo, não o duelo (esse está em
  [`spec-chefe-guardiao.md`](spec-chefe-guardiao.md)).
- Gatilho: cruzar a porta de pedra para a câmara final (porta_cruzada do andar do chefe).
- Participação do jogador: AVANÇA pela câmara até o Guardião (movimento), e a câmera revela a
  Brasa moribunda ao fundo e a figura do Guardião diante dela. `[A DEFINIR]` se há um beat de
  input (a heroída reconhece o manto/fagulha do Guardião como o de uma Acendedora, talvez a
  amada perdida, ver [`narrativa-e-historia.md`](narrativa-e-historia.md) 4.2); recomendação
  `[DESIGN]`: um único momento de aproximação roteirizada (controle reduzido, não removido) em
  que a revelação se ENCENA (não opcional, conforme
  [`narrativa-e-historia.md`](narrativa-e-historia.md) 7.4), sem fala longa: a leitura é
  visual (a fagulha apagada no peito do Guardião, o manto igual ao da heroína).
- Construção de tensão: a câmara é a mais fria e a mais alta do poço; ao fundo, a Brasa arde
  baixa, quase morta (a primeira vez que o jogador a vê). O Guardião está imóvel diante dela,
  de costas ou de joelhos. Áudio: o leitmotif do Guardião entra grave e triste, não heroico
  (ver [`biblia-audio.md`](biblia-audio.md)). Silêncio antes de ele se levantar e virar.
- Estouro/resolução: o Guardião se ergue, a silhueta e a cor (leitura de fase por
  silhueta/cor, canon 4.2) se revelam, e ao terminar a entrada o controle volta pleno e começa
  a Fase 1 do duelo (handoff para [`spec-chefe-guardiao.md`](spec-chefe-guardiao.md)).
- Técnica/orçamento: Guardião = malha KayKit (variante de esqueleto, 3k-6k tris, canon 4.2),
  iniciado em pose de prostração e animado para se levantar. A Brasa ao fundo é o foco de luz
  quente (1 luz dinâmica) num mar de azul-frio: contraste máximo da assinatura visual. VFX
  contido: fagulhas fracas subindo da Brasa moribunda. Câmera roteirizada curta, pulável até o
  instante em que o controle volta; o início do duelo nunca é pulável. Save: imediatamente ao
  entrar na arena (antes do duelo), para não repetir a entrada em cada tentativa do chefe.
- Critério de aceite: ver 6.6.
- Ver também: [`spec-chefe-guardiao.md`](spec-chefe-guardiao.md);
  [`narrativa-e-historia.md`](narrativa-e-historia.md) 5.4 (identidade do Guardião);
  [`biblia-iluminacao.md`](biblia-iluminacao.md) (a Brasa moribunda).

### 2.6 O Reavivar da Brasa: clímax e desfecho (id: reavivar_brasa)

- Resumo: vencido/rendido o Guardião, a Acendedora alcança a Brasa primordial e a REAVIVA. É o
  clímax e o fim do vertical slice (canon 3.1: "ao vencê-lo e acender a Brasa, fecha o slice").
  O gesto sagrado do jogo (acender) em sua escala máxima: não um braseiro de andar, mas a
  Primeira Chama. O desfecho encena o final escolhido (proposta de slice: o Sacrifício, ver
  [`narrativa-e-historia.md`](narrativa-e-historia.md) 5.5).
- Gatilho: derrota/rendição do Guardião (evento de fim de duelo vindo de
  [`spec-chefe-guardiao.md`](spec-chefe-guardiao.md)).
- Participação do jogador: a ação-chave é REAVIVAR: a heroína se aproxima da Brasa moribunda e
  dá a fagulha (input de interação, como acender um braseiro, mas estendido e final). Nunca
  pulável: o jogador realiza o gesto que define o jogo. `[A DEFINIR]` se a escolha de final (dar
  a fagulha = Sacrifício vs recuar = Recusa, ver
  [`narrativa-e-historia.md`](narrativa-e-historia.md) 5.5) é apresentada aqui como decisão do
  jogador; recomendação `[DESIGN]`: no slice, só o Sacrifício, sem ramificação (um único gesto);
  registrar a escolha como aspiracional pós-slice.
- Construção de tensão: após o duelo, silêncio e a câmara em seu ponto mais frio e vazio. A
  Brasa pulsa fraca, quase apagada. O Guardião (caído/rendido) e a heroína são as únicas
  presenças. A fagulha no peito dela pulsa em resposta à Brasa. Tudo conduz ao gesto.
- Estouro/resolução: a heroína entrega a fagulha; a Brasa REVIVE. Da chama baixa sobe luz
  quente que toma a câmara inteira e (encenado, não simulado) sobe pelo poço: a assinatura
  frio->quente na sua maior escala. Calor, fagulhas, o leitmotif da Brasa em plenitude (ver
  [`biblia-audio.md`](biblia-audio.md)). No Sacrifício, a heroína se entrega à chama (por
  elipse: a câmera afasta/clareia, nada gráfico) e a luz preenche a tela. Cartela final/título.
  Rescaldo: fecha o slice (estado de fim, ver
  [`spec-fluxo-e-persistencia.md`](spec-fluxo-e-persistencia.md)).
- Técnica/orçamento: o efeito é LUZ e cor levadas ao máximo dentro do orçamento: a luz quente
  da Brasa sobe em intensidade e raio, o grading vira quente, fagulhas em maior volume (mas com
  teto, e por ser o clímax único pode-se gastar o pico de partículas aqui). Sem simulação:
  o "subir a luz pelo poço" é um efeito de câmera/glow/cartela, não geometria nova. A elipse do
  sacrifício é clareamento de tela, custo zero. Save: o fim grava a conclusão do slice. Pulável:
  o rescaldo/cartela sim; o gesto de reavivar não.
- Critério de aceite: ver 6.7.
- Ver também: canon 3.1; [`narrativa-e-historia.md`](narrativa-e-historia.md) 5.4 e 5.5;
  [`biblia-iluminacao.md`](biblia-iluminacao.md) (a Brasa em plenitude);
  [`biblia-audio.md`](biblia-audio.md) (leitmotif da Brasa);
  [`spec-fluxo-e-persistencia.md`](spec-fluxo-e-persistencia.md) (estado de fim).

### 2.7 Ecos das Acendedoras passadas: lore ambiental ativada (id: ecos_acendedoras)

- Resumo: não um momento único, mas um TIPO de micro set piece roteirizado, espalhado pela
  descida: ao se aproximar de um gancho de lore (inscrição, braseiro-memória, restos de uma
  Acendedora anterior), um eco breve se ativa, contando o passado sem cutscene. Materializa os
  ganchos ambientais do canon de narrativa
  ([`narrativa-e-historia.md`](narrativa-e-historia.md) 7) como pequenos eventos vivos, não só
  props parados.
- Gatilho: volume de proximidade junto ao gancho (inscrição na parede, braseiro apagado há
  séculos, ossada de guardiã, manto de uma Acendedora anterior).
- Participação do jogador: OPCIONAL e leve. Aproximar-se ativa o eco; o jogador pode ler/ouvir
  ou seguir. A ação-chave, quando há, é olhar/interagir (ex.: a luz da fagulha REVELA uma
  inscrição gasta que estava escura, ou ao passar perto de um braseiro-memória ele solta uma
  última fagulha). Nunca obrigatório (exceto a revelação do Guardião, que é encenada no clímax
  em 2.5, não aqui).
- Construção de tensão: contida e íntima, não de susto. Um sussurro de áudio (eco de voz, sem
  fala plena), a luz da fagulha que ilumina o que estava no escuro, uma fagulha que sobe sozinha
  de uma cinza fria. O assombro é melancólico (alguém esteve aqui antes e falhou), não horror.
- Estouro/resolução: o eco se mostra (a inscrição se lê, o resto se revela, a fagulha-memória
  sobe e some) e a câmara volta ao normal. Pode plantar o luto da protagonista (os restos de
  uma Acendedora anterior, [`narrativa-e-historia.md`](narrativa-e-historia.md) 4.2 e 7.3).
- Técnica/orçamento: o mais barato de todos. Reusa props do KayKit Dungeon já na sala
  (inscrição = decal/textura, braseiro/ossada = props existentes); o "eco" é um trigger que
  dispara um cue de áudio + uma micro-mudança de luz (a fagulha revelando) + no máximo uma
  fagulha de partícula. Sem câmera tomada do jogador (ou tomada brevíssima e pulável). Sem novo
  asset, sem física, sem luz nova. `[A DEFINIR]` quantos ecos por andar e quais plantam luto vs
  só lore; recomendação `[DESIGN]`: ao menos um por andar, todos opcionais (alinha com
  [`narrativa-e-historia.md`](narrativa-e-historia.md) 7.4).
- Critério de aceite: ver 6.8.
- Ver também: [`narrativa-e-historia.md`](narrativa-e-historia.md) 7 e 8 (ganchos por andar);
  [`biblia-ambientes.md`](biblia-ambientes.md) (inscrições, props);
  [`biblia-audio.md`](biblia-audio.md) (ecos/sussurros).

---

## 3. Tabela-síntese (set piece por andar do slice)

`[DESIGN]` Amarra cada set piece à camada do poço e ao tipo de sala do canon, espelhando a
espinha narrativa de [`narrativa-e-historia.md`](narrativa-e-historia.md) 8. Ajustar à
contagem final de 5 vs 7 salas (`[A DEFINIR]`, canon 3.2).

| # | Camada | Tipo de sala (canon 3.2) | Set piece principal | Recorrente |
|---|---|---|---|---|
| 1 | Boca/Cima | Vestíbulo + Câmara de guarda | Descida inicial (2.1) + Primeiro despertar (2.2) | Acender braseiro (2.3) |
| 2 | Cima | Corredor/antecâmara | Eco das Acendedoras (2.7, braseiro/ossada) | (sem braseiro ou pequeno) |
| 3 | Funda | Cisterna/salão | A câmara que cede (2.4) | Acender braseiro (2.3) |
| 4 | Funda | Santuário do braseiro | Acender braseiro com upgrade (2.3, marcado) | Eco (2.7, inscrição) |
| 5 | Funda/Origem | Salão + pré-chefe opcional | Eco forte (2.7, restos de Acendedora; luto) | Acender braseiro (2.3) |
| 6 | Origem | Câmaras da Origem | Ecos (2.7, forja da fagulha, túmulos) | Acender braseiro (2.3) |
| 7 | Brasa | Câmara do Guardião | Encontro com o Guardião (2.5) + Reavivar a Brasa (2.6) | (clímax, sem braseiro comum) |

`[DESIGN]` O ACENDER (2.3) e o ECO (2.7) são os dois set pieces recorrentes que dão ritmo;
descida, despertar, desabamento, encontro e reavivar são pontuais. Validar a fusão/divisão de
andares conforme o canon fechar 5 vs 7 salas.

---

## 4. Recorte do vertical slice

`[DESIGN]` `[NORMATIVO]` Os sete set pieces foram escritos para CABER no vertical slice (canon
3.1, [`spec-vertical-slice-cripta.md`](spec-vertical-slice-cripta.md)), não para um jogo
inflado. Prioridade de implementação:

1. **Acender o braseiro (2.3)** primeiro: é o coração do laço (canon 3.1) e o molde de
   telegrafia->input->transição de luz->rescaldo que os outros reaproveitam. Validar a receita
   aqui.
2. **Descida inicial (2.1)** e **Primeiro despertar (2.2)**: abrem o slice e ensinam a regra;
   baratos, reaproveitam porta selável e esqueletos dormentes.
3. **Encontro com o Guardião (2.5)** e **Reavivar a Brasa (2.6)**: fecham o slice; dependem do
   chefe ([`spec-chefe-guardiao.md`](spec-chefe-guardiao.md)) estar de pé.
4. **Ecos (2.7)**: contínuos, baratos, entram conforme as salas ganham lore.
5. **A câmara que cede (2.4)**: o mais caro (física), entra por último e UM por slice, para
   preservar raridade e orçamento; cortável se o orçamento apertar.

`[DESIGN]` Recomendação: a "receita" de set piece de Brasa (telegrafia por luz/áudio -> input
de acender/cruzar/esquivar -> estouro por LUZ + partícula modesta -> rescaldo e save) deve ser
validada no Acender (2.3); ela vira o molde de todos os demais, exatamente como o laço de sala
é a unidade do jogo.

---

## 5. Pendências (consolidado dos [A DEFINIR])

`[DESIGN]` Reunidas para decisão de uma vez:
1. Beat opcional de "avivar a fagulha" antes de cruzar a primeira porta (2.1).
2. Acender o braseiro: segurar com tempo (recomendado) vs ignição instantânea (2.3).
3. A câmara que cede: fixa numa sala vs módulo reutilizável (recomendado: fixa, uma por slice)
   (2.4).
4. Encontro com o Guardião: formato do beat de reconhecimento/revelação (2.5).
5. Reavivar a Brasa: escolha de final apresentada ao jogador vs gesto único do Sacrifício
   (recomendado: gesto único no slice) (2.6).
6. Ecos: quantos por andar e quais plantam luto vs só lore (recomendado: ao menos um por andar,
   opcionais) (2.7).
7. Parâmetros finos de cada VFX (fagulhas, cinzas, poeira, dissolução dos mortos), a fechar em
   [`biblia-vfx-e-shaders.md`](biblia-vfx-e-shaders.md).
8. Orçamento medido por set piece (partículas, luzes, blocos físicos) no dispositivo alvo,
   assim que houver build jogável (canon 4).

---

## 6. Critérios de aceite

### 6.1 Transversais (valem para todo set piece, das seções 0 e 1)

`[NORMATIVO]` Cada item recebe sim/não honesto.

- [ ] Na janela de input, a Acendedora FAZ a ação-chave (cruzar, acender, esquivar, reavivar) e
      essa janela NÃO é pulável [DESIGN][NORMATIVO]
- [ ] A construção de tensão (luz que recua, áudio, câmera, ritmo) precede o estouro, com beat
      de silêncio/escuro antes do clímax [DESIGN][NORMATIVO]
- [ ] Disparo por trigger volume ou evento de sala (sala_limpa, porta_cruzada, etc.), com
      devolução do controle e flag de progresso ao concluir [DESIGN][NORMATIVO]
- [ ] Fases internas presentes: construção/telegrafia, input do jogador, estouro/resolução,
      rescaldo e devolução do controle [DESIGN][NORMATIVO]
- [ ] Câmera com sequência dedicada e opção de PULAR, exceto na janela de input [DESIGN][NORMATIVO]
- [ ] Resultado determinístico (o desfecho é fixo); salvar SÓ depois, no ponto seguro [DESIGN][NORMATIVO]
- [ ] Dentro do orçamento: < 60 draw calls e 1-2 luzes dinâmicas por sala; partículas dentro do
      teto da bíblia de VFX (canon 4.1, 4.4) [DESIGN][NORMATIVO]
- [ ] O efeito principal é a LUZ (transição fria<->quente), não a partícula pesada nem a
      simulação física [DESIGN][NORMATIVO]
- [ ] Roda a 60 fps em desktop médio e 30 fps em mobile médio durante o set piece (canon 4.1)
      [DESIGN][NORMATIVO]
- [ ] Violência por elipse e sobriedade: mortos vencidos se dissolvem em cinzas/fagulhas, sem
      gore (canon, [`narrativa-e-historia.md`](narrativa-e-historia.md) 3.3) [DESIGN][NORMATIVO]
- [ ] Sobrenatural tratado com parcimônia e assombro; nenhum vira habilidade repetível, a única
      "magia" é a fagulha que acende [DESIGN][NORMATIVO]
- [ ] Montado só com motor e assets CC0 existentes (porta selável, braseiro, kit modular
      KayKit, esqueletos na FSM, luz por sala); sem asset novo só para o set piece [DESIGN][NORMATIVO]

### 6.2 A Descida inicial (2.1)
- [ ] A Acendedora cruza a primeira porta de pedra e ela se SELA atrás, com baque grave [DESIGN][NORMATIVO]
- [ ] A luz morna da boca fica para trás; à frente penumbra fria; a fagulha do peito é a única
      luz quente por um instante [DESIGN][NORMATIVO]
- [ ] Porta = peça modular KayKit com animação assada de fechar, sem física [DESIGN][ASSET][NORMATIVO]
- [ ] Save só ocorre depois de selada [DESIGN][NORMATIVO]

### 6.3 O primeiro Despertar (2.2)
- [ ] A luz fria recua visivelmente (curva de intensidade na luz-chave, sem luz nova) antes do
      despertar [DESIGN][NORMATIVO]
- [ ] Os mortos (os Mansos, 2-4) iniciam dormentes (pose de jazigo) e se erguem para a animação
      de levantar, então ativam a FSM de combate [DESIGN][ASSET][NORMATIVO]
- [ ] O jogador vê cada morto despertar (telegrafia) antes de ser atacado [DESIGN][NORMATIVO]
- [ ] Esqueletos são instâncias da MESMA malha/esqueleto KayKit (canon 4.2, 4.3) [ASSET][NORMATIVO]
- [ ] Encadeia no combate comum ao terminar a telegrafia [DESIGN][NORMATIVO]

### 6.4 Acender o braseiro (2.3)
- [ ] A ação-chave é ACENDER (input de interação), com a câmara limpa, e não é pulável [DESIGN][NORMATIVO]
- [ ] Transição de luz fria->quente por cross-fade de luz (luz-chave fria some, luz quente do
      braseiro acende), não por partícula nem simulação [DESIGN][NORMATIVO]
- [ ] Acender DESTRAVA a porta de saída (fecha o laço do canon 3.1) [DESIGN][NORMATIVO]
- [ ] VFX modesto: fagulhas/brasas subindo + leve glow, dentro do teto de partículas; sombra
      desligada nas luzes do braseiro (canon 4.4) [DESIGN][NORMATIVO]
- [ ] Beat de alívio sonoro acompanha o acender (ver [`biblia-audio.md`](biblia-audio.md)) [DESIGN][NORMATIVO]
- [ ] Save no ponto seguro após acender [DESIGN][NORMATIVO]

### 6.5 A câmara que cede (2.4)
- [ ] Telegrafia inequívoca antes do estouro: poeira do teto, rangido de pedra, rachaduras,
      tremular de luz, beat de silêncio [DESIGN][NORMATIVO]
- [ ] O jogador tem tempo de esquivar/sair da zona telegrafada; quem fica leva dano leve
      não-letal (sem gore) [DESIGN][NORMATIVO]
- [ ] Maioria das peças cai por animação assada; só 3-5 blocos com física Havok (impulso),
      dentro do orçamento de física por sala (canon 4.4) [DESIGN][NORMATIVO]
- [ ] Nuvem de poeira cobre o miolo e esconde a transição animado<->físico [DESIGN][NORMATIVO]
- [ ] Os blocos físicos viram estáticos (colisor de caixa) ao assentar, para não pesar o resto
      do combate [DESIGN][NORMATIVO]
- [ ] No máximo UM set piece de desabamento no slice [DESIGN][NORMATIVO]

### 6.6 O Encontro com o Guardião (2.5)
- [ ] Ao cruzar a porta da câmara final, a câmera revela a Brasa moribunda ao fundo e o Guardião
      diante dela [DESIGN][NORMATIVO]
- [ ] A revelação de que o Guardião é uma Acendedora anterior é ENCENADA (não opcional), por
      leitura visual (manto igual, fagulha apagada no peito) [DESIGN][NORMATIVO]
- [ ] Guardião = malha KayKit (3k-6k tris, leitura por silhueta/cor, canon 4.2), iniciado em
      pose de prostração e animado para se levantar [ASSET][NORMATIVO]
- [ ] Contraste máximo da assinatura: Brasa quente ao fundo (1 luz dinâmica) num mar de
      azul-frio [DESIGN][NORMATIVO]
- [ ] Ao terminar a entrada, handoff para a Fase 1 do duelo
      ([`spec-chefe-guardiao.md`](spec-chefe-guardiao.md)); save ao entrar na arena, antes do
      duelo [DESIGN][NORMATIVO]

### 6.7 O Reavivar da Brasa (2.6)
- [ ] A ação-chave é REAVIVAR (entregar a fagulha à Brasa), não pulável, fechando o slice
      (canon 3.1) [DESIGN][NORMATIVO]
- [ ] A Brasa revive e a luz quente toma a câmara; assinatura frio->quente em sua maior escala,
      por luz/cor/grading (não simulação nem geometria nova) [DESIGN][NORMATIVO]
- [ ] O Sacrifício (final do slice) é encenado por elipse (clareamento de tela), nada gráfico
      ([`narrativa-e-historia.md`](narrativa-e-historia.md) 5.5) [DESIGN][NORMATIVO]
- [ ] Pode-se gastar o pico de partículas aqui (clímax único), ainda dentro do fps alvo [DESIGN][NORMATIVO]
- [ ] O fim grava a conclusão do slice (estado de fim, ver
      [`spec-fluxo-e-persistencia.md`](spec-fluxo-e-persistencia.md)) [DESIGN][NORMATIVO]

### 6.8 Ecos das Acendedoras passadas (2.7)
- [ ] Ativado por proximidade de um gancho de lore (inscrição, braseiro-memória, restos de
      Acendedora) [DESIGN][NORMATIVO]
- [ ] Opcional e leve: nunca tira o controle do jogador por mais que um instante pulável (a
      revelação obrigatória do Guardião está em 2.5, não aqui) [DESIGN][NORMATIVO]
- [ ] Reusa props/decals KayKit já na sala; o eco é cue de áudio + micro-mudança de luz + no
      máximo uma fagulha; sem asset, física ou luz nova [DESIGN][ASSET][NORMATIVO]
- [ ] Tom melancólico e contido (sussurro, luz que revela), não horror de susto [DESIGN][ASPIRACIONAL]
- [ ] Ao menos um eco por andar do slice ([`narrativa-e-historia.md`](narrativa-e-historia.md)
      7.4) [DESIGN][NORMATIVO]

### 6.9 Gerais
- [ ] Nenhuma narrativa, nome, prop ou referência de Josué/bíblica aparece em qualquer set
      piece (Êxodo, conquista, arca, Jericó, Gilgal, etc.) [DESIGN][NORMATIVO]
- [ ] Sem travessões, sem emojis em qualquer texto exibido (guia de estilo 1.2) [NORMATIVO]
- [ ] Itens [A DEFINIR] (seção 5) resolvidos com o autor ou explicitamente adiados com registro
      antes de entrarem em produção [NORMATIVO]
- [ ] Orçamento de performance por set piece medido no dispositivo alvo
      [A DEFINIR: medir assim que houver build jogável (canon 4)]
