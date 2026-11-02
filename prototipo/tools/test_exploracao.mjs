// Testes unitarios dos sistemas de exploracao (sem navegador): `node tools/test_exploracao.mjs`.
// Nao ha runner no projeto; este script empacota os modulos PUROS com o esbuild (ja presente no
// node_modules, dependencia do Vite) e roda as checagens com `node:assert`.
// Cobre: planRoute (regras R2, determinismo), formato do nó, retomada/derrota, RouteState,
// leitura defensiva e migracao do save (readGameSave), registro de ganchos (ExploracaoRegistry).
import assert from "node:assert/strict";
import { buildSync } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const entry = `
export * from "./src/game/run/rota.ts";
export { ExploracaoRegistry } from "./src/game/run/exploracao.ts";
export { readGameSave, exploracaoDefaults } from "./src/game/content/saveData.ts";
`;
const out = buildSync({
  stdin: { contents: entry, resolveDir: root, loader: "ts" },
  bundle: true, platform: "node", format: "esm", write: false, logLevel: "silent",
});
const code = out.outputFiles[0].text;
const M = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed++; console.log("ok   " + name); }
  catch (e) { console.log("FAIL " + name + "\n     " + (e && e.message)); process.exitCode = 1; }
};

// --- planRoute (R2) ---
test("validSequences: exatamente 14 sequencias, todas validas", () => {
  const seqs = M.validSequences();
  assert.equal(seqs.length, 14);
  for (const s of seqs) assert.equal(s.length, 5);
});
test("planRoute: T0 sem porta, T1..T5 com porta", () => {
  const p = M.planRoute(12345);
  assert.equal(p.side.length, M.TRANSITIONS);
  assert.equal(p.side[0], null);
  for (let i = 1; i < 6; i++) assert.ok(p.side[i] === "estante" || p.side[i] === "bancada");
});
test("planRoute: regras R2 em 20 mil sementes (max 2 iguais seguidas; cada tipo 1 a 3 vezes)", () => {
  const plans = new Set();
  for (let seed = 0; seed < 20000; seed++) {
    const s = M.planRoute(seed * 7919 + 1).side.slice(1);
    plans.add(s.join(","));
    for (const k of ["estante", "bancada"]) {
      const n = s.filter((x) => x === k).length;
      assert.ok(n >= 1 && n <= 3, `${k} ${n}x em ${s}`);
    }
    for (let i = 2; i < s.length; i++) assert.ok(!(s[i] === s[i - 1] && s[i] === s[i - 2]), `3 seguidas em ${s}`);
  }
  assert.equal(plans.size, 14, "todas as 14 combinacoes aparecem");
});
test("planRoute: determinístico (mesma semente, mesmo plano)", () => {
  for (const seed of [1, 2, 99, 123456789, 0x7fffffff]) {
    assert.deepEqual(M.planRoute(seed), M.planRoute(seed));
  }
});
test("exitsFor: alcapao sempre primeiro; porta so quando ha", () => {
  const p = M.planRoute(7);
  assert.deepEqual(M.exitsFor(p, 0), ["alcapao"]);
  assert.deepEqual(M.exitsFor(p, 6), ["alcapao"]);
  assert.deepEqual(M.exitsFor(p, 3), ["alcapao", p.side[3]]);
});

// --- formato do nó ---
test("formatNo/parseNo: ida e volta; lixo vira null", () => {
  assert.equal(M.formatNo("estante", 2), "estante@2");
  assert.deepEqual(M.parseNo("bancada@4"), { node: "bancada", from: 4 });
  for (const bad of ["", "foo@9", "estante", "estante@", "estante@-1", "estante@123", "@2", "Estante@2"]) assert.equal(M.parseNo(bad), null, bad);
});

