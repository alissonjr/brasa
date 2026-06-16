# Spec: Poções, Banca do Alquimista e Absorção

Status das marcações: [NORMATIVO] decidido e a implementar; [ASPIRACIONAL] meta sem prazo;
[A DEFINIR] depende de playtest.

Estende a economia de Fagulha (ver [`spec-progressao-e-economia.md`]) e as dádivas do
braseiro. Objetivo: dar ao jogador AGÊNCIA dentro da run - comprar fórmulas (consumíveis)
com os pontos ganhos matando inimigos, e ABSORVER vida/essência dos mortos. Pedido do
jogador (2026-06-15): "mesa de poções onde comprar fórmulas de recuperação de vida ou
aumento de ataque, com pontos ganhos ao matar inimigos; absorver a vida/itens dos inimigos".

## 1. Conceitos e relação com o que já existe

- **Fagulha (✦)**: moeda única, já existente. Dropa de cada morto (`reward` por tipo) e é
  gasta. NÃO criar uma segunda moeda; "pontos ganhos ao matar inimigos" = Fagulha.
- **Dádivas da Brasa** (já existem): upgrades PERMANENTES da run, escolhidos 1x por descida
  no braseiro (dano, vida máx, alcance). Continuam.
- **NOVO - Poções (consumíveis)**: itens com CARGAS que o jogador compra, carrega e USA na
  hora que quiser (tecla), com efeito imediato/temporário. Diferente da dádiva (permanente,
  passiva): a poção é recurso tático ativo.
- **NOVO - Absorção**: vida recuperada a partir dos inimigos, por dois canais: essência que
  dropa do morto (pega andando por cima) e roubo de vida por golpe (dádiva passiva).

## 2. Banca do Alquimista (compra) [NORMATIVO]

Onde compra: na tela do braseiro (entre andares), que hoje só oferece 1 dádiva. Passa a ter
DUAS seções: (a) **estoque de poções** (comprar N cargas, gastando Fagulha, repetível
enquanto houver saldo e couber na bolsa), e (b) a escolha de dádiva (como hoje, encerra a
tela). No mundo, a banca é representada pela `mesa`/estantes do `clusterAlchemy` já presente
no cenário (santuário/salão), reforçando a fantasia; a compra acontece no braseiro para não
exigir um segundo modo de UI de loja agora.

[A DEFINIR] Banca interativa no mundo (aproximar + tecla "usar" abre a loja sem ser no
braseiro) - melhoria futura; o braseiro cobre o caso de uso agora.

### Catálogo de poções [NORMATIVO]

| Poção | Efeito | Custo (✦) | Capacidade |
|---|---|---|---|
| Poção de Recuperação | cura 45% da vida máxima na hora | 4 | até 3 cargas |
| Elixir de Fúria | +60% de dano por 8 s | 6 | até 2 cargas |

- Preço cresce 0 (fixo por carga) nesta versão; balanceamento de inflação fica [A DEFINIR].
- Capacidade limita o acúmulo (decisão tática: gastar agora vs guardar).
- A bolsa PERSISTE entre andares e na morte/retentativa do andar (igual à Fagulha/dádivas).

## 3. Uso das poções [NORMATIVO]

- Teclas (remapeáveis): **Digit1** = beber Poção de Recuperação; **Digit2** = Elixir de Fúria.
  (Q é bloqueio; E/F é o golpe de fogo - por isso 1/2.)
- Beber tem custo de oportunidade: só fora de golpe/conjuração (estado idle/aproximação),
  para não virar cura instantânea no meio do combo. Esquiva/bloqueio não impedem.
- Sem carga -> nada acontece (feedback sonoro/visual leve de "vazio"). [A DEFINIR] cooldown
  entre goles; começar sem cooldown e medir no playtest.
- HUD: contador de cargas de cada poção ao lado das barras (ícone + número), esmaecido quando 0.

## 4. Absorção [NORMATIVO]

Dois canais, ambos reforçando "tomar a vida dos inimigos":

### 4.1 Essência (drop de vida)
- Ao morrer, o inimigo tem CHANCE de soltar uma **essência** (orbe emissiva quente) no chão.
- Chance/quantidade escala com o `reward` do tipo (inimigos mais fortes soltam mais).
- A essência é coletada ANDANDO por cima (raio de coleta), curando uma fração pequena da
  vida (ex.: 6% da vida máx por orbe). Tempo de vida curto (~8 s) some se não pegar.
- Objetivo de design: recompensa de agressão/movimento (vai buscar a cura no campo) e um
  fluxo de cura que NÃO depende só de poção comprada.

### 4.2 Roubo de vida (dádiva passiva "Sede da Brasa")
- Nova dádiva do braseiro: cada GOLPE conectado cura uma fração pequena do dano causado
  (ex.: 12% do dano vira vida). Stacka com compras repetidas em descidas diferentes.
- É o "absorver a vida dos inimigos" pedido, na forma de build passiva.

## 5. Números de partida (tuning) [NORMATIVO, ajustável]

Adicionar em `tuning.ts` (bloco POTIONS/ABSORB):
- pocaoVida.healFrac = 0.45; pocaoVida.cost = 4; pocaoVida.cap = 3.
- elixirForca.dmgBonus = 0.60; elixirForca.durationSec = 8; elixirForca.cost = 6; elixirForca.cap = 2.
- essencia.dropChanceBase = 0.5; essencia.healFrac = 0.06; essencia.lifeSec = 8; essencia.pickupRadius = 1.4.
- sedeDaBrasa.lifestealFrac = 0.12 (por compra da dádiva).

## 6. Integração técnica (resumo de implementação)

- `heroCombat`: buff de dano TEMPORIZADO (timer + multiplicador, somado ao `damageMul`);
  `lifesteal_` (fração) + `lifestealHeal(dmg)`; `heal(n)` absoluto; `canDrink` (idle/approach).
- `inputState`: ações `potion1`/`potion2` (edge), binds Digit1/Digit2; entram em
  INPUT_ACTIONS/EDGE_ACTIONS/DEFAULT_BINDINGS (e a ControlsScreen passa a listá-las).
- `combatDirector`: ao herói acertar, chama `lifestealHeal`; ao inimigo morrer, sorteia
  e spawna a essência (orbe) e a coleta por proximidade no update (cura).
- `main.ts`: inventário (cargas), beber poção no loop (consumePressed), compra na tela do
  braseiro, contadores no HUD; dádiva "Sede da Brasa" no acervo de BOONS.
- HUD (`combatHud`): contadores de poção.

## 7. Definition of Done

- [ ] Comprar poções no braseiro gastando Fagulha, respeitando capacidade e saldo.
- [ ] Beber poção (Digit1/Digit2) cura/aplica buff; buff de fúria expira sozinho; sem carga não faz nada.
- [ ] Essência dropa de inimigos, aparece no chão, some no tempo e cura ao pegar andando por cima.
- [ ] Dádiva "Sede da Brasa" disponível; golpes curam fração do dano; stacka.
- [ ] HUD mostra cargas de cada poção (e some/realça conforme 0/positivo).
- [ ] Bolsa e dádivas persistem entre andares e na retentativa.
- [ ] `tsc --noEmit` limpo; sem `pageerror` em fumaça (play_check); efeito visível em render.
- [ ] Sem em-dash/emoji; pt-BR; teclas remapeáveis.
