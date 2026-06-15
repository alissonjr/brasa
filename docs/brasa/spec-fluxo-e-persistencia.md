# Spec de Fluxo e Persistência (Save/Load) - Brasa

Máquina de estados do jogo (do título ao desfecho da descida) e o sistema de salvar/carregar
de Brasa. Esta spec espelha o documento análogo da era Josué
([`../spec-fluxo-e-persistencia.md`](../spec-fluxo-e-persistencia.md)), reaproveita a mecânica
neutra de save já implementada no motor, e a readequa ao laço sala-a-sala da cripta. É a única
lacuna sistêmica estrutural que afeta arquitetura desde cedo, ainda que a persistência em
disco seja adiada no protótipo.

Documento mestre do jogo: [`projeto-brasa.md`](../projeto-brasa.md) (CANON). Esta spec NÃO
pode contradizê-lo. Em especial: seção 3 (estrutura sala-a-sala), seção 4 (orçamento técnico,
uma sala carregada por vez COM DESCARTE), seção 6 (mapeamento sobre o motor). Régua de detalhe
e marcação em [`../padrao-de-detalhe.md`](../padrao-de-detalhe.md).

Convenção (herdada do CANON): pt-BR, sem travessões, sem emojis. Procedência `[DESIGN]`
(decisão criativa nossa), `[CÓDIGO]` (observado no código do protótipo), `[ASSET]` (procede de
pacote de asset). Exigência `[NORMATIVO]` (entra no aceite, verificável), `[ASPIRACIONAL]`
(mood/intenção), `[A DEFINIR]` (decisão pendente).

Convenção de escopo: `[SLICE]` o que entra no vertical slice (uma descida curta com começo,
combate, braseiro e fim); `[COMPLETO]` o que é do jogo inteiro. O slice NÃO precisa de save
real em disco (a descida é curta e a retentativa rápida basta), mas a máquina de estados e a
fronteira de persistência devem nascer certas para não retrabalhar.

Snapshot: 2026-06-14.

---

## 1. Princípios

- `[DESIGN]` `[NORMATIVO]` Uma única fonte de verdade do estado de alto nível: um
  `GameStateMachine` explícito, não flags espalhadas. Toda tela/transição passa por ele.
- `[DESIGN]` `[NORMATIVO]` Fronteira de camadas (herdada do motor): a PLATAFORMA é dona de
  ONDE/COMO salvar (`platform/save`, `platform/progress`, `platform/settings`); o JOGO é dono
  de O QUE salvar (o payload `game` opaco). Ver [CÓDIGO] em `platform/save/saveStore.ts:5-18`
  e `game/content/saveData.ts:1-15`. Brasa mantém essa fronteira intacta.
- `[DESIGN]` `[NORMATIVO]` Casar ficção e mecânica: o ponto de salvamento é o braseiro aceso.
  Acender o braseiro de uma sala (que na ficção empurra o escuro para baixo e destrava a porta)
  é também o checkpoint de mecânica. Salvar não é a qualquer instante: é efeito de acender o
  braseiro, o que simplifica consistência e combina com o ritmo limpar-sala -> acender ->
  descer.
- `[DESIGN]` `[NORMATIVO]` Coerência com a leveza: como só UMA sala existe carregada por vez
  (CANON 4.1), o estado de mundo a persistir é mínimo - basta saber em qual sala a Acendedora
  está e que upgrades carrega, não o conteúdo de salas já descartadas.
- `[DESIGN]` `[NORMATIVO]` Falha graciosa: save corrompido ou de versão incompatível nunca
  trava o jogo; cai para backup, para o último válido, ou para novo jogo, sempre avisando. O
  motor já faz isso (`saveStore.ts:88-101`, backup + checksum).

---

## 2. Estados de alto nível (máquina de estados)

```
BOOT -> TITLE -> [NOVA_DESCIDA | CONTINUAR] -> LOADING -> SALA
SALA <-> PAUSE
SALA: penumbra -> COMBATE -> sala_limpa -> BRASEIRO (interação)
BRASEIRO -> (acende, salva, destrava porta) -> SALA (porta) -> LOADING(próxima) -> SALA
SALA (última) -> COMBATE_CHEFE (Guardião) -> REAVIVAR_BRASA -> FIM
qualquer SALA -> DERROTA -> [RETENTAR | TITLE]
FIM | DERROTA -> TITLE
qualquer -> TITLE (com confirmação)
```

