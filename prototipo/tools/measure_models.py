"""Mede bounding box (x,y,z em Z-up do Blender) de cada glb de Jerico, p/ planejar a montagem."""
import bpy
from mathutils import Vector
BASE = "/home/alisson/Documents/game/prototipo/public/models/"
MODELS = ["muralha", "portao", "casa_adobe", "casa_adobe2", "jarro", "tabun", "palmeira"]
bpy.ops.wm.read_factory_settings(use_empty=True)
for name in MODELS:
    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
    try:
        bpy.ops.import_scene.gltf(filepath=BASE + name + ".glb")
    except Exception as e:
        print("MEAS %s FAIL %s" % (name, e)); continue
    bpy.context.view_layer.update()
    co = [o.matrix_world @ Vector(c) for o in bpy.data.objects if o.type == 'MESH' for c in o.bound_box]
    if not co:
        print("MEAS %s EMPTY" % name); continue
    xs = [c.x for c in co]; ys = [c.y for c in co]; zs = [c.z for c in co]
    dx = max(xs)-min(xs); dy = max(ys)-min(ys); dz = max(zs)-min(zs)
    tris = sum(len(o.data.polygons) for o in bpy.data.objects if o.type == 'MESH')
    print("MEAS %s dx=%.3f dy=%.3f dz=%.3f tris=%d" % (name, dx, dy, dz, tris))
print("MEASURE_DONE")
