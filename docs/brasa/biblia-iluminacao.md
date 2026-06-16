# Bíblia de Iluminação: Brasa

Dungeon crawler 3D low-poly "Brasa" - Babylon.js (WebGPU / fallback WebGL2), estilo
KayKit (CC0). A Acendedora desce um poço-cripta de pedra, sala por sala, reacendendo
braseiros para empurrar o escuro andar abaixo antes que a superfície congele.

A LUZ É O CORAÇÃO DO JOGO, temático e mecânico. Não é enfeite: é a personagem
silenciosa e o verbo do laço de jogo. Cada sala nasce fria, azul e quase escura (morte,
pedra úmida, ausência da Brasa); a Acendedora a devolve à vida quando acende o braseiro,
e o laranja-quente invade enquanto o azul recua para as frestas. Acender é literalmente
ganhar a sala: a luz quente sinaliza vitória, concede recurso e destrava a porta.

Referência para Lighting Artists e Technical Artists. Marcação herdada do canon
([`projeto-brasa.md`](../projeto-brasa.md)): PROCEDÊNCIA `[DESIGN]` (decisão nossa),
`[CÓDIGO]` (observado no protótipo `prototipo/src`), `[ASSET]` (procede de pacote
existente); EXIGÊNCIA `[NORMATIVO]` (entra no aceite, verificável), `[ASPIRACIONAL]`
(mood, não bloqueia), `[A DEFINIR]` (decisão pendente). Convenção de escrita: pt-BR,
sem travessões, sem emojis.

Ver também [`direcao-de-arte.md`](direcao-de-arte.md) (paleta cromática mestre, seção 2),
[`projeto-brasa.md`](../projeto-brasa.md) (orçamento técnico normativo, seção 4) e
[`padrao-de-detalhe.md`](../padrao-de-detalhe.md) (régua de detalhe e formato de DoD).

Nota sobre Kelvin: as temperaturas seguem a convenção de fotografia/cinema. Atenção ao
"paradoxo do branco": luz QUENTE (fogo laranja) tem Kelvin BAIXO (~1800K); luz FRIA
(azulada) tem Kelvin ALTO. Em low-poly de cor chapada com luz dinâmica mínima, a Kelvin
serve de guia de mood, não de fidelidade física; no Babylon use `Color3.FromHexString`
com a tabela de cada item (a paleta da direção de arte é a fonte de verdade) ou
`Color3.FromTemperature(kelvin)` como atalho. Os HEX abaixo SÃO os da seção 2.1 de
[`direcao-de-arte.md`](direcao-de-arte.md); não inventar valores divergentes.

Snapshot: 2026-06-14.

---

## 1. A dramaturgia da luz: o laço contado em temperatura

`[DESIGN]` `[NORMATIVO]` Toda sala de Brasa existe em dois estados de luz e a transição
entre eles é o clímax visual de cada andar. A luz conta o laço de jogo (canon 3.1) sem
uma linha de texto:

1. **Sala selada (frio).** A porta de pedra se fecha atrás da Acendedora. A sala está em
   penumbra azul-acinzentada: valor baixo, saturação baixa, contraste comprimido. A
   única cor quente é a fagulha que a Acendedora carrega: um único ponto laranja num mar
   azul. Os mortos despertam; seus olhos/runas brilham em ciano-espectral gélido.
2. **Combate (frio mantido).** Enquanto há esqueletos vivos, a sala permanece fria. A
   leitura de combate vem da luz fria de preenchimento e do rim azulado nas silhuetas; o
   jogador lê o inimigo pelo contorno, não pela cor.
3. **Momento de acender (a virada).** Com a sala limpa, o braseiro pode ser aceso. O
   acendimento é o ÚNICO momento dramático de luz do andar: ao longo de ~0,6 a 1,2 s a
   luz quente sobe (intensidade e raio crescem), o laranja invade do centro para fora, o
   azul recua para bordas e sombras, o fog esfria de azul para neutro-quente. Subida com
   easing (não degrau), acompanhada por uma onda de partículas de fagulha.
