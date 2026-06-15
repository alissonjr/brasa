# Spec de UI, HUD e UX: Brasa

Documento de design de interface, HUD e experiência de uso de **Brasa**: dungeon crawler
3D low-poly de navegador onde a última **Acendedora** desce um **poço-cripta**, câmara por
câmara, limpando os **mortos despertos** e acendendo **braseiros** para empurrar o **frio
eterno** andar abaixo e reavivar a **Brasa**. Esta spec define como o jogo se mostra e se
opera na tela: o HUD, os estados de UI, os menus, a estética casada com a direção de arte,
tipografia, acessibilidade e o comportamento responsivo/toque.

Mestre do canon: [`projeto-brasa.md`](../projeto-brasa.md). Direção visual:
[`direcao-de-arte.md`](direcao-de-arte.md) (paleta HEX, assinatura frio-quente, fagulha
como luz). Régua de detalhe e marcações: [`padrao-de-detalhe.md`](../padrao-de-detalhe.md).
Vocabulário: [`guia-de-estilo-e-glossario.md`](guia-de-estilo-e-glossario.md).

Marcação herdada do canon. PROCEDÊNCIA: `[DESIGN]` (decisão nossa), `[CÓDIGO]` (observado
no protótipo `prototipo/src`), `[ASSET]` (procede de pacote existente). EXIGÊNCIA:
`[NORMATIVO]` (entra no aceite, verificável), `[ASPIRACIONAL]` (mood, não bloqueia),
`[A DEFINIR]` (decisão pendente). Convenção de escrita: pt-BR, sem travessões, sem emojis.

O MOTOR de UI é reaproveitado por inteiro do protótipo de Josué (`engine/ui/uiManager.ts`,
`game/ui/hud.ts`, `combatHud.ts`, `screens.ts`, `theme.css`, `strings.ts`, `fonts.ts`). O
que muda é o TEMA (de argila/bronze quente para pedra-fria/brasa), o vocabulário e os
estados (de mundo aberto para sala-a-sala). Nada de Josué (objetivo de campanha, bússola
de marcos, capítulos, crônica bíblica) entra na cena de jogo de Brasa.

Snapshot: 2026-06-14.

---

## 1. Princípios de UI

`[DESIGN]` Quatro tipos de UI (vocabulário consolidado do projeto):
- **Não-diegética:** sobreposta à tela, fora da ficção (ex.: barra de vida no canto).
  Máxima clareza.
- **Diegética:** dentro do mundo, que os personagens poderiam perceber (ex.: a luz da
  fagulha que a Acendedora carrega). Máxima imersão, mais cara e mais difícil de ler.
- **Espacial:** ancorada no espaço 3D mas não na ficção (prompt do braseiro flutuando
  sobre ele, contorno de interativo).
- **Meta:** pertence à ficção mas não ao espaço (vinheta de dano nas bordas, esfriamento
  azul da tela quando a vida cai).

`[DESIGN]` `[NORMATIVO]` Decisão de Brasa: **modelo híbrido pragmático, governado pela
assinatura frio-quente**. A UI não é só legível, ela conta a mesma história que a luz:
- **Não-diegética com vestimenta temática** para vida e fagulha/fogo: rápida de ler,
  vestida de pedra-fria e bronze patinado. Regra de ouro herdada: nunca sacrificar
  legibilidade pela imersão.
- **Diegética verdadeira no recurso de fogo sempre que possível:** a fagulha que a
  Acendedora carrega no mundo 3D (ver `direcao-de-arte.md` 7) e o medidor de fagulha do
  HUD são o mesmo conceito; o halo de luz dela no mundo É o medidor, e o HUD apenas o
  ecoa. O fogo é o único elemento quente num HUD frio.
- **Espacial** para o prompt de interação do braseiro e o contorno/realce de interativos,
  ancorados ao alvo no mundo.
- **Meta** para feedback de dano (vinheta) e para o estado de vida crítica (a tela esfria
  e dessatura, o azul invade as bordas, coerente com "o frio vencendo").

`[DESIGN]` `[NORMATIVO]` Princípios:
- **Frio por padrão, quente só onde há vida/ação.** O HUD nasce em pedra-fria e bronze
  apagado. Laranja-brasa (`#FFA63D`, `#FF7A1A`) é reservado ao fogo: fagulha, braseiro
  disponível, acender. Ciano-espectral (`#5FB7C9`) só para a ameaça dos mortos. Nunca
  gastar o laranja em ornamento: ele tem que ser sempre o ponto mais quente da tela (regra
  da gangorra de `direcao-de-arte.md` 2).
- **Minimalismo e não-intrusão:** o HUD mostra o essencial e recua quando não há info.
- **Coerência temática:** um kit visual único, reaproveitado de menus a HUD.
- **Hierarquia de cor inequívoca:** laranja = fogo/acionável-quente, ciano = ameaça dos
  mortos, vermelho-tiço = dano/perigo, pedra/bronze = neutro. Nunca codificar info só por
  cor (ver seção 7).
- **A profundidade é o enredo:** o único "objetivo" persistente é a descida. O indicador
  de sala/profundidade substitui o objetivo de quest de Josué.

---

## 2. HUD de jogo

`[DESIGN]` `[NORMATIVO]` Mostrar só o essencial da descida. Diferente de Josué, **não há
minimapa, não há bússola de marcos, não há objetivo de campanha**: a câmara é selada e o
mundo é uma sala por vez (`projeto-brasa.md` 1, 4.1). O HUD da exploração de mundo aberto
de Josué (`hud.ts`: chip de pontos, bússola, faixa de objetivo) é APOSENTADO; sobra o
núcleo de combate de `combatHud.ts` (vida + vinheta), re-vestido e estendido com fagulha e
profundidade.

### 2.1 Elementos do HUD

