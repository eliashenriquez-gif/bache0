#!/usr/bin/env python3
"""Evaluación reproducible RF-DETR Bache0 V2 (solo inferencia, sin reentrenar).

Ejemplos:
  python evaluacion_rf_detr_v2.py --grupo desarrollo    # reusa JSON si existen
  python evaluacion_rf_detr_v2.py --grupo reserva --evaluacion-final

La reserva se evalúa UNA vez, con modelo/workflow/umbral congelados.
NO cambia Postgres, priorityService, pesos, ni código de producción.
"""
from __future__ import annotations

import argparse
import csv
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import sys

import numpy as np
from PIL import Image
from vision_v2_core import evaluar_imagen, metricas_fotos, UMBRAL_FIJO

WORKSPACE = "elass-workspace-ozv3l"
WORKFLOW = ("bache0-v2-segmentation-2-rfdetr-seg-small-t1-"
            "vbache0-v2-segmentation-2-rfdetr-seg-small-t1-logic")
SCRIPT = Path(__file__).resolve().parent
BACKEND = SCRIPT.parents[1]


def sha(path):
    hh = hashlib.sha256()
    with path.open('rb') as f:
        for b in iter(lambda: f.read(1 << 20), b''):
            hh.update(b)
    return hh.hexdigest()


def limpiar_secretos(obj):
    if isinstance(obj, dict):
        return {k: limpiar_secretos(v) for k, v in obj.items()
                if str(k).lower() not in {'api_key', 'apikey', 'authorization', 'token', 'secret'}}
    if isinstance(obj, list):
        return [limpiar_secretos(v) for v in obj]
    return obj




def diagnostico_http_sin_secretos(exc):
    """Información diagnóstica segura: solo clase HTTP y código numérico.

    La respuesta HTTP y el mensaje de excepción NO se imprimen: podrían
    contener credenciales o información privada del workspace.
    """
    code = getattr(exc, 'status_code', None)
    if code is None:
        code = getattr(getattr(exc, 'response', None), 'status_code', None)
    if code is None:
        code = getattr(exc, 'status', None)
    if code is None:
        cause = getattr(exc, '__cause__', None)
        code = getattr(getattr(cause, 'response', None), 'status_code', None)
    try:
        code = int(code) if code is not None else None
    except (ValueError, TypeError):
        code = None
    hints = {
        400: 'Solicitud rechazada (formato de imagen o parámetros del Workflow).',
        401: 'Autenticación no aceptada. Revisar clave en el workspace, sin compartirla.',
        402: 'Límite de créditos o facturación de Roboflow. Revisar Usage/Billing.',
        403: 'Acceso denegado. Revisar permisos del modelo/workspace y sus límites.',
        404: 'Workflow o endpoint no encontrado. Revisar identificador del deployment.',
        408: 'Tiempo de espera del servidor. No reintentar masivamente.',
        413: 'Imagen demasiado grande para el endpoint.',
        422: 'El servidor rechazó los datos de entrada.',
        423: 'Uso de la API pausado por el proveedor.',
        429: 'Límite de solicitudes (rate limit).',
        500: 'Error interno en Roboflow; podría ser transitorio.',
        502: 'Error temporal de gateway de Roboflow.',
        503: 'Servicio de Roboflow no disponible temporalmente.',
        504: 'Tiempo agotado en Roboflow.',
    }
    return {
        'clase': type(exc).__name__,
        'http': code,
        'diagnostico': hints.get(code, 'Fallo HTTP sin causa determinada.' if code else 'No se pudo recuperar código HTTP; posible error de red o SDK.'),
    }

