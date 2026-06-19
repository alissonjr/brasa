# Spec de Estilo Visual e Pipeline de Render (toon/tinta + profundidade)

Especificação NORMATIVA do pipeline de render estilizado da **Brasa** e do pacote de
profundidade que o acompanha. Nasce da análise do jogo de referência **Messenger**
(abeto.co, Three.js): um globo-miniatura de entregas cuja sensação de "feito a mão e
profundo" vem de uma PILHA de técnicas (contorno de tinta + cel/toon + SSAO + textura de
papel + dither + fog coeso) somada a MUITO polimento (tween em tudo) e a um verbo central
forte. Esta spec traz essas TÉCNICAS e esse NÍVEL DE CAPRICHO para a Brasa, **sem copiar a
paleta nem o clima cozy** do Messenger: tudo serve ao mood já definido (frio-azul x
brasa-laranja, `direcao-de-arte.md`).

Fonte de verdade de mood e cor: [`direcao-de-arte.md`](direcao-de-arte.md) prevalece. VFX e
shaders: [`biblia-vfx-e-shaders.md`](biblia-vfx-e-shaders.md). Iluminação:
[`biblia-iluminacao.md`](biblia-iluminacao.md). Orçamento e DoD:
[`../padrao-de-detalhe.md`](../padrao-de-detalhe.md). Números de cena observados procedem do
código (`[CÓDIGO]`) e, em conflito, vale o código atual (`setupCryptScene` em
`prototipo/src/game/scenes/crypt/cryptRoom.ts`).

Convenção: pt-BR, sem travessões, sem emojis. PROCEDÊNCIA: `[DESIGN]` (criação nossa),
`[CÓDIGO]` (observado no protótipo), `[REF]` (procede da análise do Messenger). EXIGÊNCIA:
`[NORMATIVO]` (entra no aceite, verificável), `[ASPIRACIONAL]` (mood/intenção),
`[A DEFINIR]` (pendente de decisão autoral).

Snapshot: 2026-06-18.

---

## 0. Propósito (o que o jogo precisa passar a SENTIR)

`[DESIGN]` `[REF]` Hoje a Brasa renderiza low-poly com luz quente, glow, fog, sombra PCF,
vinheta e grão (`[CÓDIGO]` `setupCryptScene`). É competente, mas "cru de motor": leitura
plana, sem traço autoral, sem profundidade de contato. O Messenger prova que um look
autoral em WebGL não exige assets caros, e sim uma PILHA coesa de técnicas baratas. Três
sensações-alvo:

1. `[DESIGN]` **Traço de tinta.** Tudo que importa (atores, chefe, props-chave) ganha
   contorno escuro legível, como ilustração. A silhueta vira a leitura primária, o que casa
   com o princípio de combate ("silhueta clara -> dá para ler o tell").
2. `[DESIGN]` **Preenchimento toon.** A luz da cena cai em FAIXAS (cel), não em gradiente
   contínuo. A pedra, a madeira e o cenário ficam "pintados", não plásticos.
3. `[DESIGN]` **Profundidade de contato.** SSAO + dither + papel dão volume, aterramento e
   textura, tirando o aspecto de "preview de visualizador glTF".

`[DESIGN]` Antipadrões a evitar: virar cozy/menta (é o oposto do tom); contorno que pisca/
serrilha; toon que apaga a gangorra frio-quente; perder o feedback de combate (flash,
telegrafia vermelha, reacender) ao mexer nos materiais; estourar o orçamento de draw calls
e de fps. A regra de ouro: **nenhuma mudança estética pode degradar a LEITURA de combate.**

---

## 1. Princípios `[NORMATIVO]`

`[DESIGN]`
- **Engine-agnóstico onde der.** O motor roda WebGPU OU WebGL2 (`createEngine.ts`,
  fallback automático). Técnicas que dependem de shader escrito a mão (GLSL) só são
  garantidas em WebGL2; ver §2.3 (política de degradação). Tudo que usa material/efeito de
  biblioteca (CellMaterial, SSAO2, inverted-hull, ImageProcessing) funciona nos dois.
