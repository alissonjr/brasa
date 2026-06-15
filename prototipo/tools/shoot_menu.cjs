// Captura as telas de menu de Brasa (Playwright headless) do dev server.
// Uso: node tools/shoot_menu.cjs <porta>  (precisa do vite dev rodando)
const PW = "/home/alisson/.npm/_npx/e41f203b7505f1fb/node_modules/playwright";
const { chromium } = require(PW);
const PORT = process.argv[2] || "5190";
const URL = `http://localhost:${PORT}/?renderer=webgl`;

const wait = (p, ms) => p.waitForTimeout(ms);

(async () => {
  const browser = await chromium.launch({
    args: ["--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"],
  });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on("pageerror", (e) => console.log("PAGEERR:", e.message.slice(0, 200)));

  await page.goto(URL, { waitUntil: "load", timeout: 90000 });
  await page.waitForSelector(".menu-panel.cinematic", { timeout: 60000 });
  await page.waitForSelector(".title-screen .model-stage-ready", { timeout: 30000 }).catch(() => console.log("WARN title model not ready"));
  await wait(page, 2000);
  await page.screenshot({ path: "/tmp/menu_title.png" });
  console.log("SHOT title");

  // Narrow layout (empilhado) para checar o breakpoint.
  await page.setViewportSize({ width: 560, height: 900 });
  await wait(page, 1200);
  await page.screenshot({ path: "/tmp/menu_title_narrow.png" });
  console.log("SHOT title narrow");
  await page.setViewportSize({ width: 1280, height: 800 });
  await wait(page, 800);

  // Criação de personagem.
  await page.click('button:has-text("Novo Jogo")');
  await page.waitForSelector(".create-panel-spread", { timeout: 30000 });
  await page.waitForSelector(".create-spread .model-stage-ready", { timeout: 30000 }).catch(() => console.log("WARN create model not ready"));
  await wait(page, 2000);
  await page.screenshot({ path: "/tmp/menu_create.png" });
  console.log("SHOT create");

  // Troca de manto (deve recolorir o nicho) -> "Azul do poço".
  await page.click('.swatch:has-text("Azul do poço")').catch(() => {});
  await wait(page, 800);
  await page.screenshot({ path: "/tmp/menu_create_manto.png" });
  console.log("SHOT create manto");

  // Volta e abre a Crônica via Perfil.
  await page.click('button:has-text("Cancelar")');
  await page.waitForSelector(".menu-panel.cinematic", { timeout: 20000 });
  await page.click('button:has-text("Perfil")');
  await page.waitForSelector(".profile-stats", { timeout: 20000 }).catch(() => {});
  await wait(page, 500);
  await page.click('button:has-text("Crônica")');
  await page.waitForSelector(".codex-panel", { timeout: 20000 });
  await wait(page, 800);
  await page.screenshot({ path: "/tmp/menu_codex_list.png" });
  console.log("SHOT codex list");

  // Abre o primeiro verbete clicável (personagem com 3D).
  await page.click(".codex-row.clickable");
  await page.waitForSelector(".codex-panel-spread", { timeout: 20000 }).catch(() => console.log("WARN codex entry not spread"));
  await page.waitForSelector(".codex-panel-spread .model-stage-ready", { timeout: 40000 }).catch(() => console.log("WARN codex model not ready"));
  await wait(page, 2500);
  // timeout folgado: o 2o contexto WebGL (vitrine do verbete) deixa o swiftshader lento.
  await page.screenshot({ path: "/tmp/menu_codex_entry.png", timeout: 90000 });
  console.log("SHOT codex entry");

  await browser.close();
  console.log("DONE");
})().catch((e) => {
  console.error("FAIL", e.message);
  process.exit(1);
});
