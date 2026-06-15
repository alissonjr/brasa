# Técnica: Engines para um RPG 3D no navegador

Documento de pesquisa para a decisão de engine (2025-2026). Escopo: jogo RPG 3D que
precisa rodar no navegador (WebGL2/WebGPU/WASM) e/ou empacotado como desktop
(Electron/Tauri/build nativa). Perfil: possivelmente solo, com auxílio de IA, com
inclinação por Godot. O objetivo é validar ou desafiar essa inclinação com dados.

Ver também o resumo no [GDD](../GDD.md) seção 9.

> DECISÃO DO PROJETO: a engine escolhida foi Babylon.js (TypeScript), por ser web-native
> (plataforma alvo = web primeiro), com WebGPU maduro, física Havok e carga rápida. O
> ponto a planejar é a ausência de editor de cena visual, resolvida usando o Blender como
> editor de níveis (export glTF). O comparativo abaixo permanece como registro do porquê e
> das alternativas (Godot fica como plano-B confortável, sobretudo se o desktop virar
> prioridade).

## Sumário executivo (leia primeiro)

Três descobertas mudam o jogo para este caso específico:

1. Godot 4 NÃO exporta C# para a web. Só GDScript exporta para HTML5. Se você pretende
   usar C# no Godot, perde a web.
2. Godot 4 na web é limitado a WebGL2 + renderer Compatibility. Os renderers bons
   (Forward+/Mobile) e recursos 3D de ponta (SDFGI, VoxelGI de alta qualidade, vários
   efeitos) NÃO funcionam no export web. WebGPU ainda não é suportado no export web. Ou
   seja, o "Godot 3D bonito" dos vídeos de desktop não é o que sai no navegador.
3. Para 3D web puro, as engines nativas de web (Three.js, Babylon.js, PlayCanvas)
   entregam WebGPU em produção hoje, com bundles menores e tempos de carga melhores que
   os exports WASM de engines de desktop.

Adianto a recomendação: para um RPG 3D cujo alvo primário é o navegador, o Godot
continua defensável mas com ressalvas sérias; Babylon.js e PlayCanvas merecem
consideração forte. Se o alvo primário virar desktop com web secundária, o Godot fica
mais confortável. Nota de design: um tactical RPG em diorama (o gênero recomendado no
GDD) não exige 3D pesado, o que ameniza muito as limitações do Godot web.

---

## 1. Godot Engine (export HTML5/WASM + desktop nativo)

O que é e paradigma. Engine completa, open source, com editor visual próprio (sistema
de nodes/cenas). Linguagem principal GDScript (parecida com Python), com suporte a C# e
a GDExtension (C/C++/Rust). Para web, na prática você está preso a GDScript.

Export para web.
- Só WebGL 2.0 via renderer Compatibility. Forward+ e Mobile (os renderers com PBR
  avançado, SDFGI etc.) "não são suportados na plataforma web" segundo a doc oficial.
  WebGPU ainda não está no export web.
- Threads exigem SharedArrayBuffer, que exige headers `Cross-Origin-Opener-Policy:
  same-origin` e `Cross-Origin-Embedder-Policy: require-corp` no servidor. Desde Godot
  4.3 o export single-thread é o padrão (mais fácil de hospedar em itch.io/Poki, mas
  perde paralelismo).
- C# não exporta para web no Godot 4 (só Godot 3 exportava).
- Áudio limitado: desde 4.3 usa Web Audio API em modo Sample, sem AudioEffects, sem
  reverb/Doppler, sem áudio procedural; áudio posicional pode ser pouco confiável.
- Safari tem problemas documentados de compatibilidade com WebGL2; recomenda-se
  Chromium/Firefox.
- Tamanho do bundle: aumentou de forma significativa entre 3.x e 4.0. Jogos simples
  ficam abaixo de ~20 MB, mas projetos 3D maiores crescem. O runtime WASM do Godot 4 é
  pesado comparado a libs JS puras (builds WASM ~40 MB sem compressão, ~5 MB com Brotli).
- Mobile-web: funciona, mas a própria doc avisa que CPU/GPU são "premium" no mobile e
  ainda mais em WASM.

