'use strict';

// Ejecutar con: node --test test/reportService.test.js
// Prueba el flujo completo reportService → priorityService (real) con visionService SIMULADO
// (la inferencia real con sharp + TensorFlow.js en Worker se prueba en visionService.test.js y
// visionModel.integration.test.js). El almacenamiento, la ubicación y la base de datos también están simulados.
// El último bloque verifica que lo que genera reportService lo aceptan los repositorios REALES.

delete process.env.VISION_ENABLED;

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');

// ── Estado compartido de los dobles de prueba ──
const estado = {};
function reiniciar() {
  Object.assign(estado, {
    eventos: [], filas: [], prioridades: [], contextos: [], eliminadas: [], creados: [],
    fallaCrear: false, fallaCrearFila: false, fallaActualizarFila: false, fallaPrioridad: false,
    vision: async () => analisisOk(),
    llamadasVision: 0,
    ubicacionExtra: {}, // campos adicionales que devuelve locationService (p. ej. clasificacion_vial_*)
  });
}
// Resultado de visionService.analyzeImage. `severidad_sugerida: 'alta'` simula un modelo que estima severidad
// (el modelo actual NO lo hace: ver la prueba "con el análisis REAL del modelo").
const analisisOk = (extra = {}) => ({
  ok: true,
  analisis: {
    tipo_desperfecto: 'bache', severidad_sugerida: 'alta', confianza: 0.9,
    proveedor: 'TensorFlow-Local', modelo: 'MobileNetV2-TeachableMachine', version_modelo: 'tm-test@2026-11-11+sha256:abc123', ...extra,
  },
});
const falloVision = (error_code) => ({ ok: false, error_code, mensaje: 'simulado' });

const imagenGuardada = path.join(os.tmpdir(), `bache0-guardada-${process.pid}.jpg`);
fs.writeFileSync(imagenGuardada, Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]));

// ── Dobles de los módulos que tocan red, disco o PostgreSQL ──
const dobles = {
  './visionService': {
    visionHabilitada: () => process.env.VISION_ENABLED !== 'false',
    analyzeImage: async (ruta) => {
      estado.llamadasVision += 1;
      estado.eventos.push('vision');
      return estado.vision(ruta);
    },
  },
  './locationService': {
    resolverUbicacion: async () => ({
      municipalidad: { id: 1 }, direccion_detectada: 'Av. Test 123', calle_detectada: 'Av. Test',
      comuna_detectada: 'La Pintana', region_detectada: 'Metropolitana', estado_resolucion: 'resuelta',
      ...estado.ubicacionExtra,
    }),
  },
  './photoStorageService': {
    savePhoto: async () => ({
      foto_storage_key: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.jpg', foto_mime_type: 'image/jpeg',
      foto_size_bytes: 8, foto_sha256: 'x', foto_ancho_px: 1, foto_alto_px: 1,
    }),
    deletePhoto: async (key) => { estado.eliminadas.push(key); },
    resolvePhotoPath: () => imagenGuardada,
  },
  './reportManagementService': {
    createReport: async (input) => {
      if (estado.fallaCrear) throw new Error('BD caída');
      estado.creados.push(input);
      estado.eventos.push('reporte_creado');
      const { foto_storage_key, foto_mime_type, foto_size_bytes, foto_sha256, foto_ancho_px, foto_alto_px, geocodificacion_proveedor, ...publico } = input;
      return { id: 7, folio: 'B0-7', estado: 'pendiente', clasificacion_vial_fuente: null, clasificacion_vial_verificada_at: null, prioridad: null, motivos: [], version_reglas: null, ...publico };
    },
  },
};

const cargaOriginal = Module._load;
Module._load = function (request, parent, ...resto) {
  if (Object.prototype.hasOwnProperty.call(dobles, request)) return dobles[request];
  return cargaOriginal.call(this, request, parent, ...resto);
};
const reportService = require('../src/services/reportService');
const AppError = require('../src/middlewares/AppError');
Module._load = cargaOriginal;

