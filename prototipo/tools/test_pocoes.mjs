// Testes unitarios do modelo de pocoes/armario (sem navegador): `node tools/test_pocoes.mjs`.
// Empacota src/game/run/pocoes.ts com o esbuild (dependencia do Vite) e roda com node:assert.
// Cobre: cinto e tetos, retirar/guardar, reserva (estoque, preco, fim), compra com cinto cheio,
// guarda de desperdicio, legado (invariante, frasco infinito, ordem Marta x legado), serializacao.
import assert from "node:assert/strict";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = await build({
  stdin: { contents: `export * from "./src/game/run/pocoes.ts";`, resolveDir: root, loader: "ts" },
  bundle: true, platform: "node", format: "esm", write: false, logLevel: "silent",
});
const M = await import("data:text/javascript;base64," + Buffer.from(out.outputFiles[0].text).toString("base64"));
const { Pocoes } = M;

let passed = 0;
const test = (name, fn) => {
  try { fn(); passed++; console.log("ok   " + name); }
  catch (e) { console.log("FAIL " + name + "\n     " + (e && e.message)); process.exitCode = 1; }
};
const vazio = () => Array.from({ length: 7 }, () => []);

test("tetos e custos vem de POTIONS (3, 2, 2; 4 e 6; Unguento nao se compra)", () => {
  assert.deepEqual([M.POCAO_DEF.vida.teto, M.POCAO_DEF.furia.teto, M.POCAO_DEF.unguento.teto], [3, 2, 2]);
  assert.deepEqual([M.POCAO_DEF.vida.custo, M.POCAO_DEF.furia.custo, M.POCAO_DEF.unguento.custo], [4, 6, null]);
});

test("descida nova: cinto vazio, 7 antessalas de 4 nichos, Marta em A1 (vida), A3 (unguento), A5 (furia)", () => {
  const p = new Pocoes();
  assert.deepEqual(p.cinto, { vida: 0, furia: 0, unguento: 0 });
  assert.equal(p.nichos.length, 7);
  for (const f of p.nichos) assert.equal(f.length, 4);
  assert.deepEqual(p.nichos.map((f) => f[0]?.tipo ?? null), ["vida", null, "unguento", null, "furia", null, null]);
  assert.equal(p.nichos[0][0].origem, "marta");
  assert.equal(p.total(), 3);
  assert.deepEqual(p.reserva[3], { vida: 2, furia: 1 });
});

test("cinto de partida respeita o teto e a identidade do objeto cinto se mantem (alias)", () => {
  const p = new Pocoes(undefined, { cinto: { vida: 1, furia: 9 } });
  const alias = p.cinto;
  assert.deepEqual(alias, { vida: 1, furia: 2, unguento: 0 });
  p.reiniciar(undefined, { cinto: { vida: 1 } });
  assert.equal(p.cinto, alias);
  assert.deepEqual(alias, { vida: 1, furia: 0, unguento: 0 });
});

test("retirar: vai ao cinto, esvazia o nicho; com o espaco do tipo cheio BLOQUEIA e nada se perde", () => {
  const p = new Pocoes(undefined, { cinto: { vida: 3 } });
  const antes = p.total();
  assert.deepEqual(p.retirar(0, 0), { ok: false, motivo: "cinto-cheio" });
  assert.equal(p.total(), antes);
  assert.notEqual(p.nichos[0][0], null);
  assert.equal(p.cinto.vida, 3);
  p.consumir("vida");
  assert.deepEqual(p.retirar(0, 0), { ok: true });
  assert.equal(p.cinto.vida, 3);
  assert.equal(p.nichos[0][0], null);
  assert.deepEqual(p.retirar(0, 0), { ok: false, motivo: "nicho-vazio" });
  assert.deepEqual(p.retirar(0, 9), { ok: false, motivo: "nicho-invalido" });
  assert.deepEqual(p.retirar(9, 0), { ok: false, motivo: "andar-invalido" });
});

test("retirar de outro tipo funciona com o cinto cheio de um tipo diferente", () => {
  const p = new Pocoes(undefined, { cinto: { vida: 3 } });
  assert.deepEqual(p.retirar(2, 0), { ok: true }); // unguento de Marta em A3
  assert.equal(p.cinto.unguento, 1);
});

