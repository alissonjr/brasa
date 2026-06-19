# Brasa - Plano de implementacao dos 5 itens de fechamento

Documento de plano para as 5 frentes pendentes apontadas na auditoria de 2026-06-16
(reconciliacao doc x codigo, ver [`00-aprofundamento-e-roadmap.md`](00-aprofundamento-e-roadmap.md)).
Fecha as dividas que sobraram das ondas W4-W6: a parte da W6 que ficou so como blueprint,
a geometria tatil que a W4 deixou de fora ("sem tocar geometria") e a instrumentacao de
performance que e gate normativo do projeto.

Convencao herdada (ver [`guia-de-estilo-e-glossario.md`](guia-de-estilo-e-glossario.md)):
pt-BR, sem travessoes, sem emojis. Procedencia: `[DESIGN]`, `[CÓDIGO]`, `[ASSET]`.
Exigencia: `[NORMATIVO]` (entra no aceite), `[ASPIRACIONAL]`.

Snapshot: 2026-06-16.

---

## 0. Resumo executivo

| # | Item | Estado de partida | Onda |
|---|---|---|---|
| 1 | Fagulha em cargas no HUD + feedback positivo de combate | Fagulha contínua (barra); só vinheta de dano | W2/W6 (DoD 3.1, 3.7) |
| 2 | Stingers + SFX de tell por tipo de inimigo | Só thunk genérico + 3 leitos de música | W6 (3.2, 3.7) |
| 3 | Geometria tátil: nicho de parede, decalque de chão, coreografia de luz | W4 fez só névoa/ambiente por zona | W4 (DoD 3.5) |
| 4 | Gate de performance: draw calls + fps por sala | Só fps global no canto | Gate normativo (seção 4 da bíblia) |
| 5 | Seed por run + leaderboard local + inscrições por proximidade | Jitter por Math.random; sem leaderboard; ecos sim, inscrições não | W5/W6 (3.3, 3.6) |

Ordem de execucao: 1 -> 2 -> 3 -> 4 -> 5 (cada um isolado; nenhum bloqueia o anterior).
Validacao transversal: `npm run build` (tsc + vite) limpo ao fim de cada item.

---

## 1. Fagulha em cargas + feedback positivo de combate

### 1.1 Objetivo
`[DESIGN]` Fechar o DoD 3.1 (Fagulha em cargas no HUD) e o DoD 3.7 (feedback positivo de
combate), que ficaram para tras em W2/W6. Tornar o recurso de fogo legivel num relance e
dar recompensa sensorial a cada acerto/cura/bloqueio bem-sucedido (nao so punicao via
vinheta de dano).

### 1.2 Arquivos e mudancas
- `game/combat/tuning.ts`: `spark` passa a ter `charges: 3` e `regenPerSec` (regenera 1
  carga a cada ~6 s); `emberCost` vira `1` (1 carga por golpe de fogo). Mantem compat com
  o codigo atual que le `spark.max`/`spark.emberCost` reinterpretando-os como cargas.
- `game/combat/heroCombat.ts`: `spark` interno passa a contar cargas (0..3, fracionario na
  regeneracao); `sparkFraction` continua 0..1 para a luz/efeitos; novo getter
  `sparkCharges` (inteiro 0..3) e `sparkChargeMax` para o HUD em pips. `canEmber`/`beginEmber`
  consomem 1 carga. Dádiva "Fagulha Perene" continua multiplicando a regeneracao.
- `game/ui/combatHud.ts`: a barra de FAGULHA vira uma fileira de 3 PIPS (losangos/blocos)
  que acendem/apagam conforme as cargas; pip parcial mostra a regeneracao em andamento.
  Novos metodos `flashHit()` (borda dourada ~200 ms), `flashHeal()` (brilho verde),
  `flashBlock()` (tinta bronze). CSS proprio (o componente ja injeta o seu).
- `game/combat/combatDirector.ts`: ao conectar golpe sem ser bloqueado, emite feedback de
  acerto; ao bloquear (guarded / projetil bloqueado), feedback de bloqueio. A cura
  (essencia, pocao, braseiro) dispara feedback de cura.