- **Camadas respeitadas.** Tudo genérico (pipeline, outline, toon, finishing, tween) vive em
  `src/engine/rendering` (ou `src/engine/core` p/ o tween) e é exportado pelo barrel
  `@engine`. `game/` apenas WIRA (decide cor, quais malhas, quando). `engine/` nunca importa
  de `game/`.
- **Feedback de combate intocável.** Atores (herói, esqueletos, Guardião, dummy) mantêm
  `StandardMaterial` para preservar o `emissiveColor` por frame (flash, telegrafia
  inquebrável, reacender, frost). O look toon deles vem de OUTLINE + rim + flatten + passe
  de finalização, NUNCA de trocar o material por um sem emissivo. Ver §4.1.
- **Tudo descartável.** Cada efeito por sala/ator é rastreado e liberado no dispose (mesmo
  contrato de `cryptRoom`/atores hoje).

---

## 2. Stack: atual, alvo e política de engine

### 2.1 Atual `[CÓDIGO]`
`DefaultRenderingPipeline` (FXAA on; bloom off; vinheta; grão animado; toneMapping off;
contrast 1.12; exposure 1.05), `GlowLayer` (intensity 0.85), fog EXP2, `ShadowGenerator`
PCF 2048, 2 luzes (Hemispheric + Directional). Materiais glTF (Standard/PBR) + Standard
procedurais (chamas, feixe, decalques, projéteis, dummy). Sem SSAO, sem outline, sem toon,
sem shaders custom, sem Draco/KTX2.

### 2.2 Alvo
Pilha estilizada coesa, ligada UMA vez e parametrizada pela cena: CellMaterial no MUNDO +
inverted-hull nos ATORES/props-chave + SSAO2 + passe de finalização (papel + dither +
posterize leve) + edge-detect de cena + juice por tween + áudio adaptativo. Tudo dentro do
orçamento (§5).

### 2.3 Política WebGPU x WebGL2 `[NORMATIVO]`
`[DESIGN]` Os passes que dependem de GLSL escrito a mão (finalização papel/dither, §4.2;
edge-detect de cena, §4.3) são autorados em GLSL e LIGADOS apenas quando o passe compila no
backend ativo. Em WebGPU, se o passe custom não puder rodar, ele é PULADO com aviso em
console, e o restante (CellMaterial + inverted-hull + SSAO2 + grão/vinheta nativos) continua
valendo. Resultado: WebGPU recebe a base toon coesa; WebGL2 recebe a pilha completa. A
detecção é por `engine.isWebGPU` (ou compilação protegida por try/catch). NUNCA quebrar a
tela: na dúvida, pula o passe.

---

## 3. Arquitetura (módulos novos) `[NORMATIVO]`

`[DESIGN]` Novos arquivos em `engine/` (genéricos), exportados por `@engine`:
- `engine/rendering/toon.ts`: `toonifyHierarchy(root, opts)` e `toonifyMesh(mesh, opts)` -
  troca `StandardMaterial`/`PBRMaterial` por `CellMaterial` preservando textura (albedo/
  diffuse), cor-base e flags (backFaceCulling). Usa `@babylonjs/materials` (dep nova).
- `engine/rendering/outline.ts`: `addInvertedHullOutline(mesh, opts)` (clone preto, casca
  invertida, unlit, renderingGroup atrás) e `outlineHierarchy(root, opts)`; `disposeOutline`.
- `engine/rendering/ssao.ts`: `enableSsao(scene, camera, opts)` encapsulando
  `SSAO2RenderingPipeline` com presets low-poly.
- `engine/rendering/finishingPass.ts`: `addFinishingPass(camera, opts)` - PostProcess GLSL
  com papel (textura tileável), dither ordenado (Bayer 4x4) e posterize leve; degrada por §2.3.
- `engine/rendering/sceneOutline.ts`: `addSceneOutline(scene, camera, opts)` - edge-detect
  full-screen (Sobel sobre profundidade + normal via `GeometryBufferRenderer`); degrada por §2.3.
- `engine/rendering/stylized.ts`: `setupStylized(scene, camera, opts)` - ORQUESTRADOR que
  liga SSAO + finishing + sceneOutline na ordem certa e devolve handles + dispose. É o ponto
  único que `game/` chama.
