# Spec de Exploração: Portas, Antecâmaras e Segredos

Status: PROPOSTA de design (nada implementado). Marcações: `[NORMATIVO]` entra no aceite,
`[ASPIRACIONAL]` intenção, `[A DEFINIR]` depende de decisão do usuário ou de playtest.
Procedência: `[CÓDIGO]` observado em `prototipo/src`, `[DESIGN]` decisão nossa.
Índice, ordem de implementação, riscos e glossário: [`spec-exploracao-indice.md`](spec-exploracao-indice.md).
Sistemas irmãos: [`spec-exploracao-livros-e-sabedoria.md`](spec-exploracao-livros-e-sabedoria.md),
[`spec-exploracao-pocoes-e-bancada.md`](spec-exploracao-pocoes-e-bancada.md),
[`spec-exploracao-cenario-vivo.md`](spec-exploracao-cenario-vivo.md).

## 0. O fluxo real de hoje (e onde os docs divergem)

`[CÓDIGO]` Em `app/main.ts` (W8) a descida funciona assim, e é isto que esta spec estende:

1. `enterRoom(i)` monta o andar `i` de `DESCENT` (7 entradas, índices 0-6), emite `crypt:floor`
   (sem nenhum ouvinte no código hoje), mostra `ECHOES[i]` e acorda os mortos.
2. Limpar a câmara (`roomCleared`, bônus `CLEAR_BONUS` = 6 Fagulhas) libera o relicário.
3. Tocar o relicário colhe a estilha de Brasa (`fragmentTaken`, `fragments += 1`) e abre o
   alçapão (`passageOpen`, `room.setCleared(true)`). Não existe braseiro aceso por andar.
4. Pisar no alçapão (`room.exit`, raio 2,6) chama `advance()`: fade, cura 40% da vida
   (`brazierHealFrac`), tela "Acender o braseiro" (banca de poções + 1 dádiva), `enterRoom(i+1)`,
   autosave (checkpoint = chegada ao andar novo).

`[DESIGN]` Divergência registrada: `game-design-e-sistemas.md` (seção 5) e
`spec-vertical-slice-cripta.md` ainda descrevem "acender o braseiro em cada sala". O código e o
canon fechado (`narrativa-e-historia.md` seção 0, estilhas) já são o fluxo acima. Esta spec
usa o fluxo do código. Os docs antigos devem ser atualizados no mesmo PR que implementar a
Etapa P1.

## 1. Objetivo de jogador

"Eu escolho o que esta descida vai me dar, lendo sinais do mundo, e sinto que a cripta tem
cantos que valem ser explorados." Três sensações, nesta ordem: (a) decidir com informação
(Hades), (b) descobrir sem aviso de menu (Dark Souls, Hollow Knight), (c) arriscar por
vontade própria (Darkest Dungeon, Slay the Spire).

## 2. Modelo: andares fixos, antecâmaras laterais

`[NORMATIVO]` Os 7 andares do canon não mudam: mesma ordem, mesma planta (`pickLayout` por
índice), mesmo tema (`themeFor` por índice), mesmo eco e mesma inscrição (um beat de revelação
por andar). A exploração entra como **antecâmaras**: salas pequenas, sem combate de andar,
sem índice de andar, sem beat. O canon "descida de 7 salas" continua verdadeiro: antecâmara
é um corredor entre o andar `i` e o andar `i+1`, não um oitavo andar.

Vocabulário (ids sem acento, nomes de exibição com acento; ver glossário no índice):

| Id | Nome | O que é |
|---|---|---|
| `alcapao_brasa` | Alçapão da Brasa | a saída que existe hoje; leva à tela do braseiro |
| `estante` | Estante | antecâmara de livros (ver spec de livros) |
| `bancada` | Bancada | antecâmara de preparo de remédios (ver spec de poções) |
| `esquecida` | Câmara Esquecida | antecâmara secreta, aditiva, com preço |

`[NORMATIVO]` Tipos novos entram como `NodeKind = "estante" | "bancada" | "esquecida"`, campo
novo e opcional em `RoomDef` (`node`, mais `fromIndex` = andar de origem). **Não** estender
`RoomKind` (ele manda no dressing visual e é consumido por `cryptFloor.ts` e `cryptRoom.ts`
em vários `if (kind === ...)`). `pickLayout(def)` e `themeFor(...)` passam a usar
`def.fromIndex ?? def.index` para o tema (a antecâmara herda a rocha do andar de onde veio) e
uma chave própria de planta quando `def.node` existe.

## 3. Regras das saídas

`[NORMATIVO]`

