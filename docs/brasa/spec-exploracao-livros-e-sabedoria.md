# Spec de Exploração: Livros, Estante e Sabedoria

Status: PROPOSTA de design (nada implementado). Marcações: `[NORMATIVO]`, `[ASPIRACIONAL]`,
`[A DEFINIR]`; procedência `[CÓDIGO]` e `[DESIGN]`.
Índice e riscos: [`spec-exploracao-indice.md`](spec-exploracao-indice.md). A Estante é uma
antecâmara alcançada por uma porta: ver [`spec-exploracao-portas-e-salas.md`](spec-exploracao-portas-e-salas.md).

## 1. Objetivo de jogador

"Ler me deixa mais perigosa, e eu escolho em que." Cada ponto de Sabedoria é uma mudança na
**forma** de um verbo de ataque (alcance, janela, arco, resposta a um perfeito), nunca um
percentual de dano. É um segundo eixo de build, ao lado das dádivas, com leitura imediata
na mão (a arma brilha mais) e um número que o jogador reconhece: **pontos de Sabedoria**.
Referência: Outer Wilds mostra que conhecimento é um progresso que o jogador sente
(ver índice); aqui o conhecimento também vira golpe.

## 2. Regras

`[NORMATIVO]`

- **Sabedoria** é um contador da descida: 0 a 9. Cada ponto pertence a uma **Linha**.
- Três Linhas, três degraus cada (I, II, III). Um degrau só vale se o anterior da mesma Linha
  existe. O degrau efetivo da Linha = número de pontos nela (0-3).
- Fonte: **ler livros** na Estante (e nos prêmios das Câmaras Esquecidas, e no Livro Proibido).
- **Run apenas**: Sabedoria zera ao começar nova descida e ao voltar do título para "Novo jogo".
  Sobrevive à morte e ao `retryFloor` (como as dádivas), e é gravada no save da run.
- **Relato** é permanente: ler um livro pela primeira vez desbloqueia um verbete de relato na
  Crônica (objetivo sem `near`; o Codex deriva o desbloqueio de `objectivesDone`). A Crônica
  é a memória do jogador; Sabedoria é a memória da Acendedora.
- Reaplicar ao retomar: o estado vira três inteiros e uma função pura `applyWisdom(combat,
  linhas)` os reaplica de forma **idempotente** (não empilha), ao contrário de `purchasedBoons`.

### 2.1 As Linhas e os degraus (pontos de partida)

Valores sobre `tuning.ts` (`HERO.light`, `lightFinisher`, `heavy`, `ember`, `comboResetSec`).

| Linha | Verbo | I | II | III |
|---|---|---|---|---|
| **Lâmina** (`lamina`) | combo leve e pesado | "Pulso firme": janela do combo +0,08 s (0,45 para 0,53) | "Fio longo": o finalizador do combo varre 3,2 m (de 2,4) e empurra +1 | "Peso morto": o pesado começa em 0,26 s (de 0,32) e quebra 44 de postura (de 34) |
| **Fogo** (`fogo`) | golpe de fogo (ember) | "Brasa viva": alcance 6,3 m (de 5,5) | "Língua de fogo": arco mais largo (`arcCos` 0,35 em vez de 0,5, ~140 graus) | "Rastro": a Queimadura dura +1 s e acertar 3 ou mais alvos devolve 0,5 carga de Fagulha |
| **Contragolpe** (`contragolpe`) | esquiva e bloqueio perfeitos | "Olho aberto": esquiva perfeita dá 1,5 s de +25% no próximo golpe | "Resposta": bloqueio perfeito faz o próximo leve começar em 0,07 s (de 0,12) | "Fio da Brasa": o golpe após um perfeito varre 3 m e devolve 0,25 carga de Fagulha |

Por que três Linhas, e por que Contragolpe e não "Guarda": o usuário pediu que a Sabedoria
**melhore ataques**. Uma Linha puramente defensiva destoaria. Contragolpe é a ponte: defesa
**que alimenta o ataque**, usando os eventos que já existem (`hero:perfect`, `consumePerfectDodge`,
`rewardParry`). Cada Linha casa com 1 a 2 dos 5 verbos do moveset (leve, pesado, esquiva,
bloqueio, ember) e nenhuma duplica uma dádiva.

**Por que isto não é "mais uma dádiva".** As dádivas (Golpista +12% de dano, Fôlego +25 de
estamina, Pele de Brasa +25 de vida) mexem em números. A Sabedoria muda **quando** e **onde**
o golpe acerta. Sinergia, não substituição: Golpista dá mais dano ao finalizador de Fio longo
que atinge mais gente. Orçamento: um degrau vale cerca de uma dádiva (12 ✦ equivalentes, ver
paridade na spec de portas).

