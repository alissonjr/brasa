#!/usr/bin/env python3
"""
Gera as variantes recoloridas do MANTO da Acendedora a partir do atlas base do KayKit
Rogue_Hooded. O modelo em jogo (public/models/Rogue_Hooded.glb) usa UM atlas de paleta
embutido (rogue_texture, PNG), onde o manto amostra os swatches VERDE/TEAL. Recolorir =
hue-shift SÓ dos pixels verdes (preserva a sombra dos gradientes); pele/couro/metal ficam.

Saída: public/models/rogue_<id>.png (brasa/cinza/noite/ferro), trocados em runtime pelo
HeroModel.applyMantle (albedoTexture) conforme a escolha da criação. Não precisa de Blender:
é recolor 2D de atlas plano (Blender só agregaria valor em mesh/bake, que aqui não há).

Uso: python3 tools/recolor_mantos.py   (rodar da raiz do prototipo; precisa de Pillow)
"""
import struct, json, os, colorsys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GLB = os.path.join(ROOT, "public/models/Rogue_Hooded.glb")
OUTDIR = os.path.join(ROOT, "public/models")

# id do manto -> matiz alvo (graus) + tratamento de saturacao.
#   ("mul", k): multiplica a saturacao original (cores vivas: brasa/noite)
#   ("set", k): fixa a saturacao baixa (quase-neutros: cinza/ferro)
TARGETS = {
    "brasa": dict(hue=22,  sat=("mul", 1.05)),  # Brasa alaranjada (laranja-brasa)
    "noite": dict(hue=213, sat=("mul", 1.00)),  # Azul do poco (azul royal)
    "cinza": dict(hue=28,  sat=("set", 0.10)),  # Cinza de fogueira (neutro levemente quente)
    "ferro": dict(hue=210, sat=("set", 0.14)),  # Ferro frio (aco levemente azul)
}


def extract_atlas(glb_path):
    with open(glb_path, "rb") as f:
        data = f.read()
    off = 12  # header
    clen, _ = struct.unpack("<I4s", data[off:off + 8]); off += 8
    js = json.loads(data[off:off + clen]); off += clen
    _, _ = struct.unpack("<I4s", data[off:off + 8]); off += 8  # BIN chunk header
    bin_start = off
    img = js["images"][0]
    bv = js["bufferViews"][img["bufferView"]]
    bo = bv.get("byteOffset", 0)
    raw = data[bin_start + bo: bin_start + bo + bv["byteLength"]]
    import io
    return Image.open(io.BytesIO(raw)).convert("RGBA")


def is_robe_green(r, g, b):
    """True para os swatches verde/teal do manto (matiz verde, G dominante)."""
    if max(r, g, b) == 0:
        return False
    h, s, _ = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    return (60 <= h * 360 <= 185) and s > 0.18 and g >= b * 0.8


def recolor(src, cfg):
    out = Image.new("RGBA", src.size)
    sp, op = src.load(), out.load()
    W, H = src.size
    th = cfg["hue"] / 360.0
    smode, sval = cfg["sat"]
    for y in range(H):
        for x in range(W):
            r, g, b, a = sp[x, y]
            if is_robe_green(r, g, b):
                _, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
                ns = min(1.0, s * sval) if smode == "mul" else sval
                nr, ng, nb = colorsys.hsv_to_rgb(th, ns, v)
                op[x, y] = (int(nr * 255), int(ng * 255), int(nb * 255), a)
            else:
                op[x, y] = (r, g, b, a)
    return out


def main():
    atlas = extract_atlas(GLB)
    for tid, cfg in TARGETS.items():
        fn = os.path.join(OUTDIR, f"rogue_{tid}.png")
        recolor(atlas, cfg).save(fn)
        print("wrote", fn)


if __name__ == "__main__":
    main()
