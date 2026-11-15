#!/usr/bin/env python3
"""Diagnóstico seguro del nuevo RF-DETR de Bache0 mediante Workflow de Roboflow.

- Usa el conjunto y hashes ya definidos en casos_45.json.
- Por defecto ejecuta solo B09 y G02 (grupo desarrollo).
- NO toca backend, PostgreSQL, motor de prioridad ni los modelos existentes.
- NO utiliza ni guarda claves en el código: ROBOFLOW_API_KEY debe estar en entorno.
- Guarda las respuestas crudas para examinar la estructura del Workflow.
- No calcula métricas sin verificar primero el formato de las predicciones.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
from datetime import datetime, timezone

WORKSPACE = "elass-workspace-ozv3l"
WORKFLOW = (
    "bache0-v2-segmentation-2-rfdetr-seg-small-t1-"
    "vbache0-v2-segmentation-2-rfdetr-seg-small-t1-logic"
)
DIR = Path(__file__).resolve().parent
BACKEND = DIR.parents[1]


def verificar(path, esperado):
    if not path.is_file():
        raise FileNotFoundError(f"Falta archivo: {path}")
    real = hashlib.sha256(path.read_bytes()).hexdigest()
    if real != esperado:
        raise RuntimeError(f"Hash no coincide: {path}")


def limpiar_respuesta(obj, ruta="", max_str=200):
    """Resumen para compartir sin enormes imágenes codificadas."""
    if isinstance(obj, dict):
        return {str(k): limpiar_respuesta(v, f"{ruta}.{k}", max_str)
                for k, v in obj.items()
                if str(k).lower() not in ("api_key", "authorization", "token")}
    if isinstance(obj, list):
        return [limpiar_respuesta(v, ruta, max_str) for v in obj[:100]]
    if isinstance(obj, str) and len(obj) > max_str:
        return f"<texto omitido: {len(obj)} caracteres>"
    return obj


def encontrar_predicciones(obj, ruta="result"):
    """Busca colecciones de detecciones típicas sin presumir nombres de salida del Workflow."""
    encontrados = []
    if isinstance(obj, dict):
        for k, v in obj.items():
            ubicacion = f"{ruta}.{k}"
            if k in ("predictions", "detections") and isinstance(v, list):
                if not v or any(isinstance(x, dict) and
                                ("class" in x or "class_name" in x or "confidence" in x)
                                for x in v):
                    encontrados.append((ubicacion, v))
            encontrados.extend(encontrar_predicciones(v, ubicacion))
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            encontrados.extend(encontrar_predicciones(v, f"{ruta}[{i}]"))
    return encontrados


def main():
    p = argparse.ArgumentParser(description="Diagnóstico RF-DETR V2: B09 y G02 por defecto")
    p.add_argument("--ids", default="B09,G02", help="IDs separados por coma")
    p.add_argument("--grupo", choices=("desarrollo", "reserva"), default="desarrollo")
    p.add_argument("--autorizar-evaluacion-final", action="store_true")
    p.add_argument("--solo-verificar", action="store_true")
    args = p.parse_args()
    if args.grupo == "reserva" and not args.autorizar_evaluacion_final:
        p.error("Las 15 imágenes reservadas no se usan hasta la evaluación final")
    ids = [x.strip() for x in args.ids.split(",") if x.strip()]
    all_cases = json.loads((DIR / "casos_45.json").read_text(encoding="utf-8"))
    cases_by_id = {x["id"]: x for x in all_cases if x["grupo"] == args.grupo}
    if not ids or any(x not in cases_by_id for x in ids):
        p.error(f"IDs inválidos para grupo '{args.grupo}'")
    casos = [cases_by_id[i] for i in ids]
    for c in casos:
        verificar(BACKEND / c["ruta_imagen"], c["sha256_imagen"])
        verificar(BACKEND / c["ruta_mascara"], c["sha256_mascara"])
    print(f"Verificados {len(casos)} archivos originales y sus máscaras (SHA-256 OK)")
    if args.solo_verificar:
        return
    key = os.environ.get("ROBOFLOW_API_KEY", "").strip()
    if not key:
        p.error("Configura ROBOFLOW_API_KEY en esta sesión sin mostrarla ni copiarla al chat")
    try:
        from inference_sdk import InferenceHTTPClient, InferenceConfiguration
    except ImportError:
        p.error("Falta inference-sdk en el entorno virtual")
    client = InferenceHTTPClient(
        api_url="https://serverless.roboflow.com", api_key=key
    ).configure(InferenceConfiguration(api_key_transport="header"))
    output_dir = DIR / "resultados" / "rf_detr_v2" / args.grupo
    output_dir.mkdir(parents=True, exist_ok=True)
    corrida = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    for c in casos:
        img = str(BACKEND / c["ruta_imagen"])
        print(f"{c['id']}: consultando RF-DETR...")
        try:
            resp = client.run_workflow(
                workspace_name=WORKSPACE,
                workflow_id=WORKFLOW,
                images={"image": img},
                use_cache=True,
            )
        except Exception as exc:
            print(f"{c['id']}: ERROR de inferencia: {type(exc).__name__}: {str(exc)[:350]}")
            raise SystemExit(1) from None
        nombre = f"{c['id']}_{corrida}"
        (output_dir / f"{nombre}_original.json").write_text(
            json.dumps(resp, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
        (output_dir / f"{nombre}_resumen.json").write_text(
            json.dumps(limpiar_respuesta(resp), ensure_ascii=False, indent=2, default=str), encoding="utf-8")
        encontrados = encontrar_predicciones(resp)
        print(f"{c['id']}: respuesta guardada. Colecciones de detecciones: {len(encontrados)}")
        for ruta, preds in encontrados:
            clases = {}
            for det in preds:
                if not isinstance(det, dict):
                    continue
                cls = det.get("class") or det.get("class_name") or "sin_clase"
                clases[str(cls)] = clases.get(str(cls), 0) + 1
            print(f"  {ruta}: {len(preds)} detecciones; clases={clases}")
        if not encontrados:
            print("  AVISO: respuesta con esquema no reconocido; no se asignan TP/FP/FN/TN todavía")
    print("Resultados guardados en:", output_dir)
    print("Comparte solo los archivos *_resumen.json, tras comprobar que no incluyan secretos.")


if __name__ == "__main__":
    main()