// --- retomada e derrota (R7, R8) ---
test("resumePlace: nó válido volta ao nó; inválido cai no andar", () => {
  const plan = M.planRoute(42);
  const k = plan.side[3];
  const other = k === "estante" ? "bancada" : "estante";
  assert.deepEqual(M.resumePlace({ active: true, floorIndex: 3, no: `${k}@3` }, plan), { kind: "node", node: k, from: 3 });
  assert.deepEqual(M.resumePlace({ active: true, floorIndex: 3, no: `${other}@3` }, plan), { kind: "floor", index: 3 }, "tipo que o plano nao previu");
  assert.deepEqual(M.resumePlace({ active: true, floorIndex: 3, no: `${k}@2` }, plan), { kind: "floor", index: 3 }, "origem diferente do andar salvo");
  assert.deepEqual(M.resumePlace({ active: false, floorIndex: 3, no: `${k}@3` }, plan), { kind: "floor", index: 3 }, "run inativa");
  assert.deepEqual(M.resumePlace({ active: true, floorIndex: 0, no: "estante@0" }, plan), { kind: "floor", index: 0 }, "T0 nao tem porta");
  assert.deepEqual(M.resumePlace({ active: true, floorIndex: 6, no: "estante@6" }, plan), { kind: "floor", index: 6 }, "o Guardiao nao tem saida");
  assert.deepEqual(M.resumePlace({ active: true, floorIndex: 1, no: "esquecida@1" }, plan), { kind: "node", node: "esquecida", from: 1 }, "a secreta e fixa");
});
test("retryPlace: derrota num nó reinicia o nó, no andar reinicia o andar", () => {
  const n = { kind: "node", node: "estante", from: 2 };
  assert.deepEqual(M.retryPlace(n), n);
  const f = { kind: "floor", index: 4 };
  assert.deepEqual(M.retryPlace(f), f);
});

// --- RouteState ---
test("RouteState: escolher, entrar no nó, salvar, recarregar", () => {
  const seed = 31337;
  const r = new M.RouteState(seed);
  const side = r.plan.side[2];
  r.enterFloor(0); r.choose(0, "alcapao");
  r.enterFloor(1); r.choose(1, r.plan.side[1]);
  r.enterFloor(2); r.choose(2, side);
  r.enterNode(side, 2, true);
  r.markSpent("cura");
  const s = r.save();
  assert.deepEqual(s.rota, ["alcapao", r.plan.side[1], side]);
  assert.equal(s.no, `${side}@2`);
  assert.deepEqual(s.gasto, ["cura"]);
  const r2 = new M.RouteState(1);
  const place = r2.load({ active: true, floorIndex: 2, no: s.no, rota: s.rota, gasto: s.gasto }, seed);
  assert.deepEqual(place, { kind: "node", node: side, from: 2 });
  assert.equal(r2.isSpent("cura"), true, "gasto sobrevive a retomada (nao duplica)");
  r2.enterNode(side, 2, false); // recomeço depois de derrota: mantém o gasto
  assert.equal(r2.isSpent("cura"), true);
  r2.enterFloor(3);
  assert.deepEqual(r2.save(), { rota: s.rota, no: "", gasto: [] }, "saiu do nó: no e gasto limpos");
});
test("RouteState: voltar a um andar apaga as escolhas dali em diante", () => {
  const r = new M.RouteState(5);
  for (let i = 0; i < 4; i++) { r.enterFloor(i); r.choose(i, "alcapao"); }
  r.enterFloor(2);
  assert.equal(r.rota.length, 2);
});
test("RouteState.choose: atalho de dev preenche com alcapao", () => {
  const r = new M.RouteState(5);
  r.choose(3, "alcapao");
  assert.deepEqual(r.rota, ["alcapao", "alcapao", "alcapao", "alcapao"]);
});