Tabela dos estados:

| Estado | O que roda | Entradas | Saídas |
|---|---|---|---|
| BOOT | Carrega engine (WebGPU/WebGL2), Havok, settings salvos | - | TITLE |
| TITLE | Tela-título; menu principal (frio-azul, brasa fraca ao fundo) | start | NOVA_DESCIDA, CONTINUAR, OPCOES, SAIR |
| LOADING | Carrega a PRÓXIMA sala (glb modular, esqueletos, braseiro) e DESCARTA a anterior; transição curta | de TITLE/BRASEIRO | SALA |
| SALA | Loop de jogo numa câmara: controle da Acendedora, câmera, exploração; sub-estados penumbra/COMBATE/sala_limpa | de LOADING | COMBATE, BRASEIRO, PAUSE, DERROTA |
| COMBATE | Mortos despertos ativos; melee existente; sem save | inimigos vivos | sala_limpa (todos mortos) ou DERROTA (vida <= 0) |
| BRASEIRO | Sala limpa: interação de acender; acende luz quente, concede upgrade, SALVA checkpoint, destrava porta | sala_limpa + interação | SALA (porta liberada) |
| COMBATE_CHEFE | Câmara do Guardião; chefe único | última sala | REAVIVAR_BRASA (vitória) ou DERROTA |
| REAVIVAR_BRASA | Set piece: a Acendedora reaviva a Brasa; clímax do slice | chefe vencido | FIM |
| DERROTA | Acendedora caiu; tela de derrota (frio-azul, fagulha apagando) | vida <= 0 | RETENTAR, TITLE |
| FIM | Desfecho: a superfície volta a ter calor; encerra a descida | REAVIVAR_BRASA | TITLE (ou CREDITOS) |
| PAUSE | Congela simulação; menu de pausa (retomar, opções, sair) | Esc/Start | SALA, OPCOES, TITLE |
| OPCOES | Áudio, vídeo, idioma, acessibilidade, raio de luz | de TITLE/PAUSE | volta à origem |
| CREDITOS | `[COMPLETO]` Rola créditos; volta ao título | fim do jogo completo | TITLE |

`[SLICE]` precisa de: BOOT, TITLE (mínima), LOADING, SALA, COMBATE, BRASEIRO, COMBATE_CHEFE,
REAVIVAR_BRASA, DERROTA (retentar rápido), FIM. PAUSE pode ser mínima; OPCOES pode ser só
idioma e raio de luz/velocidade de texto; CREDITOS é `[COMPLETO]`.

Regras de transição importantes `[NORMATIVO]`:
- PAUSE é overlay sobre SALA (não descarrega a sala). LOADING SIM descarrega: é o único ponto
  em que a sala anterior morre e a próxima nasce (ver seção 9, casa com CANON 4.1).
- COMBATE e COMBATE_CHEFE são sub-estados da SALA, não telas: a câmara continua carregada; o
  que muda é haver inimigos vivos. Não há save dentro deles (seção 4).
- BRASEIRO é o único estado que dispara save (seção 4). Acender é irreversível na sessão: ao
  acender, o checkpoint avança e a porta libera.
- DERROTA nunca leva a tela preta; sempre oferece RETENTAR (recarrega do último braseiro) ou
  TITLE (ver seção 5).

---

## 3. Loop de uma sessão (caminho feliz)

1. BOOT carrega engine + settings (idioma, volume, acessibilidade, raio de luz) do
   armazenamento local (`SettingsService`, localStorage, `settingsService.ts:47-53`).
2. TITLE: se há descida salva, "Continuar" fica em destaque; senão só "Nova descida".
3. Nova descida -> LOADING da primeira câmara (Câmara de guarda) -> SALA em penumbra.
4. SALA: a porta de pedra se sela atrás; os mortos despertam (COMBATE). A Acendedora limpa a
   sala com o melee existente.
