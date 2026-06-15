"""Importa o glb riggado, reporta acoes/animacoes, histograma por eixo (detectar 2 figuras)
e renderiza um thumbnail frontal para inspecao visual."""
import sys
import bpy
import bl_helpers as bh


def hist(vals, lo, hi, bins=20):
    out = [0] * bins
    span = (hi - lo) or 1.0
    for v in vals:
        out[min(bins - 1, int((v - lo) / span * bins))] += 1
    return out


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    path, png = argv[0], argv[1]
    bh.reset_scene()
    meshes = bh.import_model(path)
    print("actions:", [a.name for a in bpy.data.actions])
    print("mesh objs:", [m.name for m in meshes])
    obj = meshes[0]
    vs = obj.data.vertices
    for axis, name in enumerate("XYZ"):
        cs = [v.co[axis] for v in vs]
        lo, hi = min(cs), max(cs)
        print(f"{name}: [{lo:.2f},{hi:.2f}] span={hi-lo:.2f} hist={hist(cs,lo,hi)}")
    # camera frontal simples
    bh.setup_camera_and_light(target=(0, 0, 1.0), distance=4.0)
    bh.render_png(png, resolution=(480, 640))
    print("render:", png)


main()
