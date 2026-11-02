"""Gera os GLB de personagens do jogo (direcao B: familia Quaternius, CC0) em public/models/personagens/.
Uso: python3 -I gerar.py <pasta-dos-pacotes-baixados> [alvo ...]   (alvos: heroina mantos mortos anim; default todos)
Pacotes esperados (nao versionados; ver public/models/CREDITS.txt):
  <pasta>/quaternius-universal-base-characters, quaternius-modular-outfits-fantasy, quaternius-ual1, quaternius-ual2
Requer Blender 4.5 (variavel BLENDER ou ~/.local/blender/blender-4.5.9-linux-x64/blender) e Pillow."""
import os, sys, json, subprocess, tempfile, shutil, struct, random
from PIL import Image, ImageChops, ImageEnhance, ImageFilter, ImageOps, ImageDraw
Image.MAX_IMAGE_PIXELS = None

AQUI = os.path.dirname(os.path.abspath(__file__))
SAIDA = os.path.abspath(os.path.join(AQUI, "..", "..", "public", "models", "personagens"))
PACOTES = os.path.abspath(sys.argv[1])
ALVOS = sys.argv[2:] or ["heroina", "mantos", "mortos", "elites", "guardia", "anim"]
BLENDER = os.environ.get("BLENDER") or os.path.expanduser("~/.local/blender/blender-4.5.9-linux-x64/blender")
UBC = os.path.join(PACOTES, "quaternius-universal-base-characters")
OUT = os.path.join(PACOTES, "quaternius-modular-outfits-fantasy")
TMP = tempfile.mkdtemp(prefix="personagens_")

def hexc(h): return tuple(int(h[i:i + 2], 16) for i in (1, 3, 5))

def carregar(caminho, px):
    return Image.open(caminho).convert("RGB").resize((px, px), Image.LANCZOS)

def mascara(im, h0, h1, smin=0.0, vmin=0.0):
    """Mascara suave por faixa de matiz (0..255 do Pillow), saturacao e valor minimos."""
    h, s, v = im.convert("HSV").split()
    mh = h.point(lambda x: 255 if h0 <= x <= h1 else 0)
    ms = s.point(lambda x: 255 if x >= smin * 255 else 0)
    mv = v.point(lambda x: 255 if x >= vmin * 255 else 0)
    m = ImageChops.multiply(ImageChops.multiply(mh, ms), mv)
    return m.filter(ImageFilter.GaussianBlur(1.2))

def rampa(im, escuro, meio, claro, pretos=10, meios=80, brancos=190):
    g = ImageOps.autocontrast(im.convert("L"), cutoff=0) if False else im.convert("L")
    return ImageOps.colorize(g, hexc(escuro), hexc(claro), mid=hexc(meio), blackpoint=pretos, whitepoint=brancos, midpoint=meios)

def tingir(im, pano, couro, metal=None):
    """pano: (escuro, meio, claro) no lugar do VERDE; couro: idem no lugar do MARROM/LARANJA;
    metal (opcional): no lugar das pecas claras e pouco saturadas (fivelas, ombreira)."""
    verde = mascara(im, 38, 125, smin=0.22)
    marrom = mascara(im, 4, 34, smin=0.25)
    marrom = ImageChops.subtract(marrom, verde)
    out = Image.composite(rampa(im, *pano, pretos=8, meios=60, brancos=170), im, verde)
    out = Image.composite(rampa(im, *couro, pretos=20, meios=95, brancos=210), out, marrom)
    if metal:
        h, s, v = im.convert("HSV").split()
        m = ImageChops.multiply(s.point(lambda x: 255 if x < 70 else 0), v.point(lambda x: 255 if x > 120 else 0))
        m = ImageChops.subtract(m, ImageChops.add(verde, marrom)).filter(ImageFilter.GaussianBlur(1.0))
        out = Image.composite(rampa(im, *metal, pretos=100, meios=170, brancos=240), out, m)
    return out

