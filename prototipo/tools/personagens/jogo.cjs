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
  await p.getByText(/novo jogo/i).first().waitFor({ state: "visible", timeout: 60000 });
  await p.waitForTimeout(1000);
  await p.getByText(/novo jogo/i).first().click({ force: true }).catch((e) => console.log("novo jogo:", String(e).slice(0, 80)));
  for (let i = 0; i < 14; i++) {
    await p.waitForTimeout(1300);
    if (await p.evaluate(() => { const e = document.querySelector(".hud-fagulha"); return !!e && getComputedStyle(e).display !== "none"; })) break;
    await p.getByRole("button", { name: /iniciar a descida|^continuar$/i }).last().click({ force: true, timeout: 2000 }).catch(() => {});
  }
  await p.waitForTimeout(4500);
  const emJogo = await p.evaluate(() => { const e = document.querySelector(".hud-fagulha"); return !!e && getComputedStyle(e).display !== "none"; });
  console.log("em jogo:", emJogo);
  if (!emJogo) { await p.screenshot({ path: `${out}/_erro_menu.png` }); await b.close(); process.exit(2); }
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
  if (cenario === "atores") {
    // Draw calls dos atores = (sala inteira) - (sala com todas as malhas skinned, espada, brasa e sombra de contato desligadas)
    const lerDraws = async () => { await p.waitForTimeout(900); const t = await draws(); const m = /draw calls: (\d+)/.exec(t); return m ? Number(m[1]) : -1; };
    for (const i of (process.env.SALAS || "0,1,2,3,4,5,6").split(",").map(Number)) {
      await p.evaluate((i) => window.__brasa.enterRoom(i), i);
      await p.waitForTimeout(6500);
      const total = await lerDraws();
      const info = await p.evaluate(() => {
        const s = window.__brasa.scene;
        const atores = s.meshes.filter((m) => m.isEnabled() && (m.skeleton || /sword|brasa_mao|sombra_de_contato|bronze/i.test(m.name)));
        window.__atores = atores;
        const sks = new Set(s.meshes.filter((m) => m.isEnabled() && m.skeleton).map((m) => m.skeleton.uniqueId));
        window.__atores.forEach((m) => m.setEnabled(false));
        return { malhas: atores.length, esqueletos: sks.size };
      });
      const sem = await lerDraws();
      await p.evaluate(() => window.__atores.forEach((m) => m.setEnabled(true)));
      console.log(`sala ${i}: total ${total}, sem atores ${sem}, atores ${total - sem} draws, ${info.esqueletos} esqueletos (heroi + inimigos), ${info.malhas} malhas`);
      await p.waitForTimeout(500);
      await shot("sala" + i);
    }
  }
  if (cenario === "combate") {
    // Sequencia: observa (idle/andar/ataque dos mortos), depois golpe leve, pesado, esquiva, bloqueio, fogo e uma
    // saraivada de golpes leves ate matar. Salva quadros recortados em volta da heroina (q_XX.png).
    const quadro = async (n) => p.screenshot({ path: `${out}/q_${String(n).padStart(2, "0")}.png`, clip: { x: 500, y: 250, width: 600, height: 420 } });
    let n = 0;
    const wait = (ms) => p.waitForTimeout(ms);
    for (let i = 0; i < 8; i++) { await quadro(n++); await wait(450); }
    for (const [tecla, hold, ap] of [["KeyJ", 60, 110], ["KeyK", 60, 160], ["KeyC", 60, 200], ["KeyE", 60, 150]]) {
      await key(tecla, true); await wait(hold); await key(tecla, false); await wait(ap); await quadro(n++); await wait(250); await quadro(n++); await wait(700);
    }
    await key("KeyQ", true); await wait(350); await quadro(n++); await key("KeyQ", false); await wait(500);
    for (let i = 0; i < 16; i++) { await key("KeyJ", true); await wait(50); await key("KeyJ", false); await wait(260); await quadro(n++); await wait(120); }
    await wait(1500); await quadro(n++); await wait(1500); await quadro(n++);
    console.log("hp:", JSON.stringify(await p.evaluate(() => window.__brasa.hp())), "vivos:", await p.evaluate(() => window.__brasa.enemiesAlive()));
    await shot("c_fim");
  }
  console.log(logs.slice(-8).join("\n"));
  await b.close();
  console.log("ok");
})();
