#!/usr/bin/env python3
"""Bache0 RF-DETR V2 — análisis local de JSON *_original.json.

Solo lectura de resultados existentes y archivos de fixtures; no consume Roboflow,
no usa API keys y no modifica el backend ni PostgreSQL. Guarda CSVs y vistas
anotadas en backend/scripts/vision-v2/resultados/rf_detr_v2/diagnostico_local.

Requiere: numpy, pillow, opencv-python (ya están en el entorno KitVisionV2).
"""
from __future__ import annotations

import argparse
import csv
import hashlib
import json
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont

COLOR_GT_RGB = (42, 125, 209)


def pct(n, total):
    return round(100.0 * n / total, 4) if total else 0.0


def ratio(a, b):
    return round(float(a) / float(b), 5) if b else None


def sha(path: Path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_csv(path, rows):
    if not rows:
        return
    with path.open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)


def get_predictions(payload):
    if not isinstance(payload, list) or not payload or not isinstance(payload[0], dict):
        raise ValueError("Formato inesperado del Workflow: respuesta no es lista con predicciones")
    node = payload[0].get("predictions")
    if not isinstance(node, dict) or not isinstance(node.get("predictions"), list):
        raise ValueError("Formato inesperado: falta result[0].predictions.predictions")
    return node["predictions"], node.get("image") or {}


