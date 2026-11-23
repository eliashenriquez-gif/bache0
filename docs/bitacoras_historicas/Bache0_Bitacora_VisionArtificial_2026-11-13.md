# Bache0 — Bitácora de visión artificial

**Jornada:** 12–13 de noviembre de 2026  
**Proyecto:** Bache0 — Integración municipal  
**Frente:** Evaluación de modelos de visión artificial para caracterización de daños viales  
**Estado al cierre:** dataset de prueba preparado; inferencias reales pendientes.

## 1. Objetivo de la jornada

Investigar si existe un modelo preentrenado que pueda incorporarse a Bache0 para analizar fotografías de daños viales y aportar información al motor de prioridad. Los indicadores buscados son:

1. **Área afectada:** proporción de píxeles del encuadre ocupada por el daño.
2. **Severidad visual:** características visuales de borde, textura y sombras. Una fotografía RGB monocular no permite medir de forma confiable la profundidad física del bache.
3. **Multiplicidad y tipo de daño:** presencia de baches, grietas longitudinales/transversales y patrón de piel de cocodrilo.
4. **Confianza:** puntuación de confianza de las detecciones, que debe tratarse como señal del modelo y no necesariamente como probabilidad calibrada.

Se acordó evaluar modelos existentes antes de entrenar uno desde cero o modificar la integración actual del backend.

## 2. Modelos candidatos identificados

Se seleccionaron dos modelos publicados en Roboflow Universe para una primera comparación:

| Modelo | Identificador | Alcance esperado | Referencia |
|---|---|---|---|
| UAG YOLOv11 Road Damage | `road-damage-tmjyb/4` | Baches, grietas y piel de cocodrilo | https://universe.roboflow.com/uag-da43f/road-damage-tmjyb |
| Major Pothole | `pothole-bwzav/2` | Especializado en baches | https://universe.roboflow.com/major-vl1h9/pothole-bwzav |

Las métricas publicadas por los autores no se consideran una comparación directa, porque los modelos pueden haber sido evaluados con datasets, clases y protocolos diferentes. La decisión se tomará después de ejecutar ambos sobre el mismo conjunto de fotografías.

## 3. Dataset público recibido e inspeccionado

Se recibió y revisó el archivo `PavementDamagesG-7(1).zip`, correspondiente al dataset **PavementDamagesG-7**, versión 3 de Mendeley Data:

- Fuente: https://data.mendeley.com/datasets/yb65trwbd8/3
- Ubicación de captura declarada: Cali, Colombia.
- Periodo de captura declarado: 2024–2025.
- Resolución declarada: 1920 × 1080 píxeles.
- Contenido: fotografías JPEG y máscaras de anotación PNG correspondientes.
- Licencia indicada en la ficha del dataset: CC BY 4.0. Mantener atribución al reutilizar el material.

La inspección del archivo identificó 920 fotografías y 920 máscaras. Las máscaras codifican, entre otras, estas clases: bache, grieta longitudinal/transversal y piel de cocodrilo. También contienen marcación vial, drenajes, parches y fondo.

## 4. Muestra piloto de 45 imágenes

Se preparó una muestra de 45 imágenes para que ambos modelos reciban exactamente las mismas fotografías:

| Identificadores | Categoría de selección | Cantidad |
|---|---|---:|
| B01–B08 | Baches con baja proporción de área en el encuadre | 8 |
| B09–B16 | Baches con alta proporción de área en el encuadre | 8 |
| G01–G08 | Grietas longitudinales/transversales | 8 |
| A01–A08 | Piel de cocodrilo | 8 |
| M01–M07 | Daños combinados | 7 |
| N01–N06 | Controles sin las tres clases principales | 6 |
| **Total** | | **45** |

Resumen de las etiquetas de referencia de la muestra (las clases pueden coincidir en una misma imagen):

- Bache presente: 22 imágenes.
- Grieta presente: 12 imágenes.
- Piel de cocodrilo presente: 12 imágenes.
- 29 imágenes están codificadas en escala de grises y 16 en RGB.

**Precaución:** “bache pequeño/grande” se refiere a la proporción de píxeles anotados respecto del encuadre, no a centímetros ni a metros cuadrados. Las imágenes de control no garantizan que la calzada esté completamente sana; pueden contener otros elementos como pintura vial o parches. La muestra es un piloto y puede conservar correlación entre imágenes de tramos cercanos.

## 5. Artefactos preparados

Se generó el paquete `Bache0_Prueba_Vision_45.zip` con 147 archivos, que contiene:

- 45 fotografías originales en `imagenes/`.
- 45 máscaras de referencia en `mascaras_referencia/`.
- 45 vistas superpuestas en `vistas_superpuestas/`.
- Catálogo visual en `previsualizaciones/catalogo_45.jpg`.
- Metadatos y porcentajes de área anotada en `referencias_45.csv`.
- Plantilla con 90 filas para los resultados (45 imágenes × 2 modelos) en `resultados_plantilla_90.csv`.
- Planilla `Bache0_analisis_preliminar.xlsx`.
- Instrucciones `LEEME.md`.
- Ejecutor comparativo `ejecutar_modelos.py`.

