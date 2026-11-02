# Spec de Exploração: Cenário Vivo e Desmoronamento

Status: PROPOSTA de design (nada implementado). Marcações: `[NORMATIVO]`, `[ASPIRACIONAL]`,
`[A DEFINIR]`; procedência `[CÓDIGO]` e `[DESIGN]`.
Índice e riscos: [`spec-exploracao-indice.md`](spec-exploracao-indice.md). Estende
[`spec-set-pieces.md`](spec-set-pieces.md) 2.4 (a câmara que cede) e
[`spec-chefe-guardiao.md`](spec-chefe-guardiao.md) 3 e 5.6 (arena e hazards).

## 1. Objetivo de jogador

"A cripta é velha e não está parada." O cenário muda o jogo em três escalas: **o espaço
mexe** (colunas que deslizam), **o tempo pesa** (o chão cede se eu não cumprir a missão) e
**o fundo reclama** (a arena do Guardião encolhe). Em todas, o jogador lê o aviso, tem tempo de
agir e, se falhar, **paga caro mas não morre** (referência: pontos de design sobre telegrafia
justa; ver índice).

## 2. Três peças e uma regra comum

| Peça | Andar | Falha custa | Primitivo técnico |
|---|---|---|---|
| Colunas deslizantes | 4 (índice 3, salão de pilares) | cobertura que sai do lugar; sem dano | `ColunaDeslizante` (thin instance) |
| Instabilidade (o chão cede) | 3 (índice 2, cisterna-corredor 24x48) | cair para o andar 4 com a estilha | `ChãoQueCede` (placas de vazio) |
| Arena que encolhe | 7 (índice 6, Guardião, 36x36) | borda empurra de volta com dano | `ChãoQueCede` (anéis) |

`[NORMATIVO]` Regra comum de telegrafia (3 canais, nunca só um): **poeira** (visual), **rangido
grave** (som, com legenda "[pedra rangendo]") e **rachadura que brilha** (forma no piso). A
ordem é sempre: poeira, rachadura, rangido, ação. Duração mínima do aviso antes do efeito:
**3,5 s** para o que derruba o jogador (perigo alto), **2,0 s** para o que só move cobertura
(perigo baixo). O teste de qualidade: se o jogador vê o replay de sua queda e sabe o que
deveria ter feito, funcionou.

## 3. Colunas deslizantes (andar 4)

`[CÓDIGO]` A planta `pilares_24` (24x24) usa `pillarsForest`: pilares em `x = -7, -4, 4, 7`,
passo de 6 m em z, sempre fora da pista central (`|x| >= 4`). Roster do andar 4: warrior,
conjurador, antigo, espreitador, minion (pico). O conjurador é o inimigo que mais usa cobertura.

`[NORMATIVO]` Regras:

- **4 colunas** (as de `|x| = 7`, duas de cada lado) deslizam em z, ida e volta, percurso de
  **3,0 m** entre as pontas, ciclo de **7 s**, pausa de **1,2 s** nas pontas (a pausa é o momento de ler e de usar).
  Os outros pilares ficam fixos. Nenhuma coluna entra em `|x| < 3` (a pista central fica livre).
- **Começam depois do despertar**: 2,0 s após `combat.wake`, com o aviso (poeira + rangido +
  sulco no piso que mostra o trilho). A primeira vez no andar o aviso dura 3,0 s.
- **Sem dano**. Se o herói ou um inimigo está a menos de 1,1 m da frente da coluna, ela **para
  e volta** (som de trava). Nunca prende ninguém contra a parede.
- **Onde a coluna não pode parar**: a menos de 2 m do ponto de nascimento dos inimigos
  (`enemyAnchor`), para a IA em linha reta (sem navegação) não ficar presa num vão que fecha.
- Efeito de jogo: a cobertura contra arqueiro e conjurador deixa de ser estática; o jogador
  aprende a ler o ciclo (7 s) e a usar a pausa. Ensina antes o que o chefe cobrará (mover-se
  em arena que muda).