def casos_y_archivos(grupo):
    manifest = SCRIPT / 'casos_45.json'
    cases = json.loads(manifest.read_text(encoding='utf-8'))
    selected = [c for c in cases if c['grupo'] == grupo]
    if len(selected) != (15 if grupo == 'reserva' else 30):
        raise ValueError('Manifiesto inesperado; no ejecutar')
    for c in selected:
        for kpath, khash in [('ruta_imagen', 'sha256_imagen'), ('ruta_mascara', 'sha256_mascara')]:
            path = BACKEND / c[kpath]
            if not path.is_file() or sha(path) != c[khash]:
                raise ValueError(f"Archivo o hash incorrecto: {c['id']} ({kpath})")
    return selected, sha(manifest)


def cliente():
    key = os.environ.get('ROBOFLOW_API_KEY', '').strip()
    if not key:
        raise RuntimeError('Falta ROBOFLOW_API_KEY: configurar localmente, nunca poner la clave en chat o código')
    from inference_sdk import InferenceHTTPClient, InferenceConfiguration
    return InferenceHTTPClient(
        api_url='https://serverless.roboflow.com', api_key=key,
    ).configure(InferenceConfiguration(api_key_transport=os.environ.get('ROBOFLOW_API_TRANSPORT', 'header')))


def tabla_csv(path, rows):
    with path.open('w', encoding='utf-8-sig', newline='') as f:
        if rows:
            writer = csv.DictWriter(f, fieldnames=list(rows[0]))
            writer.writeheader()
            writer.writerows(rows)


