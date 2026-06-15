# Spec de Combate e Movimento - Brasa

"Brasa" - dungeon crawler 3D em 3a pessoa, low-poly, para navegador (Babylon.js +
Havok), tom mítico e melancólico, frio-azul contra laranja-quente. Esta spec é
irmã da [bíblia do projeto](projeto-brasa.md) (CANON, mestre) e segue o
[`padrao-de-detalhe.md`](../padrao-de-detalhe.md) e o
[guia de estilo](guia-de-estilo-e-glossario.md).

Foco: validar o FEEL do combate melee da Acendedora numa câmara selada da
cripta. É o maior risco do projeto, igual ao do protótipo de Josué, e o motor de
combate já existe e é reaproveitado por inteiro (ver
[`projeto-brasa.md`](projeto-brasa.md) §6.1). Os números são pontos de partida
para iterar no playtest, não verdades.

Procedência: `[DESIGN]` (decisão nossa), `[CÓDIGO]` (observado em `prototipo/src`),
`[ASSET]` (vem de pacote pronto, KayKit). Exigência: `[NORMATIVO]` (entra no
aceite), `[ASPIRACIONAL]` (mood, não bloqueia), `[A DEFINIR]` (decisão pendente).

Snapshot: 2026-06-14.

Documentos irmãos referenciados (alguns ainda a escrever, marcados `[A DEFINIR]`
quando o arquivo não existe): bestiário do esqueleto (`bestiario.md`, `[A DEFINIR]`),
spec do chefe Guardião (`spec-chefe-guardiao.md`, `[A DEFINIR]`),
[direção de arte](direcao-de-arte.md), [narrativa](narrativa-e-historia.md).

---

## 0. Tese e premissa de risco

`[DESIGN]` `[ASPIRACIONAL]` O combate da Acendedora deve sentir como ferro frio
batendo em osso seco numa câmara fechada e mal iluminada: pesado, comprometido,
legível. Não é hack-and-slash de combos longos nem bullet-hell. Referência mental:
Zelda (ritmo de leitura, alvo) com peso de Souls-lite e clareza de telegrafia de
bom design de inimigo. O protótipo responde uma pergunta: limpar uma câmara selada
no melee (acertar e ser acertado) é gostoso e justo? Se não for, nada mais importa.

`[NORMATIVO]` Princípio transversal de responsividade: latência de input crítico
< ~100 ms. O motor já trata isso dando ANTECIPAÇÃO CURTA aos golpes do jogador e
ANTECIPAÇÃO LONGA aos inimigos, onde a telegrafia precisa ser lida (`tuning.ts`:1-11,
[CÓDIGO]).

`[DESIGN]` Diferença de regime contra Josué: Brasa não tem dois loadouts (lança x
espada+escudo), não tem arqueiro a distância e não tem funda. O elenco é uma
heroína melee única (a Acendedora) limpando câmaras de esqueletos. Isso ENXUGA o
moveset: foco total no melee e numa possível mecânica de fagulha. Tudo que era
sobre kiting, troca de loadout e projétil sai do escopo do slice.

---

## 1. Pilares do combate (feel)

`[DESIGN]` Quatro pilares de sensação (reaproveitados do regime neutro de combate,
re-tematizados para a cripta):

1. **Peso com comprometimento.** Cada golpe é uma decisão; iniciado, não se cancela
   livremente; a Acendedora fica vulnerável na antecipação e na recuperação (escola
   Souls: mais dano por mais risco). Já é assim no motor: `AttackState.start` ignora
   um novo ataque se já há um em andamento (`attack.ts`:45-52, [CÓDIGO]).
2. **Legibilidade total.** Golpes da Acendedora e dos esqueletos instantaneamente
   legíveis: antecipação clara, ataque nítido, recuperação que abre punição.
3. **Impacto que se sente no corpo.** Hit stop, knockback, flash, partícula (faísca
   quente da fagulha) e som convergem no mesmo frame. O `CombatDirector` já dispara
   tudo junto no frame do acerto (`combatDirector.ts`:96-116, [CÓDIGO]).
4. **Ritmo de leitura, não de reflexo puro.** Vence-se lendo tells e escolhendo
   esquivar/recuar ou trocar golpe; recompensa paciência e posicionamento, não
   mashing.

`[NORMATIVO]` Anatomia de todo ataque (Acendedora e esqueleto), três fases, já
implementada genericamente como `AttackPhase` (`attack.ts`:11, [CÓDIGO]):

- **Antecipação / startup**: o "sinal" (animação de aviso única por ataque).
  Antecipação alvo = tempo de reação humano (~0,25 s) + acionamento + buffer de
  dificuldade. No esqueleto, é a janela em que o jogador LÊ e decide.
- **Ativo / hit**: o instante de contato; curto, preciso. É a única fase em que o
  golpe causa dano (`AttackState.isActive`, `attack.ts`:31-33, [CÓDIGO]).
- **Recuperação / recovery**: a janela de vulnerabilidade; curta nega punição,
  longa premia o habilidoso. No esqueleto é a JANELA DE PUNIÇÃO.

