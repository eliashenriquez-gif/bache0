'use strict';

// Ejecutar con: node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');

const REGLAS = require('../src/services/priorityRules');
const { calcularPrioridad, nivelPara, PriorityInputError } = require('../src/services/priorityService');

const AHORA = new Date('2026-11-10T12:00:00.000Z');

const reporte = (extra = {}) => ({
  severidad: 'media',
  concurrencia_vial: 'baja',
  infraestructura_critica: 'ninguna',
  clasificacion_vial: null,
  clasificacion_vial_estado: 'pendiente',
  clasificacion_vial_fuente: null,
  ...extra,
});

const viaConfirmada = (tipo) => ({
  clasificacion_vial: tipo,
  clasificacion_vial_estado: 'confirmada',
  clasificacion_vial_fuente: 'fuente-de-prueba',
});

const analisis = (deteccion = {}, extra = {}) => ({
  estado: 'completado',
  proveedor: 'google-gemini',
  modelo: 'gemini-2.5-flash',
  detecciones: [{ etiqueta: 'bache', confianza: 0.9, severidad_sugerida: 'alta', ...deteccion }],
  ...extra,
});

const calcular = (r, a = null) => calcularPrioridad(r, a, { ahora: AHORA });
const ORDEN = { baja: 0, media: 1, alta: 2 };

// ───────────── Umbrales ─────────────
test('nivelPara respeta los umbrales de prototipo-v1', () => {
  assert.equal(nivelPara(0), 'baja');
  assert.equal(nivelPara(2), 'baja');
  assert.equal(nivelPara(3), 'media');
  assert.equal(nivelPara(5), 'media');
  assert.equal(nivelPara(6), 'alta');
  assert.equal(nivelPara(12), 'alta');
});

// ───────────── Tabla de casos (solo datos del ciudadano) ─────────────
const CASOS = [
  // [severidad, concurrencia, infraestructura, puntaje, prioridad, provisional]
  ['alta', 'alta', 'ninguna', 6, 'alta', false],
  ['media', 'muy_alta', 'colegio', 7, 'alta', false],
  ['alta', 'alta', 'centro_salud', 8, 'alta', false],
  ['baja', 'muy_alta', 'colegio', 5, 'media', true],
  ['alta', 'baja', 'ninguna', 4, 'media', true],
  ['media', 'media', 'ninguna', 3, 'media', true],
  ['media', 'baja', 'otra', 3, 'media', true],
  ['media', 'baja', 'ninguna', 2, 'baja', true],
  ['baja', 'baja', 'ninguna', 0, 'baja', true],
  ['baja', 'alta', 'estacion_terminal', 4, 'media', true],
];

for (const [severidad, concurrencia_vial, infraestructura_critica, puntaje, prioridad, provisional] of CASOS) {
  test(`caso: ${severidad} / ${concurrencia_vial} / ${infraestructura_critica} → ${prioridad} (${puntaje})`, () => {
    const r = calcular(reporte({ severidad, concurrencia_vial, infraestructura_critica }));
    assert.equal(r.puntaje, puntaje);
    assert.equal(r.prioridad, prioridad);
    assert.equal(r.provisional, provisional);
  });
}

// ───────────── Estructura y trazabilidad ─────────────
test('el resultado es explicable y lleva versión de reglas', () => {
  const r = calcular(reporte({ severidad: 'media', concurrencia_vial: 'media' }));
  assert.equal(r.version_reglas, 'prototipo-v1');
  assert.equal(r.calculada_at, AHORA.toISOString());
  assert.deepEqual(
    r.antecedentes.map((a) => a.factor),
    ['gravedad_declarada', 'concurrencia_vial', 'infraestructura_critica']
  );
  assert.equal(r.motivos.length, 3);
  assert.deepEqual(r.datos_no_disponibles, ['clasificacion_vial', 'analisis_imagen']);
  assert.deepEqual(r.advertencias, []);
  assert.deepEqual(r.rango_posible, { minimo: 3, maximo: 6, nivel_minimo: 'media', nivel_maximo: 'alta' });
});

test('los antecedentes suman exactamente el puntaje', () => {
  const r = calcular(
    reporte({ severidad: 'alta', concurrencia_vial: 'media', ...viaConfirmada('colectora') }),
    analisis()
  );
  assert.equal(r.antecedentes.reduce((s, a) => s + a.puntos, 0), r.puntaje);
});

// ───────────── Tipo de vía ─────────────
test('tipo de vía confirmado suma puntos y se registra su fuente', () => {
  const r = calcular(reporte({ concurrencia_vial: 'media', ...viaConfirmada('troncal') }));
  assert.equal(r.puntaje, 5); // 2 + 1 + 0 + 2
  assert.equal(r.prioridad, 'media');
  assert.equal(r.provisional, true); // falta IA: podría llegar a 6
  assert.deepEqual(r.datos_no_disponibles, ['analisis_imagen']);
  assert.equal(r.antecedentes.find((a) => a.factor === 'clasificacion_vial').fuente, 'fuente-de-prueba');
});

