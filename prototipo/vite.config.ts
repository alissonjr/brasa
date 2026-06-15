import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";

// O Havok carrega um .wasm. O import `?url` em physicsService.ts resolve o caminho
// do asset corretamente no dev e no build, então não é preciso copiar nada à mão.
// Mantemos o pacote fora do pre-bundle do esbuild para evitar problemas com o wasm.
//
// Aliases das camadas (ver docs/tecnica-arquitetura.md): cada camada é importada
// SOMENTE pelo seu barrel (@engine, @platform, @game), nunca por caminho profundo.
export default defineConfig({
  // base relativo: o build funciona tanto na raiz quanto numa subpasta
  // (GitHub Pages publica o jogo em /<repo>/play/). Ver docs/tecnica-build-e-deploy.md.
  base: "./",
  resolve: {
    alias: {
      "@engine": fileURLToPath(new URL("./src/engine/index.ts", import.meta.url)),
      "@platform": fileURLToPath(new URL("./src/platform/index.ts", import.meta.url)),
      "@game": fileURLToPath(new URL("./src/game/index.ts", import.meta.url)),
    },
  },
  optimizeDeps: {
    exclude: ["@babylonjs/havok"],
  },
  build: {
    target: "es2020", // suporta top-level await do init do Havok
    chunkSizeWarningLimit: 2000, // Babylon e grande; o aviso padrao de 500 KB e ruido aqui
    rollupOptions: {
      output: {
        // Separa o Babylon do codigo do jogo: melhora cache entre deploys
        // (o bundle do engine so muda quando o Babylon muda).
        manualChunks: {
          babylon: ["@babylonjs/core"],
          loaders: ["@babylonjs/loaders"],
        },
      },
    },
  },
  server: {
    port: 5173,
    host: true,
  },
});