5. Sala limpa -> a Acendedora acende o BRASEIRO: luz fria vira quente, ganha escolha de upgrade
   (fagulha: dano, alcance, vida, raio de luz - CANON 3.3), o jogo SALVA o checkpoint e a porta
   destrava.
6. Cruzar a porta -> LOADING: a sala anterior é DESCARTADA, a próxima carrega -> nova SALA.
   Repete por 5 a 7 salas (`[A DEFINIR]` no CANON 3.2).
7. Última sala -> COMBATE_CHEFE contra o Guardião -> REAVIVAR_BRASA -> FIM (desfecho) -> TITLE.

---

## 4. Checkpoints e quando salvar

`[DESIGN]` `[NORMATIVO]` O braseiro aceso é o checkpoint. Casamento de ficção e mecânica:

Tipos de save:
- Autosave de braseiro: ao acender CADA braseiro (estado BRASEIRO, seção 2). Sobrescreve o
  slot da descida em curso. É o que o RETENTAR usa. `[SLICE]` em memória, `[COMPLETO]` em
  disco. Equivale ao "autosave de checkpoint" do doc de Josué, agora amarrado a um gesto
  diegético.
- Autosave de fim de descida: ao REAVIVAR_BRASA (FIM). Marco firme de progresso da run.
  `[COMPLETO]`
- Save manual: `[COMPLETO]`, opcional. O jogador exporta um slot pelo menu (backup soberano,
  já suportado por `exportSlot`/`importSlot` em `saveStore.ts:135-160`). Não há save manual
  em combate.
- `[NORMATIVO]` NÃO há save em COMBATE, COMBATE_CHEFE nem durante a transição LOADING (evita
  estados inconsistentes e save no meio do descarte de sala).

`[SLICE]` Nada disso precisa persistir em disco. Basta um "checkpoint em memória" gravado ao
acender cada braseiro (e ao entrar na câmara do chefe), para o RETENTAR rápido. A interface
`SaveStore` (já implementada, `saveStore.ts:46-55`) pode ficar como caminho `[COMPLETO]`,
acionada pelos mesmos pontos.

`[NORMATIVO]` O gatilho de save é único e centralizado: o estado BRASEIRO chama o serviço de
progressão e o `SaveStore`. Nenhum outro ponto do código grava save (sem flags espalhadas).

---

## 5. Fluxo de derrota

`[DESIGN]` A Acendedora cai quando a vida chega a zero (em COMBATE ou COMBATE_CHEFE). Entra em
DERROTA. A tela é frio-azul, a fagulha apagando: leitura imediata de que o escuro avançou.

Opções na tela de DERROTA `[NORMATIVO]`:
- RETENTAR: recarrega o estado do ÚLTIMO BRASEIRO ACESO. A Acendedora reaparece na sala do
  último braseiro (já limpa e acesa), com os upgrades que tinha ao acendê-lo, e segue dali. A
  sala onde morreu é descartada e recarregada limpa ao reavançar.
- TITLE: abandona a descida e volta ao título (com confirmação).

`[A DEFINIR]` Granularidade do recomeço por derrota. Três posturas, com recomendação:
- (a) Do último braseiro (proposta recomendada `[DESIGN]`): retoma na sala do último braseiro
  aceso, conservando upgrades. Penalidade leve, ritmo ágil, casa com a fagulha que ainda arde.
  Coerente com o autosave de braseiro da seção 4. Recomendado para o slice.
- (b) Do início da descida, perdendo upgrades (postura roguelite): cada derrota reinicia a
  cripta; só persistem meta-upgrades entre runs. Mais tensão e rejogabilidade, mais frustração
  numa descida longa. Adiar para `[COMPLETO]` se quisermos virar roguelite.
- (c) Do início da descida, conservando upgrades (híbrido brando). Pouco usado, registrado por
  completude.
- Decisão: o slice adota (a). Marcar (b)/(c) como evolução possível pós-slice; não bloqueia.

`[NORMATIVO]` RETENTAR não passa por menu de carga: é um clique direto que recarrega o
checkpoint, como no doc de Josué. No `[SLICE]` isso é restaurar o snapshot em memória; no
`[COMPLETO]`, recarregar o slot via `SaveStore.load` (`saveStore.ts:88`).