4. **Pós-acender (quente, sala "conquistada").** A sala fica banhada de âmbar; o azul
   sobra só como memória nas frestas e cantos distantes. A porta de saída destrava (a luz
   quente é o feedback de que abriu). É o estado de respiro e recompensa antes da próxima
   descida.

`[DESIGN]` Regra de ouro cromática (herdada de [`direcao-de-arte.md`](direcao-de-arte.md)
2): azul e laranja quase nunca aparecem na mesma saturação ao mesmo tempo. Sala fria = o
laranja é só a fagulha. Sala quente = o azul é só a memória nas frestas. É a gangorra que
narra a passagem da morte para a vida.

`[ASPIRACIONAL]` O acender deve dar a sensação física de respirar fundo: o escuro recua,
o jogador "ganha terreno". A descida inteira é a soma dessas pequenas vitórias de luz
contra um escuro que aperta cada vez mais (ver gradiente, seção 4).

---

## 2. Valores e temperaturas de cor (frio-azul vs laranja-quente)

`[DESIGN]` `[NORMATIVO]` As âncoras de cor são as da seção 2.1 de
[`direcao-de-arte.md`](direcao-de-arte.md). Esta bíblia atribui Kelvin de mood,
intensidade e papel de luz a cada uma. A pedra KayKit é neutra e RECEBE a temperatura da
luz; não se repinta a pedra, muda-se a luz que a banha.

### 2.1 Frio-azul (estado selado, morte, pedra úmida) [DESIGN][NORMATIVO]

| Papel | HEX | Kelvin de mood | Uso |
|---|---|---|---|
| Ambiente/fog da sala fria | `#0E1A2B` | ~12000K | cor de fog EXP2 e de `scene.ambientColor` no estado selado |
| Sombra de pedra (ardósia) | `#1F3247` | ~10000K | tom das faces não atingidas pela luz fria |
| Luz fria de preenchimento (chave da sala fria) | `#3E5C7E` | ~8000-9000K | a 1 HemisphericLight OU 1 DirectionalLight fraca, rim azulado |
| Ciano-espectral (olhos/runas dos mortos) | `#5FB7C9` | gélido (emissivo) | emissivo dos esqueletos despertos; nunca luz dinâmica |

Intensidade do estado frio: baixa e plana. A luz fria de preenchimento fica em ~0.25 a
0.45 (escala onde o quente pós-acender = ~1.0). O objetivo é deixar a sala LEGÍVEL para o
combate sem nunca parecer acolhedora.

### 2.2 Laranja-quente (Brasa, braseiro aceso, fagulha) [DESIGN][NORMATIVO]

| Papel | HEX | Kelvin de mood | Uso |
|---|---|---|---|
| Núcleo da brasa (emissivo mais intenso) | `#FF7A1A` | ~1700K | emissivo do centro do fogo |
| Âmbar-chama (luz quente da sala) | `#FFA63D` | ~1900-2100K | cor da PointLight do braseiro aceso |
| Ouro-fagulha (realce, partículas) | `#FFD27A` | ~2400K | partículas de faísca, ponta da fagulha da Acendedora |
| Vermelho-tiço (base, brasa esfriando) | `#C8401C` | ~1500K | gradiente baixo do braseiro, emissivo de borda |

Intensidade do estado quente: a PointLight do braseiro sobe de 0 até ~0.7 a 0.9 ao
acender (padrão `gilgal.ts:259-266` usa 0.6 a 0.7), raio (`range`) ~6 a 8 unidades. NUNCA
estourar a pedra a branco: o teto de cor é âmbar saturado, não branco.

### 2.3 Pedra neutra (a cripta modular KayKit) [ASSET][DESIGN]

`#6B6660` (base), `#8A847C` (face iluminada), `#43403B` (junta/oclusão). A pedra não tem
cor própria de luz: fica fria-azulada no estado selado e âmbar no estado aceso. Esse é o
truque que faz o mesmo cubo de pedra virar cripta opressora ou refúgio.

