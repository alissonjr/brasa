# Spec de Combate - Chefe: O Guardião (a guardiã exausta da Brasa)

Especificação de combate do chefe único e final do vertical slice de **Brasa**: o
**Guardião**, que aguarda a Acendedora na **câmara da Brasa**, no fundo do poço-cripta.
Vencê-lo e reavivar a Brasa FECHA o slice (canon [`projeto-brasa.md`](../projeto-brasa.md)
3.1). Esta spec espelha a estrutura e a profundidade da spec análoga da era Josué
([`../spec-chefe-rei-jerico.md`](../spec-chefe-rei-jerico.md)), com conteúdo 100% Brasa.

Fonte de verdade dos sistemas e do orçamento: o canon [`projeto-brasa.md`](../projeto-brasa.md)
prevalece em qualquer conflito (premissa, pilares, estrutura sala-a-sala, tetos técnicos da
seção 4). A lore do encontro vem de [`narrativa-e-historia.md`](narrativa-e-historia.md)
(seções 2.3, 3, 5.4) e a leitura visual de [`direcao-de-arte.md`](direcao-de-arte.md)
(assinatura frio-azul x laranja-quente, silhueta do Guardião na seção 3). A régua de detalhe
e as marcações seguem [`../padrao-de-detalhe.md`](../padrao-de-detalhe.md). Os números de
combate herdados (vida do herói, dano, stamina, janelas) procedem de
`prototipo/src/game/combat/tuning.ts` e são citados como `[CÓDIGO]`; em conflito de número,
vale o `tuning.ts`.

Convenção (herdada do canon): pt-BR, sem travessões, sem emojis. Marcação de PROCEDÊNCIA para
IP original: `[DESIGN]` (criação nossa), `[CÓDIGO]` (observado no protótipo), `[ASSET]`
(procede de pacote KayKit). Marcação de EXIGÊNCIA: `[NORMATIVO]` (entra no aceite,
verificável), `[ASPIRACIONAL]` (mood/intenção, não bloqueia), `[A DEFINIR]` (pendente de
decisão autoral).

Snapshot: 2026-06-14.

---

## 0. Propósito do encontro (o que este chefe precisa fazer SENTIR)

`[DESIGN]` O Guardião é o clímax e a tese do jogo encenada em combate. Antes de ser um teste
de habilidade, é o momento em que o jogador compreende, na pele, o que custa a Brasa. Três
sensações obrigatórias:

1. `[DESIGN]` `[ASPIRACIONAL]` **O inimigo é digno, não um monstro.** A proposta forte da
   narrativa (`narrativa-e-historia.md` 2.3, 5.4) é que o Guardião foi uma Acendedora anterior
   (a Primeira, ou a última que desceu e não voltou, possivelmente a pessoa que a heroína
   amava), que deu a fagulha à Brasa e ficou presa ali, virando guardiã exausta e prisioneira
   da chama. Ela não ataca por maldade: ataca porque está consumida pelo dever e/ou porque
   testa se a recém chegada é digna de rendê-la. O jogador deve sair com PESO, não com triunfo.
2. `[DESIGN]` **A luz é a arma, não a espada.** O combate inteiro é uma gangorra de luz (canon
   1; `direcao-de-arte.md` 2). Quanto mais a Brasa apaga, mais forte e mais escuro fica o
   Guardião; a Acendedora o enfraquece DEVOLVENDO luz à Brasa moribunda no centro da arena. O
   golpe de espada abre as janelas; reacender a Brasa é o que vence. Espelha o tema do jogo
   ("a luz custa caro e tem que ser mantida"), assim como o duelo de Jericó espelhava "não se
   vence por força bruta".
3. `[DESIGN]` **A descida tem um fim digno.** Sem QTE de execução, sem gore, sem zombaria
   (princípio de sobriedade do tom, `narrativa-e-historia.md` 3.3, 6.2). Vencer = render a
   guardiã e reacender a Brasa, não esmagar um monstro.

`[DESIGN]` Antipadrões a evitar: barra de vida gigante e esponjosa; o Guardião como esqueleto
ágil e genérico; música de vitória heroica ao matá-lo; o jogador "ganhando no braço" e
ignorando a Brasa (contradiz a tese). A dificuldade vem do significado e da leitura de luz,
não da punição bruta.

---

## 1. Premissas do kit da Acendedora assumidas aqui

`[CÓDIGO]` `[NORMATIVO]` O kit base é o do protótipo reaproveitado (canon 6.1; `tuning.ts`
`HERO`), NÃO redefinido aqui. Resumo do que o encontro usa:

- Ataque leve: combo de até 3 golpes (`HERO.light`: startup 0,12 s, dano 10; finisher dano 12
  com empurrão). Cadência alta, baixo dano por golpe; punidor das janelas curtas.
- Ataque pesado: `HERO.heavy` (startup 0,32 s, dano 26, custa 35 de stamina); punidor
  principal das aberturas longas e do guard break.
- Esquiva (rolar): `HERO.dodge` (duração 0,55 s, i-frames de ~0,1 a 0,3 s no miolo, custa 25
  de stamina); ferramenta-chave contra os golpes que o bloqueio não cobre.
- Recursos (HUD): VIDA do herói = 100 (`HERO.maxHealth`, morre em ~5-6 golpes) e STAMINA = 100
  (regen 40/s após 1 s parado). Multiplicador de dano por dificuldade em
  `DIFFICULTY_DAMAGE_TAKEN` (peregrino 0,6 / soldado 1,0 / comandante 1,25).

`[DESIGN]` A **fagulha** que a Acendedora carrega (a única luz quente em cena no estado frio,
`direcao-de-arte.md` 4.1) ganha aqui um papel mecânico de chefe, descrito na seção 4: ela é o
que reacende a Brasa moribunda e enfraquece o Guardião. Não é um verbo de combate novo (não
some com o moveset existente); é uma INTERAÇÃO contextual no centro da arena, análoga ao
"acender o braseiro" do laço comum (canon 3.1, passo 4), reaproveitando o mesmo verbo de
interação.