---

## 6. O que persiste e o que reseta

`[DESIGN]` `[NORMATIVO]` A divisão, agora que só uma sala existe por vez:

Persiste DENTRO da descida (sobrevive à derrota, vive no checkpoint de braseiro):
- Índice da sala atual / último braseiro aceso (qual andar da cripta).
- Upgrades de fagulha escolhidos até aqui (dano, alcance, vida, raio de luz).
- Vida e recursos da Acendedora no momento do último braseiro.
- Contagem de braseiros acesos (progresso da descida) e tempo de jogo.

Persiste ENTRE SESSÕES `[COMPLETO]` (sobrevive a fechar e reabrir o navegador):
- O slot da descida em curso (via IndexedDB/`LocalSaveStore`), permitindo "Continuar".
- `[A DEFINIR]` Meta-progressão entre descidas (se Brasa virar roguelite): upgrades
  permanentes, salas/inimigos descobertos, recordes. Fora do escopo do slice.

RESETA (não persiste):
- O conteúdo de salas já descartadas: inimigos mortos, baús abertos, props da sala anterior. A
  sala anterior é literalmente destruída em LOADING (CANON 4.1); ela não volta na mesma run, e
  ao reavançar após derrota é remontada limpa.
- Estado transitório de combate (posições de inimigos, cooldowns) ao recarregar checkpoint.
- A sessão inteira em NOVA_DESCIDA: começar de novo zera upgrades de descida e índice de sala
  (no slice; no roguelite `[COMPLETO]` a meta-progressão sobrevive).

`[SLICE]` Basta o estado de descida em memória entre tentativas; nada precisa cruzar o
fechamento da aba.

---

## 7. O que um save contém (modelo de dados)

`[CÓDIGO]` O envelope genérico JÁ existe e não muda: `SaveData` em `saveStore.ts:28-37`
(`schemaVersion`, `rev`, `updatedAt`, `profileId`, `points`, `playtimeSec`, `summary`, e
`game: Record<string, unknown>` opaco). A plataforma não conhece o miolo do jogo.

`[DESIGN]` O payload `game` (hoje `GameSaveData` em `saveData.ts:8-15`, modelado para Josué:
`chapter`, `checkpoint`, `objectives`, `inkState`, `achievements`, `character`) é re-textado
para Brasa. Esboço proposto (campos, não formato final):

```
GameSaveData (Brasa) {
  descentId: string          // id da descida/cripta corrente (no lugar de chapter)
  brazierId: string          // último braseiro aceso = checkpoint (no lugar de checkpoint)
  roomIndex: int             // andar atual da descida (qual sala)
  braziersLit: int           // quantos braseiros acesos (progresso)
  upgrades: string[]         // ids de upgrades de fagulha escolhidos
  hero: { vida, vidaMax, ... }   // estado da Acendedora no checkpoint (reusa CharacterSave)
  achievements: string[]     // re-textado, mecânica mantida
  // inkState removido enquanto Brasa não usar Ink; manter campo se a narrativa entrar
}
```

`[NORMATIVO]` O save NÃO guarda geometria nem o conteúdo de salas: apenas índices e o estado da
Acendedora. Como só uma sala existe por vez, o save é pequeno por construção (poucos KB), bem
abaixo do alvo de "poucas dezenas de KB" do doc de Josué.

`[NORMATIVO]` Toda leitura do payload é defensiva (campo ausente -> default seguro), espelhando
`readGameSave` (`saveData.ts:21-31`): renomear ids de sala/braseiro não pode travar o load.

---

## 8. Formato de save e armazenamento

`[CÓDIGO]` `[NORMATIVO]` O motor JÁ tem a camada de persistência pronta e genérica; Brasa a
reaproveita sem reescrever:
- Web: IndexedDB via Dexie (`LocalSaveStore`, `saveStore.ts:85-161`), 1 registro por slot,
  escrita transacional atômica com BACKUP do save anterior (`saveStore.ts:113-118`).
