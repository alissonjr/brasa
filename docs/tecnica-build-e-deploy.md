# Técnica: Build, Deploy e Cross-Origin Isolation (Babylon + Vite)

Como sair do `npm run dev` para um build de produção publicado na web, com foco nos pontos
específicos da stack Babylon.js + Havok WASM + WebGPU que não aparecem num projeto web comum:
empacotar os `.wasm`, comprimir, e a questão dos headers COOP/COEP/SharedArrayBuffer (relevante
se usar o build multithread do Havok). O lado Godot dessa questão está em
[`tecnica-engines.md`](tecnica-engines.md) e [`tecnica-graficos-fisica.md`](tecnica-graficos-fisica.md);
aqui é o lado Babylon.

Liga-se a [`tecnica-assets-e-carregamento.md`](tecnica-assets-e-carregamento.md) (como os
decoders KTX2/Draco são servidos), [`tecnica-performance-e-profiling.md`](tecnica-performance-e-profiling.md)
(tamanho de bundle e tempo de carga) e [`plano-de-producao.md`](plano-de-producao.md) (publicar
build desde o M0/M4 para medir no alvo).

## 0. Onde o protótipo está hoje

`package.json`: `build` = `tsc && vite build` (gera `dist/` estático, publicável em
itch.io/Netlify/Pages). `vite.config.ts` já faz o essencial não óbvio: mantém
`@babylonjs/havok` fora do pre-bundle do esbuild (`optimizeDeps.exclude`), porque o pacote
carrega um `.wasm` via `new URL("HavokPhysics.wasm", import.meta.url)` e o esbuild quebraria
essa resolução. O `physics.ts` confirma: o Vite resolve esse asset no dev e no build sem cópia
manual. O `engine.ts` tenta WebGPU com timeout e cai para WebGL2.

Este documento parte daí e descreve o que falta para um deploy sério.

## 1. Build do Vite para produção

Configuração recomendada (estende o `vite.config.ts` atual):

```ts
import { defineConfig } from "vite";

export default defineConfig({
  // base relativo: funciona tanto na raiz quanto numa subpasta (GitHub Pages, itch.io zip).
  base: "./",
  optimizeDeps: { exclude: ["@babylonjs/havok"] },  // já existe; não pre-bundlar o wasm
  build: {
    target: "es2020",          // bate com o tsconfig; suporta top-level await do init do Havok
    sourcemap: false,          // ligue em "hidden" para depurar produção sem expor
    chunkSizeWarningLimit: 2000, // Babylon ~1,4 MB; o aviso padrão de 500 KB é ruído aqui
    rollupOptions: {
      output: {
        manualChunks: {
          babylon: ["@babylonjs/core"],
          loaders: ["@babylonjs/loaders"],
        },
      },
    },
  },
});
```

Pontos:
- `base: "./"` evita o erro clássico de assets 404 quando o jogo não está na raiz do domínio
  (itch.io serve dentro de um path; GitHub Pages idem em `usuario.github.io/repo/`).
- `manualChunks` separa o Babylon (grande e estável, cacheável) do código do jogo (muda
  sempre). Melhora o cache entre versões.
- Assets `?url`: o import com `?url` (como o Havok faz internamente) é a forma de pegar o
  caminho final com hash. Os decoders KTX2/Draco e os `.wasm` que você controla ficam em
  `public/` (copiados sem hash, com caminho previsível, ver
  [`tecnica-assets-e-carregamento.md`](tecnica-assets-e-carregamento.md)).
- WebGPU: o transpiler WGSL (twgsl/glslang) é buscado em CDN por padrão; o `engine.ts` já tem
  um timeout para não travar se a rede falhar. Para tirar a dependência de CDN, hospede esses
  `.wasm` localmente e aponte a config do Babylon para eles (mesma lógica dos decoders).

## 2. Compressão dos estáticos (Brotli/gzip)

O ganho de download vem de: KTX2/Draco nos assets (já em
[`tecnica-assets-e-carregamento.md`](tecnica-assets-e-carregamento.md)) MAIS compressão HTTP do
JS/wasm/html. O `.wasm` do Havok e os bundles JS comprimem muito bem com Brotli.

- Em hospedagem que comprime sozinha (Netlify, Cloudflare Pages): nada a fazer, elas servem
  Brotli/gzip automaticamente.
- Em hospedagem estática "burra" (itch.io zip, alguns CDNs): pré-comprima no build e sirva os
  `.br`/`.gz`, ou aceite o tamanho cru. Plugin: `vite-plugin-compression` gera `.br` e `.gz` no
  `dist/`. Em itch.io não dá para escolher o Content-Encoding, então a pré-compressão tem
  utilidade limitada lá; o que mais importa é o KTX2/Draco nos assets pesados.
- Atenção: comprimir um `.wasm` que o navegador instancia via streaming (`instantiateStreaming`)
  exige `Content-Encoding` correto; em servidor que cuida disso (Netlify), funciona transparente.

## 3. Cross-origin isolation (COOP/COEP/SharedArrayBuffer)

O ponto Babylon/Havok específico. `SharedArrayBuffer` (memória compartilhada entre threads, base
de qualquer WASM multithread) só fica disponível se a página estiver "cross-origin isolated", o
que exige DOIS headers no servidor:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

