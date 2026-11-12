
const SEVERITY_LABELS = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
};

const PRIORITY_LABELS = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
};

const STATUS_LABELS = {
  pendiente: 'Pendiente',
  en_revision: 'En revisión',
  reparado: 'Reparado',
};

const TRAFFIC_LABELS = {
  baja: 'Baja',
  media: 'Media',
  alta: 'Alta',
  muy_alta: 'Muy alta',
};

const INFRASTRUCTURE_LABELS = {
  ninguna: 'Ninguna',
  colegio: 'Colegio',
  centro_salud: 'Centro de salud',
  estacion_terminal: 'Estación o terminal',
  otra: 'Otra',
};

const ROAD_CLASS_LABELS = {
  expresa: 'Vía expresa',
  troncal: 'Vía troncal',
  colectora: 'Vía colectora',
  servicio: 'Vía de servicio',
  local: 'Vía local',
};

export function adaptApiReport(report) {
  if (!report || typeof report !== 'object' || Array.isArray(report)) {
    return null;
  }

  const latitude = Number(report.latitud);
  const longitude = Number(report.longitud);

  const hasCoordinates =
    report.latitud != null &&
    report.longitud != null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude);

  // ==========================================
  // PRIORIDAD EXPLICABLE
  // ==========================================

  // El backend almacena los motivos como un
  // arreglo JSONB en la tabla reportes.
  const motivosPrioridad = Array.isArray(report.motivos)
    ? report.motivos
    : [];

  // Busca el resumen del cálculo de prioridad.
  const resumenPrioridad = motivosPrioridad.find(
    (motivo) => motivo?.tipo === 'resumen'
  );

  // Extrae las explicaciones legibles.
  const explicacionesPrioridad = motivosPrioridad
    .filter(
      (motivo) =>
        motivo?.tipo === 'motivo' &&
        typeof motivo.texto === 'string'
    )
    .map((motivo) => motivo.texto);

  // Extrae las advertencias del motor.
  const advertenciasPrioridad = motivosPrioridad
    .filter(
      (motivo) =>
        motivo?.tipo === 'advertencia' &&
        typeof motivo.texto === 'string'
    )
    .map((motivo) => motivo.texto);

  // Identifica los datos que no estaban disponibles.
  const datosNoDisponibles = motivosPrioridad
    .filter(
      (motivo) =>
        motivo?.tipo === 'dato_no_disponible' &&
        typeof motivo.factor === 'string'
    )
    .map((motivo) => motivo.factor);

  return {
    // ==========================================
    // IDENTIFICACIÓN DEL REPORTE
    // ==========================================

    // Folio visible en la interfaz.
    id: report.folio || String(report.id),

    // ID numérico real para consultar o actualizar en la API.
    apiId: Number(report.id),

    // ==========================================
    // UBICACIÓN
    // ==========================================

    direccion:
      report.direccion_detectada ||
      report.calle_detectada ||
      'Ubicación sin dirección precisa',

    comuna: report.comuna_detectada || 'Comuna no informada',
    region: report.region_detectada || 'Región no informada',

    latitud: hasCoordinates ? latitude : null,
    longitud: hasCoordinates ? longitude : null,

    // ==========================================
    // SEVERIDAD ORIGINAL
    // ==========================================

    severidad:
      SEVERITY_LABELS[report.severidad] || 'No informada',

    // ==========================================
    // PRIORIDAD CALCULADA
    // ==========================================

    prioridad:
      PRIORITY_LABELS[report.prioridad] || 'No informada',

    // Valor original para filtros y ordenamiento.
    prioridadApi: report.prioridad || null,

    // Todos los motivos devueltos por el backend.
    motivosPrioridad,

    // Explicaciones legibles.
    explicacionesPrioridad,

    // Advertencias del cálculo.
    advertenciasPrioridad,

    // Factores que no pudieron evaluarse.
    datosNoDisponibles,

    // Puntaje calculado por el motor.
    puntajePrioridad:
      resumenPrioridad?.puntaje ?? null,

    // Indica si el cálculo todavía es provisional.
    prioridadProvisional:
      resumenPrioridad?.provisional === true,

    // Rango posible informado por el motor.
    rangoPosiblePrioridad:
      resumenPrioridad?.rango_posible ?? null,

    // Versión de las reglas utilizadas.
    versionReglas:
      report.version_reglas || null,

    // ==========================================
    // ESTADO DEL REPORTE
    // ==========================================

    estado:
      STATUS_LABELS[report.estado] || 'No informado',

    estadoApi: report.estado,

    fechaReporte: report.created_at,

    descripcion:
      report.descripcion || 'Sin descripción adicional.',

    // ==========================================
    // FOTOGRAFÍA
    // ==========================================

    fotoUrl: report.foto_url || null,
    imagenUrl: null,

    // ==========================================
    // DATOS DEL FORMULARIO CIUDADANO
    // ==========================================

    formulario: {
      flujoVehicular:
        TRAFFIC_LABELS[report.concurrencia_vial] ||
        'No informado',

      cercaniaColegioHospital:
        INFRASTRUCTURE_LABELS[report.infraestructura_critica] ||
        'No informada',

      tipoVia:
        ROAD_CLASS_LABELS[report.clasificacion_vial] ||
        'Pendiente de clasificación',
    },

    // ==========================================
    // ANÁLISIS DE VISIÓN ARTIFICIAL
    // ==========================================

    // Se mantiene en null hasta conectar el
    // endpoint de TensorFlow.js de Bastián.
    // No se inventan resultados de IA.
    iaAnalisis: null,

    // ==========================================
    // METADATOS DE UBICACIÓN
    // ==========================================

    precisionUbicacion: report.precision_ubicacion_m,
    metodoUbicacion: report.metodo_ubicacion,
    ubicacionConfirmada: report.ubicacion_confirmada,

    clasificacionVialEstado:
      report.clasificacion_vial_estado,

    // ==========================================
    // RESPUESTA ORIGINAL DE LA API
    // ==========================================

    // Se conserva para futuras integraciones.
    api: report,
  };
}

export function mapApiReports(response) {
  let reports = [];

  if (Array.isArray(response)) {
    reports = response;
  } else if (Array.isArray(response?.data)) {
    reports = response.data;
  } else if (Array.isArray(response?.data?.data)) {
    reports = response.data.data;
  }

  return reports
    .map(adaptApiReport)
    .filter(Boolean);
}
