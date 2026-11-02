#!/usr/bin/env node
/**
 * Teste de regressão de ÁUDIO do Brasa, sem placa de som. Renderiza OFFLINE (OfflineAudioContext
 * do Chromium, o mesmo motor de WebAudio do Chrome do jogador) os sons do jogo, usando o MESMO
 * código de src/game/audio/*, grava WAV (float32) e mede: picos (dBFS), RMS, fator de crista,
 * clipping, loudness (LUFS BS.1770, integrada/momentânea/curto prazo), energia por faixa de
 * frequência, pares de tons em batimento entre 20 e 300 Hz ("besouro") e vazamento de nós
 * (fontes vivas) ao descer 7 andares. Falha (exit 1) se algum critério de docs/brasa/biblia-audio.md
 * for violado.
 *
 * Uso (a partir de prototipo/):
 *   node tools/audio/render.mjs                 # tudo
 *   node tools/audio/render.mjs --only sfx_      # só casos cujo nome contém "sfx_"
 *   node tools/audio/render.mjs --png            # também gera espectrogramas (precisa de numpy/scipy/matplotlib)
 *   node tools/audio/render.mjs --list
 * Saída: tools/audio/out/*.wav, tools/audio/out/report.json, tabela no terminal.
 * Requisitos: node 20+, esbuild (já em node_modules) e Playwright com Chromium. Se `playwright`
 * não resolver, aponte PLAYWRIGHT_DIR (ex.: /home/alisson/.npm/_npx/e41f203b7505f1fb/node_modules/playwright).
 * Para --png: PYTHONPATH com numpy/scipy/matplotlib (ex.: pip install --target DIR numpy scipy matplotlib).
 */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { build } from "esbuild";
import { analyze } from "./metrics.mjs";
import { writeWav } from "./wav.mjs";
import { CRITERIA, evaluate } from "./criteria.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (n) => args.includes(n);
const opt = (n, d) => {
  const i = args.indexOf(n);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const outDir = resolve(opt("--out", join(here, "out")));
const only = opt("--only", "");
const seed = Number(opt("--seed", "1"));

async function loadPlaywright() {
  const dirs = [process.env.PLAYWRIGHT_DIR, "playwright", "/home/alisson/.npm/_npx/e41f203b7505f1fb/node_modules/playwright"].filter(Boolean);
  const req = createRequire(import.meta.url);
  for (const d of dirs) {
    try {
      return req(d);
    } catch {
      /* tenta o próximo */
    }
  }
  throw new Error("Playwright não encontrado: defina PLAYWRIGHT_DIR");
}

function decode(b64) {
  const b = Buffer.from(b64, "base64");
  return new Float32Array(b.buffer, b.byteOffset, b.byteLength / 4);
}

async function main() {
  mkdirSync(outDir, { recursive: true });
  const bundle = join(outDir, "bundle.js");
  await build({
    entryPoints: [join(here, "entry.ts")],
    bundle: true,
    format: "iife",
    outfile: bundle,
    target: "es2020",
    define: { "import.meta.env": '{"DEV":false}' },
    logLevel: "error",
  });
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch({ args: ["--use-angle=gl-egl", "--ignore-gpu-blocklist", "--enable-gpu", "--use-gl=angle", "--autoplay-policy=no-user-gesture-required"] });
  const page = await browser.newPage();
  await page.goto("about:blank");
  await page.addScriptTag({ path: bundle });
  const list = await page.evaluate(() => window.BrasaAudioTest.cases);
  if (flag("--list")) {
    console.log(list.map((c) => `${c.name} (${c.seconds}s, ${c.kind})`).join("\n"));
    await browser.close();
    return;
  }
  const report = { seed, when: new Date().toISOString(), cases: {} };
  const sel = list.filter((c) => c.name.includes(only));
  for (const c of sel) {
    const t0 = Date.now();
    const r = await page.evaluate(([n, s]) => window.BrasaAudioTest.run(n, s), [c.name, seed]);
    const L = decode(r.left), R = decode(r.right);
    writeWav(join(outDir, `${c.name}.wav`), L, R, r.sr);
    const whole = analyze(L, R, r.sr);
    const segs = {};
    for (const m of r.marks) segs[m.label] = analyze(L, R, r.sr, m.t0, m.t1);
    // para casos sem marcas, o "trecho útil" é o total (efeitos curtos medem pico e momentâneo)
    report.cases[c.name] = { kind: r.kind, seconds: r.seconds, whole, segs, probes: r.probes, statsEnd: r.statsEnd };
    const f = (v, d = 1) => (Number.isFinite(v) ? v.toFixed(d) : "-inf");
    console.log(
      `${c.name.padEnd(26)} pico ${f(whole.peakDb).padStart(6)} dBFS  rms ${f(whole.rmsDb).padStart(6)}  crista ${f(whole.crestDb).padStart(5)}  LUFS-I ${f(whole.lufsI).padStart(6)}  LUFS-M ${f(whole.lufsM).padStart(6)}  quadros-batimento ${whole.beatFrames}  (${((Date.now() - t0) / 1000).toFixed(1)}s)`,
    );
  }
  await browser.close();

  const results = evaluate(report);
  report.criteria = CRITERIA;
  report.results = results;
  writeFileSync(join(outDir, "report.json"), JSON.stringify(report, null, 1));
  const fails = results.filter((r) => !r.ok);
  console.log("\n=== Critérios ===");
  for (const r of results) console.log(`${r.ok ? "OK  " : "FALHA"} ${r.caso.padEnd(24)} ${r.regra.padEnd(34)} ${r.detalhe}`);
  if (flag("--png")) {
    const py = spawnSync("python3", [join(here, "spectro.py"), outDir, opt("--png-dir", resolve(here, "../../mocks/audio"))], { stdio: "inherit" });
    if (py.status !== 0) console.warn("(espectrogramas falharam: confira numpy/scipy/matplotlib e PYTHONPATH)");
  }
  console.log(`\n${fails.length ? `${fails.length} critério(s) falharam` : "todos os critérios passaram"}. Relatório: ${join(outDir, "report.json")}`);
  process.exit(fails.length ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(2);
});
