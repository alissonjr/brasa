// Testes unitarios dos sistemas de exploracao (sem navegador): `node tools/test_exploracao.mjs`.
// Nao ha runner no projeto; este script empacota os modulos PUROS com o esbuild (ja presente no
// node_modules, dependencia do Vite) e roda as checagens com `node:assert`.
// Cobre: Place (antessala/camara), formato do lugar no save, migracao de saves antigos, retomada/derrota,
// RouteState (gasto, braseiro, chama), dados da descida (descida.ts), leitura defensiva do save
// (readGameSave), registro de ganchos (ExploracaoRegistry). Docs: docs/brasa/redesenho-da-descida.md.
import assert from "node:assert/strict";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const entry = `
export * from "./src/game/run/rota.ts";
export { pickLayout } from "./src/game/scenes/crypt/cryptLayouts.ts";
export * from "./src/game/content/descida.ts";
export { ExploracaoRegistry } from "./src/game/run/exploracao.ts";
export { readGameSave, exploracaoDefaults, nichosVazios } from "./src/game/content/saveData.ts";
`;
// cryptLayouts usa so Vector3 do Babylon: um stub minimo evita empacotar o motor inteiro.
const babylonStub = {
  name: "babylon-stub",
  setup(b) {
    b.onResolve({ filter: /^@babylonjs\/core$/ }, () => ({ path: "stub", namespace: "babylon-stub" }));
    b.onLoad({ filter: /.*/, namespace: "babylon-stub" }, () => ({ contents: "export class Vector3 { constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; } }", loader: "js" }));
  },
};
const out = await build({
  stdin: { contents: entry, resolveDir: root, loader: "ts" },
  bundle: true, platform: "node", format: "esm", write: false, logLevel: "silent", plugins: [babylonStub],
});
const code = out.outputFiles[0].text;
const M = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64"));

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed++; console.log("ok   " + name); }
  catch (e) { console.log("FAIL " + name + "\n     " + (e && e.message)); process.exitCode = 1; }
};

// --- Place e formato do lugar ---
test("formatNo/parseNo: ida e volta; lixo vira null", () => {
  assert.equal(M.formatNo({ kind: "antessala", index: 2 }), "antessala@2");
  assert.equal(M.formatNo({ kind: "camara", index: 6 }), "camara@6");
  assert.deepEqual(M.parseNo("camara@4"), { kind: "camara", index: 4 });
  assert.deepEqual(M.parseNo("antessala@0"), { kind: "antessala", index: 0 });
  for (const bad of ["", "foo@9", "antessala", "antessala@", "antessala@-1", "antessala@123", "antessala@7", "@2", "Antessala@2", "estante@2", "esquecida@1"]) assert.equal(M.parseNo(bad), null, bad);
});
test("legacyNoToPlace: antecamara antiga vira a antessala do andar seguinte", () => {
  assert.deepEqual(M.legacyNoToPlace("estante@2"), { kind: "antessala", index: 3 });
  assert.deepEqual(M.legacyNoToPlace("bancada@0"), { kind: "antessala", index: 1 });
  assert.deepEqual(M.legacyNoToPlace("estante@5"), { kind: "antessala", index: 6 });
  assert.deepEqual(M.legacyNoToPlace("esquecida@6"), { kind: "antessala", index: 6 }, "nunca passa da A7");
  assert.equal(M.legacyNoToPlace("antessala@2"), null);
  assert.equal(M.legacyNoToPlace(""), null);
});
test("samePlace / floorOf: antessala e camara do mesmo andar compartilham o indice, mas nao sao o mesmo lugar", () => {
  assert.equal(M.samePlace({ kind: "antessala", index: 2 }, { kind: "antessala", index: 2 }), true);
  assert.equal(M.samePlace({ kind: "antessala", index: 2 }, { kind: "camara", index: 2 }), false);
  assert.equal(M.floorOf({ kind: "camara", index: 4 }), 4);
});

