import "./ds/armario.css";
import { el } from "@engine";
import { icon } from "./ds/icons";
import { frasco } from "./ds/frascos";
import { T, F, onLanguageChange } from "./strings";
import { uiClick, uiHover } from "./uiSound";
import { POTIONS } from "../combat/tuning";
import { POCAO_DEF, POCOES, type Frasco, type Motivo, type Pocao, type Pocoes } from "../run/pocoes";

/**
 * CAMADA JOGO. O ARMÁRIO DA ORDEM (painel da antessala): três colunas, CINTO (o que bebe),
 * NICHOS deste andar e RESERVA da ordem. Moldura, botões, chips e teclas do design system
 * (`ds-frame`, `ds-btn`, `ds-chip`, `ds-kbd`); mesma linguagem do `boonShop.ts`.
 * Docs: redesenho-da-descida.md 4.2, mocks/redesenho/antessala.html, img/redesenho/armario-ui.png.
 *
 * O painel só ESCREVE no modelo puro (`Pocoes`); quem abre liga Fagulhas, HUD e save pelos ganchos.
 * Abrir: `interact` (R ou Enter) perto do armário; E é o golpe de fogo e NÃO serve. Enquanto aberto o
 * painel engole as teclas PRESSIONADAS (o jogo não bebe com 1/2/3 nem abre o menu com Esc), mas deixa
 * passar as SOLTAS (senão R ou W ficariam presas no InputState). Quem abre pausa a simulação
 * (`gameActive = false`), como no relicário.
 *
 * Teclado: setas movem (esquerda/direita pela ordem, cima/baixo entre colunas), Home/End,
 * 1 a 3 escolhem o cinto, Enter ou Espaço fazem a ação principal, Tab chega aos botões, Esc fecha.
 * Mouse e toque: clicar escolhe; clicar no que já está escolhido (ou duplo clique) faz a ação.
 */
export interface ArmarioHooks {
  pocoes: Pocoes;
  /** Antessala em que o armário está (0 a 6). */
  andar: number;
  fagulhas(): number;
  /** Debita Fagulhas (a UI já checou o saldo). */
  gastarFagulhas(n: number): void;
  /** Algo mudou (evento `armario:change`): atualizar HUD de poções, Fagulhas e gravar. */
  onChange?(): void;
  /** Som de "não" (denyBlip) quando uma ação é negada. */
  deny?(): void;
}
export interface ArmarioHandle {
  closed: Promise<void>;
  close(): void;
}

type Sec = "cinto" | "nicho" | "reserva";
interface Sel {
  sec: Sec;
  i: number;
}
interface Acao {
  id: string;
  label: string;
  primary?: boolean;
  /** Texto curto do motivo quando a ação não pode ser feita; null = pode. */
  why: string | null;
  run(): void;
}

const RESERVA_TIPOS: readonly Pocao[] = ["vida", "furia"];

const nome = (t: Pocao): string => (t === "vida" ? T.potRecuperacao : t === "furia" ? T.potFuria : T.potUnguento);
const desc = (t: Pocao): string =>
  t === "vida"
    ? F("armDescVida", { p: Math.round(POTIONS.vida.healFrac * 100) })
    : t === "furia"
      ? F("armDescFuria", { p: Math.round(POTIONS.furia.dmgBonus * 100), s: POTIONS.furia.durationSec })
      : T.armDescUnguento;
const motivo = (m: Motivo): string => {
  switch (m) {
    case "cinto-cheio":
      return T.armCintoCheio;
    case "sem-nicho":
      return T.armSemNicho;
    case "sem-fagulha":
      return T.armSemFagulha;
    case "sem-estoque":
      return T.armEsgotado;
    case "cinto-vazio":
      return T.armCintoVazio;
    case "nicho-vazio":
      return T.armVazio;
    default:
      return T.armNenhum;
  }
};
const origemLonga = (f: Frasco): string => (f.origem === "marta" ? T.armOrigemMarta : f.origem === "legado" ? T.armOrigemLegado : T.armOrigemSeu);
const origemCurta = (f: Frasco): string => (f.origem === "marta" ? T.armChipMarta : f.origem === "legado" ? T.armChipLegado : T.armChipSeu);