- **R1 Uma condição de abertura.** Todas as saídas do andar se abrem juntas, quando a estilha
  é colhida (a mesma condição de `passageOpen` hoje). A estilha é sempre colhida ANTES de
  escolher a rota, então "reunir as estilhas" vale em qualquer caminho.
- **R2 Plano de rota por semente.** `planRoute(runSeed)` (função pura) devolve, por transição,
  a lista de saídas. Transição T0 (andar 1 para 2): só o alçapão (ensina a tela do braseiro).
  T1 a T5: alçapão + 1 porta lateral (`estante` ou `bancada`). Restrições: não repetir o tipo
  em transições consecutivas; cada tipo aparece pelo menos 1 vez e no máximo 3 vezes nas 5
  transições. A mesma semente dá o mesmo plano (retomar não embaralha, como o jitter de
  inimigos em `enterRoom`).
- **R3 Prévia honesta.** Cada saída mostra um ícone e, ao chegar a 6 m, o nome e a promessa
  em uma linha ("Estante: leia um livro, ganhe Sabedoria"). Nada é surpresa; o risco só existe
  onde está escrito (Câmara Esquecida, Livro Proibido).
- **R4 Compromisso com folga.** Entrar na saída exige permanecer 0,6 s dentro do gatilho
  (anel que enche, no estilo do `channelBar`); sair do raio cancela. As duas saídas ficam a
  pelo menos 9 m uma da outra, para ninguém entrar numa porta por acidente durante a esquiva.
- **R5 Exclusividade.** A porta lateral **substitui** a tela do braseiro daquela transição.
  O recurso escasso é a visita ao braseiro (6 por descida), não a Fagulha (ver seção 4).
  Alçapão da Brasa: cura 40%, banca, 1 dádiva (inalterado). Antecâmara: a recompensa do nó,
  cura própria (25% na Estante, 20% mais fechar Feridas na Bancada) e uma escada para o andar
  `i+1`. Nunca as duas.
- **R6 Antecâmara é transação.** Sem inimigos (exceto a emboscada opcional do Livro Proibido e
  da Câmara Esquecida), sem eco de andar, sem `crypt:floor`, sem stinger de despertar. Emite o
  evento novo `crypt:node` `{ node, fromIndex }`. Selada atrás de quem entra (canon).
- **R7 Retomada.** O autosave de 30 s, o de fechar a aba e o de sair para o título gravam o
  nó atual. Ao retomar, o jogo entra de novo na antecâmara (conteúdo determinístico pela
  semente, itens já consumidos não voltam), nunca no andar de origem com os mortos de volta.
- **R8 Derrota na antecâmara.** `retryFloor` reinicia o nó, com a recompensa já entregue e
  a emboscada removida (perdoador), nunca o andar de origem.

### 3.1 Onde ficam as portas

`[CÓDIGO]` Hoje `rect()` em `cryptLayouts.ts` abre vão só na parede sul (entrada) e o
colisor das paredes é uma caixa contínua por lado. A câmera alta orbital deixa a parede
oeste (`-HALFX`) vazia de propósito (ver `clusterAlchemy`).

`[DESIGN]` Porta lateral: parede **leste** (`+halfX`), perto do fundo (`z = halfZ - 9`), peça
`wall_gate_door` do kit (já na lista `PIECES`). O gatilho é um raio de 1,8 m dentro da parede,
como o do alçapão (`tryDescend` já mede distância), então o colisor contínuo não precisa de
vão. `Layout` ganha `doors: DoorSpot[]` com `{x, z, rotY, slot}`; um segundo slot (parede
norte, `x = -(halfX - 4)`) fica reservado para uma terceira saída futura. Alçapão em
`Layout.exit`, como hoje; a distância entre os dois é verificada em teste (R4).

### 3.2 Segredos: plano do chão, não parede

`[DESIGN]` Vista de cima a parede quase não se lê. Os sinais ficam no plano do chão:

1. **Laje rachada**: decalque de baixo contraste com fresta de brilho quente.
2. **Corrente de ar**: a poeira da atmosfera deriva em direção à laje e as chamas de vela
   próximas se inclinam para ela (a "pista do vento", barata: 1 vetor de vento na partícula
   existente).
3. **Som**: assobio baixo e espacial a menos de 6 m, com legenda "[vento sob a pedra]".
4. **Inscrição da Cartógrafa** ("O mapa é a pedra.", voz do passado já no canon) a menos de 4 m.

Revelação: **golpe pesado** na laje (reuso do caminho de `StrikeProp`, kind `"break"`; o
`combatDirector` ganha um filtro opcional `minHeavy`). A laje cede, aparece o alçapão secreto
(ícone `eye` ao revelar). Pisar nele leva à **Câmara Esquecida**.

