import { el } from "@engine";
import { LANDMARKS, type LandmarkKind } from "../content/map";
import { T, onLanguageChange } from "./strings";

/**
 * CAMADA JOGO. HUD de jogo (overlay sobre o canvas): chip do jogador (nome +
 * pontos, clicável -> Perfil), faixa de objetivo, e BÚSSOLA diegética leve no topo
 * (faixa de cardeais que rola conforme o herói gira + marcadores de direção dos
 * marcos; clicável -> mapa). Sem minimapa (decisão da spec-ui-hud-ux: "nunca
 * minimapa completo, no máximo bússola diegética leve no topo"). Recebe o estado
 * a cada quadro via update().
 */
export interface HudState {
  name: string;
  points: number;
  objective: string;
  x: number;
  z: number;
  yaw: number; // rotação do herói no eixo Y (frente = +Z = norte)
}

const COLORS: Record<LandmarkKind, string> = {
  entrada: "#7c8a98",
  camara: "#9aa6b3",
  brasa: "#ff8a3c",
};

const HALF_FOV = Math.PI / 2; // a bússola mostra ±90° à frente

export class GameHud {
  readonly root: HTMLElement;
  private readonly avatarEl: HTMLElement;
  private readonly nameEl: HTMLElement;
  private readonly pointsEl: HTMLElement;
  private readonly objectiveEl: HTMLElement;
  private readonly canvas: HTMLCanvasElement;
  private readonly c2d: CanvasRenderingContext2D | null;
  private readonly toastLayer: HTMLElement;
  private readonly last = { name: "", points: -1, objective: "" };

  constructor(onOpenProfile: () => void, onOpenMap: () => void) {
    this.avatarEl = el("span", { class: "chip-avatar" });
    this.nameEl = el("span", { class: "chip-name" });
    this.pointsEl = el("span", { class: "chip-points" });
    const chip = el(
      "div",
      { class: "hud-chip", title: T.perfil },
      this.avatarEl,
      el("span", { class: "chip-text" }, this.nameEl, this.pointsEl)
    );
    chip.addEventListener("click", onOpenProfile);

    this.canvas = el("canvas", { class: "compass-canvas", width: "360", height: "34" }) as HTMLCanvasElement;
    this.c2d = this.canvas.getContext("2d");
    const compass = el("div", { class: "compass", title: T.mapa }, this.canvas);
    compass.addEventListener("click", onOpenMap);

    this.objectiveEl = el("span", { class: "hud-obj-text" });
    const objLabel = el("span", { class: "hud-obj-label", text: T.objetivo });
    const objective = el("div", { class: "hud-objective" }, objLabel, this.objectiveEl);

    this.toastLayer = el("div", { class: "hud-toasts" });

    this.root = el("div", { class: "hud-game" }, chip, compass, objective, this.toastLayer);

    // Reage à troca de idioma: atualiza rótulos estáticos e força re-render dinâmico.
    onLanguageChange(() => {
      objLabel.textContent = T.objetivo;
      chip.title = T.perfil;
      compass.title = T.mapa;
      this.last.points = -1;
      this.last.name = "";
    });
  }

  setVisible(v: boolean): void {
    this.root.style.display = v ? "" : "none";
  }

  /** Mostra um toast transitório (ex.: conquista desbloqueada). */
  notify(title: string, subtitle: string): void {
    const toast = el(
      "div",
      { class: "hud-toast" },
      el("span", { class: "toast-label", text: T.conquistaDesbloqueada }),
      el("strong", { class: "toast-title", text: title }),
      el("span", { class: "toast-desc", text: subtitle })
    );
    this.toastLayer.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));
    window.setTimeout(() => {
      toast.classList.remove("show");
      window.setTimeout(() => toast.remove(), 400);
    }, 3600);
  }

  update(s: HudState): void {
    if (s.name !== this.last.name) {
      this.nameEl.textContent = s.name;
      this.avatarEl.textContent = (s.name.trim()[0] ?? "?").toUpperCase();
      this.last.name = s.name;
    }
    if (s.points !== this.last.points) {
      this.pointsEl.textContent = `${s.points} ${T.pontos.toLowerCase()}`;
      this.last.points = s.points;
    }
    if (s.objective !== this.last.objective) {
      this.objectiveEl.textContent = s.objective;
      this.last.objective = s.objective;
    }
    this.drawCompass(s);
  }

  private drawCompass(s: HudState): void {
    const c = this.c2d;
    if (!c) return;
    const W = this.canvas.width;
    const H = this.canvas.height;
    const cx = W / 2;
    const xFor = (rel: number) => cx + (rel / HALF_FOV) * (W / 2);
    c.clearRect(0, 0, W, H);

    // Cardeais (N, L, S, O) - frente = +Z = Norte.
    const cards: Array<[string, number]> = [
      ["N", 0],
      ["L", Math.PI / 2],
      ["S", Math.PI],
      ["O", -Math.PI / 2],
    ];
    c.font = "bold 13px Cinzel, serif";
    c.textAlign = "center";
    c.textBaseline = "middle";
    for (const [label, bearing] of cards) {
      const rel = norm(bearing - s.yaw);
      if (Math.abs(rel) > HALF_FOV) continue;
      c.fillStyle = label === "N" ? "#f6e3b0" : "#c9a86a"; // N destacado
      c.fillText(label, xFor(rel), H / 2 - 2);
    }

    // Marcadores de direção dos marcos (por rumo a partir do jogador).
    for (const lm of LANDMARKS) {
      const bearing = Math.atan2(lm.x - s.x, lm.z - s.z);
      const rel = norm(bearing - s.yaw);
      if (Math.abs(rel) > HALF_FOV) continue;
      const x = xFor(rel);
      c.fillStyle = COLORS[lm.kind];
      c.beginPath();
      c.moveTo(x, H - 3);
      c.lineTo(x - 4, H - 10);
      c.lineTo(x + 4, H - 10);
      c.closePath();
      c.fill();
    }

    // Indicador de direção do olhar (centro), triângulo apontando para baixo.
    c.fillStyle = "#f6e3b0";
    c.beginPath();
    c.moveTo(cx, 9);
    c.lineTo(cx - 5, 1);
    c.lineTo(cx + 5, 1);
    c.closePath();
    c.fill();
  }
}

function norm(a: number): number {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}