- `engine/core/tween.ts`: `Tweens` (gerenciador mínimo: `to(obj, props, ms, easing)`,
  `update(dt)`) + easings. Genérico, sem libs externas.

Dep nova: `@babylonjs/materials` (somente CellMaterial é importado; tree-shake mantém leve).

---

## 4. Os quatro blocos

### 4.1 Bloco 1 - "a cara nova": toon + tinta + AO `[NORMATIVO]`

`[DESIGN]` A transformação de leitura. Três peças:

**(a) CellMaterial no MUNDO.** `toonifyHierarchy` aplicado às malhas estáticas do cenário
(piso, paredes, teto via `kitBase`; props via `propBase`/`placeProp`). Converte para
`CellMaterial` preservando a textura-atlas do KayKit (lê `diffuseTexture`/`albedoTexture` e
`diffuseColor`/`albedoColor`), `computeHighLevel = true` (faixas mais suaves),
`receiveShadows` mantido. NÃO toca: chamas, feixe, decalques e projéteis (emissivos
`disableLighting`, devem brilhar liso) nem ATORES (emissivo de combate, ver (b)).

**(b) Inverted-hull nos ATORES e props-chave.** `outlineHierarchy` no herói, esqueletos,
Guardião e dummy (e em props de silhueta forte se couber no orçamento). Casca: clone das
malhas, `CellMaterial`/`StandardMaterial` preto unlit, `backFaceCulling = false`, escala
~1.02-1.05 ao longo do volume, `renderingGroupId` atrás do original. Espessura `[A DEFINIR]`
por playtest (proposta 0.03-0.05 do tamanho). O outline ACOMPANHA o ator (mesmo parent/
transform). Atores seguem em `StandardMaterial`: flatten via `specularColor` preto (já o caso
em vários) para a luz cair quase chapada, somando ao outline a leitura toon, SEM perder o
emissivo. Rim opcional via `emissiveFresnelParameters` (leitura no breu).

**(c) SSAO2.** `enableSsao` com preset low-poly (radius ~1.2-2.0, totalStrength ~1.0-1.3,
samples moderados, blur on). Aterra atores e props, dá volume à pedra. `[ASPIRACIONAL]` o AO
deve "desenhar" os cantos da cripta sem sujar a cena.

`[NORMATIVO]` Aceite do Bloco 1: cenário em faixas toon; herói/esqueletos/Guardião com
contorno escuro legível em movimento; AO visível nos contatos; feedback de combate (flash/
telegrafia/reacender) intacto; frio-quente preservado.

### 4.2 Bloco 2 - textura e juice `[NORMATIVO]`

`[DESIGN]` **(a) Passe de finalização** (`addFinishingPass`): papel tileável em multiply
suave (tira o "plástico"), dither ordenado Bayer 4x4 (quebra banding nos gradientes de fog/
breu de forma estilizada) e posterize leve do resultado (poucos passos, "impresso"). Liga
DEPOIS do pipeline atual (grão/vinheta permanecem). Degrada por §2.3. Intensidades
`[A DEFINIR]` por playtest (papel alpha ~0.12-0.2; posterize ~16-24 níveis).

**(b) Juice por tween** (`engine/core/tween.ts`), ligado no `game/`:
- Acender da Brasa: easing (easeOutCubic) na virada frio->quente e um "pop" de escala no
  braseiro ao subir de estágio.
- Câmera de combate: leve push-in no lock-on e kick no hit (somado ao hitStop existente).
- Drops/essências/pickups: spawn com scale-in + bob; coleta com tween de sucção.
- Passagem (alçapão): feixe acende com fade/scale, não liga seco.
- HUD: realces de dano/cura com easing (hoje CSS; manter, calibrar).

`[NORMATIVO]` Aceite: finalização ligada (em WebGL2) sem lavar a cena; pelo menos os 5 alvos
de juice acima animados por easing, não por corte seco.

### 4.3 Bloco 3 - contorno "pro" (edge-detect de cena) `[NORMATIVO]`

