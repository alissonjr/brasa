"""
Render de CONFERÊNCIA da Jericó procedural (espelha src/game/scenes/jericho.ts).
Reproduz as MESMAS constantes e geometria (cortina tijolo-a-tijolo, glacis, torres,
portão fechado, casa de Raabe + cordão, cidade interna densa, santuario migdal,
props e oasis) para validar composicao/densidade/fidelidade antes do teste no jogo.
Nao exporta nada: so renderiza /tmp/jerico_preview.png e /tmp/jerico_preview_top.png.

Uso:
  BL=/home/alisson/.local/blender/blender-4.5.9-linux-x64/blender
  "$BL" --background --python tools/render_jerico_preview.py
"""
import bpy, bmesh, math, random
from mathutils import Vector

random.seed(0x9e3779b1 & 0xffffffff)

# --- Constantes (iguais a jericho.ts; eixo Z do jogo -> eixo Y do Blender) ---
TOP = 1.6
R_OUT = 13.6
WALL_THK = 1.5
STONE_H = 2.6
BRICK_H = 3.4
WALL_H = STONE_H + BRICK_H
MERLON_H = 0.7
TOWER_TOP = WALL_H + 1.3
GATE_A = -math.pi / 2
GATE_HALF = 0.19

bpy.ops.wm.read_factory_settings(use_empty=True)

