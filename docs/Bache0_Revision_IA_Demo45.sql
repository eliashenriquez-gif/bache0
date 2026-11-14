-- Bache0: comparación exploratoria de predicciones en 6 imágenes del grupo DESARROLLO_DEMO.
-- No incluye las 15 imágenes RESERVA_FINAL_SIN_AJUSTE.
-- Categorías derivadas del manifiesto; no equivalen a etiquetas del modelo.
-- Ejecutar: & "C:\Program Files\PostgreSQL\18\bin\psql.exe" -h localhost -U postgres -d bache0_dev -X -P pager=off -f ".\docs\Bache0_Revision_IA_Demo45.sql"
SELECT
  x.id_demo,
  x.tipo_referencia,
  r.id AS reporte_id,
  r.folio,
  v.estado AS estado_vision,
  v.detecciones->0->>'clase_modelo' AS prediccion_principal,
  ROUND(((v.detecciones->0->>'confianza')::numeric * 100), 2) AS confianza_pct,
  v.modelo
FROM (
  VALUES
    ('B09','Bache grande'),
    ('B13','Bache grande'),
    ('B16','Bache grande'),
    ('G02','Grieta'),
    ('A01','Agrietamiento tipo piel de cocodrilo'),
    ('N01','Control')
) AS x(id_demo,tipo_referencia)
JOIN reportes r ON r.descripcion LIKE ('DEMO45 ' || x.id_demo || ' |%')
LEFT JOIN LATERAL (
  SELECT estado, detecciones, modelo
  FROM analisis_vision
  WHERE reporte_id = r.id
  ORDER BY created_at DESC, id DESC
  LIMIT 1
) v ON TRUE
ORDER BY x.id_demo;
-- Una predicción correcta para estas 6 fotos no demuestra precisión general.
-- No utilizar resultados de RESERVA_FINAL_SIN_AJUSTE para entrenamiento ni ajuste.
