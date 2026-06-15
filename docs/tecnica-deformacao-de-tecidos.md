# Técnica: Deformação de Tecidos (Roupas) em Renderização

Estudo de como roupas e panos se deformam e se movem em tempo real, para que mantos,
túnicas e véus do elenco pareçam tecido vivo e não placas rígidas coladas no corpo.
Aprofunda [`tecnica-graficos-fisica.md`](tecnica-graficos-fisica.md) seção 6 (a decisão
"simular ou animar") e casa com [`biblia-vestuario.md`](biblia-vestuario.md) seção 5 (o que
esvoaça em cada traje) e [`tecnica-anatomia-humana.md`](tecnica-anatomia-humana.md).

A pergunta central é sempre a mesma: simular pano de verdade (caro) ou falsear o movimento
(barato)? Na web, a resposta quase sempre é falsear bem - e reservar simulação real só para
a peça-espetáculo de um herói ou chefe.

---

## 1. Por que o tecido deforma

Pano reage a quatro coisas: gravidade (cai e drapeia), inércia (atrasa e balança quando o
corpo acelera/freia/gira - a "secondary motion"), colisão (bate na perna, no chão, no vento)
e vento. O que vende "isto é tecido" não é detalhe de dobra: é o atraso. Um manto que
balança um instante depois do corpo parar lê como pano; um que acompanha rígido lê como
casca. Por isso a técnica mais barata que captura inércia (spring bones) já resolve 80% da
sensação.

---

## 2. Técnicas, do mais barato ao mais caro

1. Skinning a esqueleto (peça presa ao corpo). A roupa é malha skinned aos mesmos ossos do
   corpo; deforma junto, sem física. Custo ~zero. É o certo para o que fica justo: túnica
   acima do cinto, peitorais, mangas coladas. Não balança sozinho.

2. Blend shapes / morph targets. Poses de tecido pré-modeladas, interpoladas (ex.: barra
   "parada" -> barra "ao vento"). Determinístico e barato; bom para estados discretos (o
   estado "cingido para combate" x "solto", ver bíblia de vestuário 5).

3. Spring bones / dynamic bones (o cavalo de batalha). Uma cadeia de ossos extra na parte
   que esvoaça (ponta do manto, barra da túnica, cabelo, borlas, cordões). Cada osso é
   simulado como uma mola com rigidez (stiffness), arrasto (drag), gravidade e, opcional,
   colisão contra cápsulas do corpo. É o padrão de VRM/VRChat (VRMC_springBone, PhysBones)
   exatamente para cabelo/roupa/acessório. Barato, estável, controlável, e captura a
   inércia (o atraso) que vende o tecido. Internamente costuma ser integração de Verlet
   numa cadeia de juntas.

4. Cloth de malha (mass-spring / PBD / XPBD). A própria malha do tecido vira uma rede de
   partículas (massas) ligadas por restrições (springs): umas resistem ao estiramento (ao
   longo das arestas), outras à flexão (ligando vértices não vizinhos). Resolve-se com
   Verlet + satisfação iterativa de restrições. Position-Based Dynamics (PBD) e sua versão
   XPBD são o estado da prática por serem estáveis e rápidas. Caro o bastante para limitar
   a poucas peças em tela.

5. Cloth em GPU / compute (WebGPU). Move a simulação para shaders de cómputo; estudos
   recentes mostram pano a 60fps com centenas de milhares de nós em WebGPU, contra ~10 mil
   no WebGL. É o teto de qualidade, premium, e só vale no herói/chefe (ver
   [`tecnica-graficos-fisica.md`](tecnica-graficos-fisica.md) seção 6).

---

## 3. Integração de Verlet em detalhe (base de 3, 4 e 5)

Verlet integra posição sem guardar velocidade explicitamente; a velocidade fica implícita
na diferença entre a posição atual e a anterior. É barato e bem mais estável que Euler, o
que o torna o padrão para pano em jogos.

Atualização de cada partícula:
```
x_next = x + (x - x_prev) * (1 - drag) + a * dt^2
x_prev = x        // a "velocidade" é (x - x_prev)
```

Restrições (sticks): para cada par de partículas ligadas, com distância de repouso `rest`:
```
delta   = x_b - x_a
dist    = |delta|
diff    = (dist - rest) / dist
x_a    += delta * 0.5 * diff      // cada ponto move metade
x_b    -= delta * 0.5 * diff
```
Aplicam-se as restrições várias vezes por frame (iterações); mais iterações = pano mais
rígido/estável. Implementações simples rodam 1-5 iterações.

- Gravidade: somar um vetor de aceleração para baixo em todas as partículas.
- Vento: força que varia no espaço e no tempo (um seno barato já dá vida a multidões).
- Pontos fixos (pinned): vértices presos ao corpo (a gola, o ombro onde o manto prende)
  ignoram a integração e copiam a posição do osso a que pertencem; são eles que "puxam" o
  resto do pano e transmitem a inércia do personagem.

A cadeia de spring bones (técnica 3) é o caso 1D disto: uma fila de partículas pinned na
raiz, caindo por gravidade e arrastando por inércia, com restrições de distância mantendo
o comprimento.

