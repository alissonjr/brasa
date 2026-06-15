import bpy, bmesh, math
from mathutils import Vector

OUT = "/home/alisson/Documents/game/prototipo/public/models/jerico_muralha.glb"
R = 34.0          # raio da muralha (igual ao RING do jogo)
GH = 5.0          # altura do glacis/pedra
WT = 9.0          # topo do tijolo
GATE_A = -math.pi/2   # portão voltado a -Y (para o acampamento)

bpy.ops.wm.read_factory_settings(use_empty=True)

def mat(name, rgba, rough=0.95):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = rgba
    b.inputs["Roughness"].default_value = rough
    if "Specular IOR Level" in b.inputs: b.inputs["Specular IOR Level"].default_value = 0.1
    return m

LIME = mat("limestone", (0.80, 0.73, 0.55, 1))
BRICK = mat("mudbrick", (0.62, 0.35, 0.19, 1))
BRICKD = mat("mudbrick_d", (0.50, 0.28, 0.15, 1))
WOOD = mat("wood", (0.40, 0.27, 0.16, 1))
SAND = mat("sand", (0.80, 0.67, 0.45, 1))
SCAR = mat("scarlet", (0.72, 0.20, 0.16, 1))
PLAST = mat("plaster", (0.82, 0.70, 0.52, 1))
parts = []

def box(name, cx, cy, cz, sx, sy, sz, m, rz=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(cx, cy, cz))
    o = bpy.context.active_object; o.name = name; o.scale = (sx, sy, sz); o.rotation_euler = (0, 0, rz)
    o.data.materials.append(m); parts.append(o); return o

# --- Cortina circular por revolução (perfil: glacis + tijolo + parapeito + face interna) ---
profile = [(R+1.4,0),(R-0.2,GH),(R-0.2,WT),(R+0.0,WT+0.9),(R-0.8,WT+0.9),(R-0.8,WT),(R-2.6,WT),(R-2.6,0)]
bm = bmesh.new()
vs = [bm.verts.new((r,0.0,z)) for (r,z) in profile]
for i in range(len(vs)-1): bm.edges.new((vs[i],vs[i+1]))
bm.edges.new((vs[-1],vs[0]))
bmesh.ops.spin(bm, geom=bm.verts[:]+bm.edges[:], cent=(0,0,0), axis=(0,0,1), dvec=(0,0,0), angle=2*math.pi, steps=72)
bmesh.ops.remove_doubles(bm, verts=bm.verts[:], dist=1e-4)
bm.normal_update()
me = bpy.data.meshes.new("muralha"); bm.to_mesh(me); bm.free()
me.materials.append(LIME); me.materials.append(BRICK)
for p in me.polygons: p.material_index = 0 if p.center.z < GH else 1
wall = bpy.data.objects.new("muralha", me); bpy.context.collection.objects.link(wall); parts.append(wall)

# --- Torres ao redor (dois tons + parapeito), pulando o setor do portão ---
def tower(a):
    x, y = R*math.cos(a), R*math.sin(a)
    box("tw_base", x, y, GH/2, 4.2, 3.4, GH, LIME, rz=a)
    box("tw_brick", x, y, GH+3.2, 4.2, 3.4, 6.4, BRICK, rz=a)
    box("tw_par", x, y, WT+2.4+0.45, 4.4, 3.6, 0.9, BRICKD, rz=a)
for k in range(12):
    a = k/8*2*math.pi
    if abs(((a-GATE_A+math.pi)%(2*math.pi))-math.pi) < 0.5: continue  # pula perto do portão
    tower(a)

# --- Portão de câmaras (fechado, Js 6.1): torres flanqueando + verga + portas ---
for da in (-0.16, 0.16):
    tower(GATE_A+da)
gx, gy = 0, -R
box("gate_lintel", gx, gy-0.6, WT+0.6, 5.0, 0.7, 1.2, BRICK)
for sx in (-1.15, 1.15):
    box("gate_door", sx, gy-1.1, 2.6, 2.1, 0.4, 4.6, WOOD)

# --- Casa de Raabe na muralha + cordão escarlate (Js 2.15) ---
ra = GATE_A + 0.7
rx, ry = R*math.cos(ra), R*math.sin(ra)
box("raabe", rx, ry, WT+1.1, 2.6, 3.0, 2.2, PLAST, rz=ra)
ox, oy = (R+0.6)*math.cos(ra), (R+0.6)*math.sin(ra)
box("raabe_cordao", ox, oy, GH+2.0, 0.08, 0.1, 3.6, SCAR, rz=ra)

# --- Tell (montículo) só para o render (não exportado: o jogo já tem o seu) ---
bpy.ops.mesh.primitive_cone_add(radius1=R+12, radius2=R+7, depth=2.5, location=(0,0,-1.25), vertices=48)
tell = bpy.context.active_object; tell.name="tell_render"; tell.data.materials.append(SAND)
bpy.ops.mesh.primitive_plane_add(size=120, location=(0,0,-2.5)); gp=bpy.context.active_object; gp.data.materials.append(SAND)

# --- Josué (1,8 m) ao pé do portão, fora ---
before=set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath="/home/alisson/Documents/game/prototipo/public/models/josue.glb")
new=[o for o in bpy.data.objects if o not in before]
emp=bpy.data.objects.new("J",None); bpy.context.collection.objects.link(emp)
for o in new:
    if o.parent is None: o.parent=emp
bpy.context.view_layer.update()
co=[o.matrix_world@Vector(c) for o in new if o.type=='MESH' for c in o.bound_box]
zs=[c.z for c in co]; s=1.8/max(0.001,(max(zs)-min(zs))); emp.scale=(s,s,s)
bpy.context.view_layer.update()
co=[o.matrix_world@Vector(c) for o in new if o.type=='MESH' for c in o.bound_box]
emp.location=(0-(sum(c.x for c in co)/len(co)), -(R+3)-(sum(c.y for c in co)/len(co)), -min(c.z for c in co))

# --- Luz/mundo/câmera ---
sd=bpy.data.lights.new("S",'SUN'); sd.energy=3.5; su=bpy.data.objects.new("S",sd); bpy.context.collection.objects.link(su); su.rotation_euler=(0.7,0.2,0.5)
w=bpy.data.worlds.new("W"); w.use_nodes=True; w.node_tree.nodes["Background"].inputs[1].default_value=1.0; bpy.context.scene.world=w
cam_d=bpy.data.cameras.new("C"); cam=bpy.data.objects.new("C",cam_d); bpy.context.collection.objects.link(cam)
tgt=Vector((0,-22,8)); loc=Vector((-58,-86,40)); cam.location=loc; cam.rotation_euler=(tgt-loc).to_track_quat('-Z','Y').to_euler()
bpy.context.scene.camera=cam
sc=bpy.context.scene; sc.render.engine='CYCLES'; sc.cycles.device='CPU'; sc.cycles.samples=10
sc.render.resolution_x=1000; sc.render.resolution_y=620; sc.render.filepath="/tmp/jerico_render.png"
bpy.ops.render.render(write_still=True)

# --- Export (só a muralha; sem tell/plane/Josué) ---
bpy.ops.object.select_all(action='DESELECT')
for o in parts: o.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True)
print("JERICO_DONE")
