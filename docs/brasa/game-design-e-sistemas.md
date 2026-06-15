# Game Design e Sistemas - Brasa

Documento de design dos sistemas de jogo de **Brasa**. Detalha pilares, o laço central
(laço de uma sala e laço da descida), os sistemas macro (combate melee, exploração
sala-a-sala, acender braseiro, progressão por fagulha, recursos, dificuldade e ritmo), a
economia de risco-recompensa, condições de vitória e derrota, rejogabilidade, e como cada
sistema se ancora no orçamento de performance. Mestre da ficção e do escopo:
[`projeto-brasa.md`](../projeto-brasa.md). Régua de detalhe e marcação de exigência:
[`padrao-de-detalhe.md`](../padrao-de-detalhe.md).

Convenção (herdada do CANON): pt-BR, sem travessões, sem emojis. Procedência `[DESIGN]`
(decisão criativa), `[CÓDIGO]` (observado no motor do protótipo), `[ASSET]` (procede de um
pacote pronto). Exigência `[NORMATIVO]` (entra no aceite, verificável), `[ASPIRACIONAL]`
(mood/intenção), `[A DEFINIR]` (decisão pendente).

Snapshot: 2026-06-14.

---

## 1. Pilares de design

`[NORMATIVO]` Os pilares são critérios de decisão. Toda escolha de sistema, conteúdo ou
escopo se mede contra eles, nesta ordem. Os dois primeiros vêm direto da bíblia
(`projeto-brasa.md` seção 2) e mandam sobre os demais.

1. **Leve no navegador acima de tudo.** É o critério número um do projeto. Uma só sala
   carregada por vez com descarte da anterior, low-poly KayKit, atlas único por pacote,
   instanciamento de inimigos e props, 1-2 luzes dinâmicas por sala. O orçamento da seção
   10 é requisito de aceite, não meta opcional. Quando um sistema novo conflitar com a
   leveza, o sistema cede, não o orçamento.
2. **Construir com o que já existe.** Todo asset vem de pacote CC0 pronto (KayKit primeiro,
   Kenney/Quaternius como reforço). O motor do protótipo (`prototipo/src`) é reaproveitado
   por inteiro: combate melee, FSM de IA, câmera de 3a pessoa, física Havok, save, HUD.
   Nada de modelar gente, inimigos ou cenário à mão, nada de gastar Tripo.
3. **A luz é a mecânica e a emoção.** Cada sala nasce penumbra fria e azul; acender o
   braseiro a devolve quente e laranja. O contraste frio-azul (morte, escuro) contra
   laranja-quente (Brasa, vida) não é só direção de arte: é o sinal de que a sala foi
   vencida, o gatilho de upgrade, e o destravamento da saída. Sistema e tom andam juntos.
4. **Laço pequeno e completo antes de conteúdo.** Uma descida curta jogável de ponta a
   ponta (entrar, combater, acender, descer, chefe, reavivar a Brasa) vale mais que muitos
   andares pela metade. O vertical slice de 5 a 7 salas mais o Guardião é o alvo.
5. **Tensão por escassez de luz, não por números inflados.** A dificuldade nasce do escuro
   que avança, do combate melee corpo a corpo e da decisão de quando arriscar, não de
   esponjas de dano. Leitura clara da silhueta e telegrafia do golpe acima de complexidade.

`[ASPIRACIONAL]` Sentimento-alvo: descer é frio, solitário e tenso; acender o braseiro é
alívio morno e breve; descer de novo retoma a tensão. O jogo respira nesse pulso.

---

## 2. O laço central de jogo

`[DESIGN]` `[NORMATIVO]` Brasa tem dois laços aninhados: o **laço de uma sala** (a unidade
de jogo, repetida a cada câmara) e o **laço da descida** (a sessão inteira, do topo do
poço-cripta até reavivar a Brasa). O laço de sala é o que o jogador sente segundo a
segundo; o laço da descida é o que dá arco, progressão e fim.

### 2.1 Laço de uma sala (a unidade de jogo)

`[DESIGN]` `[NORMATIVO]` Sequência fixa de uma câmara, na ordem:

1. **Entrar e selar.** A Acendedora cruza uma porta de pedra que se fecha atrás dela com
   som grave de pedra contra pedra. A sala está em penumbra: 1 luz-chave fria e azul, raio
   curto, leitura difícil das bordas. Não há volta: a porta de trás está selada.