- `app/main.ts`: liga os novos eventos do HUD ao `combatHud` (acerto/cura/bloqueio) e passa
  `sparkCharges` na `combatHud.update`.

### 1.3 Criterios de aceite (DoD)
- [ ] `[NORMATIVO]` O HUD mostra 3 pips de Fagulha; cada Golpe de Fogo apaga 1 pip; a
      regeneracao reacende um pip ao longo do tempo; recarrega tudo ao acender o braseiro.
- [ ] `[NORMATIVO]` Acerto sem dano pisca borda dourada (~200 ms) + som; cura dá brilho
      verde + som; bloqueio bem-sucedido dá tinta de bronze + som.
- [ ] O efeito respeita "reduzir flashes" (acessibilidade) quando ligado.
- [ ] Build limpo.

### 1.4 Casos de uso
- CU1: jogador com 3 pips usa Golpe de Fogo 3x seguidas -> fica sem pip -> nao consegue
  usar de novo ate regenerar/acender braseiro.
- CU2: jogador conecta combo de 3 leves -> 3 flashes dourados curtos (recompensa de ritmo).
- CU3: jogador segura bloqueio e apara um golpe -> tinta de bronze + clank (ja existe o som).
- CU4: jogador coleta essencia / bebe pocao -> brilho verde confirma a cura.

---

## 2. Stingers + SFX de tell por tipo de inimigo

### 2.1 Objetivo
`[DESIGN]` Fechar a "lacuna real" da auditoria (3.2): a sala e escura/azul, a leitura do
tell nao pode depender so da cor. Cada arquétipo de inimigo ganha um SOM de tell unico ao
iniciar o golpe; e stingers marcam os momentos-chave (despertar, fagulha pega, avistar o
Guardiao, reavivar a Brasa), conforme biblia-audio (3.7).

### 2.2 Arquivos e mudancas
- `game/combat/combatSound.ts`: nova funcao `tellSound(profile)` onde `profile` e
  "swift" (rogue/espreitador: corte agudo rapido), "heavy" (heavy/brutamonte/sentinela:
  THOOM grave longo), "cast" (conjurador: assobio frio ascendente), "boss" (Guardiao:
  grave dissonante) ou "basic" (minion/warrior/demonio/antigo: swish medio). Sintese pura
  (osc + ruido filtrado), gated pelo volume de sfx, como os outros sons do arquivo.
- `game/actors/enemies/skeleton.ts`: em `startOverhead`/`ranged shot`, chamar `tellSound`
  com o perfil do tipo. Mapa kind -> profile local ao Skeleton (stats ganham `tellProfile`).
- `game/actors/enemies/guardiao.ts`: ao iniciar cada moveset, `tellSound("boss")`.
- `game/audio/stingers.ts` (novo): `playStinger(name)` para
  "despertar" | "fagulha" | "guardiao" | "reavivar", sintetizados (acorde/varredura curta),
  gated pelo volume de MUSICA (sao musicais, nao sfx). AudioContext proprio preguicoso.
- `app/main.ts`: dispara stingers nos pontos certos: despertar (ao `combat.wake` de cada
  sala), avistar Guardiao (ao spawnar o boss), reavivar (na vitoria). "Fagulha pega" =
  ao ganhar uma carga de Fagulha (evento do heroCombat/combatDirector) - opcional e sutil.
- `game/index.ts`: exporta o modulo de stingers.

### 2.3 Criterios de aceite (DoD)
- [ ] `[NORMATIVO]` Cada arquétipo de inimigo toca um SOM de tell distinto ao telegrafar o
      golpe; os 5 perfis (swift/heavy/cast/boss/basic) sao audivelmente diferentes.
- [ ] `[NORMATIVO]` Tocam pelo menos os stingers de despertar dos mortos, avistar o
      Guardiao e reavivar a Brasa, nos momentos certos.
- [ ] Sons respeitam os volumes de sfx (tells) e musica (stingers); mudos com volume 0.
- [ ] Build limpo.

### 2.4 Casos de uso
- CU1: na penumbra, jogador ouve o THOOM grave e recua antes de ver o brutamonte erguer o
  braco (leitura por som).