def main():
    ap = argparse.ArgumentParser(description="Validar máscaras de RF-DETR a partir de JSON originales")
    ap.add_argument("--repo", type=Path, default=Path.cwd(), help="Raíz de C:\\BACHE_0\\bache0")
    ap.add_argument("--ids", default="B09,B13,M03,N05", help="IDs de desarrollo separados por coma")
    ap.add_argument("--todos-desarrollo", action="store_true", help="Procesar únicamente las 30 fotos de desarrollo")
    a = ap.parse_args()

    repo = a.repo.resolve()
    kit = repo / "backend" / "scripts" / "vision-v2"
    raw = kit / "resultados" / "rf_detr_v2" / "desarrollo"
    out = kit / "resultados" / "rf_detr_v2" / "diagnostico_local"
    cases = json.loads((kit / "casos_45.json").read_text(encoding="utf-8"))
    cases = {c["id"]: c for c in cases if c["grupo"] == "desarrollo"}
    ids = list(cases) if a.todos_desarrollo else [i.strip().upper() for i in a.ids.split(",") if i.strip()]
    invalid = [i for i in ids if i not in cases]
    if invalid:
        ap.error("Los IDs siguientes no están en desarrollo: " + ", ".join(invalid))
    out.mkdir(parents=True, exist_ok=True)

    res, detail = [], []
    for id_ in ids:
        c = cases[id_]
        orig_json = sorted(raw.glob(f"{id_}_*_original.json"))
        if not orig_json:
            print(f"{id_}: no se encontró *_original.json (no usar *_resumen.json)")
            continue
        src = orig_json[-1]
        image_path = repo / "backend" / c["ruta_imagen"]
        mask_path = repo / "backend" / c["ruta_mascara"]
        for path, expected in [(image_path, c["sha256_imagen"]), (mask_path, c["sha256_mascara"])]:
            if not path.is_file() or sha(path) != expected:
                raise RuntimeError(f"Falta archivo original o SHA-256 incorrecto: {path}")

        photo = Image.open(image_path).convert("RGB")
        gtimg = np.asarray(Image.open(mask_path).convert("RGB"))
        h, w = gtimg.shape[:2]
        if photo.size != (w, h):
            raise RuntimeError(f"{id_}: imagen/máscara con dimensiones diferentes")
        gt = np.all(gtimg == COLOR_GT_RGB, axis=2)
        preds, info = get_predictions(json.loads(src.read_text(encoding="utf-8")))
        source_w = float(info.get("width") or w)
        source_h = float(info.get("height") or h)
        total = w * h

        union_pred = np.zeros((h, w), dtype=np.uint8)
        boxes = []
        warnings = []
        pothole_count = 0
        for idx, p in enumerate(preds, 1):
            if str(p.get("class", "")).lower() != "pothole":
                continue
            pothole_count += 1
            conf = float(p.get("confidence") or 0)
            cx, cy = float(p.get("x") or 0), float(p.get("y") or 0)
            bw, bh = float(p.get("width") or 0), float(p.get("height") or 0)
            x0 = max(0, min(w, int(round((cx - bw/2) * w/source_w))))
            x1 = max(0, min(w, int(round((cx + bw/2) * w/source_w))))
            y0 = max(0, min(h, int(round((cy - bh/2) * h/source_h))))
            y1 = max(0, min(h, int(round((cy + bh/2) * h/source_h))))
            box_gt = int(np.count_nonzero(gt[y0:y1, x0:x1]))
            boxes.append((x0, y0, x1, y1, conf, idx))
            points = p.get("points") or []
            if len(points) >= 3:
                poly = np.array([[int(round(float(v["x"]) * w / source_w)),
                                  int(round(float(v["y"]) * h / source_h))] for v in points], dtype=np.int32)
                poly[:, 0] = np.clip(poly[:, 0], 0, w-1)
                poly[:, 1] = np.clip(poly[:, 1], 0, h-1)
                this = np.zeros((h, w), dtype=np.uint8)
                cv2.fillPoly(this, [poly], 1)
                union_pred |= this
                segpx = int(this.sum())
            else:
                segpx = 0
                warnings.append(f"{id_} detección {idx}: sin polígono")
            bboxpx = max(0, x1-x0) * max(0, y1-y0)
            if len(points) == 100 and bboxpx and segpx/bboxpx < .025:
                warnings.append(f"{id_} detección {idx}: polígono sospechosamente pequeño para su caja (verificar exportación completa)")
            detail.append({"id": id_, "num_deteccion": idx, "confianza": round(conf, 5),
                           "vertice_poligono": len(points), "px_segmentados_instancia": segpx,
                           "porcentaje_instancia": pct(segpx,total), "px_GT_en_caja": box_gt,
                           "area_caja_px": bboxpx,
                           "porcentaje_GT_dentro_caja": pct(box_gt,bboxpx),
                           "bbox_x0": x0, "bbox_y0": y0, "bbox_x1": x1, "bbox_y1": y1})

        p_mask = union_pred.astype(bool)
        tp_px = int(np.count_nonzero(gt & p_mask))
        pred_px = int(np.count_nonzero(p_mask))
        gt_px = int(np.count_nonzero(gt))
        union = gt_px + pred_px - tp_px
        iou = ratio(tp_px, union) if union else None
        res.append({"id": id_, "archivo_original": src.name, "bache_referencia": bool(gt_px),
                    "bache_detectado": bool(pothole_count), "num_detecciones": pothole_count,
                    "area_referencia_px": gt_px, "area_referencia_pct": pct(gt_px, total),
                    "area_predicha_px": pred_px, "area_predicha_pct": pct(pred_px, total),
                    "iou_mascara": iou, "precision_pixel": ratio(tp_px, pred_px),
                    "recall_pixel": ratio(tp_px, gt_px), "advertencias": "; ".join(warnings)})

        # Visualización: azul = GT, naranja = píxeles predichos, amarillo = cajas RF-DETR.
        arr = np.asarray(photo).astype(np.float32).copy()
        arr[gt] = .65 * arr[gt] + .35 * np.array([0, 125, 255])
        arr[p_mask] = .65 * arr[p_mask] + .35 * np.array([255, 105, 0])
        vis = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
        dr = ImageDraw.Draw(vis)
        try:
            font = ImageFont.truetype("arial.ttf", 30)
        except OSError:
            font = ImageFont.load_default()
        for x0,y0,x1,y1,conf,n in boxes:
            dr.rectangle([x0,y0,x1,y1],outline="yellow",width=6)
            dr.text((x0,max(0,y0-32)),f"{n}: {conf:.1%}",fill="yellow",font=font,stroke_width=2,stroke_fill="black")
        vis.save(out / f"{id_}_GT_azul_PRED_naranja_CAJAS_amarillas.jpg", quality=90)
        print(f"{id_}: {pothole_count} detecciones | GT {pct(gt_px,total):.3f}% | "
              f"pred {pct(pred_px,total):.3f}% | IoU {iou if iou is not None else 'N/A'}")
        for warn in warnings:
            print("  AVISO:",warn)
    write_csv(out / "resumen_areas_IoU.csv",res)
    write_csv(out / "detalle_instancias.csv",detail)
    print("\nGuardado en:", out)
    print("Solo se leen JSON originales existentes, sin solicitudes nuevas a Roboflow.")
    print("La superficie es proporción de píxeles de foto, NO metros cuadrados.")

if __name__ == "__main__":
    main()