- Envelope versionado com `SAVE_SCHEMA_VERSION = 3` (`saveStore.ts:20`) e migração em cadeia
  (`migrate`, `saveStore.ts:187-198`).
- Checksum HMAC-SHA256 anti-edição-casual quando há WebCrypto (`computeChecksum`,
  `saveStore.ts:224-237`); origem insegura grava sem checksum sem travar.
- Saneamento pós-load com clamp/defaults (`sanitize`, `saveStore.ts:201-213`).
- Export/import de arquivo como backup soberano do usuário (`saveStore.ts:135-160`).
- A interface `SaveStore` (`saveStore.ts:46-55`) abstrai ONDE: trocar por `TauriSaveStore`
  (desktop) ou remoto não toca o jogo.

`[DESIGN]` `[A DEFINIR]` O motor nomeia o banco Dexie como `"josue"` (`saveStore.ts:77`), o
segredo HMAC como `"josue-save-v1-..."` (`saveStore.ts:59`) e o sinalizador de export como
`josueSave` (`saveStore.ts:139,150`). Para Brasa, renomear esses literais (ex.: `"brasa"`,
`"brasa-save-v1-..."`, `brasaSave`) num passe de re-tema. Decisão pendente: renomear já (quebra
saves antigos de teste, irrelevante) ou manter por compatibilidade até o slice rodar.
Recomendação `[DESIGN]`: renomear já; não há save de produção a preservar.

`[NORMATIVO]` Settings ficam SEPARADOS do save de progresso, em localStorage
(`SettingsService`, chave `"josue.settings"`, `settingsService.ts:28,47-63`), aplicados no
BOOT. Sobrevivem a apagar saves. Re-tema da chave para `"brasa.settings"` no mesmo passe.
Conteúdo: idioma, volumes, qualidade, escala de UI, reducedMotion/highContrast,
velocidade de texto, e (novo de Brasa, proposta) raio/intensidade da luz como opção de
acessibilidade visual. `[SLICE]`: só idioma e velocidade de texto.

`[SLICE]` A `SaveStore` pode existir como caminho não obrigatório: o slice usa snapshot em
memória para o RETENTAR. A persistência IndexedDB já está pronta para ligar quando quisermos
"Continuar entre sessões".

---

## 9. Carregamento e gerenciador de salas com descarte

`[CÓDIGO]` `[NORMATIVO]` Este é o ponto que NÃO está pronto e é central (CANON 4.1 e 6.2). O
`WorldStreaming` atual (`app/worldStreaming.ts`) carrega regiões por proximidade e
explicitamente NÃO descarta ("Não há descarte em v1", `worldStreaming.ts:6`); só adia carga.

`[DESIGN]` `[NORMATIVO]` Brasa exige um gerenciador de UMA-SALA-ATIVA, acionado pela máquina de
estados no LOADING:
1. A Acendedora cruza a porta destravada (saída do estado BRASEIRO).
2. SM entra em LOADING. O gerenciador carrega a próxima sala (glb modular do Dungeon Kit,
   esqueletos instanciados, braseiro) usando `loadContainer`/`placeModel` de `sceneKit.ts`.
3. Com a próxima pronta, DESCARTA a sala anterior por completo: malhas, materiais, texturas
   instanciadas e corpos de física (CANON 4.1, 4.4). Verificável no inspetor de cena: o número
   de meshes/draw calls não cresce monotonicamente ao descer.
4. SM entra em SALA (penumbra). Repete.

`[NORMATIVO]` Em todo instante há no máximo uma sala de jogo viva (mais a sala de destino
durante a janela de LOADING, que deve ser curta). Teto de < 60 draw calls por sala (CANON
4.1) medido na sala carregada, não na soma.

`[A DEFINIR]` Pré-carregar a próxima sala em segundo plano antes de cruzar a porta (transição
sem barra) vs. carregar só ao cruzar (transição com fade curto). Recomendação `[DESIGN]`:
começar com fade curto (mais simples e seguro para o descarte); medir e otimizar depois.

`[DESIGN]` A sequência de salas da descida (qual sala vem após qual) vive em
`game/content/descent.ts` (CANON 6.4), no lugar do mapa de Josué. O gerenciador consome essa
sequência; o índice `roomIndex` do save (seção 7) aponta para ela.