test("guardar: move 1 do cinto ao primeiro nicho vazio; sem carga e sem nicho bloqueiam", () => {
  const p = new Pocoes(undefined, { cinto: { vida: 2 } });
  assert.deepEqual(p.guardar(1, "furia"), { ok: false, motivo: "cinto-vazio" });
  assert.deepEqual(p.guardar(1, "vida"), { ok: true, destino: "nicho", nicho: 0 });
  assert.equal(p.cinto.vida, 1);
  assert.deepEqual(p.nichos[1][0], { tipo: "vida", origem: "seu", deixar: false, gravado: false });
  p.guardar(1, "vida");
  p.cinto.vida = 3;
  p.guardar(1, "vida"); p.guardar(1, "vida");
  assert.deepEqual(p.guardar(1, "vida"), { ok: false, motivo: "sem-nicho" });
  assert.equal(p.cinto.vida, 1);
  assert.deepEqual(p.guardar(1, "vida", { nicho: 7 }), { ok: false, motivo: "nicho-invalido" });
});

test("guardar em nicho escolhido; nicho ocupado bloqueia", () => {
  const p = new Pocoes(undefined, { cinto: { vida: 2 }, marta: false });
  assert.deepEqual(p.guardar(0, "vida", { nicho: 2 }), { ok: true, destino: "nicho", nicho: 2 });
  assert.deepEqual(p.guardar(0, "vida", { nicho: 2 }), { ok: false, motivo: "sem-nicho" });
});

test("conservacao: guardar e retirar em loop nunca perde nem cria frasco", () => {
  const p = new Pocoes(undefined, { cinto: { vida: 3, furia: 2 } });
  const n = p.total();
  for (let i = 0; i < 40; i++) {
    const a = i % 7;
    if (i % 3 === 0) p.guardar(a, i % 2 ? "vida" : "furia");
    else p.retirar(a, i % 4);
    assert.equal(p.total(), n);
    for (const t of M.POCOES) assert.ok(p.cinto[t] <= M.POCAO_DEF[t].teto && p.cinto[t] >= 0);
  }
});

test("reserva: estoque fixo (2 vida, 1 furia), preco 4 e 6, esgota, Unguento nao vende", () => {
  const p = new Pocoes();
  assert.deepEqual(p.comprar(3, "vida", 100), { ok: true, custo: 4, destino: "cinto", nicho: undefined });
  assert.deepEqual(p.comprar(3, "vida", 100), { ok: true, custo: 4, destino: "cinto", nicho: undefined });
  assert.deepEqual(p.comprar(3, "vida", 100), { ok: false, motivo: "sem-estoque" });
  assert.deepEqual(p.comprar(3, "furia", 5), { ok: false, motivo: "sem-fagulha" });
  assert.equal(p.estoque(3, "furia"), 1);
  assert.equal(p.comprar(3, "furia", 6).custo, 6);
  assert.deepEqual(p.comprar(3, "furia", 99), { ok: false, motivo: "sem-estoque" });
  assert.deepEqual(p.comprar(3, "unguento", 99), { ok: false, motivo: "nao-vende" });
  assert.deepEqual(p.cinto, { vida: 2, furia: 1, unguento: 0 });
  assert.equal(p.estoque(4, "vida"), 2); // outra antessala tem o seu estoque
});

test("reserva: compra com o cinto cheio vai ao nicho; sem nicho BLOQUEIA e nao gasta estoque", () => {
  const p = new Pocoes(undefined, { cinto: { vida: 3 }, marta: false });
  const r = p.comprar(1, "vida", 100);
  assert.deepEqual(r, { ok: true, custo: 4, destino: "nicho", nicho: 0 });
  assert.equal(p.nichos[1][0].tipo, "vida");
  assert.equal(p.estoque(1, "vida"), 1);
  p.guardar(1, "vida"); p.guardar(1, "vida"); p.guardar(1, "vida"); // enche (cinto 3 -> 0, 3 nichos)
  p.cinto.vida = 3;
  assert.deepEqual(p.comprar(1, "vida", 100), { ok: false, motivo: "sem-nicho" });
  assert.equal(p.estoque(1, "vida"), 1);
  assert.equal(p.cinto.vida, 3);
});

