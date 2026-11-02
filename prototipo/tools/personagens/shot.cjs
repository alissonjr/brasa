// Captura de pagina com GPU real (sem swiftshader). Uso: node shot.cjs <url> <saida.png> [espera-ms] [js-opcional]
// Um navegador por vez; sempre ?renderer=webgl. Espera window.__pronto se existir.
const { chromium } = require("/home/alisson/.npm/_npx/e41f203b7505f1fb/node_modules/playwright");
const fs = require("fs");
const [url, out, espera = "1500", js] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ args: ["--use-angle=gl-egl", "--ignore-gpu-blocklist", "--enable-gpu", "--use-gl=angle"] });
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  p.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 300)));
  p.on("console", (m) => { const t = m.text(); if (m.type() === "error" || /perf|AVISO|\[personagens\]/.test(t)) console.log("[console]", t.slice(0, 300)); });
  await p.goto(url);
  try { await p.waitForFunction(() => window.__pronto === true, null, { timeout: 60000 }); } catch { console.log("sem __pronto"); }
  await p.waitForTimeout(Number(espera));
  if (js) { const r = await p.evaluate(js); if (r !== undefined) console.log(JSON.stringify(r)); await p.waitForTimeout(600); }
  await p.screenshot({ path: out });
  await b.close();
  console.log("ok", out);
})();
