// Teste de integração do ÁUDIO no jogo real (Chromium com GPU, nunca swiftshader):
//  - sobe o jogo, entra na descida, confere que o contexto está rodando e que sai som;
//  - mudo (tecla M) silencia o barramento e desmudo volta;
//  - desce os 7 andares com __brasa.enterRoom(i) e compara as fontes vivas (osciladores/buffers)
//    no começo e no fim: não pode crescer (nada vaza);
//  - sem pageerror.
// Uso: node tools/audio/play_audio_check.cjs [porta]   (Vite DEV na porta; ver README de tools)
const PW = process.env.PLAYWRIGHT_DIR || "/home/alisson/.npm/_npx/e41f203b7505f1fb/node_modules/playwright";
const { chromium } = require(PW);
const PORT = process.argv[2] || "5680";

(async () => {
  const b = await chromium.launch({ args: ["--use-angle=gl-egl", "--ignore-gpu-blocklist", "--enable-gpu", "--use-gl=angle", "--autoplay-policy=no-user-gesture-required"] });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [];
  p.on("pageerror", (e) => errs.push("PAGEERROR " + e.message.slice(0, 200)));
  await p.goto(`http://localhost:${PORT}/?renderer=webgl`, { waitUntil: "load", timeout: 90000 });
  await p.waitForTimeout(9000);
  await p.click(".btn-primary", { force: true, timeout: 12000 }).catch(() => {});
  await p.waitForTimeout(1200);
  await p.click("text=Iniciar a descida", { force: true, timeout: 4000 }).catch(() => {});
  await p.waitForTimeout(3000);

  // analisador no mestre: mede o que realmente sai
  await p.evaluate(() => {
    const A = window.__brasaAudio;
    const bus = A.bus();
    const an = bus.ctx.createAnalyser();
    an.fftSize = 2048;
    bus.master.connect(an);
    window.__an = an;
    window.__level = () => {
      const buf = new Float32Array(an.fftSize);
      let peak = 0, sum = 0, n = 0;
      return new Promise((res) => {
        const t0 = performance.now();
        const tick = () => {
          an.getFloatTimeDomainData(buf);
          for (const v of buf) { peak = Math.max(peak, Math.abs(v)); sum += v * v; n++; }
          if (performance.now() - t0 < 1500) requestAnimationFrame(tick);
          else res({ peakDb: 20 * Math.log10(peak + 1e-9), rmsDb: 10 * Math.log10(sum / n + 1e-12) });
        };
        tick();
      });
    };
  });
  const state = await p.evaluate(() => window.__brasaAudio.ctx.state);
  console.log("AudioContext:", state);
  const lvl0 = await p.evaluate(() => window.__level());
  console.log("nivel em jogo:", JSON.stringify(lvl0));

  // mudo
  const key = (code) => p.evaluate((c) => { window.dispatchEvent(new KeyboardEvent("keydown", { code: c, key: "m" })); window.dispatchEvent(new KeyboardEvent("keyup", { code: c, key: "m" })); }, code);
  const isMuted = () => p.evaluate(() => JSON.parse(localStorage.getItem("brasa.settings") || "{}").muted === true);
  await key("KeyM");
  await p.waitForTimeout(1500);
  console.log("mudo ligado:", await isMuted());
  const lvlMute = await p.evaluate(() => window.__level());
  console.log("nivel mudo:", JSON.stringify(lvlMute));
  await key("KeyM");
  await p.waitForTimeout(1500);
  const lvl2 = await p.evaluate(() => window.__level());
  console.log("mudo desligado:", !(await isMuted()), "nivel:", JSON.stringify(lvl2));

  // descida de 7 andares
  const stats = [];
  stats.push(["inicio", await p.evaluate(() => window.__brasaAudio.stats())]);
  for (let i = 0; i < 7; i++) {
    await p.evaluate((n) => window.__brasa.enterRoom(n), i);
    await p.waitForTimeout(5500); // o fade de troca dura 3 s
    stats.push([`andar${i + 1}`, await p.evaluate(() => window.__brasaAudio.stats())]);
  }
  for (const [n, s] of stats) console.log(n.padEnd(8), "vivas", s.alive, "iniciadas", s.started, "pico", s.peakAlive);
  const a2 = stats.find((s) => s[0] === "andar2")[1].alive;
  const a7 = stats.find((s) => s[0] === "andar7")[1].alive;
  console.log(a7 <= a2 + 6 ? "SEM VAZAMENTO" : "VAZAMENTO?", `(andar2=${a2}, andar7=${a7})`);
  const lvl3 = await p.evaluate(() => window.__level());
  console.log("nivel no andar 7:", JSON.stringify(lvl3));
  console.log(errs.length ? errs.join("\n") : "SEM PAGEERROR");
  const ok = state === "running" && lvl0.rmsDb > -70 && lvlMute.rmsDb < -90 && lvl2.rmsDb > -70 && a7 <= a2 + 6 && errs.length === 0;
  console.log(ok ? "AUDIO OK" : "AUDIO FALHOU");
  await b.close();
  process.exit(ok ? 0 : 1);
})().catch((e) => { console.error("FAIL", e.message); process.exit(2); });