// --- compromisso da porta ---
test("stepCommit: completa em 0,6 s (laje) ou 0,4 s (porta de pedra); sair cancela; trocar de saida recomeca", () => {
  assert.equal(M.ROTA.commitSec, 0.6); assert.equal(M.ROTA.portaSec, 0.4);
  const c = { id: null, t: 0 };
  assert.equal(M.stepCommit(c, "laje", 0.3), false);
  assert.equal(M.stepCommit(c, "laje", 0.29), false);
  assert.equal(M.stepCommit(c, "laje", 0.02), true, "completa ao somar 0,6 s");
  assert.deepEqual(c, { id: null, t: 0 }, "zera ao completar (nao repete)");
  assert.equal(M.stepCommit(c, "porta", 0.3, M.ROTA.portaSec), false);
  assert.equal(M.stepCommit(c, "porta", 0.11, M.ROTA.portaSec), true, "a porta de pedra completa em 0,4 s");
  M.stepCommit(c, "porta", 0.3);
  assert.equal(M.stepCommit(c, null, 0.1), false);
  assert.deepEqual(c, { id: null, t: 0 }, "sair do raio cancela na hora");
  M.stepCommit(c, "porta", 0.3);
  assert.equal(M.stepCommit(c, "laje", 0.2), false, "trocar de saida recomeca do zero");
  assert.equal(c.t, 0.2);
});

// --- plantas: so a antessala (sem porta lateral) ---
test("pickLayout: nenhuma planta tem porta lateral (Layout.doors e sideDoor sairam)", () => {
  for (let index = 0; index < 7; index++) {
    const L = M.pickLayout({ index, kind: "salao", enemies: 1 });
    assert.equal("doors" in L, false, `andar ${index + 1}`);
  }
});
test("pickLayout: antessala 12x12, escada longe do spawn", () => {
  for (const index of [0, 3, 6]) {
    const L = M.pickLayout({ index, kind: "guarda", enemies: 0, antessala: true });
    assert.equal(L.shape, "camara_12");
    assert.equal(L.halfX, 6); assert.equal(L.halfZ, 6);
    assert.ok(Math.hypot(L.spawn.x - L.exit.x, L.spawn.z - L.exit.z) > L.exit.radius + 2, "nao dispara da chegada");
    assert.ok(Math.abs(L.exit.x) + L.exit.radius < L.halfX && Math.abs(L.exit.z) + L.exit.radius < L.halfZ + 1, "dentro da sala");
  }
});

// --- retomada e derrota ---
test("resumePlace: Continuar sempre volta a uma antessala (nunca ao meio de uma luta)", () => {
  assert.deepEqual(M.resumePlace({ active: true, floorIndex: 3, no: "antessala@3" }), { kind: "antessala", index: 3 });
  assert.deepEqual(M.resumePlace({ active: true, floorIndex: 3, no: "camara@3" }), { kind: "antessala", index: 3 }, "salvo numa camara");
  assert.deepEqual(M.resumePlace({ active: true, floorIndex: 5, no: "camara@2" }), { kind: "antessala", index: 2 }, "o no manda no andar");
  assert.deepEqual(M.resumePlace({ active: true, floorIndex: 4, no: "" }), { kind: "antessala", index: 4 }, "sem no: o andar salvo");
  assert.deepEqual(M.resumePlace({ active: true, floorIndex: 99, no: "lixo" }), { kind: "antessala", index: 6 }, "clamp na A7");
  assert.deepEqual(M.resumePlace({ active: false, floorIndex: 3, no: "camara@3" }), { kind: "antessala", index: 0 + 3 }, "run inativa usa o andar");
});
test("retryPlace: derrota na camara volta a antessala do andar; na antessala fica", () => {
  assert.deepEqual(M.retryPlace({ kind: "camara", index: 2 }), { kind: "antessala", index: 2 });
  assert.deepEqual(M.retryPlace({ kind: "antessala", index: 5 }), { kind: "antessala", index: 5 });
});