const persistenciaFalsa = async () => ({
  pool: {},
  reportes: {
    updateReportPriority: async (_pool, id, entrada, scope, actor) => {
      if (estado.fallaPrioridad) throw new Error('UPDATE prioridad falló');
      estado.eventos.push('prioridad');
      estado.prioridades.push({ id, entrada, scope, actor });
      return { id, ...entrada };
    },
  },
  vision: {
    createVisionAnalysis: async (_pool, entrada, contexto) => {
      if (estado.fallaCrearFila) throw new Error('INSERT análisis falló');
      const fila = { id: 100 + estado.filas.length, ...entrada };
      estado.filas.push(fila);
      estado.contextos.push(contexto);
      estado.eventos.push('fila_creada');
      return fila;
    },
    updateVisionAnalysis: async (_pool, id, cambios, contexto) => {
      if (estado.fallaActualizarFila) throw new Error('UPDATE análisis falló');
      const fila = estado.filas.find((f) => f.id === id);
      if (!fila) throw new Error(`fila ${id} inexistente`);
      Object.assign(fila, cambios);
      estado.contextos.push(contexto);
      estado.eventos.push(`fila_${cambios.estado}`);
      return fila;
    },
  },
});

// ── Utilidades de prueba ──
const datosValidos = (extra = {}) => ({
  latitud: '-33.58', longitud: '-70.63', ubicacion_confirmada: 'true', metodo_ubicacion: 'gps',
  severidad: 'alta', concurrencia_vial: 'media', infraestructura_critica: 'ninguna',
  descripcion: 'Bache profundo', ...extra,
});
const nuevaFotoMulter = () => {
  const ruta = path.join(os.tmpdir(), `bache0-multer-${process.pid}-${Math.random().toString(16).slice(2)}`);
  fs.writeFileSync(ruta, Buffer.from([0xff, 0xd8, 0xff]));
  return { path: ruta };
};
const crear = (datos = datosValidos(), foto = nuevaFotoMulter()) => reportService.procesarNuevoReporte(datos, foto, 'req-1');
const diferido = () => { let resolver; const promesa = new Promise((res) => { resolver = res; }); return { promesa, resolver }; };
const status = (codigo, msg) => Object.assign(new Error(`[${codigo} ${msg}] simulado`), { status: codigo });
const esperarHasta = async (condicion, ms = 1500) => {
  const limite = Date.now() + ms;
  while (!condicion()) {
    if (Date.now() > limite) throw new Error('Tiempo agotado esperando una condición');
    await new Promise((resolver) => setImmediate(resolver));
  }
};
const esObjetoPlano = (x) => x && typeof x === 'object' && !Array.isArray(x);

let rechazosNoManejados = 0;
process.on('unhandledRejection', () => { rechazosNoManejados += 1; });

const consolaOriginal = { error: console.error, info: console.info };
let logsError = [];
test.before(() => {
  console.error = (...a) => logsError.push(a.join(' '));
  console.info = () => {};
});
test.beforeEach(() => { reiniciar(); logsError = []; reportService._setPersistenciaParaPruebas(persistenciaFalsa); delete process.env.VISION_ENABLED; });
test.after(() => {
  console.error = consolaOriginal.error; console.info = consolaOriginal.info;
  fs.rmSync(imagenGuardada, { force: true });
});

// ───────────── Cola persistida: pendiente → inferencia local → completado ─────────────
test('crea la fila "pendiente" ANTES de analizar y responde sin esperar a la IA', async () => {
  const espera = diferido();
  estado.vision = () => espera.promesa; // la inferencia "tarda"

  const creado = await crear();
  assert.equal(creado.id, 7);

  await esperarHasta(() => estado.eventos.includes('vision'));
  // La inferencia sigue en curso, y la fila ya existe en la cola:
  assert.equal(estado.filas.length, 1);
  assert.equal(estado.filas[0].estado, 'pendiente');
  assert.equal(estado.filas[0].reporte_id, 7);
  assert.deepEqual(estado.eventos, ['reporte_creado', 'prioridad', 'fila_creada', 'vision']);

  espera.resolver(analisisOk());
  await reportService.esperarAnalisisPendientes();

  // La MISMA fila pasa a completado (no se crea otra):
  assert.equal(estado.filas.length, 1);
  const fila = estado.filas[0];
  assert.equal(fila.estado, 'completado');
  assert.equal(fila.proveedor, 'TensorFlow-Local');
  assert.equal(fila.modelo, 'MobileNetV2-TeachableMachine');
  assert.equal(fila.version_modelo, 'tm-test@2026-11-11+sha256:abc123', 'version_modelo se guarda (antes quedaba null)');
  assert.equal(fila.error_code, null);
  assert.ok(!Number.isNaN(Date.parse(fila.analizado_at)));
  assert.deepEqual(fila.detecciones, [{ etiqueta: 'bache', confianza: 0.9, caja: null, severidad_sugerida: 'alta' }]);
  assert.deepEqual(estado.eventos, ['reporte_creado', 'prioridad', 'fila_creada', 'vision', 'fila_completado', 'prioridad']);
});

