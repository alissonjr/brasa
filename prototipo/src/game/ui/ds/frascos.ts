/**
 * CAMADA JOGO. DESIGN SYSTEM: os três FRASCOS do cinto, no mesmo traço dos ícones (`icons.ts`),
 * numa grade 48x48, recortada à silhueta (mais detalhe que os ícones de 24, porque aparecem grandes no armário).
 * O tipo se lê SEM cor: forma do vidro (redondo, alto, pote) e selo de cera dentro (coração,
 * chama, cruz). A cor (`color` do elemento) só reforça: verde-vida, brasa, ouro.
 */
import type { Pocao } from "../../run/pocoes";

const P = (d: string, extra = ""): string => `<path d="${d}"${extra}/>`;
const LIQUIDO = ' fill="currentColor" fill-opacity=".16"';

const FRASCO: Record<Pocao, string> = {
  // redondo: bojo de balão, rolha larga, selo de coração
  vida:
    P("M20 15v3.4a12.6 12.6 0 1 0 8 0V15", LIQUIDO) +
    P("M18 7.5h12M19.5 7.5V15h9V7.5") +
    P("M24 37.4s-5.6-3.3-5.6-7.3a3.1 3.1 0 0 1 5.6-1.9 3.1 3.1 0 0 1 5.6 1.9c0 4-5.6 7.3-5.6 7.3z"),
  // alto: ombros inclinados, gargalo estreito, selo de chama
  furia:
    P("M21.4 14.5 16 20.5V40a3.5 3.5 0 0 0 3.5 3.5h9A3.5 3.5 0 0 0 32 40V20.5l-5.4-6", LIQUIDO) +
    P("M19.5 6h9M21.4 6v8.5M26.6 6v8.5") +
    P("M24 40.5c-3.1 0-4.8-2.1-4.8-4.5 0-2.6 1.9-3.9 2.8-6 1 1 1.6 1.9 1.7 3.2.9-.7 1.5-1.8 1.3-3.2 2.1 1.7 3.8 3.6 3.8 6 0 2.4-1.7 4.5-4.8 4.5z"),
  // pote: boca larga, tampa baixa, selo em cruz
  unguento:
    P("M12.5 19v16.5a4.5 4.5 0 0 0 4.5 4.5h14a4.5 4.5 0 0 0 4.5-4.5V19", LIQUIDO) +
    '<rect x="10" y="12.5" width="28" height="6.5" rx="2"/>' +
    P("M20.2 26.2l7.6 7.6M27.8 26.2l-7.6 7.6"),
};

/** SVG pronto (string estática, sem entrada do usuário); herda a cor do texto. */
export function frasco(tipo: Pocao, size = 48): string {
  return `<svg class="ds-frasco ds-frasco--${tipo}" width="${size}" height="${Math.round((size * 43) / 32)}" viewBox="8 3 32 43" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${FRASCO[tipo]}</svg>`;
}