Caminho para desktop. Aqui o Godot brilha. Build nativa real para Windows/macOS/Linux
via export templates. Não precisa de Electron nem Tauri: o desktop é código nativo,
performático, sem overhead de navegador. Diferencial enorme: você escreve uma vez e tem
desktop nativo de qualidade além do export web.

Recursos 3D. No desktop: physics 3D in-house (4.x) com heightmaps para terreno; SDFGI
(GI em tempo real para mundos abertos), VoxelGI, SSR, TAA, volumetric fog, sistema de
animação com state machines, partículas GPU. Atenção: boa parte desses recursos depende
dos renderers Forward+/Mobile, que não existem na web. Na web você tem PBR mais simples
via Compatibility.

Curva de aprendizado / produtividade solo. Muito boa. Editor coeso, GDScript fácil,
ciclo de iteração rápido, tudo num só app. Excelente para solo. Ressalva: GDScript é bem
coberto por LLMs, porém menos que JS/TS/C#, então a assistência de IA tende a ser um
pouco menos precisa.

Licença e custo. MIT, irrevogável. Zero royalties, zero taxas, zero limite de receita,
para sempre. É o ponto mais forte do Godot e o contraste direto com o episódio do
Runtime Fee da Unity (que mostrou que um fornecedor proprietário pode mudar as regras
depois que você já construiu o jogo).

Ecossistema. Comunidade grande e crescente, AssetLib oficial (menor que a Unity Asset
Store), muitos tutoriais.

Casos reais web. Godot é usado para muitos jogos web 2D. Jogos 3D web de destaque são
mais raros, justamente pelas limitações de WebGL2/Compatibility e tamanho de bundle.

Prós para este caso: open source/MIT sem custo; desktop nativo de primeira sem Electron;
editor produtivo para solo; ótimo se o desktop for tão importante quanto a web.
Contras para este caso: web limitada a WebGL2 (sem WebGPU, sem os recursos 3D top); C#
não vai para web; bundle WASM pesado; áudio web capado; performance 3D-web inferior às
libs JS nativas de web.

## 2. Three.js

O que é. Biblioteca de renderização 3D de baixo nível em JavaScript/TypeScript. Não é
engine de jogo: dá scene graph, câmeras, luzes, materiais, renderer. Você monta o resto
(lógica, física, áudio) com libs externas. React Three Fiber (R3F) é o padrão para uso
declarativo em React.

Export web. É nativo de web, não há "export". WebGPU em produção desde r171 (set/2025)
com fallback automático para WebGL2. Bundle ~168 KB gzipped (o menor dos três). Carrega
rápido. Roda bem em mobile-web.

Desktop. Via Tauri (recomendado: ~12 MB de bundle, ~30-40 MB de RAM, abertura sub-0,5 s)
ou Electron (bundle 80-180 MB, idle 200-300 MB de RAM).

Recursos 3D prontos. PBR e iluminação sim; física não (use Rapier WASM ou Cannon-es);
animação básica; sem áudio integrado; sem editor visual; sem terreno/partículas "de
fábrica" (há libs comunitárias). Você monta a engine.

Curva / produtividade solo. Curva inicial mais íngreme. Para um RPG inteiro solo, você
vira o arquiteto de uma engine: muito trabalho de integração. Porém é o ecossistema JS
melhor coberto por LLMs, então a assistência de IA é excelente.

Licença e custo. MIT, grátis, sem royalties.

Ecossistema. O maior de todos: ~5.000.000+ downloads semanais, ~93.000+ stars no
GitHub, R3F/Drei/ecossistema enorme.

Prós: melhor web 3D possível (WebGPU, bundle minúsculo, carga rápida); IA ajuda muito;
MIT. Contras: não é engine; para um RPG você reinventa muita coisa (física, save,
inventário, editor de cenas). Custo de tempo alto para solo.

## 3. Babylon.js

O que é. Engine de jogo completa em JS/TS ("batteries included"): física, áudio, XR,
partículas, sistema de animação com state machines, Node Material Editor (editor visual
de shaders), inspector. Mantida pela Microsoft.

Export web. Nativo. WebGPU maduro desde v8.0 (mar/2025) com shaders WGSL nativos. Bundle
completo ~1,4 MB. Forte em mobile e XR.

Desktop. Tauri ou Electron, igual ao Three.js.

