# Técnica: Locomoção e Movimento do Corpo (animação)

Como o corpo do personagem se MOVE em cada ação: andar, correr, parar, virar, pular, saltar,
esquivar, e a mecânica corporal dos golpes. É o documento do "o que a animação deve mostrar"
(biomecânica + princípios de animação), distinto do "como tocar isso na engine", que está em
[`tecnica-animacao-babylon.md`](tecnica-animacao-babylon.md) (AnimationGroups, blend, máquina de
estados, root motion, foot IK). Serve tanto para autorar/escolher clipes (Mixamo/Blender, M1)
quanto para afinar a animação procedural do gray-box (M0).

Liga-se a:
- [`tecnica-anatomia-humana.md`](tecnica-anatomia-humana.md) (proporções e marcos do corpo que
  estas poses deformam).
- [`personagens/01-lideres-israelitas.md`](personagens/01-lideres-israelitas.md) seção 1.6
  (a CARACTERIZAÇÃO do movimento do Josué: porte ereto, passada longa e firme, tronco estável;
  este doc dá a biomecânica genérica, a ficha dá a personalidade que a colore).
- [`spec-combate.md`](spec-combate.md) (os tempos de ataque/esquiva/i-frames em frames a 60 FPS,
  que a mecânica corporal dos golpes precisa respeitar).
- [`tecnica-deformacao-de-tecidos.md`](tecnica-deformacao-de-tecidos.md) (o manto e a túnica como
  movimento secundário que segue o corpo).
- [`biblia-vfx-e-shaders.md`](biblia-vfx-e-shaders.md) (poeira no plantar do pé, no impulso e na
  aterrissagem: o VFX que vende o peso).

## 0. Âncora no código atual

O protótipo (camadas em `prototipo/src/`) já define os números que a animação tem que respeitar,
em `engine/character/characterController.ts`: `WALK_SPEED = 4`, `RUN_SPEED = 8`,
`IN_AIR_SPEED = 5` (m/s), `JUMP_HEIGHT = 1.6` (m), gravidade ~18 m/s2, e a máquina de estados de
locomoção `ON_GROUND | IN_AIR | START_JUMP`. O visual procedural em
`game/actors/heroModel.ts` expõe `animate(dt, speed, grounded)` e faz o blend de locomoção por
velocidade. Tudo neste documento serve essas duas peças: ou afina a animação procedural, ou
define como os clipes autorados se comportam nessas velocidades e estados.

## 1. Princípios de animação que mais importam aqui

Os "12 princípios" clássicos, recortados para movimento de corpo inteiro:

- Timing e espaçamento: a quantidade de frames e a distribuição deles definem peso e energia.
  Movimento pesado = mais frames e ease-in/ease-out; movimento rápido = poucos frames, golpe
  seco. Os números da spec-combate (frames a 60 FPS) são timing.
- Peso (a leitura número 1 de um corpo humano): o personagem tem massa. Isso aparece em
  antecipação (carregar antes de agir), ease-in/out (acelerar e frear, não velocidade
  constante), e em como ele ABSORVE forças (joelhos cedem ao aterrissar).
- Antecipação: todo movimento grande tem um contramovimento antes (agachar antes de pular,
  recuar a arma antes do golpe). Sem antecipação, o movimento "teleporta" e não lê.
- Continuidade e sobreposição (follow-through / overlapping): partes leves param depois das
  pesadas. O quadril lidera, o tronco segue, os braços e o manto chegam por último. Nada para
  tudo no mesmo frame.
- Arcos: membros se movem em arco, não em linha reta (a mão num soco descreve curva). Linha reta
  lê robótico.
- Squash & stretch (sutil em humano realista, mais livre no low-poly estilizado): comprime na
  aterrissagem, estica no ápice do pulo. No nosso estilo, leve, sem virar desenho elástico.
- Ação secundária: o que o corpo faz "de fundo" (respirar parado, o manto esvoaçando, a cabeça
  varrendo o horizonte). Dá vida sem competir com a ação principal.
- Exagero moderado: pose-chave mais clara que a vida real para LEGIBILIDADE (pilar da
  spec-combate), sem cartoon.

