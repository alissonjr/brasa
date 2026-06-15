"""
Preview de ASSEMBLEIA da Jerico usando os glbs REAIS (muralha.glb em anel + portao.glb
no vao + casa_adobe dentro + palmeira em volta). Espelha a logica que sera portada para
src/game/scenes/jericho.ts. Frame do Blender (Z-up): circulo no plano XY.

Eixos medidos (apos import glTF->Z-up):
  muralha: run = Blender Y (1.0), espessura/glacis = Blender X (0.539, glacis no -X), altura = Z (0.543)
  portao : passagem = Blender Y (1.0), largura = X (0.381), altura = Z (0.553)
  casa   : X(1.0) x Y(0.982) x Z(0.436, baixa)
"""
import bpy, math, random
from mathutils import Vector

random.seed(7)
BASE = "/home/alisson/Documents/game/prototipo/public/models/"

# --- Parametros de assembleia (serao os mesmos no jogo) ---
R = 15.0          # raio ao centro (espessura) dos segmentos
N = 12            # fatias ao redor
GATE_A = -math.pi / 2     # vao voltado a -Y (acampamento)
WALL_H = 5.2
WALL_THK = 3.6
RUN_OVERLAP = 1.12        # run = corda * isto (sobreposicao p/ esconder juntas)
GATE_W = 5.2
GATE_DEPTH = 8.5

NAT = {  # dimensoes nativas (max=1.0) medidas
    "muralha": (0.539, 1.000, 0.543),
    "portao":  (0.381, 1.000, 0.553),
    "casa_adobe":  (1.000, 0.982, 0.436),
    "casa_adobe2": (0.999, 0.883, 0.558),
    "palmeira": (0.578, 0.502, 1.000),
}
# cache de import: importa uma vez, depois duplica
_proto = {}
def proto(name):
    if name in _proto: return _proto[name]
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=BASE + name + ".glb")
    objs = [o for o in bpy.data.objects if o not in before and o.type == 'MESH']
    emp = bpy.data.objects.new("P_" + name, None); bpy.context.collection.objects.link(emp)
    for o in objs:
        if o.parent is None: o.parent = emp
    emp.location = (0, 0, -1000)  # esconde o prototipo longe
    _proto[name] = (emp, objs)
    return _proto[name]

def place(name, x, y, sx, sy, sz, rz, seat=True):
    src_emp, src_objs = proto(name)
    emp = bpy.data.objects.new("I_" + name, None); bpy.context.collection.objects.link(emp)
    for o in src_objs:
        d = o.copy(); d.data = o.data; bpy.context.collection.objects.link(d); d.parent = emp
    emp.scale = (sx, sy, sz); emp.rotation_euler = (0, 0, rz); emp.location = (x, y, 0)
    bpy.context.view_layer.update()
    if seat:
        co = [c.parent.matrix_world @ Vector(cc) for c in emp.children for cc in c.bound_box]
        emp.location = (x, y, -min(c.z for c in co))
    return emp

# --- Muralha em anel + portao no vao ---
chord = 2 * R * math.sin(math.pi / N)
run = chord * RUN_OVERLAP
# escala nao-uniforme p/ desacoplar altura/espessura/comprimento
mx = WALL_THK / NAT["muralha"][0]
my = run / NAT["muralha"][1]
mz = WALL_H / NAT["muralha"][2]
# slot do portao = o mais proximo de GATE_A
gate_slot = round(((GATE_A) % (2 * math.pi)) / (2 * math.pi / N)) % N
for i in range(N):
    a = i * (2 * math.pi / N)
    x = R * math.cos(a); y = R * math.sin(a)
    if i == gate_slot:
        # portao: passagem (Blender Y) radial; rz = a - pi/2
        gx = R * math.cos(GATE_A); gy = R * math.sin(GATE_A)
        place("portao", gx, gy,
              GATE_W / NAT["portao"][0], GATE_DEPTH / NAT["portao"][1], WALL_H / NAT["portao"][2],
              GATE_A - math.pi / 2)
        continue
    # muralha: run (Blender Y) tangencial + glacis (-X) p/ fora -> rz = a + pi
    place("muralha", x, y, mx, my, mz, a + math.pi)

# --- Casas de adobe densas dentro (menores e espacadas: ruas estreitas, sem amontoar) ---
blocks = [(4, 3), (-4, 4), (5, -3), (-5, -4), (-7, 1), (7, 1.5), (1, 7), (1, -7), (-2.5, 8), (8, -2.5)]
placed = []
for bx, by in blocks:
    for k in range(1 + random.randrange(2)):
        ox = bx + (random.random() - .5) * 3.2; oy = by + (random.random() - .5) * 3.2
        d = math.hypot(ox, oy)
        if d > 10.5 or d < 2.6: continue
        fw = 3.2 + random.random() * 1.4
        if any(math.hypot(px-ox, py-oy) < pr + fw/2 + 0.6 for px, py, pr in placed): continue
        name = "casa_adobe" if random.random() < .55 else "casa_adobe2"
        s = fw / NAT[name][0]
        place(name, ox, oy, s, s, s, random.random() * math.pi)
        placed.append((ox, oy, fw/2))

# --- Palmeiras em volta (oasis) ---
for i in range(14):
    a = i / 14 * 2 * math.pi + .25
    if abs(((a - GATE_A + math.pi) % (2 * math.pi)) - math.pi) < .35: continue
    r = R + 8 + (i % 3) * 1.5
    s = (6 + (i % 2) * 1.5) / NAT["palmeira"][2]
    place("palmeira", r * math.cos(a), r * math.sin(a), s, s, s, a * 1.7)

# --- Tell + chao ---
bpy.ops.mesh.primitive_cone_add(radius1=R + 13, radius2=R + 4, depth=4, location=(0, 0, -2), vertices=48)
m = bpy.data.materials.new("tell"); m.use_nodes = True
m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.62, 0.45, 0.28, 1)
bpy.context.active_object.data.materials.append(m)
bpy.ops.mesh.primitive_plane_add(size=120, location=(0, 0, -4))
g = bpy.data.materials.new("g"); g.use_nodes = True
g.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.66, 0.58, 0.42, 1)
bpy.context.active_object.data.materials.append(g)

# Josue (escala) ao pe do portao
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, -(R + 6), 0.9)); bpy.context.active_object.scale = (0.5, 0.4, 1.8)

sd = bpy.data.lights.new("S", 'SUN'); sd.energy = 3.2; su = bpy.data.objects.new("S", sd)
bpy.context.collection.objects.link(su); su.rotation_euler = (0.8, 0.2, 0.6)
w = bpy.data.worlds.new("W"); w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.55, 0.7, 0.92, 1)
w.node_tree.nodes["Background"].inputs[1].default_value = 0.9; bpy.context.scene.world = w
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 18
sc.render.resolution_x = 1280; sc.render.resolution_y = 760

def shot(loc, tgt, path):
    for c in [o for o in bpy.data.objects if o.type == 'CAMERA']: bpy.data.objects.remove(c, do_unlink=True)
    cd = bpy.data.cameras.new("C"); cam = bpy.data.objects.new("C", cd); bpy.context.collection.objects.link(cam)
    cam.location = Vector(loc); cam.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    sc.camera = cam; sc.render.filepath = path; bpy.ops.render.render(write_still=True)

shot((-34, -52, 26), (0, -3, 5), "/tmp/jerico_asm.png")     # aproximacao 3/4 do portao
shot((0.1, 0, 70), (0, 0, 0), "/tmp/jerico_asm_top.png")    # planta
print("ASM_DONE")