// --- RouteState ---
test("RouteState: antessala, camara, gasto, salvar, recarregar", () => {
  const r = new M.RouteState();
  assert.deepEqual(r.current, { kind: "antessala", index: 0 });
  r.enterAntessala(2, true);
  r.markSpent("cura");
  r.acender(2);
  assert.equal(r.gastarChama(2, "estante"), true);
  r.enterCamara(2);
  assert.equal(r.inAntessala, false); assert.equal(r.floor, 2);
  const s = r.save();
  assert.equal(s.no, "camara@2");
  assert.deepEqual(s.gasto, ["cura"], "o gasto da antessala atravessa a camara (derrota volta sem devolver)");
  assert.deepEqual(s.braseiros[2], { aceso: true, chama: "estante" });
  const r2 = new M.RouteState();
  const place = r2.load({ active: true, floorIndex: 2, ...s });
  assert.deepEqual(place, { kind: "antessala", index: 2 });
  assert.equal(r2.isSpent("cura"), true, "gasto sobrevive a retomada");
  assert.equal(r2.chamaDisponivel(2), false, "chama gasta nao volta");
  r2.enterAntessala(2, false); // recomeco depois de derrota: mantem o gasto
  assert.equal(r2.isSpent("cura"), true);
  r2.enterAntessala(3, true); // chegada nova: gasto zerado
  assert.deepEqual(r2.save().gasto, []);
  assert.equal(r2.save().no, "antessala@3");
  r2.reset();
  assert.deepEqual(r2.save(), { no: "antessala@0", gasto: [], braseiros: M.braseirosPadrao() });
});
test("RouteState: braseiro e chama (uma por andar, gasta nao volta, sem acender nao ha chama)", () => {
  const r = new M.RouteState();
  assert.equal(r.chamaDisponivel(1), false, "apagado: sem chama");
  assert.equal(r.gastarChama(1, "dadiva"), false, "nao se gasta chama de braseiro apagado");
  r.acender(1);
  assert.equal(r.chamaDisponivel(1), true);
  assert.equal(r.gastarChama(1, "bancada"), true);
  assert.equal(r.gastarChama(1, "dadiva"), false, "so uma chama por andar");
  assert.equal(r.chamaDisponivel(1), false);
  assert.equal(r.chamaDisponivel(0), false, "andares independentes");
  r.acender(1); // acender de novo nao devolve a chama
  assert.equal(r.chamaDisponivel(1), false);
  assert.equal(r.gastarChama(99, "dadiva"), false, "indice fora da descida");
});