Câmara Esquecida (`esquecida`): `[NORMATIVO]` **aditiva** e com preço. Dentro, 1 recompensa
fixa por câmara (ver abaixo) guardada por uma "Vigília": ao pegar o prêmio, 2 mortos acordam
(composição do andar de origem, 50% do roster, sem arqueiro). A saída da câmara leva à tela
normal do braseiro daquela transição (não substitui nada; o preço é o risco e a perda de
tempo). Só 2 por descida, em lugares **fixos** (aprendíveis, ao contrário de sorteio):

| Câmara | Andar de origem | Nome | Prêmio | Fio de história |
|---|---|---|---|---|
| E1 | 2 (salão, índice 1) | Cela da Cartógrafa | 1 livro raro: +1 Sabedoria na Linha à escolha (ver livros) | quem mapeou a pedra; o acampamento apagado do andar 2 `[A DEFINIR: pode ser de Marta]` |
| E2 | 5 (santuário, índice 4) | Nicho das Que Não Voltaram | 25 Fagulhas + 2 Raízes + 1 Cera + relato de Crônica | luto; a que voltou e a que desceu mais (beat do andar 5) |

Fora do slice (`[ASPIRACIONAL]`): **Provação** (porta com ícone de crânio, 1 desafio de
sobrevivência em troca de dádiva rara), terceira saída em T3 ou T5. Só se a primeira entrega
mostrar que as escolhas entre Estante e Bancada pesam bem.

## 4. Números iniciais e a lógica

### 4.1 A Fagulha sobra; a visita ao braseiro é o gargalo

`[CÓDIGO]` Cálculo feito sobre `skeleton.ts` (recompensa por tipo) e `ROSTER` de `enterRoom`,
mais `CLEAR_BONUS` = 6 por andar. (Recompensas: minion 3, warrior 4, rogue 4, demonio 6,
espreitador 6, heavy 8, arqueiro 8, antigo 9, conjurador 10, brutamonte 12, sentinela 20.)

| Andar (índice) | Roster | Mortos | + bônus | Acumulado ao sair |
|---|---|---|---|---|
| 1 (0) | minion | 3 | 6 | 9 |
| 2 (1) | minion, minion, demonio | 12 | 6 | 27 |
| 3 (2) | warrior, arqueiro, espreitador, minion | 21 | 6 | 54 |
| 4 (3) | warrior, conjurador, antigo, espreitador, minion | 32 | 6 | 92 |
| 5 (4) | brutamonte, arqueiro, rogue, demonio | 30 | 6 | 128 |
| 6 (5) | sentinela, espreitador, arqueiro, warrior, rogue | 42 | 6 | 176 |

Total ao chegar ao Guardião: **176 Fagulhas**, sem contar a execução (F). A matriz de
`00-aprofundamento-e-roadmap.md` 3.6 estimava 55-115: está defasada (as recompensas dos tipos
novos subiram depois). Gasto máximo plausível: 6 dádivas x 9 = 54, mais poções de reposição
(~30-40). Sobram **~80 Fagulhas**, concentradas depois do andar 3. Conclusões:
(a) o preço de uma dádiva não limita o jogador, a visita limita (6 por descida);
(b) a tela do braseiro do andar 1 é apertada (9 Fagulhas contra dádivas de 8-10), o que é bom
para ensinar a escolher;
(c) novos sorvedouros de Fagulha são bem-vindos (Livro Lacrado 12, bancada com Fagulha).
`[A DEFINIR]` Validar com telemetria de playtest; a medição acima é por código, não por jogo.

### 4.2 Paridade entre as saídas (ordem de grandeza, em "✦ equivalentes")

Régua: 1 HP = 0,063 ✦ (Recuperação cura 63 HP por 4 ✦). Dádiva = 9 ✦ de preço + 3 ✦ de
prêmio por ser limitada por visita = 12.

| Saída | Cura | Prêmio principal | Extras | Total aprox. |
|---|---|---|---|---|
| Alçapão da Brasa | 40% = 56 HP = 3,5 | dádiva = 12 | acesso à banca = 2 | **17,5** |
| Estante | 25% = 35 HP = 2,2 | 1 ponto de Sabedoria = 12 | relato de Crônica, direção de build = 1 | **15,2** (17+ com Livro Lacrado pago) |
| Bancada | 20% = 28 HP + Ferida fechada = 1,8 + 1,3 | 3 preparos baratos = 8 | desconto na banca = 3 | **14,1** |

