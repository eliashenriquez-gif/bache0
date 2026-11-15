// Métricas binarias a nivel de fotografía; sin dependencias externas.
export function calcularMetricas(filas) {
  const validas = filas.filter((fila) => fila.estado === 'OK');
  const tp = validas.filter((r) => r.bache_real && r.bache_predicho).length;
  const fp = validas.filter((r) => !r.bache_real && r.bache_predicho).length;
  const tn = validas.filter((r) => !r.bache_real && !r.bache_predicho).length;
  const fn = validas.filter((r) => r.bache_real && !r.bache_predicho).length;
  const division = (a, b) => b ? Number((a / b).toFixed(4)) : null;
  return {
    evaluadas: validas.length,
    fallidas: filas.length - validas.length,
    positivas: tp + fn,
    negativas: tn + fp,
    TP: tp, FP: fp, TN: tn, FN: fn,
    precision: division(tp, tp + fp),
    recall: division(tp, tp + fn),
    especificidad: division(tn, tn + fp),
    tasa_falsos_positivos: division(fp, tn + fp),
    exactitud: division(tp + tn, validas.length),
    f1: division(2 * tp, 2 * tp + fp + fn),
    falsos_positivos: validas.filter((r) => !r.bache_real && r.bache_predicho).map((r) => r.id),
    falsos_negativos: validas.filter((r) => r.bache_real && !r.bache_predicho).map((r) => r.id),
  };
}

// Solo exploración en desarrollo; la evaluación final debe usar parámetros congelados.
export function barridoUmbrales(filas, umbrales = [0.5, 0.6, 0.7, 0.8, 0.9, 0.95, 0.99]) {
  return umbrales.map((umbral) => ({
    umbral,
    ...calcularMetricas(filas.map((r) => r.estado === 'OK'
      ? { ...r, bache_predicho: r.puntaje_bache >= umbral } : r)),
  }));
}