`[DESIGN]` Ingredientes de juiciness (todos no frame do acerto): hit stop/hitlag
(congela atacante e alvo por alguns frames; câmera e partículas seguem em velocidade
normal; ingrediente nº 1 de peso, já em `HitStop`, `hitStop.ts`, [CÓDIGO]); hit stun
(alvo perde ação); knockback proporcional ao peso do golpe; screen shake comedido
(kick pequeno, decay rápido, em `thirdPersonCamera.shake`, [CÓDIGO]); hit flash
(modelo pisca 1-2 frames; o esqueleto já pisca, `FLASH_SEC` em `defender.ts`,
[CÓDIGO]); som em camadas (impacto seco em osso, clangor de escudo de osso, swoosh de
errar); partícula de faísca da fagulha (já estilizada como faísca quente esmaecendo
para poeira, `impactFx.ts`:20-22, [CÓDIGO]); squash and stretch leve.

`[DESIGN]` Re-tema do VFX de impacto: a `ImpactFx` já emite faísca laranja-quente
(cores `1.0,0.86,0.5` -> `0.85,0.5,0.2`, [CÓDIGO]), o que casa exatamente com a
assinatura visual da Brasa (laranja-quente contra frio-azul). Manter a paleta;
reduzir a contagem em golpe leve, aumentar no pesado, como já faz (`heavy ? 26 : 16`,
`combatDirector.ts`:106, [CÓDIGO]). Sem gore: respingo estilizado, e os mortos são
esqueletos (osso, não carne), o que reforça o "sem gore" da régua.

`[DESIGN]` Telegrafia e i-frames: cada ataque de esqueleto com tell visual/sonoro
distinto; o esqueleto hesita ~0,5-1 s na pose pós-ataque (melhor janela de
contragolpe; já modelado como `cooldownSec` + recovery, `tuning.ts`:63-65, [CÓDIGO]).
i-frames na esquiva NÃO cobrem o rolamento inteiro: ficam no MIOLO, então rolar cedo
ou tarde demais pune (já implementado, `heroCombat.ts`:99-106, [CÓDIGO]).

---

## 2. Movimento e câmera

`[CÓDIGO]` Controlador de 3a pessoa: o motor já dirige a heroína por
`characterController` (cápsula física Havok) com locomoção relativa à câmera. A
câmera é a `ThirdPersonCamera` (`engine/camera/thirdPersonCamera.ts`): ArcRotate com
mouse-look por pointer lock, damping de posição no alvo, limites de inclinação
(`betaMin`/`betaMax`) e screen shake de impacto embutido (`shake(amp)`). Reaproveitada
como está; na cripta a colisão de câmera importa mais (paredes próximas) - ver
`[A DEFINIR]` abaixo.

`[DESIGN]` Verbos de locomoção do slice de Brasa: andar/correr (correr como padrão).
Sem sprint com stamina nesta fase (a stamina magra fica só para esquiva e pesado,
como no motor). Sem pulo de combate, sem escalada: a câmara selada é plana e fechada,
o jogo é o duelo no chão.

`[DESIGN]` Alvo / lock-on: o motor tem o `combatTarget` (interface
`CombatTarget`, `combat/combatTarget.ts`, [CÓDIGO]) que descreve qualquer coisa que a
Acendedora possa acertar (vida, hurtbox, `takeHit`). O `CombatDirector` itera os
alvos da sala e resolve o acerto pela hitbox frontal, sem precisar de hard-lock para
funcionar. `[A DEFINIR]` se Brasa adiciona lock-on por toggle estilo Zelda. Recomendação
`[DESIGN]`: começar SEM hard-lock (a câmara é pequena, 1-4 esqueletos, o golpe frontal
generoso resolve), e só adicionar lock-on por toggle se o playtest mostrar que mirar
incomoda contra 4-6 inimigos na cisterna. Marcar como melhoria pós-slice.

`[A DEFINIR]` Colisão de câmera por raycast/spherecast (aproximar quando há parede):
a `ThirdPersonCamera` atual NÃO faz colisão de câmera; numa câmara fechada de pedra
isso passa a ser necessário para a câmera não atravessar parede. Adicionar
raycast câmera->herói antes do slice de cisterna.

`[DESIGN]` `[NORMATIVO]` Mapeamento de controles (enxuto, sem loadouts/funda):

| Ação | Teclado/Mouse | Gamepad | Toque |
|---|---|---|---|
| Mover | WASD | Analógico esq. | Joystick virtual esq. |
| Câmera | Mouse | Analógico dir. | Arrastar dir. |
| Ataque leve | Botão esq. | X/Quadrado | Botão A |
| Ataque pesado | Botão dir. (hold) | Y/Triângulo | Botão B (hold) |
| Esquiva / recuo | Shift | B/Círculo | Swipe ou dash |
| Golpe de fogo (fagulha) | E | RB/R1 | Botão fagulha |
| Acender braseiro (interação) | F | A/X | Botão interagir |