def mascaras_uv(gltf, px):
    """Mascara (L) por PECA do outfit, rasterizada das UVs do glTF (so primitivas do material do outfit).
    Chave = sufixo do nome da malha (Head_Hood, Acc_Pauldrons, Body, Legs...). Permite tingir uma peca
    (capuz, ombreiras) sem depender da cor original do atlas."""
    j = json.load(open(gltf)); binp = os.path.join(os.path.dirname(gltf), j["buffers"][0]["uri"]); b = open(binp, "rb").read()
    def acc(i):
        a = j["accessors"][i]; bv = j["bufferViews"][a["bufferView"]]; off = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
        n = {"VEC2": 2, "VEC3": 3, "SCALAR": 1}[a["type"]]; ct = {5126: "f", 5123: "H", 5125: "I"}[a["componentType"]]
        sz = struct.calcsize(ct) * n; stride = bv.get("byteStride", sz)
        return [struct.unpack_from("<" + ct * n, b, off + k * stride) for k in range(a["count"])]
    out = {}
    for m in j["meshes"]:
        for p in m["primitives"]:
            if "Regular" in j["materials"][p["material"]]["name"]: continue  # pele exposta da peca
            uv = acc(p["attributes"]["TEXCOORD_0"]); idx = [t[0] for t in acc(p["indices"])]
            mk = Image.new("L", (px, px), 0); d = ImageDraw.Draw(mk)
            for t in range(0, len(idx), 3):
                d.polygon([(uv[idx[t + k]][0] * px, uv[idx[t + k]][1] * px) for k in range(3)], fill=255)
            chave = m["name"].split("_", 2)[-1]  # Female_Ranger_Head_Hood -> Head_Hood
            out[chave] = ImageChops.lighter(out[chave], mk) if chave in out else mk
    return out

# Rampa CLARA: o pano do atlas original e escuro (capuz: mediana 57/255), entao os pontos preto/meio/branco
# ficam baixos para a peca sair no terco claro da paleta (o capuz precisa ler do alto, >= 2 passos de valor).
CLARA = (20, 50, 80)

def tingir_pecas(im, masks, pecas, pontos=None, fonte=None):
    """Sobrepoe uma rampa (escuro, meio, claro) nas pecas indicadas (chaves de mascaras_uv).
    pontos: (pretos, meios, brancos) da rampa por peca (default: a rampa padrao 10/85/200).
    fonte: atlas de onde vem a LUMINANCIA da rampa (default: o proprio `im`). Passar o atlas ORIGINAL quando
    `im` ja foi escurecido por tingir(): senao a rampa clara nasce de um pano preto e sai escura."""
    out = im
    src = fonte if fonte is not None else im
    for chave, pal in pecas.items():
        m = masks.get(chave)
        if m is None: print("AVISO peca sem mascara:", chave); continue
        m = m.filter(ImageFilter.MaxFilter(3))  # cobre a borda de amostragem
        pr, me, br = (pontos or {}).get(chave, (10, 85, 200))
        out = Image.composite(rampa(src, *pal, pretos=pr, meios=me, brancos=br), out, m)
    return out

def ponto_claro(im):
    """UV do trecho mais CLARO e pouco saturado do atlas (metal): para pecas geradas (elmo, escudo)."""
    h, s, v = im.convert("HSV").resize((64, 64), Image.BOX).split()
    w, hh = v.size; melhor = None
    for y in range(1, hh - 1):
        for x in range(1, w - 1):
            if s.getpixel((x, y)) > 60: continue
            m = sum(v.getpixel((x + i, y + j)) for i in (-1, 0, 1) for j in (-1, 0, 1)) / 9
            if melhor is None or m > melhor[0]: melhor = (m, x, y)
    _, x, y = melhor
    return [(x + 0.5) / w, 1 - (y + 0.5) / hh]

