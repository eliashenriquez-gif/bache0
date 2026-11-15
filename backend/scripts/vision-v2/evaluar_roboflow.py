#!/usr/bin/env python3
"""Evaluación experimental de dos modelos publicados de segmentación.

Solo fotografías públicas ya incluidas en backend/fixtures/demo-vision-45.
No se comunica con PostgreSQL, ni con la API ciudadana, ni cambia la IA de Bastián.
REQUIERE acceso permitido a los dos modelos desde la cuenta de Roboflow.
"""
import argparse
import csv
import hashlib
import json
import os
from pathlib import Path
import time
from datetime import datetime, timezone

DIR = Path(__file__).resolve().parent
BACKEND = DIR.parents[1]
MODELOS = {
    "UAG_YOLO11": "road-damage-tmjyb/4",
    "MAJOR_POTHOLE": "pothole-bwzav/2",
}
COLOR_BACHE = (42, 125, 209)  # Color original de la máscara PavementDamagesG-7.


def validar_archivo(ruta, hash_esperado):
    if not ruta.is_file():
        raise FileNotFoundError(f"Archivo ausente: {ruta}")
    real = hashlib.sha256(ruta.read_bytes()).hexdigest()
    if real != hash_esperado:
        raise ValueError(f"SHA-256 distinto en: {ruta}")


