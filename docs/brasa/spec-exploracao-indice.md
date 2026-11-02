# Exploração: Índice, Ordem, Dependências e Riscos

Status: PROPOSTA de design (nada implementado no jogo). Marcações: `[NORMATIVO]`,
`[ASPIRACIONAL]`, `[A DEFINIR]`; procedência `[CÓDIGO]` e `[DESIGN]`. Pedido do usuário: o jogo
tem pouco caráter exploratório; quer, de forma gradual, portas e escolha de sala, livros e
sabedoria, poções como remédios, e cenário vivo com desmoronamento.

## 1. Os quatro documentos

| Doc | O que define em uma linha |
|---|---|
| [`spec-exploracao-portas-e-salas.md`](spec-exploracao-portas-e-salas.md) | Os 7 andares ficam; entre eles há saídas escolhidas (alçapão da Brasa ou porta lateral), antecâmaras (Estante, Bancada), 2 segredos fixos (Câmara Esquecida), plano de rota por semente, retomada e derrota. |
| [`spec-exploracao-livros-e-sabedoria.md`](spec-exploracao-livros-e-sabedoria.md) | Sabedoria (0-9) em 3 Linhas (Lâmina, Fogo, Contragolpe) que mudam a **forma** dos golpes; 14 livros por profundidade; uma leitura grátis por visita; Crônica guarda os relatos. |
| [`spec-exploracao-pocoes-e-bancada.md`](spec-exploracao-pocoes-e-bancada.md) | Reconcilia `spec-pocoes-e-absorcao.md`; acrescenta Ferida (teto de vida), Unguento de Brasa (Digit3), ingredientes achados e a Bancada. |
| [`spec-exploracao-cenario-vivo.md`](spec-exploracao-cenario-vivo.md) | Colunas deslizantes (andar 4), Instabilidade que faz o chão ceder (andar 3, cair com a estilha), arena do Guardião que encolhe (andar 7). |

Mock de decisão (não é código do jogo): `prototipo/mocks/exploracao/index.html` (ver seção 9).
Ferramenta de medição: `prototipo/tools/perf_rooms.cjs` (seção 3).

## 2. O modelo comum

`[CÓDIGO]` Fluxo de hoje (W8): limpar a câmara, tocar o relicário (estilha), pisar no alçapão,
tela "Acender o braseiro" (cura 40%, banca, 1 dádiva), `enterRoom(i+1)`. Os docs antigos
(`game-design-e-sistemas.md` 5, `spec-vertical-slice-cripta.md`) ainda falam em braseiro aceso
por sala; esta família de specs usa o fluxo do código.

```
andar i  --(estilha colhida)-->  saídas abrem
   |-- alçapão da Brasa ------> tela do braseiro (cura 40%, banca, dádiva) --> andar i+1
   |-- porta lateral (T1-T5) -> antecâmara (Estante ou Bancada) ------------> andar i+1
   |-- laje rachada (secreta, andares 2 e 5, aditiva) -> Câmara Esquecida --> tela do braseiro
   `-- (andar 3) chão cede sem estilha -> queda, com a estilha ------------> andar 4
