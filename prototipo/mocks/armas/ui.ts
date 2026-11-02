import "../../src/game/ui/fonts";
import { ICON_PATHS, icon } from "../../src/game/ui/ds/icons";

/**
 * CAMADA DEV (mock). Interface das armas capturadas: cartão de pegar, comparação, HUD e Crônica.
 * Os ícones das armas abaixo são a PROPOSTA para entrar em ds/icons.ts (grade 24x24, traço 1.6).
 */
const P = (d: string): string => `<path d="${d}"/>`;
Object.assign(ICON_PATHS, {
  // Lança: haste diagonal e ponta em folha.
  "arma-lanca": P("M3.5 21L16 8.5") + P("M15.2 9.3l-2.9-3.2 8.4-3.1-3.1 8.4z"),
  // Adaga: lâmina curta e curva, guarda e cabo.
  "arma-adaga": P("M19.5 4.5c-4.4.4-8 3.2-9.5 7.2l2.3 2.3c4-1.5 6.8-5.1 7.2-9.5z") + P("M8.2 12.6l3.2 3.2M9.6 14.2L5 18.8") + '<circle cx="4.2" cy="19.6" r="1.1"/>',
  // Besta: arco transversal, corda e virote.
  "arma-besta": P("M8 4.5c7 1.2 7 13.8 0 15") + P("M8 4.5v15") + P("M4 12h15.5M16.5 9l3 3-3 3"),
  // Cajado: vara com orbe de brasa no topo.
  "arma-cajado": P("M5.5 21L15 8.5") + '<circle cx="17.2" cy="5.8" r="3"/>' + P("M17.2 3.4v-1.2M19.6 5.8h1.2M14.8 5.8h-1.2"),
  // Clava: cabo e cabeça grossa com tachas.
  "arma-clava": P("M4.5 20l7.3-7.3") + P("M10.3 11.2c-1.4-3.4.6-7.7 6.4-9.2l4.3 4.3c-1.5 5.8-5.8 7.8-9.2 6.4z") + P("M14.5 6.5l1.2 1.2M17 9l1.2 1.2"),
  // Machado: haste e lâmina larga em meia-lua.
  "arma-machado": P("M5.5 20.5L16 7") + P("M12.4 4.3c3.2-2.3 6.8-1.5 8.6 1.4-1.1 3.8-4.4 5.4-7.4 4.6z") + P("M10.8 11.6l-3-.8"),
  // Escudo da sentinela: escudo alto com nervura central.
  "arma-escudo": P("M6.5 3.5h11v8.5c0 4-2.8 6.8-5.5 8.5-2.7-1.7-5.5-4.5-5.5-8.5z") + P("M12 7.5v9M9.2 10.5h5.6"),
  // Lâmina da Primeira: espada de folha com chama no gume.
  "arma-lamina": P("M12 2.5c1.8 2.8 3.6 5 3.6 8.2 0 3-1.7 4.7-3.6 5.6-1.9-.9-3.6-2.6-3.6-5.6 0-3.2 1.8-5.4 3.6-8.2z") + P("M12 16.3V21M8.7 18.8h6.6"),
  "chev-up": P("M6 14l6-6 6 6"),
  "chev-down": P("M6 10l6 6 6-6"),
  "alerta": P("M12 4l9 16H3z") + P("M12 10v4.5M12 17.2h.01"),
  "infinito": P("M7.5 8.5c-2.5 0-4 1.6-4 3.5s1.5 3.5 4 3.5c3.5 0 5-7 9-7 2.5 0 4 1.6 4 3.5s-1.5 3.5-4 3.5c-4 0-5.5-7-9-7z"),
});