---

## 3. Orçamento de luzes (NORMATIVO)

`[NORMATIVO]` Tetos de aceite, herdados do canon 4.4. O regime sala-a-sala é o que torna
isso barato: só UMA sala existe por vez, então o orçamento é POR SALA carregada.

### 3.1 Quantidade de luzes dinâmicas por sala [CÓDIGO][NORMATIVO]

- **No máximo 1 a 2 luzes dinâmicas por sala** (canon 4.4). Distribuição padrão:
  - 1 luz-chave de sala (fria no estado selado, pode trocar de cor/ganhar calor ao
    acender) - ESTA pode ter sombra.
  - 1 luz do braseiro (PointLight quente, surge ao acender) - SEM sombra.
- Salas grandes (cisterna/salão) que precisem de mais de um foco quente: usar 1 luz
  dinâmica no braseiro principal e fazer focos secundários como FAKE (emissivo + sprite
  de chama + glow), sem luz dinâmica nem sombra. Mesmo princípio das fogueiras "fake" de
  `gilgal.ts` (só 0-1 das fogueiras de praça ganha luz dinâmica).

### 3.2 Quem tem sombra e quem não tem [CÓDIGO][NORMATIVO]

- **Braseiro: SEM sombra.** A PointLight do braseiro tem `shadowEnabled = false`. Padrão
  já estabelecido no código (`gilgal.ts:265` e `gilgal.ts:329`: `lf.shadowEnabled =
  false`). Sombra de luz pontual é cara (cubemap) e desnecessária com o emissivo do fogo
  fazendo o trabalho de leitura.
