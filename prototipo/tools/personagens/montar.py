"""Monta um personagem Quaternius (CC0) compacto para a web, a partir de uma especificacao JSON.
Uso: blender --background --factory-startup --disable-autoexec --python montar.py -- <spec.json>

Etapas: importa corpo base (UBC) + pecas de roupa (Outfits Fantasy), mantem so cabeca/maos do corpo,
religa tudo ao esqueleto da roupa, PODA os ossos dos dedos (os pesos vao para a mao: 65 -> 23 ossos),
reduz poligonos por peca, unifica materiais (pele, roupa, olhos), junta as malhas POR MATERIAL e
exporta um GLB com JPEG. Nada dos pacotes e executado; so importado como glTF."""
import bpy, bmesh, sys, os, json, re

spec = json.load(open(sys.argv[sys.argv.index("--") + 1]))
bpy.ops.wm.read_factory_settings(use_empty=True)

def importar(p):
    antes = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=p)
    return [o for o in bpy.data.objects if o not in antes]

base = importar(spec["base"])
outfits = [importar(p) for p in spec["outfits"]]
arm = next(o for o in outfits[0] if o.type == "ARMATURE")
arm_base = next(o for o in base if o.type == "ARMATURE")

def casa(nome, pads):
    return any(re.search(p, nome) for p in pads)

# --- corpo base: so cabeca/pescoco e maos; olhos mantidos; sobrancelhas fora
MANTER = ("Head", "neck_01", "hand_", "index_", "middle_", "ring_", "pinky_", "thumb_")
for o in list(base):
    if o.type != "MESH": continue
    mname = o.data.materials[0].name if o.data.materials and o.data.materials[0] else ""
    if "Hair" in mname:  # sobrancelhas/cabelo: a capuz cobre; textura pesada
        bpy.data.objects.remove(o, do_unlink=True); continue
    if "Eyes" not in mname:
        bm = bmesh.new(); bm.from_mesh(o.data)
        dl = bm.verts.layers.deform.verify()
        nomes = {g.index: g.name for g in o.vertex_groups}
        rem = []
        for v in bm.verts:
            w = v[dl]
            if not w: rem.append(v); continue
            dom = max(w.items(), key=lambda kv: kv[1])[0]
            if not nomes.get(dom, "").startswith(MANTER): rem.append(v)
        bmesh.ops.delete(bm, geom=rem, context="VERTS")
        bm.to_mesh(o.data); bm.free()
    o.parent = arm
    for m in o.modifiers:
        if m.type == "ARMATURE": m.object = arm
bpy.data.objects.remove(arm_base, do_unlink=True)

# --- "cabelo": a calota da cabeca (acima da linha do cabelo) passa para o material da roupa, com UV
# apontando para um ponto ESCURO do atlas. Da camera alta o couro cabeludo pelado aparecia por cima do capuz.
cab = spec.get("cabelo")
if cab:
    for o in [o for o in bpy.data.objects if o.type == "MESH" and o.data.materials and o.data.materials[0]
              and ("Superhero" in o.data.materials[0].name)]:
        mat = bpy.data.materials.new("MI_Cabelo"); o.data.materials.append(mat)
        idx = len(o.data.materials) - 1
        bm = bmesh.new(); bm.from_mesh(o.data)
        top = max((o.matrix_world @ v.co).z for v in bm.verts)
        uvl = bm.loops.layers.uv.active
        n = 0
        for f in bm.faces:
            if all((o.matrix_world @ v.co).z > top - cab["altura"] for v in f.verts):
                f.material_index = idx; n += 1
                for l in f.loops: l[uvl].uv = (cab["uv"][0], cab["uv"][1])
        bm.to_mesh(o.data); bm.free()
        print("AVISO calota de cabelo:", n, "faces")

# --- pecas de roupa: filtra por nome; reparenta ao esqueleto principal
pecas = []
for objs in outfits:
    for o in objs:
        if o.type == "ARMATURE":
            if o is not arm: bpy.data.objects.remove(o, do_unlink=True)
            continue
        if o.type != "MESH": continue
        if casa(o.name, spec["incluir"]) and not casa(o.name, spec.get("excluir", [])):
            o.parent = arm
            for m in o.modifiers:
                if m.type == "ARMATURE": m.object = arm
            pecas.append(o)
        else:
            bpy.data.objects.remove(o, do_unlink=True)
for o in list(bpy.data.objects):
    # sobram do importador: formas de osso (Icosphere) e vazios
    if o.type not in ("MESH", "ARMATURE") or o.name.startswith("Icosphere"): bpy.data.objects.remove(o, do_unlink=True)