test('prioridad: provisional al crear y recalculada con la IA (4 + 1 + 1 = 6 → alta)', async () => {
  await crear();
  await reportService.esperarAnalisisPendientes();

  assert.equal(estado.prioridades.length, 2);
  const [provisional, final] = estado.prioridades;
  assert.equal(provisional.entrada.prioridad, 'media'); // 5 puntos sin IA ni vía
  assert.equal(provisional.entrada.version_reglas, 'prototipo-v1');
  assert.equal(provisional.entrada.motivos.find((m) => m.tipo === 'resumen').provisional, true);
  assert.equal(final.entrada.prioridad, 'alta');
  assert.equal(final.entrada.motivos.find((m) => m.tipo === 'resumen').puntaje, 6);
  assert.ok(final.entrada.motivos.some((m) => m.tipo === 'antecedente' && m.factor === 'analisis_imagen' && m.puntos === 1));
});

test('los motivos se guardan como objetos y declaran los datos no disponibles', async () => {
  await crear();
  await reportService.esperarAnalisisPendientes();
  const [provisional] = estado.prioridades;
  assert.ok(provisional.entrada.motivos.every(esObjetoPlano));
  const faltantes = provisional.entrada.motivos.filter((m) => m.tipo === 'dato_no_disponible').map((m) => m.factor);
  assert.deepEqual(faltantes, ['clasificacion_vial', 'analisis_imagen']);
});

test('los procesos automáticos actúan como sistema con ámbito de la municipalidad del reporte', async () => {
  await crear();
  await reportService.esperarAnalisisPendientes();
  for (const { scope, actor } of estado.prioridades) {
    assert.deepEqual(scope, { rol: 'administrador_municipal', municipalidad_id: 1 });
    assert.deepEqual(actor, { tipo_actor: 'sistema', actor_user_id: null, request_id: 'req-1' });
  }
  for (const contexto of estado.contextos) {
    assert.deepEqual(contexto.scope, { rol: 'administrador_municipal', municipalidad_id: 1 });
    assert.equal(contexto.actor.tipo_actor, 'sistema');
  }
});

test('si la IA no aporta, igual se completa la fila y la prioridad no baja', async () => {
  estado.vision = async () => analisisOk({ tipo_desperfecto: 'ninguno', severidad_sugerida: 'baja', confianza: 0.95 });
  await crear();
  await reportService.esperarAnalisisPendientes();
  assert.equal(estado.filas[0].estado, 'completado');
  assert.equal(estado.prioridades.at(-1).entrada.prioridad, 'media');
});

// ───────────── Regla de oro: la IA falla y el reporte se guarda igual ─────────────
for (const codigo of ['VISION_TIMEOUT', 'VISION_WORKER_CAIDO', 'VISION_PREPROCESO_FALLO', 'VISION_SATURADO']) {
  test(`la visión falla con ${codigo}: la MISMA fila pasa a "fallido" y el reporte ya estaba guardado`, async () => {
    estado.vision = async () => falloVision(codigo);
    const inicio = Date.now();
    const creado = await crear();
    assert.ok(Date.now() - inicio < 1000, 'el ciudadano no espera a la IA');
    assert.equal(creado.id, 7);
    await reportService.esperarAnalisisPendientes();

    assert.equal(estado.filas.length, 1);
    assert.equal(estado.filas[0].estado, 'fallido');
    assert.equal(estado.filas[0].error_code, codigo);
    assert.equal(estado.prioridades.length, 1, 'solo la provisional: sin IA no se recalcula');
  });
}

test('el modelo lanza una excepción inesperada: no hay rechazos sin manejar y la fila queda reprocesable', async () => {
  estado.vision = async () => { throw new Error('excepción no prevista'); };
  const creado = await crear();
  await reportService.esperarAnalisisPendientes();
  assert.equal(creado.id, 7);
  assert.equal(estado.filas[0].estado, 'pendiente');
  assert.ok(logsError.some((l) => l.includes('excepción no prevista')));
});

