"""Gera os GLB de personagens do jogo (direcao B: familia Quaternius, CC0) em public/models/personagens/.
Uso: python3 -I gerar.py <pasta-dos-pacotes-baixados> [alvo ...]   (alvos: heroina mantos mortos anim; default todos)
Pacotes esperados (nao versionados; ver public/models/CREDITS.txt):
  <pasta>/quaternius-universal-base-characters, quaternius-modular-outfits-fantasy, quaternius-ual1, quaternius-ual2
Requer Blender 4.5 (variavel BLENDER ou ~/.local/blender/blender-4.5.9-linux-x64/blender) e Pillow."""
import os, sys, json, subprocess, tempfile, shutil
from PIL import Image, ImageChops, ImageEnhance, ImageFilter, ImageOps
Image.MAX_IMAGE_PIXELS = None

AQUI = os.path.dirname(os.path.abspath(__file__))
SAIDA = os.path.abspath(os.path.join(AQUI, "..", "..", "public", "models", "personagens"))
PACOTES = os.path.abspath(sys.argv[1])
ALVOS = sys.argv[2:] or ["heroina", "mantos", "mortos", "anim"]
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

def morto(im, cor, sat=0.35, claro=0.85):
    """Pele/roupa de morto: dessatura, escurece e puxa para um tom frio (cinza azulado)."""
    im = ImageEnhance.Color(im).enhance(sat)
    im = ImageEnhance.Brightness(im).enhance(claro)
    return ImageChops.multiply(im, Image.new("RGB", im.size, hexc(cor)))

# paletas do manto da Acendedora (escuro, meio, claro): preto de fuligem com brilho de cada cor escolhida
MANTOS = {
    "brasa": ("#050303", "#25100a", "#8a3a16"),
    "cinza": ("#070708", "#2a2928", "#6e6a64"),
    "noite": ("#04060b", "#131e30", "#3a5f8c"),
    "ferro": ("#06080b", "#20262c", "#5f6a76"),
}
BRONZE = ("#120a05", "#7d5122", "#d9a550")  # couro vira bronze
OURO = ("#2a1a0a", "#b98a36", "#ffe3a0")  # fivelas e ombreira viram ouro de brasa

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

def heroina():
    ranger = carregar(os.path.join(OUT, "T_Ranger_BaseColor.png"), 1024)
    pele = carregar(os.path.join(UBC, "T_Superhero_Female_Dark_BaseColor.png"), 512)
    pele = ImageEnhance.Brightness(pele).enhance(0.92)
    roupa_h = tingir(ranger, MANTOS["brasa"], BRONZE, OURO)
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
    for k, pano in MANTOS.items():
        if k == "brasa": continue  # ja embutido no heroina.glb
        tingir(ranger, pano, BRONZE, OURO).save(os.path.join(SAIDA, "manto_%s.jpg" % k), quality=80)
        print("OK manto_%s.jpg" % k, os.path.getsize(os.path.join(SAIDA, "manto_%s.jpg" % k)) // 1024, "KB")

def olho_morto(pele_cor):
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
                ap[x, y] = (30, 150, 175); ep[x, y] = (95, 183, 201)
            elif esclera:
                ap[x, y] = (150, 215, 225); ep[x, y] = (150, 215, 225)
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