Recursos 3D prontos. Os mais completos entre as libs JS: física integrada com Havok (de
nível comercial, grátis para web) além de Cannon/Oimo; PBR avançado (frequentemente o
render glTF mais fiel dos três); animação com state machines; colisão; áudio; WebXR;
Node Material Editor.

Curva / produtividade solo. Acessível; Playground online permite prototipar sem setup.
Bom equilíbrio: é engine de verdade (menos coisa para reinventar que Three.js), mas em
código (sem editor de cena 3D arrastar-soltar como Godot/PlayCanvas). IA cobre JS/TS
muito bem.

Licença e custo. Apache 2.0, grátis, sem royalties. Respaldo Microsoft.

Ecossistema. ~13.000 downloads semanais, comunidade ativa voltada a jogos, documentação
sólida. Menor que Three.js.

Prós: engine completa nativa de web com WebGPU + Havok + PBR forte; menos reinvenção que
Three.js para um RPG; Apache 2.0; IA ajuda muito. Contras: sem editor de cena visual
completo (mais código que Godot/PlayCanvas); comunidade menor que Three.js; desktop
depende de wrapper.

## 4. PlayCanvas

O que é. Engine + editor visual na nuvem (colaborativo em tempo real, "Figma para 3D"),
arquitetura entity-component. Runtime open source (MIT) sobre WebGL2/WebGPU/WebXR/glTF.
Respaldo da Snap Inc.

Export web. Nativo, dos primeiros runtimes 3D de produção com WebGPU completo, incluindo
compute shaders, mantendo compatibilidade WebGL2. Runtime ~300 KB. Foco explícito em
mobile (compressão ASTC/DXT); frequentemente entrega o melhor frame rate em mobile entre
os três.

Desktop. Tauri ou Electron.

Recursos 3D prontos. Física integrada (Ammo.js) com configuração visual no editor;
animação por componentes; colisão; áudio; editor de cena visual completo (diferencial vs
Three/Babylon).

Curva / produtividade solo. A menor barreira de entrada graças ao editor visual. Ótimo
para solo que quer um fluxo tipo Unity/Godot mas 100% web. Scripting em JS.

Licença e custo. Runtime/engine MIT (grátis). Atenção: o editor na nuvem tem planos
pagos (tier grátis com projetos públicos; privados/colaboração exigem assinatura). Dá
para usar só o engine MIT sem o editor, mas aí perde o principal atrativo.

Ecossistema. ~15.000 downloads semanais; comunidade menor porém dedicada; usado em
anúncios jogáveis e jogos mobile-web. Asset store menor.

Prós: editor visual web + WebGPU + foco mobile + MIT no runtime; fluxo produtivo para
solo; melhor desempenho mobile-web relatado. Contras: editor bom depende de assinatura
paga para projetos privados; comunidade/asset store menores; desktop via wrapper.

## 5. Unity (WebGL/WebGPU export)

O que é. Engine proprietária, completa, editor visual maduro, scripting em C#.

Export web. Só WebGL 2.0; WebGPU ainda experimental (Unity 6.x), não recomendado para
produção. Bundle grande e tempos de carga longos: recomenda-se manter assets totais
abaixo de ~50-100 MB; iOS/Safari impõem limites severos de memória que tornam builds
grandes inviáveis no mobile. Exige otimização agressiva (ASTC, Addressables, Brotli).

Desktop. Build nativa (como Godot), sem necessidade de wrapper.

Recursos 3D prontos. Os mais completos e maduros do mercado (PhysX, Mecanim/Timeline,
PBR, terreno, VFX Graph, GI, URP/HDRP). Mas o caminho web usa pipeline reduzido.

Licença e custo. O Runtime Fee foi cancelado (set/2024). Modelo atual: Personal grátis
abaixo de US$ 200K de receita; Pro ~US$ 2.040-2.200/ano por assento. Proprietário,
fechado: o episódio do Runtime Fee mostrou que termos podem mudar retroativamente.

Prós: engine madura, asset store gigante, desktop nativo, IA cobre C#. Contras: web
fraca (WebGL2, bundle pesado, ruim no iOS, WebGPU só experimental); proprietária com
histórico de quebra de confiança; custo se passar de US$ 200K; overhead para solo.