`[DESIGN]` `addSceneOutline`: linha de tinta também no CENÁRIO e nas quebras internas, via
post-process full-screen. `GeometryBufferRenderer` fornece profundidade + normal; Sobel
detecta descontinuidade de profundidade (silhueta) e de normal (vincos), pintando linha
escura. Coexiste com o inverted-hull: o hull dá o contorno grosso e art-directável dos
atores/chefe; o edge-detect dá a linha fina e consistente do mundo. Espessura/limiar
`[A DEFINIR]` (proposta: 1px, limiar de profundidade adaptativo à distância p/ não serrilhar
o fundo). Degrada por §2.3 (em WebGPU, fica só o inverted-hull do Bloco 1).

`[NORMATIVO]` Aceite: em WebGL2, arestas de cenário e vincos ganham linha escura coerente,
sem dobrar a linha dos atores de forma feia e sem custo que derrube o fps (§5).

### 4.4 Bloco 4 - profundidade de sistemas `[NORMATIVO]`

`[DESIGN]` A "profundidade de jogo" do Messenger vem de coesão + verbo forte + presença
(NPC/diálogo) + ambiência viva (dia/noite, vento) + áudio adaptativo, NÃO de volume de
conteúdo. A Brasa já tem o verbo (combate), ecos por andar, gangorra de luz e profundidade
lumínica por zona. Este bloco adensa a AMBIÊNCIA e a PRESENÇA com escopo fechado e
implementável (não é mandato de conteúdo infinito):

**(a) Áudio adaptativo** (reusa `combatSound.ts`/`stingers.ts`, Web Audio):
- Cama ambiente por profundidade (drone frio que adensa quanto mais fundo).
- Camada de PERIGO que sobe com o nº de mortos despertos ativos e com a fase do Guardião, e
  recua quando a sala esvazia (mix por ganho, crossfade suave).
- Batida da Brasa: pulso grave atado ao estágio de luz (rápido quando quase morta).

**(b) Presença ambiente** (reusa o sistema de ecos/`showStory` e os atores):
- Ecos viram SUSSURROS espaciais (cue posicional perto do nicho/inscrição), não só texto.
- Mortos ainda não despertos "se agitam" (micro-animação/som) antes do combate, dando vida e
  telegrafia de quantos faltam.
- A Brasa "respira" (modulação sutil da luz central já existente, agora atada ao áudio (a)).

**(c) Diretor de ritmo leve** `[ASPIRACIONAL]`: despertar dos mortos em micro-ondas dentro da
sala (não todos de uma vez) quando o roster for grande, para pacing legível. Só se couber sem
risco; não bloqueia o aceite.

`[NORMATIVO]` Aceite do Bloco 4: áudio (a) com as três camadas reagindo a perigo/profundidade/
luz; presença (b) com sussurro espacial, agitação pré-combate e respiração da Brasa atada ao
áudio. (c) é aspiracional.

---

## 5. Orçamento e ordem do pipeline `[NORMATIVO]`

`[DESIGN]` Âncoras do canon: 60 fps desktop / 30 fps mobile; < 100 draw calls por cena
(`padrao-de-detalhe.md` 2.1). Impactos:
- Inverted-hull DOBRA as draw calls dos ATORES (não do mundo): manter o hull só em atores/
  chefe/props-chave; o mundo usa edge-detect (1 passe), não hull. Medir com `perfHud`.
- SSAO2, finishing e sceneOutline são full-screen (custo por pixel, não por draw call):
  validar fps no andar mais cheio (roster de 5) e na arena do Guardião com hazards.
- Ordem de composição: cena (CellMaterial + GlowLayer + sombra) -> SSAO2 -> edge-detect de
  cena -> DefaultRenderingPipeline (FXAA/vinheta/grão) -> finishing (papel/dither/posterize).
  `[A DEFINIR]` posição exata do SSAO/edge relativa ao pipeline; calibrar para a linha não
  comer o grão nem vice-versa.
- KTX2/Draco: `[A DEFINIR]` adiar para uma onda própria de pipeline de asset (não bloqueia
  estética); citado no canon como meta de carga, fora do escopo dos 4 blocos.

---

## 6. Acessibilidade e leitura `[NORMATIVO]`