2. **Despertar.** Os mortos da câmara despertam (1 a N esqueletos conforme o andar e o tipo
   de sala, seção 4). O despertar é telegrafado (a malha se ergue, som seco de ossos) para
   o jogador ler de onde vem a ameaça antes de apanhar.
3. **Limpar (combate melee).** O jogador usa o combate corpo a corpo existente (ataque
   leve, esquiva, hit-stop, feedback de impacto) para eliminar todos os esqueletos. A sala
   só prossegue com a câmara limpa.
4. **Acender o braseiro.** Com a sala limpa, o braseiro central fica interagível (prompt de
   interação). Acendê-lo dispara, na mesma batida: (a) a luz da sala vira quente e laranja,
   raio maior, sala legível e acolhedora; (b) concede a recompensa do andar (recurso e/ou
   escolha de upgrade, seção 6); (c) destrava a porta de saída.
5. **Cruzar e trocar.** A porta de saída abre. Ao cruzá-la, a sala anterior inteira (malhas,
   materiais, texturas instanciadas, corpos de física, atores) é DESCARREGADA e a próxima é
   carregada. O laço recomeça.

`[ASPIRACIONAL]` O acender é o respiro: o único momento da sala em que o jogador não está
sob ameaça e a luz está quente. Curto de propósito; cruzar a porta retoma o frio.

`[NORMATIVO]` Estados de uma sala (máquina simples, vale para HUD, áudio e luz):
`SELANDO` -> `COMBATE` -> `LIMPA` -> `ACESA` -> `SAINDO`. A transição `LIMPA -> ACESA` é a
interação do braseiro; só ela troca a luz de fria para quente e libera a porta.

### 2.2 Laço da descida (a sessão)

`[DESIGN]` `[NORMATIVO]` A descida encadeia laços de sala num arco:

1. **Topo do poço-cripta.** A Acendedora começa com a fagulha, estado base de vida, dano e
   raio de luz. Sala de abertura ensina o laço (combate leve, acender, descer).
2. **Descida (5 a 7 salas).** Cada sala aplica o laço de sala. O ritmo alterna picos de
   combate, respiros (corredor/antecâmara) e marcos de recompensa (santuário do braseiro),
   conforme a curva da seção 7. A cada braseiro a Acendedora fica um pouco mais forte e o
   raio de luz cresce: a descida fica mais perigosa (inimigos mais numerosos) mas o
   jogador, mais capaz.
3. **Câmara do Guardião (clímax).** O fundo do poço guarda o Guardião da Brasa apagada,
   chefe único. Combate longo, leitura de fases por silhueta e cor.
4. **Reavivar a Brasa (fim).** Vencido o Guardião, a Acendedora reacende a Brasa: a luz
   quente sobe pelo poço. Fim do vertical slice. Tela de desfecho e estatísticas da descida.

`[DESIGN]` O arco emocional da descida espelha a ficção: quanto mais fundo, mais frio,
escuro e povoado de mortos; o fim inverte tudo de uma vez quando a Brasa sobe.

### 2.3 Diagrama textual do encaixe

```
DESCIDA: [Abertura] -> [Sala 2] -> ... -> [Sala 6/7] -> [Guardião] -> [Reavivar a Brasa = FIM]
                |          |                    |
                v          v                    v
SALA (cada):  Entrar/selar -> Despertar -> Limpar(melee) -> Acender braseiro -> Cruzar/trocar
                                                              (luz fria->quente,
                                                               upgrade, destrava saída)
```

---

## 3. Sistema: combate melee

`[CÓDIGO]` `[NORMATIVO]` Reaproveita o combate do protótipo (`engine/combat/*`:
attack, hitbox, health, hitStop; `game/combat/*`: heroCombat, combatDirector, combatSound,
impactFx, healthBar3d, tuning). Não se constrói combate novo: re-textura e ajuste de tuning.

`[DESIGN]` Princípios para Brasa:

- **Melee é a única via.** A Acendedora luta corpo a corpo (arma branca do KayKit
  Adventurer). Sem armas à distância no slice; mantém o jogador dentro do raio de luz e a
  tensão alta. `[A DEFINIR]` se uma habilidade de fagulha (golpe de luz em área, gasta
  recurso) entra no slice ou fica para depois.
