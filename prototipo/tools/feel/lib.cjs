const { chromium } = require("/home/alisson/.npm/_npx/e41f203b7505f1fb/node_modules/playwright");
exports.boot = async function boot(porta, q = "") {
  const b = await chromium.launch({ args: ["--use-angle=gl-egl", "--ignore-gpu-blocklist", "--enable-gpu", "--use-gl=angle"] });
  const p = await b.newPage({ viewport: { width: Number(process.env.VW || 800), height: Number(process.env.VH || 450) } });
  p.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 300)));
  p.on("console", (m) => { if (m.type() === "error") console.log("[err]", m.text().slice(0, 250)); });
  await p.goto(`http://127.0.0.1:${porta}/?renderer=webgl${q}`);
  await p.waitForFunction(() => window.__brasa, null, { timeout: 90000 });
  await p.waitForTimeout(3000);
  await p.getByText(/novo jogo/i).first().waitFor({ state: "visible", timeout: 60000 });
  await p.waitForTimeout(1000);
  await p.getByText(/novo jogo/i).first().click({ force: true }).catch(() => {});
  for (let i = 0; i < 14; i++) {
    await p.waitForTimeout(1300);
    if (await p.evaluate(() => { const e = document.querySelector(".hud-fagulha"); return !!e && getComputedStyle(e).display !== "none"; })) break;
    await p.getByRole("button", { name: /iniciar a descida|^continuar$/i }).last().click({ force: true, timeout: 2000 }).catch(() => {});
  }
  await p.waitForTimeout(4500);
  const ok = await p.evaluate(() => { const e = document.querySelector(".hud-fagulha"); return !!e && getComputedStyle(e).display !== "none"; });
  if (!ok) { await b.close(); throw new Error("nao entrou em jogo"); }
  return { b, p };
};
// Instala o gravador por quadro dentro da pagina.
exports.REC = `(() => {
  const B = window.__brasa, hc = B.hero.combat, sc = B.scene, root = B.hero.model.root;
  if (window.__rec_inst) return;
  window.__rec_inst = true;
  window.__rec = [];
  const V = root.position.constructor;
  let tip = null, hand = null, handl = null;
  const find = () => {
    const sw = sc.transformNodes.find((n) => n.name === "sword" && n.parent && n.parent.name === "hand_r" && n.isDescendantOf(root));
    if (sw) { hand = sw.parent; handl = sc.transformNodes.find((n) => n.name === 'hand_l' && n.isDescendantOf(root)); tip = new (sc.transformNodes[0].constructor)("tip_probe", sc); tip.parent = sw; tip.position.set(0, 0.5, 0); }
  };
  find();
  const inv = new (root.getWorldMatrix().constructor)();
  const tl = new V(), hl = new V(), ll = new V();
  sc.onAfterRenderObservable.add(() => {
    if (!tip) find();
    const m = root.getWorldMatrix();
    m.invertToRef(inv);
    let tipL = null, handL = null, handLL = null;
    if (tip) {
      tip.computeWorldMatrix(true);
      V.TransformCoordinatesToRef(tip.getAbsolutePosition(), inv, tl); tipL = [tl.x, tl.y, tl.z];
      V.TransformCoordinatesToRef(hand.getAbsolutePosition(), inv, hl); handL = [hl.x, hl.y, hl.z];
      if (handl) { V.TransformCoordinatesToRef(handl.getAbsolutePosition(), inv, ll); handLL = [ll.x, ll.y, ll.z]; }
    }
    const mdl = B.hero.model, g = mdl.actionGroup;
    const an = g && g.animatables && g.animatables[0];
    window.__rec.push({
      t: performance.now(), st: hc.state, ph: hc.attack.current, hit: hc.canHit, ember: hc.canEmber, cs: hc.comboStep,
      inv: hc.invulnerable, blk: hc.isBlocking, ak: mdl.actionKind, gn: g ? g.name : null,
      fr: an ? an.masterFrame : null, gf: g ? g.from : null, gt: g ? g.to : null, gw: g ? g.weight : null, sr: g ? g.speedRatio : null,
      pos: [root.position.x, root.position.z], tip: tipL, hand: handL, handl: handLL, stam: hc.stamina,
      hs: B.combat.hitStop.remaining,
    });
  });
})()`;