def resultado_pothole(resp, gt_mascara, umbral):
    import numpy as np
    from PIL import Image, ImageDraw

    alto, ancho = gt_mascara.shape[:2]
    pred = Image.new("1", (ancho, alto), color=0)
    draw = ImageDraw.Draw(pred)
    origen = resp.get("image", {}) or {}
    ori_ancho = float(origen.get("width") or ancho)
    ori_alto = float(origen.get("height") or alto)
    confianzas = []
    instancias_con_mascara = 0
    for obj in resp.get("predictions", []):
        etiqueta = str(obj.get("class", "")).lower().strip().replace("_", "-")
        if etiqueta != "pothole":
            continue  # Not-Pothole y grietas NO cuentan como baches.
        confianza = float(obj.get("confidence", 0) or 0)
        if confianza < umbral:
            continue
        confianzas.append(confianza)
        puntos = obj.get("points") or []
        if len(puntos) >= 3:
            try:
                poligono = [(round(float(p["x"]) * ancho / ori_ancho),
                             round(float(p["y"]) * alto / ori_alto)) for p in puntos]
                draw.polygon(poligono, fill=1)
                instancias_con_mascara += 1
            except (KeyError, TypeError, ValueError):
                pass

    p = np.asarray(pred, dtype=bool)
    gt = np.all(gt_mascara == np.asarray(COLOR_BACHE, dtype=np.uint8), axis=2)
    tp = int(np.count_nonzero(gt & p))
    fp = int(np.count_nonzero(~gt & p))
    fn = int(np.count_nonzero(gt & ~p))
    union = tp + fp + fn
    return {
        "bache_predicho": len(confianzas) > 0,
        "confianza_max_bache": round(max(confianzas), 5) if confianzas else None,
        "instancias_bache": len(confianzas),
        "instancias_con_mascara": instancias_con_mascara,
        "area_gt_pct": round(float(gt.mean()) * 100, 4),
        "area_predicha_pct": round(float(p.mean()) * 100, 4),
        "iou_bache": round(tp / union, 5) if union else None,
        "gt_px": int(gt.sum()), "pred_px": int(p.sum()),
        "TP_px": tp, "FP_px": fp, "FN_px": fn,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--grupo", choices=["desarrollo", "reserva"], default="desarrollo")
    parser.add_argument("--autorizar-evaluacion-final", action="store_true")
    parser.add_argument("--modelo", choices=["ambos", *MODELOS], default="ambos")
    parser.add_argument("--ids", help="IDs separados por coma, p.ej. A01,G02,N01,B09,B13,B16")
    parser.add_argument("--limite", type=int)
    parser.add_argument("--umbral", type=float, default=0.25)
    parser.add_argument("--solo-verificar", action="store_true", help="No ejecuta inferencia ni llama a Roboflow")
    args = parser.parse_args()
    if args.limite is not None and args.limite < 1:
        parser.error("--limite debe ser positivo")
    if not 0 <= args.umbral <= 1:
        parser.error("--umbral debe estar entre 0 y 1")
    if args.grupo == "reserva" and not (args.solo_verificar or args.autorizar_evaluacion_final):
        parser.error("Reserva protegida: al terminar ajustes usar --autorizar-evaluacion-final")
    casos = json.loads((DIR / "casos_45.json").read_text(encoding="utf-8"))
    casos = [c for c in casos if c["grupo"] == args.grupo]
    if args.ids:
        ids = {i.strip() for i in args.ids.split(",") if i.strip()}
        casos = [c for c in casos if c["id"] in ids]
        if len(casos) != len(ids):
            parser.error("Hay IDs no encontrados en el grupo")
    if args.limite:
        casos = casos[:args.limite]
    print(f"Grupo {args.grupo}: {len(casos)} fotografías")
    for c in casos:
        validar_archivo(BACKEND / c["ruta_imagen"], c["sha256_imagen"])
        validar_archivo(BACKEND / c["ruta_mascara"], c["sha256_mascara"])
    print("Hashes originales verificados.")
    if args.solo_verificar:
        return
    api_key = os.getenv("ROBOFLOW_API_KEY")
    if not api_key:
        parser.error("Falta ROBOFLOW_API_KEY en el entorno local. No pegar claves en el chat o Git.")
    try:
        from inference_sdk import InferenceHTTPClient, InferenceConfiguration
        import numpy as np
        from PIL import Image
    except ImportError as exc:
        parser.error(f"Dependencia ausente: {exc}. Instala: py -m pip install inference-sdk pillow numpy")
    cliente = InferenceHTTPClient(api_url="https://serverless.roboflow.com", api_key=api_key).configure(
        InferenceConfiguration(api_key_transport="header"))
    modelos = MODELOS if args.modelo == "ambos" else {args.modelo: MODELOS[args.modelo]}
    out = DIR / "resultados" / "roboflow" / args.grupo
    out.mkdir(parents=True, exist_ok=True)
    corrida = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    filas = []
    for nombre, modelo_id in modelos.items():
        carpeta = out / "predicciones_crudas" / nombre
        carpeta.mkdir(parents=True, exist_ok=True)
        for c in casos:
            inicio = time.perf_counter()
            fila = {"id": c["id"], "grupo": c["grupo"], "modelo": nombre,
                    "modelo_id": modelo_id, "bache_real": c["bache_anotado"],
                    "estado": "ERROR", "bache_predicho": None, "confianza_max_bache": None,
                    "instancias_bache": None, "instancias_con_mascara": None,
                    "area_gt_pct": c["pct_bache"], "area_predicha_pct": None, "iou_bache": None,
                    "TP_px": None, "FP_px": None, "FN_px": None,
                    "latencia_ms": None, "error": ""}
            try:
                ruta = BACKEND / c["ruta_imagen"]
                resp = cliente.infer(str(ruta), model_id=modelo_id)
                latencia = round((time.perf_counter() - inicio) * 1000)
                (carpeta / f"{c['id']}_{corrida}.json").write_text(json.dumps(resp, indent=2), encoding="utf-8")
                with Image.open(BACKEND / c["ruta_mascara"]) as im:
                    gt = np.asarray(im.convert("RGB"), dtype=np.uint8)
                medidas = resultado_pothole(resp, gt, args.umbral)
                fila.update(medidas)
                fila.update({"estado": "OK", "latencia_ms": latencia})
            except Exception as exc:
                fila["error"] = f"{type(exc).__name__}: {str(exc)[:300]}"
            filas.append(fila)
            print(f"{nombre}: {c['id']} -> {fila['estado']}", flush=True)
    if filas:
        columnas = list(filas[0].keys())
        with (out / f"inferencias_{corrida}.csv").open("w", newline="", encoding="utf-8-sig") as f:
            w = csv.DictWriter(f, fieldnames=columnas, extrasaction="ignore")
            w.writeheader()
            w.writerows(filas)
        for nombre in modelos:
            datos = [f for f in filas if f["modelo"] == nombre and f["estado"] == "OK"]
            tp = sum(bool(f["bache_real"]) and bool(f["bache_predicho"]) for f in datos)
            fp = sum(not f["bache_real"] and bool(f["bache_predicho"]) for f in datos)
            tn = sum(not f["bache_real"] and not f["bache_predicho"] for f in datos)
            fn = sum(bool(f["bache_real"]) and not f["bache_predicho"] for f in datos)
            print(f"{nombre}: {len(datos)} OK de {len(casos)}; TP={tp}, FP={fp}, TN={tn}, FN={fn}")
        print("Resultados en:", out)
    if any(f["estado"] != "OK" for f in filas):
        raise SystemExit("Hubo errores; ver columna error en CSV. No sacar conclusiones con datos incompletos.")

if __name__ == "__main__":
    main()
