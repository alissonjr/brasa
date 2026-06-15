# Técnica: Gráficos e Física para um RPG 3D no Navegador

Documentação técnica das técnicas por trás de cada elemento do ambiente (iluminação,
texturas, terreno, água, vegetação, roupas, animação, física) e o que é viável quando o
jogo roda no navegador (WebGL2 / WebGPU). A web tem restrições próprias que mudam quase
todas as decisões: orçamento de memória menor, um thread principal sensível, tempo de
download importa, e o suporte a WebGPU ainda está em transição. Cada seção traz o
trade-off de performance específico para web.

Ver também [GDD](../GDD.md) seção 9 e [`tecnica-engines.md`](tecnica-engines.md).

> DECISÃO DO PROJETO (reancoragem): a engine é Babylon.js (TypeScript) e o gênero é
> action-RPG 3D em 3a pessoa, web-first (ver [GDD](../GDD.md) e
> [`tecnica-engines.md`](tecnica-engines.md)). Boa parte deste documento foi escrita ainda na
> fase de pesquisa, antes de fechar engine e gênero, então traz exemplos de API de Three.js e
> uma recomendação final que ainda hesitava entre engines/gêneros. O CONTEÚDO técnico (as
> técnicas em si) continua válido e independe de engine; onde havia API de Three.js, o texto
> foi reancorado no Babylon (thin instances, `AnimationGroup`, `PhysicsCharacterController`).
> A comparação de engines da seção 0 fica como registro histórico. Para o COMO no Babylon,
> ver os docs técnicos dedicados: [`tecnica-animacao-babylon.md`](tecnica-animacao-babylon.md),
> [`tecnica-assets-e-carregamento.md`](tecnica-assets-e-carregamento.md),
> [`tecnica-performance-e-profiling.md`](tecnica-performance-e-profiling.md),
> [`tecnica-deformacao-de-tecidos.md`](tecnica-deformacao-de-tecidos.md) e
> [`biblia-vfx-e-shaders.md`](biblia-vfx-e-shaders.md).

## 0. As três engines e o que cada uma implica (resumo técnico)

- Three.js: biblioteca de renderização, leve, "GPU-heavy". Não é game engine completa:
  física, animação de estado, networking são montados com libs externas.
- Babylon.js: game engine completa em JS. Usa mais CPU para gerência de cena, dando
  frame times previsíveis com milhares de objetos. Já vem com PBR robusto, física por
  plugins (Havok/Ammo/Cannon/Oimo), editor e tooling. WebGPU maduro.
- Godot 4 (export web): engine completa "desktop-first" que exporta via WebAssembly.
  Armadilha: o export web só roda no método Compatibility (WebGL 2.0); Forward+/Mobile e
  WebGPU não funcionam no navegador, então técnicas avançadas (GI moderna, SDFGI,
  volumetria) que aparecem em vídeos de Godot desktop não estão disponíveis no Godot web.
  Além disso o multithreading via SharedArrayBuffer exige headers COOP/COEP no servidor;
  sem eles cai em single-thread.

Resumo do trade-off de engine: Three.js e Babylon.js falam WebGPU nativamente (o que
viabiliza GI realtime, compute shaders para cloth etc.); Godot web está preso a WebGL2.

## 1. Iluminação

Conceito. O padrão moderno é PBR (Physically Based Rendering): materiais respondem à luz
seguindo conservação de energia (modelo metallic-roughness do glTF).

Tipos de luz. Direcional (o sol, luz-chave do deserto, barata); ambiente (preenchimento
global, normalmente de um cubemap/HDRI via IBL); pontual/spot (tochas, lamparinas; cada
luz com sombra custa caro, limite quantas projetam sombra).

Sombras. Shadow maps (universal, único método realista na web). Cascaded Shadow Maps
(CSM): divide o frustum em fatias de distância com resolução decrescente; essencial para
luz direcional em mundo aberto (perto nítido, longe com textura menor).

Iluminação global (GI). Luz que ressalta de superfície em superfície.
- Baked lightmaps: GI pré-calculada offline e "assada" em texturas aplicadas à geometria
  estática. É a opção viável e recomendada para web: custo de runtime quase zero, só
  memória de textura. Limitação: só geometria e luzes estáticas.
- GI em tempo real: existe e avança na web, mas é cara. Babylon implementa GI baseada em
  Reflective Shadow Maps e recomenda WebGPU para isso. Há demos WebGPU com 400+ luzes,
  CSM, reflexões Hi-Z e TAA, mas é estado da arte e pesado.
