'use strict';

/**
 * Motor de prioridad de Bache 0.
 *
 * Función pura y determinista: no accede a la base de datos, a la red ni al
 * reloj (la hora se inyecta con `opciones.ahora`). La prioridad final la
 * decide este motor mediante reglas de negocio; la visión artificial solo
 * aporta, como máximo, el puntaje definido en priorityRules.IA.
 *
 * Entradas
 *  - reporte: fila de `reportes` (severidad, concurrencia_vial,
 *    infraestructura_critica, clasificacion_vial, clasificacion_vial_estado,
 *    clasificacion_vial_fuente).
 *  - analisisVision: fila de `analisis_vision` o null (estado, proveedor,
 *    detecciones[{ etiqueta, confianza, severidad_sugerida }]).
 */

const REGLAS = require('./priorityRules');

class PriorityInputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PriorityInputError';
    this.code = 'PRIORIDAD_ENTRADA_INVALIDA';
  }
}

const tieneClave = (objeto, clave) => Object.prototype.hasOwnProperty.call(objeto, clave);
const legible = (valor) => String(valor).replace(/_/g, ' ');
const conSigno = (puntos) => (puntos >= 0 ? `+${puntos}` : `${puntos}`);

function nivelPara(puntaje) {
  if (puntaje >= REGLAS.UMBRALES.alta) return 'alta';
  if (puntaje >= REGLAS.UMBRALES.media) return 'media';
  return 'baja';
}

// ───────────── Factores obligatorios (siempre presentes en un reporte válido) ─────────────
const FACTORES_OBLIGATORIOS = [
  { campo: 'severidad', factor: 'gravedad_declarada', texto: 'Gravedad declarada por el ciudadano' },
  { campo: 'concurrencia_vial', factor: 'concurrencia_vial', texto: 'Concurrencia vial' },
  { campo: 'infraestructura_critica', factor: 'infraestructura_critica', texto: 'Infraestructura crítica cercana' },
];

function puntosObligatorios(reporte, campo) {
  const tabla = REGLAS.PUNTOS[campo];
  const valor = reporte[campo];
  if (typeof valor !== 'string' || !tieneClave(tabla, valor)) {
    throw new PriorityInputError(`Campo "${campo}" inválido: ${JSON.stringify(valor)}`);
  }
  return { valor, puntos: tabla[valor] };
}

// ───────────── Tipo de vía (opcional: solo si está confirmada) ─────────────
function evaluarVia(reporte) {
  const tabla = REGLAS.PUNTOS.clasificacion_vial;
  const valor = reporte.clasificacion_vial;
  const confirmada = reporte.clasificacion_vial_estado === 'confirmada';
  if (confirmada && typeof valor === 'string' && tieneClave(tabla, valor)) {
    return {
      disponible: true,
      valor,
      puntos: tabla[valor],
      fuente: reporte.clasificacion_vial_fuente ?? null,
    };
  }
  return { disponible: false };
}

// ───────────── Análisis de imagen (opcional, complementario) ─────────────
function esDeteccionValida(det) {
  if (!det || typeof det !== 'object') return false;
  if (!REGLAS.IA.tipos_validos.includes(det.etiqueta)) return false;
  if (typeof det.confianza !== 'number' || !Number.isFinite(det.confianza)) return false;
  if (det.confianza < 0 || det.confianza > 1) return false;
  if (det.severidad_sugerida !== undefined && det.severidad_sugerida !== null) {
    if (!REGLAS.IA.severidades_validas.includes(det.severidad_sugerida)) return false;
  }
  return true;
}

