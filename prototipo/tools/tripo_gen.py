#!/usr/bin/env python3
"""
Helper para gerar modelos 3D pela API da Tripo (text_to_model), fazer polling e baixar
o .glb. O token é lido de tools/.tripo-token (gitignored). Ver tools/tripo-api.md.

Uso:
  python3 tools/tripo_gen.py --balance
  python3 tools/tripo_gen.py "PROMPT" -o public/models/asset.glb [--face-limit 20000] [--no-texture]
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


def balance():
    r = api("GET", "/user/balance")
    print(json.dumps(r, indent=2))
    return r.get("data", {}).get("balance", 0)


def generate(prompt, out, face_limit=None, texture=True, pbr=True, negative=None, model_version="v2.5-20250123"):
    if balance() == 0:
        print("AVISO: saldo 0 - a geracao deve falhar por credito insuficiente.", file=sys.stderr)
    payload = {"type": "text_to_model", "prompt": prompt,
               "model_version": model_version, "texture": texture, "pbr": pbr}
    if negative:
        payload["negative_prompt"] = negative
    if face_limit:
        payload["face_limit"] = face_limit
    r = api("POST", "/task", payload)
    if r.get("code") != 0:
        print("Falha ao criar tarefa:", r, file=sys.stderr)
        sys.exit(1)
    task_id = r["data"]["task_id"]
    print("task_id:", task_id)

    model_url = None
    while True:
        time.sleep(5)
        s = api("GET", f"/task/{task_id}")
        d = s.get("data", {})
        status = str(d.get("status", "")).lower()
        print(f"  status={status} progress={d.get('progress')}")
        if status in ("success", "succeeded", "finished", "completed"):
            out_data = d.get("output", {}) or {}
            model_url = out_data.get("pbr_model") or out_data.get("model") or out_data.get("base_model")
            break
        if status in ("failed", "cancelled", "error", "banned", "expired", "unknown"):
            print("Tarefa falhou:", json.dumps(s, indent=2), file=sys.stderr)
            sys.exit(1)

    if not model_url:
        print("Sem URL de modelo no resultado.", file=sys.stderr)
        sys.exit(1)
    os.makedirs(os.path.dirname(out) or ".", exist_ok=True)
    urllib.request.urlretrieve(model_url, out)
    print("baixado:", out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("prompt", nargs="?", help="prompt de texto para o modelo")
    ap.add_argument("-o", "--out", default="public/models/asset.glb")
    ap.add_argument("--face-limit", type=int, default=None)
    ap.add_argument("--no-texture", action="store_true")
    ap.add_argument("--negative", default=None, help="negative_prompt")
    ap.add_argument("--balance", action="store_true", help="só consulta o saldo")
    a = ap.parse_args()
    if a.balance:
        balance()
        return
    if not a.prompt:
        ap.error("informe o PROMPT (ou use --balance)")
    generate(a.prompt, a.out, face_limit=a.face_limit, texture=not a.no_texture, negative=a.negative)


if __name__ == "__main__":
    main()
