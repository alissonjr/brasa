# Spec de Exploração: Poções, Remédios, Feridas e Bancada

Status: PROPOSTA de design (nada implementado). Marcações: `[NORMATIVO]`, `[ASPIRACIONAL]`,
`[A DEFINIR]`; procedência `[CÓDIGO]` e `[DESIGN]`.
Reconcilia e estende [`spec-pocoes-e-absorcao.md`](spec-pocoes-e-absorcao.md) (que continua
valendo para o que já está implementado). Índice e riscos:
[`spec-exploracao-indice.md`](spec-exploracao-indice.md). A Bancada é uma antecâmara alcançada
por porta: [`spec-exploracao-portas-e-salas.md`](spec-exploracao-portas-e-salas.md).

## 1. Objetivo de jogador

"Eu cuido das minhas feridas com o que encontrei e preparei, em vez de só esperar o próximo
braseiro." Três ganhos: (a) explorar cantos da sala vira abastecimento (raízes e cera);
(b) o dano deixa marca (Ferida) e existe um remédio para ela; (c) um lugar do mundo onde se
prepara, com o prazer de fazer com as mãos.

## 2. Reconciliação com `spec-pocoes-e-absorcao.md`

`[CÓDIGO]` Estado verificado em `tuning.ts` (`POTIONS`, `ABSORB`) e `main.ts` (`inv`,
`tryPotions`, `chooseBoon`).

| Item da spec antiga | Estado no código | Decisão |
|---|---|---|
| Fagulha como única moeda | implementado | mantido; **sem moeda nova** (ingredientes não são moeda, são achados) |
| Poção de Recuperação (cura 45%, custo 4, cap 3, Digit1) | implementado, `inv.vida` começa em 1 | mantido |
| Elixir de Fúria (+60% dano 8 s, custo 6, cap 2, Digit2) | implementado | mantido |
| Banca na tela do braseiro | implementado (`shopItem` em `chooseBoon`) | mantida como **Banca do Braseiro**, preços iguais |
| `[A DEFINIR]` banca interativa no mundo | não existe | **resolvido: a Bancada** (antecâmara, ver seção 6) |
| `[A DEFINIR]` cooldown de goles | não existe | continua sem cooldown; ver guarda de desperdício (4.3) |
| `[A DEFINIR]` inflação de preço | não existe | não entra; a Fagulha sobra (ver spec de portas 4.1) |
| Essência (drop de cura, 6%, 8 s, raio 1,4) | implementado (`combatDirector`) | mantido; cura até o teto de vida (seção 3) |
| Sede da Brasa (12% do dano em vida) | implementado (a roadmap dizia 10%) | vale o código (12%), mantido |
| Bolsa persiste na morte/retentativa | implementado (`RunSave.pocaoVida/Furia`) | mantido; novos itens seguem a mesma regra |
| HUD de cargas | texto "Recuperação x2" etc. | evolui para ícone + número (seção 7) |

`[DESIGN]` Acrescentamos: **Ferida** (mecânica nova), **Unguento de Brasa** (remédio, Digit3),
**ingredientes** (Raiz-pálida e Cera, achados) e a **Bancada**. Tudo o mais é intocado.

## 3. Ferida (a base dos "remédios")

O pedido do usuário foi "poções que são remédios para curar feridas mais rápido". Hoje o
jogo só tem vida; não há ferida. Definimos uma, pequena e sem gore.

`[A DEFINIR]` Decisão do usuário (ver índice): ligar a Ferida. Padrão recomendado: **ligar**.
Plano B no fim desta seção.

`[NORMATIVO]` Regras (pontos de partida):

- **Ferida** é uma parte da vida perdida que ainda não "fechou". Cada golpe sofrido soma
  **30% do dano** à Ferida (`woundFrac` 0,30), com teto em **40% da vida máxima** (`woundCap` 0,40).
- **Teto de vida** = vida máxima - Ferida. **Toda cura** (Recuperação, essência, Sede da Brasa,
  dádiva, braseiro) enche a vida **até o teto**; nenhuma cura reduz a Ferida por si só.
- **Como a Ferida fecha** (nunca com o tempo, para não virar "esperar parada"):
  1. **Cauterização por golpe**: cada golpe seu que acerta fecha 0,5 de Ferida (1,0 se for
     pesado ou fogo). Lutar fecha; esperar não. É o "curar mais rápido" natural do combate.
  2. **Unguento de Brasa**: fecha 100% da Ferida na hora (a vida sobe de acordo, ver abaixo).
  3. **Tela do braseiro** e **Descanso da Bancada**: fecham 100% antes da cura.
  4. `retryFloor` e `revive`: 100%.
