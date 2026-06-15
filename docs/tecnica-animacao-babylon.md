# Técnica: Animação de Personagens no Babylon.js

Documento prático do sistema de animação por esqueleto no Babylon.js, alinhado ao marco M1
do protótipo (trocar a cápsula/gray-box por Josué em glTF rigado, com idle/andar/correr e
blend de locomoção, ver [`plano-de-producao.md`](plano-de-producao.md) seção 4 e
[`spec-prototipo-jerico.md`](spec-prototipo-jerico.md)). A parte conceitual (rigging,
skinning, blend, root motion, IK, retargeting) já está em
[`tecnica-graficos-fisica.md`](tecnica-graficos-fisica.md) seção 7; aqui é o COMO no
Babylon: `AnimationGroup`, blend de pesos, máquina de estados de animação, root motion (que
no Babylon NÃO é automático), foot IK e o pipeline Mixamo -> retarget.

Liga-se a:
- [`tecnica-arquitetura.md`](tecnica-arquitetura.md) (a máquina de estados de animação roda
  na ordem de update, com timestep fixo na lógica; a animação visual roda na taxa de
  render).
- [`tecnica-anatomia-humana.md`](tecnica-anatomia-humana.md) (o rig precisa de loops de
  deformação corretos; aqui assumimos um rig são).
- [`tecnica-deformacao-de-tecidos.md`](tecnica-deformacao-de-tecidos.md) (o manto/túnica do
  Josué: o que é skinned x o que é cloth sobre a malha animada).
- [`spec-combate.md`](spec-combate.md) (os tempos de ataque/telegrafia/i-frames em frames a
  60 FPS que as animações de combate precisam respeitar).

## 0. Onde o protótipo está hoje

O M0 usa um Josué low-poly PROCEDURAL, sem esqueleto: `prototipo/src/hero.ts` monta o corpo
com primitivas e anima por rotação de pivôs (`legL.rotation.x = sin(phase) * amp`, braços em
contrafase, bob vertical, manto inclinando ao correr). O `player.ts` chama
`this.hero.animate(dt, horizSpeed, grounded)` uma vez por passo de simulação.

O M1 troca o miolo desse `HeroModel` por uma malha glTF rigada com `AnimationGroup`s, MAS
mantém a mesma fronteira: o resto do jogo continua chamando algo como
`hero.setLocomotion(speed, grounded)` / `hero.play("ataque_leve")`. Quem decide qual clipe
toca e com que peso é uma máquina de estados de animação interna ao herói (seção 4). O
controlador físico (`PhysicsCharacterController`) continua sendo a cápsula; a malha animada é
o visual sincronizado a ela (como `syncMesh` já faz hoje).

## 1. O modelo do Babylon: Skeleton, Bone e AnimationGroup

Conceitos do runtime:
- `Skeleton`: a hierarquia de `Bone`s. Uma malha skinned referencia um `skeleton`; os pesos
  por vértice vêm do glTF.
- `AnimationGroup`: agrupa várias `TargetedAnimation` (uma `Animation` + o nó-alvo) sob um
  nome. Um clipe do Mixamo/Blender vira UM `AnimationGroup` (ex.: "Walk", "Idle"). É a
  unidade com que você trabalha: `start`, `stop`, `pause`, `play`, `weight`, `speedRatio`.
- Ao carregar um glTF, os grupos chegam em `scene.animationGroups` (ou no
  `AssetContainer.animationGroups` se você carregou via container, ver
  [`tecnica-assets-e-carregamento.md`](tecnica-assets-e-carregamento.md)). Por padrão o
  loader pode auto-iniciar o primeiro grupo: desligue isso para controlar você mesmo.

```ts
import { ImportMeshAsync, AnimationGroup } from "@babylonjs/core";

// Carrega a malha rigada + clipes embutidos.
const result = await ImportMeshAsync("/models/josue.glb", scene);
const skeleton = result.skeletons[0];

// Indexa os grupos por nome e para todos (não deixa o loader tocar sozinho).
const groups = new Map<string, AnimationGroup>();
for (const g of result.animationGroups) {
  g.stop();
  groups.set(g.name, g);
}
```