- **Verbos mínimos:** ataque leve (cadeia de 2-3 golpes), esquiva/recuo com i-frames
  curtos, e travar alvo opcional. Feedback obrigatório por golpe: hit-stop, partícula de
  impacto, som, e leve recuo do inimigo.
- **Telegrafia do inimigo.** Esqueletos avisam o golpe pela animação (recuo do braço, pausa)
  antes de acertar; o jogador lê e esquiva. Dificuldade vem do timing e do número, não de
  dano oculto.
- **Esqueleto único.** `[ASSET]` Todo inimigo é o esqueleto KayKit, mesma malha
  instanciada, mesmo esqueleto e mesma biblioteca de animação do herói
  (`AnimationLibrary_Godot_Standard.gltf`). Variação por escala, cor de atlas, arma e
  parâmetros de FSM, não por modelos diferentes (protege o orçamento).

`[CÓDIGO]` IA pela FSM existente (`engine/ai/fsm`): percepção, aproximação, ataque, recuo.
O inimigo `defender.ts` (hoje cápsula com caixas) é trocado pela malha Skeleton mantendo a
FSM (ver `projeto-brasa.md` 6.2).

`[ASPIRACIONAL]` <= 8 esqueletos animando ao mesmo tempo por sala, para conter custo de
skinning na CPU. Ratificar como `[A DEFINIR]` depois de medir.

---

## 4. Sistema: exploração sala-a-sala

`[DESIGN]` `[NORMATIVO]` A exploração é a navegação entre câmaras seladas, uma carregada por
vez. Não há mapa aberto nem retorno: a descida é em sentido único, porta a porta. Isso é o
coração da leveza (seção 10) e a premissa narrativa ao mesmo tempo.

`[DESIGN]` Tipos de sala (do CANON, montados com o Dungeon Remastered Pack):

| Tipo de sala | Conteúdo | Função no ritmo |
|---|---|---|
| Câmara de guarda | 2-4 esqueletos, braseiro | combate base, ensina o laço |
| Corredor / antecâmara | sem combate ou 1 inimigo, baús, armadilha | respiro, recompensa, telegrafia |
| Cisterna / salão | 4-6 esqueletos, pilares de cobertura | pico de combate |
| Santuário do braseiro | braseiro maior, escolha de upgrade | recompensa marcada |
| Câmara do Guardião | chefe único | clímax do slice |

`[CÓDIGO]` `[NORMATIVO]` O gerenciador de salas (reescrita de `app/worldStreaming.ts`, que
hoje carrega por proximidade SEM descarte, ver `projeto-brasa.md` 6.2) garante UMA sala
ativa por vez e descarta a anterior ao cruzar a porta. O descarte (malhas, materiais,
física, atores) é verificável no inspetor de cena.

`[A DEFINIR]` Geração das salas: começar FIXO desenhado à mão (recomendado para o slice,
mais controle de ritmo) e proceduralizar a partir de peças depois, se o ganho de
rejogabilidade compensar o trabalho (ver seção 9).

`[DESIGN]` Interatividade na sala: porta de pedra selável (estado por sala), braseiro
interativo (o gatilho central), baús/recursos opcionais nos respiros, e armadilhas simples
em antecâmaras (telegrafadas, fonte barata de tensão). Tudo do kit modular, sem primitiva à
mão.

---

## 5. Sistema: acender o braseiro

`[DESIGN]` `[NORMATIVO]` O braseiro é o pivô do jogo: encerra a sala, paga a recompensa e
destrava a saída numa só interação. É o que conecta combate, progressão, luz e exploração.

Regras:

- **Pré-condição:** a sala precisa estar `LIMPA` (zero esqueletos vivos). O braseiro só
  fica interagível depois disso. Tentar acender com inimigos vivos não responde (ou mostra
  dica de que a câmara ainda não está segura).
- **Ato de acender:** interação de toque/segurar curta (a Acendedora leva a fagulha ao
  braseiro). `[A DEFINIR]` se é instantânea ou com barra de canalização de ~1s (a
  canalização cria um micro-momento de cerimônia; medir se atrapalha o ritmo).
- **Efeitos simultâneos** (estado `ACESA`):
  1. **Luz fria vira quente.** A luz-chave azul de raio curto dá lugar à luz laranja de
     raio maior; a sala fica legível e acolhedora. Sinal claro de vitória da sala.
  2. **Recompensa.** Concede recurso (fagulha) e, em salas marcadas (santuário), abre a
     escolha de upgrade (seção 6).
  3. **Destrava a saída.** A porta de pedra de saída abre.