Las vistas superpuestas muestran las anotaciones originales del dataset; **no son predicciones de los modelos**.

## 6. Diseño de la evaluación real

El script `ejecutar_modelos.py` está preparado para consultar los modelos alojados en Roboflow y comparar las predicciones con las máscaras de referencia. El diseño contempla:

- Detección de bache por imagen: recall de positivos y tasa de falsos positivos en controles.
- Segmentación de bache: IoU, precisión y recall a nivel de píxel.
- Diferencia entre área de bache de referencia y área predicha en el encuadre.
- Confianza máxima observada por clase.
- Detección de grietas y piel de cocodrilo para el modelo UAG, si la respuesta entrega las clases/segmentaciones esperadas.
- Latencia observada de red y servidor.

La comparación debe respetar las clases que cada modelo conoce. No se debe penalizar al modelo especializado en baches por no detectar grietas o piel de cocodrilo si esas clases no forman parte de su entrenamiento.

## 7. Estado de ejecución al cierre

**No se ejecutaron inferencias reales de ninguno de los dos modelos durante esta jornada.** No se configuró ni se utilizó una API Key de Roboflow en este entorno. Por lo tanto:

- No existen todavía predicciones reales de UAG YOLOv11 Road Damage.
- No existen todavía predicciones reales de Major Pothole.
- No se han calculado métricas de rendimiento de los modelos sobre las 45 imágenes.
- No se debe presentar la plantilla vacía ni el análisis preliminar como resultados de IA.

La ejecución requiere configurar una API Key privada de Roboflow en el equipo local. La clave no debe guardarse en el repositorio, en archivos `.env` versionados ni compartirse por chat.

## 8. Próximos pasos acordados

1. Descargar y extraer `Bache0_Prueba_Vision_45.zip` en el equipo local, fuera del repositorio Git si se desea evitar subir imágenes y binarios de prueba.
2. Comprobar Python 3.10 o superior en PowerShell con `py --version`.
3. Instalar dependencias:

   ```powershell
   py -m pip install inference-sdk numpy pillow opencv-python
   ```

4. Configurar la clave solo en la sesión local de PowerShell:

   ```powershell
   $env:ROBOFLOW_API_KEY = "TU_CLAVE_PRIVADA"
   ```

5. Ejecutar una prueba pequeña (dos imágenes por modelo; cuatro inferencias en total):

   ```powershell
   py .\ejecutar_modelos.py --limite 2
   ```

6. Revisar errores, clases devueltas, formato de segmentación, consumo/créditos y resultados. Si la prueba funciona, ejecutar las 45 imágenes por ambos modelos (90 inferencias):

   ```powershell
   py .\ejecutar_modelos.py --limite 45
   ```

7. Revisar `resultados_reales/resultados_comparacion.csv`, `resumen_modelos.csv` y los JSON de respuesta. Documentar fallos y casos dudosos antes de elegir un modelo.
8. Solo después de la comparación, proponer cambios al servicio de visión y al motor de prioridad de Bache0. No sobrescribir ni reemplazar el trabajo de integración existente sin revisar primero los cambios del equipo.

**Nota de costo:** verificar límites, créditos y condiciones de la cuenta Roboflow antes de ejecutar las 90 inferencias.

## 9. Relación con la arquitectura actual de Bache0

La prueba se mantiene aislada del backend municipal actual. No se modificaron `visionService.js`, `visionPrediction.js`, `visionWorker.js`, `visionAnalysisService.js`, `priorityService.js`, `priorityRules.js`, migraciones ni contratos API durante esta jornada.

La posible integración futura deberá conservar Node.js como backend principal y evaluar un servicio de inferencia separado o un formato de despliegue compatible, además de registrar la versión del modelo, confianza, clases y evidencia de la predicción.

## 10. Archivos y referencias

- Paquete piloto: `Bache0_Prueba_Vision_45.zip`.
- Planilla: `Bache0_analisis_preliminar.xlsx`.
- Dataset: https://data.mendeley.com/datasets/yb65trwbd8/3.
- Modelo UAG: https://universe.roboflow.com/uag-da43f/road-damage-tmjyb.
- Modelo Major: https://universe.roboflow.com/major-vl1h9/pothole-bwzav.

---

**Conclusión:** se completó la preparación de un conjunto piloto de 45 fotografías anotadas y de un procedimiento reproducible para comparar dos modelos preentrenados. La selección del modelo para Bache0 queda pendiente hasta ejecutar y revisar las inferencias reales. No se integró todavía ningún modelo nuevo al backend ni se alteró el motor de prioridad.