type Linha = "lam" | "fog" | "con" | "rel";
interface W {
  id: string; nome: string; origem: string; linha: Linha; linhaNome: string; ico: string;
  alc: number; pes: number; rit: number;
  efeito: string; fio: number; fioMax: number; unidade: string;
  /** Rótulo curto da característica de comportamento (chip). */
  trait: string;
  relato: { titulo: string; lead: string; corpo: string[] };
}
const W: W[] = [
  { id: "lanca", nome: "Lança da Guarda", origem: "Larga o Guarda", linha: "lam", linhaNome: "Lâmina", ico: "arma-lanca", alc: 5, pes: 2, rit: 3, efeito: "Estoca em linha: fura todos à frente.", fio: 16, fioMax: 16, unidade: "golpes", trait: "Linha",
    relato: { titulo: "A lança da Guarda", lead: "Quem vigiava a boca do poço.", corpo: ["A Guarda do poço levava lança porque o frio não se enfrenta de perto: a ponta o mantém à distância de um braço. Os guardas desceram com os seus mortos, para não os deixar sozinhos.", "O cabo tem marcas de quem o apoiou no chão por gerações. Quem a empunha aprende a medida certa: nem perto demais, nem longe."] } },
  { id: "adaga", nome: "Adaga do Rol", origem: "Larga o Ladino", linha: "con", linhaNome: "Contragolpe", ico: "arma-adaga", alc: 1, pes: 1, rit: 5, efeito: "Rápida; pelas costas, o golpe pesa o dobro.", fio: 28, fioMax: 28, unidade: "golpes", trait: "Flanco",
    relato: { titulo: "A adaga do Rol", lead: "Quem riscava os nomes na pedra.", corpo: ["Nas câmaras há paredes inteiras de nomes, e alguém teve de gravá-los. Os do Rol carregavam uma lâmina curta e não faziam outra coisa: cada corte, uma letra de um morto.", "Hoje a lâmina anda no escuro como andava nas paredes: de lado, de costas, sem fazer ruído."] } },
  { id: "besta", nome: "Besta da Guarda", origem: "Larga o Arqueiro", linha: "fog", linhaNome: "Fogo", ico: "arma-besta", alc: 5, pes: 3, rit: 2, efeito: "Dispara virotes retos; fraca de perto.", fio: 10, fioMax: 10, unidade: "virotes", trait: "Distância",
    relato: { titulo: "A besta dos vigias", lead: "Quem guardava o corredor de longe.", corpo: ["Os vigias ficavam onde o corredor se abre, porque dali se vê tudo o que desce. A besta é de quem tem paciência: arma, espera, solta.", "Mesmo mortos, miram com a calma de quem sabe que o corredor só tem uma entrada."] } },
  { id: "cajado", nome: "Cajado de Cinza", origem: "Larga o Conjurador", linha: "fog", linhaNome: "Fogo", ico: "arma-cajado", alc: 4, pes: 2, rit: 2, efeito: "Orbe lento que queima em área.", fio: 6, fioMax: 6, unidade: "cargas", trait: "Área",
    relato: { titulo: "O cajado de cinza", lead: "Quem alimentava o fogo pequeno.", corpo: ["Antes de haver Acendedoras de ofício, havia quem cuidasse dos braseiros com a ponta de uma vara, soprando a cinza até voltar a ser brasa.", "O topo guarda um resto de calor. Quem o empunha sente que ele pede para ser gasto, e não para ser guardado."] } },
  { id: "clava", nome: "Clava do Bruto", origem: "Larga o Brutamonte", linha: "lam", linhaNome: "Lâmina", ico: "arma-clava", alc: 2, pes: 5, rit: 1, efeito: "O golpe pesado esmaga em área e atordoa.", fio: 10, fioMax: 10, unidade: "golpes", trait: "Esmagar",
    relato: { titulo: "A clava dos carregadores", lead: "Quem fechou as câmaras com pedra.", corpo: ["As portas de pedra não se fecharam sozinhas. Os carregadores empurravam as lajes com uma viga, e a viga, ao fim, virou arma de quem não sabia fazer outra coisa que não fosse empurrar.", "É lenta e todos veem o golpe chegar. Mas o que ela alcança, ela quebra."] } },
  { id: "machado", nome: "Machado do Antigo", origem: "Larga o Antigo", linha: "lam", linhaNome: "Lâmina", ico: "arma-machado", alc: 3, pes: 4, rit: 2, efeito: "Arco largo; rompe a guarda dos escudos.", fio: 12, fioMax: 12, unidade: "golpes", trait: "Rompe guarda",
    relato: { titulo: "O machado de quem abriu o poço", lead: "Quem cavou a pedra antes da ordem.", corpo: ["Os mais antigos dos mortos são os que cavaram o poço. O machado é de talhar rocha, não de lutar, e por isso não pede licença a nenhum escudo.", "O fio é grosso e velho, e foi afiado tantas vezes que já quase não lembra a forma original."] } },
  { id: "escudo", nome: "Escudo da Sentinela", origem: "Larga a Sentinela", linha: "con", linhaNome: "Contragolpe", ico: "arma-escudo", alc: 1, pes: 2, rit: 3, efeito: "Bloqueia sem custo; o golpe vira empurrão.", fio: 8, fioMax: 8, unidade: "defesas", trait: "Guarda",
    relato: { titulo: "O escudo da Sentinela", lead: "A que não cedeu a porta.", corpo: ["Cada porta de pedra teve uma sentinela, e a sentinela ficou. O escudo traz o nome dela riscado por dentro, de onde só ela via.", "Ainda segura a porta, mesmo depois de a porta não segurar mais nada."] } },
  { id: "lamina", nome: "Lâmina da Primeira", origem: "Herança do Guardião", linha: "rel", linhaNome: "Relíquia", ico: "arma-lamina", alc: 3, pes: 4, rit: 3, efeito: "Bate mais forte, mas bebe a sua vida.", fio: 0, fioMax: 0, unidade: "vida", trait: "Preço",
    relato: { titulo: "A lâmina de bronze, queimada", lead: "A mesma que Cinza carrega.", corpo: ["É uma espada curta de folha, de bronze, igual à da heroína, só que escurecida por dentro como quem ardeu por muito tempo. A Primeira também começou assim: com uma lâmina pequena e uma fagulha no peito.", "Ela dá o que se pede. E cobra de quem a pede."] } },
];
const ATUAL = { nome: "Espada de Bronze", alc: 3, pes: 3, rit: 3 };

