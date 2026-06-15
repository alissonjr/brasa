// Verifica os 5 tipos de sala (item 3) e o instanciamento do dressing (item 2).
// Percorre KINDS via window.__rebuild(), medindo malhas/thin instances/draw calls e erros.
// Uso: node tools/verify_rooms.cjs <porta>  (precisa do vite dev rodando)
const PW = "/home/alisson/.npm/_npx/e41f203b7505f1fb/node_modules/playwright";
const { chromium } = require(PW);
const PORT = process.argv[2] || "5199";
const URL = `http://localhost:${PORT}/cripta-test.html?renderer=webgl`;
const KINDS = ["guarda", "salao", "cisterna", "santuario", "guardiao"];

(async () => {
  const browser = await chromium.launch({
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message.slice(0, 200)));
  page.on("console", (m) => { const t = m.text(); if (/error|exception|fail/i.test(t)) errors.push("CONSOLE: " + t.slice(0, 160)); });

  await page.goto(URL, { waitUntil: "load", timeout: 90000 });
  await page.waitForFunction(() => window.__scene && window.__scene.meshes.length > 12, { timeout: 60000 }).catch(() => {});
  // Liga instrumentacao de draw calls.
  await page.evaluate(() => {
    const s = window.__scene;
    const eng = s.getEngine();
    window.__dc = () => eng._drawCalls ? eng._drawCalls.current : -1;
  });

  const measure = async (kind) => {
    await page.waitForTimeout(1500);
    return await page.evaluate(() => {
      const s = window.__scene;
      let thin = 0, basesWithThin = 0, realMeshes = 0;
      for (const m of s.meshes) {
        const c = m.thinInstanceCount || 0;
        if (c > 0) { thin += c; basesWithThin++; }
        if (m.getTotalVertices && m.getTotalVertices() > 0 && m.isVisible !== false) realMeshes++;
      }
      return { meshes: s.meshes.length, realMeshes, thin, basesWithThin };
    });
  };

  const rows = [];
  // floorIdx comeca em 0 = guarda (ja construida no load).
  for (let i = 0; i < KINDS.length; i++) {
    const before = errors.length;
    const r = await measure(KINDS[i]);
    rows.push({ kind: KINDS[i], ...r, newErrors: errors.length - before });
    if (i < KINDS.length - 1) await page.evaluate(() => window.__rebuild());
  }

  console.log("KIND        meshes  realVis  thinInst  basesThin  erros");
  for (const r of rows)
    console.log(
      r.kind.padEnd(10), String(r.meshes).padStart(6), String(r.realMeshes).padStart(7),
      String(r.thin).padStart(8), String(r.basesWithThin).padStart(9), String(r.newErrors).padStart(6)
    );
  console.log("TOTAL pageerrors:", errors.length);
  if (errors.length) errors.slice(0, 10).forEach((e) => console.log("  ERR:", e));
  await browser.close();
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
