// Screenshot orbital de N tipos de sala para conferencia visual.
const PW = "/home/alisson/.npm/_npx/e41f203b7505f1fb/node_modules/playwright";
const { chromium } = require(PW);
const PORT = process.argv[2] || "5199";
const SHOTS = Number(process.argv[3] || "2"); // quantos tipos capturar (0=guarda,1=salao,...)
const URL = `http://localhost:${PORT}/cripta-test.html?renderer=webgl`;
const KINDS = ["guarda", "salao", "cisterna", "santuario", "guardiao"];

(async () => {
  const browser = await chromium.launch({
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  await page.goto(URL, { waitUntil: "load", timeout: 90000 });
  await page.waitForFunction(() => window.__scene && window.__scene.meshes.length > 12, { timeout: 60000 }).catch(() => {});
  // Camera orbital alta olhando o salao inteiro.
  const frame = async () => page.evaluate(() => {
    const s = window.__scene, o = window.__orbit;
    o.setTarget(new (o.target.constructor)(0, 1.0, 2));
    o.alpha = -Math.PI / 2; o.beta = 0.95; o.radius = 26;
    s.activeCamera = o;
  });
  for (let i = 0; i < SHOTS; i++) {
    await frame();
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `/tmp/room_${KINDS[i]}.png`, timeout: 90000 });
    console.log("SHOT", `/tmp/room_${KINDS[i]}.png`);
    if (i < SHOTS - 1) await page.evaluate(() => window.__rebuild());
  }
  await browser.close();
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