- **Teste "parado 2 minutos na sala limpa"**: nada muda. A Ferida só some por golpe, remédio,
  braseiro ou Bancada.
- Ferida **não é salva**: o save é no checkpoint (chegada ao andar), onde ela já foi fechada.

Exemplo (vida máx. 140): levo 100 de dano em um andar: Ferida 30, teto 110. Bebo Recuperação
(+63): a vida sobe só até 110. Se eu tivesse 20 de Ferida a menos, subiria até 130. Ao fechar a
Ferida (Unguento), o teto volta a 140 e posso beber de novo. A Ferida cria a razão de ter o
remédio: **o remédio abre espaço para a poção**.

**Por que 30% e 40%:** o dano por andar fica na casa de 80 a 140 (golpes de 8 a 32 sobre uma
vida de 140). 30% dá 25 a 42 de Ferida por andar (pouco no começo, sensível nos andares duros);
o teto de 40% (56) garante que nunca se perde mais da metade da barra por ferida; a
cauterização por golpe (0,5 a 1,0, uns 30 golpes por andar = 15 a 30) fecha uma boa parte
dentro do próprio combate. O botão de dificuldade é `woundFrac`: 0 desliga o sistema.

**Plano B (sem Ferida):** Unguento vira *cura ao longo do tempo*: 35% da vida em 8 s
(HoT; 49 HP), mantendo a receita e o tamanho da bolsa; não há teto de vida nem cauterização. Menos
rico, zero risco de equilíbrio, quase nenhum código fora do `heroCombat`.

## 4. Remédios e consumo

### 4.1 Unguento de Brasa (novo, tecla 3)

`[NORMATIVO]`

- Ação `potion3` (Digit3, remapeável). Capacidade 2. **Não se compra** na Banca do Braseiro:
  só se prepara na Bancada. Começa com 0.
- Efeito: fecha 100% da Ferida e cura 10% da vida máxima (14 HP) em 3 s. Aplicar leva 0,6 s
  (mesmo `canDrink` das poções: nada de aplicar no meio de um golpe). Não bloqueia esquiva.
- Receita: **2 Raízes-pálidas + 1 Cera**.
- Valor: com a Ferida no teto (56 HP) devolve ~3,5 ✦ de capacidade mais ~0,9 ✦ de cura, ou seja,
  perto de uma Recuperação (4 ✦); com Ferida zero vale 0, daí a guarda 4.3.

### 4.2 Ingredientes (achados, não moeda)

- **Raiz-pálida** (cap 6): cresce onde a cripta ainda lembra calor, junto das raízes da
  caverna. **Cera** (cap 4): velas e restos de cera de oferenda.
- Aparecem como pontos de coleta (brilho frio pequeno, pega-se ao passar a 1,2 m), **2 a 3
  por andar**, em lugares **fora da faixa de combate** (`Layout.calm`), perto de paredes, cantos
  e pilares. Posição determinística: `mulberry32(runSeed + 1013 * andar)`, para retomar não
  mudar. Pelo menos 1 Raiz por andar fica visível do ponto de partida (não escondida).
- Não há drops de ingredientes de inimigos (evita VFX novo e saturação de drops).
- Persistem na run e na derrota (como as poções). Aparecem no HUD só quando > 0.
- **Por que é exploração e não moeda:** o mundo esconde coisas úteis nos cantos
  (`game-design-e-sistemas.md` 8, "custo de oportunidade da luz"). Quem só quer descer perde
  pouco; quem varre cantos prepara mais.

### 4.3 Guarda contra desperdício (frustração evitável)

`[NORMATIVO]` Hoje `tryPotions` consome a carga mesmo com a vida cheia. Passa a valer:
- Recuperação: se vida >= teto, **não consome**, toca um "negativo" curto e mostra "Vida cheia".
- Unguento: se Ferida < 5% da vida máxima, não consome ("Sem ferida").
- Fúria continua livre.
Isto é a mudança de maior valor por menor custo desta spec e pode entrar antes de tudo (Etapa Q0).

## 5. Números de partida