`[A DEFINIR]` Se o slice adota parry/postura globalmente (a spec de Jericó propôs e marcou
como decidido lá). Brasa hoje NÃO tem parry no `tuning.ts`. Esta spec é escrita SEM depender de
parry: o loop é ler tell -> esquivar/bloquear -> punir -> reacender a Brasa. Se parry entrar no
kit global depois, encaixa como ferramenta extra contra os golpes pesados (ver nota em 5.3),
sem reescrever as fases.

---

## 2. Estatísticas-alvo do chefe (design, para balancear depois)

`[DESIGN]` Os números compartilhados (dano do herói, stamina, janelas do herói) vivem em
`tuning.ts` e valem de lá. Abaixo só os parâmetros próprios do Guardião; em conflito de número
genérico, vale o `tuning.ts`. Tempos em SEGUNDOS como ALVO de design (base 30 fps de IA por
tick, conforme `engine/ai/fsm.ts` `Ticker`); ajustar no playtest.

| Atributo | Alvo | Razão de design |
|---|---|---|
| Vida total do chefe | ~340 (proposta, > 300 de Jericó) | Luta de ~75-110 s; um pouco mais longa porque tem a camada da Brasa, não só dano. `[A DEFINIR]` ratificar contra o feel. |
| Vida por fase (3 fases) | dividida em limiares 100-66 / 66-33 / 33-0% | Leitura de fase por vida, espelhando a escalada de Jericó (seção 5.4). |
| Dano por golpe pesado | ~26-30 | Alto: ignorar o tell dói (ensina leitura), mas o tell é longo. Ancorado no `HERO.heavy` (26) como referência de "golpe que dói". |
| Dano de contato / investida | ~14-18 | Pune ficar parado na linha. Ancorado no `DEFENDER.overhead` (16). |
| Telegrafia de golpe pesado | 0,8-1,1 s (fase 1) -> ~0,7 s (fase 3) | Tells longos e legíveis; encurtam ~15% por fase, como em Jericó 5.4. Mais longos que o defensor comum (`DEFENDER.overhead` startup 0,6 s) porque é leitura de chefe. |
| Recuperação pós-ataque (punição) | 0,6-0,9 s | A "sua vez" depois de cada golpe; mais longa nos pesados. |
| Velocidade de andar | lenta, pesada, solene | Guardião não corre; arrasta o peso do dever (silhueta larga, `direcao-de-arte.md` 3). |
| Janela de reacender a Brasa | ~1,2-1,6 s de canalização | Tempo de interação no centro; vulnerável durante. Ver 4.2. |
| Estágios de apagão da Brasa | 3 níveis (forte / bruxuleando / quase morta) | A "barra de luz" da arena; leitura de fase por LUZ (seção 3, 4). |

`[DESIGN]` Recomendação: começar pelo TELL, pela ABERTURA e pela LEITURA DE LUZ (o que o
jogador sente), e só depois fixar os números. O feel decide; a planilha serve ao feel. Vida
medida em SEGUNDOS de luta limpa, nunca em HP esponjoso.

---

## 3. A arena: a câmara da Brasa

`[DESIGN]` `[NORMATIVO]` A arena é a **Câmara da Brasa** (canon 3.2; `narrativa-e-historia.md`
1.3 camada 4, 5.4): a câmara mais funda e mais gélida do poço-cripta. Espaço fechado, redondo
ou poligonal, montado com o kit modular KayKit Dungeon (`[ASSET]`), sem terreno aberto nem
skydome (canon 4.4). Elementos `[NORMATIVO]`:

- **A Brasa moribunda ao centro:** a chama primordial num braseiro-âncora maior que qualquer
  braseiro comum, no eixo da sala. Não está apagada nem acesa: está MORRENDO, bruxuleando
  fraco. É ao mesmo tempo o objetivo (reavivá-la), o medidor de fase (quanto de luz resta) e o
  ponto focal de silhueta. Núcleo emissivo `#FF7A1A` quando ainda há luz, esfriando para
  `#C8401C` (vermelho-tiço) e depois quase preto conforme apaga (`direcao-de-arte.md` 2.1).
- **A porta de pedra selada** atrás da Acendedora: sela ao entrar (canon 3.1), confina o
  duelo. Sem fuga; o fim do poço.
- **Restos da ordem** ao redor (`narrativa-e-historia.md` 7.3): túmulos das fundadoras,
  braseiros frios incrustados, a forja da primeira fagulha. Compõem a silhueta da sala e
  contam, sem texto, que outras desceram. Decorativos, com colisor de caixa onde sólidos.
- **A penumbra que respira ao ritmo da Brasa:** a luz-chave da sala é a própria Brasa. Quanto
  mais ela apaga, mais escura e azul a arena (`#0E1A2B` a `#3E5C7E`), e melhor o Guardião se
  esconde no breu (ver 4). Reacender a Brasa devolve laranja-quente (`#FFA63D`) e expõe o
  Guardião.

`[DESIGN]` `[NORMATIVO]` Orçamento de iluminação da arena (canon 4.4; `direcao-de-arte.md`
4.3): no máximo 1-2 luzes dinâmicas. Padrão: 1 luz-chave = a Brasa (intensidade VARIÁVEL com o
estágio de apagão; pode projetar sombra) + 1 luz pontual quente (a fagulha que viaja com a
Acendedora, sombra desligada). Os "olhos/runas" do Guardião e da Brasa são EMISSIVO, não luz
(`direcao-de-arte.md` 5), para não estourar o teto.

`[A DEFINIR]` Tamanho exato da arena (proposta: raio jogável de ~8-10 m, espaço para esquivar
ao redor da Brasa sem ela virar parede invisível). Ratificar no gray-box.

---

## 4. A mecânica de fase por LUZ (o coração do encontro)

`[DESIGN]` `[NORMATIVO]` A leitura de fase de Brasa é por LUZ, não só por barra de vida. O
encontro é uma gangorra entre dois medidores que o jogador lê no ambiente:

- **VIDA do Guardião** (barra de chefe no HUD, como qualquer combate): cai com os golpes do
  jogador.
- **LUZ da Brasa** (estado do braseiro-âncora central, lido no MUNDO, não só no HUD): tem 3
  estágios (forte / bruxuleando / quase morta). Começa BAIXA (a Brasa está morrendo quando a
  heroína chega) e a Acendedora a ergue reacendendo-a; o Guardião a faz apagar de novo com
  certos ataques.