## 2. Conceitos de biomecânica (transversais a tudo)

- Centro de massa (CdM): fica ~na pelve. Todo movimento equilibrado mantém o CdM sobre a base de
  apoio; todo movimento dinâmico (andar, atacar) é uma queda controlada do CdM e sua recuperação.
- Base de apoio: a área entre os pés. Pés juntos = instável e ágil; pés afastados = estável e
  plantado (pose de combate, bloqueio). Andar é tirar o CdM da base e pegá-lo com o pé da frente.
- Transferência de peso: o motor de quase tudo. Andar, golpear, virar: o peso passa de um pé ao
  outro. Animação sem transferência de peso clara parece que flutua.
- Contraposto e contrarrotação: ombros e quadril giram em sentidos OPOSTOS (o ombro direito vem à
  frente quando o pé direito vai atrás). Os braços balançam em oposição às pernas (braço esquerdo
  à frente com a perna direita). Isso já está no gray-box (`armL` em contrafase com a perna).
- Cadeia cinemática e lead/follow: o impulso nasce no chão, sobe pela perna, pelve, tronco, e sai
  no membro (um golpe começa nos pés). A pelve LIDERA, as extremidades SEGUEM.
- Cabeça e olhar: a cabeça tende a estabilizar (horizonte nivelado ao andar) e o olhar antecipa a
  direção do movimento (olha para onde vai virar antes de virar). Marca de intenção.

## 3. Andar (walk cycle)

Um ciclo = dois passos (um por pé). Quatro poses-chave por passo, na ordem:

1. Contato (contact): o pé da frente toca o chão com o calcanhar, perna esticada; o pé de trás
   ainda no chão na ponta. Braços no ponto mais aberto (oposição máxima). É a pose mais legível,
   a "keyframe" do ciclo.
2. Recuo/baixo (down/recoil): o peso desce sobre a perna da frente que dobra para absorver; é o
   ponto MAIS BAIXO do CdM. O corpo "encaixa" o peso.
3. Passagem (passing): a perna de trás passa sob o corpo, joelho dobrado; o peso está todo sobre a
   perna de apoio (esticada); CdM volta a subir; braços passam neutros ao lado do corpo.
4. Alto (up/high-point): o impulso da perna de apoio empurra o CdM para o ponto MAIS ALTO; o
   corpo é projetado à frente para o próximo contato.

Detalhes que vendem o andar:
- Oscilação vertical do CdM: sobe no passing/up, desce no contact/down. É um leve "2 por ciclo".
  No gray-box isso é o `body bob`.
- Rotação e queda da pelve: a pelve gira (contraposto) e cai levemente para o lado da perna em
  balanço (o "hip drop" que dá feminilidade/peso; em comandante másculo, mais contido).
- Balanço de braços em oposição, em arco, partindo do ombro; mão relaxada.
- Cabeça nivelada varrendo o horizonte (a ficha do Josué pede exatamente isso).
- Identidade do Josué: passada LONGA e FIRME, cadência constante, tronco estável, postura ereta;
  o manto vermelho dá a leitura de movimento. Evitar gingado (isso é o Calebe; ver as fichas).

Casamento com o código: a `WALK_SPEED = 4` define a velocidade de avanço; a CADÊNCIA do ciclo
(passos por segundo) tem que bater com ela para o pé não patinar (ver seção 11). Um ciclo de
andar humano costuma levar ~0,9-1,1 s; a ~24-32 frames a 60 FPS por passo é um ponto de partida.

## 4. Correr (run cycle)

A diferença essencial para o andar: existe uma FASE DE VOO (os dois pés saem do chão ao mesmo
tempo). Isso muda tudo:

- Inclinação à frente: o tronco se projeta para frente (o CdM vai na frente da base); quanto mais
  rápido, mais inclinado. Correr é uma queda à frente recuperada a cada passada.
- Poses-chave por passo: contato (um pé só, à frente, absorvendo) -> recuo/baixo (compressão
  máxima) -> empurrão/decolagem (a perna estica e lança o corpo) -> voo/suspensão (nenhum pé no
  chão, joelhos recolhidos). Sem a pose de passagem com pé plantado do andar.