| Item | Valor | Lógica |
|---|---|---|
| `woundFrac` | 0,30 | ver seção 3 |
| `woundCapFrac` | 0,40 | nunca perde mais da metade da barra |
| Cauterização leve / pesado-fogo | 0,5 / 1,0 | fecha com a luta, não com o relógio |
| Unguento: cura | 10% em 3 s | pequeno; o valor é o teto de vida que ele devolve |
| Unguento: cap / receita | 2 / 2 Raízes + 1 Cera | raro o bastante para ser escolha |
| Raiz / Cera: cap | 6 / 4 | 3 Unguentos de reserva por Raiz |
| Coletas por andar | 2-3 (1 Raiz visível) | exploração opcional, não obrigatória |
| Bancada: pavios | 3 preparos por visita | tempo de bancada limitado, como a leitura da Estante |
| Preparo: Recuperação | 1 Raiz + 3 ✦ (no braseiro: 4 ✦) | 1 ✦ mais barato com ingrediente |
| Preparo: Fúria | 1 Cera + 4 ✦ (no braseiro: 6 ✦) | 2 ✦ mais barato com ingrediente |
| Descanso da Bancada | grátis, 1 vez: fecha Ferida + cura 20% | a "cura" da visita (ver paridade na spec de portas) |
| Estoque inicial na mesa | 1 Raiz + 1 Cera | garante um preparo mesmo sem coleta |

## 6. A Bancada (antecâmara)

`[NORMATIVO]` Planta 12 x 12 (spec de portas 4.3), um tipo de nó (`bancada`). Conteúdo:
mesa central grande com frascos e uma balança (peças do kit: `table`, `bottle_A_green`,
`bottle_B_green`, `bottle_C_brown`, `shelf_small_candles`, `keg`, `candle_triple`), estante ao
fundo (`clusterAlchemy` já existe, reaproveitar), três velas na mesa (os pavios).

- Interagir com a mesa ([R] perto) abre o painel "Bancada" (mesmo componente visual de
  `chooseBoon`: `ds-frame menu-panel`, mesma linguagem). Ações: Preparar Unguento, Destilar
  Recuperação, Ferver Fúria, Descanso. Cada preparo gasta um pavio (a vela se apaga na mesa e
  no painel). Cada linha mostra o resultado e a receita, e fica opaca se faltar ingrediente ou
  Fagulha ou se a bolsa estiver cheia (texto "cheio").
- Sem preparo que falha: nunca se perde ingrediente por acaso.
- Terminada a visita, uma escada leva ao andar `i+1` (R5 e R6 da spec de portas).
- A Banca do Braseiro (tela atual) **permanece** no alçapão: a Bancada é uma alternativa com
  mais valor por Fagulha e acesso ao Unguento, ao custo da dádiva (exclusividade da visita).

## 7. HUD, leitura sem texto e acessibilidade

- **Barra de vida**: a Ferida aparece como segmento hachurado (diagonais) na ponta direita da
  barra, entre o teto e a vida máxima, em tom frio (`--frost-500`), não só cor. Ícone de
  coração rachado ao lado quando > 0. Overlay opcional "Mostrar números".
- **Frascos no HUD**: ícone + número em vez de "Recuperação x2": frasco redondo
  (Recuperação), frasco alto e estreito (Fúria), pote com tampa (Unguento). Tecla pequena
  `ds-kbd` 1, 2, 3. Esmaecido em 0. Ingredientes: dois ícones pequenos, só com valor > 0.
- Sons: Recuperação (glug + sino de cura, já existe `healChime`), Fúria (estalo), Unguento
  (esfregar + crepitar leve); negativo curto no "não consome". Pavio apagando: sopro.
- Reduced motion: o fechamento da Ferida é uma barra que encolhe (sem brilho pulsante); o flash
  de cura continua desligável (`setReducedFlashes`). Daltonismo: hachura e ícone dão o sinal.
- Legendas para sons relevantes ("[frasco]", "[vela se apaga]") quando a opção estiver ligada.

## 8. Casos de borda e frustração injusta

- Bolsa cheia: a ação não gasta, mostra "cheio". Falta de ingrediente: nada se perde.
- Beber no meio de golpe: `canDrink` bloqueia sem consumir (já é regra).
- Bancada sem ingredientes e sem Fagulha: o Descanso grátis sempre existe; nunca é uma sala vazia.
- Morrer: Ferida zera (revive), ingredientes e frascos ficam (como poções hoje).
- Quem desliga o sistema (plano B ou `woundFrac` 0): o Unguento vira HoT e o resto vale.
- Ferida e Guardião: a Ferida vale na arena; o Descanso/braseiro não existem lá, então o
  Unguento é o recurso para a luta final (guarda esse motivo para escolher a Bancada antes do chefe).

