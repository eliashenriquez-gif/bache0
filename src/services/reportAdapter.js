const SEVERITY_LABELS = {
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
  if (!report || typeof report !== 'object') {
    return null;
  }

  const latitude = Number(report.latitud);
  const longitude = Number(report.longitud);

  const hasCoordinates =
    report.latitud != null &&
    report.longitud != null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude);

  return {
    // Folio visible en la interfaz.
    id: report.folio || String(report.id),

    // ID numérico real para consultar o actualizar en la API.
    apiId: Number(report.id),

    direccion:
      report.direccion_detectada ||
      report.calle_detectada ||
      'Ubicación sin dirección precisa',

    comuna: report.comuna_detectada || 'Comuna no informada',
    region: report.region_detectada || 'Región no informada',

    severidad: SEVERITY_LABELS[report.severidad] || 'No informada',

    estado: STATUS_LABELS[report.estado] || 'No informado',
    estadoApi: report.estado,

    fechaReporte: report.created_at,

    latitud: hasCoordinates ? latitude : null,
    longitud: hasCoordinates ? longitude : null,

    descripcion: report.descripcion || 'Sin descripción adicional.',

    fotoUrl: report.foto_url || null,
    imagenUrl: null,

    formulario: {
      flujoVehicular:
        TRAFFIC_LABELS[report.concurrencia_vial] || 'No informado',

      cercaniaColegioHospital:
        INFRASTRUCTURE_LABELS[report.infraestructura_critica] ||
        'No informada',

      tipoVia:
        ROAD_CLASS_LABELS[report.clasificacion_vial] ||
        'Pendiente de clasificación',
    },

    // No se inventan resultados de IA.
    iaAnalisis: null,

    precisionUbicacion: report.precision_ubicacion_m,
    metodoUbicacion: report.metodo_ubicacion,
    ubicacionConfirmada: report.ubicacion_confirmada,

    clasificacionVialEstado: report.clasificacion_vial_estado,

    // Conserva la respuesta original por si necesitamos otros campos.
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