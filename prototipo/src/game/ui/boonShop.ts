import { el } from "@engine";
import { icon } from "./ds/icons";
import { T, F, onLanguageChange } from "./strings";
import { uiClick, uiHover } from "./uiSound";
import type { Chama } from "../run/rota";

/**
 * CAMADA JOGO. O PAINEL DO BRASEIRO (redesenho da descida, 2.4 e 6.2): abre ao fim do gesto de acender o
 * braseiro da antessala e entrega a UMA chama do andar. A chama alimenta uma coisa só: uma dádiva da Brasa
 * (paga em Fagulhas), a vela da Estante ou os pavios da Bancada (só onde a antessala tem o ofício). Sem a
 * chama (já gasta), o painel só MOSTRA o que cada opção faria e onde a chama foi gasta. A Lasca de Brasa
 * é grátis e não pede chama (nunca travar). As poções saíram daqui: moram no armário da ordem.
 * Moldura e linhas do design system (`.ds-frame`, `.ds-row`, `.ds-offer`), sem estilo solto. A tela é
 * anexada ao body (a UI de menus está vazia durante a descida) e a promessa resolve ao fechar.
 */
export interface ShopBoon {
  id: string;
  cost: number;
  name: string;
  desc: string;
}
export interface ShopHooks {
  /** Estado vivo (muda ao gastar): saldo de Fagulhas, onde a chama está e o que a antessala oferece. */
  fagulhas(): number;
  estado(): { chama: Chama; estante: boolean; bancada: boolean; lascaGasta: boolean };
  /** Rótulos resolvidos no idioma de agora (a tela se refaz ao trocar de idioma). */
  labels(): { boons: ShopBoon[]; lasca: ShopBoon };
  /** Compra a dádiva `id` com a chama (o `main` gasta Fagulhas, aplica e queima a chama). Devolve se deu certo. */
  buyBoon(id: string): boolean;
  /** Pega a Lasca grátis (não usa a chama). */
  takeLasca(): void;
  /** Queima a chama na Estante ou na Bancada. Devolve se deu certo. */
  gastarChama(em: "estante" | "bancada"): boolean;
}

const price = (cost: number, short: boolean): string =>
  `<span class="ds-chip${short ? " ds-chip--blood" : ""} ds-offer__price">${icon("spark", 14)}${cost === 0 ? T.brazGratis : cost}${short ? ` · ${T.brazSemFagulha}` : ""}</span>`;
const chip = (text: string, ic?: string): string => `<span class="ds-chip ds-offer__price">${ic ? icon(ic, 14) : ""}${text}</span>`;

function row(ic: string, name: string, desc: string, chipHtml: string, disabled: boolean, onPick: () => void): HTMLButtonElement {
  const b = el(
    "button",
    { class: "ds-row ds-row--interactive ds-offer", type: "button" },
    el("span", { class: "ds-offer__txt" }, el("strong", { text: name }), el("span", { text: desc }))
  );
  if (ic) b.insertAdjacentHTML("afterbegin", `<span class="ds-offer__ic">${icon(ic, 22)}</span>`);
  b.insertAdjacentHTML("beforeend", chipHtml);
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
    let step: "chama" | "dadiva" = "chama";
    const close = (): void => {
      off();
      document.removeEventListener("keydown", onEsc, true);
      overlay.remove();
      resolve();
    };
    const onEsc = (e: KeyboardEvent): void => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (step === "dadiva") {
        step = "chama";
        render();
      } else close();
    };

    const render = (): void => {
      const lab = h.labels();
      const st = h.estado();
      const have = h.fagulhas();
      const comChama = st.chama === "";
      const body = el("div", { class: "menu-body" });

      if (step === "dadiva" && comChama) {
        body.append(
          el("p", { class: "menu-subtitle", text: T.brazDadiva }),
          el(
            "div",
            { class: "ds-offers" },
            ...lab.boons.map((bn) => {
              const short = have < bn.cost;
              return row("spark", bn.name, bn.desc, price(bn.cost, short), short, () => {
                if (h.buyBoon(bn.id)) close();
              });
            })
          ),
          el("button", { class: "ds-btn", type: "button", text: T.brazVoltar, onclick: () => ((step = "chama"), render()) })
        );
      } else {
        const opcoes: HTMLButtonElement[] = [];
        const marca = (id: Exclude<Chama, "">): string => (st.chama === id ? chip(T.brazGasta, "flame") : chip(T.brazSemChama));
        const quando = (id: Exclude<Chama, "">): string => (comChama ? "" : marca(id));
        opcoes.push(row("spark", T.brazOpDadiva, T.brazOpDadivaD, quando("dadiva"), !comChama, () => ((step = "dadiva"), render())));
        if (st.estante)
          opcoes.push(row("book", T.brazOpEstante, T.brazOpEstanteD, quando("estante"), !comChama, () => {
            if (h.gastarChama("estante")) close();
          }));
        if (st.bancada)
          opcoes.push(row("flame", T.brazOpBancada, T.brazOpBancadaD, quando("bancada"), !comChama, () => {
            if (h.gastarChama("bancada")) close();
          }));
        const lasca = row("heart", lab.lasca.name, lab.lasca.desc, st.lascaGasta ? chip(T.brazGasta) : price(0, false), st.lascaGasta, () => {
          h.takeLasca();
          render();
        });
        body.append(
          el("p", { class: "menu-subtitle", text: comChama ? T.brazChama : T.brazGastaSub }),
          el("div", { class: "ds-offers" }, ...opcoes),
          el("div", { class: "ds-offers" }, lasca),
          el("button", { class: "ds-btn", type: "button", text: T.brazFechar, onclick: close })
        );
      }
      panel.replaceChildren(el("h2", { class: "menu-title", text: T.brazTitulo }), el("p", { class: "menu-subtitle", text: F("brazSub", { n: have }) }), body);
      overlay.setAttribute("aria-label", T.brazTitulo);
      overlay.querySelector<HTMLElement>("button:not([disabled])")?.focus();
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
    document.addEventListener("keydown", onEsc, true);
    document.body.appendChild(overlay);
    overlay.querySelector<HTMLElement>("button:not([disabled])")?.focus();
  });
}