`[DESIGN]` O outline REFORÇA a leitura (silhueta), alinhado ao princípio de telegrafia do
combate. Nenhuma informação de jogo pode passar a depender SÓ de cor: a telegrafia
inquebrável (vermelho) e o cambaleio seguem com pose + som além da cor. O toon não pode
reduzir o contraste do tell abaixo do atual.

---

## 7. Riscos e mitigação

`[DESIGN]`
- **Shader custom em WebGPU:** mitigado pela política §2.3 (degrada, não quebra).
- **Perder feedback de combate ao trocar material:** mitigado mantendo atores em
  `StandardMaterial` (§1, §4.1b). Verificável no playtest (flash/telegrafia/reacender visíveis).
- **Draw calls dobrando com hull:** hull só em atores/chefe; mundo por edge-detect; medir
  com `perfHud`.
- **Toon apagar a gangorra frio-quente:** CellMaterial preserva cor-base e recebe as 2 luzes;
  validar que acender a Brasa ainda vira a cena de azul para laranja.
- **Banding/serrilha do edge-detect no fundo enevoado:** limiar adaptativo por profundidade;
  reduzir/forçar 1px; degradar se feio.
- **Escopo do Bloco 4 inflar:** escopo fechado em §4.4 (a/b normativos, c aspiracional);
  nada de novo sistema de quest/NPC além do que está listado.

---

## 8. Checklist de aceite (Definition of Done)

`[NORMATIVO]` Sim/não honesto por item. `[ASPIRACIONAL]` orienta, não bloqueia.

Bloco 1 (toon + tinta + AO)
- [ ] Cenário (piso/paredes/teto/props estáticos) renderiza em faixas (CellMaterial),
      preservando a textura-atlas e a cor [DESIGN][NORMATIVO]
- [ ] Herói, esqueletos, Guardião e dummy têm contorno escuro (inverted-hull) que os
      acompanha em movimento [DESIGN][NORMATIVO]
- [ ] SSAO2 ligado, aterrando atores e cantos sem sujar a cena [DESIGN][NORMATIVO]
- [ ] Feedback de combate (flash, telegrafia inquebrável vermelha, reacender, frost) intacto
      [DESIGN][NORMATIVO]
- [ ] Gangorra frio-quente preservada ao acender a Brasa [DESIGN][NORMATIVO]

Bloco 2 (textura + juice)
- [ ] Passe de finalização (papel + dither + posterize) ligado em WebGL2 sem lavar a cena;
      pulado com aviso em WebGPU se não compilar [DESIGN][NORMATIVO]
- [ ] Tween util genérico em engine/core, atualizado no loop [DESIGN][NORMATIVO]
- [ ] Pelo menos 5 alvos de juice por easing: acender da Brasa, câmera no hit/lock-on, drops,
      feixe da passagem, realces de HUD [DESIGN][NORMATIVO]

Bloco 3 (edge-detect de cena)
- [ ] Em WebGL2, arestas de cenário e vincos ganham linha escura coerente via Sobel
      (profundidade+normal do GeometryBufferRenderer) [DESIGN][NORMATIVO]
- [ ] Coexiste com o inverted-hull sem dobrar feio a linha dos atores [DESIGN][NORMATIVO]
- [ ] Degrada (fica só o hull) em WebGPU sem quebrar a tela [DESIGN][NORMATIVO]

Bloco 4 (profundidade de sistemas)
- [ ] Áudio adaptativo com cama ambiente por profundidade + camada de perigo (nº de mortos /
      fase do chefe) + batida da Brasa por estágio de luz [DESIGN][NORMATIVO]
- [ ] Presença: sussurro espacial dos ecos, agitação pré-combate dos mortos, respiração da
      Brasa atada ao áudio [DESIGN][NORMATIVO]
- [ ] Diretor de ritmo em micro-ondas [DESIGN][ASPIRACIONAL]

Transversais
- [ ] 60 fps desktop no andar mais cheio e na arena do Guardião; < 100 draw calls (medido com
      perfHud) [NORMATIVO]
- [ ] Camadas respeitadas: render genérico em engine/, game/ só wira; engine não importa game
      [CÓDIGO][NORMATIVO]