// --- dados da descida (descida.ts) ---
test("descida.ts: 7 antessalas e 7 camaras, na ordem, com indices e ids consistentes", () => {
  assert.equal(M.ANTESSALAS.length, M.ANDARES); assert.equal(M.CAMARAS.length, M.ANDARES);
  M.ANTESSALAS.forEach((a, i) => { assert.equal(a.index, i); assert.equal(a.id, `A${i + 1}`); assert.equal(a.mural.vemDe, `C${i + 1}`); });
  M.CAMARAS.forEach((c, i) => { assert.equal(c.index, i); assert.equal(c.id, `C${i + 1}`); });
});
test("descida.ts: oficios fixos (A2/A4 Estante, A3/A5 Bancada, A6 as duas, A1/A7 nenhum)", () => {
  const of = M.ANTESSALAS.map((a) => a.oficios.join("+"));
  assert.deepEqual(of, ["", "estante", "bancada", "estante", "bancada", "estante+bancada", ""]);
});
test("descida.ts: plantas (A6 12x18, as demais 12x12; camaras multiplas de 12; C5 vigilia; C7 sem alcapao)", () => {
  M.ANTESSALAS.forEach((a) => assert.deepEqual(a.planta, { largura: 12, profundidade: a.id === "A6" ? 18 : 12 }));
  M.CAMARAS.forEach((c) => { assert.equal(c.planta.largura % 12, 0); assert.equal(c.planta.profundidade % 12, 0); });
  assert.deepEqual(M.CAMARAS.map((c) => c.modo), ["normal", "normal", "normal", "normal", "vigilia", "normal", "normal"]);
  assert.equal(M.CAMARAS[6].planta.alcapao, null);
  M.CAMARAS.slice(0, 6).forEach((c) => assert.ok(c.planta.alcapao));
});
test("descida.ts: armario inicial (A1 vida, A3 unguento, A5 furia), 4 nichos, reserva so tem Unguento onde ha Bancada", () => {
  assert.equal(M.NICHOS_POR_ANTESSALA, 4);
  assert.deepEqual(M.ANTESSALAS.map((a) => a.armarioInicial.map((f) => f.tipo).join(",")), ["vida", "", "unguento", "", "furia", "", ""]);
  M.ANTESSALAS.forEach((a) => assert.equal(a.reserva.unguento, a.oficios.includes("bancada"), a.id));
});
test("descida.ts: formacoes coerentes (grupos com id unico, gatilhos apontam para grupos existentes; mural honesto)", () => {
  for (const c of M.CAMARAS) {
    const ids = c.formacao.map((g) => g.id);
    assert.equal(new Set(ids).size, ids.length, `${c.id}: ids repetidos`);
    for (const g of c.formacao) {
      if (g.quando.tipo === "apos") assert.ok(ids.includes(g.quando.grupo), `${c.id}: ${g.id} espera um grupo que nao existe`);
    }
    const temOnda2 = c.formacao.some((g) => g.onda === 2);
    assert.equal(c.situacoes.includes("ondas"), temOnda2, `${c.id}: glifo de ondas`);
    const temEmboscada = c.formacao.some((g) => g.emboscada);
    assert.equal(c.situacoes.includes("emboscada"), temEmboscada, `${c.id}: glifo de emboscada`);
    assert.equal(c.situacoes.includes("vigilia"), c.modo === "vigilia", `${c.id}: glifo de vigilia`);
    assert.ok(c.marcos.some((m) => m.noCaminho), `${c.id}: pelo menos um marco no caminho`);
    assert.ok(c.marcos.some((m) => m.leitura), `${c.id}: pelo menos um marco de leitura`);
  }
  const total = (c) => c.formacao.reduce((n, g) => n + g.mortos.length, 0);
  assert.deepEqual(M.CAMARAS.map(total), [2, 3, 4, 5, 4, 5, 0], "C1 tem 2 Mansos (hoje 1); C7 e so a Guardia (chefe)");
});
test("descida.ts: marcas da Cronica e eventos", () => {
  assert.equal(M.markMural(3), "mural:3"); assert.equal(M.markAcendeu(3), "acendeu:3"); assert.equal(M.MARK_SENTINELA_CAIU, "sentinela:caiu");
  assert.deepEqual(Object.values(M.EVT).sort(), ["antessala:enter", "armario:change", "braseiro:lit", "mural:read", "wave:start"]);
});