`[DESIGN]` Bloqueio com escudo do motor (`block`, `heroCombat.ts`:170-173, [CÓDIGO])
fica `[A DEFINIR]` para Brasa: a Acendedora carrega a fagulha, não um escudo, então o
bloqueio frontal pode não casar com a fantasia. Recomendação: substituir o bloqueio
pelo RECUO/esquiva como defesa principal (a esquiva já existe e tem i-frames), e
reservar o slot do escudo. O código de bloqueio fica dormente, não removido.

---

## 3. Moveset da Acendedora

`[DESIGN]` A Acendedora é uma heroína melee única (KayKit Adventurers, `Mage.glb` ou
`Rogue_Hooded.glb`, já em disco, [ASSET]) que carrega a fagulha. Recurso de combate:
vida (sempre) e stamina magra (só esquiva e pesado consomem, `tuning.ts`, [CÓDIGO]).
Sobre a fagulha como recurso, ver §5.

### 3.1 Ataque leve e combo `[CÓDIGO]` (já no motor) + `[DESIGN]` (re-tema)

`[NORMATIVO]` Golpe leve rápido e responsivo (antecipação curta), comprometido, baixo
dano, em combo de até 3, a 3a com empurrão. Já implementado em `HeroCombat`: `light`
e `lightFinisher`, buffer de combo por `comboQueued`, reset por `comboResetSec`
(`heroCombat.ts`:190-208, `tuning.ts`:28-32, [CÓDIGO]). Números atuais: leve
startup 0,12 / ativo 0,06 / recovery 0,22 / dano 10 / knockback 2 / 4 frames de hit
stop; finalizadora dano 12 / knockback 6 / 7 frames.

`[DESIGN]` Re-tema: a arma é uma lâmina fria (ferro) da Acendedora, não a espada de
bronze de Josué (`buildSword` reaproveitado como graybox, depois trocar por arma
KayKit). A faísca do impacto é a fagulha tocando o osso.

### 3.2 Ataque pesado `[CÓDIGO]`

`[NORMATIVO]` Golpe pesado: antecipação longa, knockback forte, hit stop alto, custa
stamina, quebra a guarda frontal do esqueleto. Já implementado: `heavy` (startup 0,32
/ ativo 0,08 / recovery 0,4 / dano 26 / knockback 6 / 10 frames de hit stop / custo
35 de stamina, `tuning.ts`:35-43, [CÓDIGO]). O `CombatDirector` trata >= 8 frames de
hit stop como golpe que QUEBRA guarda (`heavy = tuning.hitStopFrames >= 8`,
`combatDirector.ts`:95, [CÓDIGO]).

### 3.3 Esquiva / recuo `[CÓDIGO]`

`[NORMATIVO]` Esquiva direcional com i-frames no MIOLO do rolamento, vulnerável no
início e no fim, custa stamina. Sem direção de input, vira RECUO (dash para trás,
`f = -1`, `heroCombat.ts`:230-233, [CÓDIGO]). Números: duração 0,55 s (~30-36 frames),
i-frames de 0,1 s a 0,3 s (~10-12 frames no miolo), custo 25 de stamina
(`tuning.ts`:45-51, [CÓDIGO]). É a defesa principal da Acendedora (ver §2 sobre
aposentar o bloqueio).

### 3.4 Golpe de fogo da fagulha `[DESIGN]` (novo)

`[DESIGN]` `[A DEFINIR]` Único verbo realmente NOVO proposto para Brasa, ligado à
ficção da fagulha. Conceito: um golpe especial que gasta uma parte da fagulha
(recurso de §5) e bate em ARCO/ÁREA curta à frente, com forte componente de fogo:
mais dano, knockback alto, faísca exagerada (a `ImpactFx` já é fogo), bom contra
grupos de esqueletos na cisterna. Implementação proposta: reusar a maquinaria de
`AttackState` + `AttackTuning` (uma 4a entrada de tuning, ex.: `ember`), com
`damage`/`knockback`/`hitStopFrames` próprios e um custo de FAGULHA (não de stamina).
Telegrafia própria (a lâmina/mão acende em laranja durante a antecipação) para o
inimigo e o jogador lerem. Diferença de design contra o "pesado": o pesado custa
stamina e é melee de alvo único; o golpe de fogo custa fagulha e é a ferramenta de
ÁREA, ligada ao tema. Cooldown ou só custo de fagulha: `[A DEFINIR]` (recomendação:
só custo de fagulha, sem cooldown, para a economia ficar legível).

`[ASPIRACIONAL]` Leitura visual: o golpe de fogo é o momento em que a Acendedora
EMPRESTA luz ao escuro - laranja explode no frio-azul da câmara por um instante. É a
fantasia central tornada verbo.

### 3.5 O que NÃO entra no moveset de Brasa

`[DESIGN]` Fora do escopo (eram de Josué): segundo loadout (lança), funda/projétil,
arremesso de arma, bloqueio com escudo como verbo central (vira `[A DEFINIR]`/dormente,
§2), parry exato (testar só depois, alto valor mas opcional).

---

## 4. Hitboxes, janelas de acerto, hitstop e feedback

