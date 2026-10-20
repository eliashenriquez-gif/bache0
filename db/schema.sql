-- Bache 0 · Esquema PostgreSQL inicial para Hito 2
-- Ejecutar una sola vez sobre una base de datos VACÍA.
-- No borra ni reinicia datos existentes. Las imágenes se almacenan fuera de PostgreSQL.

BEGIN;

CREATE TABLE municipalidades (
    id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre                  VARCHAR(150) NOT NULL,
    comuna                  VARCHAR(100) NOT NULL,
    region                  VARCHAR(100) NOT NULL,
    comuna_key              VARCHAR(100) NOT NULL UNIQUE,
    geocodificacion_aliases TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
    activa                  BOOLEAN NOT NULL DEFAULT TRUE,
    servicio_activo         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_municipalidades_nombre_no_vacio
        CHECK (length(btrim(nombre)) > 0),
    CONSTRAINT ck_municipalidades_comuna_no_vacia
        CHECK (length(btrim(comuna)) > 0),
    CONSTRAINT ck_municipalidades_region_no_vacia
        CHECK (length(btrim(region)) > 0),
    CONSTRAINT ck_municipalidades_comuna_key
        CHECK (comuna_key ~ '^[a-z0-9]+([_-][a-z0-9]+)*$')
);

-- Evita duplicar una misma comuna/región por diferencias de mayúsculas o espacios.
CREATE UNIQUE INDEX uq_municipalidades_comuna_region_normalizada
    ON municipalidades (lower(btrim(comuna)), lower(btrim(region)));
CREATE INDEX idx_municipalidades_cobertura
    ON municipalidades (activa, servicio_activo, comuna_key);