test('con el análisis REAL del modelo (sin severidad estimada): se guardan todas las clases y la IA aporta +0', async () => {
  const { interpretarPrediccion } = require('../src/services/visionPrediction');
  const real = interpretarPrediccion(['Bache', 'Calle Sana', 'Otro'], [0.93, 0.05, 0.02], { version_modelo: 'tm-real@x' });
  estado.vision = async () => ({ ok: true, analisis: real });
  await crear();
  await reportService.esperarAnalisisPendientes();
  const fila = estado.filas[0];
  assert.equal(fila.estado, 'completado');
  assert.equal(fila.version_modelo, 'tm-real@x');
  assert.deepEqual(fila.detecciones.map((d) => d.clase_modelo), ['Bache', 'Calle Sana', 'Otro']);
  assert.ok(fila.detecciones.every((d) => d.severidad_sugerida === null));
  const final = estado.prioridades.at(-1).entrada;
  assert.equal(final.motivos.find((m) => m.tipo === 'resumen').puntaje, 5); // 4 + 1 + 0, sin falsa discrepancia
  assert.ok(!final.motivos.some((m) => m.tipo === 'advertencia'));
});

test('visión deshabilitada: el reporte se crea (201) y el análisis queda "fallido" VISION_DESHABILITADA, sin analizar', async () => {
  process.env.VISION_ENABLED = 'false';
  const creado = await crear();
  await reportService.esperarAnalisisPendientes();
  assert.equal(creado.id, 7);
  assert.equal(estado.filas.length, 1);
  assert.equal(estado.filas[0].estado, 'fallido');
  assert.equal(estado.filas[0].error_code, 'VISION_DESHABILITADA');
  assert.equal(estado.llamadasVision, 0);
  assert.equal(estado.prioridades.length, 1, 'solo la provisional');
});

test('reproceso con una fila existente y visión deshabilitada: la fila pasa a "fallido", no queda pendiente', async () => {
  process.env.VISION_ENABLED = 'false';
  estado.filas.push({ id: 55, reporte_id: 7, estado: 'pendiente', detecciones: [] });
  estado.vision = async () => falloVision('VISION_DESHABILITADA');
  const reporte = { id: 7, municipalidad_id: 1, severidad: 'alta', concurrencia_vial: 'media', infraestructura_critica: 'ninguna', clasificacion_vial: null, clasificacion_vial_estado: 'pendiente' };
  await reportService.ejecutarAnalisisVision(reporte, imagenGuardada, { analisisId: 55 });
  assert.equal(estado.filas[0].estado, 'fallido');
  assert.equal(estado.filas[0].error_code, 'VISION_DESHABILITADA');
});

// ───────────── Clasificación vial resuelta por locationService ─────────────
test('el tipo de vía confirmado viaja a createReport y entra en la prioridad provisional', async () => {
  estado.ubicacionExtra = {
    clasificacion_vial: 'troncal', clasificacion_vial_estado: 'confirmada',
    clasificacion_vial_fuente: 'OpenStreetMap/Nominatim way/1 highway=primary -> troncal (osm-highway-v1, equivalencia no oficial)',
    clasificacion_vial_verificada_at: '2026-11-11T12:00:00.000Z',
  };
  await crear();
  await reportService.esperarAnalisisPendientes();
  const enviado = estado.creados[0];
  assert.equal(enviado.clasificacion_vial, 'troncal');
  assert.equal(enviado.clasificacion_vial_estado, 'confirmada');
  assert.ok(enviado.clasificacion_vial_fuente && enviado.clasificacion_vial_verificada_at);
  const [provisional] = estado.prioridades;
  assert.ok(provisional.entrada.motivos.some((m) => m.tipo === 'antecedente' && m.factor === 'clasificacion_vial' && m.valor === 'troncal'));
  const faltantes = provisional.entrada.motivos.filter((m) => m.tipo === 'dato_no_disponible').map((m) => m.factor);
  assert.deepEqual(faltantes, ['analisis_imagen']);
});

test('sin clasificación (valores ausentes en la ubicación): se guarda null / pendiente como antes', async () => {
  await crear();
  const enviado = estado.creados[0];
  assert.equal(enviado.clasificacion_vial, null);
  assert.equal(enviado.clasificacion_vial_estado, 'pendiente');
  assert.equal(enviado.clasificacion_vial_fuente, null);
  await reportService.esperarAnalisisPendientes();
});

// ───────────── Fallos de la infraestructura secundaria ─────────────
test('si no se puede crear la fila pendiente, no se ejecuta la inferencia y el reporte queda guardado', async () => {
  estado.fallaCrearFila = true;
  const creado = await crear();
  await reportService.esperarAnalisisPendientes();
  assert.equal(creado.id, 7);
  assert.equal(estado.llamadasVision, 0);
  assert.ok(logsError.some((l) => l.includes('INSERT análisis falló')));
});

