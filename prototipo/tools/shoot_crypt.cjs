// Captura a sala-cripta de Brasa (Chromium headless via Playwright), do dev server.
// Uso: node tools/shoot_crypt.cjs <porta>  (precisa do vite dev rodando)
const PW = "/home/alisson/.npm/_npx/e41f203b7505f1fb/node_modules/playwright";
const { chromium } = require(PW);
const PORT = process.argv[2] || "5193";
const URL = `http://localhost:${PORT}/cripta-test.html?renderer=webgl`;

(async () => {
  const browser = await chromium.launch({
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on("console", (m) => console.log("PAGE:", m.text().slice(0, 160)));
  page.on("pageerror", (e) => console.log("PAGEERR:", e.message.slice(0, 200)));

  await page.goto(URL, { waitUntil: "load", timeout: 90000 });
  await page.waitForFunction(() => window.__scene && window.__scene.meshes.length > 12, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(8000);
  const n = await page.evaluate(() => (window.__scene ? window.__scene.meshes.length : -1));
  console.log("MESHES:", n);

  // Dispara um ataque do herói (tecla J) para flagrar a animação de golpe.
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyJ" })));
  await page.waitForTimeout(170);
  // Visão de jogo (3a pessoa, câmera ativa padrão) durante o swing.
  await page.screenshot({ path: "/tmp/crypt_view.png", timeout: 90000 });
  console.log("SHOT /tmp/crypt_view.png");
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyJ" })));

  // Visão orbital de PERTO no herói, durante um golpe (confirma a animação de ataque).
  await page.evaluate(() => {
    const s = window.__scene, o = window.__orbit;
    if (s && o) {
      o.setTarget(new (o.target.constructor)(0, 1.1, -1.5));
      o.alpha = 0.15; o.beta = 1.18; o.radius = 11;
      s.activeCamera = o;
    }
  });
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyJ" })));
  await page.waitForTimeout(150);
  await page.screenshot({ path: "/tmp/crypt_skeleton.png", timeout: 90000 });
  await page.evaluate(() => window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyJ" })));
  console.log("SHOT /tmp/crypt_skeleton.png");
  await browser.close();
  console.log("DONE");
})().catch((e) => {
  console.error("FAIL", e.message);
  process.exit(1);
});