| Elemento | Tipo | Quando | Visual |
|---|---|---|---|
| Vida da Acendedora | Não-diegética (vestida) | persistente em combate; fade na penumbra sem inimigos | placa de pedra com fechadura de bronze patinado, canto inferior-esquerdo; preenchimento vermelho-tiço `#C8401C`; entalhes por segmento; em vida crítica pulsa e a tela esfria (meta) |
| Medidor da fagulha (fogo) | Diegética-ecoada / não-diegética | persistente | medidor quente junto à vida; o ÚNICO elemento laranja do HUD; cheia = halo da fagulha forte no mundo, baixa = halo fraco; ver 2.2 |
| Indicador de sala/profundidade | Não-diegética discreta | persistente, recolhível | selo vertical no topo: "Câmara N / M" + traço de descida que desce a cada braseiro aceso; ver 2.3 |
| Prompt de interação (braseiro) | Espacial/ancorado | só quando a sala está limpa e a Acendedora no raio do braseiro | selo de bronze sobre o braseiro com glifo do botão + verbo "Acender"; halo laranja pulsante; ver seção 3 estado E |
| Alvo de combate (lock-on) | Espacial | só com lock-on ativo num morto | retículo/coroa ciano sob o inimigo focado + barra de vida 3D do alvo (de `healthBar3d`); seta para o próximo alvo; ver 2.4 |
| Feedback de dano | Meta | no impacto | vinheta vermelho-tiço/cinza `#6E1B16` nas bordas + leve shake; sem números de dano flutuantes (de `combatHud.flashDamage`) |
| Dica de controles | Não-diegética transitória | início da sessão; some após ~12 s ou no 1o ataque | linha discreta inferior-central (de `combatHud.hint`, `dismissHint()`) |
| Toast de evento | Não-diegética transitória | upgrade ganho, marco da descida | cartão que entra e sai por cima do HUD (de `hud.notify`), re-textado |

`[DESIGN]` `[NORMATIVO]` Estados de visibilidade do HUD (substituem `combat/explore/dialogue/cinematic` de Josué; ver seção 4):
- `penumbra`: sala selada sem combate ativo. Vida e fagulha esmaecidas; profundidade visível; sem alvo.
- `combate`: mortos despertos ativos. Vida, fagulha e alvo plenos.
- `braseiro`: sala limpa, braseiro disponível. Prompt de acender em destaque; vida/fagulha esmaecem.
- `upgrade`: escolha de melhoria aberta. HUD de jogo recolhido, painel de escolha em foco.
- `cinematica`: descida entre salas, abrir da Brasa, derrota/fim. HUD oculto.

`[DESIGN]` `[NORMATIVO]` **Esconder/evitar:** minimapa, bússola completa, objetivo de
campanha de Josué, medidor de XP sempre visível, números de dano flutuantes. A orientação
vem do level design (a porta selada, o braseiro como único ponto quente, a escada para
baixo), não de um mapa.

### 2.2 Medidor da fagulha (o recurso de fogo, diegético quando possível)

`[DESIGN]` `[NORMATIVO]` A fagulha é o recurso de fogo que a Acendedora carrega
(`projeto-brasa.md` 1, 3.3). No mundo 3D ela é um halo laranja (`#FFA63D`) preso à heroína
(`direcao-de-arte.md` 7). O HUD não inventa um medidor abstrato concorrente: ele **ecoa**
o mesmo recurso.
- `[DESIGN]` `[NORMATIVO]` Forma: um pequeno braseiro/lampião estilizado (não uma barra
  reta genérica) ao lado da vida, preenchido por uma chama laranja cuja ALTURA representa
  a carga. Cheio = chama alta laranja-brasa `#FF7A1A`; baixo = brasa vermelha `#C8401C`
  quase apagada; vazio = só bronze frio (a fagulha morta).
- `[DESIGN]` `[ASPIRACIONAL]` Acoplamento diegético: a carga do medidor e a intensidade do
  halo de luz da Acendedora no mundo derivam do MESMO valor. Quando a fagulha cai, a sala
  fica literalmente mais escura ao redor dela. Esta é a expressão mais forte de UI
  diegética do jogo.
- `[A DEFINIR]` O verbo exato da fagulha como recurso (mana de habilidade de fogo, gasta
  para acender braseiros, raio de luz, ou só recurso narrativo) depende de
  [`spec-progressao-e-economia.md`](spec-progressao-e-economia.md) e
  [`game-design-e-sistemas.md`](game-design-e-sistemas.md). A UI só promete: existe um
  recurso de fogo, ele tem um medidor diegético-ecoado, é o único elemento quente do HUD.

### 2.3 Indicador de sala/profundidade

`[DESIGN]` `[NORMATIVO]` Substitui o objetivo/quest de Josué. Comunica de relance "onde
estou na descida" sem mapa.
- Forma: um selo VERTICAL no topo (a descida é para baixo), uma coluna de pedra com elos
  de corrente; cada elo aceso = um braseiro/andar conquistado, os elos abaixo apagados =
  o que falta descer.
- Rótulo textual: "Câmara N de M" (i18n), recolhível.
- `[DESIGN]` Quanto mais fundo, mais frio o tom do selo (coerente com `direcao-de-arte.md`
  198: andares mais fundos são mais frios), reforçando a sensação de descida.
- `[A DEFINIR]` Se o total de câmaras (M) é revelado desde o início (mais ansioso, mais
  claro) ou descoberto andar a andar (mais misterioso). Proposta `[DESIGN]`: revelar M, a
  ansiedade da descida finita serve ao tom.

### 2.4 Alvo de combate (lock-on)

`[DESIGN]` `[NORMATIVO]` Reaproveita `combatTarget`/`healthBar3d` do motor (`projeto-brasa.md`
6.1). Quando o lock-on prende um morto desperto:
- Retículo espacial ciano-espectral `#5FB7C9` sob o alvo (ciano = ameaça dos mortos, nunca
  laranja, que é reservado ao fogo).
- Barra de vida 3D do alvo (`healthBar3d`) acima dele, curta e clamp na borda da tela se o
  alvo sair de quadro.
- Seta de troca de alvo (esquerda/direita) quando há vários mortos na sala.
- O chefe **Guardião** usa a mesma mecânica com barra maior e leitura de fase por cor da
  barra/silhueta (ver spec do chefe quando existir).

### 2.5 Esboço ASCII do HUD em jogo

```
+--------------------------------------------------------------+
|              [||]  Camara 3 de 6   v v o o  (selo vertical    |
|              [||]                          de profundidade)   |
|                       (  )  retículo do alvo (espacial, ciano)|
|                        ||   barra de vida 3D do morto focado  |
|                                                               |
|                          .------------------.                 |
|                          | [E] Acender      |  prompt do      |
|                          '------------------'  braseiro (so   |
|                            (halo laranja)      com sala limpa)|
|  .----------------------.                                     |
|  | VIDA [||||||||------] |  placa de pedra + bronze (frio)     |
|  | (#)) fagulha/chama    |  medidor de fogo (UNICO laranja)    |
|  '----------------------'                                     |
+--------------------------------------------------------------+
   (bordas: vinheta de dano - meta - vermelho-tico no impacto;
    em vida critica a tela esfria/dessatura, azul invade)
```

