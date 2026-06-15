"""Render isolado de muralha.glb e portao.glb (Tripo) p/ julgar se servem na cidade."""
import bpy, math
from mathutils import Vector
BASE = "/home/alisson/Documents/game/prototipo/public/models/"
bpy.ops.wm.read_factory_settings(use_empty=True)

def imp(path, ox, target):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    new = [o for o in bpy.data.objects if o not in before]
    emp = bpy.data.objects.new("G", None); bpy.context.collection.objects.link(emp)
    for o in new:
        if o.parent is None: o.parent = emp
    bpy.context.view_layer.update()
    co = [o.matrix_world @ Vector(c) for o in new if o.type == 'MESH' for c in o.bound_box]
    zs = [c.z for c in co]; s = target / max(0.001, max(zs) - min(zs)); emp.scale = (s, s, s)
    bpy.context.view_layer.update()
    co = [o.matrix_world @ Vector(c) for o in new if o.type == 'MESH' for c in o.bound_box]
    cx = sum(c.x for c in co)/len(co); cy = sum(c.y for c in co)/len(co)
    emp.location = (ox - cx, -cy, -min(c.z for c in co))

imp(BASE + "muralha.glb", -4, 4.0)
imp(BASE + "portao.glb", 4, 4.0)
bpy.ops.mesh.primitive_plane_add(size=60);
m = bpy.data.materials.new("g"); m.use_nodes=True
m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value=(0.6,0.55,0.45,1)
bpy.context.active_object.data.materials.append(m)
sd=bpy.data.lights.new("S",'SUN'); sd.energy=3.0; su=bpy.data.objects.new("S",sd); bpy.context.collection.objects.link(su); su.rotation_euler=(0.8,0.2,0.5)
w=bpy.data.worlds.new("W"); w.use_nodes=True; w.node_tree.nodes["Background"].inputs[1].default_value=1.0; bpy.context.scene.world=w
cam_d=bpy.data.cameras.new("C"); cam=bpy.data.objects.new("C",cam_d); bpy.context.collection.objects.link(cam)
tgt=Vector((0,0,2)); loc=Vector((-3,-13,4.5)); cam.location=loc; cam.rotation_euler=(tgt-loc).to_track_quat('-Z','Y').to_euler()
bpy.context.scene.camera=cam
sc=bpy.context.scene; sc.render.engine='CYCLES'; sc.cycles.device='CPU'; sc.cycles.samples=14
sc.render.resolution_x=1200; sc.render.resolution_y=620; sc.render.filepath="/tmp/wall_check.png"
bpy.ops.render.render(write_still=True); print("WALL_CHECK_DONE")
