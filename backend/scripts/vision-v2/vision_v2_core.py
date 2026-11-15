"""Bache0 V2: análisis de máscaras RF-DETR, separado de toda regla municipal.

Trabaja con la respuesta ORIGINAL del Workflow (nunca con *_resumen truncados).
No presupone que un porcentaje de imagen corresponda a un área física.
"""
from __future__ import annotations

import math
import numpy as np
import cv2

GT_RGB = (42, 125, 209)
UMBRAL_FIJO = 0.40


class RespuestaInvalida(ValueError):
    pass


def _numero(value, nombre):
    try:
        result = float(value)
    except (TypeError, ValueError):
        raise RespuestaInvalida(f"{nombre}: no es numérico") from None
    if not math.isfinite(result):
        raise RespuestaInvalida(f"{nombre}: no es finito")
    return result


def extraer(prediction, ancho, alto):
    """Extrae máscaras binarizadas y rectángulos en coordenadas ORIGINALES."""
    if not isinstance(prediction, list) or len(prediction) != 1 or not isinstance(prediction[0], dict):
        raise RespuestaInvalida("Workflow: formato de respuesta no reconocido")
    block = prediction[0].get("predictions")
    if not isinstance(block, dict) or not isinstance(block.get("predictions"), list):
        raise RespuestaInvalida("Workflow: falta predictions.predictions")
    info = block.get("image")
    if not isinstance(info, dict):
        raise RespuestaInvalida("Workflow: faltan dimensiones de imagen")
    rw = _numero(info.get("width"), "image.width")
    rh = _numero(info.get("height"), "image.height")
    if rw <= 0 or rh <= 0 or ancho <= 0 or alto <= 0 or ancho * alto > 50_000_000:
        raise RespuestaInvalida("Dimensiones fuera de rango")
    sx, sy = ancho / rw, alto / rh
    resultado = []
    for i, p in enumerate(block["predictions"], start=1):
        if not isinstance(p, dict) or str(p.get("class", "")).strip().casefold() != "pothole":
            continue
        conf = _numero(p.get("confidence"), f"confianza {i}")
        if not 0 <= conf <= 1:
            raise RespuestaInvalida(f"confianza {i}: fuera de rango")
        if conf < UMBRAL_FIJO:
            continue
        points = p.get("points")
        if not isinstance(points, list) or len(points) < 3:
            raise RespuestaInvalida(f"detección {i}: máscara de segmentación ausente")
        if len(points) > 50000:
            raise RespuestaInvalida(f"detección {i}: polígono demasiado grande")
        pts = np.array([[_numero(q["x"], "x") * sx, _numero(q["y"], "y") * sy]
                        for q in points], dtype=np.float64)
        pts[:, 0] = np.clip(pts[:, 0], 0, ancho - 1)
        pts[:, 1] = np.clip(pts[:, 1], 0, alto - 1)
        poly = np.rint(pts).astype(np.int32)
        mask = np.zeros((alto, ancho), dtype=np.uint8)
        cv2.fillPoly(mask, [poly], color=1)
        count = int(np.count_nonzero(mask))
        if count == 0:
            raise RespuestaInvalida(f"detección {i}: polígono sin área")
        coords = {k: _numero(p.get(k), f"detección {i}.{k}") for k in ("x", "y", "width", "height")}
        if coords["width"] <= 0 or coords["height"] <= 0:
            raise RespuestaInvalida("Rectángulo sin área")
        x0 = min(ancho, max(0, round((coords["x"] - coords["width"] / 2) * sx)))
        y0 = min(alto, max(0, round((coords["y"] - coords["height"] / 2) * sy)))
        x1 = min(ancho, max(0, round((coords["x"] + coords["width"] / 2) * sx)))
        y1 = min(alto, max(0, round((coords["y"] + coords["height"] / 2) * sy)))
        resultado.append({"indice": i, "confianza": conf, "mascara": mask,
                          "area_pixeles": count, "bbox": [x0, y0, x1, y1]})
    if len(resultado) > 100:
        raise RespuestaInvalida("Demasiadas detecciones")
    return resultado


def mascara_union(detecciones, ancho, alto):
    union = np.zeros((alto, ancho), np.uint8)
    for d in detecciones:
        union |= d["mascara"]
    return union