test('si falla actualizar la fila tras la inferencia: queda "pendiente" para reproceso y no se recalcula', async () => {
  estado.fallaActualizarFila = true;
  const creado = await crear();
  await reportService.esperarAnalisisPendientes();
  assert.equal(creado.id, 7);
  assert.equal(estado.filas[0].estado, 'pendiente');
  assert.equal(estado.prioridades.length, 1);
  assert.ok(logsError.some((l) => l.includes('UPDATE análisis falló')));
});

test('si falla guardar la prioridad: el reporte se crea y el análisis continúa', async () => {
  estado.fallaPrioridad = true;
  const creado = await crear();
  await reportService.esperarAnalisisPendientes();
  assert.equal(creado.id, 7);
  assert.equal(estado.filas[0].estado, 'completado');
  assert.equal(estado.prioridades.length, 0);
  assert.ok(logsError.some((l) => l.includes('prioridad provisional')));
  assert.ok(logsError.some((l) => l.includes('recalcular la prioridad')));
});

test('persistencia no disponible: el reporte se guarda y no hay rechazos sin manejar', async () => {
  reportService._setPersistenciaParaPruebas(async () => { throw new Error('PostgreSQL no responde'); });
  const creado = await crear();
  await reportService.esperarAnalisisPendientes();
  assert.equal(creado.id, 7);
  assert.equal(estado.llamadasVision, 0);
  assert.ok(logsError.some((l) => l.includes('PostgreSQL no responde')));
});

test('sin resolvePhotoPath: el reporte se guarda, no se crea fila y se registra el problema', async () => {
  const original = dobles['./photoStorageService'].resolvePhotoPath;
  delete dobles['./photoStorageService'].resolvePhotoPath;
  try {
    const creado = await crear();
    await reportService.esperarAnalisisPendientes();
    assert.equal(creado.id, 7);
    assert.equal(estado.filas.length, 0);
    assert.ok(logsError.some((l) => l.includes('resolvePhotoPath')));
  } finally {
    dobles['./photoStorageService'].resolvePhotoPath = original;
  }
});

// ───────────── Creación y validación ─────────────
test('si falla la creación: se propaga el error, se borra la foto y no se toca la cola ni la IA', async () => {
  estado.fallaCrear = true;
  await assert.rejects(crear(), /BD caída/);
  assert.deepEqual(estado.eliminadas, ['aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.jpg']);
  await reportService.esperarAnalisisPendientes();
  assert.deepEqual(estado.eventos, []);
  assert.equal(estado.llamadasVision, 0);
});

test('datos inválidos: AppError 400 y no se crea nada', async () => {
  await assert.rejects(
    crear(datosValidos({ severidad: 'critica' })),
    (e) => e instanceof AppError && e.statusCode === 400 && e.code === 'VALIDATION_ERROR' && /Severidad inválida/.test(e.message)
  );
  assert.deepEqual(estado.eventos, []);
});

test('el temporal de Multer se elimina y el análisis usa la copia persistida', async () => {
  const foto = nuevaFotoMulter();
  await crear(datosValidos(), foto);
  assert.equal(fs.existsSync(foto.path), false);
  await reportService.esperarAnalisisPendientes();
  assert.equal(estado.llamadasVision, 1);
  assert.equal(estado.filas[0].estado, 'completado');
});

// ───────────── Motor, adaptador y reproceso ─────────────
test('calcularPrioridadProvisional devuelve null (sin lanzar) si el motor rechaza los datos', () => {
  assert.equal(reportService.calcularPrioridadProvisional({ severidad: 'critica', concurrencia_vial: 'media', infraestructura_critica: 'ninguna' }), null);
  assert.equal(reportService.calcularPrioridadProvisional(undefined), null);
  const ok = reportService.calcularPrioridadProvisional({ severidad: 'alta', concurrencia_vial: 'alta', infraestructura_critica: 'ninguna' });
  assert.equal(ok.prioridad, 'alta');
  assert.ok(logsError.some((l) => l.includes('Prioridad provisional no calculada')));
});

