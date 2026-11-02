// Capturas depois: avanca a mecanica real em passos fixos (hit stop congelado + hero.update manual).
const { boot } = require("./lib.cjs");
const fs = require("fs");
const [porta, outdir, kinds = "light,heavy"] = process.argv.slice(2);
fs.mkdirSync(outdir, { recursive: true });
const proj = (p) => p.evaluate(() => { const B = window.__brasa; const sc = B.scene; const e = sc.getEngine(); const V = B.hero.position.constructor; const M = sc.getTransformMatrix().constructor; const v = V.Project(B.hero.position, M.Identity(), sc.getTransformMatrix(), B.camera.camera.viewport.toGlobal(e.getRenderWidth(), e.getRenderHeight())); return { x: v.x, y: v.y }; });
const KEY = { light: "KeyJ", heavy: "KeyK", ember: "KeyE", dodge: "KeyC" };
(async () => {
  process.env.VW = process.env.VW || "1600"; process.env.VH = process.env.VH || "900";
  const { b, p } = await boot(Number(porta));
  await p.evaluate(() => window.__brasa.clear());
  await p.waitForTimeout(800);
  await p.evaluate(() => {
    const B = window.__brasa; const root = B.hero.model.root; const V = root.position.constructor;
    const q = new root.rotationQuaternion.constructor(); B.camera.getYawOrientation(q);
    const f = new V(0, 0, 1); f.rotateByQuaternionToRef(q, f);
    root.rotationQuaternion.copyFrom(q);
    const pp = B.hero.position;
    B.combat.addDummy(new V(pp.x + f.x * 2.2, 0, pp.z + f.z * 2.2));
  });
  await p.waitForTimeout(600);
  for (const kind of kinds.split(",")) {
    await p.evaluate(async () => { const B = window.__brasa; B.combat.hitStop.remaining = 0; await new Promise((r) => setTimeout(r, 1200)); });
    // congela e dispara
    await p.evaluate((code) => {
      const B = window.__brasa; B.hero.combat.stamina = 100; B.combat.hitStop.remaining = 1e9;
      window.dispatchEvent(new KeyboardEvent("keydown", { code })); window.dispatchEvent(new KeyboardEvent("keyup", { code }));
      B.hero.update(0, B.input, B.camera);
    }, KEY[kind]);
    const total = kind === "heavy" ? 800 : kind === "light" ? 400 : kind === "ember" ? 700 : 480;
    for (let t = 0; t <= total; t += 50) {
      if (t > 0) await p.evaluate(() => { const B = window.__brasa; B.hero.update(0.05, B.input, B.camera); });
      await p.waitForTimeout(180);
      const box = await proj(p);
      await p.screenshot({ path: `${outdir}/${kind}_${String(t).padStart(4, "0")}.png`, clip: { x: Math.max(0, box.x - 220), y: Math.max(0, box.y - 200), width: 440, height: 340 } });
    }
  }
  await b.close();
})();