function evaluarIA(analisis, severidadCiudadano) {
  const noDisponible = (advertencias = [], estado = 'no_disponible') => ({
    estado,
    puntos: 0,
    antecedente: null,
    motivo: null,
    advertencias,
  });

  if (!analisis || typeof analisis !== 'object') return noDisponible();
  if (analisis.estado !== 'completado') return noDisponible();

  const proveedor = String(analisis.proveedor ?? '').toLowerCase();
  if (proveedor.startsWith(REGLAS.IA.proveedores_ignorados_prefijo)) {
    return noDisponible(['El análisis de imagen proviene de un proveedor simulado y se ignoró.'], 'invalido');
  }

  const validas = (Array.isArray(analisis.detecciones) ? analisis.detecciones : []).filter(esDeteccionValida);
  if (validas.length === 0) {
    return noDisponible(['El análisis de imagen no contiene datos válidos y se ignoró.'], 'invalido');
  }

  const mejor = validas.reduce((a, b) => (b.confianza > a.confianza ? b : a));
  const tipo = mejor.etiqueta;
  const confianza = mejor.confianza;
  const sugerida = mejor.severidad_sugerida ?? null;
  const advertencias = [];

  const antecedenteBase = {
    factor: 'analisis_imagen',
    valor: tipo,
    fuente: 'ia',
    confianza,
    severidad_sugerida: sugerida,
  };
  const sinAporte = (motivo) => ({
    estado: 'sin_aporte',
    puntos: 0,
    antecedente: { ...antecedenteBase, puntos: 0 },
    motivo: `${motivo} (+0)`,
    advertencias,
  });

  if (confianza < REGLAS.IA.confianza_minima) {
    return sinAporte(
      `Análisis de imagen con confianza insuficiente (${confianza} < ${REGLAS.IA.confianza_minima}): sin aporte`
    );
  }

  if (tipo === 'ninguno') {
    advertencias.push('revisar_fotografia: el análisis de imagen no detectó un desperfecto vial; conviene revisar la evidencia.');
    return sinAporte('El análisis de imagen no detectó desperfecto: no modifica la prioridad');
  }

  if (sugerida && sugerida !== severidadCiudadano) {
    advertencias.push(
      `discrepancia_severidad: la IA sugiere severidad ${sugerida} y el ciudadano declaró ${severidadCiudadano}.`
    );
  }

  if (REGLAS.IA.tipos_que_corroboran.includes(tipo) && sugerida === REGLAS.IA.severidad_que_suma) {
    const puntos = REGLAS.IA.puntos_maximos;
    return {
      estado: 'aplicada',
      puntos,
      antecedente: { ...antecedenteBase, puntos },
      motivo: `Análisis de imagen corrobora ${legible(tipo)} de severidad alta, confianza ${confianza} (${conSigno(puntos)})`,
      advertencias,
    };
  }

  return sinAporte(`Análisis de imagen (${legible(tipo)}) no cumple la condición de corroboración: sin aporte`);
}

// ───────────── Función principal ─────────────
/**
 * @param {object} reporte
 * @param {object|null} analisisVision
 * @param {{ahora?: Date}} [opciones]
 * @throws {PriorityInputError} si faltan o son inválidos los datos obligatorios del reporte.
 */
function calcularPrioridad(reporte, analisisVision = null, opciones = {}) {
  if (!reporte || typeof reporte !== 'object') {
    throw new PriorityInputError('Se requiere el reporte para calcular la prioridad.');
  }
  const ahora = opciones.ahora instanceof Date ? opciones.ahora : new Date();

  const antecedentes = [];
  const motivos = [];
  const datosNoDisponibles = [];
  const advertencias = [];
  let puntaje = 0;

  for (const { campo, factor, texto } of FACTORES_OBLIGATORIOS) {
    const { valor, puntos } = puntosObligatorios(reporte, campo);
    puntaje += puntos;
    antecedentes.push({ factor, valor, puntos, fuente: 'ciudadano' });
    motivos.push(`${texto}: ${legible(valor)} (${conSigno(puntos)})`);
  }

  const via = evaluarVia(reporte);
  if (via.disponible) {
    puntaje += via.puntos;
    antecedentes.push({
      factor: 'clasificacion_vial',
      valor: via.valor,
      puntos: via.puntos,
      fuente: via.fuente ?? 'sistema',
    });
    motivos.push(`Tipo de vía confirmado: ${legible(via.valor)} (${conSigno(via.puntos)})`);
  } else {
    datosNoDisponibles.push('clasificacion_vial');
  }

  const ia = evaluarIA(analisisVision, reporte.severidad);
  puntaje += ia.puntos;
  if (ia.antecedente) antecedentes.push(ia.antecedente);
  if (ia.motivo) motivos.push(ia.motivo);
  advertencias.push(...ia.advertencias);
  const iaFaltante = ia.estado === 'no_disponible' || ia.estado === 'invalido';
  if (iaFaltante) datosNoDisponibles.push('analisis_imagen');

  // Rango posible: qué ocurriría si los datos faltantes llegaran con su valor máximo.
  const maximoVia = via.disponible ? 0 : Math.max(...Object.values(REGLAS.PUNTOS.clasificacion_vial));
  const maximoIa = iaFaltante ? REGLAS.IA.puntos_maximos : 0;
  const puntajeMaximo = puntaje + maximoVia + maximoIa;
  const nivelMinimo = nivelPara(puntaje);
  const nivelMaximo = nivelPara(puntajeMaximo);

  return {
    prioridad: nivelMinimo,
    puntaje,
    provisional: nivelMinimo !== nivelMaximo,
    rango_posible: {
      minimo: puntaje,
      maximo: puntajeMaximo,
      nivel_minimo: nivelMinimo,
      nivel_maximo: nivelMaximo,
    },
    version_reglas: REGLAS.VERSION_REGLAS,
    antecedentes,
    motivos,
    datos_no_disponibles: datosNoDisponibles,
    advertencias,
    calculada_at: ahora.toISOString(),
  };
}

module.exports = { calcularPrioridad, nivelPara, PriorityInputError };
