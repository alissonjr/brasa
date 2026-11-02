// Captura a página de dev dos murais (mocks/mural) na GPU real (nunca swiftshader) e roda as
// verificações de teclado/foco da placa. Uso: servir com `npx vite --port 5780` e rodar
//   node tools/shoot_mural.cjs [pastaDeSaida] [porta]
// Um navegador por vez. Saídas: 1600x900 e 390x844.
const PW = "/home/alisson/.npm/_npx/e41f203b7505f1fb/node_modules/playwright";
const { chromium } = require(PW);
const path = require("path");
const fs = require("fs");
const OUT = process.argv[2] || path.join(__dirname, "..", "..", "docs", "brasa", "img", "murais");
const PORT = process.argv[3] || "5780";
const URL = `http://127.0.0.1:${PORT}/mocks/mural/index.html`;
fs.mkdirSync(OUT, { recursive: true });

(async () => {
  const b = await chromium.launch({ args: ["--use-angle=gl-egl", "--ignore-gpu-blocklist", "--enable-gpu", "--use-gl=angle"] });
  const errs = [];
  const checks = [];
  const ok = (name, cond) => checks.push(`${cond ? "OK  " : "FALHA"} ${name}`);

  for (const [w, h, tag] of [[1600, 900, "d"], [390, 844, "m"]]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
    p.on("pageerror", (e) => errs.push(`${tag} PAGEERROR ${e.message}`));
    p.on("console", (m) => { if (m.type() === "error") errs.push(`${tag} CONSOLE ${m.text()}`); });
    p.on("requestfailed", (r) => errs.push(`${tag} REQFAIL ${r.url()}`));
    await p.goto(URL, { waitUntil: "load" });
    await p.evaluate(() => document.fonts.ready);
    await p.waitForFunction(() => document.body.dataset.ready || document.body.dataset.err, null, { timeout: 20000 });
    const err = await p.evaluate(() => document.body.dataset.err || "");
    if (err) errs.push(`${tag} texture ${err}`);
    await p.waitForTimeout(400);

    // --- sete andares x dois estados
    for (let n = 1; n <= 7; n++) {
      for (const s of ["f", "a"]) {
        const loc = p.locator(`#p${n}${s}`);
        await loc.scrollIntoViewIfNeeded();
        await loc.screenshot({ path: path.join(OUT, `${tag}-a${n}-${s === "f" ? "frio" : "aceso"}.png`) });
      }
    }
    await p.locator("#alf").screenshot({ path: path.join(OUT, `${tag}-alfabeto.png`) });
    await p.locator("#land").screenshot({ path: path.join(OUT, `${tag}-paisagem.png`), timeout: 30000 });

    // --- placa ao vivo: teclado e foco
    await p.locator("#stage").scrollIntoViewIfNeeded();
    await p.selectOption("#sel-andar", "3");
    await p.focus("#b-abrir");
    await p.keyboard.press("r");
    await p.waitForTimeout(300);
    const dlg = p.locator('.mural-plate[role="dialog"]');
    ok(`${tag} R abre a placa`, (await dlg.count()) === 1 && (await dlg.isVisible()));
    ok(`${tag} foco na placa`, await p.evaluate(() => document.activeElement?.classList.contains("mural-plate")));
    ok(`${tag} frio: nome acessivel nao revela mortos`, await p.evaluate(() => {
      const s = document.querySelector(".mural-pane--vem");
      return s.getAttribute("aria-label").includes("escuro") && !s.querySelector(".mural-sr");
    }));
    await p.locator("#stage").screenshot({ path: path.join(OUT, `${tag}-ao-vivo-frio.png`) });
    await p.keyboard.press("Tab");
    ok(`${tag} Tab vai ao botao fechar`, await p.evaluate(() => document.activeElement?.classList.contains("mural-close")));
    await p.keyboard.press("Tab");
    ok(`${tag} Tab volta a placa (foco preso)`, await p.evaluate(() => document.activeElement?.classList.contains("mural-plate")));
    await p.keyboard.press("r");
    await p.waitForTimeout(100);
    ok(`${tag} R fecha`, (await dlg.count()) === 0);
    ok(`${tag} foco restaurado`, await p.evaluate(() => document.activeElement?.id === "b-abrir"));
    await p.keyboard.press("r");
    await p.waitForTimeout(150);
    await p.keyboard.press("Escape");
    await p.waitForTimeout(100);
    ok(`${tag} Esc fecha`, (await dlg.count()) === 0);
    // abrir frio, acender com a placa aberta, ver a luz subir
    await p.click("#b-abrir");
    await p.waitForTimeout(250);
    await p.click("#b-acender");
    await p.waitForTimeout(300);
    await p.locator("#stage").screenshot({ path: path.join(OUT, `${tag}-ao-vivo-subindo.png`) });
    await p.waitForTimeout(1400);
    ok(`${tag} aceso: lista falada existe`, (await p.locator(".mural-root .mural-sr li").count()) >= 3);
    ok(`${tag} aceso: nome do painel liberado`, await p.evaluate(() => !document.querySelector(".mural-pane--vem").hasAttribute("aria-label")));
    await p.locator("#stage").screenshot({ path: path.join(OUT, `${tag}-ao-vivo-aceso.png`) });
    if (tag === "m") {
      await p.evaluate(() => { const e = document.querySelector(".mural-plate"); e.scrollTop = e.scrollHeight; });
      await p.waitForTimeout(150);
      await p.locator("#stage").screenshot({ path: path.join(OUT, `${tag}-ao-vivo-aceso-fim.png`) });
    }
    console.log(tag, "lista:", (await p.locator(".mural-root .mural-sr li").allTextContents()).join(" | "));
    await p.keyboard.press("Escape");

    // --- variantes: alto contraste e zoom 200% (somente desktop), ingles
    if (tag === "d") {
      await p.click("#t-hc");
      await p.click("#b-abrir"); // frio de novo? estado atual: aceso
      await p.waitForTimeout(500);
      await p.locator("#stage").screenshot({ path: path.join(OUT, `${tag}-alto-contraste-aceso.png`) });
      await p.keyboard.press("Escape");
      await p.click("#b-frio"); // volta ao frio
      await p.click("#b-abrir");
      await p.waitForTimeout(400);
      await p.locator("#stage").screenshot({ path: path.join(OUT, `${tag}-alto-contraste-frio.png`) });
      await p.keyboard.press("Escape");
      await p.click("#t-hc");
      await p.click("#t-en");
      await p.click("#b-abrir");
      await p.waitForTimeout(400);
      await p.locator("#stage").screenshot({ path: path.join(OUT, `${tag}-ingles-frio.png`) });
      await p.keyboard.press("Escape");
      await p.click("#t-en");
    }
    await p.close();
  }
  await b.close();
  console.log(checks.join("\n"));
  console.log(errs.length ? errs.join("\n") : "SEM ERROS DE PAGINA/CONSOLE/REDE");
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
