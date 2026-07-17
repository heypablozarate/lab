#!/usr/bin/env python3
"""Fase 3 — Upscale 2x de assets (EDSR para chicos, FSRCNN para grandes).
GIF: maneja transparencia binaria (re-cuantiza a paleta 255 + índice transparente).
Idempotente vía manifest. Los originales quedan en .orig1x/ por si hay que volver."""
import json, sys, time
from pathlib import Path
import cv2
import numpy as np
from PIL import Image

BASE = Path(__file__).resolve().parent.parent / "site"
IMG = BASE / "img"
BAK = BASE / ".orig1x"
MANIFEST = BASE / ".upscaled.json"
SKIP = {"pantalla_anim.gif", "amelie_chica_sonriendo_fold.gif", "fotobox2.gif"}
EDSR_MAX_PX = 45000  # debajo de esto usa EDSR (mejor), arriba FSRCNN (rápido)

sr_edsr = cv2.dnn_superres.DnnSuperResImpl_create()
sr_edsr.readModel("/tmp/sr/EDSR_x2.pb"); sr_edsr.setModel("edsr", 2)
sr_fsr = cv2.dnn_superres.DnnSuperResImpl_create()
sr_fsr.readModel("/tmp/sr/FSRCNN_x2.pb"); sr_fsr.setModel("fsrcnn", 2)

def up_bgr(bgr):
    return (sr_edsr if bgr.shape[0] * bgr.shape[1] <= EDSR_MAX_PX else sr_fsr).upsample(bgr)

def save_gif(rgb, alpha, path):
    img = Image.fromarray(rgb, "RGB")
    if alpha is not None and (alpha < 128).any():
        p = img.quantize(colors=255, method=Image.MEDIANCUT)
        arr = np.array(p, dtype=np.uint8)
        arr[alpha < 128] = 255
        out = Image.fromarray(arr, "P")
        pal = p.getpalette()
        pal = (pal + [0] * (768 - len(pal)))[:768]
        out.putpalette(pal)
        out.save(path, transparency=255, optimize=True)
    else:
        img.quantize(colors=256, method=Image.MEDIANCUT).save(path, optimize=True)

def process(f: Path):
    ext = f.suffix.lower()
    if ext == ".gif":
        im = Image.open(f)
        if getattr(im, "n_frames", 1) > 1:
            return "skip-anim"
        rgba = im.convert("RGBA")
        a = np.array(rgba)
        if a.shape[0] <= 4 or a.shape[1] <= 4:
            return "skip-tiny"
        bgr = cv2.cvtColor(a[:, :, :3], cv2.COLOR_RGB2BGR)
        up = cv2.cvtColor(up_bgr(bgr), cv2.COLOR_BGR2RGB)
        alpha = a[:, :, 3]
        alpha_up = None
        if (alpha < 255).any():
            alpha_up = cv2.resize(alpha, (up.shape[1], up.shape[0]), interpolation=cv2.INTER_CUBIC)
        save_gif(up, alpha_up, f)
        return "gif"
    else:
        bgr = cv2.imread(str(f), cv2.IMREAD_COLOR)
        if bgr is None:
            return "skip-unreadable"
        if bgr.shape[0] <= 4 or bgr.shape[1] <= 4:
            return "skip-tiny"
        up = up_bgr(bgr)
        cv2.imwrite(str(f), up, [cv2.IMWRITE_JPEG_QUALITY, 90])
        return "jpg"

def main():
    budget = float(sys.argv[1]) if len(sys.argv) > 1 else 35.0
    t0 = time.time()
    done = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}
    files = sorted([p for p in IMG.rglob("*") if p.suffix.lower() in (".gif", ".jpg", ".jpeg")])
    total = len(files)
    for f in files:
        rel = str(f.relative_to(BASE))
        if rel in done or f.name in SKIP:
            continue
        if time.time() - t0 > budget:
            print(f"PAUSA {len(done)}/{total}")
            return
        bak = BAK / f.relative_to(IMG)
        bak.parent.mkdir(parents=True, exist_ok=True)
        if not bak.exists():
            bak.write_bytes(f.read_bytes())
        try:
            r = process(f)
        except Exception as e:
            f.write_bytes(bak.read_bytes())  # restaurar si falló
            r = f"ERROR {e}"
        done[rel] = r
        MANIFEST.write_text(json.dumps(done))
        if "ERROR" in str(r):
            print(f"  {rel}: {r}", flush=True)
    errs = {k: v for k, v in done.items() if "ERROR" in str(v)}
    print(f"LISTO {len(done)}/{total} procesados, {len(errs)} errores")
    for k, v in errs.items():
        print(" ", k, v)

if __name__ == "__main__":
    main()