test('reproceso: con analisisId se reutiliza la fila existente en lugar de crear otra', async () => {
  estado.filas.push({ id: 55, reporte_id: 7, estado: 'fallido', error_code: 'VISION_TIMEOUT', detecciones: [] });
  const reporte = { id: 7, municipalidad_id: 1, severidad: 'alta', concurrencia_vial: 'media', infraestructura_critica: 'ninguna', clasificacion_vial: null, clasificacion_vial_estado: 'pendiente' };
  await reportService.ejecutarAnalisisVision(reporte, imagenGuardada, { analisisId: 55 });
  assert.equal(estado.filas.length, 1);
  assert.equal(estado.filas[0].estado, 'completado');
  assert.equal(estado.eventos.includes('fila_creada'), false);
  assert.equal(estado.prioridades.at(-1).entrada.prioridad, 'alta');
});

test('construirPrioridadParaGuardar es determinista (sin hora) para no reescribir ni auditar de más', () => {
  const { calcularPrioridad } = require('../src/services/priorityService');
  const base = { severidad: 'media', concurrencia_vial: 'baja', infraestructura_critica: 'otra', clasificacion_vial: null, clasificacion_vial_estado: 'pendiente' };
  const a = reportService.construirPrioridadParaGuardar(calcularPrioridad(base, null, { ahora: new Date('2026-01-01') }));
  const b = reportService.construirPrioridadParaGuardar(calcularPrioridad(base, null, { ahora: new Date('2026-12-31') }));
  assert.deepEqual(a, b);
  assert.ok(a.motivos.every(esObjetoPlano));
});

// ───────────── Contrato con los repositorios REALES de Elías ─────────────
const AT = new Date('2026-11-10T12:00:00.000Z');
function poolFalso(manejadores) {
  const llamadas = [];
  const client = {
    async query(sql, params = []) {
      const normalizada = sql.replace(/\s+/g, ' ').trim();
      llamadas.push({ sql: normalizada, params });
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(normalizada)) return { rows: [], rowCount: 0 };
      if (normalizada.startsWith('INSERT INTO auditoria_eventos')) return { rows: [{ id: 1, created_at: AT }], rowCount: 1 };
      for (const [prefijo, respuesta] of manejadores) {
        if (normalizada.startsWith(prefijo)) return respuesta(params);
      }
      throw new Error(`Consulta inesperada: ${normalizada}`);
    },
    release() {},
  };
  return { pool: { connect: async () => client }, llamadas };
}

test('contrato: las entradas de reportService son aceptadas por los repositorios reales', async () => {
  const reportes = await import('../src/repositories/reportRepository.js');
  const vision = await import('../src/repositories/visionAnalysisRepository.js');
  const scope = { rol: 'administrador_municipal', municipalidad_id: 1 };
  const actor = { tipo_actor: 'sistema', actor_user_id: null, request_id: 'req-1' };

  // 1) updateReportPriority con el formato que genera construirPrioridadParaGuardar
  const { calcularPrioridad } = require('../src/services/priorityService');
  const resultado = calcularPrioridad(
    { severidad: 'alta', concurrencia_vial: 'media', infraestructura_critica: 'ninguna', clasificacion_vial: null, clasificacion_vial_estado: 'pendiente' },
    null
  );
  const anterior = { id: 7, municipalidad_id: 1, prioridad: null, motivos: [], version_reglas: null, archivado_at: null };
  const prio = poolFalso([
    ['SELECT r.* FROM reportes r', () => ({ rows: [anterior], rowCount: 1 })],
    ['UPDATE reportes r', (p) => ({ rows: [{ ...anterior, prioridad: p[1], motivos: JSON.parse(p[2]), version_reglas: p[3] }], rowCount: 1 })],
  ]);
  const actualizado = await reportes.updateReportPriority(prio.pool, 7, reportService.construirPrioridadParaGuardar(resultado), scope, actor);
  assert.equal(actualizado.prioridad, 'media');
  assert.equal(actualizado.version_reglas, 'prototipo-v1');
  assert.ok(prio.llamadas.some((c) => c.sql.startsWith('UPDATE reportes')));

  // 2) createVisionAnalysis con la fila "pendiente"
  const crearFila = poolFalso([
    ['SELECT r.id FROM reportes', () => ({ rows: [{ id: 7 }], rowCount: 1 })],
    ['INSERT INTO analisis_vision', (p) => ({ rows: [{ id: 81, reporte_id: p[0], estado: p[4] }], rowCount: 1 })],
  ]);
  const fila = await vision.createVisionAnalysis(crearFila.pool, { reporte_id: 7, estado: 'pendiente', detecciones: [] }, { scope, actor });
  assert.equal(fila.estado, 'pendiente');
});
