# Spec de implementação: as 5 lacunas de maior impacto

Status: [NORMATIVO] decidido e a implementar. Este documento aterrissa, em termos de
CÓDIGO deste repositório, as cinco lacunas de maior impacto apontadas pela auditoria
(ver spec-profundidade-e-variedade e as bíblias citadas). Cada item: intenção, mecânica
concreta com números, arquivos/símbolos a tocar e Definition of Done (DoD).

Ordem de execução (alavancagem): 1) Luz fria->quente (enabler) -> 2) Persistência da run
-> 3) Chefe Guardião -> 4) Set-pieces + dissolução -> 5) Música dinâmica.

---

## 1. Luz fria->quente ao acender o braseiro (+ luz-fagulha do herói)

Intenção: o pilar "a luz é a mecânica e a emoção". A sala VIVE em dois estados: fria
(combate, braseiro apagado, azul-cripta) e quente (limpa + braseiro aceso, âmbar). Acender
é uma INTERAÇÃO canalizada, não pisar num feixe.

Mecânica:
- Entrada na sala: braseiro APAGADO; ambiente/fog frios (já são azulados). A chama do altar
  não existe ainda (núcleo + PointLight desligados).
- Limpar a sala: a passagem ainda NÃO abre. Surge o prompt "Acender a Brasa" sobre o altar.
- Acender (canalizado ~1,3s): a Acendedora vai até o altar (raio ~3 m) e segura a tecla de
  interação (E reaproveitada? não - E é fogo; usar tecla nova "interact" = KeyF? F é fogo
  alt. Usar "interact" = KeyE conflita. Decisão: ação nova `interact` em ["KeyR","Enter"]).
  Durante a canalização, barra de progresso; se tomar dano, cancela (mas a sala está limpa,
  então sem risco - reservado para futuro com hazards).
- Ao completar: VIRADA de luz em ~0,8-1,2s (lerp):
  - PointLight do braseiro sobe de 0 -> alvo (2.4, boss 3.0).
  - fog: cor lerp de #1a2636 (frio) para um tom mais quente/levantado; densidade leve queda.
  - ambiente (Hemispheric) esfria a intensidade (de ~0,62 para ~0,40) e a chave direcional
    cai um pouco - o quente passa a vir do braseiro, não do céu.
  - núcleo emissivo da chama aparece (escala 0->1).
  - SÓ ENTÃO abre a passagem (setCleared) e libera a descida.
- Luz-fagulha do herói: PointLight quente (#FFA63D, raio ~3,5, intensidade ~0,4) preso ao
  root da Acendedora, sem sombra. Bolha de visibilidade móvel; existe o tempo todo.

Arquivos/símbolos:
- `cryptRoom.ts`: o braseiro nasce apagado; `setCleared` (ou novo `igniteBrazier(t)`) faz a
  virada interpolada (expor um método que recebe progresso 0..1 e seta luz/fog/emissivo).
  Guardar referências da PointLight do braseiro, do material emissivo do núcleo e das cores
  de fog frio/quente. Estado por andar.
- `acendedora.ts` ou `main.ts`: luz-fagulha do herói (PointLight parented).
- `inputState.ts`: ação `interact` (KeyR/Enter).
- `main.ts`: substituir o "pisar no feixe" pela interação canalizada; ao concluir, animar a
  virada (lerp por dt) e então abrir a passagem; HUD de progresso de canalização.

DoD: sala entra fria com braseiro apagado; limpar mostra "Acender"; canalizar acende com
virada de cor/luz visível (cross-fade ~1 s); só depois a passagem abre; herói tem luz
própria; sem regressão de performance (1-2 luzes dinâmicas/sala). tsc limpo; render mostra
o antes/depois.

---

## 2. Persistência da run

Intenção: fechar/continuar mantém a descida. Hoje Fagulha/dádivas/poções/andar só vivem em
memória no `main.ts`.

Mecânica:
- Estado serializável da run: `{ floorIndex, fagulhas, inv:{vida,furia}, upgrades:[] }`. Os
  upgrades precisam ser reaplicáveis -> guardar a LISTA de ids de dádiva compradas (e poções)
  e, ao carregar, reaplicar `apply()` em ordem (idempotente por reconstrução do herói).
- Checkpoint = braseiro aceso: ao concluir uma descida (advance), grava o estado.
- "Continuar" no menu: se há run salva, retoma no `floorIndex` salvo com Fagulha/upgrades;
  senão, novo jogo.
- `retryFloor` continua em memória (sessão), mas agora o autosave cobre fechar o jogo.

Arquivos/símbolos:
- `saveData.ts` (platform): estender o schema com um bloco `run?` (bump SAVE_SCHEMA_VERSION
  com migração tolerante: ausência de `run` = sem run em andamento).
- `main.ts`: serializar/desserializar a run; reaplicar upgrades ao herói recém-criado; ligar
  ao autosave e ao "Continuar".

DoD: comprar dádivas/poções, descer 2 andares, recarregar a página e "Continuar" retoma no
andar certo com Fagulha/dádivas/poções; schema versionado com migração; tsc limpo.

---

## 3. Chefe Guardião (3 fases por luz)

Intenção: clímax real, não "mais esqueletos". Baseado em `spec-chefe-guardiao.md`.

Mecânica (resumo executável):
- Ator `Guardiao` (novo) com vida alta (ex.: 600), barra de chefe no HUD, em arena (andar 6
  já é forma "arena_36"). Sem morte permanente de minions: é 1 contra 1 (talvez + adds).
- 3 FASES por faixa de vida (100-66 / 66-33 / 33-0) espelhadas no tema da LUZ:
  - Fase 1 (fria): runas ciano, golpes lentos e MUITO legíveis (marreta descendente, varredura).
  - Fase 2 (tiço): fendas #C8401C, adiciona gancho/puxão e um sopro de escuro (AoE que
    "apaga" e dá dano em área telegrafada por decalque).
  - Fase 3 (quente): corpo laranja-brasa, combos 2-3, mais agressivo, janelas menores.