---

## 3. Estados de UI (fichas por estado)

`[DESIGN]` Cada estado do laço de uma sala (`projeto-brasa.md` 3.1) tem uma cara de UI
distinta. Fichas no formato de elemento do padrão de detalhe.

### Estado A: Penumbra (sala selada, antes do combate)
- Resumo `[DESIGN]`: a Acendedora entra, a porta de pedra se sela atrás, a sala está fria
  e quase escura; os mortos vão despertar.
- Estado de HUD: `penumbra`. Vida e fagulha presentes mas esmaecidas (~50% opacidade);
  profundidade visível; sem alvo, sem prompt de braseiro.
- Visual `[NORMATIVO]`: dominância azul-cripta `#0E1A2B`; o único ponto quente da tela é o
  halo da fagulha da Acendedora (mundo) e o medidor de fagulha (HUD).
- Mood `[ASPIRACIONAL]`: tensão silenciosa, breu azul, expectativa.

### Estado B: Combate (mortos despertos ativos)
- Resumo `[DESIGN]`: os mortos despertaram; o jogador limpa a sala com o combate melee.
- Estado de HUD: `combate`. Vida, fagulha e alvo plenos (100% opacidade). Dica de controles
  no início. Vinheta no dano.
- Visual `[NORMATIVO]`: olhos/runas dos mortos em ciano-espectral `#5FB7C9`; retículo do
  alvo ciano; vinheta vermelho-tiço no impacto; shake leve.
- `[NORMATIVO]`: sem números de dano flutuantes; feedback é cor + shake + som.

### Estado C: Vida crítica (transversal a combate)
- Resumo `[DESIGN]`: vida baixa; o frio está vencendo.
- Visual `[NORMATIVO]` (meta): a placa de vida pulsa; a tela dessatura levemente e o azul
  frio invade as bordas (vinheta azul, inversa da quente do braseiro). Distinta da vinheta
  de dano (vermelha, pontual): esta é contínua enquanto a vida estiver crítica.
- Acessibilidade: respeita "reduzir movimento/flashes" (seção 7): pulso vira estático,
  vinheta sem oscilação.

### Estado D: Braseiro disponível (sala limpa, prompt de acender)
- Resumo `[DESIGN]`: último morto caiu; o braseiro central pode ser aceso.
- Estado de HUD: `braseiro`. Vida/fagulha esmaecem; o prompt de interação entra em destaque.
- Visual `[NORMATIVO]`: o braseiro ganha um halo laranja `#FFA63D` pulsante (sinal "estou
  pronto"); selo de bronze espacial ancorado sobre ele com o glifo do botão (E / botão
  gamepad / toque) + verbo "Acender" (i18n). Aparece SÓ dentro do raio de interação e SÓ
  com a sala limpa.
- `[NORMATIVO]`: o prompt usa o mesmo botão "confirmar/interagir" de menus e diálogo, com
  glifo adaptado à plataforma (seção 6).
- Mood `[ASPIRACIONAL]`: alívio, convite, a promessa de calor.

### Estado E: Escolha de upgrade (ao acender)
- Resumo `[DESIGN]`: acender o braseiro concede uma escolha de melhoria
  (`projeto-brasa.md` 3.3): dano, alcance do golpe, vida, raio de luz/fagulha.
- Estado de HUD: `upgrade`. HUD de jogo recolhido; painel modal de escolha em foco
  (empilhado via `uiManager.push`, com foco preso, ARIA `role=dialog`, navegação por
  teclado/gamepad/toque já existentes no motor).
- Visual `[NORMATIVO]`: a sala já transicionou para o estado QUENTE (luz laranja cresceu do
  centro, ver `direcao-de-arte.md` 174). O painel é de pedra aquecida com bordas que
  pegaram a luz do braseiro (bronze aquecido `#C98A3A`). 2 a 3 cartas de upgrade lado a
  lado, cada uma com ícone (forma distinta, não só cor), nome e efeito em uma linha.
- `[NORMATIVO]`: cada carta diferenciável por forma + ícone + texto, não só por cor; item
  em foco realçado (borda laranja-brasa, o destaque quente desta tela).
- `[NORMATIVO]`: confirmar uma carta fecha o painel e DESTRAVA a porta de saída (acoplado ao
  laço de `projeto-brasa.md` 3.1.4).
- `[A DEFINIR]`: quantas cartas por braseiro e se há reroll; depende de
  [`spec-progressao-e-economia.md`](spec-progressao-e-economia.md).

### Estado F: Transição entre salas
- Resumo `[DESIGN]`: porta destravada; ao cruzá-la a sala anterior é descarregada e a
  próxima carrega (`projeto-brasa.md` 4.1).
- Estado de HUD: `cinematica` (HUD oculto). Fade curto cobre o descarte/carga da sala
  (também mascara o custo técnico da troca). O selo de profundidade pode breve ganhar um
  elo aceso na entrada da nova sala.
- `[NORMATIVO]`: nada de tela de loading com barra; o fade é parte da descida.

### Estado G: Derrota
- Resumo `[DESIGN]`: a vida da Acendedora chega a zero; a fagulha se apaga e o frio toma a
  sala.
- Visual `[NORMATIVO]`: tela esfria por completo (azul-cripta domina, dessatura total), a
  chama da fagulha apaga em foco. Título sóbrio "A fagulha apagou" (i18n) sobre pedra
  fria, sem oscilação. Botões em selos de pedra: "Tentar novamente / Sair para o título".
- `[NORMATIVO]`: retry rápido, sem fricção (sem confirmações extras para tentar de novo).
- Mood `[ASPIRACIONAL]`: melancolia, não punição; o convite é tentar de novo.

### Estado H: Fim (Brasa reacesa)
- Resumo `[DESIGN]`: o Guardião é vencido e a Brasa do fundo do poço é reacesa; fecha o
  vertical slice.
