"""Diagnostico: bbox + histograma por eixo do glb cru, para achar em que eixo as duas
figuras estao separadas e onde esta o vale (gap) entre elas."""
import sys

import bpy

import bl_helpers as bh


def hist(vals, lo, hi, bins=24):
    out = [0] * bins
    span = (hi - lo) or 1.0
    for v in vals:
        i = min(bins - 1, int((v - lo) / span * bins))
        out[i] += 1
    return out


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    path = argv[0]
    bh.reset_scene()
    meshes = bh.import_model(path)
    obj = meshes[0]
    bh.apply_transform(obj, location=True, rotation=True, scale=True)
    vs = obj.data.vertices
    for axis, name in enumerate("XYZ"):
        cs = [v.co[axis] for v in vs]
        lo, hi = min(cs), max(cs)
        h = hist(cs, lo, hi)
        print(f"{name}: [{lo:.2f},{hi:.2f}] span={hi-lo:.2f}  hist={h}")


main()
