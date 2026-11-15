# Bache0 — Protocolo experimental de visión V2 (14-11-2026)

## Contexto confirmado

La rama `experiment/vision-baches-v2` parte del commit `9e38a3e` de `main`. Este protocolo **no modifica** el servidor existente ni cambia `integration/elias-david`.

La IA actual es `MobileNetV2-TeachableMachine` con etiquetas `Bache`, `Calle Sana`, `Otro`, `224×224`, TensorFlow.js local, trabajador reutilizable y versión basada en SHA-256. Clasifica toda la foto, sin bounding box ni máscara; `severidad_sugerida` es `null`. Por eso los falsos positivos pueden afectar la **etiqueta mostrada**, pero con las reglas actuales no añaden por sí solos puntos de prioridad, porque el incremento exige severidad sugerida `alta`.

## Hallazgo motivador del chat principal

| ID | Referencia de máscara | IA antigua (reportada) | Confianza reportada |
| --- | --- | --- | --- |
| B09 | Bache | Bache | No recuperada |
| B13 | Bache | Bache | No recuperada |
| B16 | Bache | Bache | No recuperada |
| A01 | Piel de cocodrilo, sin bache | Bache | 99,73 % |
| G02 | Grieta, sin bache | Bache | 99,64 % |
| N01 | Marcación vial, sin bache anotado | Bache | 95,39 % |

Son seis casos dirigidos, no una muestra aleatoria representativa; **no extrapolar una exactitud general** de ellos. Son observaciones del chat principal pendientes de reproducción con el script offline.

## Hipótesis de mejora

El clasificador de imagen completa no puede localizar el supuesto bache y confunde texturas o reparaciones. Por tanto, preferimos **evaluar detección/segmentación específica de baches** antes de reemplazar pesos o modificar el backend. Un umbral de confianza sobre el clasificador actual es insuficiente como solución por sí solo: se observaron falsos positivos muy superiores a 0,95.

## Diseño experimental

**Caso objetivo**: presencia/ausencia de al menos un bache anotado en la máscara de origen (nivel fotografía). Grietas y piel de cocodrilo sin bache son negativas, aunque la calle presente deterioro vial. Se analiza además IoU de máscara para los modelos que segmentan.

- Dataset fijo: PavementDamagesG-7, 45 JPG+45 máscaras SHA-256, nombres originales preservados en `backend/fixtures/demo-vision-45`.
- 30 desarrollo: 17 con bache / 13 sin bache.
- 15 reserva: 5 con bache / 10 sin bache.
- Se guardan las predicciones originales por modelo y versión, la latencia y posibles errores.
- Métricas comparables entre los tres modelos: TP, FP, TN, FN, precisión de bache, recall, especificidad, F1, tasa de falsos positivos (FPR).
- Métricas adicionales **solo** para segmentadores: IoU de máscara de baches y porcentaje de imagen afectada; no comparar su IoU con MobileNetV2, que no genera máscaras.
- El porcentaje de píxeles no demuestra tamaño en metros cuadrados ni profundidad física.
- Umbrales, modelo y preprocesamiento se seleccionan solo con DESARROLLO y se congelan antes de RESERVA.

## Modelos que se probarán

1. Actual: `MobileNetV2-TeachableMachine` local (no se toca).
2. `road-damage-tmjyb/4` (UAG, YOLO11 instancia, varias clases).
3. `pothole-bwzav/2` (Major, instancia, Pothole/Not-Pothole).

Las métricas publicadas por modelos distintos no son directamente comparables; se deben medir con la misma muestra. Requieren acceso efectivo desde una cuenta Roboflow y sus condiciones de uso pueden cambiar. No usar fotos privadas de ciudadanos para la prueba externa.

## Criterios antes de intentar integrar V2

1. Reducción de falsos positivos en desarrollo **sin bajar indebidamente el recall de baches reales**.
2. Resultados sobre la reserva sin ajustes posteriores.
3. Reproducibilidad, latencia y funcionamiento sin credenciales externas si se decide desplegar localmente; valorar licencia/costo de modelo y proveedor.
4. Si V2 se considera adecuada, integración en una rama propia, nuevas pruebas de API/seguridad, revisión del equipo, plan de reversión, **nunca fusión automática** a `main`.

## Registro de estado

En este kit se verificaron localmente 45/45 pares de archivos por SHA-256, tests JS de métricas y pruebas sintéticas del evaluador de polígonos. **No se ejecutó inferencia real**, por falta de bibliotecas TensorFlow.js y credenciales Roboflow en el entorno de preparación.
