#!/usr/bin/env python3
"""Adaptador experimental de inferencia. Solo invocar desde backend con opt-in.

Imprime SOLO un objeto JSON de resultado. No lee/escribe BD ni modifica
prioridad. La API key debe estar en el entorno, nunca en argumentos/archivos.
"""
import json
import os
from pathlib import Path
import sys
from PIL import Image
from vision_v2_core import caracteristicas

WORKSPACE = 'elass-workspace-ozv3l'
WORKFLOW = ('bache0-v2-segmentation-2-rfdetr-seg-small-t1-'
            'vbache0-v2-segmentation-2-rfdetr-seg-small-t1-logic')


def main():
    if len(sys.argv) != 2:
        raise ValueError('Se requiere exactamente una ruta local de imagen')
    path = Path(sys.argv[1])
    if not path.is_file() or path.stat().st_size > 15_000_000:
        raise ValueError('Imagen ausente o tamaño excesivo')
    with Image.open(path) as im:
        w, h = im.size
        if im.format not in ('JPEG', 'PNG', 'WEBP') or w*h > 50_000_000:
            raise ValueError('Formato o dimensiones no permitidas')
    key = os.environ.get('ROBOFLOW_API_KEY', '').strip()
    if not key:
        raise RuntimeError('ROBOFLOW_API_KEY no configurada')
    from inference_sdk import InferenceHTTPClient, InferenceConfiguration
    transport = os.environ.get('ROBOFLOW_API_TRANSPORT', 'header').strip().lower()
    if transport not in {'header', 'both', 'legacy'}:
        raise ValueError('ROBOFLOW_API_TRANSPORT inválido')
    client = InferenceHTTPClient(api_url='https://serverless.roboflow.com', api_key=key).configure(
        InferenceConfiguration(api_key_transport=transport))
    raw = client.run_workflow(workspace_name=WORKSPACE, workflow_id=WORKFLOW,
                              images={'image': str(path)}, use_cache=True)
    features = caracteristicas(raw, w, h)
    features.update({'modelo': 'bache0-v2-segmentation-2-rfdetr-seg-small-t1',
                     'proveedor': 'Roboflow-RFDETR-V2',
                     'version_modelo': 'v2-RFDETR-small',
                     'confianza': features['confianza_maxima']})
    print(json.dumps({'ok': True, 'analisis': features}, ensure_ascii=True, separators=(',', ':')))

if __name__ == '__main__':
    try:
        main()
    except Exception as ex:
        # No volcar detalles de errores HTTP, que podrían incluir credenciales.
        print(json.dumps({'ok': False, 'error_code': 'VISION_V2_ERROR',
                          'mensaje': 'Inferencia V2 no disponible (' + type(ex).__name__ + ')'}))
        sys.exit(1)
