import bpy, bmesh, math
from mathutils import Vector

SRC = "/home/alisson/Documents/game/prototipo/public/models/AnimationLibrary_Godot_Standard.gltf"
OUT = "/home/alisson/Documents/game/prototipo/public/models/josue.glb"

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)

arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
skinned = [m for m in meshes if any(md.type == 'ARMATURE' for md in m.modifiers)]
body = max(skinned or meshes, key=lambda o: len(o.data.vertices))
for m in meshes:
    if m is not body:
        bpy.data.objects.remove(m, do_unlink=True)

# Pose de repouso (sem ação) p/ a simulação de pano colidir com o corpo parado.
if arm.animation_data:
    arm.animation_data.action = None
bpy.context.scene.frame_set(1)
bpy.context.view_layer.update()

co = [body.matrix_world @ Vector(c) for c in body.bound_box]
xs = [c.x for c in co]; ys = [c.y for c in co]; zs = [c.z for c in co]
cx = (min(xs) + max(xs)) / 2; cy = (min(ys) + max(ys)) / 2
minz = min(zs); H = max(zs) - minz
def Z(f): return minz + f * H

def bname(*subs):
    for s in subs:
        for b in arm.data.bones:
            if s in b.name:
                return b.name
    return arm.data.bones[0].name
HEAD = bname('head'); CHEST = bname('spine.003', 'spine.002'); HIPS = bname('hips', 'pelvis')

def mat(name, rgba, rough=0.9, two=False):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = rgba
    b.inputs["Roughness"].default_value = rough
    if "Specular IOR Level" in b.inputs:
        b.inputs["Specular IOR Level"].default_value = 0.1
    m.use_backface_culling = not two
    return m

skin = mat("skin", (0.74, 0.52, 0.34, 1))
tunic_m = mat("tunic", (0.60, 0.31, 0.13, 1))
manto_m = mat("manto", (0.50, 0.17, 0.11, 1), two=True)
beard_m = mat("beard", (0.18, 0.12, 0.08, 1))
band_m = mat("band", (0.80, 0.70, 0.46, 1))
hair_m = mat("hair", (0.16, 0.10, 0.06, 1))
bronze = mat("bronze", (0.55, 0.33, 0.12, 1), rough=0.45)
eye_m = mat("eye", (0.08, 0.06, 0.05, 1), rough=0.4)
body.data.materials.clear(); body.data.materials.append(skin)

# Corpo como colisor da simulação
col = body.modifiers.new("Collision", 'COLLISION')
body.collision.thickness_outer = 0.018
body.collision.thickness_inner = 0.02

def obj_from(name, verts, faces, material):
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    ob = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(ob)
    ob.data.materials.append(material)
    return ob

def weight_bone(ob, bone):
    ob.parent = arm; ob.matrix_parent_inverse = arm.matrix_world.inverted()
    vg = ob.vertex_groups.new(name=bone)
    vg.add(list(range(len(ob.data.vertices))), 1.0, 'REPLACE')
    ob.modifiers.new("arm", "ARMATURE").object = arm

def bonepos(*subs):
    return arm.matrix_world @ arm.data.bones[bname(*subs)].head_local

def add_sphere(name, loc, r, scale, material, bone):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=r, location=loc, segments=16, ring_count=10)
    o = bpy.context.active_object; o.name = name; o.scale = scale
    o.data.materials.clear(); o.data.materials.append(material)
    for p in o.data.polygons: p.use_smooth = True
    weight_bone(o, bone); return o

def add_box(name, loc, half, material, bone):
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=loc)
    o = bpy.context.active_object; o.name = name; o.scale = half
    o.data.materials.clear(); o.data.materials.append(material)
    weight_bone(o, bone); return o

def build_hair():
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.088, location=(cx, cy + 0.006, Z(0.952)), segments=20, ring_count=14)
    o = bpy.context.active_object; o.name = "Cabelo"; o.scale = (1.0, 1.03, 1.04)
    bpy.context.view_layer.update()
    me = o.data; bm = bmesh.new(); bm.from_mesh(me)
    dele = [f for f in bm.faces if (o.matrix_world @ f.calc_center_median()).y < cy - 0.012
            and (o.matrix_world @ f.calc_center_median()).z < Z(0.965)]
    bmesh.ops.delete(bm, geom=dele, context='FACES')
    bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    o.data.materials.append(hair_m)
    weight_bone(o, HEAD); return o

def simulate(ob, frames=60):
    bpy.context.scene.frame_set(1)
    for f in range(1, frames + 1):
        bpy.context.scene.frame_set(f)
    # congela a forma drapejada (aplica modificadores via depsgraph)
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg)
    newme = bpy.data.meshes.new_from_object(ev)
    ob.modifiers.clear()
    ob.data = newme

# --- Túnica: cilindro solto, drapejado por cloth sim ---
N, M = 24, 16
tv = []
for r in range(M):
    zf = 0.80 - (0.80 - 0.22) * (r / (M - 1))
    rad = 0.205 + 0.02 * (r / (M - 1))  # levemente mais larga embaixo
    for i in range(N):
        a = 2 * math.pi * i / N
        tv.append((cx + math.cos(a) * rad, cy + math.sin(a) * rad * 0.82, Z(zf)))