`[CÓDIGO]` Detecção de acerto por ESFERAS (`overlapSpheres`, `hitbox.ts`:15-17):
barato e suficiente para o duelo 1v1..1v4 da câmara (foco em duelo, não horda). A
Acendedora tem um PONTO DE ACERTO à frente, na altura do torso, desacoplado do swing
visual (`heroHitPoint`, `heroCombat.ts`:73-76, [CÓDIGO]): isso torna o golpe
confiável quando se está de frente e perto, em vez de depender da ponta da lâmina. O
raio da hitbox frontal é generoso (`HIT_RADIUS = 0.7`, `combatDirector.ts`:22,
[CÓDIGO]). Cada alvo expõe uma `hurtbox` (centro + raio, `hitbox.ts`:8-12, [CÓDIGO]).

`[NORMATIVO]` Janela de acerto: o golpe só causa dano na fase `active` E enquanto não
acertou neste swing (`canHit`, `heroCombat.ts`:91-93, [CÓDIGO]); um acerto por golpe
(`markHit`, `heroCombat.ts`:128-130 + `combatDirector.ts`:116, [CÓDIGO]). Isso impede
multi-hit acidental num único swing.

`[NORMATIVO]` Resolução de um acerto, no MESMO frame (`combatDirector.ts`:80-118,
[CÓDIGO]): mede sobreposição de esferas; calcula direção horizontal herói->alvo;
marca golpe pesado se hit stop >= 8 frames (quebra guarda); aplica `takeHit`
(dano + knockback + guarda); então dispara o pacote de feedback:

- **Bloqueado pela guarda** (esqueleto que ainda guarda de frente, golpe leve): hit
  stop curtíssimo (2/60 s), shake mínimo (0,04), faísca fraca (8 partículas), som de
  clangor de osso (`shieldClank`). Ensina a FLANQUEAR ou usar o pesado.
- **Acertou de fato**: hit stop = `hitStopFrames / 60` (leve 4, finalizadora 7,
  pesado 10); shake proporcional (`0.05 + frames * 0.004`); faísca forte (16 leve,
  26 pesado); som de impacto (`hitThunk(heavy)`); emite `combat:hit` no EventBus.

`[NORMATIVO]` Hit stop: `HitStop` congela atacante e alvo escalando o dt de combate
para 0 enquanto câmera e VFX usam o dt REAL (`hitStop.ts`:25-28, [CÓDIGO]). O
`CombatDirector` devolve o dt de combate (0 no freeze) para a heroína e usa dt real
para câmera/partículas (`combatDirector.ts`:62-77, [CÓDIGO]). Pega o MAIOR pedido (um
pesado não é encurtado por um leve, `hitStop.ts`:12-14, [CÓDIGO]).

`[NORMATIVO]` Barra de vida do inimigo: billboard flutuante que aparece ao tomar dano
e some após ~3,5 s (`HealthBar3D`, `healthBar3d.ts`, [CÓDIGO]). Não polui a tela; sem
números de dano flutuantes. Re-tema: cores da barra já casam (verde -> âmbar -> rubro,
`#7db83a`/`#e7bd71`/`#c0392b`), manter.

`[DESIGN]` Som em camadas (a escrever no áudio de Brasa, hoje `combatSound.ts` tem
`hitThunk`/`heroHurt`/`shieldClank` sintetizados, [CÓDIGO]): re-tema para o registro
da cripta - impacto SECO em osso (não "thunk" de bronze), clangor de escudo de osso,
swoosh frio ao errar. Som ECOANDO na câmara de pedra (reverb) é `[ASPIRACIONAL]`.

---

## 5. Recursos em combate: vida e fagulha

`[CÓDIGO]` Vida: a `Health` genérica (atual/máx, dano, morte, fração para a barra,
`health.ts`, [CÓDIGO]). A Acendedora tem `maxHealth = 100`, morre em ~5-6 golpes de
esqueleto (`HERO.maxHealth`, `tuning.ts`:22, [CÓDIGO]).

`[CÓDIGO]` Stamina magra: 100 de máximo; só esquiva (25) e pesado (35) consomem;
regen começa ~1 s após gastar, a 40/s (`HERO.stamina*`, `tuning.ts`:22-25 +
`heroCombat.ts`:241-256, [CÓDIGO]). Sem custo de stamina no leve nem no andar.

`[DESIGN]` `[A DEFINIR]` A fagulha como recurso de combate (NOVO, central na ficção).
Proposta de design, a ratificar:

- A fagulha é um recurso separado da vida e da stamina, alimenta o **golpe de fogo**
  (§3.4) e talvez o **raio de luz** da Acendedora na câmara escura.
- GASTAR: cada golpe de fogo consome uma porção da fagulha. `[A DEFINIR]` se a fagulha
  é contínua (barra que esvazia) ou em CARGAS discretas (ex.: 3 cargas). Recomendação
  `[DESIGN]`: cargas discretas, mais legíveis e fáceis de telegrafar no HUD.
- RECARREGAR: a fagulha recarrega ao **acender o braseiro** ao fim da câmara
  (`projeto-brasa.md` §3.1: acender o braseiro concede recurso/upgrade). Logo, a
  economia da fagulha amarra o COMBATE ao LAÇO de sala: você gasta fogo limpando a
  câmara e reabastece ao acendê-la. `[A DEFINIR]` se também recarrega devagar com o
  tempo ou só no braseiro. Recomendação: só no braseiro (cria decisão de quando
  gastar).
