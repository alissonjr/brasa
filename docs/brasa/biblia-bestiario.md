# Brasa - Bíblia de Bestiário (os mortos despertos)

Documento de domínio dos INIMIGOS de Brasa. Substitui, para o novo tema, a antiga
bíblia de fauna da era Josué (animais e vida de acampamento), que não tem mais
correspondência na cripta. O elenco hostil de Brasa é um só: os ESQUELETOS do reino,
mortos selados nas câmaras que despertam quando a Brasa recua e a luz some.

Documento mestre da ficção: [`../projeto-brasa.md`](../projeto-brasa.md) (CANON). Régua
de detalhe e Definition of Done: [`../padrao-de-detalhe.md`](../padrao-de-detalhe.md).
Para o ápice do bestiário, o **Guardião da Brasa apagada**, existe spec próprio; aqui
ele só é mencionado como clímax, não detalhado.

Convenção (herdada do CANON): pt-BR, sem travessões, sem emojis. PROCEDÊNCIA: `[DESIGN]`
(decisão criativa nossa), `[CÓDIGO]` (observado em `prototipo/src`), `[ASSET]` (procede
de pacote CC0 existente). EXIGÊNCIA: `[NORMATIVO]` (entra no aceite, verificável),
`[ASPIRACIONAL]` (mood/intenção, não bloqueia), `[A DEFINIR]` (decisão pendente).

Snapshot: 2026-06-14.

Ver também: [`../inventario-primitivas-e-migracao-assets.md`](../inventario-primitivas-e-migracao-assets.md)
(estado do `defender.ts` e migração para malha rigada), e o futuro spec do Guardião.

---

## 1. A natureza dos mortos despertos

### 1.1 Por que estão ali

`[DESIGN]` O reino vive do **frio eterno** mantido à distância pela **Brasa**, a chama
ancestral no fundo do **poço-cripta**. Ao longo de gerações, os mortos do reino foram
descidos e selados nas **câmaras** que revestem o poço, cada uma atrás de uma **porta
de pedra selada**. Enquanto a Brasa ardia, a luz quente alcançava câmara após câmara e
os mortos repousavam: a Brasa não só aquecia a superfície, ela *velava* o sono dos
selados. Os esqueletos não são invasores nem demônios convocados; são os próprios
antepassados do reino, deitados onde sempre estiveram.

`[DESIGN]` `[ASPIRACIONAL]` O tom é mítico e melancólico, não de horror gratuito. O
jogador não enfrenta monstros estranhos: enfrenta os mortos da própria casa, que só
querem o que a luz lhes tirou de volta. A violência é sóbria, sem gore (alinhado ao tom
do projeto): ossos que se reerguem, não vísceras.

### 1.2 Por que despertam no escuro

`[DESIGN]` `[NORMATIVO]` A regra de mundo, verificável na ficção e no gameplay, é:
**escuro desperta, Brasa adormece.** Conforme a Brasa morre e a luz recua poço abaixo,
o frio toma cada câmara; sem a luz quente que velava o sono, os mortos da câmara
**despertam**. Por isso cada sala da descida começa em penumbra fria e seus esqueletos
já estão de pé ou se reerguendo: a ausência de luz é a causa diegética do combate.

`[DESIGN]` `[NORMATIVO]` O despertar é por CÂMARA, não global. Como o jogo mantém uma
sala carregada por vez (CANON 4.1), só os mortos da câmara atual estão ativos. Ao
**acender o braseiro** central, a luz quente volta e (na ficção) reconduz aquela câmara
ao repouso: por isso o braseiro só pode ser aceso com a sala já limpa, e acendê-lo
**fecha** o capítulo daquela câmara e destrava a porta seguinte.

### 1.3 Como reagem à luz e à Brasa

`[DESIGN]` `[ASPIRACIONAL]` Os mortos têm fototropismo invertido: o escuro os anima, a
luz os enfraquece. Leituras de comportamento derivadas disso, a calibrar no playtest:

- `[DESIGN]` `[ASPIRACIONAL]` **Recuo da luz da Acendedora.** A Acendedora carrega uma
  **fagulha**; o pequeno raio de luz quente que ela projeta incomoda os mortos. Perto
  da fonte de luz, os esqueletos hesitam uma fração a mais antes de atacar (telegrafia
  levemente mais longa). `[A DEFINIR]` se isso vira um modificador mecânico real (ex.:
  +X% no startup dentro do raio de luz) ou fica só como leitura de animação.