- Light probes: amostram a luz indireta em pontos do espaço para que objetos dinâmicos
  (o personagem) recebam GI aproximada. Combinação clássica: lightmaps no cenário +
  light probes nos personagens.

Ambient Occlusion (SSAO). Escurece fendas e contatos. SSAO (screen-space) é o método de
runtime; custa um passe de pós-processamento e pesa em mobile. Para cenário estático, é
melhor assar o AO em textura.

HDRI / skybox. Uma imagem de céu em alto alcance dinâmico usada como skybox e como fonte
de IBL (reflexos e luz ambiente). Para deserto, um HDRI de céu límpido resolve skybox +
ambiente + reflexos de uma vez: a forma mais eficiente de iluminação ambiente na web.

Viável na web (resumo): PBR metallic-roughness sim; direcional + CSM + alguns pontos sem
sombra sim; IBL via HDRI sim (barato); SSAO com parcimônia; GI assada (lightmaps) é o
caminho, GI realtime só com WebGPU como recurso premium.

## 2. Texturas e Materiais

Os mapas PBR: albedo (cor base), normal (relevo sem geometria extra), roughness,
metallic, AO (oclusão assada), height/displacement (caro, usar com cuidado).

Tiling. Repetir uma textura pequena por uma superfície grande; combata a repetição
visível misturando escalas, usando detail maps ou quebrando com decals.

Compressão de textura para web (ponto crítico). Texturas JPG/PNG são descomprimidas para
a VRAM: uma 4096x4096 com mipmaps ocupa ~90 MB de VRAM. Já KTX2 + Basis Universal
permanecem comprimidas na GPU.
- ETC1S (BasisLZ): padrão, qualidade baixa/média, tamanho comparável a JPEG. Bom para
  cor (albedo), ruim para mapas de dados (normals).
- UASTC: qualidade superior (equivalente a BC7), serve cor e dados, com compressão
  Zstandard; arquivos 1-2x maiores que JPEG.
- KTX2 transcodifica em runtime para o formato nativo da GPU; redução de 4-8x em VRAM e
  uploads 4-8x mais rápidos. Loaders em Three.js e Babylon.
Regra prática: ETC1S para albedo/AO, UASTC para normal/roughness/metallic. Combine
roughness+metallic+AO num único mapa (canais ORM).

Atlas. Juntar várias texturas pequenas numa só imagem reduz draw calls e trocas de
material. Útil para props de cenário.

Decals. Projeções de textura sobre a superfície existente (manchas, rachaduras,
sujeira). Quebram a repetição do tiling sem nova geometria.

Ferramentas. glTF Transform e RapidCompact para converter/comprimir em KTX2 num pipeline
automatizado.

## 3. Terreno

- Heightmaps: imagem em tons de cinza onde cada pixel codifica altitude. Barato, fácil de
  editar; Three.js e Babylon geram malha a partir dele.
- Terreno esculpido: modelado manualmente (Blender ou editor de terreno) para dunas e
  leitos de rio específicos.
- Texture splatting / blending: mistura várias texturas (areia, cascalho, grama seca,
  lama) num splatmap (pesos por canal RGBA). No Babylon, o NodeMaterial monta esse
  blending.
- LOD de terreno: trocar densidade de malha conforme distância. Um plano único não
  permite LOD nem culling; para mundo aberto use sistema dedicado (Dynamic Terrain do
  Babylon, Terrain3D no Godot).
- Geração procedural: Diamond-Square ou noise (Perlin/Simplex). THREE.Terrain gera e
  texturiza por elevação/bioma/inclinação e espalha vegetação.

Trade-off web. Terreno costuma ser o maior consumidor de vértices. Heightmap + chunks com
LOD + frustum culling é o combo viável. Evite displacement por vértice em malha densa;
prefira normal maps para detalhe fino.

## 4. Água (rio Jordão, Mar Morto)

Água é quase sempre um shader sobre uma superfície plana, não simulação física.
- Normal maps animados: dois ou mais normal maps deslizando criam ondulação. Mais barato;
  ótimo para o Jordão calmo.
- Reflexão e refração: reflexão por planar reflection (re-renderiza a cena espelhada,
  caro) ou por cubemap/SSR; refração distorce o fundo via screen-space. Fresnel controla
  quanto reflete por ângulo.