- Braços: dobrados ~90 graus, movimento de PISTÃO mais forte e curto, contrabalançando as pernas;
  a mão chega perto do queixo na frente e do quadril atrás.
- Cabeça mais baixa, olhar à frente; menos varredura de horizonte que no andar.
- Passada mais longa, mais squash na aterrissagem de cada pé (absorve mais força).

Casamento com o código: `RUN_SPEED = 8` (o dobro do andar) com cadência e amplitude maiores. O
gray-box já faz `cadence = 3.2 + speed*0.9` e amplitude crescendo com a velocidade: a ideia certa.
Para clipes autorados, exporte "andar" e "correr" em FASE (mesmo pé no chão no mesmo ponto do
ciclo) para o blend por peso não patinar (tecnica-animacao-babylon seção 2.1).

## 5. Transições (onde o movimento ganha ou perde credibilidade)

- Parado -> andar: NÃO comece em velocidade plena. Há um quadro de antecipação (o CdM se inclina à
  frente, um pé "se solta") e uma passada de arranque mais curta. Em blend por peso, isso é o
  gradiente idle->andar; em clipes, um clipe curto de "start".
- Andar -> correr: aumenta inclinação, cadência e amplitude; o ponto de virada é quando surge a
  fase de voo.
- Parar (decel): o corpo se inclina PARA TRÁS para frear o CdM, dá um ou dois passos de
  assentamento e há um leve overshoot/settle (o tronco oscila e estabiliza). Parar instantâneo lê
  sem peso. Vale um clipe de "stop" para correr->parado.
- Virar (pivot): plantar um pé como eixo, a pelve e o olhar LIDERAM a virada, o tronco segue, o pé
  de fora cruza ou abre. Virada de 180 graus pede plant-and-turn (passo de pivô), não rotação no
  lugar. O gray-box hoje faz slerp do yaw para a direção do movimento (suave, suficiente para o
  M0); clipes de pivô entram quando precisar de leitura mais rica.

## 6. Pular (pulo vertical/no lugar)

Cinco fases. Mapeiam direto na máquina de estados `START_JUMP -> IN_AIR -> ON_GROUND`:

1. Antecipação / agachamento (load): joelhos e quadril dobram, braços vão para trás; o corpo
   "carrega" como uma mola. Quanto mais alto o pulo, mais profundo o load. (Pouco antes de
   `START_JUMP`.)
2. Impulso / decolagem (takeoff): pernas estendem explosivamente, braços jogam PARA CIMA (eles
   "puxam" o corpo), o corpo estica (stretch). A força vem do chão. (Transição START_JUMP ->
   IN_AIR; `JUMP_HEIGHT = 1.6` define o impulso vertical no código.)
3. Voo/subida (rise): pernas recolhem, o corpo sobe desacelerando (ease-out até o ápice). Arco.
4. Ápice e queda (apex/fall): no topo a velocidade vertical zera (mais frames perto do ápice =
   "flutua" e lê melhor); depois acelera para baixo (ease-in), pernas se estendem ANTECIPANDO o
   solo, braços abrem para equilíbrio.
5. Aterrissagem e recuperação (land/recover): os pés tocam e os joelhos CEDEM para absorver
   (squash, ponto mais baixo), depois o corpo se recompõe (recover) até a postura neutra. É a fase
   que mais vende peso. Acompanha poeira no impacto (biblia-vfx-e-shaders) e, no combate, pode ter
   um leve screen shake (spec-combate). (Volta a `ON_GROUND`.)

Erro comum a evitar: pular sem agachar antes e aterrissar rígido. Sem o load e o give dos joelhos,
o personagem parece de papel.

## 7. Saltar (salto com corrida, transpor obstáculo)

Distinguir do pulo vertical:
- Salto em distância (running jump): decola de UM pé (não dois), aproveitando a velocidade da
  corrida; a passada antes da decolagem é mais longa e baixa (gather), o corpo se projeta à frente
  e para cima, uma perna lidera no ar (reach), aterrissa e ATERRISSA EM MOVIMENTO (continua
  correndo ou rola). Útil para vencer um vão.
