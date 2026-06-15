# Técnica: Performance e Profiling (Babylon.js, web)

Documento único para o orçamento de performance do jogo: o frame de 16,6 ms, os budgets (hoje
espalhados por vários docs, aqui consolidados), as ferramentas de medição (Babylon Inspector,
SceneInstrumentation, spector.js, DevTools) e um checklist acionável. Web-first significa que o
gargalo costuma ser CPU (draw calls, física, animação) e VRAM (texturas), não shader, e que o
alvo é mais modesto que desktop.

Liga-se a [`tecnica-graficos-fisica.md`](tecnica-graficos-fisica.md) seção 9 (técnicas de
otimização conceituais), [`tecnica-arquitetura.md`](tecnica-arquitetura.md) (timestep fixo:
desacoplar lógica do FPS), [`spec-combate.md`](spec-combate.md) (3-5 inimigos, latência < 100
ms), [`tecnica-assets-e-carregamento.md`](tecnica-assets-e-carregamento.md) (VRAM, dispose) e
[`tecnica-animacao-babylon.md`](tecnica-animacao-babylon.md) (LOD de animação).

## 0. Onde o protótipo está hoje

O `main.ts` já mede e mostra FPS (`engine.getFps()`, atualizado a cada ~250 ms no HUD). É o
primeiro instrumento. Este doc o expande para um regime de medição sério a partir do M4 (gate
de performance do [`plano-de-producao.md`](plano-de-producao.md) seção 7).

## 1. O orçamento de frame (16,6 ms)

A 60 FPS, cada frame tem 16,6 ms para TUDO: input, IA, física, animação, render. Repartição-alvo
de referência (ponto de partida, não dogma):

| Etapa | Alvo | Observação |
|---|---|---|
| Input | < 0,5 ms | leitura de estado; latência de input crítico < 100 ms (spec-combate) |
| IA | < 2 ms | em ticks, não todo frame (spec-combate seção 4) |
| Física (Havok) | < 3 ms | poucos corpos, sleep agressivo, colliders primitivos |
| Lógica de gameplay | < 2 ms | passo fixo 60 Hz (tecnica-arquitetura): combate, i-frames |
| Animação (skinning, blend, IK) | < 2 ms | escala com nº de personagens; LOD nos distantes |
| Render (draw calls, GPU) | < 6 ms | gargalo de CPU no submit de draw calls, não na GPU |

A regra de ouro do timestep fixo (tecnica-arquitetura seção 6): a LÓGICA roda em passo fixo de
60 Hz (os tempos da spec-combate estão em frames a 60 FPS e não podem variar com a máquina); o
RENDER e a amostragem de animação rodam no FPS real com interpolação. Se o frame estourar 16,6
ms, o acumulador roda mais de um passo fixo, e o jogo desacelera o render mas mantém o feel.

## 2. Budgets consolidados (fonte de verdade)

Reunidos dos docs onde estavam dispersos; a coluna "origem" rastreia a fonte.

| Recurso | Budget (web) | Origem |
|---|---|---|
| Draw calls | < ~100 (mobile 100-300) | tecnica-graficos-fisica seção 9 |
| Tris por personagem | 1.000-5.000 | tecnica-graficos-fisica seção 9 |
| Inimigos ativos simultâneos | 3-5 (ex.: 2 defensores + 2 arqueiros) | spec-combate seção 4 |
| Luzes com sombra | poucas (1 direcional/CSM + alguns pontos SEM sombra) | tecnica-graficos-fisica seção 1 |
| Texturas/VRAM | KTX2 (~4-8x menos VRAM que PNG/JPG) | tecnica-graficos-fisica seção 2 |
| Geometria (download) | Draco (90-95% menor no arquivo) | tecnica-graficos-fisica seção 9 |
| Partículas | limitadas; pool; telegrafar hazard por mesh/sombra se pesar | spec-chefe seção 13, biblia-vfx-e-shaders |
| Latência de input | < 100 ms (crítico) | spec-combate seção 6 |
| FPS alvo | 60 fps no navegador alvo (medir média e p95) | spec-prototipo, plano-de-producao |
| Tempo de carga / bundle | inicial pequeno, lazy-load por área | tecnica-assets-e-carregamento seção 6 |