- Foam (espuma): gerada onde a água encontra geometria (margens, pedras). Para web, foam
  só nas interseções dá o melhor custo-benefício.
- Gerstner waves: deslocam vértices em movimento circular para ondas pontudas (mar
  aberto). FFT é mais preciso porém pesado; Gerstner é o meio-termo viável.

Custo na web. A reflexão planar é o item caro. Para rio/lago num RPG, prefira: superfície
com ~128 segmentos por lado no máximo, Gerstner suave, normal maps animados, foam só nas
margens, reflexão por cubemap/HDRI em vez de planar. O Mar Morto parado pode ser quase só
normal maps + reflexão de céu.

## 5. Vegetação e Plantas

O desafio é renderizar milhares de plantas sem milhares de draw calls.
- Grama (GPU instancing): uma geometria de lâmina/quad enviada uma vez e replicada
  dezenas de milhares de vezes num único draw call. No Babylon, thin instances
  (`mesh.thinInstanceAdd`) empacotam milhares de cópias num só draw call (e há `SolidParticleSystem`
  para casos com variação por instância). Projetos chegam a 100.000 quads balançando.
- Billboards: para vegetação distante/densa, planos com textura transparente sempre
  virados para a câmera substituem geometria 3D.
- Árvores: geometria 3D real perto (com LOD), virando billboard ao longe.
- Wind (vento): animação procedural no vertex shader (tipicamente duas ondas senoidais
  rotacionando vértices ao redor da base). Roda na GPU, combina com instancing.
  Referências clássicas: capítulos do GPU Gems da NVIDIA.
- Ferramentas: SpeedTree é o padrão da indústria, mas caro/licenciado. Para web, domina
  vegetação procedural via shaders próprios + instancing; alternativas grátis incluem o
  gerador de árvores do Blender.

Trade-off web. Instancing + wind no vertex shader + LOD para billboard ao longe +
frustum culling. O custo está no número de instâncias visíveis e no overdraw das
transparências dos billboards (cuidado com alpha blending em excesso).

## 6. Roupas e Pano (cloth) - túnicas, mantos, capas

A grande decisão: simular ou animar?
- Animação por esqueleto / blend shapes: a túnica é geometria skinned presa a ossos
  extras, ou usa morph targets para poses. Barato, determinístico, viável em qualquer
  engine web. É o que a maioria dos RPGs faz para roupas comuns.
- Simulação de cloth real: física Verlet ou massa-mola que reage a movimento, gravidade
  e vento. Mais convincente para capas esvoaçantes, porém cara.

Viabilidade real-time na web. O WebGPU muda o jogo: estudo de 2024-2026 mostra cloth a
60fps com até ~640 mil nós em WebGPU, enquanto WebGL trava acima de ~10 mil nós (compute
shaders são ideais para a tarefa).

Técnica híbrida recomendada. Misturar skinning e cloth na mesma malha por vertex
painting: pinte a parte que deve virar pano (barra da túnica, ponta do manto) e use essa
máscara para mesclar vértice skinned e vértice simulado. Mantenha a parte de cloth como
malha separada para não simular o que não precisa.

Veredito. Roupas normais por skinning. Capas/mantos importantes (herói, NPCs-chave) por
cloth híbrido com vertex painting, idealmente em WebGPU. Em WebGL puro, cloth deve ser
bem limitado ou substituído por animação fake de vento via vertex shader.

## 7. Movimentação e Animação de Personagens

- Rigging: criar o esqueleto e fazer o skinning (vincular vértices a ossos com pesos).
- Skeletal animation: animar transformando ossos; a malha segue. Suportado nativamente
  por Three.js e Babylon.
- Blending / state machines: transições suaves entre animações (parado -> andar ->
  correr) por interpolação de poses, numa máquina de estados. Evita "trancos".
- Root motion: a animação carrega o deslocamento real do personagem (pés não escorregam).
- IK (Inverse Kinematics): calcula rotação dos ossos a partir de um alvo (pés que se
  ajustam ao terreno, mão que pega objeto, mira). Custa por frame, mas é localizado.
- Retargeting: reaproveitar animação de um esqueleto em outro de proporções diferentes
  (mocap -> seu personagem). O Babylon (v9) tem retargeting de animação e
  `ImportAnimationsAsync` com `targetConverter` para aplicar clipes de um arquivo sobre outro
  rig; ver o passo a passo em [`tecnica-animacao-babylon.md`](tecnica-animacao-babylon.md)
  seção 7.
