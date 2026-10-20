-- Bache 0 · Datos demostrativos reproducibles.
-- Ejecutar DESPUÉS de schema.sql. No incluye usuarios ni contraseñas predefinidas.
-- Las fotografías de ejemplo se copian al almacenamiento privado con `npm run seed:photos`.

BEGIN;

INSERT INTO municipalidades
    (nombre, comuna, region, comuna_key, geocodificacion_aliases, activa, servicio_activo)
VALUES
    ('Municipalidad de Estación Central', 'Estación Central', 'Región Metropolitana de Santiago', 'estacion_central', ARRAY['Estacion Central'], TRUE, TRUE),
    ('Municipalidad de La Pintana', 'La Pintana', 'Región Metropolitana de Santiago', 'la_pintana', ARRAY[]::TEXT[], TRUE, TRUE),
    ('Municipalidad de El Bosque', 'El Bosque', 'Región Metropolitana de Santiago', 'el_bosque', ARRAY[]::TEXT[], TRUE, TRUE),
    ('Municipalidad de Providencia', 'Providencia', 'Región Metropolitana de Santiago', 'providencia', ARRAY[]::TEXT[], TRUE, FALSE)
ON CONFLICT (comuna_key) DO UPDATE SET
    nombre = EXCLUDED.nombre,
    comuna = EXCLUDED.comuna,
    region = EXCLUDED.region,
    geocodificacion_aliases = EXCLUDED.geocodificacion_aliases,
    activa = EXCLUDED.activa,
    servicio_activo = EXCLUDED.servicio_activo;

-- La cobertura de Providencia se deja deshabilitada intencionalmente para probar
-- el mensaje MUNICIPALIDAD_SIN_COBERTURA; no se insertan reportes para esa comuna.

INSERT INTO reportes (
    folio, municipalidad_id,
    latitud, longitud, precision_ubicacion_m, metodo_ubicacion, ubicacion_confirmada,
    direccion_detectada, calle_detectada, comuna_detectada, region_detectada,
    estado_geocodificacion, geocodificacion_proveedor, geocodificacion_resuelta_at,
    estado_asignacion, clasificacion_vial, clasificacion_vial_estado,
    severidad, estado, concurrencia_vial, infraestructura_critica, descripcion,
    foto_storage_key, foto_mime_type, foto_size_bytes, foto_sha256, foto_ancho_px, foto_alto_px
)
SELECT
    'BA-2026-99001', m.id,
    -33.460200, -70.698100, 12.50, 'gps', TRUE,
    'Av. Pajaritos, Estación Central', 'Avenida Pajaritos', 'Estación Central', 'Región Metropolitana de Santiago',
    'resuelta', 'seed-fixture', CURRENT_TIMESTAMP,
    'asignado', NULL, 'pendiente',
    'alta', 'pendiente', 'muy_alta', 'estacion_terminal',
    'Bache de demostración en calzada principal; datos ficticios para pruebas locales.',
    'seed/demo-report-001.png', 'image/png', 3660,
    'ffd3286825bdb9b6e0e0cea9d7a1067dedac4a175548d5c77b203e47d7298b24', 640, 360
FROM municipalidades m WHERE m.comuna_key = 'estacion_central'
ON CONFLICT (folio) DO NOTHING;

INSERT INTO reportes (
    folio, municipalidad_id,
    latitud, longitud, precision_ubicacion_m, metodo_ubicacion, ubicacion_confirmada,
    direccion_detectada, calle_detectada, comuna_detectada, region_detectada,
    estado_geocodificacion, geocodificacion_proveedor, geocodificacion_resuelta_at,
    estado_asignacion, clasificacion_vial, clasificacion_vial_estado,
    severidad, estado, concurrencia_vial, infraestructura_critica, descripcion,
    foto_storage_key, foto_mime_type, foto_size_bytes, foto_sha256, foto_ancho_px, foto_alto_px
)
SELECT
    'BA-2026-99002', m.id,
    -33.582800, -70.634600, 9.00, 'gps', TRUE,
    'Sector Santa Rosa, La Pintana', 'Avenida Santa Rosa', 'La Pintana', 'Región Metropolitana de Santiago',
    'resuelta', 'seed-fixture', CURRENT_TIMESTAMP,
    'asignado', NULL, 'pendiente',
    'media', 'en_revision', 'alta', 'centro_salud',
    'Deterioro de demostración con ubicación confirmada; datos ficticios para pruebas locales.',
    'seed/demo-report-002.png', 'image/png', 3793,
    '6db922141d2a2f77d7bd375a3b559be15103a1ea2598faed6de116688b839a79', 640, 360
FROM municipalidades m WHERE m.comuna_key = 'la_pintana'
ON CONFLICT (folio) DO NOTHING;

INSERT INTO reportes (
    folio, municipalidad_id,
    latitud, longitud, precision_ubicacion_m, metodo_ubicacion, ubicacion_confirmada,
    direccion_detectada, calle_detectada, comuna_detectada, region_detectada,
    estado_geocodificacion, geocodificacion_proveedor, geocodificacion_resuelta_at,
    estado_asignacion, clasificacion_vial, clasificacion_vial_estado,
    severidad, estado, concurrencia_vial, infraestructura_critica, descripcion,
    foto_storage_key, foto_mime_type, foto_size_bytes, foto_sha256, foto_ancho_px, foto_alto_px
)
SELECT
    'BA-2026-99003', m.id,
    -33.578500, -70.672000, NULL, 'pin_manual', TRUE,
    'Sector Gran Avenida, El Bosque', 'Gran Avenida', 'El Bosque', 'Región Metropolitana de Santiago',
    'parcial', 'seed-fixture', CURRENT_TIMESTAMP,
    'asignado', NULL, 'no_disponible',
    'baja', 'reparado', 'media', 'ninguna',
    'Reporte de demostración resuelto sin clasificación vial oficial; datos ficticios.',
    'seed/demo-report-003.png', 'image/png', 3774,
    'aa27f2cd9fbc2571e56a379a682587aa55b6c21746fbac727002cdbfdbe7738d', 640, 360
FROM municipalidades m WHERE m.comuna_key = 'el_bosque'
ON CONFLICT (folio) DO NOTHING;

COMMIT;