const q = new URLSearchParams(location.search);
if (q.get("movimento") === "reduzido") document.body.classList.add("rm");

function pips(n: number, cur: number | null): string {
  let s = '<span class="ds-pips" role="img" aria-label="' + n + ' de 5">';
  for (let i = 1; i <= 5; i++) s += `<i class="ds-pip ds-pip--c${i <= n ? " lit" : ""}${cur === i ? " cur" : ""}"></i>`;
  return s + "</span>";
}
function delta(n: number, c: number): string {
  const d = n - c;
  if (d === 0) return `<span class="ds-delta eq" title="igual">=</span>`;
  const up = d > 0;
  return `<span class="ds-delta ${up ? "up" : "down"}">${icon(up ? "chev-up" : "chev-down", 12)}${Math.abs(d)}</span>`;
}
function meter(k: string, n: number, cur: number | null): string {
  return `<div class="ds-meter"><span class="ds-meter__k">${k}</span>${pips(n, cur)}${cur === null ? "<span></span>" : delta(n, cur)}</div>`;
}
function fio(w: W, valor: number, low = false): string {
  if (w.id === "lamina") return `<div class="ds-fio"><span class="ds-fio__u">custo</span><span class="ds-fio__n">${icon("heart", 14)} 1,5</span><span class="ds-fio__u">vida por golpe</span></div>`;
  return `<div class="ds-fio${low ? " low" : ""}"><div class="ds-bar"><div class="ds-bar__fill" style="--v:${(valor / w.fioMax) * 100}%"></div></div><span class="ds-fio__n">${valor}</span><span class="ds-fio__u">${w.unidade}</span></div>`;
}
function card(w: W, opts: { comparar?: boolean; mini?: boolean } = {}): string {
  const cmp = opts.comparar ? ATUAL : null;
  if (opts.mini) return `<div class="ds-weapon ds-weapon--mini ${w.linha}"><span class="ds-weapon__ico">${icon(w.ico, 20)}</span><span class="ds-weapon__name">${w.nome}</span></div>`;
  return `<div class="ds-weapon ${w.linha}" role="group" aria-label="${w.nome}">
    <div class="ds-weapon__head"><span class="ds-weapon__ico">${icon(w.ico, 30)}</span>
      <div><div class="ds-weapon__name">${w.nome}</div><div class="ds-weapon__from">${w.origem}</div>
      <div class="ds-weapon__chips"><span class="ds-chip">${w.linhaNome}</span><span class="ds-chip">${w.trait}</span></div></div></div>
    <div class="ds-weapon__meters">${meter("Alcance", w.alc, cmp ? cmp.alc : null)}${meter("Peso", w.pes, cmp ? cmp.pes : null)}${meter("Ritmo", w.rit, cmp ? cmp.rit : null)}</div>
    <p class="ds-weapon__fx">${w.efeito}</p>
    ${fio(w, w.fio)}
    <div class="ds-weapon__foot"><span class="ds-kbd">G</span><small>${cmp ? `Troca: a ${cmp.nome} fica aqui` : "Pegar"}</small></div></div>`;
}
function hud(w: W, valor: number, estado: "cheia" | "meia" | "baixa" | "quebra"): string {
  const low = estado === "baixa";
  return `<div class="hudw ${w.linha}${low ? " low" : ""}${estado === "quebra" ? " break" : ""}"><span class="ico">${icon(low ? "alerta" : w.ico, 22)}</span><span class="nm">${w.nome.split(" ")[0]}</span>${fio(w, valor, low)}</div>`;
}