## 6. Unreal Engine (Pixel Streaming) - breve, inviável para web comum

A Epic removeu o suporte a export HTML5/WebAssembly há anos. A única via web é Pixel
Streaming: o Unreal roda em servidor com GPU, renderiza e transmite vídeo para o
navegador. Custo por GPU dedicada por usuário simultâneo, latência por distância ao
datacenter, infra complexa. Serve para demos arquitetônicas/automotivas premium, não
para distribuir um jogo a muitos jogadores anônimos a custo viável. Royalty padrão do
Unreal: 5% acima de US$ 1M de receita. Descartado para este caso.

## 7. Alternativas emergentes

- Wonderland Engine: engine nativa de web com editor próprio e runtime WASM enxuto, foco
  em WebXR/VR/AR. Forte para experiências imersivas; comunidade pequena, menos provada
  para RPG 3D tradicional.
- Needle Engine: "Three.js com superpoderes", leva conteúdo do Unity/Blender para a web
  sobre Three.js. Bom para sites 3D; menos indicado como engine de RPG do zero.
- Bevy (Rust + WASM): ECS, comunidade vibrante. Contras para solo: sem editor visual
  estável, API muda entre versões (pré-1.0), curva de Rust, IA cobre Rust pior, tooling
  web ainda cru. Promissor, arriscado para entregar um RPG agora.

Veredito sobre emergentes: interessantes, mas nenhuma é a escolha segura para um RPG 3D
web entregue por solo em 2026.

## Tabela de veredito rápido