- CU2: conjurador comeca o cast -> assobio frio avisa que vem projetil -> jogador procura
  cobertura.
- CU3: ao entrar numa sala nova, o stinger de despertar marca que os mortos acordaram.
- CU4: ao reavivar a Brasa (fim), o stinger ascendente sela a vitoria.

---

## 3. Geometria tatil: nicho de parede, decalque de chao, coreografia de luz

### 3.1 Objetivo
`[DESIGN]` Fechar o DoD 3.5 na parte que a W4 deixou de fora (a W4 fez identidade por
nevoa/ambiente "sem tocar geometria"). Dar textura fisica ao espaco: alcova/nicho de
parede, decalque de chao por tipo de sala, e a coreografia frio->quente subindo do chao.
Manter < 60 draw calls (gate do item 4).

### 3.2 Arquivos e mudancas
- `game/scenes/crypt/cryptRoom.ts`:
  - **Nicho de parede**: 1-2 alcovas rasas por sala. Sem asset KayKit de nicho dedicado,
    monta-se a alcova recuando um segmento e emoldurando com peca existente (coluna/lapide)
    + uma ossada/inscricao dentro. Implementado como cluster `clusterNiche()` que usa
    `placeProp` (gravestone/bone) num recuo perto da parede lateral; thin instances quando
    repetido. Custo: poucas malhas, sem estourar draw calls.
  - **Decalque de chao por tipo**: uma malha plana fina (disc/quad) com material emissivo
    suave logo acima do piso (sem z-fight): poca azul-esverdeada translucida na cisterna,
    circulo ritual dourado no santuario, rachaduras irradiando do centro na arena do
    Guardiao. 1 draw call por decalque (malha unica).
  - **Coreografia de luz de baixo para cima**: `setBrazierLit(t)` passa a interpretar `t`
    em ESTAGIOS espaciais: piso/decalque aquecem primeiro (t 0..0.4), depois as luzes de
    parede/braseiro (t 0.4..0.8), por fim a abobada/ambiente (t 0.8..1.0). A sala "respira"
    de baixo para cima ao inves de um lerp uniforme.
- Nenhum asset novo baixado (usa o kit ja em disco), respeitando o pilar "construir com o
  que ja existe".

### 3.3 Criterios de aceite (DoD)
- [ ] `[NORMATIVO]` Cada sala tem >= 1 nicho/alcova de parede com ossada ou inscricao.
- [ ] `[NORMATIVO]` Cisterna, santuario e arena do Guardiao tem decalque de chao proprio
      (poca / circulo / rachaduras).
- [ ] `[NORMATIVO]` Ao acender o braseiro, a luz quente sobe de baixo para cima (chao antes
      da abobada), visivel a olho.
- [ ] `[NORMATIVO]` Draw calls por sala continuam < 60 (verificado pelo item 4).
- [ ] Build limpo.

### 3.4 Casos de uso
- CU1: jogador entra na cisterna e ve a "poca" no chao + nicho com ossada na parede (le
  como cripta inundada, nao caixa generica).
- CU2: ao acender a Brasa, a luz lambe o chao primeiro e sobe pelas paredes ate o teto.
- CU3: na arena do Guardiao, as rachaduras no chao irradiam do centro (tensao de clímax).

---

## 4. Gate de performance: draw calls + fps por sala

### 4.1 Objetivo
`[NORMATIVO]` Cumprir o gate normativo do projeto (projeto-brasa.md seção 4.1: < 60 draw
calls por sala; 60 fps desktop / 30 fps mobile) com MEDICAO real, agora que o item 3 soma
geometria. Hoje so ha fps global no canto; nao ha contagem de draw calls nem por sala.

### 4.2 Arquivos e mudancas
- `app/main.ts` (ou modulo `dev/perfHud.ts` novo): instanciar `SceneInstrumentation` do
  Babylon com `captureFrameTime` e o contador de draw calls. Ao ENTRAR numa sala
  (`enterRoom`), apos o primeiro frame estavel, logar no console
  `[perf] sala N (kind): X draw calls` e avisar se X >= 60. Um overlay de debug discreto
  (ligavel) mostra draw calls + fps + frame time ao vivo, ao lado do fps atual.
