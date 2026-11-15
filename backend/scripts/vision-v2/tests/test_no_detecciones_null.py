# Tests adicionales: Roboflow omite dimensiones cuando NO hay detecciones.
import sys, unittest, json, os
from pathlib import Path
import numpy as np
TEST_DIR = Path(__file__).resolve().parent
CORE = Path(os.environ.get('BACHE0_V2_TEST_CORE_DIR', str(TEST_DIR.parent)))
sys.path.insert(0,str(CORE))
from vision_v2_core import extraer, evaluar_imagen, caracteristicas, RespuestaInvalida

class NullImageDimensionsTest(unittest.TestCase):
    def test_json_real_m03_sin_detecciones(self):
        payload = json.loads((TEST_DIR/'M03_20261114T235206Z_resumen.json').read_text(encoding='utf-8'))
        self.assertEqual(extraer(payload, 1920, 1080), [])
        gt = np.zeros((12,20,3),dtype=np.uint8)
        gt[3:6,4:7] = (42,125,209)
        r = evaluar_imagen(payload, gt)
        self.assertEqual(r['FN'],1)
        self.assertEqual(r['TP'],0)
        self.assertEqual(r['pixeles_pred'],0)
    def test_json_real_n05_negativo(self):
        payload = json.loads((TEST_DIR/'N05_20261114T235206Z_resumen.json').read_text(encoding='utf-8'))
        r = evaluar_imagen(payload, np.zeros((10,12,3),dtype=np.uint8))
        self.assertEqual(r['TN'],1)
        c = caracteristicas(payload,12,10)
        self.assertEqual(c['baches_candidatos'],0)
        self.assertEqual(c['puntos_ia'],0)
        self.assertIsNone(c['severidad_sugerida'])
    def test_no_permiso_para_deteccion_sin_dimensiones(self):
        p = [{'predictions':{'image': {'width':None,'height':None},'predictions':[{'class':'Pothole','confidence':.8,'points':[{'x':1,'y':1},{'x':4,'y':1},{'x':4,'y':4}], 'x':2.5,'y':2.5,'width':3,'height':3}]}}]
        with self.assertRaises(RespuestaInvalida): extraer(p,12,10)
    def test_metadatos_parciales_sin_detecciones_se_rechazan(self):
        p=[{'predictions':{'image':{'width':None,'height':10},'predictions':[]}}]
        with self.assertRaises(RespuestaInvalida): extraer(p,12,10)
    def test_tamano_local_invalido_sigue_rechazado(self):
        p=[{'predictions':{'image':{'width':None,'height':None},'predictions':[]}}]
        with self.assertRaises(RespuestaInvalida): extraer(p,0,10)

if __name__=='__main__': unittest.main()