- Transpor obstáculo (vault/step-up): apoiar a mão ou o pé no obstáculo, transferir o peso por
  cima, recolher as pernas. Pede contato com o objeto (foot/hand IK ou clipe casado à altura).
- Recepção em rolamento: salto alto/longo termina num rolamento que dissipa a energia (mesma
  mecânica da esquiva, seção 8), em vez de um baque seco.

Escopo: o pulo vertical (seção 6) é o do protótipo (já implementado). Salto com corrida, vault e
escalada estão FORA do MVP de combate (spec-combate "Fora do MVP: escalada/parkour"); este doc
deixa a biomecânica registrada para quando entrarem.

## 8. Esquiva e rolamento (dodge roll)

Movimento de combate central (spec-combate). Mecânica corporal:
- Antecipação curta (o corpo carrega na direção oposta por 1-2 frames) e um EMPURRÃO explosivo do
  pé.
- Rolamento: encolhe (tuck) o queixo/ombro/quadril e gira sobre as costas/ombro, distribuindo o
  contato (não cair de chapa); reaparece de pé.
- Direção: sem lock-on, rola na direção do movimento; com lock-on, esquiva relativa ao alvo
  (strafe/back). Mantém o olhar/atenção no alvo.
- Janela de i-frames NO MIOLO, vulnerável no fim (spec-combate seção 6: i-frames ~10-12 frames,
  duração do rolamento ~30-36 frames). A ANIMAÇÃO precisa fazer o miolo (o giro) coincidir com os
  i-frames e a recuperação (o levantar) coincidir com a janela vulnerável: a leitura visual tem
  que casar com a regra. Aqui é forte candidato a root motion real (tecnica-animacao-babylon seção
  5.2), para a distância do rolamento ser consistente.

## 9. Mecânica corporal dos golpes (resumo; detalhe em spec-combate)

Todo ataque tem a anatomia de três fases da spec-combate (antecipação -> ativo -> recuperação),
que é a mesma estrutura de antecipação/ação/follow-through deste doc:
- Windup (antecipação): o corpo carrega para o lado oposto do golpe (recua a arma, gira o tronco,
  planta o pé de trás). É o TELL legível.
- Ativo (contact/swing): a energia sobe pela cadeia (pés -> quadril -> tronco -> braço -> arma) em
  arco; o peso transfere para o pé da frente; é o frame do hit stop.
- Recuperação (follow-through + recover): a arma continua o arco e o corpo se reassenta; é a
  janela de punição. Curta nega punição, longa premia o oponente.
Outros: bloqueio (base larga, peso atrás do escudo, braço firme, leve recuo ao absorver); levar
dano (flinch/recoil na direção do golpe, breve); morrer (perda de equilíbrio, o CdM vence a base,
queda em estágios, não desligar como um boneco). Números e janelas: spec-combate seção 6.

## 10. Movimento secundário e o que "vende" o peso

- Manto e túnica: seguem o corpo com ATRASO (lag) e continuam depois que ele para (overlap),
  esvoaçam para trás ao correr, assentam ao parar. O gray-box já inclina o manto ao correr; o M1
  trata isso por cloth híbrido (tecnica-deformacao-de-tecidos). É o que mais dá leitura de
  velocidade e direção a distância.
- Contato e fixação dos pés (foot plant): o pé de apoio NÃO desliza; fica cravado enquanto sustenta
  o peso. Patinação de pé é o defeito que mais denuncia animação ruim (foot IK e casamento de
  cadência resolvem, seção 11 e tecnica-animacao-babylon seção 6).
- Respiração e micro-movimento parado (idle): o peito sobe/desce, micro-ajustes de peso; nunca
  estátua. O gray-box já faz uma respiração sutil parado.
- Reação a terreno: subir rampa muda a inclinação do tronco e o ângulo dos pés; o controlador já
  trata rampa/degrau, a animação deveria acompanhar (foot IK no M1+).

## 11. Aplicação ao projeto (M0 procedural e M1 com clipes)

