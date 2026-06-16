"""Finaliza o glb riggado da Acendedora para o jogo:
- remove malhas-lixo (ex.: Icosphere que o rig do Tripo agrega),
- nomeia as 3 animacoes por MOVIMENTO (robusto, sem depender da ordem das faixas):
  a de menor movimento = idle, a maior = run, a do meio = walk,
- reexporta GLB com armature + skin + animacoes nomeadas idle/walk/run.
O HeroModel acha por regex (idle / walk / run).
"""
import sys
import bpy
import bl_helpers as bh


def action_motion(act):
    """Soma da amplitude (max-min) de todas as fcurves: idle ~ baixo, run ~ alto."""
    total = 0.0
    for fc in act.fcurves:
        vals = [kp.co[1] for kp in fc.keyframe_points]
        if vals:
            total += max(vals) - min(vals)
    return total


def main():
    argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    inp, out = argv[0], argv[1]
    bh.reset_scene()
    bh.import_model(inp)

    # Remove malhas extras (mantem so a malha skinned principal).
    mesh_objs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
    main = max(mesh_objs, key=lambda o: len(o.data.vertices))
    for o in mesh_objs:
        if o is not main:
            print("removendo malha extra:", o.name)
            bpy.data.objects.remove(o, do_unlink=True)

    arm = next((o for o in bpy.context.scene.objects if o.type == 'ARMATURE'), None)

    # Classifica as actions por movimento.
    acts = list(bpy.data.actions)
    ranked = sorted(acts, key=action_motion)
    for a in acts:
        print(f"  action {a.name}: motion={action_motion(a):.2f}")
    # menor->idle, maior->run, meio->walk. Renomeia via nomes temporarios (evita colisao).
    label = {}
    if len(ranked) >= 3:
        label[ranked[0].name] = "idle"
        label[ranked[-1].name] = "run"
        for a in ranked[1:-1]:
            label[a.name] = "walk"
    elif len(ranked) == 2:
        label[ranked[0].name] = "idle"
        label[ranked[1].name] = "walk"
    elif len(ranked) == 1:
        label[ranked[0].name] = "idle"

    for a in acts:
        a.name = "__tmp_" + a.name
    for a in acts:
        orig = a.name[len("__tmp_"):]
        a.name = label.get(orig, orig)
    # Faixas NLA acompanham o nome da action do strip (para qualquer modo de export).
    if arm and arm.animation_data:
        for t in arm.animation_data.nla_tracks:
            for s in t.strips:
                if s.action:
                    t.name = s.action.name
    print("actions finais:", sorted(a.name for a in bpy.data.actions))

    bh.export_glb(out, y_up=True)
    print("exportado:", out)


main()