### 4.1 A regra da gangorra `[NORMATIVO]`

`[DESIGN]` A relação central, que dá a leitura de fase verificável e casa com a lore ("o
escuro abriga os mortos; a luz os contém", `narrativa-e-historia.md` 1.4):

- **Quanto mais a Brasa APAGA, mais forte e mais escuro fica o Guardião.** No escuro ele se
  move mais rápido, encadeia mais, e seus tells ficam mais difíceis de ler (menos luz para
  esculpir a silhueta). É o estado perigoso.
- **Quanto mais a Brasa ARDE, mais o Guardião RECUA e ENFRAQUECE.** A luz quente o "incomoda"
  (ele é o que sobra de uma portadora exausta, ligada ao escuro); na luz forte ele expõe a
  silhueta, fica mais lento e abre janelas longas de punição. É o estado seguro para atacar.

`[DESIGN]` Logo o jogador alterna dois verbos: REACENDER a Brasa (para enfraquecer o Guardião
e iluminar a arena) e BATER no Guardião (para baixar a vida na janela que a luz abriu). Quem só
bate no escuro toma punição; quem só foge da Brasa nunca abre janela. O fluxo virtuoso:
reacender -> a luz expõe o Guardião e o desacelera -> punir na janela -> a Brasa esfria de novo
ao longo do tempo (e o Guardião a faz apagar com ataques) -> reacender de novo.

`[DESIGN]` `[ASPIRACIONAL]` Leitura visual inequívoca (`direcao-de-arte.md` 2, 3): no estado
escuro o Guardião é uma silhueta larga com olhos/runas ciano-espectrais (`#5FB7C9`), quase
fundido ao breu azul. No estado iluminado, o laranja-quente o lambe, o gume metálico aquece
(`#C98A3A`) e o jogador VÊ o tell chegar. A luz é, literalmente, a leitura de fase.

### 4.2 Reacender a Brasa (o verbo de luz) `[NORMATIVO]`

`[DESIGN]` Reaproveita o verbo de interação do braseiro do laço comum (canon 3.1):

- A Acendedora canaliza a fagulha na Brasa central por ~1,2-1,6 s (interação contínua). Ao
  completar, a LUZ da Brasa sobe um estágio (quase morta -> bruxuleando -> forte) e a arena
  esquenta (transição animada ~1-2 s, `direcao-de-arte.md` 4.2).
- **Custo/risco:** durante a canalização a Acendedora fica PARADA e VULNERÁVEL (não pode
  esquivar nem atacar). É a janela de tensão: reacender no momento errado convida um golpe. O
  Guardião tende a punir a canalização (ver ataque "sopro de escuro", 5.3 #4), então o jogador
  precisa CRIAR a abertura antes (afastar o Guardião, esperar a recuperação dele) para
  reacender em segurança.
- **Decaimento:** a Brasa esfria sozinha com o tempo (lento) e CAI um estágio quando certos
  ataques do Guardião conectam (o "sopro de escuro", #4). Manter a Brasa acesa é trabalho
  contínuo, não um interruptor de uma vez. Isso encena a tese ("a luz tem que ser mantida").

`[DESIGN]` `[A DEFINIR]` Se reacender a Brasa também CURA um pouco a Acendedora ou recupera
stamina (recompensa de tom "a luz alenta"), ou se é só leitura/enfraquecimento do chefe.
Recomendação: um pequeno regen de stamina ao subir de estágio, para premiar a agressão de luz
sem trivializar a vida. Ratificar no balanceamento.

---

## 5. Estrutura em fases

`[DESIGN]` `[NORMATIVO]` O encontro escala em TRÊS fases, lidas por luz/silhueta/cor de forma
verificável (canon 4.2; `padrao-de-detalhe.md` 2.1). As fases combinam a VIDA do Guardião com o
estágio padrão da LUZ, de modo que o jogador sempre saiba "em que fase estou" olhando a arena.

```
ARENA  A Camara da Brasa (poço-cripta, fundo)  - porta de pedra selada, Brasa moribunda ao centro
   |
FASE 1  "A guardia que aguarda"     (vida 100-66%)  - lenta, tells longos; ensina a gangorra de luz
   |    o Guardiao testa a recem chegada; a Brasa pode subir ate "forte"
   v
FASE 2  "O dever que consome"        (vida 66-33%)  - mais agressiva; ela faz a Brasa apagar; o breu cresce
   |    entra o sopro de escuro e o combo; a arena oscila mais entre frio e quente
   v
FASE 3  "O escuro que reclama"       (vida 33-0%)   - desespero; ela luta para manter a Brasa apagada
   |    tells ~15% mais curtos, encadeia mais, hazard de breu; a luz e a unica leitura
   v
DESFECHO  render a guardia + reavivar a Brasa (scriptado, digno, fim do slice)
```

### 5.1 Princípios do moveset `[NORMATIVO]`

`[DESIGN]`
- Tells longos e legíveis (pose corporal + cue de áudio + brilho dos olhos/gume). É o tutorial
  final de leitura de telegrafia do slice, agora sob luz variável.
- Poucos golpes, bem distintos por silhueta e som. Qualidade de leitura sobre quantidade
  (mesmo princípio do `defender.ts`: "DIREÇÃO TRAVADA -> dá para esquivar/flanquear").
- Pelo menos um golpe que o BLOQUEIO não cobre (força esquiva), ensinando que defender nem
  sempre basta, como o gancho de Jericó.
- Grandes janelas de recuperação = aberturas claras. O jogador deve sentir "agora é minha vez"
  (atacar OU reacender a Brasa).
- A LUZ modula tudo: no escuro os tells encurtam e a leitura piora; na luz forte alongam e a
  leitura melhora. Mesmo golpe, dificuldade modulada pelo estado da arena.

### 5.2 Estados de comportamento (IA) `[CÓDIGO]` `[DESIGN]`

`[DESIGN]` Reaproveita a `StateMachine`/`Ticker` de `engine/ai/fsm.ts` e o padrão de modos do
`defender.ts` (`approach | attacking | cooldown | dead`), estendido para o chefe. Modos:

1. **Rondar/Guardar (default):** posição entre a Acendedora e a Brasa (ele PROTEGE a chama
   apagada; corpo dele tende a ficar entre o jogador e o braseiro central). Recua medido na
   luz, avança no escuro. Aqui o jogador pressiona ou cria espaço para reacender.
2. **Golpe telegrafado:** sai do default para um dos ataques da tabela 5.3 (análogo a
   `attacking` em `defender.ts`, com `attackDir` travada e a pose de braço por `AttackState`).
3. **Punível (recuperação):** após o golpe; abertura para combo leve, pesado, OU reacender a
   Brasa (análogo a `cooldown`).
4. **Cambaleio de luz (exposto):** quando a Brasa sobe a "forte", o Guardião cambaleia/recua
   ~0,6-0,9 s, ofuscado; abertura crítica (dano aumentado). Substitui o "guard break" de
   Jericó por uma abertura disparada pela LUZ, não por postura. Ver 5.5.
5. **Render (scriptado):** ao zerar a vida; transição para o desfecho (seção 8). Sem
   `respawn` (diferente do `defender.ts`, que renasce: o chefe NÃO renasce).

### 5.3 Moveset (tabela de combate) `[DESIGN]`

`[DESIGN]` Tempos em segundos como ALVO de design (base 30 fps de tick). Os valores de
"escuro" valem quando a Brasa está bruxuleando/quase morta; os de "luz" quando está forte. Os
golpes #1 e #2 ecoam o overhead/sweep do kit base; #3 é a lição de esquiva; #4 (sopro de
escuro) é a interação com a Brasa; #5 (combo) entra nas fases 2-3. "Resposta" = o que o jogador
deve fazer.

| # | Golpe | Tell (luz / escuro) | Janela ativa | Recuperação | Dano | Cobre bloqueio? | Resposta ideal |
|---|---|---|---|---|---|---|---|
| 1 | Marreta descendente (overhead pesado) | braço/arma erguidos ALTO: ~1,0 s / ~0,8 s | ~0,2 s | ~0,9 s (longa) | ~26-30 | NÃO (força esquiva) | Esquiva lateral; punir na recuperação longa (pesado ou combo leve) |
| 2 | Varredura larga (sweep horizontal) | torso gira p/ trás: ~0,6 s / ~0,5 s | ~0,25 s (arco amplo) | ~0,6 s | ~15-18 | parcial (drena muito) | Esquivar para trás/atravessar; bloqueio custa caro |
| 3 | Gancho de corrente/arma de alcance (puxão) | gira o pulso, arma baixa: ~0,5 s / ~0,4 s | contato curto | ~0,7 s | ~12 + puxa/quebra guarda | NÃO (o puxão abre a guarda) | ESQUIVAR de lado; é a lição "bloquear nem sempre basta" |
| 4 | Sopro de escuro (apaga a Brasa) | inspira/se curva para a Brasa, mãos para o centro: ~0,9 s / ~0,7 s | onda lenta a partir do centro | ~1,0 s (longa) | ~10 (área) + APAGA 1 estágio da Brasa | NÃO (área; sair do raio) | Sair do raio telegrafado; PUNIR a recuperação longa; impede a canalização se o jogador estava reacendendo |
| 5 | Combo de 2-3 cortes (fases 2-3) | encadeia sem voltar à guarda | 2-3 hits | ~0,7 s no fim | ~14+14(+14) | parcial no 1o | Esquiva no 1o; não rolar/atacar cedo; punir no fim |

`[DESIGN]` Notas:
- O **sopro de escuro (#4)** é o golpe-assinatura do chefe e o que amarra a gangorra de luz:
  é como ele "rebaixa" a Brasa e pune quem tenta reacender na hora errada. Telegrafia generosa
  (ele se curva para a chama, o breu adensa nas bordas, cue de áudio grave). Tem recuperação
  LONGA: é também a maior janela de punição E a melhor hora para reacender logo depois.
- A **marreta (#1)** força esquiva (bloqueio não cobre), a "lição de esquiva" do chefe junto
  com o gancho (#3).
- Nenhum golpe é seguro de spammar: cada um tem recuperação que dá vez ao jogador (mesmo
  contrato do `defender.ts`).
- `[A DEFINIR]` Se parry/postura entrarem no kit global, a marreta (#1) e o combo (#5) ganham
  janela de parry alta como ferramenta extra; isso NÃO substitui a gangorra de luz, só
  enriquece a punição. Decidir junto com o kit global; sem ela, balancear por vida + luz.

### 5.4 Escalada por fase (textura da luta) `[NORMATIVO]`

`[DESIGN]`

| Fase | Vida | Estado da luz (padrão) | Falas/tom | Mudança mecânica |
|---|---|---|---|---|
| 1 "A guardiã que aguarda" | 100-66% | jogador consegue manter "forte" com facilidade | poucas palavras; testa a recém chegada | só golpes #1, #2; muito tempo em Rondar; tells no máximo de longos; a gangarra é ENSINADA aqui |
| 2 "O dever que consome" | 66-33% | oscila mais; ela usa #4 para derrubar a Brasa | silêncio; reconhece a heroína (eco de quem ela foi) | entra #3 (gancho), #4 (sopro de escuro) e #5 (combo); reduz tempo em Rondar; o breu cresce |
| 3 "O escuro que reclama" | 33-0% | luta para manter "quase morta"; o jogador precisa reacender sob pressão | sem palavras; respiração pesada/canto gélido | tells ~15% mais curtos; encadeia mais; hazard de breu (5.6); a LUZ é a única leitura |

`[DESIGN]` Recomendação: a escalada é de RITMO, de leitura e de PRESSÃO sobre a luz, não de
esponja de vida. Não aumentar a vida do Guardião entre fases; aumentar a frequência do sopro de
escuro, a velocidade no breu e a dificuldade de manter a Brasa acesa. A fase 3 inverte a
sensação: na fase 1 o jogador reacende quando quer; na fase 3 ele LUTA para reacender, e a
arena passa a maior parte do tempo no escuro perigoso.

### 5.5 Cambaleio de luz (loop de recompensa) `[NORMATIVO]`

`[DESIGN]` O análogo ao guard break de Jericó, disparado pela LUZ em vez de postura (sem
exigir o verbo de parry):

- Reacender a Brasa até o estágio "forte" OFUSCA o Guardião: ele cambaleia/recua ~0,6-0,9 s
  (modo "exposto", 5.2 #4). Abertura crítica: dano aumentado (proposta x1,5-2,0; ratificar),
  bom momento para o ataque pesado (`HERO.heavy`).
- Decai sozinho conforme a Brasa esfria; e o Guardião tenta sair do cambaleio com o sopro de
  escuro (#4) para reapagar a chama o quanto antes.
- O loop central do duelo: ler tell -> esquivar/punir para criar espaço -> reacender a Brasa
  -> cambaleio de luz -> punir forte -> a Brasa esfria -> repete. É o coração do encontro e o
  protótipo do "combate de chefe" do jogo.

### 5.6 Hazards do cenário (só fase 3) `[NORMATIVO]`

`[DESIGN]`
- **Maré de breu:** com a Brasa quase morta, o escuro avança em ondas pelas bordas da arena
  (leitura por silhueta/áudio dos tells passa a importar mais; `direcao-de-arte.md` 4.4).
  Sutil, não cegante: a fagulha da Acendedora sempre ilumina o entorno imediato.
- **Frio que morde:** zonas de chão telegrafadas (cristais de gelo/azul saturado + rangido)
  que o Guardião deixa ao se mover no breu; pega quem fica parado. Reforça "o escuro reclama o
  que é dele".
- `[NORMATIVO]` Não empilhar hazard + combo pesado ao mesmo tempo: alternar, para manter
  legível (mesma regra de Jericó 5.6). Partículas limitadas, hazard telegrafado com
  mesh/sombra simples, dentro do teto de draw calls (canon 4.1).

---

## 6. Câmera, lock-on e leitura `[NORMATIVO]`

`[DESIGN]`
- Lock-on leve recomendado para o duelo (reusa `engine/camera/thirdPersonCamera`); mantém o
  Guardião enquadrado para ler os tells e não perder a Brasa central de vista.
- Câmera com colisão (não atravessar a Brasa-âncora nem os restos/colisores). Cuidar do
  enquadramento ao reacender (a Acendedora parada de costas para o Guardião é uma janela de
  tensão deliberada, mas a câmera deve deixar o jogador ver a ameaça chegar).
- `[NORMATIVO]` Sinais de leitura REDUNDANTES, nunca só por cor (acessibilidade + low-poly):
  cada tell tem (a) pose corporal distinta, (b) cue de áudio (inspiração, raspar de metal,
  grave do sopro de escuro), e (c) brilho dos olhos/gume no início da janela. A LUZ da arena é
  leitura primária mas SEMPRE acompanhada de pose e som, porque ela mesma varia.

---

## 7. Áudio do encontro `[NORMATIVO]` (cues) / `[ASPIRACIONAL]` (trilha)

`[DESIGN]`
- `[ASPIRACIONAL]` Música recolhida, quase elegíaca; nada de "vitória heroica" ao render o
  Guardião (a trilha deve doer, coerente com o tom e com Jericó 7). Um motivo de canto gélido
  cresce no escuro e recua na luz quente (o áudio segue a gangorra).
- `[NORMATIVO]` Cues funcionais: cada golpe da tabela 5.3 tem assinatura sonora própria,
  audível mesmo no breu (telegrafia secundária). O sopro de escuro tem o grave mais
  reconhecível. Reacender a Brasa tem um SFX de "fogo pegando" crescente; subir ao estágio
  forte tem um acento quente; a Brasa apagando, um sopro frio.
- `[NORMATIVO]` Reusa `game/combat/combatSound.ts` e `impactFx.ts` para impactos; o áudio de
  luz é novo, mas barato (poucos SFX).

---

## 8. Desfecho do encontro (scriptado, com dignidade) `[NORMATIVO]`

`[DESIGN]` Reaproveita o gatilho de "vida zerada" do combate, mas SEM o `respawn` do
`defender.ts` (o chefe não renasce) e SEM QTE de execução, sem gore, sem zombaria
(`narrativa-e-historia.md` 3.3, 6.2):

- Ao zerar a vida do Guardião, ele NÃO suplica nem é esmagado. Ajoelha-se diante da Brasa; a
  silhueta larga afrouxa; os olhos ciano-espectrais esmaecem. É a guardiã exausta sendo
  finalmente RENDIDA, não derrotada.
- **Reavivar a Brasa = condição de vitória e fim do slice** (canon 3.1, 3.3). A Acendedora dá
  o último passo de luz: canaliza a fagulha na Brasa central uma vez mais e a chama primordial
  PEGA de vez, enchendo a câmara de laranja-quente (`#FF7A1A`/`#FFA63D`), o azul recuando para
  a memória nas frestas. A vitória é a LUZ voltando, não o golpe final.
- `[DESIGN]` `[A DEFINIR]` O desfecho exato encena o final escolhido (`narrativa-e-historia.md`
  5.5). Proposta para o slice: **o Sacrifício** (a Acendedora se entrega à Brasa e vira a
  próxima guardiã, fechando o ciclo) OU um corte sóbrio assim que a Brasa reaviva, deixando o
  final implícito. Ratificar com a narrativa. A revelação da identidade do Guardião (quem ele
  foi) é ENCENADA aqui, não opcional (`narrativa-e-historia.md` 7.4, 5.4).

`[DESIGN]` Critério de aceite do desfecho: o jogador sai com PESO (luto/tese), não com triunfo
gratuito. Se a cena soar como "matei o boss", a encenação falhou.

---

## 9. Recompensa / progressão

`[DESIGN]` Diferente das salas comuns, a recompensa do Guardião é NARRATIVA e de FECHAMENTO,
não um upgrade para a próxima sala (não há próxima sala no slice):
- A Brasa reavivada e o reino salvo (ou o ciclo continuado) são o "prêmio" temático.
- `[A DEFINIR]` Se o slice registra um desbloqueio meta (final visto, contagem de salas, tempo)
  via `platform/*` (save/progresso, canon 6.1). Reaproveitar o sistema genérico de
  save/achievements (`saveData.ts`, `achievements.ts`) re-textado, sem mecânica nova.

---

## 10. Orçamento técnico do chefe `[NORMATIVO]`

`[DESIGN]` `[ASSET]` Herda os tetos do canon 4.2 e da direção de arte (3.):

- **Malha:** 3k-6k tris (canon 4.2). Base **KayKit Skeletons** (uma variante "Guardião": o
  esqueleto maior/mais pesado do pacote, ou um esqueleto comum com porte aumentado + acessório
  de silhueta: arma grande, elmo, braseiro apagado embutido no corpo). `[A DEFINIR]` qual
  variante exata após baixar o pacote (canon 5).
- **Esqueleto e animação:** MESMO esqueleto e MESMA biblioteca
  (`AnimationLibrary_Godot_Standard.gltf`, KayKit) de todos os humanoides (canon 4.3). O
  Guardião não carrega rig nem set de animação próprio; reusa o compartilhado, com poses/clipes
  do moveset (5.3) montados sobre ele. Isso o mantém dentro do orçamento de skinning.
- **Silhueta de fase por LUZ e porte** (canon 4.2; `direcao-de-arte.md` 3): a leitura de fase
  NÃO custa polígono extra; vem da luz da arena (estágio da Brasa) e de emissivo (olhos/runas
  ciano `#5FB7C9` no escuro; gume aquecido `#C98A3A` na luz). Maior e mais largo que qualquer
  esqueleto comum, lido como "isto é o chefe" em preto (teste de silhueta, `direcao-de-arte.md`
  3.1).
- **Iluminação/física:** 1-2 luzes dinâmicas na arena (canon 4.4); corpos de física só nas
  paredes/colisores da arena e nos atores; a arena é a ÚNICA sala carregada (canon 4.1),
  descartada se houvesse continuidade (aqui é o fim).
- `[NORMATIVO]` O `.glb` do Guardião passa por `optimize_asset.py` + `validate_gltf.py` (canon
  4.5; skill blender-python): escala aplicada, Y-up, dentro do teto de tris, atlas preservado.
- `[NORMATIVO]` O encontro roda a 60 fps desktop / 30 fps mobile com a Brasa, o cambaleio de
  luz e os hazards da fase 3 ligados; < 60 draw calls na arena (canon 4.1).

---

## 11. Como reaproveita a FSM e o combate existentes `[CÓDIGO]` `[NORMATIVO]`

`[DESIGN]` O Guardião NÃO inventa motor; estende o que já existe (canon 6.1, 6.2; auditoria de
`prototipo/src`):

- **FSM:** `engine/ai/fsm.ts` (`StateMachine` + `Ticker`) para os modos da seção 5.2. IA decide
  em TICKS (como `defender.ts` usa `new Ticker(0.12)`); movimento/animação por frame. O Guardião
  é uma `StateMachine<Mode>` com mais modos que o defensor (`rondar | attacking | cooldown |
  exposto | render`), sem renascer.
- **Combate:** implementa `CombatTarget` (como `Defender`), com `Health` próprio (~340),
  `Hurtbox`, `takeHit` (guarda frontal amortece leve; pesado/flanco/gancho passam, como o
  `guardBreak` já existente em `defender.ts:76`), `update(combatDt, heroPos)` retornando o
  frame de acerto. Reusa `AttackState`/`AttackTiming` para startup/active/recovery dos golpes
  (5.3), `HealthBar3D` para a barra de chefe, `combatSound`/`impactFx` para feedback.
- **Tuning:** novos números do chefe vão num bloco `GUARDIAN` em `game/combat/tuning.ts` (ao
  lado de `HERO` e `DEFENDER`), mantendo a fonte única de números. Os tempos/danos da tabela
  5.3 viram `AttackTuning` ali.
- **Interação de luz:** reusa o verbo de interação do braseiro do laço comum (canon 3.1) para
  reacender a Brasa (4.2); o estágio da luz controla a luz-chave da arena (padrão de luz quente
  já usado em `gilgal.ts:259-266`/`324-330`, citado no canon 4.4).
- **A montar (novo, fino):** `game/actors/enemies/guardian.ts` (a classe do chefe sobre a FSM),
  o controlador da gangarra de luz (estágio da Brasa <-> força/velocidade do Guardião), e a
  cena `crypt/` da Câmara da Brasa (canon 6.4). Nada disso é motor novo; é conteúdo sobre o
  motor reusado.

---

## 12. Riscos e mitigação

`[DESIGN]`
- **Chefe "esponja" que contradiz o tom:** manter vida medida em segundos (~75-110 s), não em
  HP; mitigar cedo no gray-box.
- **A gangorra de luz confundir o jogador:** se "reacender enfraquece o chefe" não ficar óbvio,
  o encontro vira caótico. Mitigar com a leitura visual forte (Guardião cambaleia/recua
  visivelmente quando a Brasa sobe) e com a fase 1 ENSINANDO a regra antes de pressionar.
  Validar em playtest cego (jogador entende sem texto?).
- **Reacender parado virar punição injusta:** calibrar a janela (4.2) para caber depois da
  recuperação longa do sopro de escuro (#4); telegrafar bem o #4. Se frustrar, encurtar a
  canalização ou dar i-frames no início dela.
- **Breu da fase 3 cegar/derrubar performance:** a fagulha sempre ilumina o entorno; limitar
  partículas; hazard com mesh/sombra simples (canon 4.1).
- **Quebra de dignidade no desfecho:** revisar a cena de render com a régua de sobriedade do
  tom (`narrativa-e-historia.md` 6.2); sem gore, sem zombaria, morte/render digno.
- **Escopo do verbo de luz inflar:** manter reacender como REUSO do verbo de braseiro, não um
  sistema novo. Se apertar o cronograma, a versão mínima (seção 13) corta a gangorra e mantém o
  duelo + reavivar scriptado no fim.

---

## 13. Degradação para uma vitrine mínima (se o cronograma apertar)

`[DESIGN]` Caso a gangorra de luz não feche a tempo, uma versão mínima que ainda prova o tema:
- Manter a arena, a Brasa moribunda ao centro, e o duelo de 2 golpes (#1 marreta, #2 sweep)
  com tells longos, vencido por VIDA (Guardião ~200-240), sem a mecânica de reacender durante a
  luta.
- A Brasa só é reavivada no DESFECHO scriptado (seção 8), preservando a condição de vitória do
  canon (vencer + reavivar = fim do slice) e o momento dramático.
- Cortar para depois: a gangorra de luz (4), o sopro de escuro (#4), o gancho (#3), o combo
  (#5), o cambaleio de luz (5.5), os hazards (5.6) e as fases 2-3.
- Recomendação: tratar o Guardião como "vitrine de chefe" (duelo curto + reavivar scriptado),
  priorizando o momento e deixando a gangorra de luz para quando o feel do combate básico
  estiver validado. Prova a tese e o tom sem assumir um sistema que pode não fechar.

---

## Checklist de aceite (Definition of Done)

`[NORMATIVO]` Cada item recebe sim/não honesto. `[ASPIRACIONAL]` orienta mas não bloqueia;
`[A DEFINIR]` em aberto impede o "pronto" ou vira adiamento registrado. Em conflito de número
genérico, vale `prototipo/src/game/combat/tuning.ts`.

Propósito e tom (seção 0, 8)
- [ ] O encontro encena a tese "a luz é a arma, não a espada": reacender a Brasa enfraquece o
      Guardião e abre as janelas [DESIGN][NORMATIVO]
- [ ] O Guardião é digno (guardiã exausta, não monstro); o desfecho dá peso de luto, sem QTE de
      execução, sem gore, sem zombaria, render digno [DESIGN][NORMATIVO]
- [ ] Antipadrões evitados: vida esponjosa, esqueleto ágil genérico, música de vitória heroica,
      ignorar a Brasa e vencer no braço [DESIGN][NORMATIVO]
- [ ] A dificuldade vem do significado e da leitura de luz, não da punição bruta (tells
      generosos na fase 1, dano alto se ignorado) [ASPIRACIONAL]

Arena (seção 3)
- [ ] Arena = Câmara da Brasa no fundo do poço-cripta, com porta de pedra selada e a Brasa
      moribunda (braseiro-âncora) ao centro [DESIGN][NORMATIVO]
- [ ] 1-2 luzes dinâmicas na arena; a luz-chave é a Brasa, intensidade variável com o estágio;
      olhos/runas e fogo são emissivo, não luz [DESIGN][NORMATIVO]

Mecânica de fase por luz (seção 4)
- [ ] Há dois medidores: vida do Guardião e luz da Brasa (3 estágios), a luz lida no mundo, não
      só no HUD [DESIGN][NORMATIVO]
- [ ] Gangorra: quanto mais a Brasa apaga, mais forte/rápido/escuro o Guardião; quanto mais
      arde, mais ele recua e expõe a silhueta [DESIGN][NORMATIVO]
- [ ] Reacender a Brasa reusa o verbo de braseiro, canaliza ~1,2-1,6 s parado e vulnerável,
      sobe um estágio de luz e esquenta a arena [DESIGN][NORMATIVO]
- [ ] A Brasa decai sozinha e cai um estágio com o sopro de escuro (#4); manter acesa é
      trabalho contínuo [DESIGN][NORMATIVO]

Fases e moveset (seção 5)
- [ ] Três fases por vida + luz: 1 (100-66%), 2 (66-33%), 3 (33-0%), lidas por luz/silhueta/cor
      de forma verificável [DESIGN][NORMATIVO]
- [ ] Golpe #1 marreta overhead: tell ~1,0 s (luz)/~0,8 s (escuro), ativo ~0,2 s, recuperação
      ~0,9 s, dano ~26-30; bloqueio não cobre, força esquiva lateral [DESIGN][NORMATIVO]
- [ ] Golpe #2 varredura: tell ~0,6/0,5 s, ativo ~0,25 s, recuperação ~0,6 s, dano ~15-18;
      esquivar para trás/atravessar [DESIGN][NORMATIVO]
- [ ] Golpe #3 gancho/puxão: tell ~0,5/0,4 s, dano ~12 + quebra de guarda; bloqueio não cobre,
      esquivar de lado [DESIGN][NORMATIVO]
- [ ] Golpe #4 sopro de escuro: tell ~0,9/0,7 s, área a partir do centro, recuperação ~1,0 s,
      dano ~10 + apaga 1 estágio da Brasa; sair do raio e punir a recuperação longa [DESIGN][NORMATIVO]
- [ ] Golpe #5 combo de 2-3 cortes (fases 2-3): encadeia sem voltar à guarda, recuperação ~0,7 s
      no fim, dano ~14+14(+14) [DESIGN][NORMATIVO]
- [ ] Cada golpe tem recuperação que dá vez ao jogador (atacar OU reacender); nenhum é seguro
      de spammar [DESIGN][NORMATIVO]
- [ ] Estados de IA presentes: Rondar/Guardar (default), Golpe telegrafado, Punível, Cambaleio
      de luz (exposto), Render; o chefe NÃO renasce [CÓDIGO][DESIGN][NORMATIVO]
- [ ] Velocidade de andar lenta/pesada/solene (não corre) [DESIGN][NORMATIVO]

Escalada e aberturas (seção 5.4, 5.5, 5.6)
- [ ] Fase 1 usa só #1 e #2, muito tempo em Rondar, ensina a gangorra; vida do chefe não
      aumenta entre fases [DESIGN][NORMATIVO]
- [ ] Fase 2 entra #3, #4 e #5 e reduz tempo em Rondar [DESIGN][NORMATIVO]
- [ ] Fase 3: tells ~15% mais curtos, encadeia mais, hazard de breu ativo; a luz é a única
      leitura; o jogador luta para reacender sob pressão [DESIGN][NORMATIVO]
- [ ] Cambaleio de luz: subir a Brasa a "forte" expõe o Guardião ~0,6-0,9 s com dano aumentado;
      decai sozinho; ele tenta sair com o sopro de escuro [DESIGN][NORMATIVO]
- [ ] Hazards da fase 3: maré de breu (sutil, não cegante; a fagulha sempre ilumina o entorno)
      e zonas de frio telegrafadas; não empilhar hazard + combo pesado [DESIGN][NORMATIVO]

Câmera, leitura e áudio (seção 6, 7)
- [ ] Lock-on leve disponível; câmera com colisão (não atravessa a Brasa nem os restos) [DESIGN][NORMATIVO]
- [ ] Sinais de leitura redundantes por tell: pose, cue de áudio e brilho de olhos/gume; nunca
      só por cor; a luz da arena sempre acompanhada de pose e som [DESIGN][NORMATIVO]
- [ ] Cada golpe da tabela 5.3 tem assinatura sonora própria, audível no breu; reacender e
      apagar a Brasa têm SFX próprios [DESIGN][NORMATIVO]
- [ ] Sem música de vitória heroica ao render o Guardião; trilha recolhida e elegíaca; áudio
      segue a gangorra [DESIGN][ASPIRACIONAL]

Loop central, duração e desfecho (seção 5.5, 8)
- [ ] O duelo dura ~75-110 s numa luta limpa e termina antes de cansar; vida medida em segundos,
      não em HP [DESIGN][NORMATIVO]
- [ ] O loop ler tell -> esquivar/punir -> reacender a Brasa -> cambaleio de luz -> punir forte
      é satisfatório [ASPIRACIONAL]
- [ ] Condição de vitória: vencer o Guardião E reavivar a Brasa = fim do vertical slice (canon
      3.1); reavivar é a vitória, não o golpe final [DESIGN][NORMATIVO]
- [ ] A identidade do Guardião é encenada no desfecho (não opcional); final do slice definido
      (proposta: o Sacrifício) [DESIGN][NORMATIVO]

Orçamento técnico e reúso de motor (seção 10, 11)
- [ ] Modelo do chefe 3k-6k tris, base KayKit Skeletons (variante Guardião), mesmo esqueleto e
      biblioteca de animação compartilhados; leitura de fase por luz/silhueta/cor sem polígono
      extra [ASSET][DESIGN][NORMATIVO]
- [ ] `.glb` do Guardião passou por optimize_asset.py + validate_gltf.py (escala, Y-up, atlas
      preservado) [NORMATIVO]
- [ ] Encontro roda a 60 fps desktop / 30 fps mobile com Brasa, cambaleio e hazards ligados;
      < 60 draw calls na arena; partículas limitadas [NORMATIVO]
- [ ] Reusa engine/ai/fsm.ts (StateMachine/Ticker, IA por tick), CombatTarget/Health/Hurtbox/
      AttackState/HealthBar3D, combatSound/impactFx; números num bloco GUARDIAN em
      game/combat/tuning.ts [CÓDIGO][NORMATIVO]
- [ ] Reacender a Brasa reusa o verbo de interação do braseiro do laço comum; nenhum motor novo
      é inventado [CÓDIGO][DESIGN][NORMATIVO]

Higiene e processo
- [ ] Nenhuma narrativa, nome, prop ou referência de Josué/bíblica aparece (rei, muralha, arca,
      khopesh, Asherah, etc.) [DESIGN][NORMATIVO]
- [ ] Sem travessões, sem emojis em qualquer texto exibido (guia de estilo 1.2) [NORMATIVO]
- [ ] Itens [A DEFINIR] resolvidos ou explicitamente adiados com registro (vida do chefe,
      tamanho da arena, parry global, regen ao reacender, final do slice, desbloqueio meta,
      variante KayKit) [NORMATIVO]

## Fontes

- Canon mestre: [`projeto-brasa.md`](../projeto-brasa.md) (premissa 1, estrutura sala-a-sala 3,
  orçamento técnico 4, mapeamento de motor 6).
- Lore do encontro: [`narrativa-e-historia.md`](narrativa-e-historia.md) (Brasa morrendo 2.3,
  mortos selados 3, descida e Guardião 5.4, ganchos 7).
- Leitura visual: [`direcao-de-arte.md`](direcao-de-arte.md) (assinatura cromática 2, silhueta
  3, luz como direção de arte 4, materiais/emissivo 5).
- Régua e DoD: [`../padrao-de-detalhe.md`](../padrao-de-detalhe.md) (orçamento 2.1, template de
  checklist 4).
- Spec análoga (estrutura espelhada): [`../spec-chefe-rei-jerico.md`](../spec-chefe-rei-jerico.md).
- Motor reaproveitado: `prototipo/src/engine/ai/fsm.ts`,
  `prototipo/src/game/actors/enemies/defender.ts`, `prototipo/src/game/combat/tuning.ts`.

---

## ATUALIZAÇÃO W3 (2026-06-15) - gangorra de luz no código

`[CÓDIGO]` `[NORMATIVO]` O Guardião (`guardiao.ts`) já tinha 3 fases por faixa de vida
(fria/tiço/quente) com movesets (marreta, varredura, sopro de escuro AoE). A onda W3 somou a
**mecânica-assinatura da luz** que faltava, de forma auto-contida e ligada ao recurso do herói:

- **brasaLight (0..1)** começa BAIXA (0,35: a Brasa está morrendo). Quanto mais escuro, mais
  CURTO o tell dos golpes (`tellMul = 0.7 + 0.3*brasaLight`): o chefe fica mais perigoso. Isto
  se SOMA à escala por fase de vida.
- **Sopro de escuro (AoE) APAGA** a Brasa um estágio (-0,34) ao se consumar.
- **Golpe de Fogo (ember) REACENDE:** ao atingir o chefe, sobe a luz um estágio (+0,34) e o faz
  **CAMBALEAR** por 0,8 s (parado, flash frio-claro, interrompe o golpe). Liga a Fagulha (W2) à
  luta: gastar fogo no chefe é a chave para domá-lo.
- **Cambaleio = vulnerabilidade:** durante o cambaleio o Guardião recebe **dano dobrado**
  (`takeHit` x2). O loop de mestria vira: criar espaço -> ember para cambalear -> bater pesado.

Pendente para W5/W6: confronto encenado (frase de entrada + sussurro de morte) e o
escurecimento visual da ARENA conforme `brasaLightFraction` (hoje só o emissivo do chefe muda).
