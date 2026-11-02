// Mede os draw calls de cada andar (0-6) usando o gancho de dev window.__brasa.enterRoom(i)
// e o log "[perf] sala N (kind): X draw calls" do PerfHud. Serve de gate antes/depois de
// cada sistema de exploracao (docs/brasa/spec-exploracao-indice.md, secao 3).
//
// Uso (com o servidor de dev ja rodando):
//   node tools/perf_rooms.cjs [porta] [esperaMsPorSala]
// Usa a GPU real (gl-egl); NAO usar swiftshader: satura a CPU e derruba a maquina para os outros.
// Variaveis: PW_PATH = caminho do modulo playwright (default: cache do npx deste ambiente).
// Nota: o contador do Babylon INCLUI os passes de sombra e de outline; compare sempre o
// DELTA entre duas execucoes com o mesmo ambiente (mesma GPU, mesmos argumentos), nao o valor absoluto.
const PW = process.env.PW_PATH || "/home/alisson/.npm/_npx/e41f203b7505f1fb/node_modules/playwright";
const { chromium } = require(PW);
const PORT = process.argv[2] || "5173";
const WAIT = Number(process.argv[3] || 9000);

(async () => {
  const b = await chromium.launch({ args: ["--use-angle=gl-egl", "--ignore-gpu-blocklist", "--enable-gpu", "--use-gl=angle"] });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [];
  const rows = {};
  p.on("pageerror", (e) => errs.push("ERR " + e.message.slice(0, 180)));
  p.on("console", (m) => {
    const t = m.text();
    const r = /^\[perf\] sala (\d+) \((\w+)\): (\d+) draw calls/.exec(t);
    if (r) rows[r[1]] = { kind: r[2], draws: Number(r[3]) }; // a ultima leitura de cada sala vale
  });
  await p.goto(`http://localhost:${PORT}/?renderer=webgl`, { waitUntil: "load", timeout: 90000 });
  await p.waitForTimeout(10000);
  await p.click(".btn-primary", { force: true, timeout: 12000 }).catch(() => {});
  await p.waitForTimeout(1500);
  await p.click("text=Iniciar a descida", { force: true, timeout: 4000 }).catch(() => {});
  await p.waitForTimeout(4000);
  for (let i = 0; i < 7; i++) {
    await p.evaluate((n) => window.__brasa && window.__brasa.enterRoom(n), i);
    await p.waitForTimeout(WAIT);
  }
  console.log("andar | tipo       | draw calls (limite normativo: 60)");
  for (const k of Object.keys(rows).sort()) console.log(`${k.padStart(5)} | ${rows[k].kind.padEnd(10)} | ${rows[k].draws}`);
  console.log(errs.length ? errs.join("\n") : "SEM PAGEERROR");
  await b.close();
})().catch((e) => { console.error("FAIL", e.message); process.exit(1); });