test('vía local confirmada no suma', () => {
  const r = calcular(reporte({ concurrencia_vial: 'media', ...viaConfirmada('local') }));
  assert.equal(r.puntaje, 3);
});

for (const estado of ['pendiente', 'ambigua', 'no_disponible']) {
  test(`vía con estado "${estado}" se ignora aunque traiga un valor`, () => {
    const r = calcular(reporte({ clasificacion_vial: 'expresa', clasificacion_vial_estado: estado }));
    assert.equal(r.puntaje, 2);
    assert.ok(r.datos_no_disponibles.includes('clasificacion_vial'));
  });
}

// ───────────── Análisis de imagen ─────────────
test('IA corrobora con severidad alta: suma exactamente +1', () => {
  const base = reporte({ severidad: 'alta', concurrencia_vial: 'media' });
  const sin = calcular(base);
  const con = calcular(base, analisis());
  assert.equal(sin.puntaje, 5);
  assert.equal(sin.prioridad, 'media');
  assert.equal(con.puntaje, 6);
  assert.equal(con.prioridad, 'alta');
  assert.equal(con.provisional, false); // 6 + posible vía (2) sigue siendo alta
  assert.deepEqual(con.datos_no_disponibles, ['clasificacion_vial']);
});

test('el aporte de la IA nunca supera el tope aunque todo sea máximo', () => {
  const base = reporte({
    severidad: 'alta',
    concurrencia_vial: 'muy_alta',
    infraestructura_critica: 'colegio',
    ...viaConfirmada('troncal'),
  });
  const sin = calcular(base);
  const con = calcular(base, analisis({ confianza: 1 }));
  assert.equal(sin.puntaje, 11);
  assert.equal(con.puntaje - sin.puntaje, REGLAS.IA.puntos_maximos);
});

test('IA con "ninguno" y alta confianza NO baja la prioridad y advierte', () => {
  const base = reporte({ severidad: 'alta', concurrencia_vial: 'media' });
  const sin = calcular(base);
  const con = calcular(base, analisis({ etiqueta: 'ninguno', severidad_sugerida: 'baja', confianza: 0.95 }));
  assert.equal(con.puntaje, sin.puntaje);
  assert.equal(con.prioridad, sin.prioridad);
  assert.ok(con.advertencias.some((a) => a.startsWith('revisar_fotografia')));
});

test('IA con confianza bajo el umbral no suma', () => {
  const r = calcular(reporte({ severidad: 'alta', concurrencia_vial: 'media' }), analisis({ confianza: 0.4 }));
  assert.equal(r.puntaje, 5);
  assert.equal(r.antecedentes.at(-1).puntos, 0);
});

test('IA con severidad sugerida menor no suma y registra la discrepancia', () => {
  const r = calcular(reporte({ severidad: 'alta' }), analisis({ severidad_sugerida: 'media' }));
  assert.equal(r.puntaje, 4);
  assert.ok(r.advertencias.some((a) => a.startsWith('discrepancia_severidad')));
});

test('IA con tipo "otro" no corrobora', () => {
  const r = calcular(reporte({ severidad: 'alta' }), analisis({ etiqueta: 'otro' }));
  assert.equal(r.puntaje, 4);
});

test('con varias detecciones se usa la de mayor confianza', () => {
  const r = calcular(
    reporte({ severidad: 'alta' }),
    analisis({}, { detecciones: [
      { etiqueta: 'bache', confianza: 0.3, severidad_sugerida: 'baja' },
      { etiqueta: 'bache', confianza: 0.8, severidad_sugerida: 'alta' },
    ] })
  );
  assert.equal(r.puntaje, 5);
});

for (const estado of ['pendiente', 'procesando', 'fallido']) {
  test(`análisis en estado "${estado}" cuenta como no disponible y deja el resultado provisional`, () => {
    const r = calcular(reporte({ severidad: 'alta', concurrencia_vial: 'media' }), analisis({}, { estado }));
    assert.equal(r.puntaje, 5);
    assert.ok(r.datos_no_disponibles.includes('analisis_imagen'));
    assert.equal(r.provisional, true);
  });
}

test('datos de IA inválidos se ignoran sin lanzar error', () => {
  const casos = [
    analisis({ etiqueta: 'pothole' }),
    analisis({ confianza: NaN }),
    analisis({ confianza: 1.5 }),
    analisis({ confianza: '0.9' }),
    analisis({ severidad_sugerida: 'critica' }),
    analisis({}, { detecciones: [] }),
    analisis({}, { detecciones: null }),
    analisis({}, { detecciones: [null, 5, 'x'] }),
    { estado: 'completado' },
  ];
  for (const a of casos) {
    const r = calcular(reporte({ severidad: 'alta', concurrencia_vial: 'media' }), a);
    assert.equal(r.puntaje, 5);
    assert.ok(r.datos_no_disponibles.includes('analisis_imagen'));
    assert.ok(r.advertencias.length > 0 || a.estado === 'completado');
  }
});