Regra de higiene: nunca dependa da ordem dos grupos; sempre indexe por nome e padronize os
nomes na exportação (idle, andar, correr, pular_subida, pular_ar, pular_pouso, ataque_leve_1,
ataque_leve_2, ataque_pesado, bloqueio, esquiva, levar_dano, morrer). Esses nomes são o
contrato entre o pipeline de arte e o código.

## 2. Blend por peso (o coração da locomoção)

O Babylon mistura animações de duas formas complementares:

### 2.1 Blend manual por peso (locomoção contínua)

Para o gradiente idle -> andar -> correr, toque os grupos relevantes EM LOOP ao mesmo tempo
e ajuste os pesos a cada frame (a soma deve dar ~1). O peso de um grupo é
`group.weight` (0 a 1), e ele só participa do blend se estiver `isPlaying`.

```ts
idle.start(true);                // loop
andar.start(true);
correr.start(true);
idle.weight = 1; andar.weight = 0; correr.weight = 0; // estado inicial

// Por frame (taxa de render): converte velocidade horizontal em pesos.
function updateLocomotion(speed: number) {
  const WALK = 4, RUN = 8;                 // bate com WALK_SPEED/RUN_SPEED do player.ts
  if (speed < 0.2) {
    setWeights(1, 0, 0);                    // idle
  } else if (speed <= WALK) {
    const t = speed / WALK;                 // 0..1 idle->andar
    setWeights(1 - t, t, 0);
  } else {
    const t = Math.min((speed - WALK) / (RUN - WALK), 1); // andar->correr
    setWeights(0, 1 - t, t);
  }
}
function setWeights(i: number, a: number, r: number) {
  idle.weight = i; andar.weight = a; correr.weight = r;
}
```

Ponto crítico do blend de andar/correr: os dois clipes precisam estar em FASE (pé esquerdo
no chão ao mesmo tempo), senão a mistura "patina". Use `syncAllAnimationsWith` para travar a
fase de um grupo na de outro, ou exporte os clipes já alinhados e com cadência proporcional.

```ts
// Sincroniza a fase de "correr" com o animatable mestre de "andar".
correr.syncAllAnimationsWith(andar.animatables[0]);
```

### 2.2 Blend automático na troca de estado (crossfade)

Para transições discretas (andar -> ataque -> andar), em vez de gerir pesos à mão, ligue o
`enableBlending` por uma `AnimationPropertiesOverride` e troque de grupo: o Babylon faz o
crossfade sozinho durante `blendingSpeed`.

```ts
import { AnimationPropertiesOverride } from "@babylonjs/core";

const ov = new AnimationPropertiesOverride();
ov.enableBlending = true;
ov.blendingSpeed = 0.08;          // ~quanto maior, mais rápido o crossfade
ov.loopMode = 1;                  // Animation.ANIMATIONLOOPMODE_CYCLE
scene.animationPropertiesOverride = ov;     // ou skeleton.animationPropertiesOverride
```

Recomendação para o projeto: use o blend MANUAL por peso para o gradiente de locomoção
(idle/andar/correr, que é contínuo e precisa de controle fino) e o blend AUTOMÁTICO para
entrar/sair de ações discretas (pulo, ataque, esquiva, dano). A máquina de estados da seção
4 orquestra os dois.

## 3. Animação na ordem de update certa

Animação é visual: roda na taxa de render, depois que a lógica determinística já decidiu o
estado. Seguindo a ordem de [`tecnica-arquitetura.md`](tecnica-arquitetura.md) (input -> IA
-> física -> animação -> câmera -> render) e o timestep fixo:

- A LÓGICA de combate (contadores de i-frame, janelas de telegrafia, hit stop) roda no passo
  fixo (60 Hz), porque os números da [`spec-combate.md`](spec-combate.md) estão em frames a
  60 FPS e não podem variar com o FPS da máquina.
- A AMOSTRAGEM da animação (avançar os `AnimationGroup`s, recalcular pesos, IK) roda no
  render, usando o `deltaTime` real. O Babylon avança os animatables sozinho dentro de
  `scene.render()`; você só ajusta pesos/estado.

