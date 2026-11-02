"""Pos-processa o GLB de animacao: tira canais de dedos, escala e translacao (menos root/pelvis) e recompacta o binario.
Uso: python3 -I podar_anim.py <entrada.glb> <saida.glb>
(O exportador do Blender em modo NLA amostra todos os ossos; aqui descartamos o que o jogo nao usa.)"""
import struct, json, sys, re

ent, saida = sys.argv[1:3]
d = open(ent, "rb").read()
jl = struct.unpack("<I", d[12:16])[0]
j = json.loads(d[20:20 + jl])
bl = struct.unpack("<I", d[20 + jl:24 + jl])[0]
binb = d[28 + jl:28 + jl + bl]

DEDOS = re.compile(r"(index|middle|ring|pinky|thumb)_\d\d|_leaf")
nomes = [n.get("name", "") for n in j["nodes"]]

def manter(c):
    nome = nomes[c["target"]["node"]]
    p = c["target"]["path"]
    if DEDOS.search(nome) or p == "scale": return False
    if p == "translation" and nome not in ("root", "pelvis"): return False
    return True

usados = {}
for a in j["animations"]:
    a["channels"] = [c for c in a["channels"] if manter(c)]
    ids = sorted({c["sampler"] for c in a["channels"]})
    remap = {old: new for new, old in enumerate(ids)}
    a["samplers"] = [a["samplers"][i] for i in ids]
    for c in a["channels"]: c["sampler"] = remap[c["sampler"]]
    for s in a["samplers"]:
        for k in ("input", "output"): usados.setdefault(s[k], None)

novo_bin = bytearray()
novos_acc = []
mapa = {}
for old in sorted(usados):
    acc = dict(j["accessors"][old])
    bv = j["bufferViews"][acc["bufferView"]]
    ini = bv.get("byteOffset", 0) + acc.get("byteOffset", 0)
    comp = {5126: 4, 5123: 2, 5121: 1}[acc["componentType"]]
    n = {"SCALAR": 1, "VEC3": 3, "VEC4": 4}[acc["type"]]
    tam = acc["count"] * comp * n
    while len(novo_bin) % 4: novo_bin.append(0)
    off = len(novo_bin)
    novo_bin += binb[ini:ini + tam]
    acc["bufferView"] = len(novos_acc)
    acc.pop("byteOffset", None)
    mapa[old] = len(novos_acc)
    novos_acc.append((acc, off, tam))
j["accessors"] = [a for a, _, _ in novos_acc]
j["bufferViews"] = [{"buffer": 0, "byteOffset": o, "byteLength": t} for _, o, t in novos_acc]
j["buffers"] = [{"byteLength": len(novo_bin)}]
for a in j["animations"]:
    for s in a["samplers"]:
        s["input"] = mapa[s["input"]]; s["output"] = mapa[s["output"]]
for k in ("meshes", "skins", "materials", "images", "textures", "samplers"): j.pop(k, None)
for n in j["nodes"]: n.pop("mesh", None); n.pop("skin", None)
js = json.dumps(j, separators=(",", ":")).encode()
while len(js) % 4: js += b" "
while len(novo_bin) % 4: novo_bin.append(0)
out = bytearray(b"glTF") + struct.pack("<II", 2, 12 + 8 + len(js) + 8 + len(novo_bin))
out += struct.pack("<I", len(js)) + b"JSON" + js + struct.pack("<I", len(novo_bin)) + b"BIN\x00" + novo_bin
open(saida, "wb").write(out)
print("OK", saida, len(out) // 1024, "KB", sum(len(a["channels"]) for a in j["animations"]), "canais")
