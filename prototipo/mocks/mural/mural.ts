// Página de dev dos murais (ver index.html). Só usa módulos de ui/ sem Babylon.
import "../../src/game/ui/fonts";
import "../../src/game/ui/ds/tokens.css";
import "../../src/game/ui/theme.css";
import "../../src/game/ui/ds/components.css";
import { setLanguage, T, F } from "../../src/game/ui/strings";
import { BUST_KINDS, HAZARD_KINDS, glyphSvg, tallySvg } from "../../src/game/ui/ds/illustrations";
import {
  MuralPlate,
  buildMuralPlate,
  mortoNome,
  muralDataFor,
  muralFoiSvg,
  muralRegistro,
  muralVemSvg,
  perigoNome,
} from "../../src/game/ui/muralPlate";
import { rasterizeSvg } from "../../src/game/ui/muralRaster";

const $ = <E extends HTMLElement>(id: string): E => document.getElementById(id) as E;
const root = document.documentElement;
const params = new URLSearchParams(location.search);
const antessalaNome = (n: number): string => (T as Record<string, string>)[`muralAntessala${n}`] ?? "";

// --- opções da página ---
const toggle = (id: string, on: (v: boolean) => void): void => {
  const b = $(id);
  b.addEventListener("click", () => {
    const v = b.getAttribute("aria-pressed") !== "true";
    b.setAttribute("aria-pressed", String(v));
    on(v);
  });
};
toggle("t-hc", (v) => root.classList.toggle("high-contrast", v));
toggle("t-rm", (v) => root.classList.toggle("reduce-motion", v));
toggle("t-gray", (v) => document.body.classList.toggle("gray", v));
toggle("t-zoom", (v) => root.style.setProperty("--ui-zoom", v ? "2" : "1"));
toggle("t-en", (v) => {
  setLanguage(v ? "en" : "pt");
  root.lang = v ? "en" : "pt-BR";
  fillAndar();
  buildPairs();
  buildAlphabet();
});

// --- placa ao vivo ---
const stage = $("stage");
const sel = $<HTMLSelectElement>("sel-andar");
let lit = false;
const log = (s: string): void => {
  $("log").textContent = s;
};
function fillAndar(): void {
  const cur = sel.value || params.get("andar") || "3";
  sel.innerHTML = "";
  for (let n = 1; n <= 7; n++) {
    const o = document.createElement("option");
    o.value = String(n);
    o.textContent = `${n}. ${antessalaNome(n)}`;
    sel.append(o);
  }
  sel.value = cur;
}
fillAndar();
const plate = new MuralPlate(stage, {
  onOpen: (n, l) => log(`aberta: andar ${n}, ${l ? "aceso" : "frio"}`),
  onClose: () => log("fechada"),
});
(window as unknown as { plate: MuralPlate }).plate = plate;
$("b-abrir").addEventListener("click", () => plate.toggle(Number(sel.value), lit));
$("b-acender").addEventListener("click", () => {
  lit = true;
  $("b-frio").setAttribute("aria-pressed", "false");
  $("b-frio").textContent = "Braseiro aceso";
  plate.setLit(true);
});
$("b-frio").addEventListener("click", () => {
  lit = !lit;
  $("b-frio").setAttribute("aria-pressed", String(!lit));
  $("b-frio").textContent = lit ? "Braseiro aceso" : "Braseiro apagado";
  plate.setLit(lit);
});
document.addEventListener("keydown", (e) => {
  if (e.code === "KeyR" && !e.repeat && !plate.isOpen && !(e.target instanceof HTMLSelectElement)) plate.open(Number(sel.value), lit);
});

// --- os sete andares nos dois estados ---
function buildPairs(): void {
  const host = $("pairs");
  host.innerHTML = "";
  for (let n = 1; n <= 7; n++) {
    const d = muralDataFor(n);
    for (const l of [false, true]) {
      const cell = document.createElement("div");
      cell.id = `p${n}${l ? "a" : "f"}`;
      const cap = document.createElement("div");
      cap.className = "cap";
      cap.textContent = `A${n} ${antessalaNome(n)} (${l ? "aceso" : "frio"})  |  registro: ${muralRegistro(n)}`;
      const { plate: p } = buildMuralPlate(d, l);
      p.removeAttribute("role");
      cell.append(cap, p);
      host.append(cell);
    }
  }
}
buildPairs();

// --- alfabeto ---
function buildAlphabet(): void {
  const host = $("alf");
  host.innerHTML = "";
  const add = (svg: string, name: string, cls = "g"): void => {
    const f = document.createElement("figure");
    const g = document.createElement("div");
    g.className = cls;
    g.innerHTML = svg;
    const c = document.createElement("figcaption");
    c.textContent = name;
    f.append(g, c);
    host.append(f);
  };
  for (const k of BUST_KINDS) add(glyphSvg(k), mortoNome(k));
  add(glyphSvg("sentinela_manto"), `${mortoNome("sentinela")} ${T.muralManto}`);
  for (const k of HAZARD_KINDS) add(glyphSvg(k), perigoNome(k));
  for (const n of [1, 2, 3, 4, 5, 7]) add(tallySvg(n), F("muralItem", { nome: "marcas", n }), "g t");
}
buildAlphabet();

// --- paisagem + textura ---
async function buildLand(): Promise<void> {
  const host = $("land");
  for (const n of [1, 3, 4, 6, 7]) {
    const d = muralDataFor(n);
    for (const side of ["foi", "vem"] as const) {
      const svg = side === "foi" ? muralFoiSvg(d, "paisagem") : muralVemSvg(d, "paisagem");
      const box = document.createElement("div");
      box.className = "box";
      box.innerHTML = svg;
      const cap = document.createElement("div");
      cap.className = "cap";
      cap.textContent = `A${n} ${side}: SVG com a folha da página`;
      const wrap = document.createElement("div");
      wrap.append(cap, box);
      host.append(wrap);
      const cv = await rasterizeSvg(svg, 1024, 512);
      const cap2 = document.createElement("div");
      cap2.className = "cap";
      cap2.textContent = `A${n} ${side}: imagem autônoma, canvas 1024x512`;
      const w2 = document.createElement("div");
      w2.append(cap2, cv);
      host.append(w2);
    }
  }
  document.body.dataset.ready = "1";
}
void buildLand().catch((e) => {
  document.body.dataset.err = String(e);
});