- `[DESIGN]` `[ASPIRACIONAL]` **Reanimação no escuro.** Onde a luz não chega, um morto
  caído pode se reerguer. No motor atual isso já existe como respawn temporizado
  (`defender.ts` revive após `RESPAWN_SEC = 2.0` `[CÓDIGO]`). Em Brasa, a leitura é:
  enquanto o braseiro não está aceso, os ossos voltam a se juntar. `[A DEFINIR]`
  ratificar se na cripta o respawn continua (tensão de "limpe rápido") ou se cada morto
  fica abatido de vez e o braseiro só sela o silêncio. Recomendação `[DESIGN]`: abatido
  de vez por sala, com a *opção* de uma câmara especial que reanima até o braseiro
  acender, usada com parcimônia.
- `[DESIGN]` `[NORMATIVO]` **Acender o braseiro encerra a hostilidade da câmara.** Com a
  sala limpa e o braseiro aceso, nenhum morto daquela câmara volta a se levantar. A luz
  quente devolve o repouso. Esta é a recompensa diegética do laço.

### 1.4 O que NÃO são

`[DESIGN]` `[NORMATIVO]` Para preservar coerência e leveza:
- Não há outra família de inimigos no slice além de esqueletos (CANON 5: o elenco
  hostil é o Character Pack: Skeletons do KayKit). Nada de zumbis de carne, slimes,
  insetos, etc. Se um dia entrar um não-esqueleto, será exceção registrada `[A DEFINIR]`
  (CANON aponta Quaternius Ultimate Monsters como reforço possível, fora de escopo).
- Não há gore, mutilação realista nem sangue. Mortos despertos são osso e armadura.
- O **Guardião** é um morto desperto também, mas singular e de outra escala: é o ápice,
  detalhado no seu próprio spec, fora deste documento.

---

## 2. O esqueleto único compartilhado (base de todas as fichas)

`[ASSET]` `[NORMATIVO]` Todos os inimigos comuns são a MESMA malha de esqueleto do
**KayKit Character Pack: Skeletons** (CC0), com o MESMO esqueleto (armature) e a MESMA
biblioteca de animação compartilhada `AnimationLibrary_Godot_Standard.gltf`, já em
disco e usada pela Acendedora (CANON 4.3, 5). Os tipos abaixo NÃO são malhas diferentes:
são a mesma malha instanciada, diferenciada por quatro alavancas baratas:

1. `[ASSET]` `[NORMATIVO]` **Arma e escudo** trocáveis (anexados à mão, como
   `defender.ts` faz hoje com `buildSword`/`buildRoundShield` `[CÓDIGO]`). O KayKit
   Skeletons traz armas avulsas (espada, escudo, machado, lança, arco) no mesmo estilo.
2. `[ASSET]` `[NORMATIVO]` **Peças de armadura** opcionais (elmo, ombreira) do próprio
   pacote, anexadas ou ocultadas, para variar a silhueta sem nova malha.
3. `[DESIGN]` `[NORMATIVO]` **Cor** (tinte do material / leve variação de osso e de
   pano/metal) para distinguir o tipo a distância. Paletas por ficha na seção 3.
4. `[DESIGN]` `[NORMATIVO]` **Comportamento** parametrizado na mesma FSM (seção 4): os
   números (alcance, velocidade, antecipação, dano, vida) mudam por tipo num bloco de
   tuning, espelhando o `DEFENDER` atual (`tuning.ts` `[CÓDIGO]`).

`[NORMATIVO]` Tris-alvo do inimigo comum: **1k a 3k** (CANON 4.2; o KayKit Skeleton já
cabe). Toda variante usa a mesma contagem por compartilhar a malha; armas/elmos somam
poucas centenas de tris e são instâncias do catálogo de props.

`[DESIGN]` `[NORMATIVO]` **Biotipo:** humanoide esquelético, mesma altura e proporção da
Acendedora (compartilham o esqueleto), em torno de 1,7 a 1,8 m de altura de jogo. O peso
visual de cada tipo vem da armadura e da pose, não da estatura.

---

## 3. Fichas por tipo de inimigo

