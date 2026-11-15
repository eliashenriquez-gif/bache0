#!/usr/bin/env python3
"""Evaluación *una vez* de 30 escenas adicionales no usadas para entrenar.

Requiere Bache0_V2_Holdout_Adicional_NoEntrenado.zip en ruta indicada.
No escribe en el proyecto salvo `resultados/` (ignorados por Git).
"""
import argparse
import csv
from datetime import datetime,timezone
import hashlib
import io
import json
import os
from pathlib import Path
import sys
import tempfile
import zipfile
import numpy as np
from PIL import Image
from vision_v2_core import evaluar_imagen,metricas_fotos,UMBRAL_FIJO
from evaluacion_rf_detr_v2 import cliente, limpiar_secretos, WORKSPACE, WORKFLOW, diagnostico_http_sin_secretos
SCRIPT=Path(__file__).resolve().parent


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--zip',type=Path,required=True)
    p.add_argument('--evaluacion-final',action='store_true')
    p.add_argument('--solo-verificar',action='store_true')
    a=p.parse_args()
    if not a.zip.is_file():p.error('No existe el dataset externo')
    if not (a.evaluacion_final or a.solo_verificar):p.error('Se requiere --evaluacion-final')
    dest=SCRIPT/'resultados'/'rf_detr_v2'/'externo30'
    if (dest/'metricas.json').exists() and not a.solo_verificar:
        print('Evaluación externa ya finalizada. No se repite.');return 0
    with zipfile.ZipFile(a.zip) as z:
        items=list(csv.DictReader(io.StringIO(z.read('manifiesto.csv').decode('utf-8-sig'))))
        if len(items)!=30 or sum(r['bache_anotado'].lower()=='true' for r in items)!=15:
            raise ValueError('Manifiesto externo inesperado')
        for r in items:
            for name,key in [('imagenes/'+r['imagen'],'sha256_imagen'),('mascaras/'+r['mascara'],'sha256_mascara')]:
                if hashlib.sha256(z.read(name)).hexdigest()!=r[key]:raise ValueError('Hash inválido '+r['id'])
        print('30 fotografías externas verificadas, sin inferir')
        if a.solo_verificar:return 0
        dest.mkdir(parents=True,exist_ok=True)
        cl=None
        rows=[]
        for r in items:
            id_=r['id']
            found=dest/f'{id_}_original.json'
            if found.exists():
                raw=json.loads(found.read_text(encoding='utf-8'))
            else:
                if cl is None:cl=cliente()
                # Roboflow SDK admite ruta local; usar tempfile y limpiar tras inferencia.
                with tempfile.TemporaryDirectory(prefix='bache0_rfdet_') as tmp:
                    local=Path(tmp)/r['imagen']
                    local.write_bytes(z.read('imagenes/'+r['imagen']))
                    try:
                        raw=cl.run_workflow(workspace_name=WORKSPACE,workflow_id=WORKFLOW,
                                             images={'image':str(local)},use_cache=True)
                    except Exception as e:
                        info=diagnostico_http_sin_secretos(e)
                        print(f"{id_}: HTTP={info['http'] if info['http'] is not None else 'desconocido'} ({info['clase']}). {info['diagnostico']}",file=sys.stderr)
                        (dest/'ULTIMO_ERROR_SIN_SECRETOS.json').write_text(
                            json.dumps({'id':id_, **info},ensure_ascii=False,indent=2),encoding='utf-8')
                        return 2
                raw=limpiar_secretos(raw)
                found.write_text(json.dumps(raw,ensure_ascii=False),encoding='utf-8')
            mask=np.array(Image.open(io.BytesIO(z.read('mascaras/'+r['mascara']))).convert('RGB'))
            rows.append({'id':id_,'imagen_original':r['imagen'], **evaluar_imagen(raw,mask)})
            print(f'{id_}: analizada')
        mt=metricas_fotos(rows)
        mt.update({'grupo':'externo30','modelo':'Bache0 RF-DETR V2 Small','workflow':WORKFLOW,
                   'umbral_fijo':UMBRAL_FIJO,'fecha':datetime.now(timezone.utc).isoformat(),
                   'nota':'Escenas adicionales de PavementDamagesG-7; selección de negativos y positivos 15/15. NO equivale a validación en Chile.'})
        with (dest/'resultados_fotografia.csv').open('w',encoding='utf-8-sig',newline='') as f:
            w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
        (dest/'metricas.json').write_text(json.dumps(mt,ensure_ascii=False,indent=2),encoding='utf-8')
        print(json.dumps(mt,ensure_ascii=False,indent=2))
    return 0

if __name__=='__main__':
    try:sys.exit(main())
    except Exception as e:
        print(f'Error: {type(e).__name__}. Revisa dataset y credenciales locales, sin compartirlas.',file=sys.stderr)
        sys.exit(1)