CREATE TABLE usuarios (
    id                      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    municipalidad_id        INTEGER NULL REFERENCES municipalidades(id) ON DELETE RESTRICT,
    nombre_completo         VARCHAR(150) NOT NULL,
    email                   VARCHAR(254) NOT NULL,
    email_normalizado       VARCHAR(254) GENERATED ALWAYS AS (lower(btrim(email))) STORED,
    password_hash           TEXT NOT NULL,
    rol                     VARCHAR(32) NOT NULL,
    activo                  BOOLEAN NOT NULL DEFAULT TRUE,
    ultimo_login_at         TIMESTAMPTZ NULL,
    desactivado_at          TIMESTAMPTZ NULL,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_usuarios_email_normalizado UNIQUE (email_normalizado),
    CONSTRAINT ck_usuarios_nombre_no_vacio
        CHECK (length(btrim(nombre_completo)) > 0),
    CONSTRAINT ck_usuarios_email_formato
        CHECK (email_normalizado ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
    CONSTRAINT ck_usuarios_password_argon2id
        CHECK (password_hash LIKE '$argon2id$%'),
    CONSTRAINT ck_usuarios_rol
        CHECK (rol IN ('inspector', 'administrador_municipal', 'superadministrador')),
    CONSTRAINT ck_usuarios_municipalidad_por_rol
        CHECK (
            (rol = 'superadministrador' AND municipalidad_id IS NULL)
            OR
            (rol IN ('inspector', 'administrador_municipal') AND municipalidad_id IS NOT NULL)
        ),
    CONSTRAINT ck_usuarios_estado_desactivacion
        CHECK ((activo = TRUE AND desactivado_at IS NULL) OR (activo = FALSE AND desactivado_at IS NOT NULL))
);
CREATE INDEX idx_usuarios_municipalidad_activos
    ON usuarios (municipalidad_id, rol, activo);

CREATE TABLE reportes (
    id                              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    folio                           VARCHAR(32) NOT NULL UNIQUE,
    municipalidad_id                INTEGER NOT NULL REFERENCES municipalidades(id) ON DELETE RESTRICT,

    latitud                         NUMERIC(9, 6) NOT NULL,
    longitud                        NUMERIC(9, 6) NOT NULL,
    precision_ubicacion_m           NUMERIC(8, 2) NULL,
    metodo_ubicacion                VARCHAR(20) NOT NULL,
    ubicacion_confirmada            BOOLEAN NOT NULL DEFAULT FALSE,

    direccion_detectada             VARCHAR(250) NULL,
    calle_detectada                 VARCHAR(180) NULL,
    comuna_detectada                VARCHAR(100) NOT NULL,
    region_detectada                VARCHAR(100) NOT NULL,
    estado_geocodificacion          VARCHAR(32) NOT NULL,
    geocodificacion_proveedor       VARCHAR(100) NULL,
    geocodificacion_resuelta_at     TIMESTAMPTZ NULL,
    estado_asignacion               VARCHAR(24) NOT NULL DEFAULT 'asignado',

    clasificacion_vial              VARCHAR(24) NULL,
    clasificacion_vial_estado       VARCHAR(24) NOT NULL DEFAULT 'pendiente',
    clasificacion_vial_fuente       VARCHAR(300) NULL,
    clasificacion_vial_verificada_at TIMESTAMPTZ NULL,

    severidad                       VARCHAR(12) NOT NULL,
    estado                          VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    concurrencia_vial               VARCHAR(12) NOT NULL,
    infraestructura_critica         VARCHAR(24) NOT NULL,
    descripcion                     VARCHAR(2000) NULL,

    -- Solo metadatos y clave relativa. Nunca se guarda el binario en PostgreSQL.
    foto_storage_key                VARCHAR(500) NOT NULL UNIQUE,
    foto_mime_type                  VARCHAR(40) NOT NULL,
    foto_size_bytes                 BIGINT NOT NULL,
    foto_sha256                     CHAR(64) NOT NULL,
    foto_ancho_px                   INTEGER NULL,
    foto_alto_px                    INTEGER NULL,

    archivado_at                    TIMESTAMPTZ NULL,
    created_at                      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT ck_reportes_folio_no_vacio CHECK (length(btrim(folio)) > 0),
    CONSTRAINT ck_reportes_latitud CHECK (latitud BETWEEN -90 AND 90),
    CONSTRAINT ck_reportes_longitud CHECK (longitud BETWEEN -180 AND 180),
    CONSTRAINT ck_reportes_precision CHECK (precision_ubicacion_m IS NULL OR precision_ubicacion_m >= 0),
    CONSTRAINT ck_reportes_metodo_ubicacion CHECK (metodo_ubicacion IN ('gps', 'pin_manual')),
    CONSTRAINT ck_reportes_pin_confirmado CHECK (ubicacion_confirmada IS TRUE),
    CONSTRAINT ck_reportes_geocodificacion CHECK (estado_geocodificacion IN ('resuelta', 'parcial')),
    CONSTRAINT ck_reportes_asignacion CHECK (estado_asignacion = 'asignado'),
    CONSTRAINT ck_reportes_clasificacion_vial CHECK (
        clasificacion_vial IS NULL OR
        clasificacion_vial IN ('expresa', 'troncal', 'colectora', 'servicio', 'local')
    ),
    CONSTRAINT ck_reportes_clasificacion_vial_consistencia CHECK (
        (clasificacion_vial IS NULL
            AND clasificacion_vial_estado IN ('ambigua', 'pendiente', 'no_disponible')
            AND clasificacion_vial_fuente IS NULL
            AND clasificacion_vial_verificada_at IS NULL)
        OR
        (clasificacion_vial IS NOT NULL
            AND clasificacion_vial_estado = 'confirmada'
            AND clasificacion_vial_fuente IS NOT NULL
            AND clasificacion_vial_verificada_at IS NOT NULL)
    ),
    CONSTRAINT ck_reportes_clasificacion_vial_estado CHECK (
        clasificacion_vial_estado IN ('confirmada', 'ambigua', 'pendiente', 'no_disponible')
    ),
    CONSTRAINT ck_reportes_severidad CHECK (severidad IN ('baja', 'media', 'alta')),
    CONSTRAINT ck_reportes_estado CHECK (estado IN ('pendiente', 'en_revision', 'reparado')),
    CONSTRAINT ck_reportes_concurrencia CHECK (concurrencia_vial IN ('baja', 'media', 'alta', 'muy_alta')),
    CONSTRAINT ck_reportes_infraestructura CHECK (
        infraestructura_critica IN ('ninguna', 'colegio', 'centro_salud', 'estacion_terminal', 'otra')
    ),
    CONSTRAINT ck_reportes_descripcion CHECK (descripcion IS NULL OR length(descripcion) <= 2000),
    CONSTRAINT ck_reportes_foto_mime CHECK (foto_mime_type IN ('image/jpeg', 'image/png', 'image/webp')),
    CONSTRAINT ck_reportes_foto_tamano CHECK (foto_size_bytes BETWEEN 1 AND 10485760),
    CONSTRAINT ck_reportes_foto_sha256 CHECK (foto_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_reportes_foto_dimensiones CHECK (
        (foto_ancho_px IS NULL AND foto_alto_px IS NULL)
        OR (foto_ancho_px IS NOT NULL AND foto_alto_px IS NOT NULL AND foto_ancho_px > 0 AND foto_alto_px > 0)
    ),
    CONSTRAINT ck_reportes_foto_storage_key CHECK (
        length(btrim(foto_storage_key)) > 0
        AND foto_storage_key NOT LIKE '/%'
        AND position('..' IN foto_storage_key) = 0
    )
);
CREATE INDEX idx_reportes_municipalidad_estado_fecha
    ON reportes (municipalidad_id, estado, created_at DESC)
    WHERE archivado_at IS NULL;
CREATE INDEX idx_reportes_fecha
    ON reportes (created_at DESC);
CREATE INDEX idx_reportes_coordenadas
    ON reportes (latitud, longitud);
CREATE INDEX idx_reportes_geocodificacion
    ON reportes (estado_geocodificacion, comuna_detectada, region_detectada);

CREATE TABLE analisis_vision (
    id                  INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    reporte_id          INTEGER NOT NULL REFERENCES reportes(id) ON DELETE RESTRICT,
    proveedor           VARCHAR(100) NULL,
    modelo              VARCHAR(200) NULL,
    version_modelo      VARCHAR(100) NULL,
    estado              VARCHAR(20) NOT NULL DEFAULT 'pendiente',
    detecciones         JSONB NOT NULL DEFAULT '[]'::JSONB,
    error_code          VARCHAR(80) NULL,
    analizado_at        TIMESTAMPTZ NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_analisis_vision_estado
        CHECK (estado IN ('pendiente', 'procesando', 'completado', 'fallido')),
    CONSTRAINT ck_analisis_vision_detecciones_array
        CHECK (jsonb_typeof(detecciones) = 'array'),
    CONSTRAINT ck_analisis_vision_completado
        CHECK (estado <> 'completado' OR (proveedor IS NOT NULL AND modelo IS NOT NULL AND analizado_at IS NOT NULL))
);
CREATE INDEX idx_analisis_vision_reporte_fecha
    ON analisis_vision (reporte_id, created_at DESC);

CREATE TABLE auditoria_eventos (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    actor_user_id   INTEGER NULL REFERENCES usuarios(id) ON DELETE RESTRICT,
    tipo_actor      VARCHAR(20) NOT NULL,
    entidad         VARCHAR(32) NOT NULL,
    entidad_id      BIGINT NOT NULL,
    accion          VARCHAR(80) NOT NULL,
    cambios         JSONB NOT NULL DEFAULT '{}'::JSONB,
    request_id      VARCHAR(100) NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_auditoria_tipo_actor CHECK (tipo_actor IN ('funcionario', 'invitado', 'sistema')),
    CONSTRAINT ck_auditoria_actor_consistencia CHECK (
        (tipo_actor = 'funcionario' AND actor_user_id IS NOT NULL)
        OR (tipo_actor IN ('invitado', 'sistema') AND actor_user_id IS NULL)
    ),
    CONSTRAINT ck_auditoria_entidad CHECK (entidad IN ('municipalidades', 'usuarios', 'reportes', 'analisis_vision')),
    CONSTRAINT ck_auditoria_entidad_id CHECK (entidad_id > 0),
    CONSTRAINT ck_auditoria_accion_no_vacia CHECK (length(btrim(accion)) > 0),
    CONSTRAINT ck_auditoria_cambios_objeto CHECK (jsonb_typeof(cambios) = 'object')
);
CREATE INDEX idx_auditoria_entidad_fecha
    ON auditoria_eventos (entidad, entidad_id, created_at DESC);
CREATE INDEX idx_auditoria_actor_fecha
    ON auditoria_eventos (actor_user_id, created_at DESC)
    WHERE actor_user_id IS NOT NULL;

-- Los folios se generan en el servidor; los clientes no pueden imponerlos.
CREATE OR REPLACE FUNCTION generar_folio_reporte()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.folio IS NULL OR length(btrim(NEW.folio)) = 0 THEN
        NEW.folio := 'BA-' || to_char(CURRENT_TIMESTAMP AT TIME ZONE 'UTC', 'YYYY') || '-' || lpad(NEW.id::TEXT, 6, '0');
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_reportes_generar_folio
    BEFORE INSERT ON reportes
    FOR EACH ROW EXECUTE FUNCTION generar_folio_reporte();

CREATE OR REPLACE FUNCTION actualizar_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at := clock_timestamp();
    RETURN NEW;
END;
$$;
CREATE TRIGGER trg_municipalidades_updated_at
    BEFORE UPDATE ON municipalidades
    FOR EACH ROW EXECUTE FUNCTION actualizar_updated_at();
CREATE TRIGGER trg_usuarios_updated_at
    BEFORE UPDATE ON usuarios
    FOR EACH ROW EXECUTE FUNCTION actualizar_updated_at();
CREATE TRIGGER trg_reportes_updated_at
    BEFORE UPDATE ON reportes
    FOR EACH ROW EXECUTE FUNCTION actualizar_updated_at();
CREATE TRIGGER trg_analisis_vision_updated_at
    BEFORE UPDATE ON analisis_vision
    FOR EACH ROW EXECUTE FUNCTION actualizar_updated_at();

-- Los eventos de auditoría son append-only: la API no puede editarlos ni borrarlos.
CREATE OR REPLACE FUNCTION impedir_mutacion_auditoria()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'Los eventos de auditoría son inmutables.' USING ERRCODE = '55000';
END;
$$;
CREATE TRIGGER trg_auditoria_inmutable
    BEFORE UPDATE OR DELETE ON auditoria_eventos
    FOR EACH ROW EXECUTE FUNCTION impedir_mutacion_auditoria();

COMMIT;