const app = document.getElementById("app")!;
const bronze: W = { id: "bronze", nome: "Espada de Bronze", origem: "A sua, de sempre", linha: "lam", linhaNome: "Lâmina", ico: "sword", alc: 3, pes: 3, rit: 3, efeito: "", fio: 0, fioMax: 0, unidade: "", trait: "Base", relato: { titulo: "", lead: "", corpo: [] } };
const lanca = W.find((w) => w.id === "lanca")!, clava = W.find((w) => w.id === "clava")!, adaga = W.find((w) => w.id === "adaga")!, escudo = W.find((w) => w.id === "escudo")!, cajado = W.find((w) => w.id === "cajado")!;

app.innerHTML = `
<h1>Armas capturadas: interface</h1>
<p class="lead">Do chão para a mão em quatro passos, sem texto longo: o halo e o ícone chamam de longe, o cartão aparece perto com três medidores, uma linha de efeito e o fio da arma; ao pegar, o HUD mostra o ícone e a barra; a primeira vez de cada arma vira um relato na Crônica. Cor da Linha: ouro (Lâmina), brasa (Fogo), gelo (Contragolpe). Nunca só cor: cada Linha tem também o chip com o nome e cada arma tem a sua silhueta.</p>

<h2>1. Chamar de longe e de perto</h2>
<p class="lead">De 5 m: halo da cor da Linha e uma etiqueta mínima (ícone e nome) projetada sobre a arma. De 2,2 m (o alcance de hoje): o cartão completo. O cartão mostra a arma NOVA sobre a que você já tem: as marcas ocas nos losangos são a arma atual; a seta diz se melhora ou piora.</p>
<div class="stage"><div class="row">
  <div><div class="cap">Longe (etiqueta)</div><div style="display:grid;gap:10px">${card(lanca, { mini: true })}${card(clava, { mini: true })}${card(adaga, { mini: true })}</div></div>
  <div><div class="cap">Perto, sem comparação (mãos vazias)</div>${card(lanca)}</div>
  <div><div class="cap">Perto, comparando com a Espada de Bronze</div>${card(lanca, { comparar: true })}</div>
  <div><div class="cap">Perto, comparando (clava)</div>${card(clava, { comparar: true })}</div>
</div></div>

<h2>2. Todas as armas, no mesmo cartão</h2>
<div class="stage"><div class="row" id="todas"></div></div>

<h2>3. HUD da arma equipada</h2>
<p class="lead">Mesma posição do HUD de hoje (canto superior direito). Ícone da arma, nome curto e barra do fio com número e unidade. Com 25% ou menos: a barra fica vermelha e pulsa, o ícone vira alerta e treme, e toca o som de "fio curto". Ao acabar: a arma racha, vira cinza (efeito por tipo) e uma linha avisa que a Espada de Bronze voltou à mão.</p>
<div class="stage"><div class="row" style="gap:var(--sp-4)">
  <div><div class="cap">Cheia</div>${hud(lanca, 16, "cheia")}</div>
  <div><div class="cap">Metade</div>${hud(clava, 5, "meia")}</div>
  <div><div class="cap">Fio curto (25% ou menos)</div>${hud(adaga, 6, "baixa")}</div>
  <div><div class="cap">Cargas (cajado)</div>${hud(cajado, 3, "meia")}</div>
  <div><div class="cap">Defesas (escudo)</div>${hud(escudo, 2, "baixa")}</div>
  <div><div class="cap">Quebrando (animação)</div>${hud(clava, 0, "quebra")}</div>
</div>
<div style="margin-top:var(--sp-4)"><div class="cap">Aviso ao acabar (some em 2,5 s)</div><span class="toast-arma">${icon("sword", 20)} A clava se desfez. A Espada de Bronze voltou.</span></div></div>

<h2>4. Primeira vez: relato na Crônica</h2>
<p class="lead">Ao pegar uma arma pela primeira vez, abre a página "relatos" daquele nicho e uma linha avisa (o mesmo toast de leitura). Cada relato tem a gravura da arma, um subtítulo de uma linha e dois parágrafos curtos. O estado vai na marca <code>arma:&lt;id&gt;</code> do save, permanente como os outros relatos.</p>
<div class="stage"><div class="row" id="relatos"></div>
  <div style="margin-top:var(--sp-4)"><div class="cap">Toast da primeira vez</div><span class="toast-arma">${icon("scroll", 20)} Crônica: a lança da Guarda</span></div></div>

<h2>5. Legenda de cor, forma e som</h2>
<div class="stage"><table class="tablet" id="legenda"></table></div>
`;

