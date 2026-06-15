# Técnica: Pipeline de Assets e Carregamento (Babylon.js)

O fluxo ponta a ponta de um asset 3D, do Blender até a tela, e como o jogo carrega, troca de
área e LIBERA memória. Cobre a lacuna prática que faltava: a parte conceitual de compressão de
textura/geometria está em [`tecnica-graficos-fisica.md`](tecnica-graficos-fisica.md) seções 2
e 9, e as ferramentas/fontes de asset em [`ferramentas-e-assets.md`](ferramentas-e-assets.md);
aqui é o COMO no Babylon (loaders, `AssetsManager`/`AssetContainer`, tela de carregamento,
transição entre áreas, `dispose`).

Liga-se a [`tecnica-arquitetura.md`](tecnica-arquitetura.md) (a gestão de cenas e o serviço de
assets vivem nas camadas ENGINE/PLATAFORMA), [`tecnica-build-e-deploy.md`](tecnica-build-e-deploy.md)
(como os .wasm de Draco/KTX2 e os .glb são servidos pelo Vite) e
[`tecnica-performance-e-profiling.md`](tecnica-performance-e-profiling.md) (orçamento de
download e de VRAM).

## 0. Onde o protótipo está hoje

O `main.ts` já tem o esqueleto de uma tela de carregamento: um `<div id="loading">` e uma
função `stage(msg)` que escreve o passo atual ("Carregando física (Havok)...", "Montando
cena..."). Hoje a cena é montada por código (`environment.ts`, primitivas). A partir do M1/M4
entram .glb de verdade, e esse esqueleto evolui para uma barra de progresso real alimentada
pelo loader (seção 3).

## 1. Pipeline de autoria (Blender -> glTF -> otimização)

Convenção (consolidada com [GDD](../GDD.md) seção 9 e
[`plano-de-producao.md`](plano-de-producao.md)):

1. Autoria no Blender (modelagem + level design). Empties nomeados marcam spawn, gatilhos,
   pontos de câmera e marcadores de objetivo (mesma convenção de
   [`../narrativa/README.md`](../narrativa/README.md): ids sem acento, `snake_case`). Escala:
   1 unidade = 1 metro; pés em y=0 (o `hero.ts` já assume isso); +Z para frente.
2. Export glTF/.glb (binário, um arquivo). Para cenário, separe por área/chunk (seção 5).
3. Otimização com gltf-transform (CLI Node, automatizável num script de build). Ordem típica:

```bash
# Limpeza + dedup + compressão de geometria e textura num passo só.
gltf-transform optimize entrada.glb saida.glb \
  --texture-compress ktx2 \
  --compress draco

# Ou controle fino dos estágios:
gltf-transform dedup            entrada.glb a.glb     # funde malhas/materiais iguais
gltf-transform prune            a.glb b.glb           # remove nós/dados órfãos
gltf-transform draco            b.glb c.glb           # geometria comprimida (Draco)
gltf-transform uastc c.glb d.glb --slots "{normalTexture,...}"  # dados (normal/ORM)
gltf-transform etc1s d.glb final.glb --slots "{baseColorTexture}" # cor (albedo)
```

Regra (de tecnica-graficos-fisica seção 2): ETC1S para albedo/AO, UASTC para normal/roughness/
metallic; junte roughness+metallic+AO num mapa ORM. Geometria em Draco (ou meshopt). O ganho:
KTX2 mantém a textura comprimida na GPU (4-8x menos VRAM); Draco/meshopt cortam 90%+ do tamanho
de download da geometria.

## 2. Carregar no Babylon: registrar loaders e decoders

O `@babylonjs/core` precisa que o loader glTF e os decoders de KTX2 e Draco estejam
registrados; senão um .glb comprimido falha ao abrir. Os decoders são .wasm que o Vite serve
como assets (ver [`tecnica-build-e-deploy.md`](tecnica-build-e-deploy.md)).

```ts
import "@babylonjs/loaders/glTF";          // registra o loader glTF/.glb
import { KhronosTextureContainer2, DracoCompression } from "@babylonjs/core";

// Aponta os transcoders/decoders para os .wasm servidos pelo app (não para o CDN).
KhronosTextureContainer2.URLConfig = {
  jsDecoderModule: "/ktx2/babylon.ktx2Decoder.js",
  wasmUASTCToASTC: "/ktx2/uastc_astc.wasm",
  wasmUASTCToBC7: "/ktx2/uastc_bc7.wasm",
  wasmUASTCToRGBA_UNORM: "/ktx2/uastc_rgba32_unorm.wasm",
  wasmUASTCToRGBA_SRGB: "/ktx2/uastc_rgba32_srgb.wasm",
  wasmZSTDDecoder: "/ktx2/zstddec.wasm",
  jsMSCTranscoder: "/ktx2/msc_basis_transcoder.js",
  wasmMSCTranscoder: "/ktx2/msc_basis_transcoder.wasm",
};
DracoCompression.Configuration = {
  decoder: {
    wasmUrl: "/draco/draco_wasm_wrapper_gltf.js",
    wasmBinaryUrl: "/draco/draco_decoder_gltf.wasm",
    fallbackUrl: "/draco/draco_decoder_gltf.js",
  },
};
```

Mantenha esses .wasm em `public/` (o Vite copia para a raiz do build sem hash). Hospedar
local, e não depender do CDN do Babylon, evita travas de rede/firewall (mesma filosofia do
timeout de WebGPU no `engine.ts`).

## 3. AssetsManager x AssetContainer x ImportMeshAsync

Três APIs, três usos:

- `ImportMeshAsync(url, scene)` / `LoadAssetContainerAsync`: para UM arquivo. Simples; o que o
  protótipo usará primeiro (carregar o Josué no M1).
- `AssetsManager`: fila de várias tarefas (malhas, texturas, binários, áudio) com eventos de
  progresso agregados. Ideal para a TELA DE CARREGAMENTO de uma área (várias coisas de uma vez,
  uma barra só).
- `AssetContainer`: carrega para um container que NÃO entra na cena automaticamente. Você
  controla quando adicionar (`addAllToScene`) e remover (`removeAllFromScene`/`dispose`).
  Essencial para troca de área e descarte de memória (seção 5).

Carregar uma área com barra de progresso:

```ts
import { AssetsManager } from "@babylonjs/core";

function carregarArea(scene: Scene, arquivos: string[], onProgresso: (p: number) => void) {
  const am = new AssetsManager(scene);
  am.useDefaultLoadingScreen = false;     // usamos a nossa tela (#loading do index.html)
  for (const f of arquivos) am.addContainerTask(f, "", "/areas/", f);

  am.onProgress = (restantes, total) => onProgresso(1 - restantes / total);
  return new Promise<AssetContainer[]>((resolve, reject) => {
    const containers: AssetContainer[] = [];
    am.onTaskSuccess = (t: any) => containers.push(t.loadedContainer);
    am.onTaskErrorObservable.add((t) => reject(t.errorObject));
    am.onFinish = () => resolve(containers);
    am.load();
  });
}
```

E a barra evolui o esqueleto que já existe no `index.html`:

```ts
const bar = document.getElementById("loading")!;
await carregarArea(scene, ["jerico_muralha.glb", "gilgal_tendas.glb"],
  (p) => (bar.textContent = `Carregando Jericó... ${Math.round(p * 100)}%`));
```

## 4. Transição entre áreas (pré-carregar + fade)

Trocar de área sem engasgo: pré-carregar a próxima em `AssetContainer`s ENQUANTO a atual ainda
roda, depois um fade curto, troca e descarte. A gestão de cenas em si (estados LOADING/PLAYING)
está em [`tecnica-arquitetura.md`](tecnica-arquitetura.md) e
[`spec-fluxo-e-persistencia.md`](spec-fluxo-e-persistencia.md) seção 2; aqui é a mecânica de
asset:

1. Disparar o load da próxima área em background (não bloqueia o frame).
2. Quando pronto, `fadeOut` (overlay/pós) -> `removeAllFromScene` + `dispose` da área antiga
   (seção 5) -> `addAllToScene` da nova -> reposicionar herói/câmera nos empties -> `fadeIn`.
3. Para o jogo curto do protótipo (uma área de Jericó), isso é simples; para a campanha, vira
   streaming por chunk (seção 6).

Babylon tem `SceneOptimizer` e camadas de transição, mas para um fade basta um overlay HTML/UI
por cima do canvas durante a troca.

## 5. Descarte de memória (dispose) - o ponto que faltava

WebGL/WebGPU não coletam lixo de GPU sozinhos: textura, material, geometria e buffer
continuam na VRAM até você chamar `dispose`. Trocar de área sem descartar é o vazamento mais
comum e o que derruba o jogo no mobile depois de algumas transições.

Disciplina:

```ts
// Ao sair de uma área carregada por container:
container.removeAllFromScene();   // tira da cena
container.dispose();              // libera GPU dos recursos do container

// Para recursos criados à mão (como o environment.ts atual):
mesh.dispose(false, true);        // (disposeMaterialAndTextures = true) libera material+textura
material.dispose(true, true);     // (forceDisposeEffect, forceDisposeTextures)
texture.dispose();

// Trocar a cena inteira (ex.: voltar ao título):
scene.dispose();                  // descarta TUDO da cena; recria uma nova
```

Cuidados específicos:
- Texturas e materiais COMPARTILHADOS entre malhas: só descarte quando ninguém mais usa
  (o `dispose` com `disposeMaterialAndTextures` pode levar junto algo ainda em uso). Em caso de
  dúvida, use `AssetContainer` por área, que delimita o escopo.
- `AnimationGroup`, esqueletos, sistemas de partícula e luzes também precisam de `dispose`
  (ver [`tecnica-animacao-babylon.md`](tecnica-animacao-babylon.md) e
  [`biblia-vfx-e-shaders.md`](biblia-vfx-e-shaders.md)); grupo de animação órfão continua
  avançando e gasta CPU.
- Observables registrados (`scene.onBeforeRenderObservable.add`) precisam ser removidos, senão
  seguram referências e impedem a coleta.
- Verifique no Babylon Inspector: contagem de meshes/materiais/texturas antes e depois da troca
  deve voltar ao baseline. Ver [`tecnica-performance-e-profiling.md`](tecnica-performance-e-profiling.md).

Recomendação: padronize TODA área como um `AssetContainer` próprio desde o M4. Carregar e
descartar área = `addAllToScene`/`removeAllFromScene`+`dispose`. Isso torna o vazamento de
memória improvável por construção.

## 6. Orçamento de download e streaming

Web-first impõe download inicial pequeno (o jogador desiste se demora). Estratégia:
- Bundle inicial mínimo: engine + UI + a PRIMEIRA área. O resto sob demanda.
- Lazy-load por área/capítulo: carregue a área de Jericó quando o capítulo começa, não no
  boot. O Vite faz code-splitting do JS; os .glb/.ktx2 você busca via loader quando precisa.
- Para a campanha (8-15 capítulos), streaming por chunk: dividir a área em pedaços e carregar/
  descartar conforme o jogador anda (tecnica-graficos-fisica seção 9). Não é necessário no
  protótipo (área única), mas a arquitetura por `AssetContainer` já deixa o caminho aberto.
- Orçamentos numéricos (tempo de carga, tamanho de bundle, VRAM) consolidados em
  [`tecnica-performance-e-profiling.md`](tecnica-performance-e-profiling.md).

## 7. Recomendação para o projeto

- M1: `ImportMeshAsync` para o Josué; registrar os loaders e os decoders KTX2/Draco apontando
  para `.wasm` locais (seção 2). Validar o fluxo Blender -> glTF -> Babylon (escala, empties,
  animation groups) já aqui, como pede o plano de produção.
- M4 (passada de arte): cada área vira um `AssetContainer`; evoluir o `#loading` para barra de
  progresso via `AssetsManager` (seção 3); aplicar a disciplina de `dispose` (seção 5) na troca
  título <-> jogo.
- Pipeline gltf-transform (KTX2 + Draco) num script `npm run assets` para não comprimir à mão.
- Medir VRAM e contagem de recursos no Inspector a cada marco com arte; o gate de performance é
  no M4 (plano-de-producao seção 7).

## Fontes

Carregamento e containers
- https://doc.babylonjs.com/features/featuresDeepDive/importers/loadingFileTypes
- https://doc.babylonjs.com/features/featuresDeepDive/Audio/assetManager (AssetsManager)
- https://doc.babylonjs.com/features/featuresDeepDive/scene/assetContainers
- https://doc.babylonjs.com/typedoc/classes/BABYLON.AssetContainer

Compressão e decoders
- https://doc.babylonjs.com/features/featuresDeepDive/materials/using/ktx2Compression
- https://doc.babylonjs.com/features/featuresDeepDive/importers/glTF/draco
- https://gltf-transform.dev/
- https://gltf-transform.dev/cli
- https://www.donmccurdy.com/2024/02/11/web-texture-formats/

Dispose e memória
- https://doc.babylonjs.com/features/featuresDeepDive/scene/optimizeYourScene
- https://doc.babylonjs.com/typedoc/classes/BABYLON.Mesh#dispose
- https://forum.babylonjs.com/t/proper-way-to-dispose-and-free-memory/