- Locomotion: andar/correr/atacar com blend de pesos + root motion + foot IK. Use Mixamo
  para um banco inicial de animações + retargeting. O COMO no Babylon (AnimationGroup, blend,
  máquina de estados, root motion, foot IK) está em
  [`tecnica-animacao-babylon.md`](tecnica-animacao-babylon.md).

Trade-off web. Skeletal animation é barata. O custo cresce com o número de personagens
animados ao mesmo tempo. IK e cloth pesam por personagem; reserve-os para protagonista e
NPCs próximos, com LOD de animação para os distantes.

## 8. Física

Cada engine usa um motor diferente:
- Godot: Godot Physics (próprio) e integração Jolt (antes Bullet). No export web, sem
  multithread, a física roda no mesmo thread da lógica.
- Three.js / Babylon (JS), escolha a lib:
  - Rapier (Rust -> WASM): rápido e moderno, ganhos claros sobre o Cannon. Escolha
    recomendada hoje para web.
  - ammo.js (port de Bullet): completo e maduro, API verbosa e mais pesada.
  - cannon-es (JS puro): simples, bom para protótipo, mais lento que Rapier.
  - Havok: Babylon integra via WASM (alta performance, padrão recomendado pelo Babylon).

Componentes. Rigidbodies (corpos dinâmicos); collision shapes (use primitivas - cápsula,
caixa, esfera; mesh colliders são caros; para prédios, colliders convexos simplificados);
character controller (cinemático, geralmente cápsula, resolve colisão/degraus/inclinação
manualmente; é o que move o herói); ragdoll (ao morrer, corpos rígidos ligados por
joints).

Trade-off web. Física é trabalho de CPU e compete com a lógica no thread principal
(sobretudo no Godot web single-thread). Mantenha poucos corpos ativos, durma (sleep) os
parados, use colliders simples, prefira Rapier ou Havok. Ragdoll só no momento da morte e
limitado a poucas instâncias.

## 9. Otimização para Web

Orçamentos concretos das fontes:
- Draw calls: menos de ~100 para 60fps suave na web (mobile 100-300; PC nativo 2000+). O
  overhead é de CPU/driver.
- Batching e instancing: static batching (junta objetos imóveis com mesmo material em
  build time), dynamic batching (junta pequenos objetos móveis em runtime), instancing
  (replica a mesma geometria num draw call; até ~60% de ganho). No Babylon, thin instances
  para muitas cópias da mesma malha, `instances` (instanced meshes) para cópias com transformações
  próprias, e merge de malhas estáticas (`Mesh.MergeMeshes`) para juntar geometria imóvel.
- LOD: troca por versões de menos polígonos com a distância; reduz 50-90% sem perda
  perceptível.
- Culling: frustum culling (não desenha fora do campo de visão, automático no Babylon);
  occlusion culling (não desenha o escondido; até ~90% de ganho em cenas densas, ex.: ruas
  estreitas de cidade murada).
- Orçamento: personagens 1.000-5.000 polígonos; texturas em KTX2 (~10x menos VRAM);
  geometria em Draco (90-95% menor no arquivo).
- Streaming de assets: carregar o mundo em pedaços conforme o jogador se move, em vez de
  tudo de uma vez. Essencial para download inicial pequeno.

Linha-mestra: na web o gargalo costuma ser CPU (draw calls, física, animação) e memória
de VRAM (texturas), não shaders. Priorize batching/instancing, compressão KTX2 e assar
iluminação.

## Recomendação: stack técnica realista para um RPG 3D web

Engine. Decidida: Babylon.js (TypeScript), pelo perfil web-first do projeto e pelo WebGPU
maduro + Havok (ver [`tecnica-engines.md`](tecnica-engines.md)). Para um action-RPG 3D em 3a
pessoa, que mostra mais mundo que um diorama, o teto visual e a física integrada do Babylon
pesam a favor. Alvo de renderer: WebGPU com fallback automático para WebGL2 (já implementado
no protótipo, ver `prototipo/src/engine.ts`).

O que PRIORIZAR (alto valor, custo controlado na web):
1. PBR metallic-roughness + IBL via 1 HDRI de deserto (resolve skybox, ambiente e
   reflexos barato).