test("receber (Bancada): cinto, depois nicho, depois bloqueia; cabe() antecipa", () => {
  const p = new Pocoes(undefined, { cinto: { unguento: 1 }, marta: false });
  assert.equal(p.cabe(2, "unguento"), true);
  assert.deepEqual(p.receber(2, "unguento"), { ok: true, destino: "cinto" });
  assert.equal(p.cabe(2, "unguento"), true);
  assert.deepEqual(p.receber(2, "unguento"), { ok: true, destino: "nicho", nicho: 0 });
  p.receber(2, "unguento"); p.receber(2, "unguento"); p.receber(2, "unguento");
  assert.equal(p.cabe(2, "unguento"), false);
  assert.deepEqual(p.receber(2, "unguento"), { ok: false, motivo: "sem-nicho" });
});

test("guarda de desperdicio: vida cheia nao gasta, Unguento sem Ferida nao gasta, Furia e livre", () => {
  const p = new Pocoes(undefined, { cinto: { vida: 2, furia: 1, unguento: 1 } });
  assert.equal(p.usar("vida", { vidaNoTeto: true }), "vida-cheia");
  assert.equal(p.cinto.vida, 2);
  assert.equal(p.usar("vida", { vidaNoTeto: false }), "ok");
  assert.equal(p.cinto.vida, 1);
  assert.equal(p.usar("unguento", { vidaNoTeto: false, feridaFrac: 0.04 }), "sem-ferida");
  assert.equal(p.usar("unguento", { vidaNoTeto: true }), "sem-ferida");
  assert.equal(p.cinto.unguento, 1);
  assert.equal(p.usar("unguento", { vidaNoTeto: false, feridaFrac: 0.05 }), "ok");
  assert.equal(p.cinto.unguento, 0);
  assert.equal(p.usar("unguento", { vidaNoTeto: false, feridaFrac: 0.3 }), "vazio");
  assert.equal(p.usar("furia", { vidaNoTeto: true }), "ok");
  assert.equal(p.usar("furia", { vidaNoTeto: true }), "vazio");
  assert.equal(p.podeUsar("vida", { vidaNoTeto: false }), "ok");
  assert.equal(p.cinto.vida, 1); // podeUsar nao gasta
  assert.equal(p.consumir("vida"), true);
  assert.equal(p.consumir("vida"), false);
});

test("legado: so grava ao cruzar a porta, e so o que esta marcado", () => {
  const p = new Pocoes(undefined, { cinto: { vida: 2 } });
  p.guardar(1, "vida", { deixar: true });
  p.guardar(1, "vida"); // guardado, mas nao deixado
  assert.deepEqual(p.toSaveLegado()[1], []);
  assert.deepEqual(p.cruzarPorta(1), ["vida"]);
  assert.deepEqual(p.toSaveLegado()[1], ["vida"]);
  assert.equal(p.nichos[1][0].gravado, true);
  assert.equal(p.nichos[1][1].gravado, false);
  assert.equal(p.nichos[1].filter(Boolean).length, 2); // derrota: nichos intactos
});

test("legado: desmarcar antes de cruzar nao grava; desmarcar depois tira do legado", () => {
  const p = new Pocoes(undefined, { cinto: { furia: 2 } });
  p.guardar(1, "furia", { deixar: true });
  assert.deepEqual(p.marcarLegado(1, 0, false), { ok: true });
  assert.deepEqual(p.cruzarPorta(1), []);
  p.marcarLegado(1, 0, true);
  assert.deepEqual(p.cruzarPorta(1), ["furia"]);
  p.marcarLegado(1, 0); // alterna: desmarca o gravado
  assert.deepEqual(p.toSaveLegado()[1], []);
  assert.equal(p.nichos[1][0].gravado, false);
  assert.deepEqual(p.marcarLegado(1, 3), { ok: false, motivo: "nicho-vazio" });
});

