// uso: node medir.cjs <porta> <saida.json> [comDummy 0/1]
const { boot, REC } = require("./lib.cjs");
const fs = require("fs");
const [porta, out, dummy = "0"] = process.argv.slice(2);
(async () => {
  const { b, p } = await boot(Number(porta));
  await p.evaluate(REC);
  await p.evaluate(() => window.__brasa.clear());
  await p.waitForTimeout(800);
  await p.evaluate((n) => { window.__reps = n; }, Number(process.env.REPS || 5));
  const res = await p.evaluate(async (useDummy) => {
    const B = window.__brasa, hc = B.hero.combat, root = B.hero.model.root;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    window.__keys = []; const key = (c, d) => { window.__keys.push({ t: performance.now(), c, d }); window.dispatchEvent(new KeyboardEvent(d ? "keydown" : "keyup", { code: c })); };
    const tap = async (c, hold = 40) => { key(c, true); await sleep(hold); key(c, false); };
    const V = root.position.constructor;
    let dm = null;
    const place = () => {
      if (!useDummy) return;
      const q = new root.rotationQuaternion.constructor(); B.camera.getYawOrientation(q);
      const f = new V(0, 0, 1); f.rotateByQuaternionToRef(q, f);
      const p = B.hero.position;
      if (dm) { try { dm.dispose && dm.dispose(); } catch {} }
      dm = B.combat.addDummy(new V(p.x + f.x * 1.3, 0, p.z + f.z * 1.3));
    };
    const settle = async () => { while (hc.state !== "idle" || hc.isBlocking) await sleep(50); B.hero.combat.stamina = 100; hc.spark = 3; await sleep(900); };
    const REPS = Number(window.__reps || 1);
    const runs = [];
    const run = async (name, fn) => { for (let r = 0; r < REPS; r++) await run1(name, fn, r); };
    const run1 = async (name, fn, rep) => {
      await settle(); place();
      await sleep(300);
      const i0 = window.__rec.length;
      const t0 = performance.now();
      await fn(t0);
      await sleep(1100);
      runs.push({ name, rep, t0, i0, i1: window.__rec.length });
    };
    const at = async (t0, ms) => { const w = t0 + ms - performance.now(); if (w > 0) await sleep(w); return performance.now(); };
    const mark = () => {};
    await run("leve1", async () => { mark("leve1"); await tap("KeyJ"); });
    await run("leve_cadeia_mash", async (t0) => { for (let i = 0; i < 24; i++) { if (i === 0) mark("leve_cadeia_mash"); await tap("KeyJ", 20); await sleep(40); } });
    await run("leve_ritmo", async (t0) => { mark("leve_ritmo"); await tap("KeyJ"); await at(t0, 330); await tap("KeyJ"); await at(t0, 700); await tap("KeyJ"); });
    await run("pesado", async () => { mark("pesado"); await tap("KeyK"); });
    await run("esquiva", async () => { mark("esquiva"); await tap("KeyC"); });
    await run("esquiva_W", async () => { key("KeyW", true); await sleep(250); mark("esquiva_W"); await tap("KeyC"); await sleep(700); key("KeyW", false); });
    await run("bloqueio", async () => { mark("bloqueio"); key("KeyQ", true); await sleep(900); mark("bloqueio_solta"); key("KeyQ", false); });
    await run("fogo", async () => { mark("fogo"); await tap("KeyE"); });
    await run("leve_esquiva_cancel", async (t0) => { mark("leve_esquiva_cancel"); await tap("KeyJ"); await at(t0, 250); mark("cancel_c"); await tap("KeyC"); });
    await run("leve_esquiva_cedo", async (t0) => { mark("leve_esquiva_cedo"); await tap("KeyJ"); await at(t0, 120); mark("cancel_c"); await tap("KeyC"); });
    await run("pesado_esquiva_cancel", async (t0) => { mark("pesado_esquiva_cancel"); await tap("KeyK"); await at(t0, 600); mark("cancel_c"); await tap("KeyC"); });
    await run("leve_bloqueio_cancel", async (t0) => { mark("leve_bloqueio_cancel"); await tap("KeyJ"); await at(t0, 250); mark("cancel_q"); key("KeyQ", true); await sleep(600); key("KeyQ", false); });
    await run("leve_pesado", async (t0) => { mark("leve_pesado"); await tap("KeyJ"); await at(t0, 100); await tap("KeyK"); });
    return { runs };
  }, dummy === "1");
  const rec = await p.evaluate(() => window.__rec); const keys = await p.evaluate(() => window.__keys);
  fs.writeFileSync(out, JSON.stringify({ res, rec, keys }));
  console.log("quadros", rec.length, "ok");
  await b.close();
})();
