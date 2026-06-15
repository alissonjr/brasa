// Captura a cidade de Jericó NO JOGO (Chrome headless via Playwright), do dev server.
// Uso: node tools/shoot_jerico.cjs  (precisa do vite dev rodando em :5173)
const PW = "/home/alisson/.npm/_npx/e41f203b7505f1fb/node_modules/playwright";
const { chromium } = require(PW);

const URL = "http://localhost:5190/jerico-test.html?renderer=webgl";

(async () => {
  const browser = await chromium.launch({
    channel: "chrome",
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"],
  });
  const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  page.on("console", (m) => console.log("PAGE:", m.text()));
  page.on("pageerror", (e) => console.log("PAGEERR:", e.message));

  await page.goto(URL, { waitUntil: "load", timeout: 90000 });
  // espera a cena montar (glbs carregam async)
  await page.waitForFunction(() => window.__scene && window.__scene.meshes.length > 60, { timeout: 90000 });
  await page.waitForTimeout(6000);
  const n = await page.evaluate(() => window.__scene.meshes.length);
  console.log("MESHES:", n);

  const Z = 105; // centro de Jericó (J.z)
  const shots = [
    { name: "top", a: -Math.PI / 2, b: 0.02, r: 360, t: [0, 2, Z] },
    { name: "approach", a: Math.PI / 2, b: 1.0, r: 175, t: [0, 8, Z] },
    { name: "gate", a: Math.PI / 2, b: 1.32, r: 58, t: [0, 4, Z - 47] },
    { name: "inside", a: Math.PI / 2, b: 1.42, r: 30, t: [0, 3, Z] },
    { name: "street", a: Math.PI / 2, b: 1.46, r: 15, t: [-22, 2.6, Z - 9] },
    { name: "casa", a: -Math.PI / 2, b: 1.12, r: 11, t: [22, 2.6, Z + 17] },
    { name: "field", a: 2.2, b: 1.15, r: 30, t: [40, 1, Z + 55] },
  ];
  for (const s of shots) {
    try {
      // re-espera __cam (a página pode ter recarregado por HMR durante a captura)
      await page.waitForFunction(() => !!(window.__cam && window.__cam.target && window.__scene && window.__scene.meshes.length > 60), { timeout: 40000 });
      await page.evaluate((s) => {
        const c = window.__cam;
        c.target.x = s.t[0]; c.target.y = s.t[1]; c.target.z = s.t[2];
        c.alpha = s.a; c.beta = s.b; c.radius = s.r;
      }, s);
      await page.waitForTimeout(1500);
      await page.screenshot({ path: `/tmp/game_${s.name}.png` });
      console.log("SHOT", s.name);
    } catch (e) {
      console.log("SHOT_SKIP", s.name, String(e).slice(0, 80));
    }
  }
  await browser.close();
  console.log("SHOOT_DONE");
})().catch((e) => {
  console.error("SHOOT_FAIL", e);
  process.exit(1);
});
