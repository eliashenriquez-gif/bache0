'use strict';
/**
 * Conserva el resumen visual RF-DETR dentro del JSONB `analisis_vision.detecciones`
 * ya existente (sin migraciones). NO interpreta el porcentaje como tamaño físico,
 * ni altera severidad/puntos; no adjunta polígonos o imágenes a la BD.
 */
const PROVEEDOR_V2 = 'Roboflow-RFDETR-V2';

function porcentajeSeguro(valor) {
  return typeof valor === 'number' && Number.isFinite(valor) && valor >= 0 && valor <= 100
    ? Math.round(valor * 100000) / 100000 : null;
}
function enteroSeguro(valor, maximo) {
  return Number.isSafeInteger(valor) && valor >= 0 && valor <= maximo ? valor : null;
}

function prepararDeteccionesPersistencia(analisis) {
  const originales = Array.isArray(analisis?.detecciones) ? analisis.detecciones : [];
  const detecciones = originales.length ? originales.map(d => ({ ...d })) : [{
    etiqueta: analisis?.tipo_desperfecto ?? 'ninguno',
    confianza: analisis?.confianza ?? 0,
    caja: null,
    severidad_sugerida: analisis?.severidad_sugerida ?? null,
  }];
  if (analisis?.proveedor !== PROVEEDOR_V2) return detecciones;

  const cantidad = enteroSeguro(analisis.baches_candidatos, 100);
  const area = porcentajeSeguro(analisis.area_visual_pct_union);
  const ancho = enteroSeguro(analisis.ancho_imagen, 50000);
  const alto = enteroSeguro(analisis.alto_imagen, 50000);
  // Siempre se añade a la primera detección, incluso cuando es 'ninguno'.
  // Así se preserva el esquema y la evidencia visual sin una tabla nueva.
  detecciones[0].resumen_visual = {
    version: 'v2-visual-1',
    baches_candidatos: cantidad,
    area_visual_pct_union: area,
    ancho_imagen: ancho && ancho > 0 ? ancho : null,
    alto_imagen: alto && alto > 0 ? alto : null,
    profundidad_cm: null,
    area_m2: null,
    puntos_ia: 0,
    revision_municipal: true,
  };
  return detecciones;
}

module.exports = { prepararDeteccionesPersistencia, PROVEEDOR_V2 };
