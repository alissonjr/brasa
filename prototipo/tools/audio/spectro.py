#!/usr/bin/env python3
"""Espectrogramas pequenos (PNG) dos WAV renderizados + conferência cruzada das medições.

Uso: python3 spectro.py <pasta com WAV e report.json> <pasta de saída dos PNG>
Requer numpy, scipy e matplotlib (no PYTHONPATH). Também recalcula pico, RMS e LUFS integrada
com scipy e compara com o JS (report.json): divergência > 0,3 dB é avisada.
"""
import json, os, sys
import numpy as np
from scipy.io import wavfile
from scipy.signal import spectrogram, lfilter
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt

src, dst = sys.argv[1], sys.argv[2]
os.makedirs(dst, exist_ok=True)
rep = json.load(open(os.path.join(src, "report.json"))) if os.path.exists(os.path.join(src, "report.json")) else {"cases": {}}


def kweight(x, fs):
    G, Q, fc = 3.999843853973347, 0.7071752369554196, 1681.9744509555319
    K = np.tan(np.pi * fc / fs); Vh = 10 ** (G / 20); Vb = Vh ** 0.4996667741545416
    a0 = 1 + K / Q + K * K
    x = lfilter([(Vh + Vb * K / Q + K * K) / a0, 2 * (K * K - Vh) / a0, (Vh - Vb * K / Q + K * K) / a0], [1, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0], x)
    Q, fc = 0.5003270373253953, 38.13547087613982
    K = np.tan(np.pi * fc / fs); a0 = 1 + K / Q + K * K
    return lfilter([1, -2, 1], [1, 2 * (K * K - 1) / a0, (1 - K / Q + K * K) / a0], x)


def lufs_i(L, R, fs):
    w = [kweight(c.astype(np.float64), fs) for c in (L, R)]
    blk, hop = int(0.4 * fs), int(0.1 * fs)
    z = []
    for i in range(0, len(L) - blk + 1, hop):
        z.append(sum(np.mean(c[i:i + blk] ** 2) for c in w))
    z = np.array(z)
    lk = -0.691 + 10 * np.log10(np.maximum(z, 1e-24))
    a = z[lk > -70]
    if not len(a):
        return float("-inf")
    rel = -0.691 + 10 * np.log10(a.mean()) - 10
    g = z[lk > max(-70, rel)]
    return -0.691 + 10 * np.log10(g.mean()) if len(g) else float("-inf")


rows = []
for fn in sorted(os.listdir(src)):
    if not fn.endswith(".wav"):
        continue
    name = fn[:-4]
    fs, d = wavfile.read(os.path.join(src, fn))
    L, R = d[:, 0], d[:, 1]
    mono = 0.5 * (L + R)
    peak = 20 * np.log10(max(np.abs(d).max(), 1e-12))
    li = lufs_i(L, R, fs)
    js = rep["cases"].get(name, {}).get("whole")
    flag = ""
    if js:
        if abs(js["peakDb"] - peak) > 0.3 or (np.isfinite(li) and np.isfinite(js["lufsI"]) and abs(js["lufsI"] - li) > 0.3):
            flag = " <-- DIVERGE"
    rows.append(f"{name:28s} pico {peak:7.2f}  lufsI(py) {li:7.2f}  lufsI(js) {js['lufsI'] if js else float('nan'):7.2f}{flag}")
    nper = 2048
    f, t, S = spectrogram(mono, fs, window="hann", nperseg=nper, noverlap=nper * 3 // 4, scaling="spectrum")
    Sdb = 10 * np.log10(np.maximum(S, 1e-14))
    fig, ax = plt.subplots(figsize=(6.4, 2.3))
    ax.pcolormesh(t, f, Sdb, vmin=-110, vmax=-30, cmap="magma", shading="auto", rasterized=True)
    ax.set_yscale("symlog", linthresh=200, linscale=0.6)
    ax.set_ylim(20, 12000)
    ax.set_yticks([50, 100, 200, 500, 1000, 3000, 10000])
    ax.get_yaxis().set_major_formatter(matplotlib.ticker.ScalarFormatter())
    ax.set_xlabel("s", fontsize=7)
    ax.set_ylabel("Hz", fontsize=7)
    ax.tick_params(labelsize=6)
    ax.set_title(f"{name}  pico {peak:.1f} dBFS  LUFS-I {li:.1f}", fontsize=8)
    fig.tight_layout(pad=0.4)
    import io
    from PIL import Image
    buf = io.BytesIO()
    fig.savefig(buf, format="png", dpi=64)
    plt.close(fig)
    buf.seek(0)
    Image.open(buf).convert("RGB").quantize(colors=48).save(os.path.join(dst, name + ".png"), optimize=True)
print("\n".join(rows))