- **Persistência:** um braseiro aceso permanece aceso; mas como a sala será descartada ao
  cruzar a porta, isso vale só pelo tempo em que a sala existe. Sem backtracking no slice.

`[CÓDIGO]` `[NORMATIVO]` A troca de luz respeita o orçamento de iluminação (seção 10): a
luz quente do braseiro é 1-2 luzes dinâmicas por sala, sem sombra nas pontuais (padrão já
usado no protótipo). A luz-chave da sala pode ter sombra; as do braseiro não.

`[ASPIRACIONAL]` Áudio e VFX do acender: estalo de fogo pegando, leve onda de calor,
trilha que respira fundo por um instante. É o único momento morno da sala.

---

## 6. Sistema: progressão por fagulha e upgrades

`[DESIGN]` `[NORMATIVO]` A progressão é puxada pelo recurso ficcional central: a **fagulha**
que a Acendedora carrega e alimenta a cada braseiro. Reaproveita a mecânica genérica de
moeda/escolha-de-upgrade do motor (ver `spec-progressao-e-economia.md` do acervo, descartando
o que for de Josué; `projeto-brasa.md` 3.3).

Modelo:

- **Fagulha = recurso de progressão.** Acumula ao acender braseiros e (opcional) ao
  recolher de baús/inimigos. É o que paga upgrades.
- **Escolha de upgrade no santuário.** Em salas de santuário (e no chefe), acender o
  braseiro oferece uma escolha entre 2-3 melhorias. Eixos propostos:

  | Eixo de upgrade | Efeito | Leitura no jogo |
  |---|---|---|
  | Dano | golpe melee mais forte | mata em menos golpes |
  | Alcance do golpe | hitbox de ataque maior | acerta sem encostar tanto |
  | Vida | mais vida máxima | sobrevive a mais erros |
  | Raio de luz | luz da Acendedora alcança mais longe | enxerga ameaças antes, conforto e tática |

- **Raio de luz como progressão dupla.** Subir o raio de luz é mecânico (ver mais cedo,
  posicionar melhor) e temático (a Acendedora empurra o escuro). Casa o sistema com o pilar
  3 e com a ficção da Brasa empurrando a luz poço abaixo.

`[A DEFINIR]` Se os upgrades são permanentes na descida (build crescente, estilo roguelite
de uma run) ou persistem entre descidas (meta-progressão). Recomendação `[DESIGN]`: no
slice, **upgrades só dentro da descida** (não persistem); meta-progressão fica para depois,
quando houver morte-e-retorno (seção 8 e 9). Mantém o slice simples e o save enxuto.

`[CÓDIGO]` Save e progresso reaproveitam `platform/*` (save, progresso, settings, profile).

---

## 7. Sistema: dificuldade e ritmo

`[DESIGN]` `[NORMATIVO]` O ritmo da descida segue uma curva de tensão deliberada, alternando
picos de combate com respiros, e subindo a aposta a cada andar.

- **Curva por sala.** Sala de abertura (ensino, fácil) -> picos crescentes (cisterna/salão)
  intercalados com respiros (corredor/antecâmara) e marcos de recompensa (santuário) ->
  Guardião (clímax). Nunca dois picos máximos seguidos sem respiro.
- **Escalonamento da dificuldade** (eixos baratos, sem novos modelos):
  - número de esqueletos por sala (1 a 6, crescendo);
  - composição (esqueletos mais rápidos/agressivos via parâmetro de FSM, ou com arma
    diferente do mesmo atlas);
  - presença de armadilhas e cobertura (muda a tática);
  - tamanho/leitura da sala (cisterna grande vs corredor estreito).
- **Contrapeso de poder.** A cada braseiro o jogador fica mais forte (seção 6) e enxerga
  mais (raio de luz). A dificuldade real é a diferença entre a curva de ameaça e a curva de
  poder; o design mira em deixar essa diferença tensa mas justa.
- **Telegrafia honesta.** Toda ameaça (despertar, golpe inimigo, armadilha) é avisada antes
  de causar dano. A morte vem de erro lido, não de surpresa barata (pilar 5).

`[A DEFINIR]` Níveis de dificuldade selecionáveis (ex.: um modo mais leve com mais vida).
Recomendação `[DESIGN]`: uma só curva no slice; opções de acessibilidade depois.