def guardar_reporte(casos, filas, out, manifest_hash, grupo):
    m = metricas_fotos(filas)
    m['modelo'] = 'Bache0 RF-DETR Small V2'
    m['workflow'] = WORKFLOW
    m['workspace'] = WORKSPACE
    m['umbral_prediccion'] = UMBRAL_FIJO
    m['grupo'] = grupo
    m['sha256_manifiesto'] = manifest_hash
    m['evaluado_at'] = datetime.now(timezone.utc).isoformat()
    m['advertencia'] = ('No medir metros cuadrados ni profundidad; IoU de imagen no prueba conteo de instancias. '
                        'La reserva contiene tomas temporalmente próximas a otras del dataset: '
                        'no garantiza generalización a nuevas ciudades.')
    out.mkdir(parents=True, exist_ok=True)
    tabla_csv(out / 'resultados_fotografia.csv', filas)
    (out / 'metricas.json').write_text(json.dumps(m, indent=2, ensure_ascii=False), encoding='utf-8')
    problem = [f"{r['id']} (FP/FN foto o IoU bajo: {r['iou']})" for r in filas
               if r['FP'] or r['FN'] or (r['gt_bache'] and r['iou'] is not None and r['iou'] < .5)]
    doc = f'''# Bache0 Vision V2 — Evaluación {grupo}

Modelo: **RF-DETR Small**, versión ya entrenada, Workflow `{WORKFLOW}`.

- Imágenes evaluadas: **{m['total']}**
- TP/FP/TN/FN por **fotografía**: {m['TP']}/{m['FP']}/{m['TN']}/{m['FN']}
- Precisión por foto: {m['precision_foto']}
- Recall por foto: {m['recall_foto']}
- F1 por foto: {m['f1_foto']}
- Exactitud por foto: {m['exactitud_foto']}
- IoU micro de píxeles: {m['iou_micro_pixeles']}
- IoU medio de fotos positivas: {m['iou_promedio_fotos_positivas']}
- Instancias TP/FP/FN con IoU ≥ 0,5: {m['tp_inst']}/{m['fp_inst']}/{m['fn_inst']}
- Umbral congelado: {UMBRAL_FIJO}; sin ajuste en reserva.

Casos para revisión: {', '.join(problem) if problem else 'ninguno según estos criterios'}.

**Limitaciones:** el porcentaje visual depende del encuadre y no equivale a metros cuadrados, diámetro ni profundidad. La clase `Pothole` no clasifica grietas. La coincidencia por instancia se compara con componentes conectados de la máscara GT y depende de las anotaciones disponibles. Sin evaluación externa de calles chilenas no se puede garantizar generalización.

**Integración de prioridad:** este ensayo NO asigna puntos por área; se mantiene severidad sugerida `null`.
'''
    (out / 'INFORME_EVALUACION.md').write_text(doc, encoding='utf-8')
    return m


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--grupo', choices=['desarrollo', 'reserva'], default='desarrollo')
    parser.add_argument('--evaluacion-final', action='store_true', help='Autoriza evaluar UNA SOLA VEZ la reserva de 15; sin ajustes')
    parser.add_argument('--solo-verificar', action='store_true')
    parser.add_argument('--forzar-consultas', action='store_true', help='Solo desarrollo; reconsulta y podría consumir créditos')
    a = parser.parse_args(argv)
    if a.grupo == 'reserva' and not a.evaluacion_final and not a.solo_verificar:
        parser.error('Para probar la reserva se requiere --evaluacion-final; resultados no deben usarse para ajustar parámetros')
    if a.grupo == 'reserva' and a.forzar_consultas:
        parser.error('No se permite forzar consultas de la reserva')
    cases, manifest_hash = casos_y_archivos(a.grupo)
    print(f"{len(cases)} imágenes ({a.grupo}), SHA-256 verificados")
    if a.solo_verificar:
        return 0
    out = SCRIPT / 'resultados' / 'rf_detr_v2' / a.grupo
    out.mkdir(parents=True, exist_ok=True)
    if a.grupo == 'reserva' and (out / 'metricas.json').exists():
        print('La evaluación final ya fue guardada. No se repite ni ajusta.'); return 0
    rows = []
    client = None
    for c in cases:
        ident = c['id']
        candidates = sorted(out.glob(f'{ident}_*_original.json'))
        existing = candidates[-1] if candidates and not a.forzar_consultas else None
        if existing is not None:
            payload = json.loads(existing.read_text(encoding='utf-8'))
            print(f'{ident}: respuesta local reutilizada')
        else:
            if client is None:
                client = cliente()
            try:
                payload = client.run_workflow(workspace_name=WORKSPACE, workflow_id=WORKFLOW,
                                              images={'image': str(BACKEND / c['ruta_imagen'])}, use_cache=True)
            except Exception as exc:
                info = diagnostico_http_sin_secretos(exc)
                print(f"{ident}: fallo HTTP={info['http'] if info['http'] is not None else 'desconocido'} ({info['clase']}). {info['diagnostico']}", file=sys.stderr)
                # Nunca guardar ni volcar respuesta HTTP, body o exception str.
                (out / 'ULTIMO_ERROR_SIN_SECRETOS.json').write_text(
                    json.dumps({'id': ident, **info}, ensure_ascii=False, indent=2),
                    encoding='utf-8',
                )
                print('Prueba detenida tras un fallo, sin repetir las solicitudes anteriores.', file=sys.stderr)
                return 2
            payload = limpiar_secretos(payload)
            stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
            rawfile = out / f'{ident}_{stamp}_original.json'
            rawfile.write_text(json.dumps(payload, ensure_ascii=False), encoding='utf-8')
            print(f'{ident}: inferencia guardada')
        mask = np.array(Image.open(BACKEND / c['ruta_mascara']).convert('RGB'))
        row = {'id': ident, 'grupo': a.grupo, **evaluar_imagen(payload, mask)}
        rows.append(row)
    metricas = guardar_reporte(cases, rows, out, manifest_hash, a.grupo)
    print(json.dumps(metricas, indent=2, ensure_ascii=False))
    print('Guardado:', out)
    return 0


if __name__ == '__main__':
    try:
        sys.exit(main())
    except Exception as e:
        # No volcamos mensajes de SDK/HTTP completos por riesgo de exposición de credenciales.
        print(f'Error de evaluación: {type(e).__name__} — {str(e)[:150] if not isinstance(e, RuntimeError) else "Revisar credenciales locales"}', file=sys.stderr)
        sys.exit(1)