def mat(name, hex_or_rgb, rough=0.92, emit=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    if isinstance(hex_or_rgb, str):
        h = hex_or_rgb.lstrip("#")
        rgb = tuple(int(h[i:i+2], 16) / 255 for i in (0, 2, 4))
    else:
        rgb = hex_or_rgb
    # sRGB -> linear aproximado
    lin = tuple(c ** 2.2 for c in rgb)
    b.inputs["Base Color"].default_value = (*lin, 1)
    b.inputs["Roughness"].default_value = rough
    if "Specular IOR Level" in b.inputs: b.inputs["Specular IOR Level"].default_value = 0.1
    if emit > 0:
        b.inputs["Emission Color"].default_value = (*lin, 1)
        b.inputs["Emission Strength"].default_value = emit
    return m

LIME = [mat("lime%d" % i, c) for i, c in enumerate(["#cdbd97", "#c3b389", "#d6c8a4", "#b9a982"])]
MUD = [mat("mud%d" % i, c) for i, c in enumerate(["#b06a3f", "#a55c34", "#bb7547", "#9d5530"])]
MUD_DARK = [mat("mudd%d" % i, c) for i, c in enumerate(["#8f4d2c", "#995731"])]
M_PLASTER = mat("plaster", "#d8c9a3")
M_WOOD = mat("wood", "#5a3f25")
M_WOOD_D = mat("woodd", "#3f2c18")
M_SCARLET = mat("scarlet", "#b3261d", emit=0.12)
M_DARK = mat("dark", "#1a140e")
ADOBE = [mat("adobe%d" % i, c) for i, c in enumerate(["#c89a63", "#bd8e57", "#d2a771", "#c2924f"])]
M_ROOF = mat("roof", "#b07b44")
M_STONE = mat("stone", "#b9a786")
M_SAND = mat("sand", "#cdaa6f")
M_EMBER = mat("ember", "#ff7a2a", emit=1.2)

def box(cx, cy, cz, sx, sy, sz, m, rz=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(cx, cy, cz))
    o = bpy.context.active_object; o.scale = (sx, sy, sz); o.rotation_euler = (0, 0, rz)
    o.data.materials.append(m)
    return o

def ang_to_gate(a):
    d = a - GATE_A
    return abs(math.atan2(math.sin(d), math.cos(d)))

# --- Tell ---
bpy.ops.mesh.primitive_cone_add(radius1=R_OUT + 22, radius2=R_OUT + 8, depth=6, location=(0, 0, TOP - 3), vertices=48)
bpy.context.active_object.data.materials.append(M_SAND)
bpy.ops.mesh.primitive_plane_add(size=160, location=(0, 0, TOP - 6)); bpy.context.active_object.data.materials.append(M_SAND)

# --- Cortina tijolo-a-tijolo (pedra + tijolo + merloes) ---
def ring(mats, r_outer, y0, y1, course_h, brick_w, thk, skip_gate):
    r_center = r_outer - thk / 2
    courses = max(1, round((y1 - y0) / course_h))
    ch = (y1 - y0) / courses
    n = max(8, round((2 * math.pi * r_center) / brick_w))
    step = 2 * math.pi / n
    for c in range(courses):
        z = TOP + y0 + (c + 0.5) * ch
        off = (c % 2) * 0.5 * step
        for i in range(n):
            a = i * step + off
            if skip_gate and ang_to_gate(a) < GATE_HALF: continue
            r = r_center + (random.random() - 0.5) * 0.12
            x = math.cos(a) * r; y = math.sin(a) * r
            m = mats[random.randrange(len(mats))]
            box(x, y, z, thk * 0.96, brick_w * 0.92, ch * 0.9, m, rz=-a)

ring(LIME, R_OUT, 0, STONE_H, 0.4, 0.95, WALL_THK, True)
ring(MUD, R_OUT - 0.12, STONE_H, WALL_H, 0.36, 0.85, WALL_THK * 0.92, True)

r_center = R_OUT - 0.12 - (WALL_THK * 0.92) / 2
nM = max(8, round((2 * math.pi * r_center) / 1.7)); stepM = 2 * math.pi / nM
for i in range(nM):
    if i % 2 != 0: continue
    a = i * stepM
    if ang_to_gate(a) < GATE_HALF + stepM: continue
    box(math.cos(a) * r_center, math.sin(a) * r_center, TOP + WALL_H + MERLON_H / 2,
        WALL_THK * 0.9, 0.95, MERLON_H, MUD_DARK[0], rz=-a)

# --- Glacis ---
bpy.ops.mesh.primitive_cone_add(radius1=R_OUT + 3.4, radius2=R_OUT + 0.1, depth=3.0,
                                location=(0, 0, TOP + 0.2 - 1.5), vertices=48)
bpy.context.active_object.data.materials.append(M_PLASTER)

# --- Torres ---
def tower(a, w_tan, d_rad):
    r = R_OUT + 0.2; x = math.cos(a) * r; y = math.sin(a) * r; rz = -a
    box(x, y, TOP + STONE_H / 2, d_rad, w_tan, STONE_H, LIME[0], rz)
    mh = TOWER_TOP - STONE_H
    box(x, y, TOP + STONE_H + mh / 2, d_rad, w_tan, mh, MUD[0], rz)
    box(x, y, TOP + TOWER_TOP + 0.35, d_rad + 0.3, w_tan + 0.3, 0.7, MUD_DARK[0], rz)

for i in range(10):
    a = i / 10 * 2 * math.pi
    if ang_to_gate(a) < GATE_HALF + 0.45: continue
    tower(a, 3.0, 3.4)

# --- Portao fechado ---
tower(GATE_A - 0.34, 3.4, 4.0); tower(GATE_A + 0.34, 3.4, 4.0)
gx = math.cos(GATE_A) * R_OUT; gy = math.sin(GATE_A) * R_OUT; rz = -GATE_A
openW = 2 * R_OUT * math.sin(GATE_HALF)
box(gx, gy, TOP + WALL_H - 1.1, 1.0, openW + 1.4, 0.7, M_WOOD, rz)
box(gx, gy, TOP + WALL_H - 0.4, WALL_THK, openW + 1.4, 1.1, MUD[0], rz)
inward = R_OUT - WALL_THK - 1.0
for s in (-1, 1):
    cx = math.cos(GATE_A) * inward; cy = math.sin(GATE_A) * inward
    box(cx + s * (openW / 2 + 0.6), cy, TOP + (WALL_H - 0.6) / 2, 1.4, 1.6, WALL_H - 0.6, MUD[1], rz)
leaf = openW / 2
for s in (-1, 1):
    box(gx + s * (leaf / 2), gy + 0.1, TOP + (WALL_H - 1.5) / 2, 0.32, leaf - 0.06, WALL_H - 1.5, M_WOOD, rz)
for zz in (1.2, 2.6, 4.0):
    box(gx, gy + 0.28, TOP + zz, 0.12, openW - 0.1, 0.18, M_WOOD_D, rz)

# --- Casa de Raabe + cordao ---
a = GATE_A + 0.62; rz = -a; rBody = R_OUT - 0.2
x = math.cos(a) * rBody; y = math.sin(a) * rBody; bodyY = TOP + STONE_H; h = 2.8
box(x, y, bodyY + h / 2, 2.2, 3.0, h, M_PLASTER, rz)
box(x, y, bodyY + h + 0.12, 2.4, 3.2, 0.24, M_ROOF, rz)
rWin = R_OUT + 0.32
box(math.cos(a) * rWin, math.sin(a) * rWin, bodyY + h * 0.62, 0.18, 0.8, 0.9, M_DARK, rz)
rCord = R_OUT + 0.42
box(math.cos(a) * rCord, math.sin(a) * rCord, bodyY + h * 0.62 - 1.1, 0.07, 0.12, 2.4, M_SCARLET, rz)

# --- Cidade interna densa ---
blocks = [(3.4, 3.0), (-3.6, 3.4), (4.2, -2.6), (-4.0, -3.2), (-6.2, 0.5), (6.0, 1.0),
          (0.4, 6.2), (0.2, -6.0), (-2.0, 7.2), (7.4, -1.6)]
for bx, bz in blocks:
    for k in range(2 + random.randrange(3)):
        ox = bx + (random.random() - 0.5) * 2.6; oz = bz + (random.random() - 0.5) * 2.6
        d = math.hypot(ox, oz)
        if d < 2.4 or d > 10: continue
        x = ox; y = oz
        w = 2.0 + random.random() * 1.4; dp = 1.8 + random.random() * 1.2; hh = 1.8 + random.random() * 0.8
        ry = random.random() * math.pi; ad = ADOBE[random.randrange(len(ADOBE))]
        box(x, y, TOP + hh / 2, w, dp, hh, ad, ry)
        box(x, y, TOP + hh + 0.12, w + 0.18, dp + 0.18, 0.24, ad, ry)
        dirX = math.sin(ry); dirY = math.cos(ry)
        box(x + dirX * (dp / 2 + 0.01), y + dirY * (dp / 2 + 0.01), TOP + 0.8, 0.7, 0.1, 1.4, M_DARK, ry)
        if random.random() < 0.34:
            h2 = 1.2 + random.random() * 0.6
            box(x, y, TOP + hh + h2 / 2, w * 0.7, dp * 0.7, h2, ad, ry)

# --- Santuario pagao (migdal + massebot + altar) ---
box(0, 0, TOP + 0.35, 5.0, 4.4, 0.7, M_STONE)
box(0, 0.4, TOP + 0.7 + 1.6, 3.2, 2.6, 3.2, mat("cela", "#9a8a6c"))
for s in (-1, 1):
    box(s * 1.7, -1.6, TOP + 0.7 + 2.1, 1.1, 1.1, 4.2, mat("mtorre%d" % s, "#8f8064"))
box(0, -1.6, TOP + 0.7 + 1.2, 1.2, 0.2, 2.4, M_DARK)
for i in range(4):
    box(-2.4 + i * 1.6, -3.4, TOP + 0.95, 0.4, 0.35, 1.9, mat("mas%d" % i, "#7d7158"), rz=0.1 * i)
box(0, -4.6, TOP + 0.5, 1.6, 1.2, 1.0, M_STONE)

# --- Props de rua ---
for lx, lz in [(2.0, 1.5), (2.4, 1.2), (-2.2, -1.4), (5.0, 0.2), (-5.4, 1.6)]:
    box(lx, lz, TOP + 0.45, 0.5, 0.5, 0.9, mat("jar", "#a85f38"), rz=random.random() * math.pi)
    box(lx, lz, TOP + 0.55, 0.62, 0.62, 0.5, mat("jarb", "#a85f38"))
box(-2.6, 1.8, TOP + 0.55, 1.1, 1.1, 1.1, mat("tabun", "#8a6038"))
box(-2.6, 1.8, TOP + 1.05, 0.4, 0.4, 0.18, M_EMBER)
box(3.0, -1.0, TOP + 0.4, 1.2, 1.2, 0.8, M_STONE)
box(3.0, -1.0, TOP + 0.82, 0.7, 0.7, 0.1, M_DARK)

# --- Josue (1,8 m) ao pe do portao para escala ---
box(0, -(R_OUT + 4), TOP + 0.9, 0.5, 0.4, 1.8, mat("josue", "#9c6a3f"))

# --- Luz / mundo / cameras / render ---
sd = bpy.data.lights.new("S", 'SUN'); sd.energy = 3.2
su = bpy.data.objects.new("S", sd); bpy.context.collection.objects.link(su); su.rotation_euler = (0.7, 0.2, 0.6)
w = bpy.data.worlds.new("W"); w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.55, 0.7, 0.92, 1)
w.node_tree.nodes["Background"].inputs[1].default_value = 0.9
bpy.context.scene.world = w

sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 16
sc.render.resolution_x = 1280; sc.render.resolution_y = 760

def render(loc, tgt, path):
    cam_d = bpy.data.cameras.new("C"); cam = bpy.data.objects.new("C", cam_d)
    bpy.context.collection.objects.link(cam)
    cam.location = Vector(loc)
    cam.rotation_euler = (Vector(tgt) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    sc.camera = cam
    sc.render.filepath = path
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam, do_unlink=True)

# Vista 3/4 da aproximacao (do lado do portao, -Y).
render((-30, -46, 22), (0, -2, 5), "/tmp/jerico_preview.png")
# Vista de cima (planta da densidade interna).
render((0.1, 0, 60), (0, 0, TOP), "/tmp/jerico_preview_top.png")
print("JERICO_PREVIEW_DONE")