---

## 8. Economia de risco-recompensa por sala

`[DESIGN]` `[NORMATIVO]` Cada sala é uma micro-negociação de risco contra recompensa. O laço
de sala já embute a barganha base (enfrentar os mortos para acender o braseiro e poder
descer), e os respiros adicionam escolhas opcionais.

- **Barganha obrigatória:** limpar a sala (risco de dano) é o preço de acender o braseiro
  (recompensa garantida: luz, recurso, saída). Não há como descer sem pagar.
- **Barganha opcional nos respiros:** corredores e antecâmaras oferecem baús com recurso
  extra protegidos por armadilha telegrafada ou por um inimigo isolado. O jogador escolhe
  se vale o risco pela fagulha extra. `[A DEFINIR]` se há recurso consumível de cura
  (poção/fagulha menor) que torne essa decisão mais aguda.
- **Escolha de build no santuário:** a recompensa marcada não é só quantidade, é direção
  (qual eixo de upgrade pegar, seção 6). É a decisão estratégica da descida.
- **Custo de oportunidade da luz.** `[ASPIRACIONAL]` Possível tensão extra: explorar cantos
  escuros da sala em busca de recurso custa tempo no frio antes de acender o braseiro.
  Mantém o jogador entre a pressa (acender e respirar) e a ganância (vasculhar). Avaliar se
  agrega sem complicar; rebaixado a aspiracional até prototipar.

`[DESIGN]` Princípio: a recompensa de uma sala deve ser sentida na próxima (mais dano,
mais luz, mais vida), fechando o laço entre arriscar agora e ganhar capacidade já.

---

## 9. Condições de vitória e derrota

`[DESIGN]` `[NORMATIVO]`

- **Vitória do slice:** vencer o Guardião e reavivar a Brasa no fundo do poço-cripta. A luz
  quente sobe pelo poço; tela de desfecho. É o único fim do vertical slice.
- **Vitória de sala (marco intermediário):** sala `LIMPA` e braseiro `ACESO`. Não encerra o
  jogo, mas é o pulso de progresso que o jogador sente a cada câmara.
- **Derrota:** a vida da Acendedora chega a zero (a fagulha se apaga). `[A DEFINIR]` o que a
  derrota dispara:
  - **Opção A (recomendada para o slice):** reinício da descida do topo (run curta, estilo
    roguelite), sem perder upgrades de meta-progressão porque não há nenhuma ainda (seção 6).
    Simples, casa com save enxuto.
  - **Opção B:** reinício a partir do último braseiro aceso (checkpoint), mais perdoador.
  - Decisão depende de quão punitiva queremos a descida; recomendação `[DESIGN]`: A no
    slice, reavaliar com playtest.

`[CÓDIGO]` Telas e estados reaproveitam `game/ui/*` e `core/gameLoop`; é re-textura e
re-fluxo, não sistema novo.

---

## 10. Rejogabilidade

`[DESIGN]` No slice, a rejogabilidade vem do laço em si (descer de novo, jogar melhor) e da
escolha de build (seção 6). Camadas futuras, em ordem de custo:

- **Variação de build:** escolher eixos de upgrade diferentes muda como a descida se joga
  (foco em luz, em dano, em sobrevivência). Já existe no slice se houver santuários.
- **Salas proceduralizadas:** montar salas a partir de peças do Dungeon Kit em vez de
  layouts fixos (o `[A DEFINIR]` da seção 4). Aumenta rejogabilidade a custo de trabalho de
  montagem e de balanceamento; recomendado só depois do slice fixo provar o laço.
- **Variação de inimigos por parâmetro:** composições diferentes de esqueletos (rápidos,
  pesados, com arma diferente) sem modelos novos, para que duas descidas não se pareçam.
- **Meta-progressão entre descidas:** se a derrota reinicia a run (seção 9 opção A),
  introduzir upgrades persistentes que se acumulam entre tentativas é o gancho roguelite
  clássico de retenção. `[A DEFINIR]`, fora do slice.

`[DESIGN]` Princípio: rejogabilidade barata primeiro (build, parâmetros de inimigo),
rejogabilidade cara depois (procedural, meta-progressão), e só se o laço base provar que
prende.

---

## 11. Como cada sistema casa com o orçamento de performance

