"""Isola UMA figura do glb da Acendedora gerado pelo Tripo (que saiu com duas figuras
lado a lado). Estrategia: 1D k-means (k=2) na coordenada X dos vertices acha os dois
centros; corta no ponto medio; mantem o lado MAIS ALTO (o que tem o cajado/ember),
recentra e reexporta GLB limpo para a web. Rodar via run.sh (injeta bl_helpers)."""
import argparse
import sys

import bmesh
import bpy
from mathutils import Matrix

import bl_helpers as bh


def valley(vals, bins=24, margin=3):
    """Acha o vale (bin interior menos povoado) numa distribuicao 1D: e o gap entre
    as duas figuras. Retorna (threshold, contagem_no_vale)."""
    lo, hi = min(vals), max(vals)
    span = (hi - lo) or 1.0
    h = [0] * bins
    for v in vals:
        h[min(bins - 1, int((v - lo) / span * bins))] += 1
    best_i, best_c = margin, 10**18
    for i in range(margin, bins - margin):
        if h[i] < best_c:
            best_c, best_i = h[i], i
    return lo + (best_i + 0.5) / bins * span, best_c


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="inp", required=True)
    ap.add_argument("--out", required=True)
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    a = ap.parse_args(argv)

    bh.reset_scene()
    meshes = bh.import_model(a.inp)
    if not meshes:
        print("ERRO: nenhum mesh importado", file=sys.stderr)
        sys.exit(1)

    # Junta tudo numa malha so (Tripo costuma vir 1 objeto, mas seja robusto).
    obj = meshes[0]
    if len(meshes) > 1:
        bm = bmesh.new()
        for m in meshes:
            bh.apply_transform(m, location=True, rotation=True, scale=True)
            bm.from_mesh(m.data)
        bm.to_mesh(obj.data)
        bm.free()
        for m in meshes[1:]:
            bpy.data.objects.remove(m, do_unlink=True)
    bh.apply_transform(obj, location=True, rotation=True, scale=True)

    me = obj.data
    # Escolhe entre X(0) e Y(1) o eixo com o vale mais fundo (a separacao das figuras).
    # Z(2) e a altura (up no Blender), nunca cortamos por ele.
    cands = []
    for axis in (0, 1):
        vals = [v.co[axis] for v in me.vertices]
        thr, cnt = valley(vals)
        cands.append((cnt, axis, thr))
        print(f"axis={'XYZ'[axis]} valley_thr={thr:.3f} valley_count={cnt}")
    cands.sort()
    _, axis, thr = cands[0]

    # Mantem o lado mais ALTO (o que tem o cajado/ember). Loga verts de cada lado.
    zlo = max((v.co.z for v in me.vertices if v.co[axis] < thr), default=-1e9)
    zhi = max((v.co.z for v in me.vertices if v.co[axis] >= thr), default=-1e9)
    nlo = sum(1 for v in me.vertices if v.co[axis] < thr)
    nhi = len(me.vertices) - nlo
    keep_low = zlo >= zhi
    print(f"SPLIT axis={'XYZ'[axis]} thr={thr:.3f} zlo={zlo:.3f}(n={nlo}) zhi={zhi:.3f}(n={nhi}) keep={'low' if keep_low else 'high'}")

    bm = bmesh.new()
    bm.from_mesh(me)
    if keep_low:
        doomed = [v for v in bm.verts if v.co[axis] >= thr]
    else:
        doomed = [v for v in bm.verts if v.co[axis] < thr]
    bmesh.ops.delete(bm, geom=doomed, context='VERTS')

    # Recentra: X/Y no centro, Z apoiado em 0 (pes no chao).
    if bm.verts:
        xsv = [v.co.x for v in bm.verts]
        ysv = [v.co.y for v in bm.verts]
        zsv = [v.co.z for v in bm.verts]
        cx = (min(xsv) + max(xsv)) / 2
        cy = (min(ysv) + max(ysv)) / 2
        mz = min(zsv)
        for v in bm.verts:
            v.co.x -= cx
            v.co.y -= cy
            v.co.z -= mz
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.to_mesh(me)
    bm.free()
    me.update()

    obj.matrix_basis = Matrix.Identity(4)
    me.calc_loop_triangles()
    print(f"tris finais={len(me.loop_triangles)} verts={len(me.vertices)}")

    bh.export_glb(a.out, y_up=True)
    print("exportado:", a.out)


main()