- LEITURA: a fagulha que a Acendedora carrega pode dimar conforme se esvazia (luz
  pessoal mais fraca), reforçando a tensão de ficar sem fogo no escuro. `[ASPIRACIONAL]`.

`[DESIGN]` Implementação proposta: criar uma classe `Spark`/`Fagulha` análoga a
`Health` (cargas atuais/máx, `spend`, `refill`), e um bloco `SPARK` em `tuning.ts`
(máx de cargas, custo por golpe de fogo). Reusa o padrão de recurso já existente.

---

## 6. Inimigos: o esqueleto e como o combate responde

`[DESIGN]` Os mortos despertos são ESQUELETOS (KayKit Character Pack: Skeletons,
[ASSET], a baixar). Hoje o inimigo é o `Defender` (humanoide low-poly com espada e
escudo de bronze, IA por FSM e tick, `defender.ts`, [CÓDIGO]); Brasa o RELIGA para a
malha KayKit Skeleton mantendo a FSM e o tuning (`projeto-brasa.md` §6.2). O
detalhamento de arquétipos vai no bestiário (`bestiario.md`, `[A DEFINIR]` ainda a
escrever); aqui fica como o COMBATE responde a cada um.

`[CÓDIGO]` Esqueleto base = re-tema do `Defender`: aproxima -> em alcance telegrafa
golpe de cima (tell ~0,6 s, braço/espada erguidos, DIREÇÃO TRAVADA, dá para esquivar
ou flanquear) -> ativo curto -> recuperação punível + cooldown (FSM `approach` ->
`attacking` -> `cooldown`, `defender.ts`, [CÓDIGO]). HP 60 (~4-5 golpes leves), tell
0,6 s, recovery 0,75 s, cooldown 0,5 s, dano 16 (`DEFENDER`, `tuning.ts`:58-66,
[CÓDIGO]). A guarda frontal amortece o golpe leve de frente; o pesado e o flanco
passam (ensina a flanquear / usar o pesado).

`[DESIGN]` Arquétipos propostos para Brasa (cada um ENSINA um verbo; detalhe no
bestiário):

| Arquétipo de esqueleto | Como o combate responde | Verbo que ensina |
|---|---|---|
| **Esqueleto de guarda** (base, = Defender re-temado) | tell de golpe de cima legível, recovery punível; guarda frontal | ler tell, punir na recuperação, flanquear |
| **Esqueleto sem escudo / frenético** `[A DEFINIR]` | mais rápido, sem guarda, vem em número; pressiona o espaço | esquiva/recuo, controle de turba com o golpe de fogo |
| **Esqueleto pesado / couraçado** `[A DEFINIR]` | lento, muito HP, knockback resistente; força o golpe pesado | ataque pesado, paciência |

`[DESIGN]` Resposta do combate a grupos: na CISTERNA (4-6 esqueletos,
`projeto-brasa.md` §3.2) o jogador usa pilares de cobertura, o RECUO para criar
espaço e o GOLPE DE FOGO em área (§3.4) como ferramenta anti-turba. Sem arqueiro e
sem o dilema "tank na frente, dano atrás" de Josué: a pressão de Brasa é de NÚMERO e
ESPAÇO no melee fechado, não de linhas de tiro.

`[NORMATIVO]` Quantidade simultânea: alvo de 1-4 esqueletos ativos na câmara comum,
pico de 4-6 na cisterna, dentro do teto de <= 8 skinned animando ao mesmo tempo
(`projeto-brasa.md` §4.3, [CÓDIGO]/[ASSET]). Otimizar: pool de inimigos, FSM em ticks
(não todo frame, já é `Ticker(0.12)` no Defender, [CÓDIGO]), malha de esqueleto
INSTANCIADA com esqueleto/animação compartilhados, colliders simples.

---

## 7. Câmera e alvo em combate

`[CÓDIGO]` Câmera: `ThirdPersonCamera` (mouse-look por pointer lock, damping,
screen shake de impacto, `engine/camera/thirdPersonCamera.ts`). O `CombatDirector`
recebe a câmera e chama `shake(amp)` no frame do acerto (`combatDirector.ts`:101-106,
[CÓDIGO]). Durante o hit stop a câmera segue em dt REAL (não congela), preservando o
"juice".

`[CÓDIGO]` Alvo: o `CombatDirector` itera os alvos vivos da câmara
(`targets`, `combatDirector.ts`:54-56) e resolve o golpe pela hitbox frontal generosa
(§4). Não há hard-lock no motor hoje; ver §2 (`[A DEFINIR]` adicionar lock-on por
toggle se a turba pedir). `combatTarget.ts` (interface `CombatTarget`, [CÓDIGO]) é o
contrato de qualquer alvo: esqueletos e o Guardião o implementam.

`[A DEFINIR]` Enquadramento em câmara fechada: confirmar `betaMin`/`betaMax` e a
distância da câmera para não estourar nas paredes de pedra (liga com a colisão de
câmera, §2).

---

## 8. Morte, respawn e derrota

