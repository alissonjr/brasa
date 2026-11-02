// play_check do gole: node check.cjs <porta>
const { chromium } = require("/home/alisson/.npm/_npx/e41f203b7505f1fb/node_modules/playwright");
const porta = process.argv[2];
(async () => {
  const b = await chromium.launch({ args: ["--use-angle=gl-egl", "--ignore-gpu-blocklist", "--enable-gpu", "--use-gl=angle"] });
  const p = await b.newPage({ viewport: { width: 800, height: 450 } });
  p.on("pageerror", (e) => console.log("[pageerror]", String(e).slice(0, 300)));
  await p.goto(`http://127.0.0.1:${porta}/?renderer=webgl`);
  await p.waitForFunction(() => window.__brasa, null, { timeout: 90000 });
  await p.waitForTimeout(3000);
  await p.getByText(/novo jogo/i).first().waitFor({ state: "visible", timeout: 60000 });
  await p.waitForTimeout(800);
  await p.getByText(/novo jogo/i).first().click({ force: true }).catch(() => {});
  for (let i = 0; i < 14; i++) {
    await p.waitForTimeout(1300);
    if (await p.evaluate(() => { const e = document.querySelector(".hud-fagulha"); return !!e && getComputedStyle(e).display !== "none"; })) break;
    await p.getByRole("button", { name: /iniciar a descida|^continuar$/i }).last().click({ force: true, timeout: 2000 }).catch(() => {});
  }
  await p.waitForTimeout(4500);
  console.log('em jogo', await p.evaluate(() => { const e = document.querySelector('.hud-fagulha'); return !!e && getComputedStyle(e).display !== 'none'; }));
  const key = (c) => p.evaluate((c) => { window.dispatchEvent(new KeyboardEvent("keydown", { code: c })); setTimeout(() => window.dispatchEvent(new KeyboardEvent("keyup", { code: c })), 30); }, c);
  const st = () => p.evaluate(() => { const b = window.__brasa; return { s: b.hero.combat.state, e: b.drinkInfo()?.elapsed ?? null, inv: b.inv().vida, hp: Math.round(b.hp().cur) }; });
  const setup = () => p.evaluate(() => { const b = window.__brasa; b.clear(); b.giveInv(3, 2); b.heal(); b.slow(1); b.hurt(50); });
  const waitFor = async (cond, ms = 20000) => { const t0 = Date.now(); while (Date.now() - t0 < ms) { const s = await st(); if (cond(s)) return s; await p.waitForTimeout(15); } return await st(); };
  const res = [];
  const ok = (n, c, extra) => { res.push(c); console.log(c ? "OK  " : "FALHA", n, extra ? JSON.stringify(extra) : ""); };
  await setup(); await p.waitForTimeout(600);
  // 1) gole parado: gasta 1 carga aos 0,30 s e cura
  await p.evaluate(() => { window.__brasa.slow(0.15); window.__brasa.drink("vida"); });
  let s = await waitFor((s) => s.e !== null && s.e > 0.1 && s.e < 0.28);
  ok("antes do commit a carga esta intacta", s.inv === 3, s);
  s = await waitFor((s) => s.s === "idle");
  ok("depois do gole a carga caiu 1 e curou", s.inv === 2 && s.hp > 90, s);
  // 2) esquiva aos ~0,2 s: nada gasto
  await setup(); await p.waitForTimeout(500);
  await p.evaluate(() => { window.__brasa.slow(0.15); window.__brasa.drink("vida"); });
  await waitFor((s) => s.e !== null && s.e >= 0.18);
  await key("KeyC");
  s = await waitFor((s) => s.s === "dodging" || s.s === "idle", 8000);
  await p.waitForTimeout(300);
  const s2 = await waitFor((s) => s.s === "idle");
  ok("esquiva aos 0,2 s cancela sem gastar", s.s === "dodging" && s2.inv === 3 && s2.hp < 100, { s, s2 });
  // 3) esquiva aos ~0,4 s: carga gasta
  await setup(); await p.waitForTimeout(500);
  await p.evaluate(() => { window.__brasa.slow(0.15); window.__brasa.drink("vida"); });
  await waitFor((s) => s.e !== null && s.e >= 0.38);
  await key("KeyC");
  s = await waitFor((s) => s.s === "dodging" || s.s === "idle", 8000);
  const s3 = await waitFor((s) => s.s === "idle");
  ok("esquiva aos 0,4 s: carga gasta e cura aplicada", s3.inv === 2 && s3.hp > 90, { s, s3 });
  // 4) verbos bloqueados na janela
  await setup(); await p.waitForTimeout(500);
  await p.evaluate(() => { window.__brasa.slow(0.15); window.__brasa.drink("vida"); });
  await waitFor((s) => s.e !== null && s.e >= 0.05);
  const seen = new Set();
  for (const k of ["KeyJ", "KeyK", "KeyE"]) { await key(k); const t = await st(); seen.add(t.s); }
  await p.evaluate(() => window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyQ" })));
  await p.waitForTimeout(100); const tq = await st(); seen.add(tq.s);
  await p.evaluate(() => window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyQ" })));
  ok("light/heavy/ember/block nao saem durante o gole", [...seen].every((x) => x === "drinking"), [...seen]);
  // 5) segundo pedido durante o gole e ignorado
  await p.evaluate(() => window.__brasa.drink("vida"));
  await waitFor((s) => s.s === "idle");
  await p.waitForTimeout(400);
  const s5 = await st();
  ok("pedido durante o gole e ignorado (so 1 carga gasta)", s5.inv === 2, s5);
  // 6) vida cheia no commit: nao gasta
  await setup(); await p.waitForTimeout(500);
  await p.evaluate(() => { window.__brasa.slow(0.15); window.__brasa.drink("vida"); });
  await waitFor((s) => s.e !== null && s.e >= 0.1);
  await p.evaluate(() => window.__brasa.heal());
  const s6 = await waitFor((s) => s.s === "idle");
  ok("vida cheia antes do commit: carga NAO gasta", s6.inv === 3, s6);
  // 7) Furia
  await setup(); await p.waitForTimeout(500);
  await p.evaluate(() => { window.__brasa.slow(0.3); window.__brasa.drink("furia"); });
  await waitFor((s) => s.s === "drinking");
  const s7 = await waitFor((s) => s.s === "idle", 20000);
  const f = await p.evaluate(() => ({ furia: window.__brasa.inv().furia, buff: window.__brasa.hero.combat.buffActive }));
  ok("Furia: carga gasta e buff ativo", f.furia === 1 && f.buff, f);
  // 8) lentidao: amostra posicao x tempo real dentro da pagina (rAF), com o gole em tempo normal
  await setup(); await p.waitForTimeout(500);
  await p.evaluate(() => window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyW" })));
  await p.waitForTimeout(1500);
  const trace = await p.evaluate(() => new Promise((resolve) => {
    const b = window.__brasa; const out = []; let started = false; let t0 = 0;
    const tick = () => {
      const pos = b.pos(); const d = b.drinkInfo(); const t = performance.now();
      if (!started) { out.push({ t, x: pos.x, z: pos.z, d: null }); if (out.length === 25) { b.drink("vida"); started = true; } }
      else { out.push({ t, x: pos.x, z: pos.z, d: d ? d.elapsed : null }); if (!d && out.length > 60) return resolve(out); }
      if (out.length > 400) return resolve(out);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }));
  await p.evaluate(() => window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyW" })));
  const sp = (a, b2) => Math.hypot(b2.x - a.x, b2.z - a.z) / ((b2.t - a.t) / 1000);
  const free = sp(trace[5], trace[22]);
  const dr = trace.filter((q) => q.d !== null);
  const late = dr.filter((q) => q.d > 0.3);
  const vlate = late.length > 3 ? sp(late[0], late[late.length - 1]) : NaN;
  console.log("livre", free.toFixed(2), "m/s; gole: amostras", dr.length, "velocidade no fim (>=0,3 s)", vlate.toFixed(2), "razao", (vlate / free).toFixed(2));
  ok("lentidao do gole (velocidade tende a 60% do livre)", vlate / free < 0.8, { ratio: vlate / free });
  console.log(res.every(Boolean) ? "TUDO OK" : "HA FALHAS");
  await b.close();
})();