# --- props de silhueta (elmo, crista, escudo): primitivas presas a UM osso (peso 1), material da roupa com a UV
# num ponto claro/metalico do atlas. Fundidas depois na malha da roupa: zero draw calls a mais.
import math
from mathutils import Vector
for pr in spec.get("props", []):
    b = arm.data.bones[pr["osso"]]
    pos = arm.matrix_world @ b.head_local + Vector(pr.get("offset", (0, 0, 0)))
    if pr["tipo"] == "elmo":  # calota (metade de cima de uma esfera), um pouco achatada atras
        bpy.ops.mesh.primitive_uv_sphere_add(segments=14, ring_count=8, radius=pr.get("raio", 0.16), location=pos)
        o = bpy.context.active_object
        bm = bmesh.new(); bm.from_mesh(o.data)
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -0.35 * pr.get("raio", 0.16)], context="VERTS")
        bm.to_mesh(o.data); bm.free()
    elif pr["tipo"] == "crista":  # lamina vertical sobre o elmo (x fino, y comprido, z alto)
        bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
        o = bpy.context.active_object; o.scale = Vector(pr.get("escala", (0.03, 0.22, 0.12)))
    elif pr["tipo"] == "escudo":  # disco grosso, plano de frente (eixo Y do Blender = frente/tras)
        bpy.ops.mesh.primitive_cylinder_add(vertices=14, radius=pr.get("raio", 0.32), depth=0.06, location=pos, rotation=(math.pi / 2, 0, 0))
        o = bpy.context.active_object
    else:
        raise SystemExit("prop desconhecido: " + pr["tipo"])
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    o.name = "prop_" + pr["tipo"]
    o.data.materials.append(bpy.data.materials.new("MI_Prop"))
    uv = o.data.uv_layers.new() if not o.data.uv_layers else o.data.uv_layers[0]
    for l in o.data.loops: uv.data[l.index].uv = (pr["uv"][0], pr["uv"][1])
    o.vertex_groups.new(name=pr["osso"]).add([v.index for v in o.data.vertices], 1.0, "REPLACE")
    o.modifiers.new("Armature", "ARMATURE").object = arm
    o.parent = arm
    print("AVISO prop", pr["tipo"], "em", pr["osso"], [round(c, 3) for c in pos])

# --- poda dos ossos dos dedos: pesos vao para a mao
DEDOS = re.compile(r"^(index|middle|ring|pinky|thumb)_\d\d(_leaf)?_([lr])$|^(index|middle|ring|pinky|thumb)_04_leaf_([lr])$|^ball_leaf_([lr])$")
def alvo(nome):
    m = re.match(r"^(?:index|middle|ring|pinky|thumb)_\d\d(?:_leaf)?_([lr])$", nome) or re.match(r"^(?:index|middle|ring|pinky|thumb)_04_leaf_([lr])$", nome)
    if m: return "hand_" + m.group(1)
    m = re.match(r"^ball_leaf_([lr])$", nome)
    if m: return "ball_" + m.group(1)
    return None
malhas = [o for o in bpy.data.objects if o.type == "MESH"]
for o in malhas:
    vg = o.vertex_groups
    idx2nome = {g.index: g.name for g in vg}
    for v in o.data.vertices:
        acum = {}
        for g in v.groups:
            t = alvo(idx2nome.get(g.group, ""))
            if t: acum[t] = acum.get(t, 0.0) + g.weight
        for t, w in acum.items():
            gt = vg.get(t) or vg.new(name=t)
            gt.add([v.index], w, "ADD")
    for g in list(vg):
        if alvo(g.name): vg.remove(g)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="EDIT")
eb = arm.data.edit_bones
for b in list(eb):
    if alvo(b.name): eb.remove(b)
bpy.ops.object.mode_set(mode="OBJECT")

# --- reducao de poligonos por peca
def reduzir(o, ratio):
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = o
    o.select_set(True)
    m = o.modifiers.new("dec", "DECIMATE"); m.ratio = ratio; m.use_collapse_triangulate = True
    bpy.ops.object.modifier_move_to_index(modifier="dec", index=0)
    bpy.ops.object.modifier_apply(modifier="dec")
for o in [o for o in bpy.data.objects if o.type == "MESH"]:
    for pad, r in spec.get("reduzir", {}).items():
        if re.search(pad, o.name) and r < 1.0:
            reduzir(o, r); break

# --- materiais unificados: pele / roupa / olhos
def imagem_de(mat):
    for n in mat.node_tree.nodes:
        if n.type == "TEX_IMAGE": return n
    return None
def classe(mat):
    n = mat.name
    if "Eyes" in n: return "olhos"
    if "Superhero" in n or "Regular" in n: return "pele"
    return "roupa"