def fendas(px, mask, corpo=80, n=70, seed=7):
    """Textura de EMISSAO de carvao em brasa: fendas claras (255) sobre um corpo fraco (corpo), so dentro da mascara."""
    random.seed(seed)
    base = Image.new("L", (px, px), 0); d = ImageDraw.Draw(base)
    for _ in range(n):
        x, y = random.uniform(0, px), random.uniform(0, px)
        pts = [(x, y)]
        for _ in range(random.randint(3, 6)):
            x += random.uniform(-px * 0.06, px * 0.06); y += random.uniform(-px * 0.06, px * 0.06); pts.append((x, y))
        d.line(pts, fill=255, width=random.randint(2, 3))
    base = base.filter(ImageFilter.GaussianBlur(0.7))
    fundo = Image.new("L", (px, px), corpo)
    emi = ImageChops.lighter(fundo, base)
    return Image.composite(emi, Image.new("L", (px, px), 0), mask)

def morto(im, cor, sat=0.35, claro=0.85):
    """Pele/roupa de morto: dessatura, escurece e puxa para um tom frio (cinza azulado)."""
    im = ImageEnhance.Color(im).enhance(sat)
    im = ImageEnhance.Brightness(im).enhance(claro)
    return ImageChops.multiply(im, Image.new("RGB", im.size, hexc(cor)))

# paletas do manto da Acendedora (escuro, meio, claro): preto de fuligem com brilho de cada cor escolhida
MANTOS = {
    "brasa": ("#0a0605", "#34170c", "#a64a1c"),
    "cinza": ("#070708", "#2a2928", "#6e6a64"),
    "noite": ("#04060b", "#131e30", "#3a5f8c"),
    "ferro": ("#06080b", "#20262c", "#5f6a76"),
}
# CAPUZ e ombreiras: a cor-assinatura CLARA da Acendedora (le do alto, 2 passos de valor acima das
# lajes). O capuz leva o matiz do manto escolhido, mas sempre claro (ouro de brasa, cinza de osso,
# luar, aco); o corpo do manto continua preto de fuligem.
CAPUZ = {
    "brasa": ("#7a4a18", "#e8c070", "#fff4d0"),
    "cinza": ("#4a4440", "#c9c2b8", "#f4efe6"),
    "noite": ("#34405a", "#a7b8d2", "#e6eef8"),
    "ferro": ("#40464e", "#b2bcc6", "#eaeef2"),
}
BRONZE = ("#120a05", "#7d5122", "#d9a550")  # couro vira bronze
OURO = ("#2a1a0a", "#b98a36", "#ffe3a0")  # fivelas e ombreira viram ouro de brasa
RANGER_F = lambda: mascaras_uv(os.path.join(OUT, "Female_Ranger.gltf"), 1024)
RANGER_M = lambda: mascaras_uv(os.path.join(OUT, "Male_Ranger.gltf"), 512)

def blender(spec, nome):
    p = os.path.join(TMP, nome + ".json")
    json.dump(spec, open(p, "w"))
    r = subprocess.run([BLENDER, "--background", "--factory-startup", "--disable-autoexec", "--python",
                        os.path.join(AQUI, "montar.py"), "--", p], capture_output=True, text=True)
    ok = [l for l in r.stdout.splitlines() if l.startswith(("OK", "AVISO"))]
    print("\n".join(ok) or r.stdout[-2000:] + r.stderr[-2000:])

def ponto_escuro(im):
    """UV (u, v de Blender, v para cima) do trecho 12x12 mais escuro e uniforme do atlas (cor do cabelo)."""
    g = im.convert("L").resize((128, 128), Image.BOX)
    w, h = g.size
    melhor = None
    for y in range(0, h - 2, 2):
        for x in range(0, w - 2, 2):
            px = [g.getpixel((x + i, y + j)) for i in range(2) for j in range(2)]
            m = sum(px) / 4
            if melhor is None or m < melhor[0]: melhor = (m, x + 1, y + 1)
    _, x, y = melhor
    return [x / w, 1 - y / h]