Linha-mestra: priorizar batching/instancing (cortar draw calls), compressão KTX2/Draco (cortar
VRAM/download) e iluminação assada (cortar custo de luz). Shader raramente é o gargalo na web.

## 3. Ferramentas de profiling

### 3.1 Contador de FPS in-game (já existe)
`engine.getFps()` no HUD. Bom para sentir; ruim para diagnosticar. Use como termômetro contínuo.

### 3.2 Babylon Inspector
A ferramenta principal. Importe sob demanda (não no bundle de produção):

```ts
import "@babylonjs/inspector";
// abrir com uma tecla de debug (ver tecnica-input-e-debug.md)
scene.debugLayer.show({ embedMode: true });
```

Abas úteis: Statistics (FPS, draw calls, contagem de meshes/materiais/texturas, total de
vértices, frame time, GPU frame time quando disponível); Scene Explorer (achar mesh/material
órfão que não foi descartado, ver tecnica-assets-e-carregamento seção 5).

### 3.3 SceneInstrumentation / EngineInstrumentation
Números precisos por etapa, para achar ONDE o frame está indo:

```ts
import { SceneInstrumentation, EngineInstrumentation } from "@babylonjs/core";

const si = new SceneInstrumentation(scene);
si.captureFrameTime = true;
si.captureRenderTime = true;
si.captureInterFrameTime = true;
si.captureActiveMeshesEvaluationTime = true;
si.capturePhysicsTime = true;       // tempo da física (Havok) por frame
si.captureAnimationsTime = true;

const ei = new EngineInstrumentation(engine);
ei.captureGPUFrameTime = true;

// por frame (ou a cada N): ler médias
scene.onAfterRenderObservable.add(() => {
  console.log("draws", si.drawCallsCounter.current,
    "frame", si.frameTimeCounter.lastSecAverage.toFixed(2),
    "physics", si.physicsTimeCounter.lastSecAverage.toFixed(2),
    "gpu", (ei.gpuFrameTimeCounter.lastSecAverage * 1e-6).toFixed(2));
});
```

### 3.4 spector.js
Captura um frame inteiro (WebGL/WebGPU) e lista cada draw call, estado e textura. Para
descobrir draw calls redundantes, trocas de material e overdraw. Extensão de navegador ou
embutido.

### 3.5 Chrome DevTools Performance + Memory
Performance: flame chart do thread principal (acha onde o JS gasta: GC, física, lógica).
Memory: heap snapshots e, junto com o Inspector, caça vazamento de GPU (a contagem de texturas
deve voltar ao baseline depois de descartar uma área, ver tecnica-assets-e-carregamento seção
5).

## 4. Técnicas de otimização específicas do Babylon

- Thin instances (`mesh.thinInstanceAdd`) para muitas cópias da mesma malha (tendas, paliçada,
  pedras, vegetação) num draw call; `instances` quando cada cópia precisa de transform próprio.
- `Mesh.MergeMeshes` para juntar geometria estática imóvel de mesmo material (cenário gray-box,
  kit modular).
- `scene.freezeActiveMeshes()` quando a lista de malhas visíveis é estável; `mesh.freezeWorldMatrix()`
  para objetos que não se movem; `material.freeze()` para materiais que não mudam. Cada um corta
  trabalho de CPU por frame.
- `mesh.doNotSyncBoundingInfo = true` em malhas que não precisam de picking/colisão por bounding.
- `scene.skipPointerMovePicking = true` e `scene.autoClear`/`autoClearDepthAndStencil` ajustados
  quando aplicável.
- LOD: `mesh.addLODLevel(distancia, meshSimplificado)`; ou simplificação automática
  (`mesh.simplify`). LOD de animação: pular frames do animator e desligar IK nos distantes
  (tecnica-animacao-babylon seção 8).
- Octree (`scene.createOrUpdateSelectionOctree()`) em cenas com muitos objetos estáticos para
  acelerar culling/picking.