- Visual `[NORMATIVO]`: a inversão total da assinatura: o azul recua de vez, o laranja-brasa
  `#FF7A1A` invade dos limites do poço para cima (a superfície volta a aquecer). Cartão
  final de pergaminho-quente com texto de epílogo; botões "Continuar / Sair para o título".
- Mood `[ASPIRACIONAL]`: catarse quente, esperança cumprida; o pagamento emocional da
  gangorra frio-quente do jogo inteiro.

---

## 4. Estados de visibilidade do HUD (máquina de estados)

`[DESIGN]` `[NORMATIVO]` O HUD reage ao estado da sala via eventos do `eventBus`
(`projeto-brasa.md` 6.1), não por polling a cada quadro (regra de performance da seção 9).
Mapeamento estado da sala -> visibilidade dos elementos:

| Estado | Vida | Fagulha | Profundidade | Alvo | Prompt braseiro | Painel upgrade | Vinheta |
|---|---|---|---|---|---|---|---|
| penumbra | esmaecida | esmaecida | visível | oculto | oculto | oculto | inativa |
| combate | plena | plena | visível | quando lock-on | oculto | oculto | no dano |
| braseiro | esmaecida | esmaecida | visível | oculto | em destaque | oculto | inativa |
| upgrade | recolhida | recolhida | recolhida | oculto | oculto | em foco | inativa |
| cinematica | oculto | oculto | oculto | oculto | oculto | oculto | inativa |

`[DESIGN]` Reaproveita o padrão de `combatHud.setVisible()` e `hud.setVisible()` do
protótipo, estendido com os estados acima.

---

## 5. Menus

`[DESIGN]` Estética unificada de pedra-cripta e bronze patinado, fria por padrão, com o
fogo (laranja) reservado ao item em foco e a acentos vivos. Navegação por teclado, gamepad
e toque (já no `uiManager`: foco preso, setas, ponte de gamepad). Reaproveita `screens.ts`
e `theme.css` re-tematizados (ver seção 8).

### 5.1 Tela-título
- `[NORMATIVO]`: arte low-poly da boca do poço-cripta: uma escada de pedra descendo para o
  breu azul, com a fagulha como único ponto quente ao fundo (`direcao-de-arte.md` 250).
- Título "Brasa" em fonte lapidar (Cinzel), com leve brilho de brasa (emissivo sutil) na
  letra.
- Botões como selos de pedra com fechadura de bronze: "Continuar / Nova Descida / Opções /
  Idioma / Sair". Seletor PT/EN visível.
- `[NORMATIVO]`: o item em foco é o único realçado em laranja-brasa (o resto fica em bronze
  frio), reforçando "a fagulha escolhe".
- `[CÓDIGO]` `[NORMATIVO]` (implementado): a tela-título é um **diorama 3D vivo** (vitrine
  `ModelStage` na variante `backdrop`, ver 5.6): a Acendedora gira no escuro do poço à
  direita, painel de bronze à esquerda, scrim escurecendo a esquerda para legibilidade. A
  antiga arte estática de deserto (resíduo do tema de Josué) foi removida.
- `[CÓDIGO]` `[NORMATIVO]` menu evolutivo: a brasa é o ponto quente de sempre, mas a cor de
  destaque do diorama (luz de recorte + brilho do chão) INTENSIFICA de brasa-baixa (ember
  escuro) a brasa-plena (laranja-ouro) conforme o progresso da campanha (`descentAccent` em
  `screens.ts`), refletindo a Brasa reacesa sem pedir input e sem perder a assinatura quente.
  Atende à tendência de "menus que reagem ao progresso" das franquias campeãs.
- `[CÓDIGO]` `[NORMATIVO]` modelo: o diorama usa um **modelo próprio da Acendedora**
  (`/models/acendedora.glb`, gerado no Tripo e limpo no Blender), não mais o KayKit Mage
  genérico. Estático (sem rig), o que basta para a vitrine (a câmera é que orbita). O herói
  EM JOGO segue no KayKit Mage rigado até existir uma Acendedora riggada (ver
  `personagens.md` 1.2). Há, portanto, uma diferença temporária entre a Acendedora dos
  menus e a do jogo, assumida como passo intermediário.
- `[CÓDIGO]` `[NORMATIVO]` áudio: a tela-título tem um **ambiente procedural de brasa**
  (`titleAmbience.ts`, WebAudio, sem asset): drone grave quente com respiração (LFO) e
  estalos de ember, gated pelo volume de música (master x música) e lido ao vivo. Toca no
  fluxo de título (boot e ao voltar ao título), para quando o jogo começa, e respeita a
  política de autoplay (entra após o primeiro gesto). Fecha o gap de "tela-título muda".

