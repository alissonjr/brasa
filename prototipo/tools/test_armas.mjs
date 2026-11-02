// Testes unitarios das ARMAS CAPTURADAS (sem navegador): `node tools/test_armas.mjs`.
// Empacota os modulos puros de src/game/combat/armas com o esbuild (dependencia do Vite) e checa com
// `node:assert`: regras do Fio, troca ao pegar, recarga da mesma arma, teto de 2 no chao, sorteio de
// drop e as contas de equilibrio da spec (docs/brasa/spec-armas-capturadas.md, 2.7) lidas das defs.
import assert from "node:assert/strict";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const entry = `
export * from "./src/game/combat/armas/index.ts";
export { HERO } from "./src/game/combat/tuning.ts";
`;
const out = await build({
  stdin: { contents: entry, resolveDir: root, loader: "ts" },
  bundle: true, platform: "node", format: "esm", write: false, logLevel: "silent",
});
const M = await import("data:text/javascript;base64," + Buffer.from(out.outputFiles[0].text).toString("base64"));

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed++; console.log("ok   " + name); }
  catch (e) { console.log("FAIL " + name + "\n     " + (e && e.message)); process.exitCode = 1; }
};

const ciclo = (t) => t.startup + t.active + t.recovery;
const dpsCombo = (d) => (d.light.damage * 2 + d.finisher.damage) / (ciclo(d.light) * 2 + ciclo(d.finisher));
const dpsPesado = (d) => d.heavy.damage / ciclo(d.heavy);
const bronze = { light: M.HERO.light, finisher: M.HERO.lightFinisher, heavy: M.HERO.heavy };
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} != ${b}`);

// --- Fio: gasto, quebra, aviso ---
test("custo do golpe: leve e finalizadora 1, pesado 2, fioCost manda", () => {
  assert.equal(M.custoDoGolpe(M.LANCA.light), 1);
  assert.equal(M.custoDoGolpe(M.LANCA.finisher), 1);
  assert.equal(M.custoDoGolpe(M.LANCA.heavy), 2);
  assert.equal(M.custoDoGolpe(M.CLAVA.heavy), 2);
  assert.equal(M.custoDoGolpe(M.CAJADO.heavy), 1, "cajado de transicao: 1 carga por golpe");
  assert.equal(M.custoDoGolpe({ kind: "heavy", fioCost: 5 }), 5);
});
test("gastar Fio ate quebrar: a lanca dura 16 estocadas leves, a clava 10 golpes", () => {
  for (const [def, n] of [[M.LANCA, 16], [M.CLAVA, 10]]) {
    let a = M.novaArma(def);
    let golpes = 0;
    for (;;) {
      const r = M.gastarFio(a, M.custoDoGolpe(def.light));
      a = r.arma; golpes++;
      if (r.quebrou) break;
      assert.ok(golpes < 100);
    }
    assert.equal(golpes, n);
    assert.equal(a.fio, 0);
  }
});
test("pesado gasta 2 e o Fio nunca fica negativo", () => {
  let a = { id: "clava", fio: 1, max: 10 };
  const r = M.gastarFio(a, M.custoDoGolpe(M.CLAVA.heavy));
  assert.equal(r.arma.fio, 0);
  assert.equal(r.quebrou, true);
});
test("aviso de Fio curto: 25% ou menos e ainda inteira; zerada nao e aviso", () => {
  assert.equal(M.fioBaixo({ id: "lanca", fio: 4, max: 16 }), true);
  assert.equal(M.fioBaixo({ id: "lanca", fio: 5, max: 16 }), false);
  assert.equal(M.fioBaixo({ id: "lanca", fio: 0, max: 16 }), false);
  assert.equal(M.fioBaixo({ id: "clava", fio: 2, max: 10 }), true);
  assert.equal(M.fioBaixo({ id: "clava", fio: 3, max: 10 }), false);
});

// --- Pegar e trocar ---
test("maos vazias: empunha a do chao com o Fio que ela tinha", () => {
  const r = M.pegarArma(null, { id: "lanca", fio: 7, max: 16 });
  assert.deepEqual(r.mao, { id: "lanca", fio: 7, max: 16 });
  assert.equal(r.solta, null);
  assert.equal(r.recarregou, false);
});
test("trocar: a que estava cai aos pes COM O FIO QUE SOBROU (nao cheia)", () => {
  const r = M.pegarArma({ id: "clava", fio: 3, max: 10 }, { id: "lanca", fio: 16, max: 16 });
  assert.deepEqual(r.mao, { id: "lanca", fio: 16, max: 16 });
  assert.deepEqual(r.solta, { id: "clava", fio: 3, max: 10 });
  // e dá para voltar: pegar a clava do chao devolve os 3 e solta a lanca com o que sobrou
  const volta = M.pegarArma(r.mao, r.solta);
  assert.deepEqual(volta.mao, { id: "clava", fio: 3, max: 10 });
  assert.deepEqual(volta.solta, { id: "lanca", fio: 16, max: 16 });
});
test("a mesma arma recarrega 50% do maximo, com teto, e a do chao some", () => {
  const r = M.pegarArma({ id: "lanca", fio: 4, max: 16 }, { id: "lanca", fio: 16, max: 16 });
  assert.equal(r.mao.fio, 12);
  assert.equal(r.solta, null);
  assert.equal(r.recarregou, true);
  assert.equal(M.pegarArma({ id: "lanca", fio: 12, max: 16 }, { id: "lanca", fio: 16, max: 16 }).mao.fio, 16, "teto no maximo");
  assert.equal(M.pegarArma({ id: "clava", fio: 1, max: 10 }, { id: "clava", fio: 10, max: 10 }).mao.fio, 6);
});
test("ressalva da spec: com 5/16 na mao, recarregar (13) rende menos que trocar por uma cheia (16)", () => {
  const recarga = M.pegarArma({ id: "lanca", fio: 5, max: 16 }, { id: "lanca", fio: 16, max: 16 }).mao.fio;
  assert.equal(recarga, 13);
  assert.ok(recarga < 16);
});

// --- Chao: teto de 2 e sem expirar ---
test("teto de 2 no chao: a terceira dissolve a mais antiga", () => {
  let lista = [];
  let r = M.empurrarNoChao(lista, "a"); lista = r.lista; assert.equal(r.dissolvida, null);
  r = M.empurrarNoChao(lista, "b"); lista = r.lista; assert.equal(r.dissolvida, null);
  r = M.empurrarNoChao(lista, "c"); lista = r.lista;
  assert.equal(r.dissolvida, "a");
  assert.deepEqual(lista, ["b", "c"]);
});
test("a lista original nao e alterada (funcao pura)", () => {
  const base = ["x", "y"];
  M.empurrarNoChao(base, "z");
  assert.deepEqual(base, ["x", "y"]);
});

// --- Drops ---
test("mapa de drops: Guarda larga lanca, Brutamonte larga clava, minion e arqueiro nao largam (nesta leva)", () => {
  const T = M.LISTA_ARMAS;
  assert.equal(M.sortearDrop("warrior", T, () => 0), "lanca");
  assert.equal(M.sortearDrop("brutamonte", T, () => 0), "clava");
  assert.equal(M.sortearDrop("conjurador", T, () => 0), "cajado");
  assert.equal(M.sortearDrop("minion", T, () => 0), null);
  assert.equal(M.sortearDrop("rogue", T, () => 0), null);
  assert.equal(M.sortearDrop("arqueiro", T, () => 0), null);
});
test("taxa de drop por familia: Brutamonte 100%, Guarda 40%", () => {
  const T = M.LISTA_ARMAS;
  assert.equal(M.sortearDrop("brutamonte", T, () => 0.999), "clava");
  assert.equal(M.sortearDrop("warrior", T, () => 0.39), "lanca");
  assert.equal(M.sortearDrop("warrior", T, () => 0.4), null);
  let n = 0;
  let s = 12345;
  const rnd = () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
  for (let i = 0; i < 10000; i++) if (M.sortearDrop("warrior", T, rnd)) n++;
  assert.ok(n > 3800 && n < 4200, "~40% em 10000: " + n);
});
test("cada familia aparece em uma unica arma (sem ambiguidade)", () => {
  const vistos = new Map();
  for (const w of M.LISTA_ARMAS) for (const f of w.largadaPor) {
    assert.ok(!vistos.has(f.familia), f.familia + " em " + vistos.get(f.familia) + " e " + w.id);
    vistos.set(f.familia, w.id);
    assert.ok(f.taxa > 0 && f.taxa <= 1);
  }
});

// --- Equilibrio (spec 2.7) lido das defs ---
test("conta 2.7, bronze: combo 23,0 e pesado 32,5 por segundo", () => {
  near(dpsCombo(bronze), 23.0, 0.1, "combo do bronze");
  near(dpsPesado(bronze), 32.5, 0.1, "pesado do bronze");
});
test("conta 2.7, lanca: 21,4 (-7%) e 30,0 (-8%)", () => {
  near(dpsCombo(M.LANCA), 21.4, 0.1, "combo");
  near(dpsPesado(M.LANCA), 30.0, 0.1, "pesado");
  near(ciclo(M.LANCA.light) * 2 + ciclo(M.LANCA.finisher), 1.40, 0.005, "ciclo do combo");
});
test("conta 2.7, clava: 27,8 (+21%) e 40,0 (+23%)", () => {
  near(dpsCombo(M.CLAVA), 27.8, 0.1, "combo");
  near(dpsPesado(M.CLAVA), 40.0, 0.1, "pesado");
  near(ciclo(M.CLAVA.light) * 2 + ciclo(M.CLAVA.finisher), 1.94, 0.005, "ciclo do combo");
});
test("guarda de balanco: nenhuma arma passa de +25% de DPS contra o bronze sem custo", () => {
  for (const d of [M.LANCA, M.CLAVA]) {
    assert.ok(dpsCombo(d) / dpsCombo(bronze) <= 1.25, d.id + " combo");
    assert.ok(dpsPesado(d) / dpsPesado(bronze) <= 1.25, d.id + " pesado");
  }
});

// --- Identidade mecanica ---
test("clava compromete: sem lunge e sem cancelamento em nenhum golpe; lanca avanca 2,4 m no pesado", () => {
  for (const t of [M.CLAVA.light, M.CLAVA.finisher, M.CLAVA.heavy]) {
    assert.equal(t.cancelAt, undefined);
    assert.equal(t.lunge, undefined);
  }
  assert.equal(M.LANCA.heavy.lunge, 2.4);
});
test("marcadores de golpe: o pesado e o pesado em toda arma (a animacao nao depende da identidade do objeto)", () => {
  for (const d of M.LISTA_ARMAS) {
    assert.equal(d.light.kind, "light");
    assert.equal(d.finisher.kind, "finisher");
    assert.equal(d.heavy.kind, "heavy");
  }
  assert.equal(M.HERO.heavy.kind, "heavy");
  assert.equal(M.HERO.light.kind, "light");
  assert.equal(M.HERO.lightFinisher.kind, "finisher");
});
test("quebra de guarda segue hitStopFrames >= 8: bronze so no pesado, clava na finalizadora e no pesado, lanca so no pesado", () => {
  const quebra = (t) => t.hitStopFrames >= 8;
  assert.deepEqual([bronze.light, bronze.finisher, bronze.heavy].map(quebra), [false, false, true]);
  assert.deepEqual([M.CLAVA.light, M.CLAVA.finisher, M.CLAVA.heavy].map(quebra), [false, true, true]);
  assert.deepEqual([M.LANCA.light, M.LANCA.finisher, M.LANCA.heavy].map(quebra), [false, false, true]);
});
test("lanca fura (linha com zona morta); clava e esfera; a ponta da lanca alcanca 2,35 m", () => {
  const s = M.LANCA.light.shape;
  assert.equal(s.kind, "linha");
  near(s.to + s.radius, 2.35, 1e-9, "alcance efetivo");
  assert.deepEqual(s.deadZone, { dist: 0.9, mul: 0.6 });
  assert.equal(M.CLAVA.heavy.shape.kind, "esfera");
  assert.equal(M.CLAVA.heavy.stun.maxPoise, 65);
});
test("cada arma tem medidores de 1 a 5 e Fio positivo", () => {
  for (const d of M.LISTA_ARMAS) {
    for (const v of Object.values(d.medidores)) assert.ok(v >= 1 && v <= 5);
    assert.ok(d.fio > 0);
  }
  assert.deepEqual(M.LANCA.medidores, { alcance: 5, peso: 2, ritmo: 3 });
  assert.deepEqual(M.CLAVA.medidores, { alcance: 2, peso: 5, ritmo: 1 });
});

console.log(`\n${passed} testes passaram` + (process.exitCode ? " (com falhas)" : ""));