```

`[NORMATIVO]` Invariantes: 7 andares, beats de revelação por índice de andar, estilha sempre
colhida antes de escolher a rota, antecâmaras sem índice de andar nem eco, tela do braseiro
**substituída** (não somada) pela porta lateral, nenhuma queda é letal.

## 3. Linha de base de desempenho (medida) e regra de gate

`[CÓDIGO]` O limite normativo é 60 draw calls por sala (`projeto-brasa.md` 4, `perfHud.ts`).
Medi com `perf.logRoom` pelo gancho `window.__brasa.enterRoom(i)` (dev), em Chromium headless
com WebGL via SwiftShader, 4 execuções (o contador do Babylon **inclui os passes de sombra e de
outline**; a variação entre execuções vem de o pós-processo ter ou não carregado):

| Andar (índice) | Tipo | Draw calls medidos (faixa em 4 execuções) |
|---|---|---|
| 1 (0) | guarda | 48 a 94 |
| 2 (1) | salão | 89 a 122 |
| 3 (2) | cisterna | 72 a 83 |
| 4 (3) | salão | 96 a 105 |
| 5 (4) | santuário | 124 a 134 |
| 6 (5) | cisterna | 123 a 128 |
| 7 (6) | Guardião | 93 |

**Conclusão: com o pós-processo ativo todas as salas já estão acima de 60 nesta medição.** Os
relatórios de outras frentes na mesma máquina (logs `cap-*.log` do scratchpad, em outras
branches e com mais cenário) mostram 147 a 223 por sala, e nenhum número abaixo de 60 existe
em relatório algum. Então o "limite já apertado" do pedido parece já estourado quando se conta
como o gate conta, **condicionado a confirmar em GPU real** (nenhuma medição em GPU real existe
ainda).
Consequência para o plano: (a) cada sistema é aceito por **delta** medido antes e depois com o
mesmo script e o mesmo ambiente (`node tools/perf_rooms.cjs <porta>`), teto de **+6 por sala**
com o sistema ativo; (b) as antecâmaras (12 x 12, sem inimigos) são o único lugar onde ainda
dá para cumprir 60 e devem medir <= 60; (c) a decisão D7 abaixo (redefinir o gate) vale **se a medição em GPU real
confirmar** o estouro; se a GPU real medir abaixo de 60, o gate original volta e o delta
vira só uma folga. A medição deve ser repetida na GPU real (`--use-angle=gl-egl`) por quem for
implementar: o script já usa esses argumentos; os números acima vêm de SwiftShader e servem de
ordem de grandeza.

## 4. Ordem de implementação, dependências e esforço

Esforço por agente: baixo (até 1 dia), médio (2 a 4), alto (1 a 2 semanas).

```
F0 fundação  --> F1 (paralelo) --> F2 (paralelo) --> F3 --> F4 --> F5
```

| Fase | Conteúdo | Etapas (nas specs) | Esforço | Depende de |
|---|---|---|---|---|
| F0 | Tipos, `rota.ts` puro, campos de save com default, `ExploracaoHooks`, baseline `[perf]`, guarda de desperdício de poção | P0, Q0, V0 | baixo + médio | decisões D1 a D4 |
| F1 | **A** pipeline de nó e portas no mundo; **B** Ferida, HUD, Digit3 e ganchos de Sabedoria no combate; **C** colunas deslizantes; **D** dados e textos dos livros | P1+P2, Q1+Q2+Q3+L1, V1, L0+L5 | médio x4 em paralelo | F0 |
| F2 | **A** Estante (antecâmara, UI); **B** Bancada (antecâmara, UI) e ingredientes; **C** Calma do cenário | L2+L3, Q4+Q5, V3 | médio x3 | F1-A (pipeline de nó) |
| F3 | Segredos e Câmara Esquecida; Instabilidade (andar 3) | P3, V2 | médio + alto | F1-A, F2 |
| F4 | Arena que encolhe (andar 7); sinais ambientes e áudio; Crônica e glossário | V4, V5, P4 | alto + médio | F3 (primitivo `ChãoQueCede`) |
| F5 | Afinação: taxa de escolha das portas, `woundFrac`, degraus de Sabedoria, tempos do cenário; docs antigos corrigidos | P5, Q6, L-ajuste | baixo + playtest | F1 a F4 |

Dependências duras: antecâmaras (Estante, Bancada, Esquecida) dependem do pipeline de nó (P1);
Instabilidade e arena compartilham o primitivo `ChãoQueCede` (a arena só entra depois da prova no
andar 3); Sabedoria e Ferida precisam do mesmo `heroCombat.ts` (um agente); livros e Câmara
Esquecida dependem dos dados de livros (L0). Independentes desde o início: Q0 (guarda de
desperdício), L0 e L5 (dados e texto), V1 (colunas), V0 (script).

**Cortes se o prazo apertar** (do menos para o mais valioso): Câmara Esquecida E2; Provação
(já fora); arena que encolhe; Instabilidade; Ferida (plano B). O núcleo que muda a sensação de
explorar: porta lateral + Estante + Bancada com Unguento.

## 5. Arquitetura compartilhada para trabalhar em paralelo

`[NORMATIVO]` `main.ts` tem 1235 linhas e é onde os quatro sistemas se encontram; mais as
worktrees de outras frentes (ambientação, cenário, Crônica, jogabilidade) também o editam. Regra:
**cada sistema vive em módulo próprio e expõe uma interface fina; `main.ts` ganha uma linha de
registro por sistema, integrada por um agente só (o integrador), em série.**

```ts
interface ExploracaoHooks {          // game/run/exploracao.ts (criado em F0)
  onEnterFloor?(i: number): void;
  onEnterNode?(kind: NodeKind, fromIndex: number): void;
  onFragmentTaken?(): void;          // as saídas abrem
  onHeroDied?(): void;
  update?(dt: number): void;         // dt de combate (hit-stop não conta)
  snapshot?(): Partial<RunSave>;     // grava o que o sistema possui
  restore?(run: RunSave): void;      // reaplica (idempotente)
}
```

Campos novos de `RunSave` (todos com default em `readRun`; **não** subir
`SAVE_SCHEMA_VERSION`, o blob `game` é opaco para a plataforma):

| Campo | Tipo | Dono | Default |
|---|---|---|---|
| `rota` | `string[]` (escolha por transição) | portas | `[]` |
| `no` | `string` (`"estante@2"` ou vazio) | portas | `""` |
| `gasto` | `string[]` (itens já consumidos no nó) | portas | `[]` |
| `secretos` | `string[]` (segredos já achados) | portas | `[]` |
| `sabedoria` | `number[3]` (Lâmina, Fogo, Contragolpe) | livros | `[0,0,0]` |
| `livros` | `string[]` (ids lidos nesta descida) | livros | `[]` |
| `raiz`, `cera`, `unguento` | `number` | poções | `0` |
| `ferida` | `number` (HP de Ferida aberta) | poções | `0` |

A Ferida **é** salva (a Estante e a queda da Instabilidade chegam ao checkpoint sem fechá-la;
sem salvar, recarregar a zeraria). O estado do cenário **não** é salvo (recalculado ao entrar).

Eventos novos em `platform.events`: `crypt:node` `{node, fromIndex}`; `hero:wound`
`{wound, ceiling}`; `wisdom:changed` `{linhas}`; `cenario:warn` `{peca, segundos}`; `cenario:fall` `{de, para}`. O evento
`crypt:floor` continua só para andares.

Números ficam em arquivo próprio por sistema (`rota.ts`, `sabedoria.ts`, `ferida.ts`,
`cenario.ts`) e **uma linha** em `tuning.ts` os reexporta; assim dois agentes nunca editam o
mesmo bloco do `tuning.ts`.

### Matriz de arquivos e conflitos

| Arquivo | Portas | Livros | Poções | Cenário | Tratamento |
|---|---|---|---|---|---|
| `app/main.ts` | sim | sim | sim | sim | integrador único, 1 linha por sistema |
| `game/combat/heroCombat.ts` | | L1 | Q1 | | **um agente** faz L1 e Q1 |
| `scenes/crypt/cryptRoom.ts` | P2 | L2 | Q4, Q5 | V1 | tipos em F0; dressing de nós em `cryptNodes.ts` (um arquivo por nó) |
| `scenes/crypt/cryptLayouts.ts` | P2 | | | V1 | portas e plantas 12x12 (A); marca de colunas (C) em seção própria |
| `content/saveData.ts` | P0 | L4 | Q4 | | F0 cria todos os campos de uma vez |
| `content/codex.ts` / `campaign.ts` | P4 | L3 | | V2 | entradas só acrescentadas, por agente de Crônica |
| `engine/input/inputState.ts`, `ui/screens.ts` | | | Q3 | V3 | arquivos distintos por etapa |
| `actors/enemies/guardiao.ts` | | | | V4 | dono do chefe |

## 6. Riscos (em ordem)

1. **Gate de draw calls** (seção 3): já estourado na medição; sem a decisão D7 o aceite é
   ambíguo. Mitigação: delta <= +6, antecâmaras <= 60, thin instances, nada de malha por frasco.
2. **`main.ts` monolítico e várias frentes simultâneas**: conflito de merge e regressão do fluxo
   de descida. Mitigação: F0 integrada em `integracao` primeiro; `ExploracaoHooks`; um integrador.
3. **`heroCombat.ts` compartilhado** (Ferida, Sabedoria, e as frentes de jogabilidade): serial.
4. **Equilíbrio**: Ferida muda o atrito; os degraus de Sabedoria e as dádivas se somam; a Fagulha
   sobra (176 contra ~95 de gasto plausível). Mitigação: todos os botões em tuning, `woundFrac = 0`
   desliga, playtest guiado em F5, candidatos a corte já listados.
5. **Canon e normativos**: `spec-set-pieces.md` 6.5 ("no máximo UM desabamento"), "descida de
   7 salas", "com todas as estilhas" (a queda leva a estilha), docs antigos de braseiro por sala.
   Resolvido por escrito nas specs e nas decisões abaixo.
6. **Leitura visual na câmera alta**: portas na parede mal se leem de cima; ícones são DOM
   projetado e os segredos ficam no chão; o "buraco" da Instabilidade é uma placa sobre o piso
   fundido (não remove o piso). **Validar no Chrome real, não no headless** (já houve tela preta e
   listras que o headless escondeu).
7. **Retomada e derrota dentro de nó** (duplicar item, perder recompensa): regras R7 e R8 e teste
   de recarga.
8. **IA sem navegação**: colunas móveis e `setEnemyBounds` que encolhe podem prender mortos;
   regra de parada e 100 execuções headless.
9. **Escopo**: quatro sistemas; cortes listados na seção 4.
10. **Crônica zera em "Novo jogo"** (`startNewGame` carrega `objectivesDone` vazio), o que
    apagaria os relatos de livros: ver D8.

## 7. Conflitos com documentos existentes

| Documento | Conflito | Resolução proposta |
|---|---|---|
| `spec-set-pieces.md` 6.5 | "No máximo UM set piece de desabamento" | A Instabilidade do andar 3 **é** o set piece 2.4 (fixo, um); a arena que encolhe é reação do chefe (`ArenaControls`), não set piece; sem blocos Havok (animação e partículas). Atualizar 2.4/6.5 junto da etapa V2. |
| `game-design-e-sistemas.md` 5, `spec-vertical-slice-cripta.md` | braseiro aceso por sala | descrevem o fluxo anterior ao W8; corrigir junto de P1 |
| `00-aprofundamento-e-roadmap.md` 3.6 | PF total 55-115 | defasado: 176 por código (spec de portas 4.1) |
| `spec-pocoes-e-absorcao.md` | `[A DEFINIR]` banca no mundo; cooldown; inflação | Bancada resolve a banca; os outros dois ficam como estão; acrescentar um ponteiro para a spec de poções desta família |
| `spec-profundidade-e-variedade.md` C | objetivos de sala além de "mate todos" | a Instabilidade é a primeira instância (missão com prazo) |
| `spec-chefe-guardiao.md` 3 e 5.6 | arena e hazards | `setExtent` é método novo de `ArenaControls`, sem mudar fases ou números do chefe |

## 8. Decisões que dependem do usuário (perguntas fechadas)

Cada uma com a minha recomendação. Nada foi implementado; as specs assumem as recomendações.

1. **D1 Exclusividade.** A porta lateral substitui a tela do braseiro daquela transição?
   Recomendo **sim** (a visita é o recurso escasso; senão a escolha some).
2. **D2 Ferida.** Ligar a Ferida (teto de vida, Unguento fecha, braseiro e Bancada fecham)?
   Recomendo **sim, leve** (`woundFrac` 0,30); plano B pronto: Unguento como cura ao longo do tempo.
3. **D3 Sabedoria entre descidas.** Persiste de uma descida para outra?
   Recomendo **não** (só a Crônica persiste); alinhado a `game-design-e-sistemas.md` 6.
4. **D4 Desabamento e `set-pieces` 6.5.** Aceitar que a Instabilidade do andar 3 é o único set
   piece de desabamento e que a arena que encolhe é reação do chefe?
   Recomendo **sim**.
5. **D5 Falha da Instabilidade.** Cair para o andar 4 levando a estilha, com 12% de dano e sem a
   tela do braseiro (em vez de perder a estilha)? Recomendo **levar a estilha** (preserva o
   canon "com todas").
6. **D6 Marta e a Cartógrafa.** Marta deixou marginálias nas antecâmaras e a Cartógrafa assina os
   sinais de segredo (e o acampamento do andar 2 pode ser de Marta)? Recomendo **sim**
   (compatível com o canon: Marta desceu e voltou).
7. **D7 Gate de 60 draw calls.** Trocar o critério por "delta <= +6 por sistema e por sala" até
   haver uma passada de otimização geral? Recomendo **sim, condicionado a que a medição em GPU real confirme**
   (hoje as 7 salas passam de 60 em SwiftShader; ver seção 3).
8. **D8 Crônica em "Novo jogo".** Os relatos de livros e de lugares sobrevivem a "Novo jogo"
   (mover esses objetivos para o perfil)? Recomendo **sim**.
9. **D9 Provação.** Fica fora da primeira entrega (terceira saída com desafio)? Recomendo
   **sim, fora**.
10. **D10 Calma do cenário.** Incluir a assistência com 3 modos (Normal, Longo, Sem prazo), com
    leaderboard só no Normal? Recomendo **sim**.

## 9. O mock de decisão

`prototipo/mocks/exploracao/index.html` (Vite em dev: `npm run dev` e abrir
`/mocks/exploracao/index.html`). Mostra, com os tokens e o traço de ícones do design system:
quatro saídas com moldura, ícone, nome e promessa, e anel de compromisso de 0,6 s; Estante com 3
pedestais e leitura de 2,0 s; Bancada com pavios e receitas; HUD com a Ferida hachurada e os
frascos; faixas da Instabilidade com pips. Tem três testes embutidos: **ver em cinza**,
**reduzir movimento**, **texto 200%** (escala o conteúdo da página com `zoom`). Ícones propostos (a entrar em `icons.ts` quando
aprovados): `hatch`, `jar`, `flask`, `wound`, `crack`, `candle`, `root`, `wax`, `contra`.
Checado em Chromium headless (sem erros de console, interações respondem) e em 390 px de
largura; por ser DOM, o risco de GPU é baixo, mas **o aceite visual deve ser feito no Chrome
real**.

## 10. Glossário proposto (registrar em `guia-de-estilo-e-glossario.md` antes de usar em jogo)

| Id | Nome de exibição | Definição curta | Grafia | NÃO dizer |
|---|---|---|---|---|
| `sabedoria` | Sabedoria | contador da descida (0-9) de saberes lidos; muda a forma dos golpes | maiúscula como recurso no HUD, minúscula em texto corrido | XP, nível, skill point, mana |
| `linha` | Linha | trilha de Sabedoria (Lâmina, Fogo, Contragolpe), 3 degraus | maiúscula nos nomes das Linhas | árvore de talentos, classe |
| `estante` | Estante | antecâmara de livros da ordem | maiúscula como nome de saída | biblioteca, loja de livros |
| `bancada` | Bancada | antecâmara de preparo de remédios | maiúscula como nome de saída | loja, craft, laboratório |
| `antecamara` | antecâmara | sala lateral entre dois andares; não conta como andar | minúscula | sala bônus, nível secreto |
| `esquecida` | Câmara Esquecida | antecâmara secreta, aditiva e com preço | maiúscula | fase secreta |
| `ferida` | Ferida | parte da vida perdida que ainda não fechou; baixa o teto de vida | maiúscula no HUD | sangramento, sangue, debuff |
| `unguento` | Unguento de Brasa | remédio que fecha a Ferida | maiúscula no nome | poção de cura (é a Recuperação), bandagem |
| `raiz_palida` | Raiz-pálida | ingrediente achado | maiúscula no nome | erva, material, loot |
| `cera` | Cera | ingrediente achado | maiúscula quando ingrediente | item |
| `instabilidade` | Instabilidade | prazo em que o chão da câmara cede se a estilha não for colhida | maiúscula como nome de evento | timer, contagem, armadilha |

## 11. Referências consultadas (uma linha cada; fontes de guias e wikis, não de desenvolvedores)

- Hades: a porta mostra a recompensa antes de entrar e o jogador escolhe; isso transforma o acaso em decisão.
  ([Prima](https://primagames.com/tips/hades-door-symbols-guide-boons-artifacts), [Hades II, até 4 saídas](https://hades2.game-vault.net/wiki/Doors)).
- Dark Souls: atalhos e sem viagem rápida fazem as áreas se ligarem; a atmosfera nasce da conexão
  ([TheGamer](https://www.thegamer.com/dark-souls-1-fromsoftwares-magnum-opus-of-interconnected-level-design/)).
- Darkest Dungeon: curiosidades opcionais com sorte e risco declarados, e o jogador decide examinar
  ([GameSkinny](https://www.gameskinny.com/4f0gf/darkest-dungeon-curios-guide)).
- Slay the Spire: cada nó é uma pequena troca de risco e recompensa; algumas óbvias, outras interessantes
  ([análise de design](https://saschb2b.github.io/game-mechanics/games/slay-the-spire/design-tensions)).
- Dead Cells: portas com prazo que travam para sempre e altares de 3 escolhas; recompensa exige rota
  ([wiki](https://deadcells.wiki.gg/wiki/Timed_door)).
- Hollow Knight: o banco cura e atualiza o mapa; segredos atrás de paredes quebráveis, o mapa nunca é tudo
  ([wiki](https://hollowknight.wiki/w/Bench_(Hollow_Knight))).
- Outer Wilds: conhecimento como único progresso, registrado numa crônica
  ([análise](https://rigdern.github.io/a/learning-about-learning/learning-design-insights-from-outer-wilds/)).
- Arenas que mudam: avisar em proporção ao perigo e testar se o jogador sabe o que devia ter feito;
  muitas mortes por borda indicam arena mal projetada
  ([Wayline](https://www.wayline.io/blog/crafting-legendary-boss-battles), [Bugnet](https://bugnet.io/blog/how-to-design-a-boss-arena)).

## 12. O que ficou em aberto

- Valores finais de todos os botões (dependem de playtest); só há pontos de partida com lógica.
- Medição de draw calls em GPU real e definição do gate (D7).
- Autoria final dos 14 textos de livros, da variante "ciente" do final e das marginálias de Marta.
- Se a arma consegue brilhar por degrau (depende do modelo em `weapons.ts`).
- Segunda leva: Provação, terceira saída, Sabedoria como meta-progressão.
- Atualização dos documentos antigos listados na seção 7 (deve acompanhar P1, V2 e Q-etapas).

## 13. Registro de implementação: F0 e F1-A (branch `explor-f0`)

Status: IMPLEMENTADO e testado. As frentes seguintes (livros, Ferida e poções novas, colunas,
Instabilidade, arena que encolhe) ainda não existem; as antecâmaras são salas vazias marcadas.

**O que existe**

- `game/run/rota.ts` (puro, sem Babylon): `NodeKind`, `planRoute(seed)` (as 14 sequências válidas
  de R2, sorteadas por semente com sal próprio), `exitsFor`, `resumePlace` (R7), `retryPlace` (R8),
  `RouteState` (plano, escolhas, nó atual, gasto), `stepCommit` (R4) e os números (0,6 s, 9 m,
  raio 1,8, cura 25% e 20%). `game/run/exploracao.ts`: `ExploracaoHooks` e `ExploracaoRegistry`
  (carrega os campos de save que nenhum sistema registrado possui, para não perdê-los).
- `RunSave` ganhou `rota`, `no`, `gasto`, `secretos`, `sabedoria`, `livros`, `raiz`, `cera`,
  `unguento`, `ferida`, todos com default e leitura defensiva em `readRun`; `SAVE_SCHEMA_VERSION`
  não subiu. Save antigo no meio de uma descida semeia `rota` com "alcapao" por passagem feita.
- Porta lateral: parede leste, segmento de parede trocado pelo portão do kit (fundido ao cenário
  estático); veu e poça de luz da cor da antecâmara, sem luz pontual, acendem junto do alçapão.
  Ícone (`hatch`, `book`, `potion`) e anel de compromisso são DOM projetado
  (`game/ui/exitMarkers.ts`); assinaturas sonoras `saidaAlcapao`, `saidaEstante`, `saidaBancada`.
- Antecâmara: `buildCryptRoom` com `RoomDef.node` (planta `camara_12`, 12 x 12, sem altar, sem
  inimigos, sem dressing). O tema vem do andar de origem; `RoomKind` não foi estendido.
- Cura própria da antecâmara (25% Estante, 20% Bancada) na entrada, uma vez (`gasto: ["cura"]`).
- Guarda de desperdício: Recuperação com a vida cheia não consome (Unguento entra com a Ferida).

**Decisões de implementação (fora do texto das specs)**

- O compromisso de 0,6 s só vale nos andares COM porta; a primeira passagem e a escada da
  antecâmara continuam de pisar e descer. O relicário fica a ~3 m do alçapão, então ao abrir as
  saídas a Acendedora costuma estar pisando o gatilho dele: o compromisso só conta depois de sair
  de todos os gatilhos uma vez ("armar").
- Com porta lateral, o "Tratado das Acendedoras" (texto lido com [R]) sai de z = 3,5 para
  z = -2,5 (parede leste), para a leitura não disparar o anel da porta.
- A porta fica no segmento de parede mais próximo de `halfZ - 9` (z = 2, 2 ou 10, 14 conforme a
  planta), o que dá 11,8 m a 12,3 m do alçapão em todas as plantas (teste: R4 pede 9 m).

**Linha de base de draw calls em GPU real** (`node tools/perf_rooms.cjs <porta>`, Chromium com
`--use-angle=gl-egl`, 1280x900, 9 s por sala; o contador inclui sombra e contorno; a medição varia
cerca de 2 a 4 entre execuções). Base = `integracao` com `personagens-c`; "depois" = `explor-f0`:

| Andar | Tipo | Antes (2 execuções) | Depois (2 execuções) |
|---|---|---|---|
| 1 | guarda | 105, 105 | 99, 99 |
| 2 | salão | 122, 122 | 116, 116 |
| 3 | cisterna | 81, 83 | 85, 83 |
| 4 | salão | 145, 145 | 139, 139 |
| 5 | santuário | 134, 134 | 125, 125 |
| 6 | cisterna | 127, 127 | 127, 124 |
| 7 | Guardião | 85, 85 | 85, 85 |

A queda vem de fundir as 4 vigas da borda do alçapão em uma malha (vale para toda sala). A porta
aberta custa de 0 a 4 draw calls (só quando está no quadro; medido ligando e desligando o véu e a
poça). Antecâmaras (`... nos`): 55 a 58 em Estante e Bancada, com origem em qualquer andar.
Os números absolutos dependem do ponto de vista da câmera e de o pós-processo ter carregado.

**Como testar**

- `node tools/test_exploracao.mjs` (21 testes: plano de rota, retomada, save, ganchos, plantas).
- Dev: `window.__brasa.enterNode("estante", 2)`, `route()`, `takeFragment()`, `room()` (traz `doors`).

**Achado fora do escopo:** a contagem de texturas da cena cresce ~20 por montagem de sala (ao
alternar andares 6 vezes: 48 para 183); o descarte só solta `DynamicTexture`. Não vem desta frente.