Formato conforme o template de ficha (`padrao-de-detalhe.md` 3). Toda ficha parte da
mesma malha (seção 2). Os números de combate são propostas derivadas do `DEFENDER`
atual (`tuning.ts` `[CÓDIGO]`) e ficam `[A DEFINIR]` até o playtest os ratificar; o que
é `[NORMATIVO]` é a EXISTÊNCIA do papel, da telegrafia legível e da diferenciação
visual, não o valor exato.

Convenção de paleta: o **osso** é o traço comum (tom de marfim frio); o tipo se lê pela
cor do metal/pano e pelo acento. Frio-azul = morte; quando a sala acende, o laranja do
braseiro recolore tudo (assinatura visual do CANON).

### 3.1 Esqueleto base, lâmina nua (id: `skeleton_blade`)

- Resumo `[DESIGN]`: o morto mais comum, espada curta e sem escudo, corpo a corpo
  direto. É o tijolo do bestiário e o herdeiro funcional do `defender.ts` atual.
- Procedência: `[ASSET]` malha/armas KayKit; `[DESIGN]` papel; `[CÓDIGO]` FSM e tuning
  vêm de `defender.ts`/`DEFENDER`.
- Papel no combate `[NORMATIVO]`: pressão básica e numerosa. Ensina o laço (aproxima,
  telegrafa, pune-se na recuperação). É o que aparece em maior número.
- Telegrafia de ataque `[NORMATIVO]`: **golpe de cima** com antecipação longa e legível
  (proposta ~0,6 s, igual ao `overhead` atual `[CÓDIGO]`), braço/espada erguidos e
  DIREÇÃO TRAVADA no início do golpe, dando janela para esquivar/flanquear; recuperação
  punível (proposta ~0,75 s) + cooldown.
- Biotipo / tris-alvo `[NORMATIVO]`: humanoide esquelético, 1k-3k (malha única).
- Paleta `[NORMATIVO]`: osso marfim `#d9cdb0`; lâmina aço frio `#8a93a0`; trapos escuros
  `#3a3530`; sem acento de cor (é a referência neutra). Olhos: ponto frio `#5fb6d6`.
- Comportamento na FSM `[NORMATIVO]`: `approach -> attacking -> cooldown` (e `dead`),
  exatamente os modos do `defender.ts` `[CÓDIGO]`. Sem guarda (sem escudo: todo golpe do
  herói entra cheio).
- Densidade típica `[DESIGN]`: 2 a 4 por câmara de guarda; o grosso de uma cisterna.
- Intenção / mood `[ASPIRACIONAL]`: o soldado anônimo do reino morto, repetido até virar
  silhueta familiar; sua morte não é triunfo, é dó.
- Aceite: ver seção 7.

### 3.2 Esqueleto com escudo (id: `skeleton_shield`)

- Resumo `[DESIGN]`: morto com espada e **escudo redondo**; guarda frontal que ensina
  flanqueio e o golpe pesado/quebra-guarda. É o `defender.ts` com escudo, tal como hoje.
- Procedência: `[ASSET]` escudo KayKit; `[CÓDIGO]` a mecânica de guarda já existe em
  `defender.ts` (`takeHit`: bloqueio frontal quando em `approach`, golpe leve frontal
  reduzido a 50%, pesado/flanco passam).
- Papel no combate `[NORMATIVO]`: muro defensivo. Ensina que ataque leve frontal é
  amortecido e que a resposta é flanquear, usar o pesado (quebra-guarda) ou esperar a
  abertura. Bom em par com arqueiros ou em frente de linha.
- Telegrafia de ataque `[NORMATIVO]`: mesmo golpe de cima do base, mais lento de subir a
  guarda; a guarda em si é visível (escudo erguido à frente). A abertura clara é durante
  a recuperação do próprio golpe, quando baixa o escudo.
- Biotipo / tris-alvo `[NORMATIVO]`: humanoide esquelético, 1k-3k; escudo é prop
  instanciado (poucas centenas de tris).
- Paleta `[NORMATIVO]`: osso `#d9cdb0`; escudo de bronze patinado `#7a5a32` com borda
  fria `#56606b`; pano azul-acinzentado `#33414d` (acento que diz "defensor"). Olhos
  `#5fb6d6`.
