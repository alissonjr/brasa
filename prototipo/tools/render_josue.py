import bpy
from mathutils import Vector

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath="/home/alisson/Documents/game/prototipo/public/models/josue.glb")

meshes = [o for o in bpy.data.objects if o.type == 'MESH']
body = max(meshes, key=lambda o: len(o.data.vertices))
bpy.context.view_layer.update()
co = [body.matrix_world @ Vector(c) for c in body.bound_box]
xs = [c.x for c in co]; ys = [c.y for c in co]; zs = [c.z for c in co]
cx = (min(xs) + max(xs)) / 2; cy = (min(ys) + max(ys)) / 2
minz = min(zs); H = max(zs) - minz; cz = minz + H * 0.55

cam_data = bpy.data.cameras.new("C"); cam = bpy.data.objects.new("C", cam_data)
bpy.context.collection.objects.link(cam)
cam.location = (cx, cy - 3.4, cz)
cam.rotation_euler = (1.5708, 0, 0)
bpy.context.scene.camera = cam

sd = bpy.data.lights.new("S", 'SUN'); sd.energy = 4.0
su = bpy.data.objects.new("S", sd); bpy.context.collection.objects.link(su)
su.rotation_euler = (0.6, 0.2, 0.3)

w = bpy.data.worlds.new("W"); w.use_nodes = True
w.node_tree.nodes["Background"].inputs[1].default_value = 1.2
bpy.context.scene.world = w

sc = bpy.context.scene
sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = 24
sc.render.resolution_x = 600; sc.render.resolution_y = 820
sc.render.filepath = "/tmp/josue_render.png"
bpy.ops.render.render(write_still=True)
print("RENDER_DONE")