document.getElementById("todas")!.innerHTML = W.map((w) => card(w, { comparar: w.id !== "lamina" })).join("");
document.getElementById("relatos")!.innerHTML = ["lanca", "adaga", "escudo", "lamina"].map((id) => {
  const w = W.find((x) => x.id === id)!;
  return `<div class="nicho ${w.linha}"><div class="art">${icon(w.ico, 84)}</div><div class="ds-label">Relatos</div><h4>${w.relato.titulo}</h4><div class="lead2">${w.relato.lead}</div>${w.relato.corpo.map((p) => `<p>${p}</p>`).join("")}</div>`;
}).join("");
const SOM: Record<string, string> = {
  lanca: "estocada seca, assobio curto de haste", adaga: "tilintar fino e rápido, sem eco", besta: "estalo de corda e silvo do virote",
  cajado: "sopro de brasa e estalo de cinza", clava: "baque grave de madeira e pedra", machado: "arrasto largo de ferro, golpe surdo",
  escudo: "gongo curto de metal sobre metal", lamina: "bronze que range e abafa, brasa fria",
};
document.getElementById("legenda")!.innerHTML = `<tr><th>Arma</th><th>Linha e cor do halo</th><th>Forma (ícone)</th><th>Som ao acertar</th></tr>` +
  W.map((w) => `<tr class="${w.linha}"><td>${w.nome}</td><td><span class="sw ${w.linha}"></span>${w.linhaNome}</td><td style="color:var(--c)">${icon(w.ico, 26)}</td><td>${SOM[w.id]}</td></tr>`).join("");
(window as unknown as { __pronto: boolean }).__pronto = true;
