# Spec: Profundidade e Variedade (anti-raso)

Status das marcações: [NORMATIVO] decidido e a implementar; [ASPIRACIONAL] meta de
qualidade sem prazo; [A DEFINIR] depende de playtest/assets.

Este documento existe por um motivo direto: em playtest o jogo "sente raso". Esta spec
nomeia POR QUE, fixa as alavancas de correção em ordem de impacto e define o "pronto"
(DoD) de cada uma. É a fonte de verdade do trabalho de profundidade; specs irmãs
(spec-set-pieces, spec-vertical-slice-cripta, game-design-e-sistemas) detalham peças.

## 1. Diagnóstico honesto (por que sente raso)

Auditoria do código atual (`cryptRoom.ts`, `main.ts`) e dos assets em disco:

1. [NORMATIVO] **Uma única planta de sala, reskined 7 vezes.** `buildCryptRoom()` usa
   SEMPRE o mesmo layout-base: caixa 24x24 (HALF=12), mesmas posições de parede, mesmos
   6 pilares, altar fixo em z=9.2, alçapão em z=6, spawn em z=-9. O que varia por
   `def.kind` é só QUAL conjunto de móveis (clusters) aparece sobre a planta idêntica.
   Resultado: toda sala lê como "a mesma sala com outros móveis". ESTA é a causa nº 1 da
   sensação de repetição, não a falta de assets.
2. [NORMATIVO] **Condição de vitória única e rasa.** Toda sala = "mate todos -> pise no
   alçapão". Sem objetivos, sem variação de ritmo, sem tensão crescente que não seja "mais
   inimigos". Não há "missão" - só um abate em série.
3. [NORMATIVO] **Campanha curta e plana.** 7 salas, escalada só pelo número de inimigos
   (1,3,5,6,4,5,4). Sem ato/bioma, sem marco, sem clímax mecânico (o "chefe" ainda é um
   esqueleto grande).
4. [NORMATIVO] **Variedade de inimigos é cosmética.** Todos os tipos são o mesmo esqueleto
   KayKit com stats diferentes e um golpe de cima. Sem arquétipos de comportamento
   (à distância, invocador, veloz, escudeiro real) que mudem COMO se joga a sala.
5. [ASPIRACIONAL] **Salas pequenas e fechadas.** Caixa única 24x24, sem corredores,
   antecâmaras, desnível, nem linhas de visão longas. Espaço de combate sempre igual.
6. [NORMATIVO, parcialmente falso] **"Assets ignorados".** Falso no atacado: a sala usa
   ~53 das ~82 peças KayKit em disco. VERDADE: (a) as pastas `public/models/fauna` e
   `public/models/npc` são placeholders vazios; (b) nunca puxei a biblioteca Quaternius
   (CC0) que multiplicaria a variedade de inimigos, arquitetura e natureza. Corrigido em
   paralelo (aquisição Quaternius).

Conclusão: o problema é ARQUITETURAL (uma planta + uma regra de vitória + escalada só
numérica), e secundariamente de VARIEDADE de catálogo (inimigos e biomas). Não é "faltou
encher a sala de tranqueira".

## 2. Alavancas, em ordem de impacto

### A. [NORMATIVO] Plantas de sala distintas (mata a repetição)
Quebrar a planta única em um conjunto de LAYOUTS de verdade, escolhidos por `kind`/índice:
- `salao_longo`: retângulo longo (ex.: 18x34), combate em corredor, altar no fundo distante.
- `cripta_pilares`: salão com floresta de pilares (cobertura, flanqueio, linhas de visão quebradas).
- `camaras`: 2-3 câmaras menores ligadas por arcos/portas (limpa-uma-abre-a-próxima dentro do andar).
- `cisterna`: planta com fosso/água central e passarelas (espaço negativo, perigo de borda).
- `arena_guardiao`: arena ampla e simétrica para o chefe (raios de ataque, sem cantos seguros).
Cada layout define: dimensões, posições de parede/colisor, pilares, altar, alçapão, spawn,
e pontos de spawn de inimigo. O dressing por `kind` continua por cima (clusters atuais).
DoD: ao descer, a silhueta/forma da sala muda visivelmente entre andares; nenhum par de
andares consecutivos compartilha a mesma planta; sem vazamento de malha (contagem estável
após dispose); anda-se sem travar em colisor fantasma.