- `[ASPIRACIONAL]` Andar 6 (cisterna com colunata) reusa as colunas mais rápidas (5,5 s,
  3,5 m). Só se o andar 4 passar no playtest.

Números: o ciclo de 7 s tem 2 pausas de 1,2 s e 2 percursos de 2,3 s, ou seja ~1,3 m/s, abaixo
do andar do herói e dos inimigos (1,5 a 4,2 m/s): a coluna nunca é uma ameaça de atropelo, é
mudança de linha de visão. A pausa de 1,2 s é maior que o tell do espreitador (0,28 s) por
conforto de leitura.

## 4. Instabilidade: o chão cede se a missão não for cumprida (andar 3)

`[DESIGN]` Resolve o `[A DEFINIR]` de `spec-set-pieces.md` 2.4 ("fixo numa sala específica do
slice"): **é o andar 3**, e esta Instabilidade **é** o set piece "a câmara que cede". Não é um
segundo set piece de desabamento (ver o conflito com 6.5 no índice).

### 4.1 A missão

A missão é a que o jogo já tem: **limpar a câmara e colher a estilha** no relicário. O novo é
o prazo. O texto de objetivo muda para "Recupere a estilha antes que o chão ceda".

### 4.2 Como o chão cede

`[NORMATIVO]` A planta é o corredor 24x48 (`corredor_24x48`): 8 faixas de 6 m em z, da
entrada (sul, `z = -24`) ao relicário (norte). O chão cede **da entrada para o relicário**.

| Marco | Tempo desde o despertar | O que acontece |
|---|---|---|
| Graça | 0 a 35 s | nada cede; poeira fina e rangido ocasional (anuncia que há prazo) |
| Faixas 1 a 5 | 35 s, depois a cada 20 s | cada faixa avisa por 4,0 s (poeira 0 s, rachadura brilhante 1,0 s, rangido 2,5 s, queda 4,0 s) e cede |
| Platô final | faixas 6 a 8 (18 m) com o relicário | seguram até o fim do prazo |
| Cataclismo | 160 s | aviso de 8 s ("o resto cede"); no fim cede tudo |

`[NORMATIVO]` Regras de justiça:

1. **Só uma coisa derruba o jogador: o cataclismo** com a estilha ainda não colhida. Faixas
   individuais **nunca** derrubam: quem está numa faixa que vai ceder, no último 1,2 s do aviso,
   é empurrado a 6 m/s para a faixa segura mais próxima e ganha 1,0 s de invulnerabilidade
   (o chão "te solta"). Inimigos fora do limite saem por dissolução: contam como derrotados, sem
   Fagulha (evita premiar o abismo).
2. `combat.setEnemyBounds` encolhe junto (AABB, só `minZ` sobe). O aviso de cada faixa fixa o
   novo limite a 2,5 s, dando 1,5 s para os mortos saírem. Os mortos de longe (arqueiro,
   conjurador) recuam por ele naturalmente.
3. **Cumprir a missão estabiliza**: ao colher a estilha, o rangido cessa e as faixas que ainda
   não caíram ficam firmes. O jogador escolhe a porta com calma (sem relógio).
4. O prazo é generoso: uma limpeza competente leva 60 a 80 s; sobram ~80 s (a regra: o prazo
   total é ~2 x o tempo de uma boa limpeza, ajustável em tuning).
5. **Calma do cenário** (assistência, em Acessibilidade): "Normal" (160 s), "Longo" (320 s) ou
   "Sem prazo" (as faixas só avisam, o cataclismo não ocorre). Valer para o leaderboard só no
   modo "Normal".

### 4.3 Falhar: cair

`[NORMATIVO]` Cataclismo sem a estilha colhida: queda para o andar 4. Custos, todos
recuperáveis:

- Dano da queda 12% da vida máxima, **nunca letal** (deixa pelo menos 1 de vida).
- **A estilha cai com você** (canon: "só no fundo, com todas, a Brasa volta": nenhuma estilha se
  perde). Ela é contada ao pousar, sem relicário.
- Perde: o bônus de 6 Fagulhas da câmara, a Fagulha dos mortos que restavam, e a visita ao
  braseiro daquela transição (cura 40%, banca, dádiva e as portas). Ao pousar no andar 4,
  `enterRoom(3)` roda normalmente (eco, inscrição, despertar) com autosave imediato.
- Custo comparado: ~17,5 ✦ equivalentes (a paridade do alçapão) + a Fagulha restante. Caro o
  bastante para ser temido, barato o bastante para não frustrar.
- Não é um atalho: o custo supera o ganho; a corrida com queda perde para a corrida limpa.

### 4.4 Leitura e HUD

- **Pips de estabilidade** (5), no HUD abaixo do objetivo: ícone de rachadura + marcas
  preenchidas/vazias, mais um relógio em arco no cataclismo. Forma e preenchimento, não só cor.
- Faixa que vai ceder: rachadura quente (`--ember-400`) + hachura no piso + som crescente.
- Reduced motion: sem tremor de câmera; a queda é um fade (0,6 s). Aviso continua em 3 canais.

## 5. Arena do Guardião que encolhe (andar 7)

`[DESIGN]` Reclassificação: **não é um set piece de desabamento**; é uma reação da arena às
fases do chefe, no mesmo espírito de `ArenaControls.setMareDeBreu` e `spawnFrostZone` (que
`spec-chefe-guardiao.md` 5.6 já tem). O encolher é um terceiro método da arena.

- **Gatilho determinístico**, pelas fases por vida do chefe: ao entrar na fase 2 (66% de vida) a
  arena passa de meia-largura 18 m para **14,5 m**; ao entrar na fase 3 (33%), para **11 m**.
  Quadrados concêntricos (anéis). Nunca abaixo de 11 m: a Brasa (centro) fica sempre alcançável.
- **Aviso de 5,0 s** (a mais longa do jogo, é solene): o anel externo esfria (azul saturado, gelo
  nas bordas), rachaduras correm ao longo dele, vento grave. Depois o anel cede em 3 s.
- **Não há "embaixo" para cair**: a borda perdida é um vazio frio com o brilho da Brasa
  muito abaixo (o poço). Tocar a nova borda **empurra o herói 1,5 m para dentro** com 8% da
  vida máxima de dano e 0,8 s de invulnerabilidade: um muro com dano, nunca uma morte por queda.
- O Guardião respeita o novo limite (usa `bounds` como os mortos). Os golpes de varredura e o
  "frio que morde" (5.6) usam a nova meia-largura.
- A gangorra de luz não muda: reacender a Brasa continua cambaleando o chefe; encolher não
  é punição por falhar na luz, é o arco da luta (a câmara afunda com a Brasa).
- `[A DEFINIR]` ligar a gatilho de luz em vez de fase (mais punitivo, menos previsível):
  não recomendado.

## 6. Orçamento de desempenho

`[CÓDIGO]` Medido com `perf.logRoom` (contador de draw calls do Babylon, que **inclui os passes
de sombra e outline**) por `__brasa.enterRoom(i)`: ver tabela no índice (todas as 7 salas já
estão acima de 60 no contador). Portanto o orçamento vale em **delta**, medido antes e depois
com o mesmo script.

| Peça | Custo previsto | Como mantém barato |
|---|---|---|
| Colunas deslizantes | +1 a +2 malhas | as 4 colunas saem do `staticMerge`; viram 1 malha base com 4 thin instances atualizadas por frame; os fixos continuam fundidos |
| Placas de vazio (Instabilidade) | +1 malha | 8 instâncias de uma placa (quad escuro com borda); **o piso original não é removido**, é coberto: o piso é um facet fundido de 811 linhas (`cryptFloor.ts`) e não vale a pena reabri-lo |
| Poeira e rangido | 0 a +1 | reusa o emissor da atmosfera, dispara rajadas; áudio é WebAudio sem malha |
| Anéis da arena | +2 malhas | 2 placas de vazio (um por anel) + a trinca; sem Havok |

`[NORMATIVO]` Delta máximo aceito: **+6 no contador** por sala com cenário vivo, medido pelo
mesmo script. Sem corpos de física novos (as faixas e anéis são lógicos: teste por posição,
em vez de colisor); o `set-pieces` 2.4 pedia 3 a 5 blocos Havok, e aqui **não usamos** (queda
é animação assada e partículas). Risco visual: a placa de vazio sobre o piso precisa ler como
buraco da câmera alta; validar no Chrome real (ver índice, "headless engana").

## 7. Interações com os outros sistemas

| Sistema | Efeito desta spec |
|---|---|
| `RoomKind` | inalterado; o comportamento vem de `Room.cenario?` (campo opcional) pelo índice do andar, não pelo tipo visual |
| `DESCENT` | inalterado; cenário vivo é configurado por índice de andar em arquivo próprio |
| `crypt:floor` | continua emitido em `enterRoom`; eventos novos `cenario:warn` e `cenario:fall` |
| Estamina | sem mudança; o empurrão final não gasta estamina |
| 7 andares | andares 3, 4 e 7 ganham a peça; os demais ficam como estão |

Detalhes por sistema:

- **Portas e salas**: as saídas continuam abrindo com a estilha; a Instabilidade termina nesse
  mesmo evento (3 da seção 4.2). A queda substitui a transição normal (sem tela do braseiro).
  O plano de rota (`planRoute`) da transição afetada é descartado (a queda não escolhe porta).
- **Livros**: o livro `mapa_pedra` fala em pedra que range (ligação temática). Nenhum efeito.
- **Poções**: a Ferida segue valendo na queda; o dano da queda (12%) gera Ferida como qualquer
  dano (30% dele).
- **Economia**: a queda custa a visita ao braseiro (~17,5 ✦ equivalentes); ver spec de portas 4.2.
- **Save**: o autosave de chegada grava o andar 4, com a vida pós-queda e a Ferida atual
  (`RunSave.ferida`); a Instabilidade não guarda estado (é recalculada ao entrar no andar 3).
- **Crônica**: objetivo `caiu_andar3` (sem `near`) desbloqueia um verbete curto de lugar.
- **Brasa (barra)** e **estamina**: sem mudança.
- **Leaderboard**: só o modo "Normal" de Calma do cenário vale.

## 8. Casos de borda

- Jogador parado numa faixa que vai ceder: empurrão final (4.2 regra 1).
- Inimigo ranged que ficou do outro lado do vazio: o limite encolhe antes de a faixa cair; ele
  caminha para dentro (a IA não tem navegação, mas anda em linha reta para o herói).
- Morrer **antes** do cataclismo, no andar 3: `retryFloor` reinicia o andar 3 com o prazo cheio e
  a estilha ainda no relicário. Morrer **depois de cair**, no andar 4: reinicia o andar 4 (o
  autosave de chegada já o gravou); a queda não se desfaz.
- Pausa: o relógio do cenário para junto (usa o `dt` do combate; hit-stop não conta).
- Jogador com Calma "Sem prazo": ainda vê o aviso (poeira e rachadura), só não cede.
- Colunas e herói encurralado: a coluna para e recua (3).
- Arena: se o herói está no anel que cede, o empurrão acontece no começo da queda (3 s).
- Tela cheia de efeito com muita partícula: teto de partículas do emissor existente.

## 9. História (como conta o canon)

`[DESIGN]` Andar 3 é a dúvida sobre a origem (cisterna, água, "ela já estava aqui quando
desci"): um chão que cede é o poço dizendo que **ninguém tem certeza do que está embaixo**.
Cair com a estilha (e não sem ela) diz o mesmo que o canon: o que se recolhe vai junto, até
quando se perde o caminho. As colunas do andar 4 (o custo) mexem como a ordem mexia seus
mortos: nada é estático, tudo é rito. O encolher da arena no fundo (andar 7) é a Brasa que
esfria e o chão que a segue: a fase 3 do Guardião ("o escuro que reclama") ganha corpo no
espaço. O Guardião, que testa a Acendedora, não empurra: o chão faz isso por ele.

## 10. Plano de implementação

| Etapa | O que | Arquivos | Esforço | Desempenho | Teste |
|---|---|---|---|---|---|
| V0 | Baseline e script de medição por sala (`prototipo/tools/perf_rooms.cjs`, já incluído nesta entrega) + tipos: `Room.cenario?` com `update(dt)`, `ChãoQueCede` e `ColunaDeslizante` como interfaces | novo `scenes/crypt/cryptCenarioVivo.ts` (tipos e esqueleto), `tools/perf_rooms.cjs` | baixo | define a régua | rodar nas 7 salas, anexar tabela |
| V1 | Colunas deslizantes no andar 4: base + thin instances, trilho, aviso, parada de segurança | `cryptCenarioVivo.ts`, `cryptRoom.ts` (tira 4 pilares do merge), `cryptLayouts.ts` (marca as 4) | médio | +1 a +2 | 100 execuções headless sem inimigo preso; medir delta |
| V2 | Instabilidade: placas, faixas, cronograma, empurrão final, bounds, HUD de pips, queda | `cryptCenarioVivo.ts`, `main.ts` (hook fino: cair para `enterRoom(i+1)` com estilha), `combatDirector.ts` (`setEnemyBounds` já existe), `hud.ts` | alto | +1 | simular prazo curto via `__brasa`; cair e verificar estilha e autosave |
| V3 | Calma do cenário (acessibilidade) | `screens.ts` (aba Acessibilidade), `platform` settings | baixo | nenhum | alternar nos 3 modos |
| V4 | Arena que encolhe: anéis, aviso, empurrão com dano, `bounds` do chefe | `cryptRoom.ts` (arena), `guardiao.ts` (limite), `cryptCenarioVivo.ts` | alto | +2 | `\` no dev pula ao chefe; baixar vida do chefe para forçar fases |
| V5 | Sinais ambientes (poeira nos andares 2, 5, 6), áudio, legendas | atmosfera (`cryptTheme.ts`), `adaptiveAmbience.ts`/`biblia-audio` | médio | 0 a +1 | ouvir sem imagem, ver sem som |

**Paralelismo**: V1, V2 e V4 compartilham `cryptCenarioVivo.ts`; para dar a três agentes sem
conflito, cada peça vive em seu **próprio arquivo** (`colunasDeslizantes.ts`, `chaoQueCede.ts`,
`arenaEncolhe.ts`) sob uma pasta `scenes/crypt/vivo/`, e o único arquivo compartilhado é um
`index.ts` de registro (uma linha por peça, integrada em série). V4 também toca `guardiao.ts`
(dono do chefe). V3 e V5 são livres.

## 11. Definition of Done

- [ ] Aviso em 3 canais e duração mínima respeitada (3,5 s derruba, 2,0 s cobertura, 5,0 s arena).
- [ ] Faixa individual nunca derruba; só o cataclismo sem estilha; queda leva a estilha.
- [ ] Calma do cenário com 3 modos; leaderboard só no Normal.
- [ ] Colunas param quando há alguém perto; 100 execuções sem inimigo preso.
- [ ] Arena não cai abaixo de 11 m; borda empurra com dano, sem morte por queda.
- [ ] Delta de draw calls <= +6 por sala com cenário vivo; sem corpo Havok novo.
- [ ] Reduced motion sem tremor; legendas dos sons; funciona sem cor e sem som.
- [ ] Conflito com `spec-set-pieces.md` 6.5 resolvido por escrito (índice, decisão 4).
- [ ] Sem travessões, sem emojis, pt-BR com acentos.
