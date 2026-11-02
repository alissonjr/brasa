#!/usr/bin/env node
/**
 * BASELINE "antes": renderiza offline o áudio ANTIGO (musicManager, adaptiveAmbience e
 * titleAmbience do commit 836036e, anteriores ao barramento único) com o mesmo método e as
 * mesmas medições do render.mjs, para provar o que mudou (besouro, graves abaixo de 60 Hz,
 * loudness). Uso: node tools/audio/baseline_antes.mjs   (precisa de git e do histórico).
 * Os módulos antigos criam o próprio AudioContext; um shim entrega a eles um OfflineAudioContext.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { analyze } from "./metrics.mjs";

const COMMIT = process.env.BASELINE_COMMIT || "836036e";
const here = dirname(fileURLToPath(import.meta.url));
const work = join(tmpdir(), "brasa-baseline-antes");
mkdirSync(work, { recursive: true });
const repoRoot = execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: here }).toString().trim();
for (const f of ["audio/musicManager", "audio/adaptiveAmbience", "ui/titleAmbience"]) {
  const src = execFileSync("git", ["show", `${COMMIT}:prototipo/src/game/${f}.ts`], { cwd: repoRoot }).toString();
  writeFileSync(join(work, basename(f) + ".ts"), src);
}
writeFileSync(
  join(work, "entry.ts"),
  `import { configureMusic, startMusic, setMusicState } from "./musicManager";
import { configureAmbience, startAmbience, setAmbience, updateAmbience } from "./adaptiveAmbience";
import { configureTitleAmbience, startTitleAmbience } from "./titleAmbience";
const SR = 48000;
function b64(f: Float32Array): string { const u8 = new Uint8Array(f.buffer, f.byteOffset, f.byteLength); let s = ""; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s); }
async function run(kind: string) {
  const secs = kind === "titulo" ? 40 : 80;
  const ctx = new OfflineAudioContext(2, secs * SR, SR);
  (window as any).AudioContext = function () { return ctx; };
  configureMusic(() => 1); configureAmbience(() => 1); configureTitleAmbience(() => 1);
  const ev: Array<[number, () => void]> = [];
  if (kind === "musica") { startMusic(); ev.push([36, () => setMusicState("combate")], [58, () => setMusicState("quente")]); }
  if (kind === "ambiencia") { startAmbience(); setAmbience({ depth: 0.3, danger: 0, urgency: 0 }); for (let k = 1; k < secs * 30; k++) ev.push([k / 30, () => updateAmbience(1 / 30)]); ev.push([36, () => setAmbience({ depth: 0.3, danger: 0.7, urgency: 0.2 })], [58, () => setAmbience({ depth: 0.3, danger: 0, urgency: 0 })]); }
  if (kind === "titulo") startTitleAmbience();
  const q = (t: number) => Math.round(t * SR / 128) * 128 / SR;
  const m = new Map<number, Array<() => void>>();
  for (const [t, f] of ev) { const k = q(t); (m.get(k) ?? m.set(k, []).get(k)!).push(f); }
  const ws: Promise<void>[] = [];
  for (const t of [...m.keys()].sort((a, b) => a - b)) if (t > 0 && t < secs - 0.01) ws.push(ctx.suspend(t).then(() => { for (const f of m.get(t)!) f(); void ctx.resume(); }));
  const buf = await ctx.startRendering(); await Promise.all(ws);
  return { sr: SR, left: b64(buf.getChannelData(0)), right: b64(buf.getChannelData(1)) };
}
(window as any).OldAudio = { run };
`,
);
await build({ entryPoints: [join(work, "entry.ts")], bundle: true, format: "iife", outfile: join(work, "bundle.js"), logLevel: "error" });
const req = createRequire(import.meta.url);
let pw;
for (const d of [process.env.PLAYWRIGHT_DIR, "playwright", "/home/alisson/.npm/_npx/e41f203b7505f1fb/node_modules/playwright"].filter(Boolean)) {
  try { pw = req(d); break; } catch { /* próximo */ }
}
const b = await pw.chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const p = await b.newPage();
await p.goto("about:blank");
await p.addScriptTag({ path: join(work, "bundle.js") });
const dec = (s) => { const x = Buffer.from(s, "base64"); return new Float32Array(x.buffer, x.byteOffset, x.byteLength / 4); };
const segs = { musica: { frio: [8, 36], combate: [40, 58], quente: [62, 80] }, ambiencia: { frio: [8, 36], perigo: [40, 58], calmo: [62, 80] }, titulo: { tudo: [6, 40] } };
console.log(`ANTES (commit ${COMMIT}), volumes nominais 1,0`);
for (const k of ["musica", "ambiencia", "titulo"]) {
  const r = await p.evaluate((k) => window.OldAudio.run(k), k);
  const L = dec(r.left), R = dec(r.right);
  for (const [s, [a, c]] of Object.entries(segs[k])) {
    const m = analyze(L, R, r.sr, a, c);
    const lowPct = m.bands["<60"];
    console.log(`${k.padEnd(10)} ${s.padEnd(8)} pico ${m.peakDb.toFixed(1)}  LUFS-I ${m.lufsI.toFixed(1)}  quadros-batimento ${m.beatFrames}  energia<60Hz ${lowPct.toFixed(0)}%`);
  }
}
await b.close();
