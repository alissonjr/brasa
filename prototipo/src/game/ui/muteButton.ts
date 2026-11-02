import type { SettingsService } from "../../platform";
import { icon } from "./ds/icons";
import { T, onLanguageChange } from "./strings";

/**
 * CAMADA JOGO. Botão de MUDO sempre visível (canto inferior direito, em qualquer tela) e a
 * tecla M. Alterna `settings.muted`; os volumes vivos de todos os sons já multiplicam por isso.
 */
const CSS = `
.mute-btn { position: fixed; right: 16px; bottom: 16px; z-index: 80; width: 40px; height: 40px;
  display: grid; place-items: center; cursor: pointer; border-radius: 50%;
  background: rgba(10,13,19,0.86); border: 1px solid var(--gold-700); color: var(--gold-200);
  box-shadow: var(--shadow-2); transition: color var(--dur-fast), border-color var(--dur-fast); }
.mute-btn:hover, .mute-btn:focus-visible { color: var(--gold-100); border-color: var(--gold-400); outline: none; }
.mute-btn.is-muted { color: var(--text-lo); border-color: var(--ink-600); }
`;

export function mountMuteButton(settings: SettingsService): void {
  const style = document.createElement("style");
  style.textContent = CSS;
  document.head.appendChild(style);

  const b = document.createElement("button");
  b.type = "button";
  b.className = "mute-btn";
  document.body.appendChild(b);

  const render = (): void => {
    const muted = settings.get().muted;
    b.classList.toggle("is-muted", muted);
    b.innerHTML = icon(muted ? "mute" : "sound", 22);
    const label = muted ? T.ativarSom : T.silenciar;
    b.title = label;
    b.setAttribute("aria-label", label);
    b.setAttribute("aria-pressed", String(muted));
  };
  const toggle = (): void => {
    settings.set({ muted: !settings.get().muted });
    render();
    b.blur(); // não deixar o foco prender Espaço/Enter do jogo
  };

  b.addEventListener("click", toggle);
  window.addEventListener("keydown", (e) => {
    if (e.code !== "KeyM" || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target as HTMLElement | null;
    if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
    toggle();
  });
  onLanguageChange(render);
  render();
}