- O overlay so aparece com uma flag (ex.: querystring `?perf` ou tecla), para nao poluir o
  jogo normal.

### 4.3 Criterios de aceite (DoD)
- [ ] `[NORMATIVO]` Ao entrar em cada sala, o console registra a contagem de draw calls.
- [ ] `[NORMATIVO]` Overlay de debug (sob flag) mostra draw calls + fps + frame time ao vivo.
- [ ] `[NORMATIVO]` Medicao confirma < 60 draw calls em todas as 7 salas (ou registra
      honestamente onde estoura, com nota do que cortar).
- [ ] Build limpo.

### 4.4 Casos de uso
- CU1: dev abre o jogo com `?perf`, desce as 7 salas e le no console/overlay a contagem por
  sala -> confirma o teto.
- CU2: se uma sala estourar 60 draw calls apos o item 3, o log aponta e orienta o corte
  (menos um cluster, mais um batch).

---

## 5. Seed por run + leaderboard local + inscricoes por proximidade

### 5.1 Objetivo
`[DESIGN]` Fechar o DoD 3.6 (rejogabilidade: seed por run + leaderboard local de tempo) e a
parte de encenacao narrativa que faltou (3.3: inscricoes por proximidade, distintas dos
ecos automaticos ja existentes).

### 5.2 Arquivos e mudancas
- **Seed por run**: `app/main.ts` ganha um `runSeed` (numero) sorteado ao iniciar uma run
  nova e PERSISTIDO no save (RunSave.seed). Um PRNG `mulberry32(seed)` (ja existe em
  `sceneKit.ts`) substitui os `Math.random()` do jitter de posicao dos inimigos e da ordem
  da oferta de dadivas, derivando por `seed + floorIndex`. Mesma seed -> mesma descida.
  - `game/content/saveData.ts`: `RunSave` ganha `seed: number` (com default seguro).
- **Leaderboard local**: `game/content/leaderboard.ts` (novo) le/grava em localStorage
  (try/catch, sem tocar o save Dexie/HMAC): top 5 tempos (segundos) de descida VENCIDA.
  `app/main.ts` cronometra a descida (de `enterRoom(0)`/startGame ate `descentDone`) e, na
  vitoria, registra o tempo e mostra a posicao + top 5 na tela de vitoria.
  - `game/index.ts` exporta o modulo de leaderboard.
- **Inscricoes por proximidade**: cada sala expoe um ponto de inscricao
  (`Room.inscription?: { x, z, text }`) numa lapide/placa/nicho. `app/main.ts` detecta a
  proximidade do heroi e mostra um prompt discreto ("[ler] ...") com o texto curto gravado
  na pedra (estilo fragmentario do guia), 1 por andar, DISTINTO do eco automatico (o eco e
  a voz/memoria ao ENTRAR; a inscricao e o texto que o jogador escolhe ler ao se aproximar).
  Textos por andar coerentes com o canon (povo morto -> alguem desceu -> o custo -> verdade).

### 5.3 Criterios de aceite (DoD)
- [ ] `[NORMATIVO]` Uma run tem seed persistida; recarregar a run reproduz as mesmas
      posicoes de inimigo e a mesma ordem de oferta de dadivas.
- [ ] `[NORMATIVO]` Vencer a descida registra o tempo num leaderboard local (top 5) que
      sobrevive a fechar o jogo; a tela de vitoria mostra o tempo e o ranking.
- [ ] `[NORMATIVO]` Cada andar tem 1 inscricao lida por proximidade, distinta do eco; o
      texto e curto e coerente com o canon.
- [ ] Build limpo.

### 5.4 Casos de uso
- CU1: jogador morre e recomeca o andar -> os mortos surgem nas mesmas posicoes (seed
  estavel), em vez de embaralhar a cada tentativa.
- CU2: jogador vence em 7 min -> entra no top 5; vence de novo mais rapido -> sobe no
  ranking; fecha e reabre o jogo -> ranking persiste.