No protótipo isso encaixa no que o `main.ts` já faz: `onAfterPhysicsObservable` move o
personagem (lógica), `onBeforeRenderObservable` atualiza a câmera (visual). A atualização de
pesos de locomoção entra junto do visual.

Hit stop (congelar atacante e alvo por alguns frames sem congelar partículas/câmera, ver
spec-combate seção 1) se implementa zerando o `speedRatio`/`weight` dos grupos do personagem
afetado por N passos fixos, OU pausando os grupos específicos:

```ts
function aplicarHitStop(frames60: number, ...grupos: AnimationGroup[]) {
  const ms = (frames60 / 60) * 1000;
  for (const g of grupos) g.pause();
  // retomar após `ms` contados no relógio de gameplay (não em setTimeout solto)
  scheduleGameplay(ms, () => grupos.forEach((g) => g.play()));
}
```

## 4. Máquina de estados de animação

O Babylon não traz uma máquina de estados de animação pronta (diferente de Unity/Godot). Você
escreve uma pequena classe. Ela é distinta da máquina de estados de LOCOMOÇÃO FÍSICA que o
`player.ts` já tem (ON_GROUND/IN_AIR/START_JUMP): aquela decide o movimento; esta decide qual
clipe visual toca. As duas conversam.

Padrão recomendado (enxuto, sem dependência externa):

```ts
type AnimState = "LOCOMOCAO" | "PULO" | "ATAQUE" | "ESQUIVA" | "DANO" | "MORTE";

class HeroAnimator {
  private estado: AnimState = "LOCOMOCAO";
  constructor(private g: Map<string, AnimationGroup>) {
    g.get("idle")!.start(true);
    g.get("andar")!.start(true);
    g.get("correr")!.start(true);
  }

  // Chamado todo frame de render com o resultado da lógica.
  update(speed: number, grounded: boolean) {
    switch (this.estado) {
      case "LOCOMOCAO":
        if (grounded) this.blendLocomocao(speed);  // seção 2.1
        break;
      // PULO/ATAQUE/ESQUIVA/DANO: clipes one-shot que devolvem a LOCOMOCAO no fim
    }
  }

  // Ações discretas: tocam um one-shot e voltam por callback de fim de grupo.
  acao(nome: string, proximo: AnimState = "LOCOMOCAO") {
    const g = this.g.get(nome)!;
    this.estado = nomeParaEstado(nome);
    g.start(false);                              // sem loop
    g.onAnimationGroupEndObservable.addOnce(() => { this.estado = proximo; });
  }
}
```

Notas:
- `onAnimationGroupEndObservable` dispara no fim de um one-shot: é como uma ação devolve o
  controle para a locomoção (igual ao `#RETOMAR` do Ink devolver ao engine, na narrativa).
- Estados como DANO e MORTE têm prioridade e podem interromper qualquer outro (regra de
  prioridade dentro do `update`).
- Para combos (ataque_leve_1 -> _2 -> _3 da spec-combate seção 3), use uma janela de
  "buffer de input" aberta na recuperação do clipe atual; se o jogador apertar dentro dela,
  encadeia o próximo, senão volta à locomoção.
- Mantenha a tabela de transições pequena e legível: combate legível começa com animação
  legível.

## 5. Root motion (não é automático no Babylon)

"Root motion" = a animação carrega o deslocamento real do personagem no osso-raiz (os pés
não escorregam). O Babylon NÃO aplica isso sozinho: ao tocar um clipe com translação no
root, a malha se move, mas o colisor (a cápsula do `PhysicsCharacterController`) não. Há duas
estratégias:

### 5.1 In-place + controlador dirige o movimento (RECOMENDADO para locomoção)

Clipes de andar/correr "in-place" (root parado), e o `PhysicsCharacterController` move o
personagem (é exatamente o que o `player.ts` já faz). Para os pés não patinarem, a CADÊNCIA
do clipe tem que bater com a velocidade real: ou se exporta o clipe na velocidade-alvo, ou se
ajusta `group.speedRatio` proporcional à velocidade.

```ts
// Casa a cadência do passo com a velocidade do controlador (anti-patinação).
const VEL_BASE_ANDAR = 4;   // m/s em que o clipe "andar" foi autorado
andar.speedRatio = Math.max(0.4, speedHoriz / VEL_BASE_ANDAR);
```