test('un resultado de proveedor simulado (mock) se ignora', () => {
  const r = calcular(reporte({ severidad: 'alta', concurrencia_vial: 'media' }), analisis({}, { proveedor: 'mock-heuristico' }));
  assert.equal(r.puntaje, 5);
  assert.ok(r.datos_no_disponibles.includes('analisis_imagen'));
  assert.ok(r.advertencias.length === 1);
});

// ───────────── Propiedades ─────────────
const ESCALAS = {
  severidad: ['baja', 'media', 'alta'],
  concurrencia_vial: ['baja', 'media', 'alta', 'muy_alta'],
  infraestructura_critica: ['ninguna', 'otra', 'colegio'],
  via: [null, 'local', 'colectora', 'troncal'],
};

function construir(sev, conc, infra, via) {
  return reporte({
    severidad: sev,
    concurrencia_vial: conc,
    infraestructura_critica: infra,
    ...(via ? viaConfirmada(via) : {}),
  });
}

test('monotonicidad: subir un factor nunca baja el puntaje ni el nivel', () => {
  const { severidad, concurrencia_vial, infraestructura_critica, via } = ESCALAS;
  for (const s of severidad) for (const c of concurrencia_vial) for (const i of infraestructura_critica) for (const v of via) {
    const variantes = {
      severidad: (x) => construir(x, c, i, v),
      concurrencia_vial: (x) => construir(s, x, i, v),
      infraestructura_critica: (x) => construir(s, c, x, v),
      via: (x) => construir(s, c, i, x),
    };
    for (const [factor, escala] of Object.entries(ESCALAS)) {
      for (let k = 0; k < escala.length - 1; k += 1) {
        const bajo = calcular(variantes[factor](escala[k]));
        const alto = calcular(variantes[factor](escala[k + 1]));
        assert.ok(alto.puntaje >= bajo.puntaje, `${factor}: ${escala[k]} → ${escala[k + 1]}`);
        assert.ok(ORDEN[alto.prioridad] >= ORDEN[bajo.prioridad]);
      }
    }
  }
});

test('la IA nunca reduce el puntaje respecto a no tener análisis', () => {
  const { severidad, concurrencia_vial, infraestructura_critica, via } = ESCALAS;
  const analisisPosibles = [
    analisis(),
    analisis({ etiqueta: 'ninguno', severidad_sugerida: 'baja' }),
    analisis({ confianza: 0.1 }),
    analisis({ severidad_sugerida: 'baja' }),
  ];
  for (const s of severidad) for (const c of concurrencia_vial) for (const i of infraestructura_critica) for (const v of via) {
    const base = construir(s, c, i, v);
    const sin = calcular(base);
    for (const a of analisisPosibles) {
      const con = calcular(base, a);
      assert.ok(con.puntaje >= sin.puntaje);
      assert.ok(con.puntaje - sin.puntaje <= REGLAS.IA.puntos_maximos);
    }
  }
});

test('coherencia del rango: provisional ⇔ el nivel máximo difiere del mínimo', () => {
  const { severidad, concurrencia_vial, infraestructura_critica, via } = ESCALAS;
  for (const s of severidad) for (const c of concurrencia_vial) for (const i of infraestructura_critica) for (const v of via) {
    const r = calcular(construir(s, c, i, v));
    assert.equal(r.rango_posible.minimo, r.puntaje);
    assert.equal(r.prioridad, r.rango_posible.nivel_minimo);
    assert.ok(r.rango_posible.maximo >= r.rango_posible.minimo);
    assert.equal(r.provisional, r.rango_posible.nivel_minimo !== r.rango_posible.nivel_maximo);
  }
});

test('es determinista y no muta sus entradas', () => {
  const congelar = (o) => { Object.values(o).forEach((v) => v && typeof v === 'object' && congelar(v)); return Object.freeze(o); };
  const r = congelar(reporte({ severidad: 'alta', concurrencia_vial: 'media', ...viaConfirmada('colectora') }));
  const a = congelar(analisis());
  assert.deepEqual(calcular(r, a), calcular(r, a));
});

test('las reglas están congeladas', () => {
  assert.ok(Object.isFrozen(REGLAS));
  assert.ok(Object.isFrozen(REGLAS.PUNTOS.severidad));
});

// ───────────── Entradas inválidas ─────────────
test('datos obligatorios inválidos lanzan PriorityInputError', () => {
  const invalidos = [
    reporte({ severidad: 'critica' }),
    reporte({ severidad: undefined }),
    reporte({ concurrencia_vial: 'extrema' }),
    reporte({ infraestructura_critica: '__proto__' }),
    reporte({ infraestructura_critica: 'constructor' }),
    null,
    undefined,
    'texto',
  ];
  for (const r of invalidos) {
    assert.throws(() => calcular(r), (e) => e instanceof PriorityInputError && e.code === 'PRIORIDAD_ENTRADA_INVALIDA');
  }
});