### B. [NORMATIVO] Arquétipos de inimigo (muda COMO se joga)
Acrescentar comportamento, não só stats. Mínimo:
- `atirador` (à distância): mantém distância, projétil telegrafado; força fechar espaço.
- `invocador`: fica atrás, gera minions; prioridade de alvo.
- `veloz/rogue`: investida e recuo; pune ganância.
- `escudeiro`: bloqueio frontal real (já existe semente em `guards`); força flanco/pesado/fogo.
Usar modelos Quaternius para diferenciar a SILHUETA de cada arquétipo.
DoD: pelo menos 3 arquétipos com IA distinta da atual; cada um exige uma resposta
diferente do jogador; bestiário (`biblia-bestiario.md`) atualizado.

### C. [NORMATIVO] Objetivo de sala além de "mate todos"
Variar a condição de avanço por sala:
- `acender N braseiros` (já é o tema da Brasa - tornar mecânico): a sala só abre quando os
  braseiros estão acesos; inimigos defendem os braseiros.
- `sobreviver a ondas` (tempo/contagem).
- `escolta/relíquia`: levar a chama a um ponto.
- `caçada`: matar o alvo marcado (mini-chefe) entre a horda.
DoD: pelo menos 2 tipos de objetivo além de "mate todos" em uso na campanha; HUD comunica
o objetivo e o progresso; a fantasia (acender a cripta) aparece na mecânica, não só na arte.

### D. [NORMATIVO] Campanha mais longa e estruturada em atos/biomas
- 3 atos com identidade visual distinta (ex.: guarnição -> catacumba tomada pela natureza
  -> santuário profundo), usando packs/arquitetura diferentes por ato.
- Marco no fim de cada ato (mini-chefe ou set-piece de set-piece).
- Alongar de 7 para ~9-12 andares com curva de pico/alívio (não monotônica).
DoD: 3 biomas visualmente distintos; 2 marcos + 1 clímax; curva de dificuldade com vales
de alívio documentada; duração de uma run honesta (não "acaba rápido demais").

### E. [ASPIRACIONAL] Chefe Guardião real
Implementar `spec-chefe-guardiao.md`: fases por luz, ataques de área, arena própria.
DoD: ver spec-chefe-guardiao (fases, telegrafia, recompensa).

### F. [NORMATIVO] Variedade de catálogo (Quaternius CC0)
Integrar packs Quaternius para: novos inimigos (silhuetas distintas por arquétipo),
arquitetura modular (alavanca A) e natureza/decay (quebrar a monotonia de cripta).
DoD: assets CC0 baixados, licenciados em ASSETS-LICENSE.md, e EM USO no jogo (não só em
disco); cada novo inimigo com AnimationGroups validados.

## 3. Ordem de execução recomendada

1. F (assets Quaternius) - foundational, roda em paralelo, já iniciado.
2. A (plantas distintas) - maior impacto na queixa principal (repetição).
3. B (arquétipos de inimigo) - maior impacto na profundidade de jogo.
4. C (objetivos de sala) - dá propósito; casa com a fantasia da Brasa.
5. D (atos/biomas + comprimento) - usa A+B+F para diferenciar atos.
6. E (chefe real) - clímax.

## 4. Não-metas (para não inchar)

- Não virar mundo aberto nem geração 100% procedural. Layouts são um conjunto curado
  (handcrafted), com pequena variação semeada - previsível e testável.
- Não perder a leveza: continua uma sala por vez, com dispose; orçamento de draw calls e
  malhas vigiado (instâncias finas para repetição).
- Não esculpir assets à mão: só CC0/Tripo (ver memória do projeto).
