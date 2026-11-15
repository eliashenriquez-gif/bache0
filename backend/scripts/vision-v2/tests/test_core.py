import unittest
import sys
from pathlib import Path
import numpy as np
import cv2
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from vision_v2_core import evaluar_imagen, caracteristicas, RespuestaInvalida, metricas_fotos, GT_RGB


def payload(poly=None, conf=.91, cls='Pothole'):
    preds = []
    if poly is not None:
        preds.append({'class': cls, 'confidence': conf, 'points':[{'x': x, 'y': y} for x,y in poly],
                      'x':4,'y':4,'width':4,'height':4})
    return [{'predictions':{'image': {'width':10,'height':10}, 'predictions':preds}}]


class VisionCoreTest(unittest.TestCase):
    def setUp(self):
        self.gt = np.zeros((10,10,3), np.uint8)
        self.gt[2:7,2:7] = GT_RGB

    def test_polygon_exact_match(self):
        # cv2.fillPoly incluye extremos, por tanto 5x5 = 25 px
        p=payload([(2,2),(6,2),(6,6),(2,6)])
        r=evaluar_imagen(p, self.gt)
        self.assertEqual(r['TP'],1)
        self.assertEqual(r['iou'],1.0)
        self.assertEqual(r['tp_inst'],1)
        self.assertEqual(r['fp_inst'],0)

    def test_image_empty_is_true_negative(self):
        r=evaluar_imagen(payload(), np.zeros_like(self.gt))
        self.assertEqual(r['TN'],1)
        self.assertIsNone(r['iou'])
        self.assertEqual(r['instancias_gt'],0)

    def test_false_positive_and_no_severity(self):
        p=payload([(2,2),(6,2),(6,6),(2,6)])
        r=evaluar_imagen(p,np.zeros_like(self.gt))
        self.assertEqual(r['FP'],1)
        self.assertEqual(r['iou'],0)
        c=caracteristicas(p, 10, 10)
        self.assertEqual(c['area_visual_pct_union'],25.0)
        self.assertEqual(c['puntos_ia'],0)
        self.assertIsNone(c['severidad_sugerida'])

    def test_truncated_missing_polygon_fails(self):
        with self.assertRaises(RespuestaInvalida):
            caracteristicas(payload([(2,2),(3,3)]),10,10)

    def test_union_avoids_double_count(self):
        p=payload([(2,2),(6,2),(6,6),(2,6)])
        p[0]['predictions']['predictions'].append(p[0]['predictions']['predictions'][0].copy())
        c=caracteristicas(p,10,10)
        self.assertEqual(c['baches_candidatos'],2)
        self.assertEqual(c['area_visual_pct_union'],25.0)

    def test_confidence_below_threshold(self):
        r=evaluar_imagen(payload([(2,2),(6,2),(6,6),(2,6)],.1),self.gt)
        self.assertEqual(r['FN'],1)

    def test_non_finite_confidence_refused(self):
        with self.assertRaises(RespuestaInvalida):
            caracteristicas(payload([(2,2),(6,2),(6,6),(2,6)],float('nan')),10,10)

    def test_summary_metrics(self):
        a=evaluar_imagen(payload([(2,2),(6,2),(6,6),(2,6)]),self.gt)
        b=evaluar_imagen(payload(),np.zeros_like(self.gt))
        metrics=metricas_fotos([a,b])
        self.assertEqual(metrics['exactitud_foto'],1.0)
        self.assertEqual(metrics['tp_inst'],1)

if __name__=='__main__':unittest.main()
