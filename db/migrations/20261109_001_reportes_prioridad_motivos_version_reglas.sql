-- Bache 0 · Hito 3: datos explicables del motor de prioridad.
-- Aplicar una vez en bases existentes. Es idempotente para permitir re-ejecución segura.
-- No calcula ni inventa prioridades: los campos quedan sin evaluar hasta que Vision/PriorityService los escriba.

BEGIN;

ALTER TABLE reportes
    ADD COLUMN IF NOT EXISTS prioridad VARCHAR(20) NULL,
    ADD COLUMN IF NOT EXISTS motivos JSONB NOT NULL DEFAULT '[]'::JSONB,
    ADD COLUMN IF NOT EXISTS version_reglas VARCHAR(80) NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ck_reportes_prioridad_no_vacia'
          AND conrelid = 'reportes'::regclass
    ) THEN
        ALTER TABLE reportes
            ADD CONSTRAINT ck_reportes_prioridad_no_vacia
            CHECK (prioridad IS NULL OR length(btrim(prioridad)) BETWEEN 1 AND 20);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ck_reportes_motivos_array'
          AND conrelid = 'reportes'::regclass
    ) THEN
        ALTER TABLE reportes
            ADD CONSTRAINT ck_reportes_motivos_array
            CHECK (jsonb_typeof(motivos) = 'array');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ck_reportes_version_reglas_no_vacia'
          AND conrelid = 'reportes'::regclass
    ) THEN
        ALTER TABLE reportes
            ADD CONSTRAINT ck_reportes_version_reglas_no_vacia
            CHECK (version_reglas IS NULL OR length(btrim(version_reglas)) BETWEEN 1 AND 80);
    END IF;
END;
$$;

CREATE INDEX IF NOT EXISTS idx_reportes_municipalidad_prioridad_fecha
    ON reportes (municipalidad_id, prioridad, created_at DESC)
    WHERE archivado_at IS NULL AND prioridad IS NOT NULL;

COMMIT;