`[CÓDIGO]` Morte do inimigo: ao zerar a vida, o `Health.damage` retorna `died`; o
esqueleto entra em estado morto e (no graybox atual) renasce após ~2 s
(`RESPAWN_SEC`, `defender.ts`, [CÓDIGO]). Para Brasa isso MUDA: ao limpar a câmara, os
esqueletos NÃO renascem - a sala fica limpa para acender o braseiro
(`projeto-brasa.md` §3.1). `[DESIGN]` `[NORMATIVO]`: desligar o respawn de inimigo na
câmara selada; o estado de morte é PERMANENTE até a sala ser descartada.

`[CÓDIGO]` Morte da Acendedora: o `CombatDirector` hoje faz respawn graybox com vida
cheia após ~1,6 s e emite `hero:died` (`HERO_DEATH_RESPAWN_SEC`,
`combatDirector.ts`:121-138, `heroCombat.revive`, `heroCombat.ts`:144-148, [CÓDIGO]).
Para Brasa, `[DESIGN]` `[A DEFINIR]`: a morte deve ser uma DERROTA real, não respawn
imediato na sala. Proposta: ao morrer, a fagulha "apaga" e o jogador reinicia a
DESCIDA (ou a câmara atual), conforme a regra de persistência do slice. Recomendação
`[DESIGN]`: reiniciar a câmara atual com os esqueletos restaurados (não a descida
inteira) no slice, para não punir demais durante o playtest de feel; decidir morte
permanente / roguelike depois. Ligar com a spec de fluxo e persistência quando
existir para Brasa.

`[ASPIRACIONAL]` Tom da derrota: o escuro e o frio avançam; a tela esfria para o
azul, a luz da Acendedora se apaga. Coerente com "se a Brasa morrer, a superfície
congela".

---

## 9. Tuning (números iniciais, 60 FPS)

`[CÓDIGO]` Fonte única dos números: `game/combat/tuning.ts`. Iterar o feel = editar
esse arquivo. Tabela de partida (valores ATUAIS do motor, herdados e a re-ratificar
para Brasa):

| Parâmetro | Valor inicial | Origem |
|---|---|---|
| Vida da Acendedora | 100 (morre em ~5-6 golpes) | `HERO.maxHealth` [CÓDIGO] |
| Stamina máx / regen | 100 / 40 por s, atraso 1 s | `HERO` [CÓDIGO] |
| Vida do esqueleto de guarda | 60 (~4-5 golpes leves) | `DEFENDER.maxHealth` [CÓDIGO] |
| Golpe leve | startup 0,12 / ativo 0,06 / recovery 0,22 / dano 10 / kb 2 / hitstop 4 fr | `HERO.light` [CÓDIGO] |
| Finalizadora do combo (3a) | startup 0,16 / ativo 0,07 / recovery 0,3 / dano 12 / kb 6 / hitstop 7 fr | `HERO.lightFinisher` [CÓDIGO] |
| Janela de combo | 0,45 s | `HERO.comboResetSec` [CÓDIGO] |
| Golpe pesado | startup 0,32 / ativo 0,08 / recovery 0,4 / dano 26 / kb 6 / hitstop 10 fr / stamina 35 | `HERO.heavy` [CÓDIGO] |
| Esquiva / recuo | duração 0,55 s; i-frames 0,1-0,3 s (miolo); stamina 25 | `HERO.dodge` [CÓDIGO] |
| Golpe de fogo (fagulha) | dano alto, área, knockback alto, custo de FAGULHA | `[A DEFINIR]` novo bloco `EMBER` [DESIGN] |
| Fagulha (recurso) | cargas máx; custo por golpe de fogo; recarrega no braseiro | `[A DEFINIR]` novo bloco `SPARK` [DESIGN] |
| Golpe de cima do esqueleto | tell 0,6 s / ativo 0,12 / recovery 0,75 / dano 16 / hitstop 6 fr; cooldown 0,5 s | `DEFENDER.overhead` [CÓDIGO] |
| Hit stop leve / pesado | ~4 fr (~67 ms) / ~10 fr (~167 ms; teto ~0,25 s) | `tuning.ts` [CÓDIGO] |
| Multiplicador de dano por dificuldade | 0,6 (fácil) / 1,0 (normal) / 1,25 (difícil) | `DIFFICULTY_DAMAGE_TAKEN` [CÓDIGO] |
| Screen shake | amplitude pequena (~0,04-0,1), decay rápido | `combatDirector`/`thirdPersonCamera` [CÓDIGO] |
| Latência de input crítico | < 100 ms | `tuning.ts` nota [CÓDIGO] |

`[DESIGN]` Re-ratificar para Brasa: confirmar se a Acendedora reusa exatamente os
números do `HERO` de Josué ou se o feel da cripta pede ajuste (ex.: golpe mais lento
e pesado para a câmara claustrofóbica). Os nomes de dificuldade (`peregrino`,
`soldado`, `comandante`, `tuning.ts`:69-73, [CÓDIGO]) são de Josué e devem ser
re-tematizados (`[A DEFINIR]`).

---

## 10. Diferenças no combate contra o Guardião (chefe)