export function openArmario(h: ArmarioHooks): ArmarioHandle {
  const p = h.pocoes;
  const andar = h.andar;
  const previo = document.activeElement as HTMLElement | null;

  let sel: Sel = { sec: "cinto", i: 0 };
  const firstFilled = p.nichos[andar]?.findIndex((n) => n !== null) ?? -1;
  if (firstFilled >= 0) sel = { sec: "nicho", i: firstFilled };
  const pops = new Set<string>(); // slots que acabaram de mudar (animação curta)

  // Esqueleto PERSISTENTE: só o conteúdo de cada região é refeito. A região de status (aria-live) fica
  // viva o tempo todo; um leitor de tela só anuncia mudança de texto numa região que já existe.
  const headEl = el("header", { class: "arm-head" });
  const bodyEl = el("div", { class: "arm-body menu-body" });
  const infoHost = el("div", { class: "arm-info-host" });
  const actsHost = el("div", { class: "arm-acts-host" });
  const statusEl = el("p", { class: "arm-status", role: "status" });
  const footEl = el("footer", { class: "arm-foot" }, infoHost, actsHost, statusEl, el("p", { class: "arm-dica", id: "arm-dica" }));
  const panel = el("div", { class: "ds-frame arm-panel" }, headEl, bodyEl, footEl);
  const overlay = el("div", { class: "menu-backdrop arm-backdrop", role: "dialog", "aria-modal": "true" }, panel);
  overlay.style.zIndex = "60";

  let off = (): void => {};
  let fechado = false;
  let resolveClosed: () => void = () => {};
  const closed = new Promise<void>((r) => (resolveClosed = r));
  const close = (): void => {
    if (fechado) return;
    fechado = true;
    off();
    overlay.remove();
    if (previo && document.contains(previo)) previo.focus({ preventScroll: true });
    resolveClosed();
  };

  // ------------------------------------------------------------------ ações
  const setStatus = (msg: string, warn: boolean): void => {
    statusEl.classList.toggle("is-warn", warn);
    if (statusEl.textContent === msg && msg) {
      // mesma frase de novo: esvazia antes, para o leitor de tela anunciar outra vez
      statusEl.textContent = "";
      requestAnimationFrame(() => (statusEl.textContent = msg));
    } else statusEl.textContent = msg;
  };
  const feito = (msg: string, ...chaves: string[]): void => {
    setStatus(msg, false);
    for (const c of chaves) pops.add(c);
    uiClick();
    h.onChange?.();
    render();
  };
  const negado = (why: string): void => {
    setStatus(why, true);
    h.deny?.();
    render();
  };

  const acoes = (): Acao[] => {
    const out: Acao[] = [];
    if (sel.sec === "cinto") {
      const t = POCOES[sel.i]!;
      const sem = p.quantos(t) <= 0 ? T.armCintoVazio : p.nichoLivre(andar) < 0 ? T.armSemNicho : null;
      out.push({
        id: "guardar",
        label: T.armGuardar,
        primary: true,
        why: sem,
        run: () => {
          const r = p.guardar(andar, t);
          if (r.ok) feito(F("armFeitoGuardar", { p: nome(t) }), `cinto:${sel.i}`, `nicho:${r.nicho}`);
          else negado(motivo(r.motivo));
        },
      });
      out.push({
        id: "deixar",
        label: T.armDeixar,
        why: sem,
        run: () => {
          const r = p.guardar(andar, t, { deixar: true });
          if (r.ok) feito(F("armFeitoDeixar", { p: nome(t) }), `cinto:${sel.i}`, `nicho:${r.nicho}`);
          else negado(motivo(r.motivo));
        },
      });
    } else if (sel.sec === "nicho") {
      const f = p.nichos[andar]?.[sel.i] ?? null;
      const n = sel.i;
      out.push({
        id: "retirar",
        label: T.armRetirar,
        primary: true,
        why: !f ? T.armVazio : p.cintoCheio(f.tipo) ? T.armCintoCheio : null,
        run: () => {
          const r = p.retirar(andar, n);
          if (r.ok && f) feito(F("armFeitoRetirar", { p: nome(f.tipo) }), `nicho:${n}`, `cinto:${POCOES.indexOf(f.tipo)}`);
          else if (!r.ok) negado(motivo(r.motivo));
        },
      });
      out.push({
        id: "deixar",
        label: f?.deixar ? T.armManter : T.armDeixar,
        why: f ? null : T.armVazio,
        run: () => {
          if (!f) return negado(T.armVazio);
          const on = !f.deixar;
          const r = p.marcarLegado(andar, n, on);
          if (r.ok) feito(F(on ? "armFeitoDeixar" : "armFeitoManter", { p: nome(f.tipo) }), `nicho:${n}`);
          else negado(motivo(r.motivo));
        },
      });
    } else {
      const t = RESERVA_TIPOS[sel.i]!;
      const custo = POCAO_DEF[t].custo ?? 0;
      const why = p.estoque(andar, t) <= 0 ? T.armEsgotado : h.fagulhas() < custo ? T.armSemFagulha : !p.cabe(andar, t) ? (p.cintoCheio(t) ? T.armSemNicho : T.armCintoCheio) : null;
      out.push({
        id: "comprar",
        label: `${T.armComprar} (${custo})`,
        primary: true,
        why,
        run: () => {
          const r = p.comprar(andar, t, h.fagulhas());
          if (!r.ok) return negado(motivo(r.motivo));
          h.gastarFagulhas(r.custo);
          const chaves = [`reserva:${sel.i}`, r.destino === "cinto" ? `cinto:${POCOES.indexOf(t)}` : `nicho:${r.nicho}`];
          feito(F(r.destino === "cinto" ? "armFeitoComprar" : "armFeitoComprarNicho", { p: nome(t), c: r.custo }), ...chaves);
        },
      });
    }
    return out;
  };

  const rodar = (a: Acao | undefined): void => {
    if (!a) return;
    if (a.why) negado(a.why);
    else a.run();
  };

  const escolher = (s: Sel, focar = true): void => {
    sel = s;
    setStatus("", false);
    render();
    if (focar) slotEl(s)?.focus({ preventScroll: true });
  };
  const slotEl = (s: Sel): HTMLElement | null => panel.querySelector<HTMLElement>(`[data-slot="${s.sec}:${s.i}"]`);

  // ----------------------------------------------------------------- slots
  const mkSlot = (sec: Sec, i: number, aria: string, extra: string, children: Array<Node | string>): HTMLButtonElement => {
    const key = `${sec}:${i}`;
    const on = sel.sec === sec && sel.i === i;
    const b = el(
      "button",
      {
        class: `arm-slot ${extra}${on ? " is-sel" : ""}${pops.has(key) ? " is-pop" : ""}`,
        type: "button",
        "data-slot": key,
        "aria-label": aria,
        "aria-pressed": on ? "true" : "false",
        tabindex: on ? "0" : "-1",
      },
      ...children
    );
    b.addEventListener("pointerenter", uiHover);
    b.addEventListener("click", (e) => {
      if (e.detail === 0 || on) {
        // teclado (Enter/Espaço), ou clique no que já está escolhido: ação principal
        if (!on) sel = { sec, i };
        rodar(acoes().find((a) => a.primary));
      } else escolher({ sec, i }, false);
    });
    return b;
  };

  const tag = (t: Pocao): string => `arm-t-${t}`;

  const colCinto = (): HTMLElement => {
    const slots = POCOES.map((t, i) => {
      const n = p.quantos(t);
      const m = POCAO_DEF[t].teto;
      return mkSlot("cinto", i, F("armSlotCinto", { p: nome(t), n, m, k: i + 1 }), `${tag(t)}${n > 0 ? "" : " is-empty"}`, [
        el("span", { class: "ds-kbd arm-slot__key", text: `${i + 1}` }),
        stringToNode(frasco(t, 56)),
        el("span", { class: "arm-slot__n", text: `${n}/${m}` }),
      ]);
    });
    return coluna(T.armCinto, "cinto", el("div", { class: "arm-slots arm-slots--3" }, ...slots));
  };

  const colNichos = (): HTMLElement => {
    const slots = (p.nichos[andar] ?? []).map((f, i) => {
      if (!f) return mkSlot("nicho", i, F("armSlotNichoVazio", { i: i + 1 }), "is-empty", []);
      const kids: Array<Node | string> = [stringToNode(frasco(f.tipo, 56)), el("span", { class: "arm-slot__cap", text: origemCurta(f) })];
      if (f.deixar) kids.push(el("span", { class: "ds-chip ds-chip--ember arm-slot__tag", text: T.armChipDeixar }));
      return mkSlot("nicho", i, F("armSlotNicho", { i: i + 1, p: nome(f.tipo), o: origemLonga(f) }) + (f.deixar ? `, ${T.armInfoDeixar}` : ""), tag(f.tipo), kids);
    });
    return coluna(T.armNichos, "nicho", el("div", { class: "arm-slots arm-slots--4" }, ...slots));
  };

  const colReserva = (): HTMLElement => {
    const slots: HTMLElement[] = RESERVA_TIPOS.map((t, i) => {
      const est = p.estoque(andar, t);
      const custo = POCAO_DEF[t].custo ?? 0;
      const kids: Array<Node | string> = [stringToNode(frasco(t, 56)), el("span", { class: "arm-slot__n arm-slot__n--tl", text: `×${est}` })];
      const preco = el("span", { class: `ds-chip ds-chip--ember arm-slot__price`, text: est > 0 ? `${custo}` : T.armEsgotado });
      if (est > 0) preco.insertAdjacentHTML("afterbegin", icon("spark", 12));
      kids.push(preco);
      return mkSlot("reserva", i, F("armSlotReserva", { p: nome(t), n: est, c: custo }), `${tag(t)}${est > 0 ? "" : " is-off"}`, kids);
    });
    slots.push(el("div", { class: "arm-slot is-empty is-inert", role: "note" }, el("span", { class: "arm-slot__cap arm-slot__cap--c", text: T.armSoBancada })));
    return coluna(T.armReserva, "reserva", el("div", { class: "arm-slots arm-slots--3" }, ...slots));
  };

  const coluna = (titulo: string, cls: string, corpo: HTMLElement): HTMLElement => {
    const id = `arm-h-${cls}`;
    corpo.setAttribute("role", "group");
    corpo.setAttribute("aria-labelledby", id);
    return el("section", { class: `arm-col arm-col--${cls}` }, el("h3", { class: "ds-h3 arm-h", id, text: titulo }), corpo);
  };

  // ------------------------------------------------------------ rodapé
  const infoEl = (): HTMLElement => {
    const box = el("p", { class: "arm-info" });
    let t: Pocao | null = null;
    let extra = "";
    if (sel.sec === "cinto") {
      t = POCOES[sel.i]!;
      extra = F("armInfoCinto", { n: p.quantos(t), m: POCAO_DEF[t].teto, k: sel.i + 1 });
    } else if (sel.sec === "nicho") {
      const f = p.nichos[andar]?.[sel.i] ?? null;
      if (f) {
        t = f.tipo;
        extra = origemLonga(f) + (f.deixar ? `. ${T.armInfoDeixar}` : "");
      } else {
        box.textContent = `${T.armVazio}. ${T.armEscolha}`;
        return box;
      }
    } else {
      t = RESERVA_TIPOS[sel.i]!;
      extra = F("armInfoReserva", { c: POCAO_DEF[t].custo ?? 0, n: p.estoque(andar, t) });
    }
    box.append(el("strong", { text: nome(t) }), ` ${desc(t)} `, el("span", { class: "arm-info__meta", text: extra }));
    const why = acoes().find((a) => a.primary)?.why; // por que a ação principal está apagada, sem precisar tentar
    if (why) box.append(" ", el("span", { class: "arm-info__why", text: `${why}.` }));
    return box;
  };

  const acts = (): HTMLElement => {
    const wrap = el("div", { class: "arm-acts" });
    acoes().forEach((a, idx) => {
      const b = el(
        "button",
        {
          class: `ds-btn ds-btn--sm${a.primary ? " ds-btn--primary" : ""}`,
          type: "button",
          "data-act": String(idx),
          "aria-disabled": a.why ? "true" : undefined,
        },
        el("span", { class: "ds-btn__label", text: a.label })
      );
      b.addEventListener("pointerenter", uiHover);
      b.addEventListener("click", () => rodar(a));
      wrap.append(b);
    });
    return wrap;
  };

  // ----------------------------------------------------------------- render
  const render = (): void => {
    const ativo = document.activeElement as HTMLElement | null;
    const foco = ativo && overlay.contains(ativo) ? (ativo.getAttribute("data-slot") ? `[data-slot="${ativo.getAttribute("data-slot")}"]` : ativo.getAttribute("data-act") ? `[data-act="${ativo.getAttribute("data-act")}"]` : ativo.classList.contains("arm-close") ? ".arm-close" : "") : "";

    const fechar = el("button", { class: "ds-btn ds-btn--ghost ds-btn--icon arm-close", type: "button", "aria-label": `${T.armFechar} (Esc)` });
    fechar.insertAdjacentHTML("beforeend", icon("close", 20));
    fechar.addEventListener("click", () => {
      uiClick();
      close();
    });

    const saldo = el("span", { class: "ds-chip arm-saldo", "aria-label": F("armSub", { n: h.fagulhas() }) });
    saldo.insertAdjacentHTML("beforeend", icon("spark", 14));
    saldo.append(`${h.fagulhas()}`);

    headEl.replaceChildren(el("h2", { class: "menu-title arm-title", id: "arm-titulo", text: T.armTitulo }), saldo, fechar);
    bodyEl.replaceChildren(el("div", { class: "arm-cols" }, colCinto(), colNichos(), colReserva()));
    infoHost.replaceChildren(infoEl());
    actsHost.replaceChildren(acts());
    footEl.querySelector<HTMLElement>("#arm-dica")!.textContent = T.armDica;
    overlay.setAttribute("aria-labelledby", "arm-titulo");
    pops.clear();
    if (foco) panel.querySelector<HTMLElement>(foco)?.focus({ preventScroll: true });
  };

  // ----------------------------------------------------------------- teclado
  const ordem = (): Sel[] => {
    const l: Sel[] = [];
    POCOES.forEach((_, i) => l.push({ sec: "cinto", i }));
    (p.nichos[andar] ?? []).forEach((_, i) => l.push({ sec: "nicho", i }));
    RESERVA_TIPOS.forEach((_, i) => l.push({ sec: "reserva", i }));
    return l;
  };
  const tam: Record<Sec, number> = { cinto: POCOES.length, nicho: p.nichos[andar]?.length ?? 0, reserva: RESERVA_TIPOS.length };
  const secs: Sec[] = ["cinto", "nicho", "reserva"];

  overlay.addEventListener("keydown", (e) => {
    e.stopPropagation(); // o jogo não vê as teclas enquanto o armário está aberto
    if (e.key === "Escape") {
      e.preventDefault();
      uiClick();
      close();
      return;
    }
    if (e.key === "Tab") {
      const f = Array.from(overlay.querySelectorAll<HTMLElement>('button:not([disabled]):not([tabindex="-1"])'));
      if (!f.length) return;
      const i = f.indexOf(document.activeElement as HTMLElement);
      const next = e.shiftKey ? (i <= 0 ? f.length - 1 : i - 1) : i === f.length - 1 ? 0 : i + 1;
      e.preventDefault();
      f[next]!.focus();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^Digit[1-3]$/.test(e.code)) {
      e.preventDefault();
      escolher({ sec: "cinto", i: Number(e.code.slice(5)) - 1 });
      return;
    }
    const noSlot = (e.target as HTMLElement).closest?.(".arm-slot");
    if (!noSlot) return;
    const o = ordem();
    const at = o.findIndex((s) => s.sec === sel.sec && s.i === sel.i);
    let alvo: Sel | undefined;
    if (e.key === "ArrowRight") alvo = o[(at + 1) % o.length];
    else if (e.key === "ArrowLeft") alvo = o[(at - 1 + o.length) % o.length];
    else if (e.key === "Home") alvo = o[0];
    else if (e.key === "End") alvo = o[o.length - 1];
    else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      const k = secs.indexOf(sel.sec) + (e.key === "ArrowDown" ? 1 : -1);
      const sec = secs[(k + secs.length) % secs.length]!;
      alvo = { sec, i: Math.min(sel.i, tam[sec] - 1) };
    }
    if (alvo) {
      e.preventDefault();
      escolher(alvo);
    }
  });
  overlay.addEventListener("pointerdown", (e) => {
    if (e.target === overlay) close(); // clique fora do painel
  });

  document.exitPointerLock?.(); // libera o mouse para clicar
  render();
  off = onLanguageChange(render);
  document.body.appendChild(overlay);
  slotEl(sel)?.focus({ preventScroll: true });
  return { closed, close };
}

function stringToNode(svg: string): HTMLElement {
  const s = el("span", { class: "arm-slot__frasco" });
  s.innerHTML = svg; // SVG estático do design system (sem entrada do usuário)
  return s;
}