test("legado chega na descida seguinte como 'de quem desceu antes', marcado e gravado, apos Marta no 1o livre", () => {
  const lg = vazio(); lg[0] = ["furia", "furia"];
  const p = new Pocoes(lg);
  assert.deepEqual(p.nichos[0].map((f) => f && [f.tipo, f.origem, f.deixar, f.gravado]), [
    ["furia", "legado", true, true], ["furia", "legado", true, true], ["vida", "marta", false, false], null,
  ]);
});

test("legado com 4 frascos: o frasco de Marta nao cabe e e omitido (o legado e do jogador)", () => {
  const lg = vazio(); lg[2] = ["vida", "vida", "furia", "unguento"];
  const p = new Pocoes(lg);
  assert.equal(p.ocupados(2), 4);
  assert.ok(p.nichos[2].every((f) => f.origem === "legado"));
  assert.equal(p.nichoLivre(2), -1);
});

test("EXPLORACAO FECHADA: pegar o frasco do legado o CONSOME; nao volta na proxima descida", () => {
  const lg = vazio(); lg[0] = ["furia"];
  const p = new Pocoes(lg);
  assert.deepEqual(p.retirar(0, 0), { ok: true });
  assert.deepEqual(p.toSaveLegado()[0], []); // sai do perfil na hora
  p.cruzarPorta(0);
  assert.deepEqual(p.toSaveLegado()[0], []);
  const prox = new Pocoes(p.toSaveLegado());
  assert.ok(prox.nichos[0].every((f) => !f || f.origem !== "legado"));
});

test("EXPLORACAO FECHADA: devolver o frasco ao mesmo nicho sem marcar nao o deixa no legado", () => {
  const lg = vazio(); lg[0] = ["vida"];
  const p = new Pocoes(lg);
  p.retirar(0, 0);
  p.guardar(0, "vida", { nicho: 0 }); // volta como 'seu', sem marca
  p.cruzarPorta(0);
  assert.deepEqual(p.toSaveLegado()[0], []);
});

test("legado: cruzar de novo (derrota e retorno) nao duplica nem apaga o gravado", () => {
  const p = new Pocoes(undefined, { cinto: { vida: 1 } });
  p.guardar(0, "vida", { deixar: true });
  p.cruzarPorta(0);
  p.cruzarPorta(0);
  assert.deepEqual(p.toSaveLegado()[0], ["vida"]);
  // retirar apos a derrota: cai do legado, sem duplicar com o cinto
  const i = p.nichos[0].findIndex((f) => f && f.origem === "seu");
  p.retirar(0, i);
  assert.deepEqual(p.toSaveLegado()[0], []);
  assert.equal(p.cinto.vida, 1);
});

test("invariante: legado[andar] == frascos gravados do andar, em sequencias aleatorias", () => {
  let s = 12345;
  const rnd = (n) => ((s = (s * 1103515245 + 12345) & 0x7fffffff) % n);
  const p = new Pocoes(undefined, { cinto: { vida: 3, furia: 2 } });
  for (let i = 0; i < 600; i++) {
    const a = rnd(7), n = rnd(4), t = M.POCOES[rnd(3)];
    switch (rnd(7)) {
      case 0: p.guardar(a, t, { deixar: rnd(2) === 0 }); break;
      case 1: p.retirar(a, n); break;
      case 2: p.marcarLegado(a, n); break;
      case 3: p.cruzarPorta(a); break;
      case 4: p.comprar(a, t, 99); break;
      case 5: p.receber(a, t); break;
      default: p.consumir(t);
    }
    for (let x = 0; x < 7; x++) {
      const g = p.nichos[x].filter((f) => f && f.gravado).map((f) => f.tipo).sort();
      assert.deepEqual([...p.legado[x]].sort(), g, `andar ${x} passo ${i}`);
      assert.ok(p.legado[x].length <= 4);
    }
    for (const k of M.POCOES) assert.ok(p.cinto[k] >= 0 && p.cinto[k] <= M.POCAO_DEF[k].teto);
  }
});