// --- leitura defensiva e migração do save ---
test("readGameSave: save antigo (sem campos novos) ganha defaults", () => {
  const g = M.readGameSave({ run: { active: false, floorIndex: 0, fagulhas: 5, pocaoVida: 1, pocaoFuria: 0, upgrades: [], seed: 9 } });
  assert.deepEqual({ ...g.run, active: undefined, cinto: undefined }, { ...M.exploracaoDefaults(), active: undefined, cinto: undefined, floorIndex: 0, fagulhas: 5, pocaoVida: 1, pocaoFuria: 0, upgrades: [], seed: 9 });
  assert.deepEqual(g.run.cinto, { vida: 1, furia: 0, unguento: 0 }, "cinto nasce dos contadores legados");
  assert.deepEqual(g.legado, M.nichosVazios());
});
test("readGameSave: blob vazio/undefined/lixo nao quebra", () => {
  for (const b of [undefined, {}, { run: null }, { run: "x" }, { run: [] }, { run: { active: true, braseiros: "x", nichos: 5, cinto: 3 }, legado: "x" }]) {
    const g = M.readGameSave(b);
    assert.equal(g.run.braseiros.length, 7); assert.equal(g.run.nichos.length, 7); assert.equal(g.run.nichos[0].length, 4);
    assert.deepEqual(g.run.sabedoria, [0, 0, 0]); assert.deepEqual(g.legado, M.nichosVazios());
  }
});
test("readGameSave: descida antiga em andamento num andar volta a antessala dele", () => {
  const g = M.readGameSave({ run: { active: true, floorIndex: 3, seed: 5, rota: ["alcapao", "alcapao", "alcapao"] } });
  assert.equal(g.run.no, "antessala@3"); assert.equal(g.run.floorIndex, 3);
  assert.equal("rota" in g.run, false, "a escolha de saida morreu");
  assert.deepEqual(g.run.gasto, []);
  assert.equal(g.codex.includes("andar:4"), true, "semeadura da Cronica continua valendo");
  assert.equal(g.codex.includes("leitura:3"), true);
  assert.equal(g.codex.includes("mural:3"), true, "quem leu a inscricao ja viu a parede dele");
  assert.equal(g.codex.includes("mural:4"), false);
  assert.equal(g.codex.some((m) => m.startsWith("acendeu:")), false);
});
test("readGameSave: antecamara lateral antiga vira a antessala do andar seguinte (o gasto do no se perde)", () => {
  const g = M.readGameSave({ run: { active: true, floorIndex: 2, no: "estante@2", gasto: ["cura"], seed: 5 } });
  assert.equal(g.run.no, "antessala@3"); assert.equal(g.run.floorIndex, 3); assert.deepEqual(g.run.gasto, []);
  const b = M.readGameSave({ run: { active: true, floorIndex: 5, no: "bancada@5" } });
  assert.equal(b.run.no, "antessala@6"); assert.equal(b.run.floorIndex, 6);
  assert.equal(M.readGameSave({ run: { active: true, floorIndex: 1, no: "esquecida@1" } }).run.no, "antessala@2");
  assert.equal(M.readGameSave({ run: { active: false, floorIndex: 2, no: "estante@2" } }).run.no, "", "run inativa: sem lugar");
});
test("readGameSave: lugar novo e valido ou cai na antessala do andar; floorIndex segue o lugar", () => {
  const ok = M.readGameSave({ run: { active: true, floorIndex: 0, no: "camara@4", gasto: ["cura", 7, "", "x".repeat(99)] } });
  assert.equal(ok.run.no, "camara@4"); assert.equal(ok.run.floorIndex, 4); assert.deepEqual(ok.run.gasto, ["cura"]);
  assert.equal(M.readGameSave({ run: { active: true, floorIndex: 2, no: "foo@2" } }).run.no, "antessala@2");
  assert.equal(M.readGameSave({ run: { active: true, floorIndex: 40, no: "" } }).run.floorIndex, 6, "andar fora da descida: clamp");
});
test("readGameSave: braseiro, cinto, nichos e legado sao higienizados", () => {
  const g = M.readGameSave({
    run: {
      active: true, floorIndex: 1, no: "antessala@1", pocaoVida: 2,
      braseiros: [{ aceso: true, chama: "dadiva" }, { aceso: false, chama: "bancada" }, { aceso: true, chama: "lixo" }, null, "x", { aceso: 1 }],
      cinto: { vida: 99, furia: -2, unguento: 1.9 },
      nichos: [[{ tipo: "vida", deixado: true }, { tipo: "veneno" }, null, { tipo: "furia", deixado: "sim" }, { tipo: "unguento" }], "x", [{ tipo: "unguento", deixado: true }]],
    },
    legado: [[{ tipo: "furia", deixado: true }]],
  });
  assert.deepEqual(g.run.braseiros.slice(0, 6), [
    { aceso: true, chama: "dadiva" }, { aceso: false, chama: "" }, { aceso: true, chama: "" }, { aceso: false, chama: "" }, { aceso: false, chama: "" }, { aceso: false, chama: "" },
  ]);
  assert.equal(g.run.braseiros.length, 7);
  assert.deepEqual(g.run.cinto, { vida: 9, furia: 0, unguento: 1 });
  assert.deepEqual(g.run.nichos[0], [{ tipo: "vida", deixado: true }, { tipo: "", deixado: false }, { tipo: "", deixado: false }, { tipo: "furia", deixado: false }]);
  assert.deepEqual(g.run.nichos[1], M.nichosVazios()[1]);
  assert.deepEqual(g.run.nichos[2][0], { tipo: "unguento", deixado: true });
  assert.deepEqual(g.legado[0][0], { tipo: "furia", deixado: true });
  assert.equal(g.legado.length, 7);
  const s = M.readGameSave({ run: { active: true, floorIndex: 1, sabedoria: [99, -3, 4.7], livros: ["a", null], raiz: -4, cera: 2.9, unguento: NaN, ferida: -1, secretos: "x" } });
  assert.deepEqual(s.run.sabedoria, [9, 0, 4]); assert.deepEqual(s.run.livros, ["a"]);
  assert.equal(s.run.raiz, 0); assert.equal(s.run.cera, 2); assert.equal(s.run.unguento, 0); assert.equal(s.run.ferida, 0); assert.deepEqual(s.run.secretos, []);
});
test("readGameSave: ida e volta (o que a rota grava o readGameSave le igual)", () => {
  const r = new M.RouteState();
  r.enterAntessala(4, true); r.acender(4); r.gastarChama(4, "bancada"); r.markSpent("cura"); r.enterCamara(4);
  const g = M.readGameSave({ run: { ...M.exploracaoDefaults(), active: true, floorIndex: 4, ...r.save() } });
  assert.equal(g.run.no, "camara@4"); assert.deepEqual(g.run.gasto, ["cura"]);
  assert.deepEqual(g.run.braseiros[4], { aceso: true, chama: "bancada" });
  const r2 = new M.RouteState();
  assert.deepEqual(r2.load(g.run), { kind: "antessala", index: 4 });
  assert.equal(r2.chamaDisponivel(4), false);
});

