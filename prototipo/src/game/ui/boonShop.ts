import { el } from "@engine";
import { icon } from "./ds/icons";
import { T, F, onLanguageChange } from "./strings";
import { uiClick, uiHover } from "./uiSound";

/**
 * CAMADA JOGO. O RELICÁRIO: ao colher a estilha e descer, a Acendedora gasta Fagulhas em
 * dádivas e poções. Moldura e linhas do design system (`.ds-frame`, `.ds-row`, `.ds-offer`),
 * sem estilo solto. A tela é anexada ao body (a UI de menus está vazia durante a descida) e
 * devolve uma promessa que resolve quando uma dádiva é escolhida.
 */
export interface ShopBoon {
  id: string;
  cost: number;
  name: string;
  desc: string;
}
export interface ShopPotion {
  id: string;
  name: string;
  cost: number;
  cap: number;
}
export interface ShopHooks {
  /** Estado vivo (muda ao comprar): saldo de Fagulhas e cargas de cada poção. */
  fagulhas(): number;
  have(potionId: string): number;
  /** Rótulos resolvidos no idioma de agora (a tela se refaz ao trocar de idioma). */
  labels(): { boons: ShopBoon[]; potions: ShopPotion[] };
  buyBoon(id: string): boolean;
  buyPotion(id: string): void;
}

const price = (cost: number, short: boolean): string =>
  `<span class="ds-chip${short ? " ds-chip--blood" : ""} ds-offer__price">${icon("spark", 14)}${cost === 0 ? T.brazGratis : cost}${short ? ` · ${T.brazSemFagulha}` : ""}</span>`;

function row(name: string, desc: string, chip: string, disabled: boolean, onPick: () => void): HTMLButtonElement {
  const b = el(
    "button",
    { class: "ds-row ds-row--interactive ds-offer", type: "button" },
    el("span", { class: "ds-offer__txt" }, el("strong", { text: name }), el("span", { text: desc }))
  );
  b.insertAdjacentHTML("beforeend", chip);
  if (disabled) b.disabled = true; // desabilitado de verdade: não recebe foco nem clique
  else {
    b.addEventListener("pointerenter", uiHover);
    b.addEventListener("click", () => {
      uiClick();
      onPick();
    });
  }
  return b;
}

export function openBoonShop(h: ShopHooks): Promise<void> {
  return new Promise((resolve) => {
    const panel = el("div", { class: "ds-frame menu-panel boon-panel" });
    const overlay = el("div", { class: "menu-backdrop", role: "dialog", "aria-modal": "true" }, panel);
    overlay.style.zIndex = "60";
    let off = (): void => {};
    const close = (): void => {
      off();
      overlay.remove();
      resolve();
    };

    const render = (): void => {
      const lab = h.labels();
      const have = h.fagulhas();
      const potionRows = lab.potions.map((p) => {
        const n = h.have(p.id);
        const full = n >= p.cap;
        const short = !full && have < p.cost;
        const chip = full ? `<span class="ds-chip ds-offer__price">${T.brazCheio}</span>` : price(p.cost, short);
        return row(`${p.name}  (x${n}/${p.cap})`, "", chip, full || short, () => {
          h.buyPotion(p.id);
          render();
          panel.querySelector<HTMLElement>(`[data-pick="${p.id}"]`)?.focus();
        });
      });
      lab.potions.forEach((p, i) => potionRows[i]!.setAttribute("data-pick", p.id));
      const boonRows = lab.boons.map((bn) => {
        const short = have < bn.cost;
        return row(bn.name, bn.desc, price(bn.cost, short), short, () => {
          if (h.buyBoon(bn.id)) close();
        });
      });
      const body = el(
        "div",
        { class: "menu-body" },
        el("p", { class: "menu-subtitle", text: T.brazBanca }),
        el("div", { class: "ds-offers" }, ...potionRows),
        el("p", { class: "menu-subtitle", text: T.brazDadiva }),
        el("div", { class: "ds-offers" }, ...boonRows)
      );
      panel.replaceChildren(
        el("h2", { class: "menu-title", text: T.brazTitulo }),
        el("p", { class: "menu-subtitle", text: F("brazSub", { n: have }) }),
        body
      );
      overlay.setAttribute("aria-label", T.brazTitulo);
    };

    // Setas movem o foco entre as ofertas habilitadas (a pilha de menus está vazia aqui).
    overlay.addEventListener("keydown", (e) => {
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const items = Array.from(overlay.querySelectorAll<HTMLButtonElement>("button:not([disabled])"));
      if (!items.length) return;
      e.preventDefault();
      const i = items.indexOf(document.activeElement as HTMLButtonElement);
      const next = (i + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items[next]!.focus();
    });

    render();
    off = onLanguageChange(render);
    document.body.appendChild(overlay);
    overlay.querySelector<HTMLElement>("button:not([disabled])")?.focus();
  });
}
