# Bache0 — Cierre técnico de la evaluación experimental RF-DETR V2

**Fecha:** 15 de noviembre de 2026. **Rama:** `experiment/vision-baches-v2`.

**Evidencia:** ZIP `ResultadosVisionV2_Final.zip` aportado al chat por el usuario, con
`metricas_reserva15.json` y `metricas_externo30.json`. Los valores se cotejaron
con la salida de PowerShell. **No contiene resultados individuales**.

## Rendimiento por fotografías

| Muestra | N | TP | FP | TN | FN | Exactitud | Precisión | Recall | F1 |
|:--|--:|--:|--:|--:|--:|--:|--:|--:|--:|
| Reserva original | 15 | 3 | 0 | 10 | 2 | 86,7 % | 100,0 % | 60,0 % | 75,0 % |
| Adicional PavementDamagesG-7 | 30 | 14 | 3 | 12 | 1 | 86,7 % | 82,4 % | 93,3 % | 87,5 % |
| **Ambas muestras** | **45** | **17** | **3** | **22** | **3** | **86,7 %** | **85,0 %** | **85,0 %** | **85,0 %** |

En el conjunto consolidado de evaluación, RF-DETR V2 clasifica correctamente 39/45
fotografías. Hubo 3 fotos positivas no detectadas y 3 alarmas incorrectas. **La
selección 20 positivas/25 negativas no representa necesariamente la frecuencia
real de baches en calles chilenas**, por lo que la exactitud no debe extrapolarse.

## Rendimiento por instancia y máscaras

| Muestra | TP instancia | FP instancia | FN instancia | IoU micro de píxeles | IoU medio por fotografía positiva |
|:--|--:|--:|--:|--:|--:|
| Reserva | 3 | 1 | 7 | 0,3338 | 0,3727 |
| Adicional | 19 | 6 | 6 | 0,4524 | 0,5871 |
| **Suma de instancias** | **22** | **7** | **13** | **No combinable desde estos resúmenes** | **No se usa como medida física** |

El IoU de emparejamiento por instancia se consideró positivo con umbral 0,50.
La sensibilidad por instancia de los 45 casos es **22/(22+13)=62,9 %**; precisión
por instancia **22/(22+7)=75,9 %**. Las referencias de instancias se obtienen
por componentes conexos de máscaras anotadas; no son necesariamente un inventario
perfecto de baches independientes.

No promediar los IoU micro de ambos grupos: para obtener el IoU micro conjunto
hacen falta intersecciones y uniones de píxeles por fotografía (están en los CSV
locales, pero no en el ZIP recibido). Los IoU reportados tampoco equivalen a
metros cuadrados, profundidad ni volumen.

## Comparación con Bastián (solo exploratoria)

En las 30 fotos de **desarrollo**, usadas para iterar el prototipo,
RF-DETR V2 obtuvo 16 TP, 0 FP, 13 TN y 1 FN (96,7 % exactitud por foto).
El clasificador de Bastián obtuvo 17 TP, 11 FP, 2 TN y 0 FN (63,3 %).
Esta comparación **no demuestra superioridad en el conjunto final de 45**,
porque no disponemos de predicciones de Bastián sobre esas mismas 45 fotos.

## Decisión técnica

**Apto para demostración y piloto de detección experimental con revisión humana.**
**No aprobado** para producción general ni asignación automática de prioridad.

1. Mantener el modelo local de Bastián como comportamiento por defecto del sistema.
2. RF-DETR V2 solo con `VISION_V2_PROVIDER=rfdetr` en un entorno de pruebas.
3. Mantener `severidad_sugerida=null`, `puntos_ia=0`; no modificar
   `priorityService.js`, `priorityRules.js` ni la base de datos.
4. Conservar el umbral fijo 0,40 sin ajustarlo después de la prueba final.
5. Verificar imágenes reales de calles chilenas, variadas y geográficamente
   independientes, antes de cualquier afirmación de generalización.
6. Revisar falsos positivos, falsos negativos y segmentaciones defectuosas usando
   CSV locales `resultados_fotografia.csv`. No se dispone de ellos en este ZIP.
7. Para comparar justamente con Bastián en la evaluación final, ejecutar el
   clasificador original sobre las mismas 45 fotografías sin alterar las
   etiquetas de referencia ni los parámetros de RF-DETR.

## Integración de prueba y operación

- `VISION_V2_PROVIDER=rfdetr`: habilita en la rama experimental.
- `VISION_V2_PYTHON=C:\BACHE_0\KitVisionV2\.venv\Scripts\python.exe` (ruta de ejemplo).
- `ROBOFLOW_API_KEY`: credencial privada SOLO en variables de entorno del servidor.
- `ROBOFLOW_API_TRANSPORT=both`: transporte confirmado en prueba del Workflow;
  el adaptador también admite `header` y `legacy`, y mantiene `header` por defecto.
- `VISION_V2_FALLBACK_LEGACY=true`: opcional, permite fallback local si falla el servicio externo;
  el resultado debe atribuirse al proveedor real que lo produjo.

**Operación:** el adaptador usa un servicio externo de Roboflow. Verificar conectividad,
créditos y política de manejo de imágenes del proyecto antes de habilitarlo con
fotografías ciudadanas reales. No utilizar secretos en commits ni compartirlos en capturas.

## Pendientes verificables

- Exportar los dos CSV de evaluación individual y analizar los seis errores por foto.
- Ejecutar pruebas de integración del backend actualizado en el notebook, con la
  integración experimental activa y sin ella, y comprobar persistencia en PostgreSQL
  dentro de un entorno de pruebas.
- Evaluación independiente con fotografías tomadas en Chile.

El cierre de la **evaluación de laboratorio** está completo. La validación de un
servicio productivo municipal **no** está completa.