Quando isso importa para o nosso caso:
- O build PADRÃO (single-thread) do Havok NÃO precisa de SharedArrayBuffer, logo NÃO precisa
  desses headers. Roda em qualquer hospedagem estática (inclusive itch.io). É o que o protótipo
  usa hoje.
- O build MULTITHREAD do Havok (física em vários workers, ganho em cenas com muitos corpos)
  PRECISA de SharedArrayBuffer, logo PRECISA dos headers COOP/COEP.

Decisão recomendada para o projeto: ficar no Havok single-thread. O jogo é focado em duelo
(3-5 inimigos, spec-combate), poucos corpos físicos ativos; o multithread não compensa a dor de
cabeça de headers (especialmente em itch.io). Reavaliar só se o profiling (gate do M4) apontar a
física como gargalo de CPU.

Como setar os headers SE precisar (dev e produção):

```ts
// vite.config.ts - dev server isolado (para testar multithread localmente)
server: {
  headers: {
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Embedder-Policy": "require-corp",
  },
}
```

```
# Netlify: arquivo public/_headers
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
```

Limitações de hospedagem:
- GitHub Pages NÃO deixa setar headers custom: não dá para isolar cross-origin lá. Sem
  multithread (ou usar o coi-serviceworker, abaixo).
- itch.io NÃO deixa setar headers: mesma situação. (É a mesma nota que vale para o export
  multithread do Godot, em tecnica-engines.md.)
- Workaround `coi-serviceworker`: um service worker que injeta os headers no cliente, habilitando
  SharedArrayBuffer mesmo sem controle do servidor. Funciona em GitHub Pages/itch.io na maioria
  dos navegadores, com ressalvas (primeira carga, alguns navegadores). Só vale a pena se o
  multithread for mesmo necessário.
- COEP `require-corp` quebra recursos de terceiros sem CORP/CORS (fontes, imagens, CDNs):
  outra razão para hospedar tudo localmente (o que já recomendamos para os `.wasm`).

## 4. Hospedagem comparada

| Hospedagem | Estático | Headers custom (COOP/COEP) | Compressão | Nota para Babylon+WASM |
|---|---|---|---|---|
| itch.io | zip estático | Não | Não configurável | Ótima vitrine/funil; single-thread Havok OK; multithread só via coi-serviceworker |
| GitHub Pages | sim | Não | gzip básico | Grátis, simples; sem isolamento cross-origin |
| Netlify | sim | Sim (`_headers`) | Brotli/gzip auto | Melhor equilíbrio para o projeto (headers + compressão) |
| Cloudflare Pages | sim | Sim (`_headers`) | Brotli/gzip auto | Excelente CDN/cache; igualmente boa |

Recomendação por fase:
- Desde o M0: publicar em itch.io (vitrine + compartilhável, casa com o tema) E em Netlify ou
  Cloudflare Pages (onde dá para controlar headers e medir com tudo ligado). Publicar cedo é
  regra do plano de produção.
- Produção: Netlify/Cloudflare como canal "completo"; itch.io como demo grátis/funil (GDD seção
  11).

## 5. Desktop com Tauri (reaproveitando o build web)

Quando/se o desktop entrar (pós-protótipo), empacote o MESMO `dist/` com Tauri (não Electron):
bundle leve, abertura rápida, sem o overhead do Chromium embarcado. O build web continua sendo a
fonte única; o Tauri só o embrulha. Comparativo em [`tecnica-engines.md`](tecnica-engines.md).
Vantagem extra: no desktop você controla os headers, então o multithread do Havok fica viável
sem ginástica.

## 6. Checklist de release

- [ ] `npm run build` limpo (`tsc` sem erro + `vite build`).
- [ ] `base: "./"` para funcionar em subpath (itch.io/Pages).
- [ ] Decoders KTX2/Draco e (opcional) transpiler WGSL hospedados localmente em `public/`.
- [ ] Assets em KTX2 + Draco (script `npm run assets`, ver tecnica-assets-e-carregamento).
- [ ] Testar o `dist/` com `npm run preview` antes de publicar.
- [ ] Medir no navegador/dispositivo alvo: tempo de carga, tamanho transferido, FPS
      (tecnica-performance-e-profiling).
- [ ] Decidir single-thread (padrão, sem headers) x multithread (headers/coi-serviceworker).
- [ ] Publicar em pelo menos um host com headers (Netlify/Cloudflare) para validar com tudo
      ligado.

## Fontes

Vite
- https://vitejs.dev/config/build-options
- https://vitejs.dev/guide/assets
- https://github.com/vbenjs/vite-plugin-compression

Babylon + WASM
- https://doc.babylonjs.com/setup/frameworkPackages/es6Support
- https://doc.babylonjs.com/features/featuresDeepDive/physics/havokPlugin
- https://forum.babylonjs.com/t/havok-physics-multithreading/

Cross-origin isolation
- https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer#security_requirements
- https://web.dev/articles/coop-coep
- https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cross-Origin-Embedder-Policy
- https://github.com/gzuidhof/coi-serviceworker

Hospedagem e desktop
- https://docs.netlify.com/routing/headers/
- https://developers.cloudflare.com/pages/configuration/headers/
- https://itch.io/docs/creators/html5
- https://tauri.app/