// --- leitura defensiva e migração do save ---
test("readGameSave: save antigo (sem campos novos) ganha defaults", () => {
  const g = M.readGameSave({ run: { active: false, floorIndex: 0, fagulhas: 5, pocaoVida: 1, pocaoFuria: 0, upgrades: [], seed: 9 } });
  assert.deepEqual({ ...g.run, active: undefined }, { ...M.exploracaoDefaults(), active: undefined, floorIndex: 0, fagulhas: 5, pocaoVida: 1, pocaoFuria: 0, upgrades: [], seed: 9 });
});
test("readGameSave: blob vazio/undefined/lixo nao quebra", () => {
  for (const b of [undefined, {}, { run: null }, { run: "x" }, { run: [] }]) {
    const g = M.readGameSave(b);
    assert.equal(g.run.no, ""); assert.deepEqual(g.run.sabedoria, [0, 0, 0]); assert.deepEqual(g.run.rota, []);
  }
});
test("readGameSave: descida antiga em andamento semeia rota = alcapao por transicao feita", () => {
  const g = M.readGameSave({ run: { active: true, floorIndex: 3, seed: 5 } });
  assert.deepEqual(g.run.rota, ["alcapao", "alcapao", "alcapao"]);
  assert.equal(g.run.no, "");
  assert.deepEqual(g.codex.length > 0, true, "semeadura da Crônica continua valendo");
});
test("readGameSave: campos novos sao higienizados", () => {
  const g = M.readGameSave({ run: {
    active: true, floorIndex: 2, no: "estante@2", gasto: ["cura", 7, "", "x".repeat(99)],
    rota: ["alcapao", "estante", "lixo", 3], sabedoria: [1, 2], livros: ["a", null], raiz: -4, cera: 2.9, unguento: NaN, ferida: -1, secretos: "x",
  } });
  assert.equal(g.run.no, "estante@2");
  assert.deepEqual(g.run.gasto, ["cura"]);
  assert.deepEqual(g.run.rota, ["alcapao", "estante"]);
  assert.deepEqual(g.run.sabedoria, [0, 0, 0], "tamanho errado vira default");
  assert.deepEqual(g.run.livros, ["a"]);
  assert.equal(g.run.raiz, 0); assert.equal(g.run.cera, 2); assert.equal(g.run.unguento, 0); assert.equal(g.run.ferida, 0);
  assert.deepEqual(g.run.secretos, []);
  const s = M.readGameSave({ run: { active: true, floorIndex: 1, sabedoria: [99, -3, 4.7] } });
  assert.deepEqual(s.run.sabedoria, [9, 0, 4]);
});
test("readGameSave: nó com origem diferente do andar, ou run inativa, e descartado (e o gasto junto)", () => {
  assert.equal(M.readGameSave({ run: { active: true, floorIndex: 3, no: "estante@2", gasto: ["a"] } }).run.no, "");
  assert.deepEqual(M.readGameSave({ run: { active: true, floorIndex: 3, no: "estante@2", gasto: ["a"] } }).run.gasto, []);
  assert.equal(M.readGameSave({ run: { active: false, floorIndex: 2, no: "estante@2" } }).run.no, "");
  assert.equal(M.readGameSave({ run: { active: true, floorIndex: 2, no: "foo@2" } }).run.no, "");
});

// --- registro de ganchos ---
test("ExploracaoRegistry: despacha eventos, carrega campos nao possuidos, snapshot de sistema sobrescreve", () => {
  const reg = new M.ExploracaoRegistry();
  const seen = [];
  reg.register({
    onEnterFloor: (i) => seen.push("floor" + i),
    onEnterNode: (k, f) => seen.push(`node ${k}@${f}`),
    onFragmentTaken: () => seen.push("frag"),
    onHeroDied: () => seen.push("died"),
    update: (dt) => seen.push("u" + dt),
    snapshot: () => ({ ferida: 17 }),
    restore: (run) => seen.push("restore " + run.no),
  });
  const run = M.readGameSave({ run: { active: true, floorIndex: 1, no: "", raiz: 3, ferida: 5 } }).run;
  reg.restore(run);
  reg.onEnterFloor(1); reg.onEnterNode("estante", 1); reg.onFragmentTaken(); reg.onHeroDied(); reg.update(0.5);
  assert.deepEqual(seen, ["restore ", "floor1", "node estante@1", "frag", "died", "u0.5"]);
  const snap = reg.snapshot();
  assert.equal(snap.raiz, 3, "campo sem dono continua sendo gravado");
  assert.equal(snap.ferida, 17, "o dono sobrescreve");
  reg.forget();
  assert.equal(new M.ExploracaoRegistry().snapshot().raiz, undefined);
});

console.log(`\n${passed} testes ok${process.exitCode ? ", COM FALHAS" : ""}`);
