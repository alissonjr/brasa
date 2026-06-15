// Testa o descarte de sala (gerenciador uma-sala-por-vez): conta meshes, troca de
// sala (__rebuild), reconta. Se o dispose falhar, a contagem ~dobra.
const PW = "/home/alisson/.npm/_npx/e41f203b7505f1fb/node_modules/playwright";
const { chromium } = require(PW);
const PORT = process.argv[2] || "5173";
const URL = `http://localhost:${PORT}/cripta-test.html?renderer=webgl`;

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"] });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  p.on("pageerror", (e) => console.log("PAGEERR:", e.message.slice(0, 160)));
  await p.goto(URL, { waitUntil: "load", timeout: 90000 });
  await p.waitForFunction(() => window.__scene && window.__scene.meshes.length > 12, { timeout: 60000 }).catch(() => {});
  await p.waitForTimeout(7000);
  const m1 = await p.evaluate(() => window.__scene.meshes.length);
  console.log("MESHES_sala0:", m1);
  // Troca de sala 3x (descarta a anterior cada vez).
  for (let i = 0; i < 3; i++) {
    await p.evaluate(() => window.__rebuild());
    await p.waitForTimeout(1200);
  }
  const m2 = await p.evaluate(() => window.__scene.meshes.length);
  console.log("MESHES_apos_3_trocas:", m2);
  console.log(m2 <= m1 * 1.3 ? "DESCARTE_OK (sem acumulo)" : "VAZAMENTO (meshes acumulando!)");
  await p.evaluate(() => { window.__scene.activeCamera = window.__orbit; const o = window.__orbit; o.setTarget(new (o.target.constructor)(0, 1.6, 3)); o.alpha = -Math.PI / 2; o.beta = 1.08; o.radius = 17; });
  await p.waitForTimeout(1200);
  await p.screenshot({ path: "/tmp/crypt_rebuilt.png", timeout: 90000 });
  console.log("SHOT /tmp/crypt_rebuilt.png");
  await b.close();
  console.log("DONE");
})().catch((e) => { console.error("FAIL", e.message); process.exit(1); });