### 2.2 Ler

- Em cada pedestal: segurar [R] por **2,0 s** (anel de leitura, mesma linguagem do
  `channelBar`). Mover-se, esquivar ou tomar dano cancela sem consumir o livro.
- Ao terminar: o texto de uma linha aparece (estilo `showStory`), o degrau novo é mostrado com
  um verbo ("Seu golpe de fogo alcança 6,3 m") e o contador sobe.
- **Uma leitura por visita.** Ao ler o primeiro livro, os outros pedestais se apagam (as velas
  da estante se consomem; ver leitura sem texto). A Sabedoria tem um preço de tempo.

### 2.3 O que a Estante oferece

Três pedestais, um por Linha, sorteados do catálogo (seção 4) por semente e filtrados por
profundidade (um livro só aparece a partir do andar em que o canon já revelou aquilo).

| Item | Regra | Custo |
|---|---|---|
| Livro aberto (3) | +1 ponto na Linha do livro; uma leitura por visita | grátis |
| Volume lacrado (1, 1 por Estante) | permite uma **segunda leitura** na mesma visita | 12 ✦ |
| Livro Proibido (raro, a partir do andar 5, no máximo 1 por descida) | +2 pontos numa Linha à escolha, relato forte | "o escuro lê de volta": 3 mortos acordam (2 minion + 1 espreitador, escalados por andar) |

Por que o lacrado: a Fagulha sobra depois do andar 3 (ver spec de portas, 4.1); o lacrado
transforma sobra em poder sem quebrar a exclusividade da visita. Por que o Proibido: um risco
**escolhido** (Darkest Dungeon: o jogador decide se examina o objeto estranho). Pode ser
ignorado sem perda.

Cura da Estante: 25% da vida (velas e calor de papel), sem fechar Feridas.

## 3. Contador, HUD e reflexo na arma

- **Contador** "Sabedoria N": ao lado do contador de Fagulhas, ícone `book` (já existe) +
  número. Ao passar o mouse ou na tela de Perfil/pausa, as três Linhas com seus degraus (3
  marcas cada, preenchidas ou vazias, com o verbo escrito).
- **Reflexo no mundo**: a ponta da arma ganha brilho em três passos (Sabedoria 3, 6 e 9). Só
  intensidade emissiva do material da arma (sem luz nova). `[A DEFINIR]` depender do modelo da
  arma permitir (ver `actors/weapons.ts`).
- **Ao subir um degrau**: pulso dourado curto (`flashPerfect`-like), som de página e sino
  agudo. Com reduced motion, sem pulso: só o som e o texto.

## 4. Catálogo de livros (12 + 2 proibidos)

`[NORMATIVO]` A coluna "A partir do andar" garante que nenhum livro revele antes do canon.
Beats do canon por andar (1 a 7): povo morto; alguém desceu antes; dúvida sobre a origem; o
custo; luto; a verdade se monta; confronto. Textos de uma linha, voz de lenda gravada (ver
guia de estilo 1.5), sem humor.

| Id | Título | Linha | Andar | Linha de texto |
|---|---|---|---|---|
| `cartilha_guarda` | Cartilha da Guarda | Lâmina | 1 | "Segura o cabo como seguras a vela: firme, sem apertar." |
| `diario_guarda` | Diário de uma Guarda | Lâmina | 2 | "Descemos em seis. Contei os braseiros até o quarto." |
| `rol_nomes` | Rol dos Nomes | Lâmina | 4 | "Cada geração, uma linha a mais nas paredes. Não sei se é honra." |
| `elegia_fio` | Elegia do Fio | Lâmina | 6 | "O fio que corta também lembra de quem cortou." |
| `cantiga_fogo` | Cantiga do Fogo Pequeno | Fogo | 1 | "Fogo pequeno, não te apagues. O frio é grande, tu és o que resta." |
| `tratado_acendedoras` | Tratado das Acendedoras | Fogo | 2 | "Desce. Recolhe cada estilha. No fundo, com todas, a Brasa volta." |
| `contas_brasa` | Contas da Brasa | Fogo | 4 | "A conta não fecha. A chama gasta mais do que a lenha dá. Alguém paga a diferença." |
| `salmo_ardeu` | Salmo da que Ardeu | Fogo | 6 | "Ela ainda arde. Não sei dizer se de alegria." |
| `livro_passos` | Livro dos Passos | Contragolpe | 1 | "Quem recua cedo vive. Quem recua na hora certa vence." |
| `mapa_pedra` | O Mapa é a Pedra | Contragolpe | 2 | "O mapa é a pedra. A pedra range onde há ar por baixo." |
| `margens_marta` | Margens de Marta | Contragolpe | 3 | "O morto bate onde tu estavas. Tu estás em outro lugar." (letra à mão) |
| `ultima_licao` | Última Lição | Contragolpe | 6 | "Se não eu, então tu." |
| `livro_le_de_volta` | O Livro que Lê de Volta | Proibido (qualquer) | 5 | "Quem o lê é lido. O escuro anota o teu nome." |
| `folha_final` | A Folha Final | Proibido (qualquer) | 6 | "A Brasa não pede lenha. Pede quem a alimente por dentro." |