- CU3: jogador se aproxima de uma lapide -> prompt "[ler]"; ao ler, ve a inscricao gravada
  (ex.: "Aqui jaz quem guardou o fogo. Que o frio nunca a alcance.").

---

## 6. Validacao transversal

`[NORMATIVO]` Ao fim de cada item e ao fim do conjunto:
- `npm run build` (tsc estrito + vite) sem erros.
- Os DoD de cada item marcados sim/nao honesto.
- Nenhum travessao/emoji em texto exibido (guia de estilo).
- Draw calls < 60 por sala (item 4 valida o item 3).

---

## 7. Status de implementacao (2026-06-16)

`[CÓDIGO]` Implementado e validado por `npm run build` (tsc estrito + vite) LIMPO (exit 0).

**Item 1 - Fagulha em cargas + feedback positivo:** FEITO.
- `tuning.ts`: `spark` agora `{ charges: 3, regenPerSec: 1/6, emberCost: 1 }`.
- `heroCombat.ts`: cargas (0..3, fracionario na regen); getters `sparkCharges`/`sparkChargeMax`;
  `gainSparkCharge()` (matar repoe 1 carga); ember consome 1 carga.
- `combatHud.ts`: 3 PIPS de Fagulha (pip parcial mostra a regen); moldura `flashHit` (ouro),
  `flashHeal` (verde), `flashBlock` (bronze), ~200 ms; `setReducedFlashes` para acessibilidade.
- `combatDirector.ts`: emite `hero:heal`/`hero:block`; `healChime`; ganha Fagulha ao matar.
- `main.ts`: liga os eventos ao HUD; flashHeal+chime em poção/braseiro; reduced-flashes de prefs.

**Item 2 - Stingers + SFX de tell por tipo:** FEITO.
- `combatSound.ts`: `tellSound(profile)` com 5 perfis (swift/heavy/cast/boss/basic).
- `skeleton.ts`: `tellProfile` por tipo, tocado em `startOverhead`. `guardiao.ts`: tell "boss".
- `audio/stingers.ts` (novo): `despertar` / `guardiao` / `reavivar` / `fagulha`, gated pelo
  volume de musica. `main.ts` dispara nos momentos certos.

**Item 3 - Geometria tatil:** FEITO.
- `cryptRoom.ts`: nicho/alcova de parede (recesso escuro + lápide + caveiras, >=1 por sala,
  posição exposta como `inscriptionPos`); decalque de chão por tipo (poça na cisterna, círculo
  no santuário, rachaduras na arena do Guardião); `setBrazierLit` reescrito em coreografia de
  baixo para cima (chão/decalque -> oferendas/névoa -> abóbada/ambiente).

**Item 4 - Gate de performance:** INSTRUMENTADO; medicao ao vivo PENDENTE de navegador.
- `dev/perfHud.ts` (novo): SceneInstrumentation; LOGA draw calls por sala ao entrar (com aviso
  se >= 60); overlay ao vivo (draw calls/fps/frame ms) sob `?perf` ou tecla F9.
- `main.ts`: instanciado, `logRoom` em `enterRoom`, `update` no render loop.
- NOTA honesta: nao ha navegador headless neste ambiente, entao a CONFIRMACAO numerica das 7
  salas < 60 deve ser feita rodando `npm run dev` com `?perf`. A instrumentacao ja registra e
  alerta automaticamente; o item 3 somou ~3-4 draw calls por sala (decalque + recesso + lápide).

**Item 5 - Seed + leaderboard + inscricoes:** FEITO.
- Seed por run: `RunSave.seed` (persistido); `mulberry32` semeia o jitter de posicao
  (`runSeed + andar`) e a ordem da oferta de dadivas (`runSeed + andar`). Mesma run reproduz.
- Leaderboard: `content/leaderboard.ts` (localStorage, top 5 tempos); cronometra a run jogada
  do começo (`timedRun`); tela de vitoria mostra tempo + ranking (`showVictory`).
- Inscricoes: `INSCRIPTIONS[7]` (canon), lidas por proximidade do nicho (`inscriptionPos`),
  distintas dos ECHOES de entrada.