### 5.2 Menu de pausa
- `[NORMATIVO]`: overlay que escurece e ESFRIA a cena (azulado, "o frio espreita enquanto
  você para"); HUD de jogo oculto enquanto pausado.
- `[CÓDIGO]` `[NORMATIVO]` (implementado): pausa ENXUTA, 4 itens, fiel ao "less is more"
  soulslike: **Retomar · Crônica · Opções · Sair para o título**, com o objetivo da descida
  como contexto no topo (`currentObjective`). Antes tinha 8 itens; foram removidos da pausa:
  Mapa e Perfil (já no HUD de jogo, eram caminho duplicado), Salvar/Carregar (o jogo
  autossalva no braseiro; gerenciar slots no meio da descida é anti-gênero, e Carregar segue
  na tela-título) e Diário/quest log (o telão de progresso é a própria descida, 2.1/2.3).
  Trimar a pausa não removeu nenhuma feature; só tirou dali o redundante ou off-genre.

### 5.3 Opções (abas)
- `[NORMATIVO]`: abas Áudio, Controles, Gráficos, Idioma, Acessibilidade (mesma estrutura de
  `screens.ts`).
- **Áudio:** geral, música, efeitos. `[A DEFINIR]` voz, se houver narração.
- **Controles:** remapeamento completo de teclado e gamepad; alternância toggle vs hold
  (ex.: bloqueio, lock-on). Reaproveita as ações já tipadas em `strings.ts`
  (acFrente, acAtaque, acPesado, acEsquiva, acBloqueio, acLockon) mais "Interagir/Acender".
- **Gráficos:** qualidade (baixo/médio/alto), resolução de render, escala de UI, limite de
  FPS. Crítico para o pilar "rodar leve no navegador" (`projeto-brasa.md` 2).
- **Idioma:** PT/EN com troca em runtime (já funcional via `strings.ts`/`setLanguage`).
- **Acessibilidade:** ver seção 7.

### 5.4 Derrota / Fim
- Ver estados G e H da seção 3. Telas sóbrias, retry rápido, sem fricção.

### 5.5 Herança de Josué (o que foi descartado e o que foi retomado)
- `[DESIGN]` `[NORMATIVO]`: NÃO trazer o **conteúdo** bíblico de Josué (Mapa da Conquista,
  lore/Codex de Jericó, objetivos da campanha bíblica). O telão de progressão de Brasa é a
  descida (seção 2.3) e o upgrade ao acender (estado E).
- `[CÓDIGO]` `[NORMATIVO]`: as **telas** Crônica (Codex), Perfil, Mapa da Descida e criação
  de personagem (Nova Descida) foram retomadas no protótipo de Brasa com conteúdo próprio
  (`codex.ts`, `campaign.ts`, `character.ts`) e estão no fluxo (`main.ts`: menu/pausa as
  abrem). A nota antiga de "ficam fora do fluxo" está superada pelo código atual.
- `[NORMATIVO]`: a criação de personagem de Brasa é cosmética/sabor (nome, cor do manto, dom
  inicial, dificuldade); sem atributos mecânicos por ora (`character.ts`).

### 5.6 Vitrine 3D em menus (nicho iluminado)
`[CÓDIGO]` `[NORMATIVO]` Padrão reutilizável para dar peso de jogo aos menus: um "nicho
iluminado" que mostra um modelo (personagem ou prop) girando dentro do overlay HTML.
Implementado em `src/game/ui/modelStage.ts` (`ModelStage`).

- `[NORMATIVO]` Isolamento: a vitrine roda num **Engine WebGL2 próprio** num `<canvas>`
  próprio, separada da cena/física do jogo. Não disputa câmera, luz nem física com o mundo.
- `[NORMATIVO]` Ciclo de vida preso à tela: a tela chama `stage.start()` no `onShow` e
  `stage.dispose()` no `onHide` (devolve o contexto WebGL). Nada renderiza depois de fechar.
- `[NORMATIVO]` Normalização: o glb é centrado na origem e escalado para caber; serve para
  qualquer modelo. Personagem rigado toca a animação `idle`; prop estático só gira.
- `[NORMATIVO]` Interação: auto-rotação lenta + arrastar para girar (órbita `ArcRotateCamera`,
  sem pan). Respeita "reduzir movimento" (desliga a auto-rotação; ver seção 7).
- `[NORMATIVO]` Cor de destaque (`setAccent`): a luz de recorte e o brilho do chão do nicho
  assumem uma cor por contexto. Na criação de personagem, escolher um manto banha a
  Acendedora na cor do manto ao vivo (a malha do KayKit usa um atlas único, então tingimos
  a LUZ do nicho, não a malha).
- `[NORMATIVO]` Iluminação assinatura: chave quente de brasa (âmbar) sempre presente +
  preenchimento frio + recorte na cor de destaque, coerente com a paleta laranja x azul.
- `[NORMATIVO]` Robustez: se o modelo falhar ao carregar, o nicho se esconde (sem caixa
  preta). Custo: um contexto WebGL extra só enquanto a tela está aberta.

Usos atuais `[CÓDIGO]`:
- **Crônica (Codex):** verbetes de personagem abrem em duas colunas (modelo girando + texto).
  Mapa em `codex.ts` (campo `model`): Acendedora -> `acendedora.glb` (modelo próprio);
  Acendedoras anteriores -> `Rogue_Hooded.glb`; Guardião -> `Skeleton_Warrior.glb`;
  despertar dos mortos -> `Skeleton_Minion.glb`. Verbetes sem modelo seguem em coluna única.
  Conteúdo enriquecido (10 verbetes, voz em 1a pessoa nas inscrições), atendendo ao gap de
  "codex raso" do estudo.
- **Criação de personagem (Nova Descida):** a Acendedora (`acendedora.glb`) na vitrine à
  esquerda, o formulário à direita; o manto escolhido tinge o nicho ao vivo.

- **Tela-título (Nova Descida):** diorama de fundo na variante `backdrop` (ver 5.1), a
  Acendedora girando à direita atrás do painel; cor evolui com o progresso.

Próximos usos `[ASPIRACIONAL]`: inspeção de upgrades no estado E; props do `dungeon_kit`
nos verbetes de lugares/relatos da Crônica; selos por categoria já distinguem os verbetes
(personagem/lugar/relato) na lista da Crônica.

DoD (aceite) `[NORMATIVO]`:
- Abrir um verbete de personagem na Crônica mostra o modelo girando ao lado do texto; voltar
  descarta a vitrine (sem vazar contexto WebGL nem loop de render).
- Na criação, trocar o manto recolore o nicho imediatamente; o modelo padrão carrega ou o
  nicho some sem deixar caixa preta.
- Com "reduzir movimento" ligado, não há auto-rotação (o arrastar continua disponível).
- Build (`tsc` + `vite build`) verde; paridade de chaves i18n mantida (`arrasteParaGirar`).

---

## 6. Tipografia e ícones

`[CÓDIGO]` `[NORMATIVO]` Fontes já self-hosted no protótipo (`fonts.ts`, sem CDN, funciona
offline): **Cinzel** (display/títulos lapidares, inscrição em pedra) + **EB Garamond**
(corpo serifado). O pareamento Cinzel + serifada serve ao tom mítico/melancólico de Brasa
melhor que uma sans; mantemos.
- `[NORMATIVO]`: corpo escalável até 200% (ver seção 7); contorno/sombra sobre fundos
  texturizados (a pedra tem ruído); contraste suficiente texto x fundo, inclusive sobre o
  azul-cripta escuro.
- `[ASPIRACIONAL]`: hierarquia de tamanho clara (título de tela > rótulo > corpo > legenda).
- `[NORMATIVO]`: ícones com 1 peso de traço, legíveis a 24-32 px, estilo low-poly/lapidar
  coerente com o KayKit. Conjuntos: recursos (chama/fagulha, gota de vida), verbos
  (acender, atacar, esquivar, bloquear, mirar), upgrades (lâmina = dano, alcance, gota =
  vida, halo = raio de luz), sistema (salvar, opções, áudio, idioma).
- `[NORMATIVO]`: nunca depender só de cor para diferenciar (forma + ícone + texto), em
  especial laranja x ciano x vermelho, que viram problema no daltonismo.
- `[NORMATIVO]`: 100% dos textos fora do código (i18n PT/EN via `strings.ts`), com paridade
  de chaves garantida em build (o tipo `Record<StringKey>` já força isso); caixas/botões
  com folga e quebra de linha, nunca largura fixa para texto (EN x PT variam).

---

## 7. Acessibilidade

`[DESIGN]` `[NORMATIVO]` As quatro maiores demandas, herdadas do padrão: remapeamento,
tamanho de texto, daltonismo e apresentação de legendas. Brasa tem um risco específico: a
mecânica visual depende de cor (laranja = fogo/seguro-acionável, ciano = ameaça morta,
azul = frio/perigo de vida). Isto EXIGE redundância de forma.
- `[NORMATIVO]`: tamanho de fonte ajustável até 200% (HUD, menus, legendas). Escala de UI
  já implementada em `uiManager.setUiScale` (usa `zoom`, reflui sem quebrar layout).
- `[NORMATIVO]`: daltonismo coberto por forma + ícone + texto, não só cor; 3 modos
  (protanopia/deuteranopia/tritanopia) + alto contraste (`uiManager.setHighContrast` já
  existe), afetando UI E os tells de combate (cor dos olhos/runas dos mortos, retículo do
  alvo, halo do braseiro). O braseiro disponível também pulsa (movimento) e ganha glifo,
  não conta só com o laranja; a ameaça dos mortos também tem forma/silhueta, não só ciano.
- `[NORMATIVO]`: legendas/CC, se houver áudio diegético (sussurros dos mortos, narração),
  com fonte legível, alto contraste, contorno/sombra, fundo escuro togglável, indicação de
  quem fala, tamanho ajustável. `[A DEFINIR]`: se Brasa tem fala/narração (depende de
  [`narrativa-e-historia.md`](narrativa-e-historia.md)); se for só ambiência, legendar os
  sons-chave (porta selando, mortos despertando, braseiro acendendo).
- `[NORMATIVO]`: remapeamento total de teclado e gamepad, presets, toggle vs hold (seção
  5.3); jogar com uma mão quando viável.
- `[NORMATIVO]`: assistências: reduzir movimento (`uiManager.setReducedMotion` já existe;
  desliga shake da câmera, pulso da vida crítica, oscilação de vinhetas), reduzir flashes
  (o acender do braseiro é o maior flash do jogo: oferecer versão sem clarão, transição
  suave de cor), e modo história / dano reduzido. `[A DEFINIR]` a curva exata do modo
  história.

---

## 8. Estética da UI casada com a direção de arte (re-tema do theme.css)

`[CÓDIGO]` `[DESIGN]` `[NORMATIVO]` O `theme.css` do protótipo é todo quente (argila,
areia, ouro, bronze: `--areia #e8dcc0`, `--ouro #e7bd71`, `--bronze #b5793a`). Brasa
INVERTE a temperatura-base para frio e reserva o quente ao fogo. Re-tematizar as variáveis
CSS para a paleta de `direcao-de-arte.md` 2.1:

| Token (novo) | HEX | Papel na UI |
|---|---|---|
| `--cripta` | `#0E1A2B` | fundo de painel mais profundo, overlay de pausa |
| `--ardosia` | `#1F3247` | painel de pedra, fundo de barra |
| `--aco-frio` | `#3E5C7E` | borda fria, preenchimento de realce neutro |
| `--ciano-espectral` | `#5FB7C9` | ameaça dos mortos: retículo de alvo, runas (NUNCA acionável-positivo) |
| `--brasa-nucleo` | `#FF7A1A` | fogo, item em foco, prompt de acender (o quente reservado) |
| `--ambar` | `#FFA63D` | medidor de fagulha cheio, halo do braseiro |
| `--ouro-fagulha` | `#FFD27A` | realce/partícula, ponta da chama |
| `--vermelho-tico` | `#C8401C` | vida, brasa esfriando, base de barra de vida |
| `--bronze-patina` | `#7A5A2E` | molduras, fechaduras, detalhe antigo (bronze FRIO, apagado) |
| `--bronze-aquecido` | `#C98A3A` | borda que pegou a luz do braseiro (só no estado quente) |
| `--osso` | `#D8CFB8` | texto claro sobre pedra |
| `--perigo` | `#6E1B16` | sangue-seco, vinheta de dano |

`[NORMATIVO]`: a regra da gangorra vale na UI: em telas/estados frios (penumbra, pausa,
derrota), o laranja só aparece no item em foco ou na fagulha; em telas/estados quentes
(upgrade, fim), o azul recua para sombra. `[NORMATIVO]`: emissivo/brilho na UI restrito a
fogo, fagulha, prompt de acender e item em foco; nunca em ornamento (coerente com
`direcao-de-arte.md` 222-224).

---

## 9. Responsivo, plataforma e toque

`[DESIGN]` `[NORMATIVO]` Mobile importa (`projeto-brasa.md`): o jogo roda no navegador e o
toque é alvo de primeira classe.
- `[NORMATIVO]`: layout adaptativo desktop x web mobile; em mobile, prioridade a clareza e
  toque. O HUD frio e enxuto (vida + fagulha + profundidade) cabe bem em tela pequena
  justamente por não ter minimapa nem objetivo de campanha.
- `[NORMATIVO]`: controles de toque: joystick virtual à esquerda; botões de ação à direita
  (atacar, esquivar, bloquear, mirar); alvos de toque grandes (~44-48 px). O prompt de
  acender o braseiro vira um botão tocável grande sobre/perto do braseiro.
- `[NORMATIVO]`: escala de UI ajustável pelo usuário (75-150%) + escala automática por
  resolução (`uiManager.setUiScale`).
- `[NORMATIVO]`: área segura respeitada (notch/cantos); nada vital colado nas bordas
  (a vida no canto inferior-esquerdo respeita inset).
- `[ASPIRACIONAL]`: em mobile, considerar mover o medidor de fagulha para perto do polegar
  se virar recurso ativo (depende do `[A DEFINIR]` da seção 2.2).

---

## 10. Implementação no Babylon (reúso do motor)

`[CÓDIGO]` `[NORMATIVO]` Mantém a arquitetura validada do protótipo (decisão da spec de
Josué seção 9, já implementada):
- HUD não-diegético, menus e telas em **overlay HTML/CSS** sobre o canvas (`uiManager.ts`:
  `ui-root` fixo, camadas `ui-hud` persistente e `ui-screens` para modais; `el()` helper;
  foco preso, ARIA, gamepad). Melhor para texto, i18n, acessibilidade e responsivo.
- `[NORMATIVO]`: prompt de braseiro, retículo de alvo e barra de vida 3D do morto são
  **espaciais**, ancorados ao mundo via Babylon GUI `linkWithMesh` ou projeção 3D->2D para
  um layer HTML pequeno; limitar `CreateForMesh` (custo em iPhone).
- `[NORMATIVO]`: HUD atualizado por estado (evento do `eventBus` / diff), não a cada quadro
  (`hud.ts`/`combatHud.ts` já fazem diff: `last`, `lastHealth`, `lastStamina`). Reaproveitar
  atlas de ícones; pool de marcadores espaciais. Coerente com o teto de leveza do canon.
- `[NORMATIVO]`: o medidor de fagulha lê o MESMO valor que alimenta o halo de luz da
  Acendedora no mundo (acoplamento diegético da seção 2.2), via eventBus, sem dupla fonte
  de verdade.

---

## 11. Setup de UI mínimo para o vertical slice

`[DESIGN]` Ordem coerente com o roadmap de `projeto-brasa.md` 7:
1. HUD de vida (re-vestir `combatHud` para a placa de pedra fria, canto inferior-esquerdo).
2. Medidor de fagulha ao lado da vida (chama laranja, único quente).
3. Indicador de profundidade no topo (selo vertical "Câmara N de M").
4. Prompt de acender o braseiro (espacial, selo de bronze ancorado ao braseiro, só com sala
   limpa).
5. Retículo de alvo + barra de vida 3D do morto (de `combatTarget`/`healthBar3d`).
6. Painel de escolha de upgrade ao acender (modal via `uiManager.push`).
7. Telas de derrota e fim (sóbrias, retry rápido / catarse quente).
Fora do escopo inicial: legendas (se não houver fala), 3 modos completos de daltonismo
(começar com alto contraste), opções gráficas finas (começar com qualidade baixo/médio/alto
e escala de UI).

---

## Checklist de aceite (Definition of Done)

HUD de jogo (seção 2)
- [ ] Os cinco estados de visibilidade existem e se comportam conforme a tabela da seção 4: penumbra, combate, braseiro, upgrade, cinematica. [DESIGN][NORMATIVO]
- [ ] Vida da Acendedora renderizada como placa de pedra com bronze patinado no canto inferior-esquerdo; vermelho-tiço; persistente em combate, esmaecida na penumbra. [DESIGN][NORMATIVO]
- [ ] Medidor da fagulha presente ao lado da vida, em forma de chama/braseiro, é o ÚNICO elemento laranja do HUD. [DESIGN][NORMATIVO]
- [ ] Indicador de sala/profundidade no topo (selo vertical "Câmara N de M"), recolhível, com elos acesos por braseiro conquistado. [DESIGN][NORMATIVO]
- [ ] Prompt de interação do braseiro aparece só com a sala limpa e dentro do raio, ancorado ao braseiro, com glifo do botão + verbo "Acender" e halo laranja. [DESIGN][NORMATIVO]
- [ ] Alvo de combate (lock-on) mostra retículo ciano e barra de vida 3D do morto focado, com clamp na borda e troca de alvo. [DESIGN][NORMATIVO]
- [ ] Feedback de dano por vinheta vermelho-tiço + leve shake no impacto, sem números de dano flutuantes. [DESIGN][NORMATIVO]
- [ ] Sem minimapa, sem bússola, sem objetivo de campanha de Josué, sem medidor de XP sempre visível. [DESIGN][NORMATIVO]

Estados de UI (seção 3)
- [ ] Penumbra: HUD esmaecido, dominância azul, fagulha como único quente. [DESIGN][NORMATIVO]
- [ ] Combate: HUD pleno, olhos/runas e retículo em ciano, vinheta no dano. [DESIGN][NORMATIVO]
- [ ] Vida crítica: tela esfria/dessatura com vinheta azul contínua, distinta da vinheta vermelha de dano, e respeita reduzir movimento/flashes. [DESIGN][NORMATIVO]
- [ ] Braseiro disponível: prompt de acender em destaque, vida/fagulha esmaecidas, halo laranja pulsante no braseiro. [DESIGN][NORMATIVO]
- [ ] Escolha de upgrade: painel modal com a sala já no estado quente; cartas diferenciáveis por forma+ícone+texto; confirmar destrava a porta. [DESIGN][NORMATIVO]
- [ ] Transição entre salas: HUD oculto, fade cobre descarte/carga; sem barra de loading. [DESIGN][NORMATIVO]
- [ ] Derrota: tela esfria, fagulha apaga, "Tentar novamente / Sair para o título" sem fricção. [DESIGN][NORMATIVO]
- [ ] Fim: inversão para laranja-brasa, epílogo, "Continuar / Sair para o título". [DESIGN][NORMATIVO]

Menus (seção 5)
- [ ] Tela-título com arte do poço, botões em selos de pedra (Continuar / Nova Descida / Opções / Idioma / Sair), título em Cinzel e seletor PT/EN visível; só o item em foco realçado em laranja. [DESIGN][NORMATIVO]
- [ ] Menu de pausa com overlay que escurece e esfria a cena, painel de pedra (Retomar / Opções / Sair para o título) e HUD oculto. [DESIGN][NORMATIVO]
- [ ] Opções em abas: Áudio, Controles, Gráficos, Idioma, Acessibilidade. [DESIGN][NORMATIVO]
- [ ] Aba Controles oferece remapeamento completo de teclado e gamepad e toggle vs hold, incluindo "Acender/Interagir". [DESIGN][NORMATIVO]
- [ ] Aba Gráficos expõe qualidade, resolução de render, escala de UI e limite de FPS. [DESIGN][NORMATIVO]
- [ ] Nenhuma tela específica de Josué (Mapa, Crônica/Codex, Diário, Nova Jornada, perfil de pontos) entra no fluxo de Brasa. [DESIGN][NORMATIVO]

Tipografia e ícones (seção 6)
- [ ] Pareamento Cinzel (display) + EB Garamond (corpo), self-hosted, sem CDN. [CÓDIGO][NORMATIVO]
- [ ] Texto de corpo escalável até 200% com contorno/sombra sobre pedra e contraste suficiente sobre azul-cripta. [DESIGN][NORMATIVO]
- [ ] Ícones com 1 peso de traço, legíveis a 24-32 px, no idioma low-poly/lapidar. [DESIGN][NORMATIVO]
- [ ] Nenhuma informação depende só de cor (laranja/ciano/vermelho redundados por forma+ícone+texto). [DESIGN][NORMATIVO]
- [ ] 100% dos textos fora do código (i18n PT/EN), com folga e quebra de linha, sem largura fixa. [CÓDIGO][NORMATIVO]

Acessibilidade (seção 7)
- [ ] Tamanho de fonte/escala de UI ajustável até 200% em HUD, menus e legendas. [DESIGN][NORMATIVO]
- [ ] Daltonismo coberto por forma+ícone+texto, com 3 modos + alto contraste, afetando UI e tells de combate (olhos/runas, retículo, halo do braseiro). [DESIGN][NORMATIVO]
- [ ] Legendas/CC (se houver áudio diegético) com indicação de quem fala, alto contraste, contorno/sombra, fundo escuro togglável e tamanho ajustável. [DESIGN][NORMATIVO]
- [ ] Remapeamento total de teclado e gamepad, presets e toggle vs hold. [DESIGN][NORMATIVO]
- [ ] Assistências: reduzir movimento, reduzir flashes (incl. versão suave do acender do braseiro), modo história/dano reduzido. [DESIGN][NORMATIVO]

Estética casada com a direção de arte (seção 8)
- [ ] theme.css re-tematizado para a paleta fria-base de direcao-de-arte.md 2.1, com o laranja reservado ao fogo/foco. [DESIGN][NORMATIVO]
- [ ] Regra da gangorra respeitada na UI: laranja só no foco/fagulha em estados frios; azul recua em estados quentes. [DESIGN][NORMATIVO]
- [ ] Emissivo/brilho na UI restrito a fogo, fagulha, prompt de acender e item em foco. [DESIGN][NORMATIVO]

Responsivo e plataforma (seção 9)
- [ ] Layout adaptativo desktop x web mobile, com prioridade a clareza e toque em mobile. [DESIGN][NORMATIVO]
- [ ] Toque com joystick virtual à esquerda, botões de ação à direita, alvos de ~44-48 px; prompt de acender vira botão tocável. [DESIGN][NORMATIVO]
- [ ] Escala de UI ajustável (75-150%) + escala automática por resolução. [DESIGN][NORMATIVO]
- [ ] Área segura respeitada; nada vital colado nas bordas. [DESIGN][NORMATIVO]

Implementação no Babylon (seção 10)
- [ ] HUD não-diegético, menus e telas em overlay HTML/CSS (uiManager); sem DIV fullscreen permanente. [CÓDIGO][NORMATIVO]
- [ ] Prompt de braseiro, retículo e barra de vida do morto espaciais via linkWithMesh ou projeção 3D->2D, limitando CreateForMesh. [CÓDIGO][NORMATIVO]
- [ ] HUD atualizado por estado (eventBus/diff), não a cada quadro; atlas de ícones e pool de marcadores reaproveitados. [CÓDIGO][NORMATIVO]
- [ ] Medidor de fagulha e halo de luz da Acendedora leem a mesma fonte de valor (acoplamento diegético). [DESIGN][NORMATIVO]

Setup mínimo do vertical slice (seção 11)
- [ ] HUD de vida (placa de pedra fria) presente. [DESIGN][NORMATIVO]
- [ ] Medidor de fagulha presente. [DESIGN][NORMATIVO]
- [ ] Indicador de profundidade presente. [DESIGN][NORMATIVO]
- [ ] Prompt de acender o braseiro presente (espacial, só com sala limpa). [DESIGN][NORMATIVO]
- [ ] Painel de escolha de upgrade ao acender presente. [DESIGN][NORMATIVO]
- [ ] Telas de derrota e fim presentes. [DESIGN][NORMATIVO]

Transversais (padrão de detalhe, seção 4)
- [ ] Sem travessões, sem emojis em qualquer texto exibido (guia de estilo 1.2). [NORMATIVO]
- [ ] Itens [A DEFINIR] resolvidos ou explicitamente adiados com registro. [NORMATIVO]

Pendências [A DEFINIR]
- [ ] Verbo exato da fagulha como recurso (mana de fogo / gasto para acender / raio de luz / narrativo), alinhado com spec-progressao-e-economia e game-design-e-sistemas (seção 2.2). [DESIGN][A DEFINIR]
- [ ] Total de câmaras (M) revelado desde o início ou descoberto andar a andar (seção 2.3; proposta: revelar). [DESIGN][A DEFINIR]
- [ ] Quantas cartas de upgrade por braseiro e se há reroll (seção 3 estado E). [DESIGN][A DEFINIR]
- [ ] Se Brasa tem fala/narração que exija legendas, ou só ambiência a legendar (seção 7). [DESIGN][A DEFINIR]
- [ ] Curva exata do modo história / dano reduzido (seção 7). [DESIGN][A DEFINIR]
- [ ] Posição do medidor de fagulha em mobile se virar recurso ativo (seção 9). [DESIGN][A DEFINIR]

## Fontes e referências internas
- Canon e laço de jogo: [`projeto-brasa.md`](../projeto-brasa.md) (premissa, 3.1 laço, 4 orçamento, 6 motor).
- Paleta HEX, assinatura frio-quente, fagulha como luz: [`direcao-de-arte.md`](direcao-de-arte.md) 2, 7.
- Régua de detalhe e DoD: [`padrao-de-detalhe.md`](../padrao-de-detalhe.md).
- Spec análoga (estrutura herdada): `docs/spec-ui-hud-ux.md` (era Josué).
- Código reaproveitado: `prototipo/src/engine/ui/uiManager.ts`, `prototipo/src/game/ui/{hud,combatHud,screens,strings,fonts}.ts` e `theme.css`.
</content>
</invoke>
