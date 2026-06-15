// Valida (compila) os roteiros .ink usando o compilador do inkjs.
// Uso: node scripts/validate-ink.cjs  (a partir de prototipo/)
// Nao grava JSON; so reporta erros e avisos de cada capitulo.
const fs = require("fs");
const path = require("path");
const ink = require("inkjs/full");
const { Compiler, CompilerOptions } = ink;

const NARRATIVA = path.resolve(__dirname, "../../narrativa");
const ORDEM = [
  "jordao.ink",
  "jerico.ink",
  "ai.ink",
  "gibeao.ink",
  "gibeao-batalha.ink",
  "campanha-sul.ink",
  "hazor.ink",
  "epilogo.ink",
];

let totalErros = 0;
let totalAvisos = 0;

for (const arquivo of ORDEM) {
  const caminho = path.join(NARRATIVA, arquivo);
  const fonte = fs.readFileSync(caminho, "utf8");
  const erros = [];
  const avisos = [];
  const opts = new CompilerOptions(null, [], false, (mensagem, tipo) => {
    const t = String(tipo);
    // ErrorType: 0=Author/Info(TODO), 1=Warning, 2=Error em inkjs
    if (/error/i.test(t) || t === "2") erros.push(mensagem);
    else avisos.push(mensagem);
  });

  let ok = false;
  try {
    const story = new Compiler(fonte, opts).Compile();
    ok = !!story && erros.length === 0;
  } catch (e) {
    erros.push(String(e && e.message ? e.message : e));
  }

  totalErros += erros.length;
  totalAvisos += avisos.length;

  const status = erros.length === 0 ? "OK " : "FALHA";
  console.log(`\n[${status}] ${arquivo}`);
  for (const a of avisos) console.log(`   aviso: ${a.trim()}`);
  for (const er of erros) console.log(`   ERRO:  ${er.trim()}`);
}

console.log(
  `\n==== resumo: ${ORDEM.length} capitulos, ${totalErros} erro(s), ${totalAvisos} aviso(s) ====`
);
process.exit(totalErros > 0 ? 1 : 0);