- Hardware scaling para mobile/máquina fraca: `engine.setHardwareScalingLevel(1.5)` renderiza em
  resolução menor e escala para a tela (grande ganho de fill-rate com pouca perda percebida).
- Física: `sleep` agressivo de corpos parados, colliders em cápsula/caixa (nunca mesh collider),
  poucos rigidbodies ativos; ragdoll só no instante da morte (tecnica-graficos-fisica seção 8).
- Pool de objetos (inimigos, projéteis, partículas): reutilizar em vez de criar/destruir
  (spec-combate seção 4).

## 5. Aparelho mínimo alvo

Defina um perfil de referência e teste NELE, não só na máquina de desenvolvimento:
- Alvo de referência sugerido: um notebook integrado de gama média/baixa (GPU integrada, sem
  placa dedicada) e um celular Android de gama média recente, em Chrome/Firefox atualizados.
- WebGPU onde houver; fallback WebGL2 no resto (o `engine.ts` já decide isso). Medir os dois
  caminhos: o WebGL2 é o piso de compatibilidade.
- Safari/iOS: limites de memória mais severos; manter VRAM/bundle enxutos (tecnica-graficos-fisica
  cita o problema análogo no Unity/iOS). Testar cedo se iOS for alvo.

## 6. Quando e como medir (regime)

- Termômetro contínuo: o contador de FPS in-game desde sempre.
- Medição séria: a partir do M4 (primeira arte real), no aparelho mínimo alvo. É o gate de
  performance do plano de produção: se não sustentar 60 fps, cortar custo visual (menos draw
  calls, mais bake, LOD) ANTES de seguir; só reavaliar a engine se for teto estrutural, não de
  otimização.
- Telemetria de playtest (plano-de-producao seção 6): FPS médio e p95 no encontro cheio, tempo
  de carga, tamanho do bundle. Medir o p95, não só a média: o engasgo ocasional é o que estraga
  o feel de combate.
- Método: ligar SceneInstrumentation no encontro de 3-5 inimigos do M2 com tudo (juiciness,
  partículas, hazards do chefe) e ver qual contador estoura o budget da seção 1.

## 7. Checklist de performance

- [ ] Draw calls < 100 no encontro cheio (medir no Inspector/SceneInstrumentation).
- [ ] Personagens 1k-5k tris; cenário com merge/instances.
- [ ] Texturas KTX2; geometria Draco; iluminação assada (lightmaps + probes).
- [ ] 1 direcional com CSM + poucas luzes pontuais SEM sombra.
- [ ] Freeze de world matrix/material/active meshes onde estável.
- [ ] LOD de malha e de animação; IK só no herói/NPC próximo.
- [ ] Física: sleep, colliders primitivos, poucos corpos; checar `physicsTimeCounter`.
- [ ] Pool de inimigos/projéteis/partículas; dispose ao trocar de área (sem vazar VRAM).
- [ ] Lógica em passo fixo 60 Hz; render interpolado (independência de frame rate).
- [ ] Medido no aparelho mínimo alvo, WebGPU e WebGL2, média e p95.
- [ ] Hardware scaling como válvula de escape no mobile.

## Fontes

Otimização Babylon
- https://doc.babylonjs.com/features/featuresDeepDive/scene/optimizeYourScene
- https://doc.babylonjs.com/features/featuresDeepDive/mesh/copies/thinInstances
- https://doc.babylonjs.com/features/featuresDeepDive/mesh/levelOfDetail
- https://doc.babylonjs.com/typedoc/classes/BABYLON.Engine#setHardwareScalingLevel

Profiling
- https://doc.babylonjs.com/toolsAndResources/inspector
- https://doc.babylonjs.com/features/featuresDeepDive/scene/sceneInstrumentation
- https://doc.babylonjs.com/typedoc/classes/BABYLON.EngineInstrumentation
- https://spector.babylonjs.com/
- https://developer.chrome.com/docs/devtools/performance

Web em geral
- https://www.utsubo.com/blog/threejs-best-practices-100-tips
- https://kindatechnical.com/game-development/level-of-detail-culling-and-draw-call-optimization.html