### 5.2 Root motion real extraído (para esquiva, investida, finishers)

Para ações em que o deslocamento PRECISA vir da animação (rolar uma distância exata, a
investida da lança, o shield bash), extraia o delta do osso-raiz por frame e aplique-o ao
controlador, zerando-o na malha (mantém o colisor e o visual juntos):

```ts
// A cada frame da ação: quanto o root andou desde o frame anterior, em mundo.
const root = skeleton.bones.find((b) => b.name === "Hips")!;
const pos = root.getAbsolutePosition();        // no espaço do mesh
const delta = pos.subtract(rootPrev); rootPrev.copyFrom(pos);
controller.setVelocity(delta.scale(1 / dt));   // empurra o colisor
mesh.position.subtractInPlace(delta);          // tira do visual (já está no colisor)
```

Recomendação: locomoção por 5.1 (mais simples, robusto, é o que já existe); root motion real
só nos poucos clipes que ganham muito com ele (esquiva e investida da spec-combate). Não vale
a complexidade para tudo.

## 6. Foot IK e aim (localizado, só perto)

O Babylon tem `BoneIKController` (IK de duas juntas, ideal para perna: quadril-joelho-pé
mirando um alvo) e `BoneLookController` (orientar um osso para um alvo, ex.: cabeça/olhos
seguindo o inimigo no lock-on).

- Foot IK: por frame, faça um raycast do tornozelo para baixo; se o chão estiver acima do pé
  da pose, mova o alvo do `BoneIKController` para a superfície (não atravessa rampa/degrau).
  Casa com o `checkSupport`/rampa que o `player.ts` já trata.
- Aim/look: no lock-on (spec-combate seção 2), `BoneLookController` na cabeça/tronco para o
  Josué "encarar" o alvo sem virar o corpo todo.

```ts
import { BoneIKController, BoneLookController } from "@babylonjs/core";
const ik = new BoneIKController(mesh, tibiaBone, { targetMesh, poleTargetMesh });
// no loop: ik.update();
```

Custo: IK e look custam por frame e por personagem. Reserve para o herói e NPCs próximos;
desligue por LOD nos distantes (ver [`tecnica-performance-e-profiling.md`](tecnica-performance-e-profiling.md)).
No M1, foot IK é opcional: entra quando a locomoção básica já estiver boa.

## 7. Pipeline Mixamo -> retarget para o rig próprio

Plano do projeto (GDD seção 9, [`ferramentas-e-assets.md`](ferramentas-e-assets.md)): banco
inicial de animações do Mixamo + retarget para o Josué. O atrito é que o esqueleto do Mixamo
tem nomes/proporções próprios; aplicar esses clipes no seu rig exige retargeting.

Três caminhos, do mais simples ao mais flexível:

1. Usar o rig do Mixamo como o rig do jogo (mais simples). Suba o Josué para o Mixamo,
   auto-rig, baixe todos os clipes (idle, walk, run, attack, etc.) já no mesmo esqueleto.
   Sem retarget: todos os `AnimationGroup`s falam o mesmo skeleton. Bom para o protótipo.
2. Retarget no Blender (controle total). Importe o clipe do Mixamo, use o Rokoko Retargeting
   ou o Auto-Rig Pro para transferir ao seu rig, exporte glTF só com as animações. Mais
   trabalho, melhor para um rig autoral definitivo.
3. Retarget em runtime no Babylon. O Babylon v9 tem retargeting de animação: você importa
   clipes de um arquivo e os aplica a uma malha/esqueleto já em cena via
   `ImportAnimationsAsync`, com um `targetConverter` que mapeia os alvos (nomes de osso) de
   origem para o seu rig.

```ts
import { ImportAnimationsAsync } from "@babylonjs/core";

// Aplica clipes de outro arquivo sobre a malha/esqueleto já carregados.
await ImportAnimationsAsync("/anims/", "ataques.glb", scene, false, undefined,
  (target) => mapaDeOssos[target] ?? target  // converte nome do osso de origem p/ o seu
);
```

