// Dirige o JOGO COMPLETO (menu -> jogo) e testa o golpe de fogo (fagulha): confirma o
// HUD (3 barras), a conjuracao e o estouro de fogo, sem pageerror.
const PW = "/home/alisson/.npm/_npx/e41f203b7505f1fb/node_modules/playwright";
const { chromium } = require(PW);
const PORT = process.argv[2] || "5173";

(async () => {
  const b = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--ignore-gpu-blocklist", "--enable-unsafe-swiftshader"] });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push("ERR " + e.message.slice(0, 180)));
  p.on("console", (m) => { const t = m.text(); if (/descida|andar|erro|error/i.test(t)) console.log("LOG", t.slice(0, 120)); });

  await p.goto(`http://localhost:${PORT}/?renderer=webgl`, { waitUntil: "load", timeout: 90000 });
  await p.waitForTimeout(9000); // engine + havok + room 0

  // Menu -> Novo Jogo -> Iniciar a descida.
  // CTA primário (Continuar se há autosave, senão Novo Jogo) por CSS, robusto.
  await p.click(".btn-primary", { force: true, timeout: 12000 }).catch((e) => console.log("CLICK cta falhou:", e.message.slice(0, 80)));
  await p.waitForTimeout(1200);
  // Se abriu a criação de personagem, confirma (botão "Iniciar a descida").
  await p.click("text=Iniciar a descida", { force: true, timeout: 4000 }).catch(() => {});
  await p.waitForTimeout(3500); // em jogo; esqueletos se aproximam

  // Anda um pouco para o centro e dispara golpe de fogo (E) + alguns ataques (J).
  const key = (code, down) => p.evaluate(([c, d]) => window.dispatchEvent(new KeyboardEvent(d ? "keydown" : "keyup", { code: c })), [code, down]);
  await key("KeyW", true); await p.waitForTimeout(600); await key("KeyW", false);
  await key("KeyE", true); // golpe de fogo
  await p.waitForTimeout(300);
  await p.screenshot({ path: "/tmp/play_ember.png", timeout: 90000 });
  await key("KeyE", false);
  await p.waitForTimeout(400);
  await p.screenshot({ path: "/tmp/play_hud.png", timeout: 90000 });

  console.log(errs.length ? errs.join("\n") : "SEM PAGEERROR");
  await b.close();
  console.log("DONE");
})().catch((e) => { console.error("FAIL", e.message); process.exit(1); });
