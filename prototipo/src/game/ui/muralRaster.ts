/**
 * CAMADA JOGO. MURAIS (fase R5): rasterização AUTÔNOMA dos painéis. Um SVG carregado por `Image`
 * não enxerga a folha de estilos da página nem as variáveis `var(--...)`, e as gravuras são
 * coloridas só por classes `.gv-*` que apontam para tokens. Por isso aqui o SVG ganha um `<style>`
 * próprio com os tokens (tokens.css) e as classes (illustrations.css) embutidos como texto.
 * Sem Babylon: serve à página de dev e à textura do painel 3D (`muralTexture.ts`).
 * Tokens fixos do tema padrão (alto contraste e escala de UI não valem no mundo 3D).
 */
import tokensCss from "./ds/tokens.css?raw";
import illustrationsCss from "./ds/illustrations.css?raw";

/** Torna o SVG autossuficiente: namespace, tamanho em px e as regras de estilo embutidas. */
export function standaloneSvg(svg: string, width: number, height: number): string {
  const style = `<style><![CDATA[${tokensCss}\n${illustrationsCss}]]></style>`;
  return svg
    .replace("<svg ", `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" `)
    .replace(/(<svg [^>]*>)/, `$1${style}`);
}

/** Desenha o SVG (já autônomo ou não) num canvas `width x height`. Assíncrono: decodifica a imagem. */
export async function rasterizeSvg(svg: string, width = 1024, height = 512): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(new Blob([standaloneSvg(svg, width, height)], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}