mats = {}
for k, caminho in spec["texturas"].items():
    m = bpy.data.materials.new("mat_" + k)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Roughness"].default_value = 0.85
    bsdf.inputs["Metallic"].default_value = 0.0
    t = nt.nodes.new("ShaderNodeTexImage")
    t.image = bpy.data.images.load(os.path.abspath(caminho))
    t.image.colorspace_settings.name = "sRGB"
    nt.links.new(t.outputs["Color"], bsdf.inputs["Base Color"])
    emi = spec.get("emissao", {}).get(k)
    if emi:  # textura de emissao (olhos espectrais dos mortos): sai como emissiveTexture no glTF
        te = nt.nodes.new("ShaderNodeTexImage")
        te.image = bpy.data.images.load(os.path.abspath(emi))
        nt.links.new(te.outputs["Color"], bsdf.inputs["Emission Color"])
        bsdf.inputs["Emission Strength"].default_value = 1.0
    m.use_backface_culling = (k != "olhos")
    mats[k] = m
for o in [o for o in bpy.data.objects if o.type == "MESH"]:
    for i, slot in enumerate(o.material_slots):
        c = classe(slot.material) if slot.material else "roupa"
        slot.material = mats[c]

# --- so a 1a UV e nenhum atributo de cor (o exportador levava 4-5 TEXCOORD e COLOR por vertice).
# Remove POR NOME, um de cada vez: guardar a lista e remover por referencia deixava ponteiros
# pendentes e o Blender 4.5 apagava o atributo ERRADO (o UVMap do corpo feminino sumia e a
# heroina saia sem TEXCOORD: a roupa rendia como um pixel so do atlas).
def podar_atributos(me):
    while len(me.uv_layers) > 1:
        me.uv_layers.remove(me.uv_layers[len(me.uv_layers) - 1])
    for nome in [c.name for c in me.color_attributes]:
        ca = me.color_attributes.get(nome)
        if ca: me.color_attributes.remove(ca)
    if me.uv_layers: me.uv_layers[0].active_render = True
for o in [o for o in bpy.data.objects if o.type == "MESH"]:
    podar_atributos(o.data)

# --- junta por material (primeiro separa objetos multi-material)
for o in [o for o in bpy.data.objects if o.type == "MESH" and len(o.material_slots) > 1]:
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = o; o.select_set(True)
    bpy.ops.object.mode_set(mode="EDIT")
    bpy.ops.mesh.select_all(action="SELECT")
    bpy.ops.mesh.separate(type="MATERIAL")
    bpy.ops.object.mode_set(mode="OBJECT")
grupos = {}
for o in bpy.data.objects:
    if o.type == "MESH" and o.material_slots: grupos.setdefault(o.material_slots[0].material.name, []).append(o)
for nome, objs in grupos.items():
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1: bpy.ops.object.join()
    objs[0].name = nome.replace("mat_", "")
    objs[0].data.name = objs[0].name

for o in [o for o in bpy.data.objects if o.type == "MESH"]:
    podar_atributos(o.data)
    if not o.data.uv_layers: raise SystemExit("ERRO malha sem UV depois do join: " + o.name)
# --- limites: 4 influencias, normalizadas
for o in bpy.data.objects:
    if o.type != "MESH": continue
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.select_all(action="DESELECT"); o.select_set(True)
    if not o.vertex_groups:  # peca rigida (ex.: olhos): vira 100% do osso da cabeca
        print("AVISO sem pesos:", o.name, "-> Head")
        o.vertex_groups.new(name="Head").add([v.index for v in o.data.vertices], 1.0, "REPLACE")
        if not any(m.type == "ARMATURE" for m in o.modifiers):
            m = o.modifiers.new("Armature", "ARMATURE"); m.object = arm
        o.parent = arm
    bpy.ops.object.vertex_group_limit_total(group_select_mode="ALL", limit=4)
    bpy.ops.object.vertex_group_normalize_all(group_select_mode="ALL", lock_active=False)

bpy.ops.object.select_all(action="SELECT")
os.makedirs(os.path.dirname(os.path.abspath(spec["saida"])), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=spec["saida"], export_format="GLB", export_image_format="JPEG",
                          export_jpeg_quality=spec.get("jpeg", 80), export_animations=False, export_skins=True,
                          export_apply=False, use_selection=False, export_cameras=False, export_lights=False)
tris = sum(len(o.data.polygons) for o in bpy.data.objects if o.type == "MESH")
print("OK", spec["saida"], os.path.getsize(spec["saida"]) // 1024, "KB", "tris~", tris,
      "ossos", len(arm.data.bones), [o.name for o in bpy.data.objects if o.type == "MESH"])
