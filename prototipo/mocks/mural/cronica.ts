// Monta a CodexScreen real com marcas fabricadas, para ver os decalques em dois estados.
// ?marks=mural:1,mural:2,leitura:2,limpou:2 (default abaixo). ?folheto=2 abre o folheto do andar 2.
import { CodexLog } from "../../src/game/content/codex";
import { CodexScreen } from "../../src/game/ui/screens";

const q = new URLSearchParams(location.search);
const marks = (q.get("marks") ?? "andar:1,andar:2,andar:3,andar:4,mural:1,mural:2,leitura:2,limpou:2,mural:3,leitura:3,mural:4,leitura:1,limpou:1,mural:6").split(",");
const host = document.getElementById("host")!;
host.className = "ui-root";
let top: HTMLElement | null = null;
const ctx = {
  codex: new CodexLog(marks),
  settings: { get: () => ({ reducedMotion: true }) },
  ui: {
    push(s: { element: HTMLElement }) {
      if (top) top.style.display = "none";
      host.append(s.element);
      s.element.style.pointerEvents = "auto";
      stack.push(s.element);
    },
    back() {
      stack.pop()?.remove();
      const t = stack[stack.length - 1];
      if (t) t.style.display = "";
    },
  },
};
const stack: HTMLElement[] = [];
const screen = new CodexScreen(ctx as never, () => {});
ctx.ui.push(screen);
document.body.dataset.ready = "1";