| Engine | Paradigma / Ling. | Web (API / bundle) | Desktop | 3D pronto p/ RPG | Curva solo + IA | Licença / custo | Nota p/ RPG 3D web |
|---|---|---|---|---|---|---|---|
| Godot | Editor + GDScript (C# não vai p/ web) | WebGL2 só, sem WebGPU, WASM pesado | Nativo (melhor) | Forte no desktop, capado na web | Ótima; IA boa | MIT, grátis, sem royalty | Bom, com ressalvas na web |
| Babylon.js | Engine / JS-TS | WebGPU maduro, ~1,4 MB | Tauri/Electron | Completo: Havok, PBR, anim, áudio | Boa; IA ótima | Apache 2.0, grátis | Muito bom |
| PlayCanvas | Editor nuvem / JS | WebGPU+compute, ~300 KB, forte mobile | Tauri/Electron | Editor visual, Ammo, anim, áudio | Melhor barreira; IA boa | Runtime MIT; editor pago p/ privado | Muito bom |
| Three.js | Lib / JS-TS | WebGPU zero-config, ~168 KB | Tauri/Electron | Render/PBR; sem física/engine | Mais íngreme; IA excelente | MIT, grátis | Bom (muito trabalho) |
| Unity | Editor / C# | WebGL2; WebGPU experimental; bundle pesado | Nativo | O mais completo | Média; IA ótima | Pago acima US$200K; histórico ruim | Médio na web |
| Unreal | Editor / C++/BP | Só Pixel Streaming (servidor GPU) | Nativo | AAA | Alta | 5% royalty > US$1M | Inviável p/ web comum |

## Recomendação

Primeiro, defina a prioridade real entre web e desktop. Isso decide tudo.

Cenário A - a web é o alvo primário (jogo "abre no navegador e joga"). Reconsidere o
Godot como primeira opção. As limitações web são concretas: só WebGL2 (sem WebGPU), sem
os renderers/recursos 3D que fazem o Godot parecer bonito no desktop, bundle WASM pesado,
áudio capado e C# não exporta para web. Melhor escolha técnica: engine nativa de web.
- Babylon.js se você aceita trabalhar em código (TS) e quer engine completa (Havok, PBR,
  WebGPU, áudio, animação) sem reinventar sistemas. Melhor equilíbrio para um RPG solo.
- PlayCanvas se você quer editor visual no estilo Godot/Unity rodando 100% na web, com o
  melhor desempenho mobile. Orce a assinatura do editor para projeto privado, ou use só
  o runtime MIT.
- Three.js só se você quer controle total e tem tempo/IA para montar a engine de RPG por
  cima.
Empacote desktop com Tauri (não Electron), reaproveitando 100% do build web.

Cenário B - desktop é tão ou mais importante que a web. Aqui o viés pelo Godot faz total
sentido e é a recomendação. Desktop nativo de primeira sem Electron, editor produtivo,
GDScript amigável, licença MIT irrevogável sem royalties. Aceite que o export web será um
"modo reduzido" (WebGL2, visual mais simples) e desenhe a arte/escopo para caber nesse
teto. Use GDScript (não C#) para manter a porta web aberta.

Ressalva específica do gênero deste projeto: um tactical RPG em diorama (mapas pequenos,
câmera orbital) não usa o 3D pesado que mais sofre nas limitações do Godot web. Para esse
gênero, o Godot é perfeitamente viável mesmo com a web como alvo primário, e o conforto
do editor + desktop nativo pesa a favor. A recomendação "reconsidere o Godot" vale com
mais força para 3D ambicioso (mundo aberto, terceira pessoa) do que para diorama tático.

Sugestão pragmática de prototipagem (1-2 semanas, quando for construir): monte a mesma
cena mínima (terreno, um personagem animado glTF, câmera, colisão, uma luz/PBR) em Godot
(export web) e em Babylon.js ou PlayCanvas, e compare no SEU público-alvo de
navegador/dispositivo: tamanho do bundle, tempo de carga, FPS no mobile e fidelidade
visual. A decisão final deve sair desse teste com seus próprios assets.

## Fontes

- Godot - Exporting for the Web: https://docs.godotengine.org/en/stable/tutorials/export/exporting_for_web.html
- Godot - aumento de tamanho 3.x -> 4.0: https://github.com/godotengine/godot/issues/68647
- Godot - performance mobile HTML5: https://github.com/godotengine/godot/issues/58836
- Godot - licença MIT: https://godotengine.org/license/
- Godot 4.0 release: https://godotengine.org/article/godot-4-0-sets-sail/
- Godot - SDFGI: https://docs.godotengine.org/en/stable/tutorials/3d/global_illumination/using_sdfgi.html
- Godot - Web Export in 4.3: https://godotengine.org/article/progress-report-web-export-in-4-3/
- Pode o Godot nos prejudicar como a Unity fez?: https://davidserrano.io/can-godot-screw-us-like-unity-did
- Three.js vs Babylon.js vs PlayCanvas (Utsubo): https://www.utsubo.com/blog/threejs-vs-babylonjs-vs-playcanvas-comparison
- Three.js oficial: https://threejs.org/
- MDN - 3D games on the Web: https://developer.mozilla.org/en-US/docs/Games/Techniques/3D_on_the_web
- PlayCanvas oficial: https://playcanvas.com/
- PlayCanvas engine (GitHub): https://github.com/playcanvas/engine
- Unity - WebGPU (manual): https://docs.unity3d.com/6000.3/Documentation/Manual/WebGPU.html
- Unity - WebGL technical overview: https://docs.unity3d.com/6000.2/Documentation/Manual/webgl-technical-overview.html
- Unity - limite ~50 MB mobile WebGL: https://discussions.unity.com/t/unity-6-webgl-build-size-limit-for-phones-is-50mb/948431
- Unity - cancelamento do Runtime Fee: https://unity.com/blog/unity-is-canceling-the-runtime-fee
- Unity - pricing: https://unity.com/products/pricing-updates
- Tauri vs Electron: https://www.gethopp.app/blog/tauri-vs-electron
- Unreal Pixel Streaming vs WebGL/WebGPU: https://vagon.io/blog/pixel-streaming-vs-webgl-vs-webgpu-the-best-solution-for-unreal-engine-web-deployment
- Unreal Pixel Streaming na AWS: https://aws.amazon.com/blogs/gametech/deploy-unreal-engines-pixel-streaming-at-scale-on-aws/
- Wonderland vs Needle: https://wonderlandengine.com/compare/needle/
- Bevy - exemplos: https://bevy.org/examples/
- Bevy em 2025: https://medium.com/solo-devs/bevy-in-2025-rusts-game-engine-taking-over-indie-dev-caec2ae50c09
- Comparativo de engines web 2025 (LogRocket): https://blog.logrocket.com/best-javascript-html5-game-engines-2025/
