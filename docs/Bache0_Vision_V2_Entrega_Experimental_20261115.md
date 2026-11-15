# Bache0 — Entrega experimental de visión artificial V2

**Fecha:** 15 de noviembre de 2026 · **Rama:** `experiment/vision-baches-v2` · **Modelo:** RF-DETR Small, Roboflow (segmentación de baches).

## Qué hace, exactamente

- Identifica **posibles baches** por foto, ofrece confianza y calcula rectángulos aproximados donde fueron localizados.
- Por cada detección obtiene área **en píxeles / porcentaje de esa fotografía** a partir de la máscara; obtiene además la **unión** de las máscaras para no duplicar área si se superponen.
- **No** determina metros cuadrados, longitud real, profundidad, peligrosidad, ni clase «calle sana» verificable.
- El porcentaje depende de distancia, perspectiva y encuadre; **no es una medida comparable entre fotografías**.
- El panel municipal muestra el resumen de área visual, lista de candidatos, confianzas y, cuando coinciden dimensiones, rectángulos aproximados en la foto autorizada. No guarda ni dibuja los polígonos completos de las máscaras. Si las dimensiones no coinciden, no superpone rectángulos.
- **La IA V2 no asigna puntos**: `severidad_sugerida=null`, `puntos_ia=0`. El motor sigue usando exclusivamente su versión de reglas explicables para calcular la prioridad. Cualquier decisión sobre gravedad requiere revisión municipal.

## Evaluaciones congeladas

| Grupo | Fotos | TP / FP / TN / FN | Exactitud foto | Recall foto | IoU micro |
|---|---:|---|---:|---:|---:|
| Desarrollo | 30 | 16 / 0 / 13 / 1 | 96,7% | 94,1% | 61,7% aprox. |
| Reserva | 15 | 3 / 0 / 10 / 2 | 86,7% | 60,0% | 33,4% |
| Adicional (mismo dataset público, escenas seleccionadas) | 30 | 14 / 3 / 12 / 1 | 86,7% | 93,3% | 45,2% |
| **Reserva + adicional** | **45** | **17 / 3 / 22 / 3** | **86,7%** | **85,0%** | **43,4%** |

En 45 fotografías, 22 de 35 baches anotados lograron correspondencia de instancia con IoU ≥ 0,5, 7 detecciones quedaron sin correspondencia y se omitieron 13 instancias. Casos problemáticos: `B10`, `M02` y `EXT06` sin bache detectado; `EXT17`, `EXT21`, `EXT28` falsas alarmas. En `EXT03` la máscara anotada ocupa 29,25% de la imagen y RF-DETR segmentó 0,65%; en `EXT10`, 27,29% frente a 1,18%. No es seguro incrementar prioridad por tamaño visual.

**Alcance:** 45 imágenes fuera del entrenamiento usado para el modelo, pero todas proceden del mismo conjunto público *PavementDamagesG-7*; varias escenas pueden estar relacionadas. **No se validó en calles chilenas** ni en condiciones reales de todas las municipalidades. No presentar cifras anteriores como desempeño garantizado en Chile o en producción.

## Integración y persistencia

1. La ruta habitual del reporte ciudadano guarda el reporte y crea el análisis en la tabla `analisis_vision`, de forma asíncrona.
2. `visionService.js` usa RF-DETR **solo con** `VISION_V2_PROVIDER=rfdetr`; en otro caso mantiene el modelo local original de Bastián.
3. El cliente Python utiliza `ROBOFLOW_API_KEY` desde el entorno del backend y `VISION_V2_PYTHON` como ruta al Python instalado. Para una cuenta donde se verificó el transporte HTTP dual, `ROBOFLOW_API_TRANSPORT=both`. **No** publicar claves en Git, frontend o Vercel.
4. `reportService.js` guarda metadatos de V2 dentro del JSONB existente `analisis_vision.detecciones[0].resumen_visual` (versión `v2-visual-1`) sin migraciones: área de unión, número de candidatos, dimensiones originales y la aclaración de cero puntos. También funciona cuando no hay candidatos (`etiqueta=ninguno`).
5. `VisionV2Detalle.jsx` lee el resultado a través del endpoint autenticado de visión del mismo reporte. Mantiene las etiquetas y vista originales de TensorFlow en reportes de Bastián.
6. No se modifican `priorityService.js`, `priorityRules.js`, PostgreSQL ni la rama `main`.

## Seguridad y operación

- La ejecución de RF-DETR en Serverless **envía fotografías de reportes a un proveedor externo**. Solo activar con autorización institucional y controles de privacidad adecuados; permanecer apagado por defecto.
- Las fotografías se recuperan desde una API autenticada con control de ámbito municipal; no convertirlas en URLs públicas ni cargarlas desde servicios externos al panel.
- Si el proveedor falla, el análisis queda fallido y el reporte ciudadano permanece guardado; la prioridad no se «adivina».
- La interfaz no permite modificar la severidad usando métricas de la IA. No confundir un rectángulo visual con la máscara real.

## Evidencia de cierre

- Pruebas Python: 13/13 en la instalación de cierre previa.
- Nuevas pruebas de backend: resúmenes V2 con/sin baches, seguridad de porcentajes y persistencia; pruebas existentes comprueban que el motor de prioridad no añade puntos.
- Compilación UI: verificar `npm run build` en el notebook al instalar esta entrega.
- Prueba de aceptación pendiente **con servicios reales**: reporte desde móvil → guardado PostgreSQL → análisis V2 opt-in → abrir detalle en panel → candidato, porcentaje visual, rectángulos de referencia → verificar que prioridad no cambió por tamaño. Requiere API pública/servidor/credenciales y fotos reales de contexto; no fue posible ejecutarlo en un entorno offline.

## Recomendación

**Cierre del prototipo experimental, no despliegue de producción.** Para bonificar tamaño en una futura versión, recopilar un conjunto realmente independiente de fotos chilenas con protocolo de encuadre y escala, auditar sesgo y falsas alarmas, fijar un máximo de +1 punto de IA en total, validar umbrales por separado y versionar las reglas. No incorporar ese cambio ahora.