---

## 10. Tratamento de erro e bordas

- `[NORMATIVO]` Falha ao carregar a próxima sala (glb/asset): não deixar tela preta. Voltar à
  sala atual com aviso, ou ao TITLE se irreparável.
- `[NORMATIVO]` Falha de WebGPU no BOOT: cair para WebGL2 (já feito no motor); se ambos falham,
  tela de incompatibilidade com requisitos.
- `[NORMATIVO]` Perda de foco/aba em segundo plano: pausar automaticamente (entrar em PAUSE)
  para não acumular delta de física.
- `[NORMATIVO]` Sair durante combate ou no meio da descida: confirmar; o RETENTAR/braseiro
  cobre a perda.
- `[NORMATIVO]` `[COMPLETO]` Save corrompido: o motor já tenta o backup e, falhando, descarta o
  slot com aviso sem travar (`saveStore.ts:91-101`). Versão de schema maior que a suportada:
  recusar com aviso, não corromper (a migração só sobe, `saveStore.ts:190-196`).
- `[NORMATIVO]` `[COMPLETO]` Quota de armazenamento cheia (web): avisar e oferecer apagar saves
  antigos (`requestPersistentStorage`/`estimateStorage` já exportados, `platform/index.ts:10`).

---

## 11. Recorte do slice (o mínimo que nasce certo)

`[SLICE]` Implementar apenas:
- A `GameStateMachine` com BOOT, TITLE (mínima), LOADING, SALA, COMBATE, BRASEIRO,
  COMBATE_CHEFE, REAVIVAR_BRASA, DERROTA (retentar em memória), FIM.
- Checkpoint em memória gravado ao acender CADA braseiro e ao entrar na câmara do chefe (para
  o RETENTAR rápido do último braseiro).
- O gerenciador de salas com DESCARTE (seção 9) - este é obrigatório no slice, é o coração da
  leveza e o item que mais difere do motor atual.
- Settings mínimos (idioma, velocidade de texto, raio de luz) em localStorage.
- A `SaveStore` (IndexedDB) já existe e pode ficar ligada para "Continuar entre sessões", ou
  ficar como caminho `[COMPLETO]` se preferirmos só memória no slice.

Recomendação `[DESIGN]`: desenhar a SM e o gerenciador de uma-sala-ativa agora; é barato fazer
certo cedo e caro refatorar depois de 5-7 salas e o chefe prontos. A persistência em disco já
está construída no motor, então ligá-la é trabalho marginal.

---

## 12. Critérios de aceite (funcionais)

- Dá para ir do título ao FIM passando por todos os estados (descida -> sala -> combate ->
  braseiro -> próxima sala -> chefe -> reavivar -> fim) sem estado preso ou tela preta.
- Acender um braseiro acende a luz quente, concede upgrade e destrava a porta, num gesto só.
- Morrer e dar RETENTAR recarrega o último braseiro aceso, com os upgrades de então, sem passar
  por menu de carga.
- Ao descer, o número de salas/meshes carregadas não cresce monotonicamente: a sala anterior é
  descartada (verificável no inspetor de cena).
- `[COMPLETO]` Fechar e reabrir o navegador continua a descida do último braseiro aceso.
- `[COMPLETO]` Um save de versão antiga carrega via migração ou é recusado com aviso, nunca
  corrompe nem trava.
- Perder o foco da aba pausa o jogo.

---

## Checklist de aceite (Definition of Done)