- Comportamento na FSM `[NORMATIVO]`: idêntico ao base, com a flag de guarda do
  `takeHit` ATIVA (bloqueio frontal em `approach`). Move um pouco mais devagar (proposta
  -15% na `moveSpeed`).
- Densidade típica `[DESIGN]`: 1 a 2 por câmara de combate; raramente em bando (dois
  muros já mudam muito o ritmo).
- Intenção / mood `[ASPIRACIONAL]`: o guarda paciente que não cede a porta; teimosia
  póstuma.
- Aceite: ver seção 7.

### 3.3 Esqueleto arqueiro (id: `skeleton_archer`)

- Resumo `[DESIGN]`: morto com **arco**, mantém distância e fustiga o jogador, forçando-o
  a fechar espaço e a usar pilares como cobertura.
- Procedência: `[ASSET]` arco KayKit; `[DESIGN]` papel à distância; FSM estende o padrão
  do `defender.ts` com um modo de mira/disparo (novo, `[A DEFINIR]` na implementação).
- Papel no combate `[NORMATIVO]`: controle de espaço. Transforma a sala num problema de
  posição: o jogador precisa avançar sob fogo ou cortar a linha de visão (os pilares da
  cisterna/salão do CANON 3.2 servem de cobertura).
- Telegrafia de ataque `[NORMATIVO]`: **mira** com antecipação longa e MUITO legível
  (proposta ~0,9 s): arco esticado, linha/raio fino de mira frio apontando o alvo, e o
  ponto de luz dos olhos pisca antes do tiro. O projétil é lento o bastante para ser
  esquivado em movimento. Sem mira instantânea (nada de tiro sem aviso).
- Biotipo / tris-alvo `[NORMATIVO]`: humanoide esquelético, 1k-3k; arco e flecha props
  instanciados.
- Paleta `[NORMATIVO]`: osso `#d9cdb0`; arco de osso/madeira escura `#5c4632`; capuz/pano
  esverdeado frio `#3a4a3f` (acento "à distância"); ponta de flecha com leve brilho frio
  `#7fc8e0`. Olhos `#5fb6d6`.
- Comportamento na FSM `[NORMATIVO]`: estados `reposition -> aim -> shoot -> cooldown`
  (variação do padrão; ver 4.2). Recua (kite) se o herói chega perto demais; só parte
  para corpo a corpo fraco se encurralado. Sem guarda.
- Densidade típica `[DESIGN]`: 1 a 2 por sala, NUNCA isolado num espaço aberto sem
  cobertura para o jogador. Sempre com pelo menos um melee à frente para criar o dilema.
- Restrição de combate `[NORMATIVO]`: pelo menos um pilar/cobertura na sala quando há
  arqueiro (senão vira punição injusta).
- Intenção / mood `[ASPIRACIONAL]`: o vigia da cripta que ainda guarda o corredor de
  longe; mira fria e paciente.
- Aceite: ver seção 7.

### 3.4 Esqueleto pesado, dois tempos (id: `skeleton_heavy`)

- Resumo `[DESIGN]`: morto encouraçado com **arma de duas mãos** (machado ou maça
  grande), lento, golpe devastador e muito telegrafado; o "mini-bruto" da câmara.
- Procedência: `[ASSET]` machado/maça e elmo/ombreiras KayKit; `[DESIGN]` papel de peso.
- Papel no combate `[NORMATIVO]`: âncora de tensão. Pune o jogador que fica parado;
  recompensa leitura e esquiva. É o inimigo que dita o ritmo de uma cisterna.
- Telegrafia de ataque `[NORMATIVO]`: **golpão horizontal ou de cima** com antecipação
  bem longa (proposta ~1,0-1,1 s), passo de apoio antes do golpe e arco amplo; knockback
  e hit stop altos (proposta dano ~26, knockback forte, derivado do `heavy` do herói
  `[CÓDIGO]`). Recuperação longa e MUITO punível: a janela de contra-ataque é generosa.
- Biotipo / tris-alvo `[NORMATIVO]`: humanoide esquelético, 1k-3k; o "peso" vem da
  armadura (elmo + ombreiras instanciados) e da pose, não de malha maior.
