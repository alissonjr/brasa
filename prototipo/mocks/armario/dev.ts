// Página de dev do armário: monta a UI real com o modelo real e dados falsos.
import "../../src/game/ui/ds/tokens.css";
import "../../src/game/ui/theme.css";
import "../../src/game/ui/ds/components.css";
import "../../src/game/ui/fonts";
import { Pocoes, type Pocao } from "../../src/game/run/pocoes";
import { openArmario, type ArmarioHandle } from "../../src/game/ui/armarioUi";
import { setLanguage, T, onLanguageChange } from "../../src/game/ui/strings";
import { configureUiSound } from "../../src/game/ui/uiSound";

const q = new URLSearchParams(location.search);
const root = document.documentElement;
configureUiSound(() => 0.4);

let fagulhas = Number(q.get("fagulhas") ?? 12);
let andar = Math.min(6, Math.max(0, Number(q.get("andar") ?? 0)));
const legadoFalso = (): Pocao[][] => [["furia"], [], ["vida", "unguento"], [], [], [], []];
const nova = (): Pocoes => {
  const cintoQ = q.get("cinto");
  const cinto = cintoQ === "cheio" ? { vida: 3, furia: 2, unguento: 2 } : cintoQ === "vazio" ? {} : { vida: 2, furia: 1 };
  return new Pocoes(q.get("legado") ? legadoFalso() : undefined, { cinto });
};
let pocoes = nova();
let aberto: ArmarioHandle | null = null;

const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;
const log = (s: string): void => void ($("log").textContent = s);

const hud = (): void => {
  const pot = (k: string, label: string, n: number): string => `<span class="hud-pot${n > 0 ? "" : " off"}"><span class="ds-kbd">${k}</span>${label} ×${n}</span>`;
  $("hud").innerHTML = pot("1", T.potRecuperacao, pocoes.cinto.vida) + pot("2", T.potFuria, pocoes.cinto.furia);
};
const salvo = (): void => {
  $("save").textContent = JSON.stringify(pocoes.toSave(), null, 1);
  $("fag").textContent = String(fagulhas);
};

const abrir = (): void => {
  if (aberto) return;
  const h = openArmario({
    pocoes,
    andar,
    fagulhas: () => fagulhas,
    gastarFagulhas: (n) => (fagulhas -= n),
    onChange: () => {
      hud();
      salvo();
      log("armario:change");
    },
    deny: () => log("denyBlip"),
  });
  aberto = h;
  void h.closed.then(() => {
    aberto = null;
    salvo();
  });
};

// controles
const tools = $("tools");
const btn = (rot: string, fn: () => void): HTMLButtonElement => {
  const b = document.createElement("button");
  b.className = "ds-btn ds-btn--sm";
  b.type = "button";
  b.innerHTML = `<span class="ds-btn__label">${rot}</span>`;
  b.addEventListener("click", fn);
  tools.append(b);
  return b;
};
const sel = document.createElement("select");
sel.innerHTML = Array.from({ length: 7 }, (_, i) => `<option value="${i}">A${i + 1}</option>`).join("");
sel.value = String(andar);
sel.addEventListener("change", () => (andar = Number(sel.value)));
const lab = document.createElement("label");
lab.append("Antessala ", sel);
const fagLab = document.createElement("label");
fagLab.innerHTML = 'Fagulhas <b id="fag"></b>';
tools.append(lab, fagLab);
btn("Abrir (R)", abrir);
btn("+10 fagulhas", () => ((fagulhas += 10), salvo()));
btn("Nova descida", () => ((pocoes = nova()), hud(), salvo(), log("nova descida")));
btn("Cruzar a porta", () => {
  const l = pocoes.cruzarPorta(andar);
  salvo();
  log(`legado gravado em A${andar + 1}: ${l.join(", ") || "nada"}`);
});
btn("Nova descida com o legado", () => {
  pocoes = new Pocoes(pocoes.toSaveLegado() as Pocao[][], { cinto: { vida: 1 } });
  hud();
  salvo();
  log("legado carregado na descida nova");
});
btn("EN / PT", () => setLanguage(document.documentElement.lang === "en" ? "pt" : "en"));
btn("Alto contraste", () => root.classList.toggle("high-contrast"));
btn("Sem movimento", () => root.classList.toggle("reduce-motion"));

window.addEventListener("keydown", (e) => {
  if (e.code === "KeyR" && !aberto && !e.repeat) abrir();
});
onLanguageChange(hud);
if (q.get("lang") === "en") setLanguage("en");
if (q.get("contraste")) root.classList.add("high-contrast");
if (q.get("sem-movimento")) root.classList.add("reduce-motion");
(window as unknown as { __arm: unknown }).__arm = { get pocoes() { return pocoes; }, abrir, get aberto() { return aberto; } };
hud();
salvo();
if (!q.get("fechado")) abrir();