// --- registro de ganchos ---
test("ExploracaoRegistry: despacha eventos, carrega campos nao possuidos, snapshot de sistema sobrescreve", () => {
  const reg = new M.ExploracaoRegistry();
  const seen = [];
  reg.register({
    onEnterFloor: (i) => seen.push("floor" + i),
    onEnterAntessala: (i) => seen.push(`antessala ${i}`),
    onFragmentTaken: () => seen.push("frag"),
    onHeroDied: () => seen.push("died"),
    update: (dt) => seen.push("u" + dt),
    snapshot: () => ({ ferida: 17 }),
    restore: (run) => seen.push("restore " + run.no),
  });
  const run = M.readGameSave({ run: { active: true, floorIndex: 1, no: "", raiz: 3, ferida: 5, nichos: [[{ tipo: "vida" }]] } }).run;
  reg.restore(run);
  reg.onEnterFloor(1); reg.onEnterAntessala(1); reg.onFragmentTaken(); reg.onHeroDied(); reg.update(0.5);
  assert.deepEqual(seen, ["restore antessala@1", "floor1", "antessala 1", "frag", "died", "u0.5"]);
  const snap = reg.snapshot();
  assert.equal(snap.raiz, 3, "campo sem dono continua sendo gravado");
  assert.equal(snap.ferida, 17, "o dono sobrescreve");
  assert.deepEqual(snap.nichos[0][0], { tipo: "vida", deixado: false }, "o armario atravessa o registro intacto");
  reg.forget();
  assert.equal(new M.ExploracaoRegistry().snapshot().raiz, undefined);
});

console.log(`\n${passed} testes ok${process.exitCode ? ", COM FALHAS" : ""}`);
