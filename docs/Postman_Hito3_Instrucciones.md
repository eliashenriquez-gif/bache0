# Bache0 — Postman Hito 3: instrucciones de reproducción

## Archivos de la entrega

- `backend/postman/Bache0_Hito3_Final.postman_collection.json`: colección consolidada (10 carpetas, 73 solicitudes, incluyendo cinco inicios de sesión).
- `backend/postman/Bache0_Local.example.postman_environment.json`: plantilla de entorno sin contraseñas ni tokens.
- `backend/Bache0_Hito3.postman_collection.json`: colección original del backend, conservada como referencia.

## Acceso y requisitos

El evaluador debe poder leer/clonar el repositorio GitHub y acceder a una **instancia ejecutándose** del backend con PostgreSQL y sus cuentas de demostración. La aplicación web alojada en Vercel **no** sustituye el servidor Express ni PostgreSQL. Una URL temporal de Cloudflare solo funciona mientras el túnel y el notebook estén activos. `localhost` apunta al equipo que ejecuta Postman.

Antes de la entrega, verificar acceso efectivo del profesor a `main` (invitación aceptada si privado, o enlace público revisado si público). Verificar también la API y disponibilidad de las cuentas en la base **que se usará en la evaluación**; una instalación nueva no contiene automáticamente los usuarios del notebook original.

No publicar `.env`, bases con contraseñas, JWT ni exportaciones de `Bache0 Local` con valores reales. Las **credenciales exclusivas de demostración** se entregan mediante un canal privado al profesor y pueden renovarse o revocarse tras la evaluación.

## Preparar backend local (si el evaluador ejecuta el proyecto)

1. Disponer de Node.js, dependencias instaladas, PostgreSQL y variables de entorno de backend correctamente configuradas.
2. Iniciar PostgreSQL y preparar base `bache0_dev` (o base equivalente) con esquema, datos de demostración, cuentas y fotografías de prueba.
3. Desde la raíz del repositorio iniciar `node backend/src/app.js` (con la configuración local aplicable).
4. Verificar `GET http://localhost:3000/api/v1/health` → 200 y `status: ok`.

## Importación y variables

1. En Postman, importar **los dos JSON** de `backend/postman`.
2. Seleccionar `Bache0 - Plantilla sin credenciales` (sin afectar un entorno local existente).
3. Confirmar `baseUrl = http://localhost:3000/api/v1` o establecer una URL HTTPS de API real. No agregar `/api/v1` dos veces.
4. Configurar, de forma privada, `email_*` y `password_*` para superadmin, EC, LP, EB e inspector EC. **No exportar el entorno después de ingresarlos**.
5. Ejecutar los cinco POST `/auth/login` de la carpeta 00: guardan automáticamente `token_superadmin`, `token_ec`, `token_lp`, `token_eb`, `token_ins_ec` y `token_inspector`. El login inspector establece `inspector_municipalidad_id=1`.
6. Los IDs de reportes semilla `id_ec=1`, `id_lp=2`, `id_eb=3` se configuran como variables de colección y deben apuntar a reportes reales de esas comunas. Ajustar solo si en otra instalación los IDs son diferentes.
7. `lat_providencia` y `lon_providencia` tienen coordenadas ilustrativas. Comprobar que el servicio de geolocalización devuelve efectivamente Providencia en el entorno evaluado.

## Orden de pruebas

| Carpeta | Alcance |
| --- | --- |
| 00 | Health, autenticación JWT y cinco login |
| 01 | Listados por municipalidad y superadmin |
| 02 | Aislamiento por ID y filtros autorizados |
| 03 | Fotografías privadas |
| 04 | Usuarios y roles |
| 05 | Validaciones negativas sin cambios válidos |
| 06 | Visión artificial: consulta y protección |
| 07 | **MANUAL**: crear un reporte ficticio, actualizar estado, comprobar persistencia, prioridad y análisis |
| 08 | Perfil y permisos restringidos del inspector |
| 09 | **MANUAL**: cobertura y rechazo de archivos |

No ejecutar la colección completa con Runner indiscriminadamente: la carpeta 07 crea/modifica registros y una de sus solicitudes solicita reprocesar IA. Ejecutar las solicitudes de la carpeta 07 individualmente, en orden; `07.7` solo si es necesario y `07.8` después de obtener un ID de análisis. El ID de reporte queda en variable de colección `reporte_prueba_id`.

## Archivos de prueba: preparación manual

- `07.1` y `09.1`: seleccionar JPG/PNG/WebP válido en Body → form-data → `foto` (tipo File). Por ejemplo, para `07.1`, `backend/var/storage/reports/seed/demo-report-001.png`, relativo al checkout local. En Postman puede ser necesario habilitar acceso a archivos fuera del working directory.
- `09.2`: adjuntar PDF **ficticio**, sin datos personales; resultado previsto 415 `UNSUPPORTED_MEDIA_TYPE`.
- `09.3`: adjuntar imagen **válida** de más de 10 MiB; resultado previsto 413 `FILE_TOO_LARGE`.
- `09.4`: formulario sin fotografía; resultado previsto 400. Comprobar también el cuerpo de error.
- `09.1`: Providencia sin servicio activo, con formulario y fotografía válidos; resultado previsto 422 `MUNICIPALIDAD_SIN_COBERTURA`.

Al reutilizar Postman en otro computador habrá que volver a seleccionar los archivos; Postman no incorpora sus bytes dentro de la colección exportada. Un HTTP 429 `RATE_LIMIT_EXCEEDED` puede indicar que se debe respetar `Retry-After` antes de repetir una solicitud, no que el endpoint esperado esté defectuoso.

## Cuentas de demostración esperadas

| Rol | Municipalidad |
| --- | --- |
| `superadministrador` | Acceso global |
| `administrador_municipal` | Estación Central (1) |
| `administrador_municipal` | La Pintana (2) |
| `administrador_municipal` | El Bosque (3) |
| `inspector` | Estación Central (1) |

Las cuentas existentes no deben crearse otra vez. En una base nueva habrá que aprovisionar usuarios con esos roles y ámbitos. Las credenciales reales no forman parte de esta documentación.

## Evidencias y consideraciones

Los `pm.test` verifican respuestas al ejecutarse; exportar la colección **no guarda** las capturas ni el historial de resultados `PASSED`. Conservar evidencia separada si la pauta solicita capturas o reporte. Las pruebas automatizadas del backend se ejecutan por separado con `cd backend && npm test`.

El dataset PavementDamagesG-7 contiene fotografías tomadas en Colombia. Los 45 reportes previstos para Estación Central, La Pintana y El Bosque son **ficticios**, no hechos ocurridos en esas comunas. Conservar manifiesto, nombres originales y partición 30 desarrollo / 15 evaluación independiente. No usar resultados de las imágenes reservadas para afinar el nuevo modelo antes de evaluarlo.