A margem de 2-3 ✦ abaixo do alçapão é proposital: o alçapão é o caminho seguro; as portas
pagam em direção de build, em história e em exploração. Se no playtest a taxa de escolha da
porta ficar abaixo de 30% ou acima de 70%, ajustar a cura de 25%/20% (botão mais barato).

### 4.3 Outros números

- Tempo de comprometimento da porta: 0,6 s. Distância mínima entre saídas: 9 m.
- Planta das antecâmaras: 12 x 12 m (múltiplo de 12 por causa do ladrilho de 6 m e da parede
  de 4 m; `halfX = halfZ = 6`), `daisScale` 0,8. Cabe 1 mesa grande ou 3 estantes.
- Câmara Esquecida: 2 por descida; Vigília = 2 mortos; recompensa fixa.
- Dicas de segredo (assistência): Desligado, Sutil (padrão), Forte (brilho e ícone `eye` a 4 m).

## 5. Interação com os sistemas existentes

- **Fagulhas**: sem mudança de fontes; novos gastos só nas antecâmaras (preços nas outras specs).
- **Brasa (barra de Erupção)**: a barra continua entre salas e antecâmaras (nada a mudar);
  ela não enche em antecâmara sem combate.
- **Estamina**: sem custo de estamina em portas/leitura; a leitura exige não estar em esquiva.
- **7 andares**: inalterados; `floorIndex` continua sendo o andar de origem enquanto se está
  numa antecâmara. Estado novo `nodeKind` em `main.ts`.
- **`RoomKind`**: inalterado. **`DESCENT`**: inalterado. **`crypt:floor`**: só emitido em andar.
  Evento novo `crypt:node`. `ECHOES[floorIndex]` e `INSCRIPTIONS[floorIndex]` não rodam em nó;
  `Room.inscriptionPos` passa a aceitar `null` para o loop não mostrar placa.
- **Save**: `RunSave` ganha campos com default seguro em `readRun` (`rota`, `no`, `gasto`, e os das outras specs); `SAVE_SCHEMA_VERSION` não sobe (o blob `game` é opaco para a plataforma). Lista completa no índice, seção 5.
- **Crônica**: toda antecâmara visitada pela primeira vez completa um objetivo sem `near`
  (`visitou_estante`, `visitou_bancada`, `achou_esquecida_1/2`) que desbloqueia um verbete de
  lugar em `codex.ts`.
- **Leaderboard por tempo**: continua valendo; as antecâmaras custam tempo real, não atalho.

## 6. Leitura sem texto, som e acessibilidade

`[NORMATIVO]`

| Saída | Ícone (traço do DS) | Forma da moldura | Som de assinatura | Cor (nunca o único canal) |
|---|---|---|---|---|
| Alçapão da Brasa | novo `hatch` (anel + alça no chão) | anel no piso | brasa grave e estalo seco | `--ember-400` |
| Estante | `book` (já existe) | arco de pedra com batente | folhear de páginas, sino curto | `--gold-300` |
| Bancada | `potion` (já existe) | arco com prateleira | tilintar de vidro | `--life-400` |
| Segredo revelado | `eye` (já existe) | rachadura no piso | sopro de ar | `--frost-300` |

- O ícone é um marcador **HTML projetado na tela** (como o `reticleEl` do lock-on): custo zero
  de draw call. Em cima da saída, não do texto.
- Reduced motion: o marcador não pulsa nem balança; o anel de compromisso enche linearmente;
  sem tremor de câmera ao selar a porta (só o som).
- Daltonismo: os quatro ícones têm silhueta distinta em cinza; a moldura em 3D é diferente
  (anel vs arco); o texto da promessa aparece sempre ao chegar perto.
- Som: cada tipo tem assinatura própria; o assobio de segredo tem legenda.
- Alvos de toque e teclado: a interação é por proximidade (sem clique), sem exigir precisão.

## 7. Casos de borda e frustração injusta

- Entrar sem querer na porta: folga de 0,6 s e 9 m de separação; recuar cancela.
- Quem quer só descer: o alçapão é sempre a saída 1 e fica no mesmo lugar de hoje (memória
  muscular intacta).
- Morrer na antecâmara: R8. Fechar o jogo dentro dela: R7. Pausar no meio de uma leitura: cancela
  a leitura sem consumir o livro.
- Nenhuma porta é perdida por ordem de ação: todas abrem juntas na estilha.
- Segredo sem sorte: a posição é fixa; a laje existe mesmo com "Dicas: Desligado" (só o brilho
  e o som somem); basta bater no chão suspeito. Nenhum segredo é obrigatório.
