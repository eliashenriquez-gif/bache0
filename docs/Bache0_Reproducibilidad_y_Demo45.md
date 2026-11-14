# Bache0 — Datos de demostración, reproducción y revisión (Hito 3)

## Separación fundamental: Git, PostgreSQL y archivos privados

- GitHub contiene el código, `db/schema.sql`, `db/seed.sql`, migraciones, scripts de pruebas y este paquete de **imágenes públicas de investigación** con su atribución.
- PostgreSQL almacena las cuentas y reportes que genera el backend. Los registros **no se sincronizan automáticamente con Git**.
- Las fotografías de reportes de usuarios se guardan en almacenamiento privado (`backend/var/storage/reports` en el equipo de desarrollo), **no en Git**. Las imágenes originales incluidas en `backend/fixtures/demo-vision-45` son *fixtures* públicos diferentes de las imágenes privadas creadas por la API.
- Un backup completo de `bache0_dev` contiene hashes de cuentas y otros datos; **no subirlo al repositorio público**. Mantenerlo privado y restaurarlo únicamente en un entorno de prueba controlado.

## Qué exige la pauta original

La pauta `INGT1003_Proyecto_Semestral_2026_2S.html` (incluida en el ZIP inicial del equipo) establece en Hito 3:
- A1 (18 puntos): recorrido desde frontend hasta base de datos y de vuelta, con persistencia tras recarga.
- A2 (12): arquitectura por capas real.
- A3 (8): validaciones en cliente/servidor, códigos correctos y estados de carga, vacío y error.
- A4 (7): instalación reproducible o URL funcional.
- A5 (5): historial Git, README y **sin credenciales**.
- B1–B5 (50): documento final en PDF, arquitectura/bitácora, manual, **video de hasta 2 minutos**, anexo de uso IA y datos personales.
- Entrega desde la rama principal del repositorio; cierre anunciado en el documento: 27-11-2026 23:59; revisión: 30-11 a 04-12-2026. Verificar con el docente eventuales cambios.

## Base de datos nueva (sin compartir tu backup)

1. Clonar la rama final de `main` cuando esté publicada y seguir el README del proyecto.
2. Crear base PostgreSQL `bache0_dev`, configurar variables de PostgreSQL y JWT en `.env` local (partir de `.env.example`, sin subir valores).
3. Ejecutar **en una base vacía** `db/schema.sql` y `db/seed.sql`. El seed incluye municipios, reportes y fotos de prueba referenciadas. Preparar las fotos semilla con `npm run seed:photos` dentro de `backend`, conforme al script del proyecto.
4. Para bootstrap de superadministrador, agregar localmente `SEED_SUPERADMIN_EMAIL`, `SEED_SUPERADMIN_PASSWORD` (mínimo 12 caracteres) y opcionalmente `SEED_SUPERADMIN_NOMBRE` al `.env`. Iniciar el backend; el bootstrap solo crea el primero si no existe.
5. Configurar **solo localmente** `BACHE0_DEMO_EC_EMAIL`, `BACHE0_DEMO_EC_PASSWORD`, `BACHE0_DEMO_LP_EMAIL`, `BACHE0_DEMO_LP_PASSWORD`, `BACHE0_DEMO_EB_EMAIL`, `BACHE0_DEMO_EB_PASSWORD`, `BACHE0_DEMO_INS_EC_EMAIL`, `BACHE0_DEMO_INS_EC_PASSWORD` (cuentas ficticias). Ejecutar en PowerShell desde raíz: `node --env-file=.env backend/scripts/preparar-usuarios-evaluacion.mjs`. En una base preexistente, usar las cuentas vigentes; no cambiar cuentas ni contraseñas sin coordinación.
6. Importar `backend/postman/Bache0_Hito3_Final.postman_collection.json` y `backend/postman/Bache0_Local.example.postman_environment.json`; establecer `baseUrl`, emails y contraseñas de evaluación en el Postman **local**. Los login generan JWT. No compartir el entorno con secretos.

**Nota:** este procedimiento de cuentas aplica sobre una base de prueba nueva; no se ejecutó aquí ni modifica las cuentas existentes del notebook.

## Corpus reproducible de 45 fotografías

