# Bache 0

![Logo de Bache 0](src/assets/logo_bache0_azul_hd.png)

**Del reporte ciudadano a la gestión municipal.** Proyecto de Arquitectura de Desarrollo (Móvil y Web), INGT1003, Universidad Mayor, segundo semestre 2026.

**Equipo:** Elías Henríquez, Bastián Mansilla y David Ojeda.

Bache 0 permite que una persona reporte un desperfecto vial con **foto y ubicación confirmada**, sin crear una cuenta. La API verifica la cobertura, genera un folio y registra el reporte en PostgreSQL. Los funcionarios autorizados consultan y gestionan los reportes de su municipalidad. Un motor de prioridad explicable y un clasificador de imágenes local aportan información de apoyo; **no reemplazan la inspección humana**.

## Estado, aplicaciones y documentación

- **Código de referencia:** rama [`main`](https://github.com/eliashenriquez-gif/bache0/tree/main).
- **Interfaz web publicada:** [panel municipal](https://bache0.vercel.app/) y [formulario ciudadano](https://bache0.vercel.app/reporte). La interfaz publicada **no garantiza** que la API y PostgreSQL estén disponibles: para funcionar fuera del equipo de desarrollo se requiere una API HTTPS accesible y configurar `VITE_API_URL` en el despliegue.
- **Hito 1:** [documento de propuesta](docs/Informe_HITO1_Documento_de_propuesta.pdf).
- **Hito 2:** [documento técnico](docs/Bache0_Hito2_Documento_Tecnico.pdf), [modelo relacional](db/modelo_relacional.svg), [especificación OpenAPI](docs/openapi.yaml) y [contrato REST](docs/contrato-api-rest-v1.md).
- **Hito 3:** [informe final](docs/Bache0_Hito3_Informe_Final.pdf), [manual de instalación y uso](docs/Bache0_Hito3_Manual_Instalacion_y_Uso.pdf), [bitácora consolidada MD](docs/Bache0_Hito3_Bitacora_Consolidada.md) y [bitácora PDF](docs/Bache0_Hito3_Bitacora_Consolidada.pdf).
- **Postman Hito 2, demostración CRUD:** [`backend/postman/Bache0_Hito2_Demo_CRUD.postman_collection.json`](backend/postman/Bache0_Hito2_Demo_CRUD.postman_collection.json).
- **Postman Hito 3, pruebas consolidadas:** [`backend/postman/Bache0_Hito3_Final.postman_collection.json`](backend/postman/Bache0_Hito3_Final.postman_collection.json), [entorno de ejemplo sin secretos](backend/postman/Bache0_Local.example.postman_environment.json) e [instrucciones específicas](docs/Postman_Hito3_Instrucciones.md).

> **Alcance:** se mantienen las colecciones históricas del equipo en `backend/` como evidencia; la colección CRUD del Hito 2 es la opción breve para demostrar dos recursos, y la final del Hito 3 cubre pruebas de integración y permisos. No ejecutes automáticamente las carpetas manuales de Postman sin prepararlas.

## Arquitectura y estructura

**Monolito modular:** un backend Express con reglas de negocio separadas y una base PostgreSQL. La visión local usa un worker para no bloquear el flujo de reportes.

```text
Frontend React + Vite (src/)
       |  HTTP /api/v1
       v
Rutas y middlewares -> controladores (backend/src/)
       v
Servicios (validaciones, ubicación, usuarios, prioridad, foto e IA)
       v
Repositorios (SQL parametrizado, transacciones y aislamiento municipal)
       +--> PostgreSQL (db/schema.sql, db/seed.sql)
       +--> Almacenamiento privado de fotografías (no se sube a Git)
```

Las cinco tablas son `municipalidades`, `usuarios`, `reportes`, `analisis_vision` y `auditoria_eventos`. El proyecto usa archivado/desactivación lógica y eventos de auditoría. **La foto no se guarda como binario en PostgreSQL**: se registra la referencia y sus metadatos.

## Instalación local reproducible (Windows, macOS o Linux)

### 1. Requisitos

- **Node.js 20 o superior** (incluye npm), **Git** y **PostgreSQL** instalado y ejecutándose.
- Permisos para crear una base de datos PostgreSQL y ejecutar scripts SQL; en Windows puedes usar **pgAdmin** sin añadir `psql` al PATH.
- Conexión a internet para resolver coordenadas con **Nominatim/OpenStreetMap**. La creación de reportes que requieren geocodificación puede fallar temporalmente si ese servicio no responde.
- Opcional: **Postman** para ejecutar la demostración HTTP. La IA experimental RF-DETR/Roboflow **no es necesaria** para arrancar ni evaluar el flujo normal.

### 2. Clonar e instalar dependencias

Desde una terminal en la carpeta donde quieras guardar el proyecto:

```powershell
git clone https://github.com/eliashenriquez-gif/bache0.git
cd bache0
npm ci
cd backend
npm ci
```

Los siguientes comandos de instalación del servidor se ejecutan **desde `bache0/backend`**, salvo que se indique lo contrario.

### 3. Crear una base aislada para la evaluación

Usa `bache0_profesor` para no modificar la base de datos de desarrollo `bache0_dev`. La base debe estar **vacía** antes de importar el esquema.

**Opción A — Windows con pgAdmin (recomendada si no tienes `psql`):**

1. Inicia PostgreSQL, abre pgAdmin y conéctate con un usuario que pueda crear bases de datos.
2. En **Databases → Create → Database**, crea `bache0_profesor` con un propietario que tenga permisos para crear tablas.
3. Selecciona esa base, abre **Query Tool**, ejecuta el archivo `db/schema.sql` completo y comprueba que termine sin errores.
4. En la misma base ejecuta **después** `db/seed.sql`. No inviertas el orden.

**Opción B — terminal con herramientas de PostgreSQL en el PATH:**

Desde la carpeta `bache0/backend`, usando `postgres` **solo como ejemplo** de un usuario con permisos (reemplázalo si tienes otro):

```powershell
createdb -h localhost -U postgres bache0_profesor
psql -h localhost -U postgres -d bache0_profesor -f ../db/schema.sql
psql -h localhost -U postgres -d bache0_profesor -f ../db/seed.sql
```

Si se te solicita una clave, es la de **tu propio usuario de PostgreSQL**. `seed.sql` incluye cuatro municipalidades de demostración: **Estación Central (ID 1), La Pintana (ID 2), El Bosque (ID 3)** y **Providencia (ID 4, sin cobertura activa)**, además de reportes ficticios. No trae usuarios ni contraseñas.

### 4. Configurar el backend sin publicar secretos

Desde `bache0/backend`, crea una configuración privada partiendo de la plantilla de la raíz:

```powershell
# PowerShell (Windows)
Copy-Item ..\.env.example .env
```

En macOS/Linux el equivalente es `cp ../.env.example .env`. En `backend/.env`, completa al menos:

```dotenv
PORT=3000
PGHOST=localhost
PGPORT=5432
PGDATABASE=bache0_profesor
PGUSER=postgres
PGPASSWORD=REEMPLAZAR_POR_TU_CLAVE_LOCAL
JWT_SECRET=REEMPLAZAR_POR_UN_SECRETO_LARGO_Y_ALEATORIO
SEED_SUPERADMIN_EMAIL=superadmin@example.test
SEED_SUPERADMIN_PASSWORD=REEMPLAZAR_POR_CLAVE_DE_PRUEBA_MIN_12
SEED_SUPERADMIN_NOMBRE=Superadministrador de evaluación
```

Esos valores de `PGUSER` y correo son **ejemplos**, no accesos publicados. Usa el usuario PostgreSQL propietario de la base creada y define **contraseñas nuevas de demostración**, de 12–128 caracteres para los usuarios. Genera el `JWT_SECRET` (mínimo 32 caracteres) con:

```powershell
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

Pega la cadena generada en `backend/.env`, **no** en el repositorio. La clave de JWT no es la contraseña de inicio de sesión. `backend/.env` está excluido por `.gitignore`; las dos plantillas `.env.example` no deben contener secretos reales. Si vas a abrir React desde otro origen, configura `CORS_ORIGINS` (plural) en el backend. `VITE_API_URL` pertenece al **entorno del frontend**, sin el sufijo `/api/v1`; el código lo agrega.

### 5. Fotos de demostración, verificaciones y servidor

Con la base creada y `backend/.env` configurado, desde `bache0/backend`:

```powershell
npm run seed:photos
npm run smoke:db
npm test
npm start
```

- `seed:photos` copia las imágenes ficticias versionadas en `backend/fixtures/seed-photos/` a la carpeta privada de pruebas del servidor.
- `smoke:db` comprueba conexión y esquema; `npm test` ejecuta la suite automatizada. Revisa el resultado real de tu ejecución: no asumas que un número histórico de pruebas equivale al resultado de hoy.
- `npm start` levanta Express en **http://localhost:3000**. En modo de desarrollo (sin `NODE_ENV=production`) crea el **primer superadministrador** a partir de `SEED_SUPERADMIN_*`, solo si no hay otro ya creado.
- Abre **http://localhost:3000/health**: debe responder HTTP **200** con `{"status":"ok", ...}`. Si falla, revisa la terminal antes de continuar.

### 6. Preparar las cuatro cuentas municipales de evaluación

**Con el backend ya en marcha**, abre **otra terminal** ubicada en `bache0/backend`. Completa y descomenta en tu archivo privado `backend/.env` las ocho variables `BACHE0_DEMO_*_EMAIL` y `BACHE0_DEMO_*_PASSWORD` que figuran en `.env.example`; utiliza correos ficticios y claves exclusivas para la evaluación.

```powershell
node --env-file=.env scripts/preparar-usuarios-evaluacion.mjs
```

El script usa la API con la cuenta superadministradora y prepara administradores municipales de **Estación Central, La Pintana y El Bosque**, más un **inspector de Estación Central**. Debe utilizarse **solo en una base de evaluación nueva**. No publica ni muestra contraseñas. Conserva las credenciales privadas para el profesor en un canal separado del repositorio.

### 7. Iniciar el frontend

Abre una **tercera terminal**, ahora en la raíz `bache0/`:

```powershell
npm run dev
```

Vite indicará la dirección local, normalmente **http://localhost:5173**. El frontend usa `http://localhost:3000` por defecto. Si el backend está en otra dirección, define **`VITE_API_URL` con el origen del servidor**, por ejemplo `http://localhost:3000`, y reinicia Vite. No incluyas `/api/v1` en esa variable. El teléfono **no puede conectarse al `localhost` del notebook**; para una demostración desde celular necesitas que la API sea accesible desde el dispositivo, preferiblemente mediante HTTPS y CORS correcto. No publiques un túnel temporal como si fuera una URL permanente.

## Pruebas Postman y demostración Hito 2

En Postman importa **`backend/postman/Bache0_Hito2_Demo_CRUD.postman_collection.json`**. En las variables de la colección establece `baseUrl=http://localhost:3000/api/v1`, `superadmin_email` y `superadmin_password`, usando los valores **locales y privados** de `SEED_SUPERADMIN_*`.

Ejecuta en orden: **0 Login**; **1.1–1.5 CRUD de usuarios (inspector ficticio)**; **2.1–2.6 CRUD de reportes y comprobación de archivado lógico**. En la petición **2.1**, selecciona manualmente la foto `backend/fixtures/seed-photos/demo-report-001.png` (ruta dentro del repositorio). Esta petición depende de Nominatim y de que el punto geográfico tenga cobertura. No ejecutes automáticamente varias veces una creación sin comprobar la base.

En la demostración técnica muestra **POST 201 → GET 200 → PUT/PATCH 200 → DELETE 204** y una consulta posterior que evidencie la persistencia o el archivado/desactivación. Las peticiones de la colección generan **datos ficticios**. Para Hito 3, importa además la colección de 73 solicitudes `backend/postman/Bache0_Hito3_Final.postman_collection.json` y su entorno de ejemplo; revisa `docs/Postman_Hito3_Instrucciones.md` para las carpetas que se ejecutan manualmente y las credenciales requeridas.

**Conservación del trabajo del equipo:** los archivos históricos `backend/Bache0_Hito2.postman_collection.json` (usuarios/autenticación) y `backend/Bache0_Hito3.postman_collection.json` no deben borrarse. La colección histórica de Hito 2 utiliza municipalidades antiguas (IDs 7 y 9), por lo que no se debe ejecutar sin adaptar su entorno a una base compatible. La colección final de Hito 3 ya agrupa múltiples frentes de pruebas, aunque no reemplaza todas las solicitudes históricas.

## Contrato REST, seguridad y roles

La API usa el prefijo **`/api/v1`**, JSON `snake_case` y códigos HTTP específicos. El contrato detallado, con rutas, cuerpos, respuestas, errores y criterios de versión, está en `docs/contrato-api-rest-v1.md` y `docs/openapi.yaml`. **No todas las rutas previstas del contrato están implementadas**: en particular, las consultas GET de municipalidades se documentan como no operativas.

| Rol | Permisos relevantes |
|---|---|
| `superadministrador` | Puede administrar usuarios y reportes de todas las municipalidades. |
| `administrador_municipal` | Gestiona reportes de su municipalidad y cuentas de inspector de su mismo ámbito. |
| `inspector` | Puede consultar reportes y actualizar el estado, solo dentro de su municipio. |
| Ciudadano (invitado) | Puede crear un reporte con foto y ubicación, sin cuenta. |

La API valida el JWT (HS256, expiración de 30 minutos), consulta el usuario vigente en la base, limita intentos, restringe fotografías por autorización y registra auditoría. Las contraseñas se guardan con hash **Argon2id**. La IA **local** mantiene las fotos en el servidor; la opción experimental RF-DETR/Roboflow requiere configuración adicional y puede utilizar un proveedor externo.

## Fallas frecuentes y recuperación

| Síntoma | Qué revisar |
|---|---|
| `psql` / `createdb` no se reconoce | Usa pgAdmin, o agrega la carpeta `bin` de PostgreSQL al PATH. No necesitas cambiar el código. |
| El backend no arranca por `JWT_SECRET` | Genera un secreto aleatorio de al menos 32 caracteres y guárdalo **solo** en `backend/.env`. |
| `No se pudo crear el superadministrador` | Revisa `SEED_SUPERADMIN_*`, que la clave tenga 12–128 caracteres y que la BD esté inicializada. |
| Error de contraseña o conexión PostgreSQL | Comprueba que PostgreSQL esté iniciado y que `PGDATABASE`, `PGUSER`, `PGPASSWORD`, `PGHOST` y `PGPORT` coincidan con la base creada. |
| `relation "usuarios" does not exist` | Se está usando una base equivocada o todavía no se ejecutó `db/schema.sql` en ella. |
| `401` al consultar con Postman | Haz login, revisa que se guardó `access_token` y que estás usando el token correcto. |
| `403` o `404` en recursos de otra comuna | Es esperable si el rol o la municipalidad no tiene acceso: no desactives las protecciones para forzar la prueba. |
| `422` al reportar un punto | Ubicación no resuelta o comuna sin cobertura; prueba con las coordenadas de demostración y comprueba internet/Nominatim. |
| `503` al geocodificar | Dependencia externa no disponible; reintenta más tarde sin saltarse las validaciones de cobertura. |
| `429` al enviar repetidamente | Espera la ventana del límite por IP; no cambies el límite solo para ocultar una falla de prueba. |
| Fotografías semilla no cargan | Ejecuta `npm run seed:photos` dentro de `backend` y verifica la ruta privada de almacenamiento. |
| El panel carga pero no hay reportes | Revisa `VITE_API_URL`, CORS, sesión, cobertura y registros existentes en la base. |
| El formulario funciona en el PC pero falla desde el celular | El `localhost` del teléfono no es el del notebook. Hace falta una API alcanzable desde el móvil. |

## Reproducibilidad, copias y datos personales

GitHub incluye código, esquema, migraciones, semillas ficticias, pruebas y documentación. **No sincroniza** automáticamente la base PostgreSQL ni las fotografías subidas por usuarios. Para respaldar el sistema necesitas tanto la base (`pg_dump` o respaldo desde pgAdmin) como la carpeta privada `backend/var/storage/reports/`. Nunca publiques respaldos con usuarios, hashes o datos personales, archivos `.env`, JWT, tokens Postman ni fotos reales.

El sistema trata fotografías potencialmente identificables, ubicación del incidente y nombre/correo de funcionarios. Las pruebas del repositorio deben usar **datos ficticios**. Para las decisiones técnicas y limitaciones de visión artificial consulta `docs/vision-ia-hito3.md`.

## Entregables finales del Hito 3

La documentación final está publicada en `docs/`:

- [Informe técnico final (PDF)](docs/Bache0_Hito3_Informe_Final.pdf).
- [Manual de instalación y uso (PDF)](docs/Bache0_Hito3_Manual_Instalacion_y_Uso.pdf).
- [Bitácora consolidada del equipo (Markdown)](docs/Bache0_Hito3_Bitacora_Consolidada.md).
- [Bitácora consolidada para lectura (PDF)](docs/Bache0_Hito3_Bitacora_Consolidada.pdf).
- [Bitácoras históricas individuales y técnicas](docs/bitacoras_historicas/).
- [Diagrama de arquitectura](docs/modelo_arquitectonico_hito2.svg) y [modelo relacional](docs/modelo_relacional.svg).

**Video demostrativo:** [Ver Bache 0 en Google Drive](https://drive.google.com/file/d/1f09H-NDgTz-rDfIQ6l2Nh5EzS-bOT9nF/view?usp=drive_link).

También se conserva una [copia MP4 en el repositorio](docs/video/bache0-demo-hito3.mp4).

**Importante:** el frontend está publicado en Vercel, pero la API de demostración depende de que el backend y su conexión HTTPS estén activos. La disponibilidad debe comprobarse antes de la evaluación.

---
## Comprobación guiada de una instalación nueva (evaluación local)

Esta sección complementa la instalación anterior. Los valores `.env.example` son **plantillas**: las contraseñas y `JWT_SECRET` de ejemplo **no sirven para iniciar sesión ni conectarse a PostgreSQL**. No se deben subir `.env` ni exportaciones de Postman que contengan credenciales.

### Programas necesarios y opcionales

- **Necesarios para ejecutar en un computador:** Git para clonar, Node.js 20 o superior con npm, PostgreSQL en ejecución y un navegador.
- **Herramientas, no dependencias de ejecución:** Visual Studio Code (o cualquier editor), pgAdmin (alternativa a `psql` para ejecutar SQL), Postman (demostración de la API).
- **Solo para acceso desde otro dispositivo:** una API pública con HTTPS y CORS configurado. Cloudflare Tunnel es una opción; no se necesita para las pruebas locales en Postman. El `localhost` de un teléfono no es el `localhost` del computador.
- **IA normal:** se ejecuta localmente con `@tensorflow/tfjs`; el aviso de rendimiento que menciona `tfjs-node` no obliga a instalarlo. RF-DETR/Roboflow es experimental y opcional.

### Simular al profesor sin afectar el entorno de desarrollo

Para mantener separadas las instalaciones, se recomienda probar en otra carpeta y con otra **base de datos**, no solo con otro puerto HTTP:

| Ajuste | Instalación habitual | Instalación de evaluación (ejemplo) |
| --- | --- | --- |
| Carpeta | `bache0/` | `bache0_profesor_prueba/` |
| `PORT` (API HTTP) | `3000` | `3100` |
| `PGDATABASE` (base SQL) | `bache0_dev` | `bache0_profesor` |
| `PGPORT` (servicio PostgreSQL) | `5432` | `5432` |
| `PGUSER`, `PGPASSWORD` | Credenciales locales válidas | Credenciales válidas con permisos en la base nueva |

1. Clonar el repositorio en una carpeta nueva y ejecutar `npm ci` en la raíz **y** en `backend/`.
2. Crear una base **vacía** `bache0_profesor` en pgAdmin; ejecutar allí `db/schema.sql` seguido de `db/seed.sql`.
3. Crear `backend/.env` a partir de `.env.example`. Indicar explícitamente `PORT=3100`, `PGDATABASE=bache0_profesor`, `PGUSER` y `PGPASSWORD` válidos, `JWT_SECRET` de al menos 32 caracteres y `SEED_SUPERADMIN_EMAIL` con formato válido, más `SEED_SUPERADMIN_PASSWORD` de 12 a 128 caracteres. El correo `superadmin@example.test` es **ficticio y válido** para una cuenta de evaluación.
4. Desde `backend/`, **antes de iniciar**, comprobar que las variables apuntan a la base aislada, sin imprimir secretos:

```powershell
node --env-file=.env -e "console.log({puerto:process.env.PORT,base:process.env.PGDATABASE,usuario:process.env.PGUSER,claveDbConfigurada:Boolean(process.env.PGPASSWORD),jwtValido:(process.env.JWT_SECRET||'').length>=32,superadminConfigurado:Boolean(process.env.SEED_SUPERADMIN_EMAIL&&process.env.SEED_SUPERADMIN_PASSWORD)})"
```

   No continuar si `base` no es `bache0_profesor`. **El puerto 3100 no garantiza por sí solo el aislamiento de PostgreSQL.**

5. Ejecutar `npm run seed:photos`, `npm run smoke:db` y `npm test`; después `npm start`. Abrir `http://localhost:3100/health` y comprobar `status: ok`. Verificar en PostgreSQL `SELECT current_database();` antes de hacer operaciones de escritura.
6. En Postman, importar `backend/postman/Bache0_Hito2_Demo_CRUD.postman_collection.json` y configurar sus variables de colección `baseUrl=http://localhost:3100/api/v1`, `superadmin_email`, `superadmin_password` y `municipalidad_id=1`. Ejecutar en secuencia la solicitud 0, las 1.1–1.5 y las 2.1–2.6. En la 2.1, adjuntar manualmente `backend/fixtures/seed-photos/demo-report-001.png` como `foto`. Los códigos 204 y 404 finales son intencionales.
7. Para el frontend de esta misma copia, arrancar Vite desde la raíz con `VITE_API_URL=http://localhost:3100` (**sin `/api/v1`**) y configurar `CORS_ORIGINS` del backend para incluir el origen real que Vite indique (por ejemplo, `http://localhost:5173`; si utiliza 5174, incluir 5174 también y reiniciar el servidor). Los frontend publicados requieren una API HTTPS accesible y no pueden usar `localhost:3100` de otro computador.

**Diagnóstico rápido:** `Cannot find module` → ejecutar `npm ci` en la carpeta correspondiente; error PostgreSQL `password authentication failed` → comprobar credenciales de **ese usuario** sin cambiarlas; `PGPASSWORD no definido` → no dejar en blanco la plantilla; error por `JWT_SECRET` → crear un secreto largo **solo en el `.env` privado**; `SEED_SUPERADMIN_EMAIL` inválido → usar una dirección con formato de correo; `relation usuarios does not exist` → revisar base y orden de importación SQL; warning `MODULE_TYPELESS_PACKAGE_JSON` o aviso de optimización de TensorFlow.js → advertencias, no equivalen a falla de inicio.

**Colecciones distintas:** el Hito 2 tiene 12 solicitudes de demostración CRUD; la colección `Bache0_Hito3_Final` tiene 73 solicitudes de integración, roles, seguridad, fotografías y visión, algunas manuales. Una no sustituye a la otra. Los datos generados por las solicitudes se deben crear únicamente en una base de evaluación.