- Paleta `[NORMATIVO]`: osso `#d9cdb0`; placas de ferro escuro `#41464d` com desgaste
  `#2a2d31`; rebites/fio frio `#6b7682`; acento vermelho-frio apagado no elmo `#6e3b3b`
  (diz "perigo"). Olhos mais intensos `#79d0ee`.
- Comportamento na FSM `[NORMATIVO]`: mesmo `approach -> attacking -> cooldown`, com
  `moveSpeed` baixa (proposta -40%), `attackRange` maior, antecipação e recuperação
  longas, e mais vida (proposta 2x do base). Pode ter leve resistência a knockback
  (`[A DEFINIR]`).
- Densidade típica `[DESIGN]`: no máximo 1 por sala comum; 1 a 2 só num pico de combate
  desenhado. Nunca em bando (custo de tensão e de leitura).
- Intenção / mood `[ASPIRACIONAL]`: o campeão sepultado em armadura cerimonial, lento e
  inevitável; quase um ensaio do Guardião.
- Aceite: ver seção 7.

### 3.5 Variantes propostas (DESIGN, opcionais)

`[DESIGN]` Variações baratas pela mesma malha, para enriquecer sem novo asset nem novo
esqueleto. Entram no slice só se houver folga; cada uma é `[A DEFINIR]` quanto a inclusão.

- **Esqueleto rasteiro, dupla lâmina (id: `skeleton_dual`)** `[DESIGN]`: duas armas
  curtas, rápido e frágil; antecipação curta mas dano baixo e pouca vida; ataca em
  rajada de dois tempos. Papel: pressão de velocidade, força o jogador a não ficar
  cercado. Paleta: osso + acento âmbar-frio `#9a7b4f`. Risco: antecipação curta demais
  fere a regra de telegrafia legível; calibrar com cuidado.
- **Esqueleto lanceiro (id: `skeleton_spear`)** `[DESIGN]`: lança, alcance maior que o
  base, estocada reta telegrafada; bom atrás de um escudo (parede de lanças). Papel:
  punir a aproximação frontal, recompensar o flanco. Paleta: osso + pano ferrugem
  `#6b4a3a`.
- **Esqueleto tocha (id: `skeleton_torch`)** `[DESIGN]` `[ASPIRACIONAL]`: porta uma
  pequena chama fria/azulada (não a Brasa), serve de FAROL diegético e atmosférico numa
  sala escura e de leitura de "este aqui ilumina um pedaço". Mecânica mínima: igual ao
  base, mas a luz que carrega é o gancho (e some quando ele cai, escurecendo um trecho).
  Cuidado de orçamento: a luz dele conta no teto de luzes dinâmicas da sala (CANON 4.4).
  `[A DEFINIR]` se vale o custo de luz; provável uso pontual, 0 a 1 por sala.

`[DESIGN]` `[NORMATIVO]` Qualquer variante que entre OBEDECE: mesma malha/esqueleto,
diferenciação só por arma/armadura/cor/comportamento, telegrafia legível, e cabe no
orçamento da seção 6. Não criar variante que exija nova malha ou novo esqueleto.

---

## 4. Comportamento na FSM existente

`[CÓDIGO]` A IA já existe e é leve: `StateMachine` (estado + tempo no estado) e `Ticker`
(decisão em TICKS, não todo frame) em `engine/ai/fsm.ts`. O inimigo de referência,
`defender.ts`, decide a cada `0.12 s` (`new Ticker(0.12)`), move/anima por frame e só
DECIDE no tick. Brasa religa essa mesma FSM na malha KayKit (CANON 6.2: trocar
`defender.ts` pela malha rigada mantendo a FSM).

### 4.1 Estados do melee (base, escudo, pesado, lanceiro, dupla)

`[CÓDIGO]` `[NORMATIVO]` Reaproveitar os modos de `defender.ts`:

| Estado | O que faz | Saída |
|---|---|---|
| `approach` | vira-se para o herói; anda até `approachUntil`; se em alcance, no próximo tick inicia o golpe | em alcance -> `attacking`; (escudo: guarda frontal ativa aqui) |
| `attacking` | DIREÇÃO TRAVADA; roda startup (antecipação) -> active (golpe) -> recovery; conecta se o herói está no cone e em alcance | fim do swing -> `cooldown` |
| `cooldown` | encara o herói, parado, janela de punição | passado `cooldownSec` -> `approach` |
| `dead` | encolhe; (no motor atual) renasce após `RESPAWN_SEC` | revive ou (Brasa) fica abatido até o braseiro |

