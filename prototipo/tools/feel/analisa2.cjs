// Por golpe: segmenta cada ataque (cada entrada em startup) e mede relativo ao inicio do proprio golpe.
const fs = require("fs");
const f = process.argv[2];
const { res, rec, keys } = JSON.parse(fs.readFileSync(f));
const med = (a) => { a = a.filter((x) => x != null && !isNaN(x)).sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : null; };
const fmt = (v) => (v == null ? "   -" : v.toFixed(0).padStart(4));
const names = [...new Set(res.runs.map((r) => r.name))];
const out = {};
for (const name of names) {
  const segs = [];
  for (const run of res.runs.filter((r) => r.name === name)) {
    const ks = keys.filter((k) => k.t >= run.t0 - 5 && k.t <= run.t0 + 1200 && k.d);
    if (!ks.length) continue;
    const tin = ks[0].t;
    const R = rec.slice(run.i0 - 2, run.i1).filter((r) => r.tip && !isNaN(r.tip[0]) && r.t >= tin - 40);
    // quadros-gap na janela do 1o golpe
    let st = null, cur = null;
    const attacks = [];
    for (let i = 1; i < R.length; i++) {
      const a = R[i - 1], b = R[i];
      const startsNew = (b.st === "attacking" && b.ph === "startup" && (a.st !== "attacking" || a.ph === "recovery" || a.ph === "idle")) || (b.st === "ember" && a.st !== "ember") || (b.st === "dodging" && a.st !== "dodging");
      if (startsNew) { cur = { i, t0: b.t, kind: b.st === "attacking" ? b.ak : b.st, cs: b.cs, rows: [] }; attacks.push(cur); }
      if (cur) cur.rows.push(b);
      if (cur && b.st === "idle") cur = null;
    }
    attacks.forEach((A, idx) => {
      const rows = A.rows; const t0 = A.t0;
      let gap = 0; for (let j = 1; j < rows.length; j++) gap = Math.max(gap, rows[j].t - rows[j - 1].t);
      const act = rows.filter((r) => r.ph === "active" || r.ember);
      const m = { idx, kind: A.kind, gap, fromInput: idx === 0 ? A.t0 - tin : null };
      m.open = act.length ? act[0].t - t0 : null; m.close = act.length ? act.at(-1).t - t0 : null;
      // contato: tip x muda de sinal com z>0.8
      let cross = null;
      for (let j = 1; j < rows.length; j++) { const a = rows[j - 1], b = rows[j]; if (a.tip[0] * b.tip[0] < 0 && b.tip[2] > 0.8 && a.tip[2] > 0.5) { cross = a.t + (b.t - a.t) * (a.tip[0] / (a.tip[0] - b.tip[0])) - t0; break; } }
      m.cross = cross;
      const lastMech = rows.filter((r) => r.st !== "idle").at(-1);
      m.end = lastMech ? lastMech.t - t0 + 8 : null;
      // clipe toca? quadros distintos
      const frs = new Set(rows.filter((r) => r.fr != null).map((r) => Math.round(r.fr))); m.frames = frs.size;
      m.disp = Math.hypot(rows.at(-1).pos[0] - rows[0].pos[0], rows.at(-1).pos[1] - rows[0].pos[1]);
      const iv = rows.filter((r) => r.inv); m.iv = iv.length ? [iv[0].t - t0, iv.at(-1).t - t0] : null;
      segs.push(m);
    });
  }
  out[name] = segs;
}
console.log("cenario".padEnd(24), "golpe".padEnd(9), "n", "ent->1o", "abre", "fecha", "cruza", "fim", "quadros", "disp", "inv");
for (const name of names) {
  const S = out[name].filter((s) => s.gap < 40);
  const byIdx = {};
  for (const s of S) (byIdx[s.idx + ":" + s.kind] ||= []).push(s);
  for (const k of Object.keys(byIdx)) {
    const L = byIdx[k]; const g = (x) => med(L.map((s) => s[x]));
    const iv = L.filter((s) => s.iv); 
    console.log(name.padEnd(24), k.padEnd(12), String(L.length).padStart(2), fmt(g("fromInput")), fmt(g("open")), fmt(g("close")), fmt(g("cross")), fmt(g("end")), String(g("frames")).padStart(4), (g("disp") ?? 0).toFixed(2), iv.length ? `${fmt(med(iv.map((s) => s.iv[0])))}-${fmt(med(iv.map((s) => s.iv[1])))}` : "");
  }
}