`[NORMATIVO]` O pilar 1 manda; aqui está como cada sistema respeita os tetos do CANON
(`projeto-brasa.md` seção 4): 60 fps desktop / 30 fps mobile, < 60 draw calls por sala, uma
sala por vez com descarte, instanciar inimigos e props, 1-2 luzes dinâmicas por sala.

| Sistema | Decisão de design que protege o orçamento |
|---|---|
| Exploração sala-a-sala | Uma sala carregada por vez; a anterior é descartada ao cruzar a porta (malhas, materiais, física). Sem mundo aberto, sem terreno 600x600, sem skydome. É o maior ganho de leveza. |
| Combate melee | Esqueleto único instanciado; mesmo esqueleto e mesma biblioteca de animação do herói; teto aspiracional de <= 8 inimigos animando por sala. Sem projéteis nem física extra. |
| Acender braseiro / luz | Troca de 1 luz fria por 1-2 luzes quentes por sala; sombra desligada nas pontuais do braseiro. Sem iluminação global cara. |
| Progressão / upgrades | Ajusta parâmetros (dano, alcance, vida, raio de luz); não adiciona malhas nem efeitos pesados. |
| Salas e props | Kit modular CC0 com atlas único; peças repetidas instanciadas; props de baixo tris com colisor de caixa. Mira em < 60 draw calls por sala com folga. |
| Dificuldade / ritmo | Escala por número e parâmetro de inimigos, não por novos modelos ou shaders. |
| Rejogabilidade | Variação por build e parâmetro antes de procedural; procedural reusa as mesmas peças instanciadas, sem novos assets. |
| Save / fluxo | Reusa `platform/*`; save enxuto (sem meta-progressão pesada no slice). |

`[NORMATIVO]` Regra transversal: nenhum sistema desta doc pode exigir mais de uma sala
carregada por vez, mais que 1-2 luzes dinâmicas por sala, ou modelos fora dos tetos de tris
do CANON. Se exigir, o sistema é redesenhado ou adiado.

`[NORMATIVO]` Todo `.glb` novo passa por `optimize_asset.py` + `validate_gltf.py` (skill
blender-python): escala aplicada, Y-up, dentro do teto de tris, atlas preservado.

---

## Checklist de aceite (Definition of Done)

`[NORMATIVO]` Cada item recebe sim/não honesto.

- [ ] Pilares de design escritos, com "leve no navegador" em primeiro lugar `[DESIGN][NORMATIVO]`
- [ ] Laço de uma sala documentado na ordem entrar/selar -> despertar -> limpar -> acender -> cruzar/trocar `[DESIGN][NORMATIVO]`
- [ ] Laço da descida documentado (abertura -> 5 a 7 salas -> Guardião -> reavivar a Brasa) `[DESIGN][NORMATIVO]`
- [ ] Combate melee descrito como reuso do motor (sem combate novo), com telegrafia e esqueleto único `[CÓDIGO][NORMATIVO]`
- [ ] Exploração sala-a-sala com uma sala por vez e descarte da anterior especificada `[CÓDIGO][NORMATIVO]`
- [ ] Sistema de acender o braseiro liga luz fria->quente, recompensa e destravar saída numa interação `[DESIGN][NORMATIVO]`
- [ ] Progressão por fagulha com eixos de upgrade (dano, alcance, vida, raio de luz) definida `[DESIGN][NORMATIVO]`
- [ ] Curva de dificuldade e ritmo (picos vs respiros, escalonamento por número/parâmetro) descrita `[DESIGN][NORMATIVO]`
- [ ] Economia de risco-recompensa por sala (barganha obrigatória + opcionais) descrita `[DESIGN][NORMATIVO]`
- [ ] Condições de vitória (slice e sala) e derrota especificadas `[DESIGN][NORMATIVO]`
- [ ] Rejogabilidade em camadas por custo (build/parâmetro antes de procedural/meta) descrita `[DESIGN][NORMATIVO]`
- [ ] Cada sistema ligado explicitamente ao orçamento de performance (seção 11) `[NORMATIVO]`
- [ ] Vocabulário do CANON usado corretamente (Brasa, Acendedora, Guardião, poço-cripta, braseiro, porta de pedra selada, esqueletos, fagulha) `[NORMATIVO]`
- [ ] Itens `[A DEFINIR]` listados e marcados como decisão pendente, não como pronto `[NORMATIVO]`
- [ ] Sem travessões, sem emojis em qualquer texto `[NORMATIVO]`