`[NORMATIVO]` A telegrafia vive no `attacking`: a antecipação (startup) é longa e
legível e a direção fica travada nela (já implementado: `root.rotation.y` preso a
`attackDir` durante o golpe). O que muda por tipo são só os números do bloco de tuning
(antecipação, alcance, velocidade, dano, vida), espelhando `DEFENDER`.

### 4.2 Extensão para o arqueiro

`[DESIGN]` `[NORMATIVO]` O arqueiro reusa `StateMachine`/`Ticker`, com modos próprios
porque luta a distância:

| Estado | O que faz | Saída |
|---|---|---|
| `reposition` | busca distância/linha de visão; recua se o herói chega perto (kite) | linha de tiro boa -> `aim` |
| `aim` | parado, telegrafa a mira (arco esticado, linha fina, olhos piscando) | fim do startup de mira -> `shoot` |
| `shoot` | dispara o projétil lento esquivável | -> `cooldown` |
| `cooldown` | recuperação punível | passado cooldown -> `reposition` |

`[A DEFINIR]` projétil: pool de poucas flechas reutilizadas (sem física pesada;
trajetória reta cinemática, alinhado a "corpos de física só nas paredes e atores vivos",
CANON 4.4). Sem homing.

### 4.3 Despertar, agro e descarte

- `[DESIGN]` `[NORMATIVO]` **Despertar por sala:** os esqueletos da câmara entram ativos
  (de pé ou erguendo-se) quando a Acendedora cruza a porta e ela se sela (CANON 3.1).
  Não há agro entre salas: a porta selada isola.
- `[DESIGN]` `[NORMATIVO]` **Descarte:** ao acender o braseiro e cruzar a porta de saída,
  todos os esqueletos da câmara são DESCARTADOS junto com a sala (malhas instanciadas,
  materiais, corpos de física), conforme o gerenciador de uma-sala-ativa (CANON 4.1,
  6.2). Nenhum inimigo persiste entre câmaras.
- `[DESIGN]` `[A DEFINIR]` **Reanimação:** ver 1.3; decidir se o `dead -> revive` do
  motor (`RESPAWN_SEC`) permanece na cripta ou é substituído por "abatido de vez por
  sala". Recomendação: abatido de vez, com reanimação reservada a uma câmara-conceito
  específica.

---

## 5. Densidade por sala (dentro do orçamento)

`[DESIGN]` `[NORMATIVO]` O teto de inimigos skinned vivos ao mesmo tempo por sala é
**8** (ratifica a proposta do CANON 4.3 como NORMATIVO para este documento; rebaixar se
a medição de skinning na CPU exigir). A composição abaixo casa os tipos de sala do CANON
3.2 com o elenco:

| Tipo de sala (CANON 3.2) | Composição proposta | Total skinned | Observação |
|---|---|---|---|
| Câmara de guarda | 2 a 4 base | 2-4 | ensina o laço; só melee simples |
| Corredor / antecâmara | 0 a 1 (base ou um escudo) | 0-1 | respiro e telegrafia; foco em baú/armadilha |
| Cisterna / salão | 4 a 6 (mix: base + 1 escudo ou 1 arqueiro ou 1 pesado) | 4-6 | pico de combate; usa pilares de cobertura |
| Santuário do braseiro | 0 a 2 | 0-2 | recompensa marcada; pouca ou nenhuma luta |
| Câmara do Guardião | só o Guardião (ver spec próprio) | n/a | clímax, fora deste documento |

`[NORMATIVO]` Regras de composição (mantêm leitura e justiça):
- No máximo 8 esqueletos vivos por sala ao mesmo tempo.
- No máximo 1 pesado por sala comum (2 só num pico desenhado).
- No máximo 2 arqueiros por sala, e somente com cobertura (pilar) para o jogador.
- Não empilhar dois "muros" (escudos) num espaço apertado sem rota de flanco.
- Onda x simultâneo `[A DEFINIR]`: uma sala pode soltar inimigos em 2 levas (ex.: 3 + 3)
  para manter o teto de 8 simultâneos e ainda dar volume; ratificar no playtest.

