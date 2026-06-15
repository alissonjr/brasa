"""Render isolado e centrado de muralha.glb e portao.glb, 3 vistas, p/ ler a orientacao."""
import bpy, math
from mathutils import Vector
BASE = "/home/alisson/Documents/game/prototipo/public/models/"

def setup(name, target=4.0):
    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
    bpy.ops.import_scene.gltf(filepath=BASE + name + ".glb")
    objs = [o for o in bpy.data.objects if o.type == 'MESH']
    emp = bpy.data.objects.new("G", None); bpy.context.collection.objects.link(emp)
    for o in objs:
        if o.parent is None: o.parent = emp
    bpy.context.view_layer.update()
    co = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    zs = [c.z for c in co]; s = target / max(0.001, max(zs)-min(zs)); emp.scale=(s,s,s)
    bpy.context.view_layer.update()
    co = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    emp.location = (-sum(c.x for c in co)/len(co), -sum(c.y for c in co)/len(co), -min(c.z for c in co))
    bpy.ops.mesh.primitive_plane_add(size=40)
    g = bpy.data.materials.new("g"); g.use_nodes=True
    g.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value=(0.62,0.57,0.47,1)
    bpy.context.active_object.data.materials.append(g)
    sd=bpy.data.lights.new("S",'SUN'); sd.energy=3.0; su=bpy.data.objects.new("S",sd)
    bpy.context.collection.objects.link(su); su.rotation_euler=(0.85,0.15,0.5)
    w=bpy.data.worlds.new("W"); w.use_nodes=True; w.node_tree.nodes["Background"].inputs[1].default_value=1.0
    bpy.context.scene.world=w

def shot(loc, tgt, path):
    for c in [o for o in bpy.data.objects if o.type=='CAMERA']: bpy.data.objects.remove(c, do_unlink=True)
    cd=bpy.data.cameras.new("C"); cam=bpy.data.objects.new("C",cd); bpy.context.collection.objects.link(cam)
    cam.location=Vector(loc); cam.rotation_euler=(Vector(tgt)-Vector(loc)).to_track_quat('-Z','Y').to_euler()
    bpy.context.scene.camera=cam
    sc=bpy.context.scene; sc.render.engine='CYCLES'; sc.cycles.device='CPU'; sc.cycles.samples=14
    sc.render.resolution_x=900; sc.render.resolution_y=700; sc.render.filepath=path
    bpy.ops.render.render(write_still=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
setup("muralha", 4.0)
shot((9,-9,5),(0,0,2), "/tmp/muralha_34.png")        # 3/4: olho de fora (+X,-Y)
shot((0,0.1,16),(0,0,1.5), "/tmp/muralha_top.png")    # de cima (planta)
setup("portao", 4.0)
shot((0,-11,5),(0,0,2), "/tmp/portao_front.png")      # de frente (-Y)
shot((0,0.1,16),(0,0,1.5), "/tmp/portao_top.png")     # de cima
print("WALL_SOLO_DONE")