test("serializacao: ida e volta preserva tudo (cinto, nichos com origem e marcas, reserva gasta, legado)", () => {
  const p = new Pocoes(undefined, { cinto: { vida: 1 } });
  p.comprar(3, "vida", 50); p.comprar(3, "furia", 50);
  p.guardar(3, "vida", { deixar: true });
  p.cruzarPorta(3);
  p.guardar(3, "furia");
  const blob = JSON.parse(JSON.stringify(p.toSave()));
  const q = Pocoes.fromSave(blob.run, blob.legado);
  assert.deepEqual(q.toSave(), p.toSave());
  assert.deepEqual(q.cinto, p.cinto);
  assert.equal(q.estoque(3, "vida"), 1);
  assert.equal(q.estoque(3, "furia"), 0);
});

test("reserva NAO reabastece ao retomar (Continuar) nem apos derrota", () => {
  const p = new Pocoes();
  p.comprar(1, "vida", 99); p.comprar(1, "vida", 99);
  const q = Pocoes.fromSave(p.toSaveRun(), p.toSaveLegado());
  assert.equal(q.estoque(1, "vida"), 0);
  assert.deepEqual(q.comprar(1, "vida", 99), { ok: false, motivo: "sem-estoque" });
});

test("fromSave defensivo: lixo vira padrao, tetos e tamanhos respeitados, tipos desconhecidos somem", () => {
  const q = Pocoes.fromSave(
    { cinto: [99, -4, "x"], nichos: [["vida:legado:dg", "poison:seu:", 5, null, "furia:seu:d"], "lixo", [["a"]]], reserva: [[9, 9], "x"] },
    [["vida", "arsenico", 7, "vida", "vida", "vida", "vida"], null, "x"]
  );
  assert.deepEqual(q.cinto, { vida: 3, furia: 0, unguento: 0 });
  assert.equal(q.nichos.length, 7);
  for (const f of q.nichos) assert.equal(f.length, 4);
  assert.deepEqual(q.nichos[0].map((f) => f && f.tipo), ["vida", null, null, null]);
  assert.deepEqual(q.legado[0], ["vida", "vida", "vida", "vida"]);
  assert.deepEqual(q.reserva[0], { vida: 2, furia: 1 });
  assert.deepEqual(q.reserva[1], { vida: 2, furia: 1 });
  assert.deepEqual(q.legado[1], []);
  for (const v of [undefined, null, 5, "s", [], {}]) {
    const r = Pocoes.fromSave(v, v);
    assert.equal(r.nichos.length, 7);
  }
});

test("fromSave reconcilia: 'gravado' sem legado correspondente no perfil perde a marca (sem frasco infinito)", () => {
  const p = new Pocoes(undefined, { cinto: { vida: 1 } });
  p.guardar(0, "vida", { deixar: true });
  p.cruzarPorta(0);
  const q = Pocoes.fromSave(p.toSaveRun(), vazio()); // perfil sem o legado
  const f = q.nichos[0].find((x) => x && x.origem === "seu");
  assert.equal(f.gravado, false);
  assert.equal(f.deixar, true);
});

test("save antigo (sem o campo novo): cargas de pocaoVida, pocaoFuria e unguento, clamp ao teto", () => {
  const q = Pocoes.fromSave(undefined, undefined, { pocaoVida: 2, pocaoFuria: 5, unguento: 1 });
  assert.deepEqual(q.cinto, { vida: 2, furia: 2, unguento: 1 });
  const z = Pocoes.fromSave(undefined, undefined, {});
  assert.deepEqual(z.cinto, { vida: 0, furia: 0, unguento: 0 });
});

test("carregar() e EM LUGAR: a identidade de cinto sobrevive (alias inv do main.ts)", () => {
  const p = new Pocoes(undefined, { cinto: { vida: 1 } });
  const alias = p.cinto;
  p.comprar(2, "vida", 50);
  const blob = JSON.parse(JSON.stringify(p.toSave()));
  const q = new Pocoes(undefined, { cinto: { vida: 3, furia: 2 } });
  const aq = q.cinto;
  q.carregar(blob.run, blob.legado);
  assert.equal(q.cinto, aq);
  assert.deepEqual(q.toSave(), p.toSave());
  p.carregar(undefined, undefined, { pocaoVida: 2 });
  assert.equal(p.cinto, alias);
  assert.deepEqual(alias, { vida: 2, furia: 0, unguento: 0 });
});

console.log(`\n${passed} testes ok` + (process.exitCode ? " (HA FALHAS)" : ""));
