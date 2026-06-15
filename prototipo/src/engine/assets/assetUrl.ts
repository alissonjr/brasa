/**
 * CAMADA ENGINE. Resolve um caminho de asset para uma URL que respeita ONDE a
 * pagina esta publicada.
 *
 * Os caminhos no codigo sao escritos com "/" inicial (ex.: "/models/Mage.glb"),
 * que aponta para a RAIZ do dominio. Isso funciona em dev (servido na raiz), mas
 * quebra quando o jogo e publicado numa SUBPASTA (ex.: GitHub Pages em
 * https://usuario.github.io/brasa/play/): "/models/..." viraria
 * "https://usuario.github.io/models/..." -> 404.
 *
 * Resolvendo contra document.baseURI (a URL real do index.html), o caminho passa
 * a ser relativo ao deploy: funciona na raiz E em qualquer subpasta, sem depender
 * de configuracao de build. Os assets de public/ ficam sempre ao lado do index.html.
 */
export function assetUrl(path: string): string {
  // Ja e uma URL absoluta (http(s)/blob/data)? Devolve como esta.
  if (/^[a-z]+:/i.test(path)) return path;
  return new URL(path.replace(/^\/+/, ""), document.baseURI).href;
}