- [ ] Sem travessões, sem emojis em texto exibido [NORMATIVO]
- [ ] Itens [A DEFINIR] resolvidos ou adiados com registro (espessura do hull, intensidades do
      finishing, limiar do edge-detect, ordem SSAO/pipeline, KTX2/Draco) [NORMATIVO]

## ATUALIZAÇÃO de implementação (2026-06-18) - os 4 blocos no código

`[CÓDIGO]` `[NORMATIVO]` Os quatro blocos foram implementados e validados em runtime (WebGL2,
preview headless via Playwright: 0 exceções, 0 erros de GL, passes na cadeia, 61 malhas com
contorno). Decisões e desvios em relação à proposta:

- **Módulos genéricos** (camada engine, exportados por `@engine`): `rendering/toon.ts`
  (CellMaterial), `rendering/outline.ts` (contorno nativo `renderOutline`), `rendering/ssao.ts`,
  `rendering/finishingPass.ts`, `rendering/sceneOutline.ts`, `core/tween.ts`. Áudio do Bloco 4 em
  `game/audio/adaptiveAmbience.ts`. Dep nova: `@babylonjs/materials` 9.11.0 (só CellMaterial).
- **Bloco 1.** Contorno por `mesh.renderOutline` NATIVO do Babylon (não clone manual): funciona
  com malhas SKINNED e nos dois backends. CellMaterial só no MUNDO; atores seguem em
  `StandardMaterial` (emissivo de combate intacto, confirmado).
- **Bloco 1c (AO) - DESVIO:** usamos `SSAORenderingPipeline` (v1, SÓ profundidade) e NÃO o SSAO2.
  O SSAO2 monta um geometry buffer MRT (depth+normal) e o CellMaterial não escreve em todos os
  alvos, disparando "missing fragment shader outputs" a cada draw. O v1 é alvo único, robusto com
  material custom, e suficiente para o look. `[A DEFINIR]` revisitar SSAO2 se quisermos AO de
  maior qualidade (exigiria registrar o CellMaterial no gbuffer).
- **Bloco 3 - DESVIO:** edge-detect SÓ por profundidade (`DepthRenderer`, alvo único), não por
  profundidade+normal. Mesmo motivo do MRT acima. Silhueta por profundidade + inverted-hull dos
  atores entrega a leitura inkada; vincos internos finos ficam por conta do toon/AO. `[A DEFINIR]`
  reintroduzir normal-edge se valer o custo de um gbuffer compatível.
- **Política WebGPU (§2.3) honrada:** `finishingPass` e `sceneOutline` (GLSL) são pulados com
  aviso em WebGPU; toon + outline + SSAO seguem nos dois backends. `[A DEFINIR]` variantes WGSL
  para a pilha completa em WebGPU.
- **Bloco 4** ligado: `adaptiveAmbience` com cama (profundidade), perigo (nº de despertos / fase do
  chefe) e batida da Brasa (urgência), mais sussurro espacial do eco e agitação dos mortos no
  despertar; dirigido por frame em `main.ts` a partir de `combat.aliveEnemyCount`/`bossBrasaLight`.
- **Calibração pendente** (playtest em GPU real, não em swiftshader): espessura do hull,
  `posterizeLevels`/papel/dither, força/raio do AO, limiar do edge-detect, ordem SSAO vs pipeline.

## Fontes
- Referência externa: análise do Messenger (abeto.co), Three.js: WebGLRenderer, GLTF+DRACO,
  KTX2, InstancedMesh, EffectComposer (outline/edge-detect, MeshToonMaterial+gradientMap,
  SSAO, Fresnel, dither, paper), Tween.js, Svelte, Web Audio.
- Mood/cor: [`direcao-de-arte.md`](direcao-de-arte.md). VFX: [`biblia-vfx-e-shaders.md`].
  Luz: [`biblia-iluminacao.md`]. Áudio: [`biblia-audio.md`].
- Régua/DoD: [`../padrao-de-detalhe.md`](../padrao-de-detalhe.md).
- Motor: `prototipo/src/engine/rendering/*`, `prototipo/src/game/scenes/crypt/cryptRoom.ts`
  (`setupCryptScene`), atores em `prototipo/src/game/actors/*`.