---

## 4. O híbrido recomendado (qualidade x custo)

O padrão da indústria para roupa de herói em jogo: simular barato e renderizar bonito.
- Simula-se uma versão de baixa resolução do pano (poucas partículas) ou uma cadeia de
  ossos.
- Mapeia-se o resultado para os ossos do esqueleto e renderiza-se a malha cheia por
  skinning normal na GPU (em vez de reescrever um vertex buffer dinâmico gigante).
- LOD de pano: perto = cloth/spring bones; médio = só ossos com menos segmentos; longe =
  malha rígida ou vento fake em vertex shader. Desliga simulação fora de tela e dorme
  (sleep) peças paradas.

Regra de orçamento web (eco da bíblia de vestuário 5): no máximo 1 peça de cloth real por
personagem em tela ao mesmo tempo; todo o resto (barra, cabelo, borlas) por spring bones;
vento global barato (seno em vertex shader) para multidões.

---

## 5. Opções no Babylon.js

- Soft bodies (cloth/rope) nativos: existem, porém só com o plugin Ammo.js (não com Havok).
  Permitem cloth e rope com pontos fixos e damping. Como o projeto usa Havok, o caminho
  nativo de soft body não está disponível sem trocar/adicionar plugin.
- Física em ossos: documentada pelo próprio Babylon; trata-se de pôr partículas na posição
  do osso, ligá-las por juntas e atualizar o osso por frame com o que a física devolve. É
  literalmente a receita de spring bones.
- Cadeia de molas manual (recomendado para nós): implementar a cadeia de spring bones à mão
  (Verlet 1D ou mola-amortecedor por ângulo) é leve, independente de plugin de física,
  determinístico e roda igual em WebGPU e WebGL2. É o que melhor casa com o orçamento web e
  com Havok.
- Skinning/bones e blend shapes (morph targets): suportados nativamente para as técnicas 1
  e 2; um glTF do Blender/Mixamo já chega com esqueleto e, se exportado, com morph targets.
- Vento em vertex shader (NodeMaterial): para vegetação e multidões, animar vértices por
  seno na GPU é o mais barato (ver vegetação em
  [`tecnica-graficos-fisica.md`](tecnica-graficos-fisica.md) seção 5).

---

## 6. Aplicação ao elenco (o que recebe o quê)

Da bíblia de vestuário seção 5 e dos perfis de personagem:
- Josué - manto terra-avermelhado (cor-assinatura): a peça dinâmica dele. Cadeia de spring
  bones de 3-5 segmentos, presa no ombro, com gravidade + inércia (atrasa ao correr/virar)
  + vento sutil. Barra da túnica: 2-4 abas em spring que abrem ao correr; estado "cingido
  para combate" (kilt curto) via blend shape/troca de mesh. Acima do cinto, tudo justo
  (skinning), sem física.
- Eleazar (Sumo Sacerdote) - manto azul com sinos e romãs: barra com ossos sincronizados a
  SFX de sino por passo (gancho de áudio, fiel a Êxodo 28:33-35); éfode e peitoral rígidos
  (tratados como armadura).
- Calebe - manto de lã grosso, capuz-ombro: spring bones mais pesados/rígidos (lã, não seda).
- Rei cananeu - capa de púrpura: a candidata a cloth real (técnica 4/5), por ser
  peça-espetáculo de chefe.
- Véu feminino e cordões do turbante: pano fino, spring bones leves.

Estados de movimento (eco da bíblia 5): o cinto divide o que esvoaça (abaixo) do que fica
justo (acima). Em corrida/combate, recolher a barra muda o custo e a leitura. A inércia da
cadeia deve responder à aceleração do personagem (velocidade que muda), não só à velocidade.

---

## Fontes

Verlet, mass-spring, PBD/XPBD
- https://pikuma.com/blog/verlet-integration-2d-cloth-physics-simulation
- https://viscomp.alexandra.dk/index2fa7.html?p=147
- https://gamedevelopment.tutsplus.com/tutorials/simulate-tearable-cloth-and-ragdolls-with-simple-verlet-integration--gamedev-519
- https://steven.codes/blog/cloth-simulation/

Spring bones / dynamic bones (secondary motion)
- https://vrm.dev/en/univrm/springbone/univrm_secondary/
- https://deepwiki.com/vrm-c/UniVRM/4-springbone-physics-system
- https://creators.vrchat.com/avatars/avatar-dynamics/physbones/

Híbrido e cloth em jogos
- https://www.gamedeveloper.com/programming/the-secrets-of-cloth-simulation-in-i-alan-wake-i-
- https://www.style3d.com/blog/how-is-cloth-simulation-used-in-modern-game-engines/
- https://www.ea.com/seed/news/open-source-dem-bones

Babylon.js
- https://doc.babylonjs.com/legacy/physics/softBodies/
- https://github.com/BabylonJS/Documentation/blob/master/content/features/featuresDeepDive/physics/v1/softBodies.md
- https://forum.babylonjs.com/t/how-to-achieve-simple-cloth-like-physics-simulation/8287
