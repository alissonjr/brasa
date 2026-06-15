#!/usr/bin/env python3
"""Rig + anima um modelo Tripo (cadeia de tarefas) e baixa o glb riggado e animado,
pronto para o HeroModel do jogo (idle/walk/run embutidos).

Fluxo:
  [text_to_model] -> animate_rig -> animate_retarget(idle,walk,run) -> download

Uso:
  # riggar/animar a partir de uma geracao existente:
  python3 tools/tripo_rig.py --gen-task <TASK_ID> -o public/models/acendedora_rigged.glb
  # gerar do zero e depois riggar/animar:
  python3 tools/tripo_rig.py --prompt "..." [--negative "..."] -o saida.glb
  # retomar do rig ja pronto:
  python3 tools/tripo_rig.py --rig-task <RIG_TASK_ID> -o saida.glb
"""
import argparse
import json
import os
import sys
import time
import urllib.request
import urllib.error

BASE = "https://api.tripo3d.ai/v2/openapi"
TOKEN_FILE = os.path.join(os.path.dirname(__file__), ".tripo-token")
ANIMS = ["preset:idle", "preset:walk", "preset:run"]


def token():
    with open(TOKEN_FILE, "r", encoding="utf-8") as f:
        return f.read().strip()


def api(method, path, body=None):
    url = f"{BASE}{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("Authorization", f"Bearer {token()}")
    if data is not None:
        req.add_header("Content-Type", "application/json")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        return json.loads(e.read().decode())


def create(payload, label):
    r = api("POST", "/task", payload)
    if r.get("code") != 0:
        print(f"FALHA ao criar {label}: {json.dumps(r)}", file=sys.stderr)
        sys.exit(1)
    tid = r["data"]["task_id"]
    print(f"{label} task_id: {tid}")
    return tid


def wait(tid, label):
    while True:
        time.sleep(5)
        s = api("GET", f"/task/{tid}")
        d = s.get("data", {})
        status = str(d.get("status", "")).lower()
        print(f"  [{label}] status={status} progress={d.get('progress')}")
        if status in ("success", "succeeded", "finished", "completed"):
            return d
        if status in ("failed", "cancelled", "error", "banned", "expired", "unknown"):
            print(f"  [{label}] FALHOU: {json.dumps(s)}", file=sys.stderr)
            sys.exit(1)


def model_url(d):
    o = d.get("output", {}) or {}
    return o.get("pbr_model") or o.get("model") or o.get("base_model")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--prompt")
    ap.add_argument("--negative")
    ap.add_argument("--gen-task", dest="gen_task")
    ap.add_argument("--rig-task", dest="rig_task")
    ap.add_argument("-o", "--out", required=True)
    ap.add_argument("--face-limit", type=int, default=5000)
    ap.add_argument("--spec", default="tripo", choices=["tripo", "mixamo"])
    a = ap.parse_args()

    rig_task = a.rig_task
    if not rig_task:
        gen_task = a.gen_task
        if not gen_task:
            if not a.prompt:
                ap.error("informe --prompt, --gen-task ou --rig-task")
            payload = {"type": "text_to_model", "prompt": a.prompt,
                       "model_version": "v2.5-20250123", "texture": True, "pbr": True,
                       "face_limit": a.face_limit}
            if a.negative:
                payload["negative_prompt"] = a.negative
            gen_task = create(payload, "gen")
            wait(gen_task, "gen")
        rig_task = create({"type": "animate_rig", "original_model_task_id": gen_task,
                           "out_format": "glb", "topology": "bip", "spec": a.spec}, "rig")
        wait(rig_task, "rig")

    ret_task = create({"type": "animate_retarget", "original_model_task_id": rig_task,
                       "out_format": "glb", "animations": ANIMS,
                       "bake_animation": True, "export_with_geometry": True}, "retarget")
    d = wait(ret_task, "retarget")
    url = model_url(d)
    if not url:
        print(f"Sem URL no resultado: {json.dumps(d)}", file=sys.stderr)
        sys.exit(1)
    os.makedirs(os.path.dirname(a.out) or ".", exist_ok=True)
    urllib.request.urlretrieve(url, a.out)
    print("baixado:", a.out)


if __name__ == "__main__":
    main()
