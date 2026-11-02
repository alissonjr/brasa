// Captura os mocks do redesenho da descida (docs/brasa/redesenho-da-descida.md) na GPU real (nunca swiftshader).
// Uso: servir prototipo/ (ex.: python3 -m http.server 5640) e rodar
//   node tools/shoot_redesenho.cjs [pastaDeSaida]   (default: docs/brasa/img/redesenho)
// Um navegador por vez; viewport 1600x900; sem capturas de pagina inteira (pesadas demais para o repo).
const PW = "/home/alisson/.npm/_npx/e41f203b7505f1fb/node_modules/playwright";
const { chromium } = require(PW);
const path = require("path");
const fs = require("fs");
const OUT = process.argv[2] || path.join(__dirname, "..", "..", "docs", "brasa", "img", "redesenho");
const BASE = "http://127.0.0.1:5640/mocks/redesenho/";
fs.mkdirSync(OUT, { recursive: true });

const PAGES = [
  { file: "index.html", full: "laco-pagina.png", parts: { "#laco": "laco-fluxo.png", "#comparacao": "laco-comparacao.png" } },
  { file: "camaras.html", full: "camaras-pagina.png", parts: { "#c1": "c1-camara-dos-bancos.png", "#c2": "c2-salao-do-acampamento.png", "#c3": "c3-cisterna-que-cede.png", "#c4": "c4-salao-das-grades.png", "#c5": "c5-santuario-das-duas.png", "#c6": "c6-forja-da-primeira-fagulha.png", "#c7": "c7-camara-da-brasa.png" } },
  { file: "antessala.html", full: "antessala-pagina.png", parts: { "#antessala": "antessala-planta.png", "#mural-a3": "mural-a3-aceso.png", "#mural-a7": "mural-a7-frio.png", "section.panel:has(#alfabeto)": "mural-alfabeto.png", "#armario": "armario-ui.png", "section.panel:has(#story)": "gole-storyboard.png" } },
];

(async () => {
  const b = await chromium.launch({ args: ["--use-angle=gl-egl", "--ignore-gpu-blocklist", "--enable-gpu", "--use-gl=angle"] });
  const p = await b.newPage({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
  const errs = [];
  p.on("pageerror", (e) => errs.push("PAGEERROR " + e.message));
  p.on("console", (m) => { if (m.type() === "error") errs.push("CONSOLE " + m.text()); });
  p.on("requestfailed", (r) => errs.push("REQFAIL " + r.url()));
  for (const pg of PAGES) {
    await p.goto(BASE + pg.file, { waitUntil: "load" });
    await p.evaluate(() => document.fonts.ready);
    await p.waitForTimeout(400);
    for (const [sel, name] of Object.entries(pg.parts)) {
      const loc = p.locator(sel).first();
      await loc.scrollIntoViewIfNeeded();
      await p.waitForTimeout(120);
      await loc.screenshot({ path: path.join(OUT, name) });
      const box = await loc.boundingBox();
      console.log(`${name}: ${Math.round(box.width)}x${Math.round(box.height)}`);
    }
  }
  await b.close();
  console.log(errs.length ? errs.join("\n") : "SEM ERROS DE PAGINA/CONSOLE/REDE");
})().catch((e) => { console.error("FAIL", e); process.exit(1); });