No M0 (procedural, `heroModel.ts`):
- Já faz o essencial certo: pernas em oposição, braços em contrafase, bob vertical 2x a cadência,
  cadência/amplitude crescendo com a velocidade, manto inclinando. Melhorias baratas de leitura:
  um leve down/recoil no contato (abaixar o CdM quando o pé planta), inclinar o tronco à frente ao
  correr, e um pequeno settle ao parar.
- Pulo: hoje o visual é simples; aplicar as 5 fases (seção 6) ainda que de forma procedural
  (agachar antes de `START_JUMP`, recolher pernas no `IN_AIR`, ceder joelhos ao voltar a
  `ON_GROUND`).

No M1 (clipes glTF, Mixamo/Blender):
- Banco mínimo: idle, andar, correr, start, stop, pivô (opcional), pulo (subida/ar/pouso), esquiva.
  Combate vem depois (M2).
- Clipes in-place (root parado), o `PhysicsCharacterController` dirige o movimento (já é assim);
  casar a CADÊNCIA do clipe com a velocidade real para não patinar:
  `speedRatio = velocidade / velocidade_em_que_o_clipe_foi_autorado` (tecnica-animacao-babylon
  seção 5.1).
- Andar e correr EM FASE para o blend por peso ser limpo (mesmo pé no chão no mesmo ponto).
- Esquiva e salto com root motion real (deslocamento vem da animação), para distância consistente.
- Referência de frames a 60 FPS (ponto de partida): passo de andar ~24-32 frames; passo de correr
  ~16-22 frames; antecipação de pulo ~8-12 frames; aterrissagem/recuperação ~10-16 frames; esquiva
  ~30-36 frames com i-frames no miolo (spec-combate).

## 12. Checklist de "movimento que lê bem"

- [ ] Transferência de peso clara em cada passo/golpe (pé de apoio cravado, sem patinar).
- [ ] Antecipação antes de toda ação grande (agachar no pulo, recuar no golpe).
- [ ] Continuidade/overlap: quadril lidera, extremidades e manto seguem; nada para junto.
- [ ] Ease-in/ease-out (sem velocidade constante robótica); arcos nos membros.
- [ ] Andar com oscilação vertical e contraposto; correr com fase de voo e inclinação à frente.
- [ ] Pulo com load, stretch na decolagem, flutuação no ápice, squash e give na aterrissagem.
- [ ] Parar com decel/settle; virar com pivô liderado por pelve/olhar.
- [ ] Esquiva com i-frames no miolo coincidindo com o giro; recuperação vulnerável legível.
- [ ] Identidade do Josué preservada (ereto, passada longa e firme, tronco estável, manto lendo o
      movimento).
- [ ] Sem patinação de pé; cadência casada com WALK/RUN_SPEED.

## Fontes

Princípios e craft de animação
- https://en.wikipedia.org/wiki/Twelve_basic_principles_of_animation
- "The Animator's Survival Kit", Richard Williams (referência canônica de walk/run/weight)
- https://www.youtube.com/watch?v=tFI3MA0Wc5E (12 principles, AlanBeckerTutorials)

Ciclos de andar e correr
- https://www.gamedeveloper.com/art/animation-tips-walk-and-run-cycles
- https://www.bloopanimation.com/walk-cycle/
- https://help.autodesk.com/view/MAYAUL/2024/ENU/?guid=GUID-walk-cycle (poses-chave)

Pulo, salto e aterrissagem
- https://www.gamasutra.com/blogs/ (game feel de pulo: antecipação, ápice, aterrissagem)
- https://www.youtube.com/watch?v=hG9SzQxaCm8 (anatomy of a video game jump, GDC/feel)

Biomecânica
- https://en.wikipedia.org/wiki/Gait_(human)
- https://en.wikipedia.org/wiki/Center_of_mass (CdM e base de apoio aplicados a postura)

Conexão com a engine e o projeto
- [`tecnica-animacao-babylon.md`](tecnica-animacao-babylon.md) (como tocar/blendar/root motion)
- https://www.mixamo.com/ (banco de clipes de locomoção/combate para o M1)
