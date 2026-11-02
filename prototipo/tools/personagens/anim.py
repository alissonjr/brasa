"""Junta clipes das bibliotecas Quaternius UAL1 + UAL2 (CC0) num unico GLB so de animacao.
Uso: blender --background --factory-startup --disable-autoexec --python anim.py -- <ual1.glb> <ual2.glb> <saida.glb> <clipe,clipe,...>
Mantem so os clipes pedidos e so os canais dos ossos que o jogo usa (sem dedos; ver montar.py).
Os clipes saem com o nome ORIGINAL da biblioteca (o jogo faz o retarget por nome de osso)."""
import bpy, sys, os, re
ual1, ual2, saida, lista = sys.argv[sys.argv.index("--") + 1:][:4]
manter = lista.split(",")
bpy.ops.wm.read_factory_settings(use_empty=True)

def importar(p):
    antes = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=p)
    return [o for o in bpy.data.objects if o not in antes]

o1 = importar(ual1); o2 = importar(ual2)
a1 = next(o for o in o1 if o.type == "ARMATURE"); a2 = next(o for o in o2 if o.type == "ARMATURE")
for o in list(bpy.data.objects):
    if o.type == "MESH" or o.name.startswith("Icosphere"): bpy.data.objects.remove(o, do_unlink=True)

DEDOS = re.compile(r"(index|middle|ring|pinky|thumb)_\d\d|_leaf")
def nome_limpo(a):
    return a.name.split("|")[-1]
usadas = {}
for a in list(bpy.data.actions):
    n = nome_limpo(a)
    if n in manter and n not in usadas:
        usadas[n] = a
    else:
        bpy.data.actions.remove(a)
faltam = [n for n in manter if n not in usadas]
assert not faltam, "clipes ausentes: %s" % faltam
for n, a in usadas.items():
    a.name = n
    for fc in list(a.fcurves):
        m = re.search(r'pose\.bones\["([^"]+)"\]', fc.data_path)
        if not m: continue
        osso = m.group(1)
        # dedos fora; escala fora (constante); translacao so de root/pelvis (o resto e comprimento de osso fixo)
        if DEDOS.search(osso) or fc.data_path.endswith(".scale") or (fc.data_path.endswith(".location") and osso not in ("root", "pelvis")):
            a.fcurves.remove(fc)

for a in (a1, a2):
    if a.animation_data: a.animation_data.action = None
if a2.animation_data:
    for t in list(a2.animation_data.nla_tracks): a2.animation_data.nla_tracks.remove(t)
a1.animation_data_create()
for t in list(a1.animation_data.nla_tracks): a1.animation_data.nla_tracks.remove(t)
for n, a in usadas.items():
    tr = a1.animation_data.nla_tracks.new(); tr.name = n
    st = tr.strips.new(n, int(a.frame_range[0]), a); st.name = n
bpy.data.objects.remove(a2, do_unlink=True)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=saida, export_format="GLB", export_animations=True, export_skins=False,
                          export_animation_mode="NLA_TRACKS", export_optimize_animation_size=True,
                          export_frame_step=1, use_selection=False)
print("OK", saida, os.path.getsize(saida) // 1024, "KB", len(usadas), "clipes")