def png(im, nome):
    p = os.path.join(TMP, nome + ".png"); im.save(p); return p

olho = Image.open(os.path.join(UBC, "T_Eye_Brown.png")).convert("RGB")
png(olho, "olho")

def roupa_heroina(ranger, masks, manto):
    """Atlas da roupa da heroina para um manto: pano escuro + bronze/ouro, capuz e ombreiras claros."""
    base = tingir(ranger, MANTOS[manto], BRONZE, OURO)
    return tingir_pecas(base, masks, {"Head_Hood": CAPUZ[manto], "Acc_Pauldrons": OURO}, {"Head_Hood": CLARA, "Acc_Pauldrons": (40, 120, 200)}, fonte=ranger)

def heroina():
    ranger = carregar(os.path.join(OUT, "T_Ranger_BaseColor.png"), 1024)
    pele = carregar(os.path.join(UBC, "T_Superhero_Female_Dark_BaseColor.png"), 512)
    pele = ImageEnhance.Brightness(pele).enhance(0.92)
    roupa_h = roupa_heroina(ranger, RANGER_F(), "brasa")
    blender({
        "base": os.path.join(UBC, "Superhero_Female_FullBody.gltf"),
        "outfits": [os.path.join(OUT, "Female_Ranger.gltf")],
        "incluir": ["Hood", "Body", "Arms", "Legs", "Feet", "Belt", "Pauldron"],
        "reduzir": {"Superhero|SuperHero|Retopology": 0.5, "Feet": 0.18, "Bracer": 0.3, "Pauldron": 0.5, "Hood": 0.7, "Arms$": 0.6, "Body$": 0.6},
        "cabelo": {"altura": 0.085, "uv": ponto_escuro(roupa_h)},
        "texturas": {"pele": png(pele, "h_pele"), "roupa": png(roupa_h, "h_roupa"), "olhos": png(olho, "olho")},
        "saida": os.path.join(SAIDA, "heroina.glb"), "jpeg": 80}, "heroina")