## 9. História (como conta o canon)

`[DESIGN]` A Bancada é o ofício da boticária da ordem, sem personagem em cena (a Acendedora
está sozinha). Frascos etiquetados à mão com a letra de Marta: *Raiz-pálida: fecha o que a
espada abre.* Cera de oferenda derretida: gente do povo pediu ao fogo pelos seus. O Unguento
"de Brasa" nomeia o que ele é: remédio feito com o calor da Brasa guardado na cera. Mostra que
a ordem cuidava dos vivos, não só dos mortos, e dá peso a "o frio é o estado natural": só
o calor guardado fecha a carne aberta.

## 10. Plano de implementação

| Etapa | O que | Arquivos | Esforço | Desempenho | Teste |
|---|---|---|---|---|---|
| Q0 | Guarda de desperdício (4.3) e HUD de poções com ícone | `main.ts` (`tryPotions`, `updatePotionHud`), `strings.ts` | baixo | nenhum | `play_check`: beber com vida cheia não consome |
| Q1 | Modelo de Ferida: `wound`, teto, cauterização, cura até o teto, API `closeWounds()`, evento `hero:wound` | `heroCombat.ts`, bloco `WOUND` novo em `tuning.ts` | médio | nenhum | script: aplicar dano, curar, medir teto; 2 min parado = sem mudança |
| Q2 | UI da Ferida: segmento hachurado na barra e coração rachado | `combatHud.ts`, `theme.css`/`ds` | baixo | nenhum | ver no Chrome real; reduced motion |
| Q3 | Unguento: `potion3` em `inputState` (união, `INPUT_ACTIONS`, `EDGE_ACTIONS`, `DEFAULT_BINDINGS`) e rótulo na `ControlsScreen` (`screens.ts`), estado `inv.unguento`, ícones `jar`, `flask` | `inputState.ts`, `screens.ts`, `main.ts` (hook), `icons.ts` | médio | nenhum | remapear a tecla; beber; ver tela de Controles |
| Q4 | Ingredientes: pontos de coleta, HUD, persistência | `cryptRoom.ts` (lista `pickups`), novo `game/run/ingredientes.ts`, `saveData.ts` | médio | 1 malha com thin instances e cor por instância (+1 malha por andar) | `[perf]` antes/depois; coletar, morrer, retomar |
| Q5 | Bancada: antecâmara, painel, receitas, pavios | `cryptRoom.ts` (dressing do nó), novo `game/ui/bancadaUi.ts`, `game/run/bancada.ts` | médio | meta <= 60 (sem inimigos, 12x12) | `__brasa.enterNode("bancada")`, preparar, medir |
| Q6 | Afinação: `woundFrac`, cauterização, preços | tuning | baixo | nenhum | playtest guiado |

**Paralelismo**: Q0 é livre e pode sair já. Q1 e Q3 tocam `heroCombat.ts`/`inputState.ts`: um
agente faz Q1+Q3 (e também L1 da spec de livros, que usa `heroCombat.ts`). Q2 só mexe na UI
de combate (livre depois de Q1). Q4 e Q5 dependem da fundação P0/P1 da spec de portas.
`main.ts` é integrado por um agente só.

## 11. Definition of Done

- [ ] Guarda de desperdício ativa (Recuperação e Unguento); HUD com ícone e número.
- [ ] Ferida: soma, teto, cura limitada, cauterização, fechamento por Unguento/braseiro/Bancada.
- [ ] Parado 2 min na sala limpa: nenhuma mudança de vida ou Ferida (teste).
- [ ] Digit3 remapeável e listada na tela de Controles.
- [ ] Ingredientes: 2-3 por andar, determinísticos, persistem; `[perf]` medido.
- [ ] Bancada: 3 pavios, 4 ações, Descanso grátis, sem preparo que falha.
- [ ] Banca do Braseiro e Poções 1 e 2 sem regressão; `spec-pocoes-e-absorcao.md` referencia esta spec.
- [ ] Sem travessões, sem emojis, pt-BR com acentos.