`[DESIGN]` O clímax do slice é o **Guardião da Brasa apagada** na Câmara do Guardião
(`projeto-brasa.md` §3.1-3.2). Detalhamento completo (moveset por golpe com
tells/janelas, estágios de vida por fase, hazards, áudio, desfecho de acender a Brasa)
vai na spec dedicada (`spec-chefe-guardiao.md`, `[A DEFINIR]` ainda a escrever). Esta
seção fixa só os SISTEMAS e como o combate difere do esqueleto comum.

`[DESIGN]` `[NORMATIVO]` O Guardião implementa o mesmo contrato `CombatTarget`
([CÓDIGO]) e usa a mesma anatomia de 3 fases (`AttackState`) e o mesmo pipeline de
feedback (hit stop, knockback, faísca, shake, barra de vida). É um DUELO 1v1 de
leitura de tells, recapitulando tudo: esquivar/recuar, ler tell, punir na recuperação,
e usar o golpe de fogo nas aberturas.

`[DESIGN]` Diferenças de combate contra o Guardião vs. o esqueleto comum:

- **Vida e duração**: HP alto (faixa de chefe, ~300, duelo de ~60-90 s; ratificar na
  spec do chefe). Barra de vida dedicada no HUD, não só o billboard.
- **Mais padrões legíveis** (3-4) em vez de um único golpe de cima; cada um com tell
  e janela de punição distintos.
- **Escalada de ritmo por fase**: abaixo de ~50% de vida, encadeia mais e reduz
  janelas, SEM adicionar verbos novos ("quase morrendo" muda o ritmo, não as regras).
  Leitura de fase por cor/silhueta (`projeto-brasa.md` §4.2: chefe 3k-6k tris, leitura
  por cor/silhueta, [ASSET]).
- **Tem hazards/área** que o esqueleto não tem (`[A DEFINIR]` na spec do chefe), p.ex.
  marcas de área no chão com tell crescente, casando com a telegrafia de área.
- **Sem respawn**: vencê-lo acende a Brasa e fecha o slice (desfecho, não loop).
- **Possível papel da fagulha**: o golpe de fogo pode ser a chave para abrir a guarda
  do Guardião ou a fase final (`[A DEFINIR]`, decidir na spec do chefe; amarraria o
  recurso temático ao clímax).

---

## 11. O que o protótipo de combate precisa provar e como medir

`[ASPIRACIONAL]` O slice valida o FEEL, não conteúdo. Provar: (1) limpar uma câmara
selada no melee é gostoso? (2) ser acertado pelo esqueleto é justo? (3) o loop "ler
tell -> esquivar/recuar -> punir na recuperação" emerge naturalmente? (4) o golpe de
fogo da fagulha tem leitura e peso próprios e a economia de fagulha faz sentido com o
braseiro? (5) a câmera fechada não enjoa nem estoura nas paredes? (6) 4-6 esqueletos
na cisterna rodam fluido no navegador? (7) o Guardião ensina sem frustrar?

