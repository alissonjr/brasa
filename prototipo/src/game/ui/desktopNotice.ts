import "./fonts";
import "./ds/tokens.css";
import "./ds/components.css";
import "./desktopNotice.css";
import { el } from "@engine";
import { icon } from "./ds/icons";
import { T, onLanguageChange, setLanguage } from "./strings";

/**
 * CAMADA JOGO. Aviso de desktop: Brasa é jogado com teclado e mouse. Em aparelho de toque
 * sem teclado o aviso é definitivo (o jogo nem carrega o motor); numa janela estreita
 * (< 700 px) ele cobre o jogo e some quando a janela alarga. Sem controles de toque.
 */
const MIN_WIDTH = 700;

const isTouchOnly = (): boolean =>
  typeof matchMedia === "function" && matchMedia("(hover: none) and (pointer: coarse)").matches;

/** Monta o aviso. Devolve true se o aparelho é só de toque (quem chama deve parar o boot). */
export function installDesktopNotice(): boolean {
  const touch = isTouchOnly();
  // Antes de ler as preferências salvas: o idioma do navegador decide o texto do aviso.
  if (typeof navigator !== "undefined") setLanguage(navigator.language.toLowerCase().startsWith("pt") ? "pt" : "en");

  const title = el("h1", { class: "dn-title", text: T.title });
  const heading = el("h2", { class: "dn-heading" });
  const body = el("p", { class: "dn-body" });
  const foot = el("p", { class: "dn-foot" });
  const kbd = el("span", { class: "dn-device" });
  const mouse = el("span", { class: "dn-device" });
  const root = el(
    "div",
    { class: "dn-root", role: "alertdialog", "aria-modal": "true", "aria-labelledby": "dn-heading", hidden: true },
    el("div", { class: "dn-glow", "aria-hidden": "true" }),
    el(
      "div",
      { class: "dn-card" },
      title,
      el("div", { class: "ds-divider dn-div" }, el("i")),
      el("div", { class: "dn-devices", "aria-hidden": "true" }, kbd, mouse),
      heading,
      body,
      foot
    )
  );
  heading.id = "dn-heading";

  const paint = (): void => {
    title.textContent = T.title;
    heading.textContent = T.avisoTitulo;
    body.textContent = touch ? T.avisoToque : T.avisoEstreito;
    foot.textContent = T.avisoRodape;
    kbd.innerHTML = icon("keyboard", 44) + `<span>${T.avisoTeclado}</span>`;
    mouse.innerHTML = icon("mouse", 44) + `<span>${T.avisoMouse}</span>`;
  };
  paint();
  onLanguageChange(paint);

  const sync = (): void => {
    const show = touch || window.innerWidth < MIN_WIDTH;
    root.hidden = !show;
    document.documentElement.classList.toggle("dn-open", show);
  };
  document.body.appendChild(root);
  sync();
  if (!touch) window.addEventListener("resize", sync);
  return touch;
}