def mantos():
    ranger = carregar(os.path.join(OUT, "T_Ranger_BaseColor.png"), 1024)
    masks = RANGER_F()
    for k in MANTOS:
        if k == "brasa": continue  # ja embutido no heroina.glb
        roupa_heroina(ranger, masks, k).save(os.path.join(SAIDA, "manto_%s.jpg" % k), quality=80)
        print("OK manto_%s.jpg" % k, os.path.getsize(os.path.join(SAIDA, "manto_%s.jpg" % k)) // 1024, "KB")

def olho_morto(pele_cor, iris_a=(30, 150, 175), iris_e=(95, 183, 201), escl=(150, 215, 225)):
    """Textura do remendo de olhos dos mortos: pele cinza-azulada ao redor, globo e iris ciano-espectral.
    Devolve (albedo, emissao): a emissao so acende o globo (o resto preto)."""
    src = Image.open(os.path.join(UBC, "T_Eye_Brown.png")).convert("RGB")
    w, h = src.size
    alb = Image.new("RGB", (w, h), hexc(pele_cor)); emi = Image.new("RGB", (w, h), (0, 0, 0))
    ap, ep, sp = alb.load(), emi.load(), src.load()
    for y in range(h):
        for x in range(w):
            r, g_, b = sp[x, y]
            mx, mn = max(r, g_, b), min(r, g_, b)
            sat = (mx - mn) / (mx + 1)
            iris = mx < 130 and (r - b) > 18 and sat > 0.3          # iris marrom e pupila escura
            esclera = mx > 190 and sat < 0.22                        # branco do olho
            if iris:
                ap[x, y] = iris_a; ep[x, y] = iris_e
            elif esclera:
                ap[x, y] = escl; ep[x, y] = escl
    soft = emi.filter(ImageFilter.GaussianBlur(1.1))
    return alb, soft

def mortos():
    pele_cor = "#8da0a6"
    olho_a, olho_e = olho_morto(pele_cor)
    olho_a.save(os.path.join(TMP, "mo_a.png")); olho_e.save(os.path.join(TMP, "mo_e.png"))
    peasant = carregar(os.path.join(OUT, "T_Peasant_BaseColor.png"), 512)
    ranger = carregar(os.path.join(OUT, "T_Ranger_BaseColor.png"), 512)
    pele_m = morto(carregar(os.path.join(UBC, "T_Superhero_Male_Dark.png"), 256), "#c3d1d3", 0.28, 1.15)
    pele_f = morto(carregar(os.path.join(UBC, "T_Superhero_Female_Dark_BaseColor.png"), 256), "#c3d1d3", 0.28, 1.15)
    aço = ("#1b1f23", "#8794a0", "#dde4ea")
    couro = ("#0f0c09", "#54463a", "#9a846a")

    def variante(nome, base, outfit, incluir, reduzir, roupa, pele):
        blender({
            "base": os.path.join(UBC, base), "outfits": [os.path.join(OUT, outfit)],
            "incluir": incluir, "reduzir": reduzir,
            "cabelo": {"altura": 0.085, "uv": ponto_escuro(roupa)},
            "texturas": {"pele": png(pele, nome + "_pele"), "roupa": png(roupa, nome + "_roupa"), "olhos": png(olho_a, "mo_a")},
            "emissao": {"olhos": png(olho_e, "mo_e")},
            "saida": os.path.join(SAIDA, nome + ".glb"), "jpeg": 78}, nome)

    cabeca = {"Superhero|SuperHero|Retopology": 0.45}
    # minion: aldeao comum, trapos desbotados
    variante("morto_aldeao", "Superhero_Male_FullBody.gltf", "Male_Peasant.gltf", ["Arms", "Body", "Feet", "Legs"],
             {**cabeca, "Arms": 0.3, "Feet": 0.35, "Body": 0.55, "Legs": 0.7}, morto(peasant, "#d3dcde", 0.4, 1.05), pele_m)
    # guerreiro: couraca de ferro velho, sem capuz
    variante("morto_guerreiro", "Superhero_Male_FullBody.gltf", "Male_Ranger.gltf", ["Body", "Arms", "Legs", "Feet", "Belt", "Pauldron"],
             {**cabeca, "Feet": 0.14, "Bracer": 0.25, "Pauldron": 0.45, "Arms$": 0.5, "Body$": 0.55, "Belt": 0.6},
             tingir(ranger, ("#0b0e11", "#3d464f", "#95a3b0"), couro, aço), pele_m)
    # ladino: capuz de trapo verde-azulado escuro
    variante("morto_ladino", "Superhero_Male_FullBody.gltf", "Male_Ranger.gltf", ["Hood", "Body", "Arms", "Legs", "Feet", "Belt"],
             {**cabeca, "Feet": 0.14, "Bracer": 0.25, "Hood": 0.6, "Arms$": 0.5, "Body$": 0.55, "Belt": 0.6},
             tingir(ranger, ("#060d10", "#223a40", "#5f929c"), couro, aço), pele_m)
    # conjurador: vestes frias de camponesa, tom violeta apagado
    variante("morto_conjurador", "Superhero_Female_FullBody.gltf", "Female_Peasant.gltf", ["Arms", "Body", "Feet", "Legs"],
             {**cabeca, "Arms": 0.35, "Feet": 0.35, "Body": 0.6, "Legs": 0.7}, morto(peasant, "#c4c0e0", 0.5, 1.0), pele_f)

def elites():
    """Mortos GRANDES (antigo, sentinela/pesado): mesmo corpo, silhueta por ELMO, CRISTA e ESCUDO gerados
    (fundidos na malha da roupa: zero draw calls a mais), tinta de osso/cinza (nunca tom de pele)."""
    olho_a, olho_e = olho_morto("#8da0a6")
    olho_a.save(os.path.join(TMP, "mo_a.png")); olho_e.save(os.path.join(TMP, "mo_e.png"))
    ranger = carregar(os.path.join(OUT, "T_Ranger_BaseColor.png"), 512)
    pele_m = morto(carregar(os.path.join(UBC, "T_Superhero_Male_Dark.png"), 256), "#c3d1d3", 0.28, 1.15)
    masks = RANGER_M()
    osso = ("#2a2a28", "#9c968a", "#e8e2d4")
    aço = ("#1b1f23", "#8794a0", "#dde4ea")
    couro = ("#0f0c09", "#54463a", "#9a846a")
    cabeca = {"Superhero|SuperHero|Retopology": 0.45}
    red = {**cabeca, "Feet": 0.14, "Bracer": 0.25, "Pauldron": 0.5, "Arms$": 0.5, "Body$": 0.5, "Belt": 0.6, "Legs": 0.8}
    def variante(nome, roupa, props):
        blender({
            "base": os.path.join(UBC, "Superhero_Male_FullBody.gltf"), "outfits": [os.path.join(OUT, "Male_Ranger.gltf")],
            "incluir": ["Body", "Arms", "Legs", "Feet", "Belt", "Pauldron"], "reduzir": red,
            "cabelo": {"altura": 0.085, "uv": ponto_escuro(roupa)}, "props": props,
            "texturas": {"pele": png(pele_m, nome + "_pele"), "roupa": png(roupa, nome + "_roupa"), "olhos": png(olho_a, "mo_a")},
            "emissao": {"olhos": png(olho_e, "mo_e")},
            "saida": os.path.join(SAIDA, nome + ".glb"), "jpeg": 76}, nome)
    # antigo: couraca de osso velho, elmo fechado com crista alta (le de longe)
    r_ant = tingir_pecas(tingir(ranger, ("#0e0f10", "#555650", "#b3ada0"), couro, aço), masks, {"Acc_Pauldron": osso, "Body": osso}, {"Body": CLARA, "Acc_Pauldron": CLARA}, fonte=ranger)
    uv_a = ponto_claro(r_ant)
    variante("morto_antigo", r_ant, [
        {"tipo": "elmo", "osso": "Head", "offset": [0, 0.01, 0.13], "raio": 0.165, "uv": uv_a},
        {"tipo": "crista", "osso": "Head", "offset": [0, 0.0, 0.3], "escala": [0.035, 0.26, 0.16], "uv": uv_a},
    ])
    # sentinela/pesado: aco frio, elmo com crista curta e ESCUDO redondo no antebraco esquerdo (bloqueia)
    r_sen = tingir_pecas(tingir(ranger, ("#0b0e11", "#4a5560", "#aab6c2"), couro, aço), masks, {"Acc_Pauldron": aço, "Body": aço}, {"Body": CLARA, "Acc_Pauldron": CLARA}, fonte=ranger)
    uv_s = ponto_claro(r_sen)
    variante("morto_sentinela", r_sen, [
        {"tipo": "elmo", "osso": "Head", "offset": [0, 0.01, 0.12], "raio": 0.16, "uv": uv_s},
        {"tipo": "crista", "osso": "Head", "offset": [0, -0.02, 0.27], "escala": [0.03, 0.2, 0.1], "uv": uv_s},
        {"tipo": "escudo", "osso": "lowerarm_l", "offset": [0.12, -0.1, 0], "raio": 0.36, "uv": uv_s},
    ])

def guardia():
    """O GUARDIAO = a Primeira Acendedora: mesmo corpo da heroina, manto queimado e capuz, pele de carvao com
    brasa emissiva nas fendas (textura de emissao em cinza: a COR do brilho vem do codigo, que a esfria/esquenta
    com a gangorra de luz e a telegrafia). ~2,2 m no jogo (escala no guardiao.ts)."""
    ranger = carregar(os.path.join(OUT, "T_Ranger_BaseColor.png"), 1024)
    masks = RANGER_F()
    queimado = ("#050303", "#1a100a", "#3d2416")
    couro_q = ("#0a0705", "#2a1f17", "#5a4330")
    ferro_q = ("#1a1512", "#4a3a2e", "#8a6a4a")
    cinza_q = ("#1a1512", "#7a706a", "#cfc6bc")  # capuz: cinza de manto queimado (mais claro: le do alto)
    roupa = tingir(ranger, queimado, couro_q, ferro_q)
    roupa = tingir_pecas(roupa, masks, {"Head_Hood": cinza_q, "Acc_Pauldrons": ferro_q}, {"Head_Hood": CLARA}, fonte=ranger)
    pano = ImageChops.lighter(masks["Head_Hood"], ImageChops.lighter(masks["Body"], masks.get("Legs", masks["Body"])))
    emi_roupa = fendas(1024, pano.filter(ImageFilter.MinFilter(5)), corpo=70, n=90, seed=3)
    pele = carregar(os.path.join(UBC, "T_Superhero_Female_Dark_BaseColor.png"), 512)
    pele = morto(pele, "#3a2e28", 0.12, 0.42)  # carvao
    emi_pele = fendas(512, Image.new("L", (512, 512), 255), corpo=70, n=60, seed=5)
    # olhos: albedo neutro e emissao em cinza (a cor do brilho vem do codigo, como nas fendas)
    olho_a, olho_e = olho_morto("#2e2522", iris_a=(70, 60, 55), iris_e=(235, 235, 235), escl=(190, 190, 190))
    blender({
        "base": os.path.join(UBC, "Superhero_Female_FullBody.gltf"),
        "outfits": [os.path.join(OUT, "Female_Ranger.gltf")],
        "incluir": ["Hood", "Body", "Arms", "Legs", "Feet", "Belt", "Pauldron"],
        "reduzir": {"Superhero|SuperHero|Retopology": 0.5, "Feet": 0.18, "Bracer": 0.3, "Pauldron": 0.5, "Hood": 0.7, "Arms$": 0.6, "Body$": 0.6},
        "cabelo": {"altura": 0.085, "uv": ponto_escuro(roupa)},
        "texturas": {"pele": png(pele, "g_pele"), "roupa": png(roupa, "g_roupa"), "olhos": png(olho_a, "g_olho_a")},
        "emissao": {"pele": png(emi_pele, "g_pele_e"), "roupa": png(emi_roupa, "g_roupa_e"), "olhos": png(olho_e, "g_olho_e")},
        "saida": os.path.join(SAIDA, "guardia.glb"), "jpeg": 80}, "guardia")

def anim():
    CL = ("Idle_Loop,Walk_Loop,Jog_Fwd_Loop,Sprint_Loop,Sword_Idle,Sword_Regular_A,Sword_Regular_B,Melee_Hook,"
          "Sword_Block,Roll,Hit_Chest,Hit_Knockback,Death01,Spell_Simple_Shoot,Spell_Simple_Idle_Loop,Zombie_Idle_Loop,"
          "Zombie_Walk_Fwd_Loop,Zombie_Scratch,Punch_Jab,Punch_Cross,OverhandThrow,LayToIdle")
    bruto = os.path.join(TMP, "anim_bruto.glb")
    subprocess.run([BLENDER, "--background", "--factory-startup", "--disable-autoexec", "--python", os.path.join(AQUI, "anim.py"), "--",
                    os.path.join(PACOTES, "quaternius-ual1", "Unreal-Godot", "UAL1_Standard.glb"),
                    os.path.join(PACOTES, "quaternius-ual2", "Unreal-Godot", "UAL2_Standard.glb"), bruto, CL],
                   capture_output=True, text=True, check=True)
    subprocess.run([sys.executable, "-I", os.path.join(AQUI, "podar_anim.py"), bruto, os.path.join(SAIDA, "anim.glb")], check=True)

os.makedirs(SAIDA, exist_ok=True)
for a in ALVOS: globals()[a]()
shutil.rmtree(TMP, ignore_errors=True)
