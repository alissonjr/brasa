import { icon } from "./ds/icons";
import { ROTA, type Commit } from "../run/rota";

/**
 * CAMADA JOGO. Marcadores das SAÍDAS de um andar (spec-exploracao-portas-e-salas, R3, R4 e
 * seção 6). São DOM projetado sobre a cena (como o retículo do lock-on): custo zero de draw call.
 * Cada saída mostra um ícone numa moldura (o anel enche, linear, durante o compromisso de 0,6 s)
 * e, a menos de 6 m, nome e promessa em uma linha. Cor nunca é o único canal: o ícone tem
 * silhueta própria (quadrado, livro, frasco) e o texto aparece sempre que se chega perto.
 */
export interface ExitMarkerDef {
  id: string;
  icon: string; // nome em ds/icons
  color: string; // token CSS (ex.: "var(--gold-300)")
  name: () => string;
  promise: () => string;
  x: number;
  y: number;
  z: number;
}

/** Distância (em m, no plano) a partir da qual o nome e a promessa aparecem. */
const NEAR_M = 6;
const RING_R = 24;
const RING_C = 2 * Math.PI * RING_R;

interface Entry {
  def: ExitMarkerDef;
  root: HTMLDivElement;
  label: HTMLDivElement;
  ring: SVGCircleElement;
}

export class ExitMarkers {
  private entries: Entry[] = [];

  constructor(private readonly parent: HTMLElement) {}

  /** Substitui os marcadores (vazio remove todos). */
  set(defs: ExitMarkerDef[]): void {
    this.clear();
    for (const def of defs) {
      const root = document.createElement("div");
      root.className = "exit-marker";
      root.style.setProperty("--exit-c", def.color);
      const badge = document.createElement("div");
      badge.className = "exit-marker__badge";
      badge.innerHTML =
        icon(def.icon, 24) +
        `<svg class="exit-marker__ring" viewBox="0 0 54 54" aria-hidden="true"><circle class="exit-marker__track" cx="27" cy="27" r="${RING_R}"/><circle class="exit-marker__arc" cx="27" cy="27" r="${RING_R}" stroke-dasharray="${RING_C.toFixed(2)}" stroke-dashoffset="${RING_C.toFixed(2)}"/></svg>`;
      const label = document.createElement("div");
      label.className = "exit-marker__label";
      root.append(badge, label);
      this.parent.appendChild(root);
      this.entries.push({ def, root, label, ring: badge.querySelector(".exit-marker__arc") as SVGCircleElement });
      this.paint(this.entries[this.entries.length - 1]!);
    }
  }

  clear(): void {
    for (const e of this.entries) e.root.remove();
    this.entries = [];
  }

  get active(): boolean {
    return this.entries.length > 0;
  }

  /** Reescreve os textos (troca de idioma). */
  relabel(): void {
    for (const e of this.entries) this.paint(e);
  }

  private paint(e: Entry): void {
    const name = document.createElement("span");
    name.className = "exit-marker__name";
    name.textContent = e.def.name();
    const promise = document.createElement("span");
    promise.className = "exit-marker__promise";
    promise.textContent = e.def.promise();
    e.label.replaceChildren(name, promise);
  }

  /**
   * Chamar a cada quadro. `project` leva um ponto do mundo à tela (null se atrás da câmera);
   * `hero` é a posição no plano; `commit` o compromisso em andamento (anel da saída pisada).
   */
  update(project: (x: number, y: number, z: number) => { x: number; y: number } | null, hero: { x: number; z: number }, commit: Commit): void {
    for (const e of this.entries) {
      const p = project(e.def.x, e.def.y, e.def.z);
      if (!p) {
        e.root.style.display = "none";
        continue;
      }
      e.root.style.display = "";
      // O marcador gruda na borda se a saída sair da tela (indica a direção), longe das barras do HUD.
      e.root.style.left = `${Math.min(window.innerWidth - 40, Math.max(40, p.x))}px`;
      e.root.style.top = `${Math.min(window.innerHeight - 150, Math.max(150, p.y))}px`;
      const near = Math.hypot(hero.x - e.def.x, hero.z - e.def.z) <= NEAR_M;
      e.root.classList.toggle("near", near);
      const prog = commit.id === e.def.id ? Math.min(1, commit.t / ROTA.commitSec) : 0;
      e.ring.style.strokeDashoffset = (RING_C * (1 - prog)).toFixed(2);
      e.root.classList.toggle("committing", prog > 0);
    }
  }
}