def caracteristicas(prediction, ancho, alto):
    dets = extraer(prediction, ancho, alto)
    union = mascara_union(dets, ancho, alto)
    denom = ancho * alto
    return {
        "tipo_desperfecto": "bache" if dets else "ninguno",
        "confianza_maxima": round(max((d["confianza"] for d in dets), default=0), 6),
        "baches_candidatos": len(dets),
        "area_visual_pct_union": round(float(union.sum()) / denom * 100, 5),
        "area_visual_pixeles_union": int(union.sum()),
        "ancho_imagen": ancho,
        "alto_imagen": alto,
        "detecciones": [{"etiqueta": "bache", "confianza": round(d["confianza"], 6),
                         "area_visual_pct": round(d["area_pixeles"] / denom * 100, 5),
                         "area_pixeles": d["area_pixeles"], "caja": {
                             "x_min": d["bbox"][0], "y_min": d["bbox"][1],
                             "x_max": d["bbox"][2], "y_max": d["bbox"][3]},
                         "severidad_sugerida": None} for d in dets],
        "severidad_sugerida": None,
        "profundidad_cm": None,
        "area_m2": None,
        "puntos_ia": 0,
        "revision_municipal": True,
        "motivo": "Medición visual de encuadre, no escala física; ninguna prioridad automática por superficie.",
    }


def evaluar_instancias(dets, mascara_gt, minimo_iou=0.5):
    """Emparejamiento 1 a 1 por IoU; la referencia se divide por componentes conectados."""
    gt_bin = (mascara_gt > 0).astype(np.uint8)
    n, labels = cv2.connectedComponents(gt_bin, connectivity=8)
    gts = [(labels == k) for k in range(1, n)]
    combos = []
    for pi, p in enumerate(dets):
        pm = p["mascara"].astype(bool)
        for gi, gm in enumerate(gts):
            inter = int(np.count_nonzero(pm & gm))
            union = int(np.count_nonzero(pm | gm))
            combos.append((inter / union if union else 0.0, pi, gi))
    used_p, used_g = set(), set()
    pairs = []
    for score, pi, gi in sorted(combos, reverse=True):
        if score < minimo_iou:
            break
        if pi in used_p or gi in used_g:
            continue
        used_p.add(pi); used_g.add(gi)
        pairs.append((pi + 1, gi + 1, round(score, 5)))
    return {"tp_inst": len(pairs), "fp_inst": len(dets) - len(pairs),
            "fn_inst": len(gts) - len(pairs), "instancias_gt": len(gts),
            "instancias_pred": len(dets), "pares": pairs}


def evaluar_imagen(payload, gt_rgb, *, ancho=None, alto=None):
    h, w = gt_rgb.shape[:2]
    if ancho and ancho != w or alto and alto != h:
        raise ValueError("Dimensión GT no coincide")
    if gt_rgb.ndim != 3 or gt_rgb.shape[2] != 3:
        raise ValueError("Se requiere máscara RGB")
    mask_gt = np.all(gt_rgb == np.asarray(GT_RGB), axis=2)
    dets = extraer(payload, w, h)
    mpred = mascara_union(dets, w, h).astype(bool)
    n_gt = int(np.count_nonzero(mask_gt))
    n_pred = int(np.count_nonzero(mpred))
    overlap = int(np.count_nonzero(mask_gt & mpred))
    u = n_gt + n_pred - overlap
    bin_gt = bool(n_gt); bin_pred = bool(dets)
    return {
        "gt_bache": bin_gt, "pred_bache": bin_pred,
        "TP": int(bin_gt and bin_pred), "FP": int(not bin_gt and bin_pred),
        "TN": int(not bin_gt and not bin_pred), "FN": int(bin_gt and not bin_pred),
        "area_gt_pct": round(n_gt / (w*h) * 100, 5),
        "area_pred_pct": round(n_pred / (w*h) * 100, 5),
        "iou": round(overlap / u, 5) if u else None,
        "pixeles_gt": n_gt, "pixeles_pred": n_pred, "interseccion_pixeles": overlap,
        "union_pixeles": u, "confianza_max": round(max((d["confianza"] for d in dets), default=0), 6),
        **evaluar_instancias(dets, mask_gt.astype(np.uint8)),
    }


def metricas_fotos(rows):
    counts = {k: sum(int(r[k]) for r in rows) for k in ("TP", "FP", "TN", "FN")}
    tp, fp, tn, fn = [counts[k] for k in ("TP", "FP", "TN", "FN")]
    p = tp / (tp + fp) if tp + fp else None
    r = tp / (tp + fn) if tp + fn else None
    f1 = (2*p*r / (p+r)) if p is not None and r is not None and p+r else 0.0 if p is not None and r is not None else None
    union = sum(r["union_pixeles"] for r in rows)
    inter = sum(r["interseccion_pixeles"] for r in rows)
    positivos = [r["iou"] for r in rows if r["gt_bache"]]
    return {
        "total": len(rows), **counts,
        "precision_foto": p, "recall_foto": r, "f1_foto": f1,
        "exactitud_foto": (tp + tn) / len(rows) if rows else None,
        "iou_micro_pixeles": inter / union if union else None,
        "iou_promedio_fotos_positivas": sum(positivos)/len(positivos) if positivos else None,
        "tp_inst": sum(r["tp_inst"] for r in rows),
        "fp_inst": sum(r["fp_inst"] for r in rows),
        "fn_inst": sum(r["fn_inst"] for r in rows),
    }