- **A luz-chave da sala PODE ter sombra** (canon 4.4: "A luz-chave da sala pode ter
  sombra; as do braseiro não"). É a ÚNICA luz da sala autorizada a projetar sombra
  dinâmica, e só dos atores móveis (Acendedora, esqueletos), nunca da arquitetura, que já
  carrega oclusão pintada/assada (ver seção 6).
- **Olhos/runas dos mortos: emissivo, nunca luz.** O ciano-espectral `#5FB7C9` é material
  emissivo no esqueleto, não PointLight. Não conta no orçamento de luzes dinâmicas.

### 3.3 Por que esse orçamento [DESIGN]

Cada PointLight com sombra força um cubemap por frame; cada luz dinâmica encarece o shader
por pixel afetado. Com 1-2 dinâmicas e zero sombra de braseiro, a sala respeita o teto de
< 60 draw calls e os 60/30 fps mesmo em mobile. A riqueza vem do EMISSIVO e do contraste
de cor, que são quase de graça.

---

## 4. A fagulha / a Acendedora como fonte de luz

`[DESIGN]` `[NORMATIVO]` A Acendedora carrega a última fagulha do fogo. Ela é a única cor
quente no estado selado e a metáfora viva do jogo: o único ponto de calor descendo no
escuro.

### 4.1 A luz da Acendedora [DESIGN][NORMATIVO]

- Fonte: 1 PointLight quente PRESA à Acendedora (ou ao item/lanterna/fagulha que ela
  segura), cor âmbar-fagulha `#FFA63D` a ouro-fagulha `#FFD27A`, raio CURTO (~3 a 4
  unidades), intensidade baixa (~0.3 a 0.5). `shadowEnabled = false`.
- ESTA luz da Acendedora conta no orçamento como uma das 1-2 dinâmicas da sala no estado
  selado. Quando o braseiro acende e domina a sala, a luz da fagulha pode ser rebaixada
  para não competir (a Brasa do braseiro toma a cena).
- `[ASPIRACIONAL]` Flicker sutil e lento na fagulha (ruído/seno via
  `registerBeforeRender`), para parecer chama viva e não lâmpada. Amplitude pequena: a
  fagulha é frágil, não festiva.
- `[ASPIRACIONAL]` A fagulha emite poucas partículas de ouro-fagulha que sobem e somem;
  reforça que é o que ela carrega para reacender tudo.

### 4.2 Leitura de gameplay da fagulha [DESIGN]

No estado selado a fagulha é a tocha do jogador: ilumina só ao redor dela, criando uma
bolha de visibilidade que se move com a Acendedora. Isso faz o escuro virar tensão
jogável (você não vê o canto da sala até chegar perto) sem nunca cegar o jogador, porque
a luz fria de preenchimento (seção 2.1) garante o mínimo de leitura.

---

## 5. Gradiente de escuridão conforme a descida

`[DESIGN]` `[NORMATIVO]` A descida é uma jornada de luz: quanto mais fundo no poço-cripta,
mais longe da superfície e mais perto da Brasa morrendo, mais escuro e mais frio o estado
SELADO de cada sala. O acender de cada braseiro continua devolvendo calor, mas a base de
onde se parte fica progressivamente mais hostil. É o gradiente que faz a descida "pesar".

### 5.1 Curva do estado selado por profundidade [DESIGN][NORMATIVO]

| Faixa de profundidade | Ambiente/fog selado | Intensidade da luz fria | Densidade de fog | Mood |
|---|---|---|---|---|
| Andares de topo (1-2) | azul-ardósia `#1F3247` levantado | ~0.40-0.45 | baixa | ainda há eco de luz de cima |
| Andares médios | azul-cripta `#0E1A2B` | ~0.30-0.35 | média | longe da superfície, frio assentado |
| Andares fundos (perto do Guardião) | azul-cripta `#0E1A2B` rebaixado quase a preto | ~0.20-0.25 | alta | beira do silêncio total, só a fagulha |
| Câmara do Guardião | quase preto azulado | mínimo absoluto (leitura) | alta | a Brasa apagada, o escuro venceu aqui |

`[DESIGN]` O estado ACESO permanece sempre âmbar e acolhedor em qualquer profundidade: a
recompensa do acender não diminui. O que muda é o ponto de partida cada vez mais escuro,
então a virada frio-para-quente fica cada vez mais DRAMÁTICA conforme se desce (maior
delta de luz). O fundo é onde acender importa mais.

### 5.2 Implementação Babylon do gradiente [CÓDIGO][DESIGN]

Por sala, parametrizar `scene.fogColor`, `scene.fogDensity`, `scene.ambientColor` e a
intensidade da luz-chave fria por um único valor de "profundidade" (0 a 1) da sala.
Interpolar (lerp) entre as âncoras da tabela. Um só número dirige todo o gradiente, fácil
de afinar e de testar.

---

## 6. Baked vs dinâmico no contexto Babylon

`[DESIGN]` `[NORMATIVO]` Filosofia (herdada do canon e da execução do protótipo): ASSAR o
máximo, luz dinâmica MÍNIMA (1-2 por sala), pós-processamento com parcimônia. A cripta
fechada é o cenário IDEAL para baking: não há sol, não há ciclo dia/noite, a geometria é
estática e modular.

### 6.1 O que pré-calcular (assar) [DESIGN][NORMATIVO]

- **Oclusão e degradê da pedra:** ASSAR no vertex color do atlas KayKit (face superior
  mais clara `#8A847C`, juntas e base mais escuras `#43403B`). Custo zero em runtime;
  dá volume à pedra chapada sem luz dinâmica.
- **A "cor de estado" da sala NÃO precisa ser lightmap separado:** como a virada
  frio-para-quente é dinâmica (a luz da sala muda de cor e intensidade ao acender), ela é
  feita pela luz-chave dinâmica + fog, não por dois lightmaps. Assar serve ao que é fixo
  (oclusão, profundidade da pedra), não ao que muda no laço.
- **Sombras estáticas de arquitetura:** se uma sala tiver geometria fixa projetando sombra
  fixa (um pilar sobre o piso), assar como lightmap (`material.lightmapTexture`,
  `useLightmapAsShadowmap = true`). A arquitetura NUNCA projeta sombra dinâmica.

### 6.2 O que é dinâmico (poucas coisas) [DESIGN][NORMATIVO]

- A luz-chave da sala (muda de cor/intensidade no acender; pode ter sombra só dos atores).
- A PointLight do braseiro (surge ao acender; sem sombra).
- A PointLight da fagulha/Acendedora (move com o herói; sem sombra).
- O emissivo animado do fogo e o flicker (via `registerBeforeRender`).

### 6.3 Sombra dinâmica com orçamento [DESIGN][NORMATIVO]

- Se a luz-chave da sala tiver sombra: `ShadowGenerator` simples (não CSM, que é para sol
  de mundo aberto e foi aposentado junto com `world.ts`/`sky.ts` na virada, canon 6.3),
  mapa 1024, filtro PCF rápido. `addShadowCaster` SÓ na Acendedora e nos esqueletos. A
  arquitetura e os props não são shadow casters (já têm oclusão assada).
- Em mobile/fallback: desligar a sombra dinâmica inteira e confiar no contraste de cor e
  no emissivo. A sala continua legível (ver fallback, seção 7).

---

## 7. Leitura de gameplay: a luz como pista

`[DESIGN]` `[NORMATIVO]` Além de tema, a luz é a interface de navegação do jogo. O jogador
sem texto deve saber para onde ir e o que fazer pela luz:

- **O braseiro a acender é o ponto mais escuro-mas-promissor da sala.** No estado selado o
  braseiro apagado tem um leve emissivo de tiço frio (`#C8401C` muito rebaixado, quase
  morto) que o destaca como o único objeto "interagível de fogo". É o alvo óbvio depois do
  combate. `[DESIGN]` `[NORMATIVO]`
- **A porta de saída é telegrafada pela luz, não por seta.** Selada, fica na sombra azul
  mais fechada (você não deve querer voltar). Ao acender o braseiro, a luz quente a alcança
  e ela ganha leitura: o caminho à frente literalmente se ilumina. `[DESIGN]` `[NORMATIVO]`
- **A bolha da fagulha guia a exploração.** No escuro, o jogador segue a própria luz; o que
  está fora da bolha é desconhecido e tenso. A luz fria de preenchimento impede o preto
  absoluto que frustaria a leitura. `[DESIGN]`
- **Cor de inimigo por emissivo.** Olhos/runas em ciano-espectral marcam onde estão os
  mortos no escuro antes de você os ver inteiros: leitura de ameaça sem custo de luz.
  `[DESIGN]` `[NORMATIVO]`
- `[ASPIRACIONAL]` Santuários do braseiro (recompensa, canon 3.2) podem ter um acento de
  ciano-espectral saturado como "presença antiga", sinalizando andar de recompensa sem
  quebrar a gangorra de cor.

---

## 8. Fallback de performance e mobile

`[DESIGN]` `[NORMATIVO]` O critério número um é rodar leve no navegador (canon pilar 1).
A luz degrada com elegância, preservando a LEITURA e a virada frio-para-quente, que são o
coração do jogo. Ordem de corte do mais pesado ao mais barato:

| Recurso | Desktop (WebGPU) | Mobile / fallback (WebGL2) |
|---|---|---|
| Luzes dinâmicas por sala | 1-2 | 1 (a do braseiro; fundir luz-chave fria em ambiente/fog) |
| Sombra dinâmica da luz-chave | ligada, mapa 1024 PCF, só atores | DESLIGADA (contraste de cor + oclusão assada bastam) |
| Flicker da chama | ruído + seno | só seno (mais barato) ou estático |
| Partículas de fagulha/fog | sprites moderados | reduzir contagem ou desligar |
| Pós (bloom/grading) | bloom sutil threshold alto, vinheta leve, FXAA | bloom mais barato ou só vinheta + FXAA |

`[NORMATIVO]` Mesmo no fallback mínimo (1 luz, sem sombra dinâmica), a sala DEVE: (a) ser
legível para o combate; (b) executar a virada frio-para-quente visível (via cor de
ambiente/fog + emissivo do braseiro, não exige luz dinâmica extra). A virada é
inegociável: é o jogo.

`[DESIGN]` Pós-processamento (`DefaultRenderingPipeline`): bloom SUTIL de threshold alto
(só o fogo floresce), vinheta leve (reforça a opressão da cripta), FXAA. EVITAR SSAO
pesado (a oclusão é assada), DoF constante, SSR, bloom forte. O look vem da LUZ e do
CONTRASTE DE COR, não do pós.

---

## 9. Fichas por situação de luz

`[DESIGN]` `[NORMATIVO]` Quatro situações canônicas do laço. Cada ficha é verificável
contra a luz-chave, o braseiro, o fog e o estado da sala.

### 9.1 Sala apagada / selada (id: luz_sala_selada)

- Resumo: a sala recém-entrada, fria, com os mortos despertando.
- Luz-chave: 1 luz fria de preenchimento `#3E5C7E` (~8000-9000K mood), intensidade
  ~0.25-0.45 conforme profundidade (seção 5). Pode ter sombra (só atores) no desktop.
- Braseiro: APAGADO, leve emissivo de tiço frio `#C8401C` rebaixado como isca visual; sem
  luz dinâmica.
- Fagulha da Acendedora: 1 PointLight `#FFA63D` raio curto ~3-4, intensidade ~0.3-0.5,
  sem sombra. O único calor da cena.
- Fog: EXP2, cor azul-cripta `#0E1A2B`, densidade conforme profundidade.
- Inimigos: emissivo ciano-espectral `#5FB7C9` nos olhos/runas.
- Orçamento: 1-2 luzes dinâmicas (fagulha + opcional chave fria), zero sombra de braseiro.
- Mood `[ASPIRACIONAL]`: opressão, frio, vigília; o escuro aperta, a fagulha resiste.

### 9.2 Momento de acender (id: luz_acender)

- Resumo: a virada, sala limpa, braseiro sendo aceso. O único evento dramático de luz do
  andar.
- Transição ao longo de ~0,6 a 1,2 s com easing: a PointLight do braseiro sobe de 0 a
  ~0.7-0.9 e `range` de 0 a ~6-8; cor `#FFA63D`. Sem sombra.
- Fog faz lerp de azul-cripta `#0E1A2B` para neutro-quente; a luz fria de preenchimento
  recua; bloom do fogo cresce com a chama.
- Acompanhamento: onda de partículas ouro-fagulha `#FFD27A`; emissivo do núcleo sobe a
  `#FF7A1A`.
- Orçamento: pico momentâneo ainda dentro de 2 luzes dinâmicas (braseiro + fagulha; a
  chave fria some na transição).
- Mood `[ASPIRACIONAL]`: alívio, respiro, "ganhei a sala"; o escuro recua de vez.

### 9.3 Pós-acender (id: luz_sala_acesa)

- Resumo: sala conquistada, banhada de âmbar, porta destravada.
- Luz dominante: PointLight do braseiro `#FFA63D` estável em ~0.7-0.9, raio ~6-8, sem
  sombra. Flicker sutil de chama viva.
- Azul: só nas frestas e cantos distantes (memória); a luz fria de preenchimento fica
  mínima ou desligada.
- Fog: cor neutro-quente, densidade reduzida (a luz quente "abre" a sala).
- Porta de saída: alcançada pela luz quente = telegrafa que abriu (seção 7).
- Fagulha da Acendedora: rebaixada para não competir com o braseiro.
- Orçamento: 1 luz dinâmica dominante (braseiro). Folga.
- Mood `[ASPIRACIONAL]`: calor, refúgio momentâneo, recompensa antes da próxima descida.

### 9.4 Câmara do Guardião (id: luz_camara_guardiao)

- Resumo: o andar de chefe, o ponto mais fundo e escuro; a Brasa apagada no fundo do poço.
- Estado base: o mais frio e escuro de toda a descida (seção 5.1, faixa funda):
  ambiente/fog azul-cripta `#0E1A2B` quase preto, luz fria no mínimo de leitura, fog
  denso.
- Luz dramática da luta `[DESIGN]`: a fagulha da Acendedora é quase a única fonte; permite
  rim azulado e silhueta do Guardião (leitura de fase por silhueta/cor, canon 4.2). O
  Guardião pode ter emissivo frio (ferro frio `#5A6470` / ciano-espectral) que muda ao
  ferir/fasear.
- Braseiro/Brasa: a Brasa do fundo está APAGADA durante a luta; ao vencer e reavivá-la, a
  virada frio-para-quente é a MAIOR de todo o jogo (delta máximo): o âmbar `#FFA63D` toma
  a câmara inteira e a fagulha vira fogueira; fecha o vertical slice.
- Orçamento: durante a luta 1-2 dinâmicas (fagulha + opcional chave fria mínima), sem
  sombra de braseiro; a luz-chave pode ter sombra só dos atores no desktop. No reacender,
  pico controlado dentro do teto.
- Mood `[ASPIRACIONAL]`: o escuro venceu aqui; reacender a Brasa é a vitória que devolve a
  luz ao reino.

---

## Checklist de aceite (Definition of Done)

Derivado do conteúdo deste doc no formato de [`padrao-de-detalhe.md`](../padrao-de-detalhe.md)
seção 4. Cada item recebe sim/não honesto, conferindo luz-chave, braseiro, fog e estado
da sala contra os valores acima. Os HEX referenciam a paleta mestre de
[`direcao-de-arte.md`](direcao-de-arte.md) 2.1.

Dramaturgia e cor (seções 1-2):
- [ ] Toda sala tem dois estados de luz e a virada frio-para-quente roda ao acender o braseiro [DESIGN][NORMATIVO]
- [ ] Estado frio: ambiente/fog azul-cripta `#0E1A2B`, sombra de pedra `#1F3247`, luz fria de preenchimento `#3E5C7E`, intensidade baixa e plana [DESIGN][NORMATIVO]
- [ ] Estado quente: luz do braseiro âmbar `#FFA63D`, núcleo emissivo `#FF7A1A`, sem branco estourado [DESIGN][NORMATIVO]
- [ ] Regra da gangorra respeitada: azul e laranja não aparecem na mesma saturação ao mesmo tempo [DESIGN][NORMATIVO]
- [ ] Olhos/runas dos mortos em emissivo ciano-espectral `#5FB7C9`, nunca como luz dinâmica [DESIGN][NORMATIVO]

Orçamento de luzes (seção 3):
- [ ] No máximo 1-2 luzes dinâmicas por sala carregada (canon 4.4) [CÓDIGO][NORMATIVO]
- [ ] Braseiro SEM sombra (`shadowEnabled = false`), padrão de `gilgal.ts:265`/`gilgal.ts:329` [CÓDIGO][NORMATIVO]
- [ ] Só a luz-chave da sala pode ter sombra, e só dos atores móveis; arquitetura nunca projeta sombra dinâmica [DESIGN][NORMATIVO]
- [ ] Focos quentes extras feitos como fake (emissivo + sprite + glow), sem luz dinâmica [DESIGN][NORMATIVO]

Fagulha / Acendedora (seção 4):
- [ ] Acendedora carrega 1 PointLight quente `#FFA63D`-`#FFD27A`, raio curto ~3-4, intensidade ~0.3-0.5, sem sombra [DESIGN][NORMATIVO]
- [ ] No estado selado a fagulha é a única cor quente e cria bolha de visibilidade móvel [DESIGN][NORMATIVO]

Gradiente de descida (seção 5):
- [ ] Estado selado escurece e esfria progressivamente conforme a profundidade (topo `#1F3247` levantado -> fundo `#0E1A2B` quase preto) [DESIGN][NORMATIVO]
- [ ] Um único valor de profundidade (0-1) por sala dirige fogColor, fogDensity, ambientColor e intensidade da chave fria [CÓDIGO][NORMATIVO]
- [ ] Estado aceso permanece âmbar acolhedor em qualquer profundidade (recompensa não diminui) [DESIGN][NORMATIVO]

Baked vs dinâmico (seção 6):
- [ ] Oclusão e degradê da pedra assados em vertex color do atlas KayKit (face clara `#8A847C`, junta `#43403B`) [DESIGN][NORMATIVO]
- [ ] Apenas luz-chave, braseiro, fagulha e emissivo do fogo são dinâmicos; resto é assado [DESIGN][NORMATIVO]
- [ ] Sem CascadedShadowGenerator (sol de mundo aberto aposentado); se houver sombra, ShadowGenerator simples mapa 1024 PCF só nos atores [DESIGN][NORMATIVO]

Leitura de gameplay (seção 7):
- [ ] Braseiro apagado tem emissivo de tiço frio como isca visual; é o alvo óbvio pós-combate [DESIGN][NORMATIVO]
- [ ] Porta de saída fica na sombra azul fechada selada e ganha leitura quando a luz quente a alcança [DESIGN][NORMATIVO]

Fallback de performance e mobile (seção 8):
- [ ] No fallback mínimo (1 luz, sem sombra dinâmica) a sala é legível para combate [DESIGN][NORMATIVO]
- [ ] A virada frio-para-quente continua visível mesmo no fallback (via ambiente/fog + emissivo, sem luz extra) [DESIGN][NORMATIVO]
- [ ] Pós com parcimônia: bloom sutil threshold alto, vinheta leve, FXAA; sem SSAO pesado, DoF, SSR ou bloom forte [DESIGN][NORMATIVO]
- [ ] 60 fps desktop / 30 fps mobile médio mantidos com a sala iluminada (canon 4.1) [DESIGN][NORMATIVO]

Fichas por situação (seção 9):
- [ ] Sala selada conforme 9.1 (fria, fagulha como único calor, braseiro apagado com tiço de isca) [DESIGN][NORMATIVO]
- [ ] Momento de acender conforme 9.2 (transição ~0,6-1,2 s com easing, fog lerp, partículas) [DESIGN][NORMATIVO]
- [ ] Pós-acender conforme 9.3 (braseiro âmbar dominante, azul só nas frestas, porta destravada legível) [DESIGN][NORMATIVO]
- [ ] Câmara do Guardião conforme 9.4 (mais escura da descida; reacender a Brasa = maior virada do jogo) [DESIGN][NORMATIVO]

Estilo:
- [ ] Sem travessões, sem emojis em qualquer texto exibido [NORMATIVO]
- [ ] Itens [A DEFINIR] resolvidos ou explicitamente adiados com registro [NORMATIVO]

---

## ATUALIZAÇÃO W4 (2026-06-15) - atmosfera por zona no código

`[CÓDIGO]` `[NORMATIVO]` Cada câmara agora respira diferente conforme a profundidade, sem
tocar geometria nem câmera (o teto e a câmera 3a pessoa já estavam afinados). Em `cryptRoom.ts`
um `ZONE_DEPTH` por `RoomKind` (guarda 0.0, salao 0.35, cisterna 0.55, santuario 0.7,
guardiao 1.0) escala:

- **Névoa:** `fogDensity = 0.004 + 0.007 * depth` (raso límpido, fundo enevoado) e a cor fria
  vai de azul-acinzentado claro (#243240) a azul-profundo gélido (#0e1622).
- **Ambiente:** a luz fria-base cai de 0.70 (raso, mais iluminado) a 0.54 (fundo, sombrio);
  a cor do ambiente esfria com a profundidade.
- A virada frio->quente do braseiro continua por cima disto (não foi alterada).

Resultado: as salas leem como uma DESCIDA (cada vez mais frio, escuro e denso), reforçando a
identidade por zona sem custo de draw call. O escurecimento da arena do Guardião por
`brasaLightFraction` (W3) fica para a W6.