`[DESIGN]` Medir: quantitativas (FPS médio/p95 na câmara cheia; draw calls < 60 por
sala; taxa de acerto/erro; mortes por câmara; tempo de kill por arquétipo de esqueleto;
frequência de uso de cada verbo - verbo ignorado = tuning errado; consumo/recarga de
fagulha; tempo de duelo do Guardião; latência medida); qualitativas (playtest: "quão
satisfatório foi acertar 1-5?", "a morte foi sua culpa ou injusta?", "ficou confuso
sobre o ataque do esqueleto?", "o golpe de fogo valeu a fagulha?", "a câmera
atrapalhou?"). Critério de sucesso: maioria classifica impacto >= 4/5 e atribui mortes
a erro próprio.

---

## Checklist de aceite (Definition of Done)

`[NORMATIVO]` recebe sim/não honesto; `[ASPIRACIONAL]` não bloqueia; `[A DEFINIR]` em
aberto impede o pronto (ou vira adiamento registrado). Derivado da anatomia de ataque
(§1), do moveset da Acendedora (§3), das hitboxes/feedback (§4), dos recursos (§5),
do esqueleto (§6) e do tuning (§9).

Anatomia e feel do ataque
- [ ] Todo ataque (Acendedora e esqueleto) tem as 3 fases distintas: startup, active, recovery (`AttackState`) [CÓDIGO][NORMATIVO]
- [ ] Golpe causa dano só na fase active e uma vez por swing (`canHit`/`markHit`) [CÓDIGO][NORMATIVO]
- [ ] Ataque iniciado não cancela livremente (comprometimento, `AttackState.start`) [CÓDIGO][NORMATIVO]
- [ ] No frame do acerto convergem hit stop, knockback, hit flash, faísca, som e screen shake [CÓDIGO][NORMATIVO]
- [ ] Durante o hit stop, câmera e partículas seguem em dt real (só atacante e alvo congelam) [CÓDIGO][NORMATIVO]
- [ ] Faísca de impacto é laranja-quente (casa com a assinatura visual da Brasa) [DESIGN][NORMATIVO]
- [ ] Sem gore: faísca e osso estilizados low-poly apenas [DESIGN][NORMATIVO]
- [ ] Impacto sentido como pesado e justo (playtest: maioria >= 4/5) [ASPIRACIONAL]

Moveset da Acendedora (§3)
- [ ] Ataque leve em combo de até 3, a 3a com empurrão (`light`/`lightFinisher`) [CÓDIGO][NORMATIVO]
- [ ] Ataque pesado: antecipação longa, knockback forte, hit stop alto, custa stamina, quebra guarda frontal [CÓDIGO][NORMATIVO]
- [ ] Esquiva/recuo direcional com i-frames no MIOLO, custo de stamina; sem input = recuo [CÓDIGO][NORMATIVO]
- [ ] Stamina magra: só esquiva e pesado consomem (andar e leve não) [CÓDIGO][NORMATIVO]
- [ ] Golpe de fogo da fagulha definido: arco/área, gasta fagulha (não stamina), telegrafia própria [DESIGN][A DEFINIR]
- [ ] Bloqueio com escudo decidido (aposentar como verbo central / virar dormente) [DESIGN][A DEFINIR]

Hitboxes e feedback (§4)
- [ ] Detecção por esferas (`overlapSpheres`) com hitbox frontal generosa desacoplada do swing [CÓDIGO][NORMATIVO]
- [ ] Golpe bloqueado pela guarda dá feedback metálico curto distinto do acerto pleno [CÓDIGO][NORMATIVO]
- [ ] Barra de vida do inimigo é billboard que aparece ao tomar dano e some (sem números flutuantes) [CÓDIGO][NORMATIVO]
- [ ] Som em camadas re-tematizado para a cripta (osso, não bronze) [DESIGN][A DEFINIR]

Recursos (§5)
- [ ] Vida da Acendedora = 100 (morre em ~5-6 golpes) [CÓDIGO][NORMATIVO]
- [ ] Stamina: esquiva 25, pesado 35 (de 100); regen 40/s após ~1 s [CÓDIGO][NORMATIVO]
- [ ] Fagulha como recurso: cargas, custo por golpe de fogo, recarrega ao acender o braseiro [DESIGN][A DEFINIR]

Esqueleto e grupos (§6)
- [ ] Esqueleto de guarda com golpe de cima (tell ~0,6 s, direção travada) e recovery punível [CÓDIGO][NORMATIVO]
- [ ] Guarda frontal amortece leve; pesado e flanco passam (ensina a flanquear/pesado) [CÓDIGO][NORMATIVO]
- [ ] Inimigo religado para a malha KayKit Skeleton mantendo a FSM [DESIGN][ASSET][NORMATIVO]
- [ ] Esqueletos da câmara NÃO renascem após limpos (morte permanente até a sala ser descartada) [DESIGN][NORMATIVO]
- [ ] Arquétipos frenético e couraçado definidos (ou adiados com registro) [DESIGN][A DEFINIR]
- [ ] 1-4 esqueletos na câmara comum, pico 4-6 na cisterna, <= 8 skinned ao mesmo tempo [DESIGN][NORMATIVO]

Câmera, alvo e morte (§2, §7, §8)
- [ ] Câmera de 3a pessoa (`ThirdPersonCamera`) com damping e screen shake de impacto [CÓDIGO][NORMATIVO]
- [ ] Colisão de câmera por raycast/spherecast na câmara fechada [DESIGN][A DEFINIR]
- [ ] Lock-on por toggle decidido (adicionar se a turba pedir / adiar) [DESIGN][A DEFINIR]
- [ ] Morte da Acendedora vira derrota real (reinicia câmara/descida), não respawn imediato [DESIGN][A DEFINIR]

Chefe Guardião (§10, detalhe em spec-chefe-guardiao)
- [ ] Guardião usa o mesmo contrato `CombatTarget` e a anatomia de 3 fases [CÓDIGO][NORMATIVO]
- [ ] Duelo 1v1 com 3-4 padrões legíveis e escalada de ritmo abaixo de ~50% sem verbos novos [DESIGN][NORMATIVO]
- [ ] Sem respawn: vencê-lo acende a Brasa e fecha o slice [DESIGN][NORMATIVO]
- [ ] Spec dedicada do Guardião escrita (`spec-chefe-guardiao.md`) [DESIGN][A DEFINIR]

Tuning e orçamento (§9, `projeto-brasa.md` §4)
- [ ] Números de combate centralizados em `game/combat/tuning.ts` (fonte única) [CÓDIGO][NORMATIVO]
- [ ] Nomes de dificuldade re-tematizados de Josué para Brasa [DESIGN][A DEFINIR]
- [ ] Latência de input crítico < 100 ms (medida) [CÓDIGO][NORMATIVO]
- [ ] < 60 draw calls por câmara; 60 fps desktop / 30 fps mobile médio na câmara cheia [DESIGN][NORMATIVO]
- [ ] FSM de inimigo roda em ticks (não todo frame); malha instanciada; colliders simples [CÓDIGO][NORMATIVO]

Processo
- [ ] Sem travessões, sem emojis em qualquer texto exibido (guia de estilo) [NORMATIVO]
- [ ] Itens [A DEFINIR] resolvidos ou explicitamente adiados com registro [NORMATIVO]
