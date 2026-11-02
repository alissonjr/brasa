Medição de feel do combate (Playwright com GPU real, sem swiftshader). Tempos de jogo, não fps.

- `lib.cjs`: sobe o jogo (menu até a sala 0) e instala o gravador por quadro (`REC`).
- `medir.cjs <porta> <saida.json> [1 = com alvo de treino]`: dirige J/K/C/Q/E por `KeyboardEvent` e grava os quadros (`REPS` repetições).
- `analisa2.cjs <saida.json>`: por golpe, abertura/fechamento da janela ativa, contato do clipe, fim da recuperação.
- `capdepois.cjs <porta> <pasta> light,heavy,ember,dodge`: capturas a cada 50 ms de mecânica (hit stop congelado + `hero.update` manual).

Use `VW`/`VH` para o tamanho da janela (padrão 800x450: com a GPU compartilhada, 1600x900 trava 300 ms e estraga os tempos).
Exige um Vite com `server.fs.allow` (o `vite.config.ts` do repo dá 403 no wasm do Havok por causa do link de node_modules).