2. Luz direcional (sol) com CSM + poucas luzes pontuais sem sombra.
3. GI assada em lightmaps para o cenário estático + light probes para personagens.
4. KTX2/Basis para todas as texturas, Draco para geometria.
5. Instancing + wind no vertex shader para vegetação; LOD para billboard ao longe.
6. Terreno por heightmap em chunks com LOD + frustum culling + texture splatting.
7. Skeletal animation com blend trees + root motion + foot IK só para personagens
   próximos. Mixamo + retargeting para popular o banco.
8. Física com Havok (Babylon), colliders primitivos, character controller em cápsula
   (`PhysicsCharacterController`, já no protótipo), sleep agressivo.
9. Orçamento rígido: <100 draw calls, personagens 1k-5k tris, atlas, occlusion culling,
   streaming por chunk.

O que EVITAR ou adiar (caro demais para web no v1): GI em tempo real / path tracing;
reflexão planar de água (use cubemap/HDRI + normal maps + foam nas margens); cloth
simulado na malha inteira (use híbrido só em capas-chave); mesh colliders complexos e
muitos rigidbodies/ragdolls; displacement/tessellation por vértice em terreno; contar com
Godot Forward+/SDFGI/volumetria no navegador (não funcionam no export web hoje).

## Fontes

Engines e comparação
- https://blog.logrocket.com/three-js-vs-babylon-js/
- https://dev.to/devin-rosario/babylonjs-vs-threejs-the-360deg-technical-comparison-for-production-workloads-2fn6
- https://deepwiki.com/godotengine/godot-docs/7.4-web-platform-export
- https://godotengine.org/article/progress-report-web-export-in-4-3/
- https://best-games.io/blog/godot-web-export-optimization-guide

Iluminação
- https://doc.babylonjs.com/features/featuresDeepDive/lights/rsmgi
- https://forum.babylonjs.com/t/webgpu-real-time-global-illumination/51680
- https://www.webgpu.com/showcase/deferred-rendering-in-webgpu-sponza/
- https://unframework.com/portfolio/simple-global-illumination-lightmap-baker-for-threejs/

Texturas e materiais
- https://www.donmccurdy.com/2024/02/11/web-texture-formats/
- https://github.com/KhronosGroup/glTF/blob/main/extensions/2.0/Khronos/KHR_texture_basisu/README.md
- https://doc.babylonjs.com/features/featuresDeepDive/materials/using/ktx2Compression
- https://gltf-transform.dev/modules/extensions/classes/KHRTextureBasisu

Terreno
- https://github.com/IceCreamYou/THREE.Terrain
- https://doc.babylonjs.com/communityExtensions/dynamicTerrains/
- https://medium.com/@trushkinsimon/semi-procedural-landscape-with-babylonjs-e9373bc3091d

Água
- https://sbcode.net/threejs/gerstnerwater/
- https://threejs.org/examples/webgl_shaders_ocean.html
- https://moldstud.com/articles/p-mastering-realistic-water-effects-in-threejs-techniques-and-tips-for-stunning-visuals

Vegetação
- https://tympanus.net/codrops/2025/02/04/how-to-make-the-fluffiest-grass-with-three-js/
- https://al-ro.github.io/projects/grass/
- https://developer.nvidia.com/gpugems/gpugems3/part-i-geometry/chapter-6-gpu-generated-procedural-wind-animations-trees
- https://discourse.threejs.org/t/procedural-instanced-forest-high-performance-real-trees/88610

Cloth
- https://arxiv.org/html/2507.11794v1
- https://medium.com/@pablobandinopla/simple-cloth-simulation-with-three-js-and-compute-shaders-on-skeletal-animated-meshes-acb679a70d9f

Animação de personagens
- https://doc.babylonjs.com/features/featuresDeepDive/animation/animationRetargeting
- https://doc.babylonjs.com/features/featuresDeepDive/mesh/bonesSkeletons
- https://threejs.org/examples/webgl_animation_skinning_blending.html
- https://forum.babylonjs.com/t/root-motion-animation-system/11488

Física
- https://discourse.threejs.org/t/rapier-vs-cannon-performance/53475
- https://github.com/jongomez/ragdoll.js/
- https://discourse.threejs.org/t/character-controller/89137/19

Otimização web
- https://www.utsubo.com/blog/threejs-best-practices-100-tips
- https://www.alpha3d.io/kb/game-development/optimize-3d-assets-performance/
- https://kindatechnical.com/game-development/level-of-detail-culling-and-draw-call-optimization.html
- https://pulsegeek.com/articles/optimize-draw-calls-in-a-game-engine-practical-steps/