Origen: PavementDamagesG-7 v3, Mendeley Data, https://data.mendeley.com/datasets/yb65trwbd8/3. Fotografías tomadas en Colombia. Conservar atribución y revisar licencia CC BY 4.0 indicada por el dataset.

Incluye exactamente 45 fotos JPEG originales, 45 máscaras PNG de referencia y CSV con nombres originales, SHA-256 y distribución. Las máscaras NO se envían a `POST /reportes`.

Cada municipio recibe 15 reportes ficticios (ID 1 Estación Central, ID 2 La Pintana, ID 3 El Bosque). Las coordenadas cercanas a las del seed SQL son **artificiales**; las fotos no representan las calles chilenas indicadas. Las 15 fotos `RESERVA_FINAL_SIN_AJUSTE` no deben utilizarse para ajustar la IA experimental antes de la evaluación final.

### Carga con la API (no modifica la base directamente)

Desde la raíz del proyecto, con backend+PostgreSQL funcionando y Node >=20:

```powershell
node backend/scripts/importar-demo45.mjs --solo-verificar
node backend/scripts/importar-demo45.mjs --grupo desarrollo --limite 1
node backend/scripts/importar-demo45.mjs --grupo desarrollo
# Solo después de fijar la configuración experimental:
node backend/scripts/importar-demo45.mjs --grupo reserva
node backend/scripts/importar-demo45.mjs --estado
```

Para API no local, puede usar temporalmente `$env:BACHE0_API_URL='https://URL-REAL/api/v1'`. **No** publicar direcciones temporales de Cloudflare como si fueran permanentes.

El script utiliza `multipart/form-data`, verifica hashes antes de subir, almacena mapeo ID de foto → ID/folio de reporte, comprueba el municipio de respuesta, respeta `Retry-After` ante 429 y se puede reanudar sin repetir imágenes ya registradas mientras se conserve el archivo local de control. **Nunca borrar ese registro para reiniciar la importación; primero respaldarlo y comprobar la BD.**

Registro local: `backend/var/demo-vision-45/resultados_importacion.jsonl`. Se incluye `backend/var/demo-vision-45/.gitignore` para que los resultados se mantengan fuera de Git. El control no debe perderse, pues evita duplicados al reanudar. Una vez terminada la carga, conservar una copia para el informe y respaldos. No volcar tokens ni contraseñas.

Si un JPG devuelve error de geocodificación (422/503) o la municipalidad retornada no corresponde, el script se detiene. No corregir los IDs por SQL: revisar ubicación y proveedor antes de reintentar. No prometer éxito de ubicación sin prueba real contra la API.

## Comprobación del flujo integral y errores A3

1. Crear nuevo reporte desde el celular, registrar folio y confirmar fotografía, geolocalización, recepción y mensajes.
2. Ver en panel municipal, recargar con F5 y verificar persistencia.
3. Consultar por API y PostgreSQL (`SELECT id,folio,municipalidad_id,estado,prioridad FROM reportes ORDER BY id DESC LIMIT 10;`); modificar estado desde el panel y volver a consultar.
4. Iniciar con funcionario de otra comuna: comprobar que no tiene acceso al reporte (404) o filtro no autorizado (403).
5. Comprobar estados de carga/vacío/error en la UI y errores 400, 401, 403, 404, 413, 415, 422 con Postman.
6. Probar entrada de texto con comillas o `;` como parte de una descripción permitida; el sistema debe tratarla como dato literal y no como SQL. Para un campo numérico, enviar letras o caracteres inválidos: debe rechazarse con código correcto. No confundir puntuación válida en un texto con una entrada malformada.

## Backups y seguridad

- Antes de crear 45 reportes, guardar un backup con `pg_dump` en una carpeta fuera del repo. Conservar separadamente almacenamiento privado de fotografías. **Ni el backup ni contraseñas reales deben entrar a GitHub**.
- Las pruebas automatizadas y Postman respaldan el comportamiento, pero los `PASSED` históricos no están incluidos automáticamente en el JSON exportado. Guardar reporte de ejecución y bitácora.
- Reproducibilidad total requiere una instalación limpia probada por alguien distinto: esta guía no sustituye esa comprobación.