`[DESIGN]` `[ASPIRACIONAL]` Curva da descida: começar com base puro (ensino), introduzir
o escudo, depois o arqueiro (com cobertura), depois o pesado, e misturar nos picos.
Cada novo tipo estreia sozinho num contexto controlado antes de aparecer em mix.

---

## 6. Como instanciar barato (mesma malha repetida)

`[NORMATIVO]` O custo é controlado por compartilhamento agressivo, dentro do teto de
**< 60 draw calls por sala** (CANON 4.1):

- `[ASSET]` `[NORMATIVO]` **Uma malha de esqueleto, instanciada.** Carregar o glb do
  KayKit Skeleton uma vez (via `assetService`/`loadContainer`, CANON 6.1) e instanciar N
  cópias por sala. Helpers de instância já existem em `sceneKit.ts` e o padrão de
  template + scatter por thin instance existe em `vegetation.ts` (CANON 6.1: "úteis para
  instanciar props e inimigos da cripta").
- `[NORMATIVO]` **Esqueleto e biblioteca de animação únicos** para todos os humanoides
  (herói + inimigos), `AnimationLibrary_Godot_Standard.gltf` (CANON 4.3). Não carregar
  conjuntos de animação por tipo.
- `[NORMATIVO]` **Instância skinned x thin instance:** inimigos animam com esqueleto, ou
  seja são instâncias skinned (não thin instances estáticas). O teto de 8 simultâneos
  (seção 5) existe justamente para conter o custo de skinning na CPU. Props que NÃO
  animam (armas largadas, ossos de cenário, flechas no chão) podem ir como thin instance.
- `[ASSET]` `[NORMATIVO]` **Atlas único por pacote** (CANON 5): o KayKit Skeletons usa um
  atlas; as variações de tipo são por TINTE de material / instância de material, não por
  textura nova. Trocar cor não cria draw call novo significativo se os materiais forem
  poucos e compartilhados.
- `[ASSET]` `[NORMATIVO]` **Armas e elmos do catálogo:** cada arma/elmo é um prop do
  pacote instanciado e anexado ao osso da mão/cabeça (como `defender.ts` parenteia
  `buildSword`/`buildRoundShield` `[CÓDIGO]`). Compartilham material; somam poucos draw
  calls mesmo com vários inimigos.
- `[NORMATIVO]` **Sem física por inimigo além do necessário:** movimento e knockback
  cinemáticos (como hoje em `defender.ts`, sem corpo rígido), e descarte de tudo ao
  trocar de sala (CANON 4.4, 4.1). Hurtbox é uma esfera lógica (`hurtbox` em
  `defender.ts` `[CÓDIGO]`), não um corpo de física.
- `[NORMATIVO]` **Pipeline:** o glb do Skeleton e cada arma nova passam por
  `optimize_asset.py` + `validate_gltf.py` (escala aplicada, Y-up, dentro do teto de
  tris, atlas preservado), CANON 4.5.

`[DESIGN]` `[ASPIRACIONAL]` Orçamento de draw calls de uma cisterna cheia (estimativa a
medir): peças modulares da sala instanciadas (~poucas dezenas), 1 malha de esqueleto
instanciada N vezes (contribuição pequena por instância), 1-2 materiais de arma, 1-2
luzes do braseiro. A folga abaixo de 60 deve sobrar; o gerenciador de salas é quem
garante o teto ao não manter duas salas vivas.

---

## 7. Checklist de aceite (Definition of Done)

`[NORMATIVO]` Cada item recebe sim/não honesto. `[ASPIRACIONAL]` não bloqueia.
`[A DEFINIR]` em aberto impede o "pronto" ou vira adiamento registrado.

### Natureza e regras de mundo (seção 1)
- [ ] Inimigos comuns são exclusivamente esqueletos (mortos despertos do reino), sem outra família no slice [DESIGN][NORMATIVO]
- [ ] Cada câmara começa em penumbra fria com seus mortos ativos/erguendo-se (escuro desperta) [DESIGN][NORMATIVO]
- [ ] Acender o braseiro (sala já limpa) encerra a hostilidade da câmara e destrava a porta [DESIGN][NORMATIVO]
- [ ] Sem gore, sem sangue, sem mutilação realista (osso e armadura) [DESIGN][NORMATIVO]
- [ ] O Guardião é mencionado como ápice e NÃO detalhado aqui (tem spec próprio) [DESIGN][NORMATIVO]

### Esqueleto único e variação (seção 2 e 3)
- [ ] Todos os tipos usam a MESMA malha KayKit Skeleton e o MESMO esqueleto/biblioteca de animação [ASSET][NORMATIVO]
- [ ] Tipos diferenciados só por arma/armadura, cor e comportamento (nenhuma malha ou esqueleto novo) [DESIGN/ASSET][NORMATIVO]
- [ ] Ficha presente para: base (lâmina), escudo, arqueiro, pesado [DESIGN][NORMATIVO]
- [ ] Cada ficha tem papel, telegrafia legível, biotipo/tris-alvo, paleta (hex) e comportamento na FSM [DESIGN][NORMATIVO]
- [ ] Inimigo comum dentro de 1k-3k tris (malha única) [ASSET][NORMATIVO]
- [ ] Cada tipo é distinguível a distância pela cor/silhueta (teste de leitura) [DESIGN][NORMATIVO]
- [ ] Toda variante opcional incluída respeita malha/esqueleto único e telegrafia legível [DESIGN][NORMATIVO]

### Comportamento e FSM (seção 4)
- [ ] Melee usa a FSM existente (approach/attacking/cooldown/dead) com direção travada na antecipação [CÓDIGO][NORMATIVO]
- [ ] Antecipação de ataque longa e legível por tipo; recuperação punível [DESIGN][NORMATIVO]
- [ ] Escudo amortece golpe leve frontal; pesado/flanco passam (mecânica do takeHit) [CÓDIGO][NORMATIVO]
- [ ] Arqueiro telegrafa a mira e dispara projétil lento esquivável (sem mira instantânea) [DESIGN][NORMATIVO]
- [ ] Esqueletos despertam por câmara (porta selada isola; sem agro entre salas) [DESIGN][NORMATIVO]
- [ ] Todos os inimigos da câmara são descartados ao trocar de sala (uma-sala-ativa) [DESIGN][NORMATIVO]
- [ ] Decisão de IA em ticks (Ticker), movimento/animação por frame [CÓDIGO][NORMATIVO]

### Densidade e orçamento (seções 5 e 6)
- [ ] No máximo 8 esqueletos skinned vivos por sala ao mesmo tempo [DESIGN][NORMATIVO]
- [ ] No máximo 1 pesado por sala comum; no máximo 2 arqueiros e sempre com cobertura [DESIGN][NORMATIVO]
- [ ] Composição por tipo de sala conforme a tabela da seção 5 [DESIGN][NORMATIVO]
- [ ] Uma malha de esqueleto carregada e instanciada por sala (sem malha por inimigo) [ASSET][NORMATIVO]
- [ ] Armas/elmos como props do catálogo instanciados e parenteados ao osso [ASSET][NORMATIVO]
- [ ] Movimento/knockback cinemáticos, sem corpo de física por inimigo; hurtbox lógica [CÓDIGO][NORMATIVO]
- [ ] Glb do Skeleton e armas novas passaram por optimize_asset.py + validate_gltf.py [ASSET][NORMATIVO]
- [ ] Sala com inimigos mantém < 60 draw calls e 60 fps desktop / 30 mobile [NORMATIVO]

### Higiene de processo
- [ ] Sem travessões, sem emojis em qualquer texto exibido (guia de estilo) [NORMATIVO]
- [ ] Itens [A DEFINIR] resolvidos ou explicitamente adiados com registro [NORMATIVO]

### Pendências [A DEFINIR] consolidadas
- [ ] Luz da Acendedora vira modificador mecânico de telegrafia ou fica só leitura (1.3)
- [ ] Reanimação no escuro: manter respawn do motor ou "abatido de vez por sala" (1.3, 4.3)
- [ ] Números de combate por tipo ratificados no playtest (alcance, velocidade, dano, vida) (seção 3)
- [ ] Resistência a knockback do pesado (3.4)
- [ ] Inclusão das variantes opcionais: dupla lâmina, lanceiro, tocha (3.5)
- [ ] Projétil do arqueiro: pool/trajetória definidos (4.2)
- [ ] Ondas (leva 3+3) vs. todos simultâneos por sala (seção 5)
- [ ] Teto de 8 skinned por sala confirmado após medir skinning na CPU (seção 5)
