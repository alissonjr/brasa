// Dirige o JOGO completo com GPU real. Uso: node jogo.cjs <porta> <pasta-saida> <cenario>
// cenarios: sala0 | salas (todas as salas + draw calls) | combate (ataque, esquiva, dano, morte)
const { chromium } = require("/home/alisson/.npm/_npx/e41f203b7505f1fb/node_modules/playwright");
const [porta, out, cenario = "sala0"] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ args: ["--use-angle=gl-egl", "--ignore-gpu-blocklist", "--enable-gpu", "--use-gl=angle"] });
  const p = await b.newPage({ viewport: { width: 1600, height: 900 } });
  const logs = [];
  p.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 300)));
  p.on("console", (m) => { const t = m.text(); if (m.type() === "error") console.log("[err]", t.slice(0, 250)); if (/\[perf\]|\[personagens\]/.test(t)) logs.push(t); });
  await p.goto(`http://localhost:${porta}/?renderer=webgl&perf`);
  await p.waitForFunction(() => window.__brasa, null, { timeout: 90000 });
  await p.waitForTimeout(3000);
  await p.getByText(/novo jogo/i).first().click({ force: true, timeout: 12000 }).catch((e) => console.log("novo jogo:", String(e).slice(0, 80)));
  await p.waitForTimeout(1500);
  for (let i = 0; i < 4; i++) {
    await p.getByRole("button", { name: /iniciar a descida|continuar/i }).last().click({ force: true, timeout: 3000 }).catch(() => {});
    await p.waitForTimeout(700);
  }
  await p.waitForTimeout(4500);
  const shot = (n) => p.screenshot({ path: `${out}/${n}.png` });
  const key = (code, down) => p.evaluate(([c, d]) => window.dispatchEvent(new KeyboardEvent(d ? "keydown" : "keyup", { code: c })), [code, down]);
  const draws = () => p.evaluate(() => { const e = [...document.querySelectorAll("div")].find((d) => /^draw calls:/.test(d.textContent || "") && d.children.length === 0); return e ? e.textContent.replace(/\n/g, " | ") : "?"; });
  if (cenario === "sala0") { await shot("sala0"); console.log(await draws()); }
  if (cenario === "salas") {
    for (let i = 0; i < 7; i++) {
      await p.evaluate((i) => window.__brasa.enterRoom(i), i);
      await p.waitForTimeout(4500);
      console.log("sala", i, "drawcalls", await draws());
      await shot("sala" + i);
    }
  }
  if (cenario === "combate") {
    await shot("c0_inicio");
    await key("KeyJ", true); await p.waitForTimeout(120); await shot("c1_ataque_leve"); await key("KeyJ", false);
    await p.waitForTimeout(600);
    await key("Space", true); await p.waitForTimeout(40); await key("Space", false);
    await p.waitForTimeout(900);
    await shot("c2_depois");
  }
  console.log(logs.slice(-8).join("\n"));
  await b.close();
  console.log("ok");
})();