- Desempenho ruim em máquina fraca: o ícone projetado é DOM; a antecâmara tem poucas malhas
  e nenhum inimigo.
- `retryFloor` após cair da Instabilidade (spec de cenário vivo): ver lá; a rota planejada
  não muda.

## 8. História (como a mecânica conta o canon)

`[DESIGN]` Estante e Bancada são cômodos da ordem das Acendedoras que sobrevivem no poço:
a ordem não era só espada, tinha escriba e boticária. Por isso a antecâmara é fria e vazia de
gente: dá peso ao "a ordem ruiu". Marta, que desceu na geração anterior e voltou, deixou
**marginálias** (pequenas notas à mão nos livros e nos frascos): a Acendedora lê a letra da
mentora no caminho, e o jogador entende que Cinza segue um rastro. `[A DEFINIR]` aprovar Marta
nessas câmaras (compatível com o canon: ela desceu e voltou). A Cartógrafa (voz do passado já
canônica) autora os sinais de segredo. A escolha entre alçapão e porta é o primeiro gesto de
"Sacrifício com ciência": quem lê, sabe.

## 9. Plano de implementação

Esforço: baixo (até 1 dia), médio (2-4 dias), alto (1-2 semanas), para um agente.

| Etapa | O que | Arquivos | Esforço | Desempenho | Teste |
|---|---|---|---|---|---|
| P0 | Tipos e fundação: `NodeKind`, `RoomDef.node/fromIndex`, `Room.exits[]`, `inscriptionPos` nulável, `crypt:node`, campos de `RunSave` com default | `cryptRoom.ts` (só tipos), `saveData.ts`, novo `game/run/rota.ts` (puro) | baixo | nenhum | `tsc --noEmit`; teste de `planRoute` (restrições R2) compilando com `tsc` e rodando com `node --test` |
| P1 | Pipeline de nó: `enterNode`, retomada, derrota, saída da antecâmara para `enterRoom(i+1)`, hook fino em `main.ts` | `main.ts`, `rota.ts` | médio | nenhum | script `play_check`-like: `__brasa.enterNode("estante")`, sair, autosave, recarregar |
| P2 | Portas no mundo: `doors` no layout, peça `wall_gate_door`, marcadores DOM, anel de compromisso, planta `camara_12` e dressing mínimo | `cryptLayouts.ts`, `cryptRoom.ts`, novo `game/ui/doorMarkers.ts` | médio | +1 a +3 malhas por andar com porta; antecâmara 12x12 sem inimigos | medir com `perf_rooms.cjs` antes/depois; ver no Chrome real |
| P3 | Segredos: laje, vento, som, `StrikeProp.minHeavy`, Câmara Esquecida E1/E2 | `cryptRoom.ts`, `cryptProps.ts`, `combatDirector.ts`, `rota.ts`, `codex.ts` | médio | 1 decalque + 1 emissor de poeira (reuso) | revelar com golpe pesado em teste automatizado; conferir legenda do assobio |
| P4 | Crônica e glossário: verbetes de lugar, objetivos sem `near`, docs antigos corrigidos | `codex.ts`, `campaign.ts`, docs | baixo | nenhum | abrir a Crônica após visitar |
| P5 | Ajuste fino: taxa de escolha, cura 25/20, dicas de segredo | tuning | baixo | nenhum | playtest (pergunta: qual porta você pegou e por quê?) |

**Paralelismo**: P0 antes de tudo (um agente). Depois, P2 e P3 mexem em `cryptRoom.ts`/
`cryptLayouts.ts` (mesmo agente ou em série); P4 pode ser paralela (só `codex.ts`/docs). A
integração em `main.ts` (P1) é serializada por um agente integrador para não conflitar com
as outras specs.

## 10. Definition of Done

- [ ] 7 andares e beats inalterados; antecâmaras não contam como andar.
- [ ] `planRoute` determinístico e testado (R2); mesmo plano ao retomar.
- [ ] Duas saídas legíveis (ícone, forma, som), a 9 m ou mais, compromisso de 0,6 s.
- [ ] Porta lateral substitui a tela do braseiro; alçapão intacto.
- [ ] Retomada e derrota dentro da antecâmara corretas; sem duplicar itens.
- [ ] 2 segredos fixos, revelados por golpe pesado, com dica em som, ar e Cartógrafa.
- [ ] `[perf]` por sala medido antes e depois; antecâmara <= 60; sem vazamento no dispose.
- [ ] Crônica registra visitas; docs antigos de braseiro-por-sala corrigidos.
- [ ] Sem travessões, sem emojis, pt-BR com acentos.