- Telegrafia por emissivo/escala + tempo de antecipação maior que o dos comuns.
- Recompensa ao vencer: encena o reavivar (item 4) e conclui o slice.

Arquivos/símbolos:
- `actors/enemies/guardiao.ts` (novo): FSM própria (idle/telegrafa/golpe/recupera/fase) sobre
  os mesmos utilitários (AttackState, Health). Reutiliza o pipeline de acerto do
  CombatDirector (implementa CombatTarget; expõe ataques que ferem o herói como o Skeleton).
- `combatDirector.ts`: suportar o chefe (lista já é genérica; o chefe pode ser um Skeleton
  especial OU um tipo à parte adicionado a `targets`).
- `combatHud.ts`: barra de chefe (nome + vida).
- `main.ts`: andar 6 instancia o Guardião em vez do ROSTER comum; vitória encadeia o reavivar.
- Modelo: usar um Quaternius grande (ex.: `mushroomking`/`yeti`/`orc_skull`) escalado, ou
  `sentinela` (Skeleton_Warrior grande) como base visual.

DoD: andar 6 spawna 1 Guardião com barra de chefe; 3 fases visíveis (cor/telegrafia mudam);
pelo menos 3 golpes distintos telegrafados, 1 deles AoE com decalque; vencer encadeia o fim;
tsc limpo; render mostra o chefe.

---

## 4. Set-pieces + dissolução dos mortos

Intenção: alma narrativa e peso à morte. Baseado em `spec-set-pieces.md`.

Mecânica:
- Abertura (andar 0): breve encenação - fade-in, a câmera revela a Acendedora; texto curto
  ("A última brasa desce ao poço."). Sem cutscene cara: fade + texto + a luz-fagulha.
- Despertar por sala: ao entrar, os mortos começam CAÍDOS/agachados e "se erguem" (anim de
  awaken ou um pequeno lerp de escala/altura) com um stinger, antes de ativar a IA (~0,8s).
- Acender: já coberto pela virada de luz (item 1); o texto/eco entra aqui.
- Reavivar (após o chefe): maior delta de luz - a tela vai do frio ao quente pleno, texto de
  desfecho ("A Brasa voltou a arder."), e a vitória.
- Ecos/memórias (1 por andar): uma inscrição/sussurro - um pequeno prompt de lore ao passar
  por um ponto (reaproveita o codex). Versão mínima: um texto flutuante ao entrar em certos
  andares.
- Dissolução dos mortos: ao morrer, em vez de só encolher, dissolver (fade do material +
  partículas de poeira de osso). Versão pragmática: lerp de visibilidade/alpha + um burst de
  partículas do ImpactFx + afundar levemente.

Arquivos/símbolos:
- `skeleton.ts`: `updateDead` -> dissolução (alpha/visibility lerp + burst) em vez de só escala.
- `main.ts`: encenação de abertura, despertar por sala (atraso da IA + anim), reavivar no fim,
  ecos por andar (texto).
- (Opcional) usar a anim `awaken` que o Skeleton já procura.

DoD: abertura com texto/fade; mortos se erguem ao entrar (atraso curto da IA); morte dissolve
(não só some); reavivar encenado ao vencer; ao menos um eco textual por bioma; tsc limpo.

---

## 5. Música dinâmica em camadas

Intenção: trilha adaptativa por estado (o que mais faz soar inacabado é a ausência dela).
Baseado em `biblia-audio.md`. Sem middleware - WebAudio puro, gerado proceduralmente
(o projeto já sintetiza SFX em `combatSound.ts`), pois não há assets de música em disco.

Mecânica:
- Music manager com CAMADAS sintetizadas (osciladores/ruído com ganho por camada) num mesmo
  pulso, cross-fade logarítmico por estado:
  - `bed_frio`: drone grave + harmônicos vazios (penumbra/exploração).
  - `tension`: sobe ao entrar em combate (inimigos vivos) - adiciona pulso/percussão leve.
  - `quente`: ao acender o braseiro, cross-fade para um tom mais cheio/morno por alguns
    segundos (alívio), depois volta ao bed.
- Estado dirigido por eventos já existentes: combate (enemiesAlive>0), braseiro aceso
  (evento do item 1), título (silencia).
- Stingers curtos: avistar/derrotar o Guardião, reavivar (item 4).
- Respeita o mixer/volume das settings e o "reduzir flashes/movimento" não se aplica; volume
  master sim.

Arquivos/símbolos:
- `game/audio/musicManager.ts` (novo) + `configureMusic`/`startMusic`/`setMusicState`.
- `main.ts`: trocar o estado da música nos pontos certos (entrar em combate, acender, título,
  chefe, reavivar).
- Integrar ao volume de música das settings (se houver bus; senão, um ganho master próprio).

DoD: música começa fria na sala, sobe em combate, faz cross-fade quente ao acender, silencia
no título; controlável por volume; sem estouro de vozes (poucos osciladores); tsc limpo.

---

## Notas transversais

- Sem em-dash/en-dash, sem emojis, pt-BR (regras globais).
- Orçamento: 1-2 luzes dinâmicas por sala; poucos emissores; música com poucos osciladores.
- Cada item entra com `tsc --noEmit` limpo e, quando visual, um render de verificação.
- Itens fora de escopo do slice (lock-on, parry, meta-progressão entre runs) NÃO entram aqui.