Convenção de export (vale para qualquer caminho): mesma escala (1 unidade = 1 metro, pés em
y=0, como o `hero.ts` já assume), eixo +Z para frente, um clipe por arquivo OU clipes
nomeados num só .glb, e nomes de osso/animação padronizados. Valide o fluxo Blender -> glTF
-> Babylon (empties, escala, animation groups) já no M1, como manda o
[`plano-de-producao.md`](plano-de-producao.md) (risco "Pipeline Blender -> Babylon").

## 8. Orçamento e LOD de animação

A skeletal animation é barata por personagem, mas escala com o número de personagens animados
ao mesmo tempo (spec-combate: 3-5 inimigos ativos + chefe). Medidas:
- LOD de animação: personagens distantes amostram menos (pule frames de update do animator) e
  desligam IK/look e blend fino, ficando só com clipes simples.
- `skeleton.useTextureToStoreBoneMatrices = true` no WebGL2 ajuda com muitos ossos.
- Faça `dispose` dos `AnimationGroup`s/esqueletos ao descartar a área (ver
  [`tecnica-assets-e-carregamento.md`](tecnica-assets-e-carregamento.md)); grupo órfão
  continua avançando e vaza CPU.
- Use pool de inimigos: reaproveite malha+esqueleto+grupos em vez de recriar (spec-combate
  seção 4). Para clones que compartilham animação, `AnimationGroup.clone` com um
  `targetConverter` que aponta para os ossos do clone.

Detalhe do orçamento de frame consolidado em
[`tecnica-performance-e-profiling.md`](tecnica-performance-e-profiling.md).

## 9. Plano para o M1 (passo a passo)

1. Exportar um Josué rigado low-poly (ou usar o auto-rig do Mixamo) com idle/andar/correr,
   escala e eixos na convenção da seção 7. Pulo (subida/ar/pouso) e um ataque entram em
   seguida.
2. Trocar o miolo do `HeroModel` (`hero.ts`): em vez de primitivas + `animate` procedural,
   carregar o .glb, indexar os `AnimationGroup`s e expor `setLocomotion(speed, grounded)` e
   `play(nome)` com a mesma fronteira que o `player.ts` já usa.
3. Implementar o blend de locomoção por peso (seção 2.1) com sincronia de fase
   andar/correr (anti-patinação) e `speedRatio` casado à velocidade (seção 5.1).
4. Implementar a `HeroAnimator` (seção 4) para pulo (one-shot subida -> loop no ar -> pouso),
   amarrada ao `LocomotionState` do `player.ts`.
5. Validar o critério de pronto do M1: "andar/correr/parar parece natural, sem deslizar os
   pés" (plano-de-producao seção 4).
6. Só depois: foot IK (seção 6), root motion real para esquiva/investida (seção 5.2) e os
   clipes de combate, já mirando o M2.

Critério de aceite herdado: sem patinação de pés, transições sem trancos, e os tempos de
combate (quando entrarem) batendo com os frames a 60 FPS da spec-combate.

## Fontes

Animação no Babylon
- https://doc.babylonjs.com/features/featuresDeepDive/animation/animationGroup
- https://doc.babylonjs.com/features/featuresDeepDive/animation/groupAnimations
- https://doc.babylonjs.com/features/featuresDeepDive/animation/advanced_animations
- https://doc.babylonjs.com/features/featuresDeepDive/mesh/bonesSkeletons

Blend e weights
- https://doc.babylonjs.com/features/featuresDeepDive/animation/animationGroup#animation-blending
- https://playground.babylonjs.com/#IQN716#9 (blend de pesos walk/run/idle)

Retargeting
- https://doc.babylonjs.com/features/featuresDeepDive/animation/animationRetargeting
- https://doc.babylonjs.com/typedoc/functions/BABYLON.ImportAnimationsAsync

Root motion
- https://forum.babylonjs.com/t/root-motion-animation-system/11488
- https://forum.babylonjs.com/t/how-to-implement-root-motion/

IK
- https://doc.babylonjs.com/features/featuresDeepDive/mesh/bonesSkeletons#boneikcontroller
- https://doc.babylonjs.com/features/featuresDeepDive/mesh/bonesSkeletons#bonelookcontroller

Mixamo
- https://www.mixamo.com/
- https://doc.babylonjs.com/features/featuresDeepDive/Exporters/Workflow