Máquina de estados (seção 2)
- [ ] Existe um único GameStateMachine explícito e toda tela/transição passa por ele (sem flags espalhadas). [DESIGN][NORMATIVO]
- [ ] Todos os estados existem e se comportam conforme a tabela: BOOT, TITLE, LOADING, SALA, COMBATE, BRASEIRO, COMBATE_CHEFE, REAVIVAR_BRASA, DERROTA, FIM, PAUSE, OPCOES. [DESIGN][NORMATIVO]
- [ ] As transições do diagrama são respeitadas, incluindo "qualquer -> TITLE" com confirmação. [DESIGN][NORMATIVO]
- [ ] PAUSE é overlay sobre SALA e não descarrega a sala; LOADING é o único ponto que descarrega/carrega. [DESIGN][NORMATIVO]
- [ ] COMBATE e COMBATE_CHEFE são sub-estados da SALA (a câmara segue carregada), não telas separadas. [DESIGN][NORMATIVO]
- [ ] BOOT carrega engine (WebGPU/WebGL2), Havok e settings salvos antes de ir a TITLE. [DESIGN][NORMATIVO]
- [ ] TITLE destaca "Continuar" quando há descida salva e mostra só "Nova descida" quando não há. [DESIGN][NORMATIVO]
- [ ] DERROTA entra quando vida <= 0 e oferece RETENTAR (último braseiro) e TITLE, sem tela preta. [DESIGN][NORMATIVO]
- [ ] FIM dispara ao reavivar a Brasa (após vencer o Guardião) e leva a desfecho -> TITLE (ou CREDITOS no completo). [DESIGN][NORMATIVO]

Checkpoint = braseiro (seções 1 e 4)
- [ ] O ponto de salvamento é o braseiro aceso: acender salva o checkpoint (ficção e mecânica casadas). [DESIGN][NORMATIVO]
- [ ] Salvar ocorre só no estado BRASEIRO (e no fim da descida); não há save em COMBATE, COMBATE_CHEFE nem durante LOADING. [DESIGN][NORMATIVO]
- [ ] O gatilho de save é único e centralizado (nenhum outro ponto do código grava save). [DESIGN][NORMATIVO]
- [ ] Autosave de braseiro sobrescreve o slot da descida e é o que o RETENTAR usa. [DESIGN][NORMATIVO]

Fluxo de derrota (seção 5)
- [ ] RETENTAR recarrega a sala do último braseiro aceso com os upgrades de então, sem passar por menu. [DESIGN][NORMATIVO]
- [ ] O slice adota o recomeço "do último braseiro" (postura a); roguelite (b) fica registrado como evolução pós-slice. [DESIGN][A DEFINIR]

O que persiste / reseta (seção 6)
- [ ] Persistem na descida: índice da sala, upgrades, vida e contagem de braseiros do último checkpoint. [DESIGN][NORMATIVO]
- [ ] Reseta o conteúdo de salas descartadas (inimigos, baús, props); a sala anterior não volta na run e é remontada limpa ao reavançar. [DESIGN][NORMATIVO]
- [ ] [COMPLETO] O slot da descida sobrevive a fechar/reabrir o navegador (Continuar). [COMPLETO][NORMATIVO]

Modelo de dados e formato (seções 7 e 8)
- [ ] O envelope genérico SaveData da plataforma é reusado sem mudança; o payload game é re-textado para Brasa (descentId, brazierId, roomIndex, braziersLit, upgrades, hero, achievements). [CÓDIGO][DESIGN][NORMATIVO]
- [ ] O save não guarda geometria nem conteúdo de salas, só índices e estado da Acendedora; é pequeno por construção (poucos KB). [DESIGN][NORMATIVO]
- [ ] Toda leitura do payload é defensiva (campo ausente -> default), espelhando readGameSave. [CÓDIGO][NORMATIVO]
- [ ] Persistência web em IndexedDB via LocalSaveStore (1 registro por slot, escrita atômica + backup), atrás da interface SaveStore. [CÓDIGO][NORMATIVO]
- [ ] Envelope versionado com SAVE_SCHEMA_VERSION e migração em cadeia; checksum HMAC quando há WebCrypto; saneamento pós-load. [CÓDIGO][NORMATIVO]
- [ ] Literais "josue" (banco Dexie, segredo HMAC, sinalizador josueSave) re-tematizados para Brasa. [CÓDIGO][A DEFINIR]

Settings (seção 8)
- [ ] Settings ficam em localStorage (SettingsService), separados do save, aplicados no BOOT e sobrevivem a apagar saves. [CÓDIGO][NORMATIVO]
- [ ] Settings cobrem idioma, volumes, qualidade, escala de UI, acessibilidade, velocidade de texto e raio/intensidade da luz. [DESIGN][NORMATIVO]