Observações de canon: `mapa_pedra` liga ao segredo (a Cartógrafa); `margens_marta` e
`ultima_licao` são a letra de Marta (ver história); `contas_brasa` e `rol_nomes` só a partir
do andar 4 (o custo); `folha_final` repete o eco do andar 4 ("A Brasa não pede lenha. Pede quem a alimente por
dentro.") só a partir do andar 6, sem revelar a Primeira; `ultima_licao` só no andar 6 porque o
eco "Marta dizia: se não eu, então tu" é o do andar 6.

## 5. Números e lógica

- Máximo 9 pontos; numa descida realista ficam 3 a 6: 2 a 3 Estantes (R2 da spec de portas) x
  1 leitura, +1 do prêmio da Cela da Cartógrafa, +2 do Proibido se corajosa, +1 por cada lacrado.
  Para completar uma Linha (3 pontos) é preciso focar: decisão de build real.
- Tempo de leitura 2,0 s: longo o bastante para ser um gesto, curto para não cansar na 3ª vez.
- Lacrado 12 ✦: custo marginal do degrau em ✦ (12), igual ao prêmio da dádiva; neutro.
- Cura 25%: ver paridade (15,2 contra 17,5 do alçapão).
- Ponto de partida de cada degrau: pequeno de propósito (+0,08 s, +0,8 m, -0,06 s). Dois
  degraus empilhados já se sentem; três transformam o verbo.

## 6. Interação com os sistemas existentes

| Sistema | Efeito desta spec |
|---|---|
| Economia de Fagulhas | gasto só no Volume lacrado (12); nenhuma fonte nova |
| Brasa (barra de Erupção) | sem mudança (ver Contragolpe III abaixo) |
| Estamina | ler não custa estamina; esquivar cancela a leitura; Contragolpe não altera custos de estamina |
| 7 andares | Estante só em T1 a T5; livros filtrados pelo andar de origem; nenhum andar muda |
| `RoomKind` | inalterado; a Estante é `NodeKind` (spec de portas) com `RoomDef.node` e `fromIndex` |
| `DESCENT` / `crypt:floor` | inalterados; a Estante não é entrada de `DESCENT` e emite `crypt:node` |
| Save / Crônica | seção abaixo (campos com default; objetivos `livro_<id>`) |

Detalhes por sistema:

- **Fagulha**: gasto só no lacrado. **Poção**: nenhuma interação direta. **Brasa (barra)**: o
  Contragolpe III não enche a barra extra (mantém o equilíbrio atual de `combat:hit`).
- **Dádivas**: independentes; "Ressonância" (acertos encadeados) soma com Pulso firme (janela
  maior). **Queimador** soma com Rastro (Queimadura mais longa): sinergia declarada, teste de
  cap de dano em playtest.
- **Execução (F)**, **ultimate (X)**, **lock-on (T)**: sem mudança.
- **Chefe**: a Linha Fogo também vale para o Guardião; nenhuma Linha ignora poise de chefe.
- **Save**: `RunSave.sabedoria: [lamina, fogo, contragolpe]` (3 inteiros) e `livros: string[]`
  (ids lidos nesta descida, para a Estante não repetir); defaults 0 e [].
- **Crônica**: objetivos `livro_<id>` sem `near`, verbetes em `codex.ts` categoria "relatos".
  `[A DEFINIR]` hoje `startNewGame` zera `objectivesDone` e, com isso, a Crônica; decidir se os
  relatos de livros devem sobreviver a "Novo jogo" (recomendo que sim, ver índice).

## 7. Leitura sem texto, som, acessibilidade

- Pedestal: ícone de livro aberto com 3 marcas da Linha (lâmina, chama, escudo-e-seta); a Linha
  tem forma e cor (ouro, brasa, gelo), nunca só cor.
- Som de assinatura: folhear, vela que estala; ao ler, sino curto e acorde ascendente por Linha.
- Vela consumida: as chamas dos pedestais não lidos se apagam em 1,5 s, com som, depois da
  primeira leitura (mostra "acabou" sem texto).
- Texto: EB Garamond (`--font-text`), tamanho segue `uiScale` (até 200%); o relato curto pode
  ser pulado com qualquer tecla após 1 s; opção "Relatos longos" liga a Crônica completa.
- Reduced motion: sem pulso nem partículas de página; só som e texto. Sem flash.
- Leitura em voz: `[ASPIRACIONAL]`; o catálogo já está em dados para isso.

## 8. Casos de borda e frustração injusta

- Sair sem ler: nada se perde; a Estante não é obrigatória. Voltar não existe (porta selada).
- Duas Linhas de 3 pontos: impossível por catálogo e limite; se o 4º ponto cairia numa Linha
  já cheia, o livro é redirecionado para a Linha de menor valor e a tela avisa.
- Interromper a leitura (pausa, golpe): sem custo. Morrer no Proibido: o nó reinicia com a
  leitura já concedida e sem emboscada.
- Catálogo esgotado (livros já lidos): o sorteio ignora `livros` lidos nesta descida.
- Sem Estante na descida (plano ruim): o plano garante pelo menos 1 (R2) e a Cela da Cartógrafa
  entrega 1 ponto.
- Cap de poder: soma máxima de Sabedoria + todas as dádivas é revisada contra `DEFENDER` e o
  Guardião (vida ~340) no playtest; o Contragolpe III e o Rastro são os candidatos a corte.

## 9. História (como conta o canon)

`[DESIGN]` A Estante é o scriptorium da ordem, que sobreviveu à ordem. Os livros contam, de
fora para dentro, o mesmo que as inscrições contam andar a andar, com um passo de antecedência
só para quem arrisca (Proibido). "Sacrifício com ciência": quem leu `rol_nomes`,
`contas_brasa` e `folha_final` (os três livros do custo) chega ao Guardião **sabendo**. Se os
três foram lidos, o sussurro final do Guardião ganha uma variante curta ("Já sabias.") e a
narração de encerramento troca "ela descobre" por "ela já sabia o preço". Custo: 2 strings e
1 flag. `[A DEFINIR]` autoria final do texto.

## 10. Plano de implementação

| Etapa | O que | Arquivos | Esforço | Desempenho | Teste |
|---|---|---|---|---|---|
| L0 | Dados puros: Linhas, degraus, catálogo, `applyWisdom`, sorteio por semente e profundidade | novo `game/run/sabedoria.ts`, novo `game/content/livros.ts` | baixo | nenhum | testes de função pura (compilar com `tsc`, `node --test`): idempotência, filtro por andar, redirecionamento |
| L1 | Ganchos no combate: `setAttackMods({...})` com os 3 x 3 modificadores, leitura de eventos perfeitos | `heroCombat.ts`, `tuning.ts` (bloco novo só acrescentado) | médio | nenhum | tsc; script que liga cada degrau e mede alcance/janela via `__brasa` |
| L2 | Estante (antecâmara 12x12): 3 pedestais, velas, lacrado, Proibido, emboscada | `cryptRoom.ts` (dressing do nó), novo `game/ui/estanteUi.ts` | médio | 3 pedestais + estantes: thin instances; sem inimigos; meta <= 60 | `__brasa.enterNode("estante")`, ler, medir `[perf]` |
| L3 | Contador, Perfil, arma que brilha, Crônica (relatos) | `main.ts` (hook fino), `hud.ts`/`combatHud.ts`, `codex.ts`, `campaign.ts` | médio | 1 chip DOM | abrir Perfil; ver brilho; ler e abrir a Crônica |
| L4 | Save e retomada | `saveData.ts` (campos com default) | baixo | nenhum | gravar, recarregar, comparar Sabedoria idêntica |
| L5 | Conteúdo: 14 textos revisados, variante do final | `livros.ts`, `strings.ts`, narrativa | baixo | nenhum | revisão de estilo (sem travessões, voz de lenda) |

**Paralelismo**: L0 e L5 são livres. L1 toca `heroCombat.ts`, que também recebe a Ferida (spec de
poções): **um agente só** faz L1 e a Ferida, em série. L2 depende só do pipeline de nó (P1 da
spec de portas) e pode começar com o atalho de dev. L3 integra em `main.ts`: serializada.

## 11. Definition of Done

- [ ] Sabedoria visível como número; Linhas e degraus legíveis no Perfil.
- [ ] Nove degraus aplicam e removem idempotentemente (retomar, morrer, nova descida).
- [ ] Estante com 3 pedestais, uma leitura grátis, lacrado pago, Proibido com emboscada.
- [ ] Nenhum livro antecipa um beat do canon (coluna "andar" respeitada).
- [ ] Relatos na Crônica; decisão tomada sobre persistência entre jogos novos.
- [ ] Efeitos testados contra Guardião e roster (sem quebrar o duelo ~90 s).
- [ ] Reduced motion e legendas ok; sem travessões, sem emojis.