tf = []
for r in range(M - 1):
    for i in range(N):
        j = (i + 1) % N
        a = r * N; b = (r + 1) * N
        tf.append((a + i, a + j, b + j, b + i))
tunic = obj_from("Tunic", tv, tf, tunic_m)
pin = tunic.vertex_groups.new(name="pin")
pin.add([i for i in range(N)], 1.0, 'REPLACE')  # anel do topo preso (ombros)
cl = tunic.modifiers.new("Cloth", 'CLOTH')
cl.settings.vertex_group_mass = "pin"
cl.settings.mass = 0.3
cl.settings.tension_stiffness = 12
cl.settings.compression_stiffness = 12
cl.settings.shear_stiffness = 12
cl.settings.bending_stiffness = 0.6
cl.collision_settings.distance_min = 0.012
cl.collision_settings.self_distance_min = 0.006
cl.collision_settings.use_self_collision = True
simulate(tunic, 60)
tunic.modifiers.new("subsurf", 'SUBSURF').levels = 1
weight_bone(tunic, HIPS)  # base; auto seria melhor, mas single-bone é estável p/ saia

# --- Manto: painel atrás, drapejado por cloth sim ---
cols, rows = 9, 12
mv = []
for r in range(rows):
    zf = 0.78 - (0.78 - 0.34) * (r / (rows - 1))
    for c in range(cols):
        xf = (c / (cols - 1) - 0.5) * 2
        mv.append((cx + xf * 0.22, cy + 0.14, Z(zf)))
mf = []
for r in range(rows - 1):
    for c in range(cols - 1):
        a = r * cols + c
        mf.append((a, a + 1, a + cols + 1, a + cols))
manto = obj_from("Manto", mv, mf, manto_m)
pinm = manto.vertex_groups.new(name="pin")
pinm.add(list(range(cols)), 1.0, 'REPLACE')  # borda de cima presa (ombros)
clm = manto.modifiers.new("Cloth", 'CLOTH')
clm.settings.vertex_group_mass = "pin"
clm.settings.mass = 0.25
clm.settings.bending_stiffness = 0.4
clm.collision_settings.distance_min = 0.012
simulate(manto, 60)
manto.modifiers.new("subsurf", 'SUBSURF').levels = 1
weight_bone(manto, CHEST)

# --- Cabeça: bandolete, barba, rosto, escamas, espada ---
build_hair()
# Bandolete fina na linha do cabelo (acima dos olhos), sobre o cabelo
bpy.ops.mesh.primitive_torus_add(major_radius=0.09, minor_radius=0.008, location=(cx, cy, Z(0.965)))
band = bpy.context.active_object; band.name = "Bandolete"; band.scale = (1, 0.96, 0.55)
band.data.materials.clear(); band.data.materials.append(band_m)
weight_bone(band, HEAD)
add_sphere("Barba", (cx, cy - 0.045, Z(0.9)), 0.072, (1.1, 0.85, 0.7), beard_m, HEAD)
add_sphere("OlhoL", (cx - 0.033, cy - 0.083, Z(0.943)), 0.012, (1, 1, 0.7), eye_m, HEAD)
add_sphere("OlhoR", (cx + 0.033, cy - 0.083, Z(0.943)), 0.012, (1, 1, 0.7), eye_m, HEAD)
add_box("SbL", (cx - 0.033, cy - 0.086, Z(0.962)), (0.02, 0.009, 0.006), beard_m, HEAD)
add_box("SbR", (cx + 0.033, cy - 0.086, Z(0.962)), (0.02, 0.009, 0.006), beard_m, HEAD)
add_sphere("Nariz", (cx, cy - 0.094, Z(0.928)), 0.018, (0.8, 1.5, 0.9), skin, HEAD)
for sgn in (-1, 1):
    side = 'L' if sgn < 0 else 'R'
    add_sphere("Pauldron", (cx + sgn * 0.18, cy, Z(0.78)), 0.09, (1.5, 1.3, 0.7), bronze,
               bname('upper_arm.' + side, 'shoulder.' + side))

# Mangas curtas cobrindo ombro/braço (menos "pelado")
for sgn in (-1, 1):
    side = 'L' if sgn < 0 else 'R'
    bpy.ops.mesh.primitive_cylinder_add(radius=0.066, depth=0.2, location=(cx + sgn * 0.24, cy, Z(0.78)),
                                        rotation=(0, math.pi / 2, 0), vertices=14)
    o = bpy.context.active_object; o.name = "Manga"
    o.data.materials.clear(); o.data.materials.append(tunic_m)
    for p in o.data.polygons: p.use_smooth = True
    weight_bone(o, bname('upper_arm.' + side, 'shoulder.' + side))

sx = bonepos('hips', 'pelvis').x - 0.17
add_box("Bainha", (sx, cy, Z(0.40)), (0.018, 0.03, 0.11), beard_m, HIPS)
add_box("Guarda", (sx, cy, Z(0.50)), (0.05, 0.018, 0.018), bronze, HIPS)
add_box("Punho", (sx, cy, Z(0.535)), (0.018, 0.022, 0.05), bronze, HIPS)

bpy.context.scene.frame_set(1)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB',
                          export_animations=True, export_animation_mode='ACTIONS')
print("EXPORTED", OUT)