Carregamento e descarte de salas (seção 9)
- [ ] O worldStreaming.ts é reescrito para um gerenciador de UMA-SALA-ATIVA acionado no LOADING. [CÓDIGO][DESIGN][NORMATIVO]
- [ ] Ao cruzar a porta, a próxima sala carrega e a anterior é DESCARTADA por completo (malhas, materiais, texturas, física). [DESIGN][NORMATIVO]
- [ ] No máximo uma sala de jogo viva por vez; draw calls medidos na sala carregada não crescem monotonicamente ao descer; teto < 60 por sala (CANON 4.1). [DESIGN][NORMATIVO]
- [ ] A sequência de salas vem de game/content/descent.ts e o roomIndex do save aponta para ela. [DESIGN][NORMATIVO]

Tratamento de erro e bordas (seção 10)
- [ ] Falha ao carregar a próxima sala volta à sala atual com aviso (ou ao TITLE), nunca tela preta. [DESIGN][NORMATIVO]
- [ ] Falha de WebGPU no BOOT cai para WebGL2; se ambos falham, mostra tela de incompatibilidade. [DESIGN][NORMATIVO]
- [ ] Perda de foco/aba entra em PAUSE automaticamente. [DESIGN][NORMATIVO]
- [ ] Sair durante combate ou no meio da descida pede confirmação. [DESIGN][NORMATIVO]
- [ ] [COMPLETO] Save corrompido tenta backup e, falhando, descarta com aviso; schema maior é recusado sem corromper. [CÓDIGO][NORMATIVO]
- [ ] [COMPLETO] Quota cheia (web) avisa e oferece apagar saves antigos. [CÓDIGO][NORMATIVO]

Recorte do slice (seção 11)
- [ ] O slice implementa a GameStateMachine completa (boot -> ... -> fim/derrota). [SLICE][NORMATIVO]
- [ ] O slice tem checkpoint em memória ao acender cada braseiro e ao entrar na câmara do chefe (retentar rápido). [SLICE][NORMATIVO]
- [ ] O slice implementa o gerenciador de salas com descarte (item obrigatório). [SLICE][NORMATIVO]
- [ ] O slice tem settings mínimos (idioma, velocidade de texto, raio de luz) em localStorage. [SLICE][NORMATIVO]

Critérios funcionais (seção 12)
- [ ] Dá para ir do título ao FIM passando por todos os estados sem estado preso ou tela preta. [NORMATIVO]
- [ ] Acender um braseiro acende a luz quente, concede upgrade e destrava a porta num gesto só. [NORMATIVO]
- [ ] Morrer e dar RETENTAR recarrega o último braseiro com os upgrades de então, sem menu de carga. [NORMATIVO]
- [ ] Ao descer, salas/meshes carregadas não crescem monotonicamente (descarte verificável no inspetor). [NORMATIVO]
- [ ] [COMPLETO] Fechar e reabrir o navegador continua do último braseiro aceso. [COMPLETO][NORMATIVO]
- [ ] [COMPLETO] Save de versão antiga carrega via migração ou é recusado com aviso, nunca corrompe nem trava. [COMPLETO][NORMATIVO]
- [ ] Perder o foco da aba pausa o jogo. [NORMATIVO]

Transversais (padrão de detalhe, seção 4)
- [ ] Sem travessões, sem emojis em qualquer texto exibido (guia de estilo 1.2). [NORMATIVO]
- [ ] Itens [A DEFINIR] resolvidos ou explicitamente adiados com registro. [NORMATIVO]

Pendências [A DEFINIR]
- [ ] Granularidade do recomeço por derrota: do último braseiro (slice) vs. roguelite/início (pós-slice). [DESIGN][A DEFINIR]
- [ ] Re-tema dos literais "josue" no motor de save (banco, HMAC, flag de export). [CÓDIGO][A DEFINIR]
- [ ] Pré-carregar a próxima sala em segundo plano vs. carregar ao cruzar com fade curto. [DESIGN][A DEFINIR]
- [ ] Meta-progressão entre descidas (se Brasa virar roguelite). [DESIGN][A DEFINIR]
