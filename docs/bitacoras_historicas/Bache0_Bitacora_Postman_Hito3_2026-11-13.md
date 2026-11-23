# Bache0 — Bitácora de pruebas e integración Postman (Hito 3)

**Jornada:** 13–14 de noviembre de 2026  
**Responsable:** Elías  
**Rama:** `integration/elias-david`  
**Entorno:** Windows, VS Code, Node.js, PostgreSQL 18 y Postman.

## 1. Objetivo de la jornada

Completar las pruebas funcionales y de seguridad del backend de Bache0 mediante Postman, verificando autenticación JWT, acceso por municipalidad, permisos de usuario, fotografías privadas, persistencia de reportes, visión artificial, motor de prioridad y manejo de errores.

Además, preparar una colección consolidada y un entorno de ejemplo para que el profesor pueda reproducir las pruebas.

## 2. Estado del proyecto antes de Postman

Durante la jornada anterior se integró la rama `feature/bastian-backend-core` en `integration/elias-david`.

Se verificó:

- Backend: **176 pruebas aprobadas, 0 fallidas y 0 omitidas**.
- Inferencia real del modelo TensorFlow.js: ejecutada correctamente.
- Frontend: compilación exitosa con Vite.
- PostgreSQL: funcionando.
- Integración publicada mediante el commit `ba78458`.
- Bitácora anterior publicada mediante el commit `3c4b944`.

## 3. Preparación del entorno

Se verificó el servicio PostgreSQL mediante:

```powershell
Get-Service postgresql-x64-18
```

Resultado: `Running`.

Se levantó el backend:

```powershell
node backend/src/app.js
```

Servidor disponible en `http://localhost:3000`.

Se comprobó:

- `GET /api/v1/health` → HTTP 200.
- `GET /api/v1/reportes` sin JWT → HTTP 401 y `AUTHENTICATION_REQUIRED`.

También se ejecutó el frontend con `npm run dev`, disponible localmente en `http://localhost:5173`.

## 4. Configuración de autenticación

Se prepararon solicitudes de login para cinco cuentas:

| Rol | Municipalidad |
|---|---|
| Superadministrador | Acceso global |
| Administrador municipal | Estación Central, ID 1 |
| Administrador municipal | La Pintana, ID 2 |
| Administrador municipal | El Bosque, ID 3 |
| Inspector | Estación Central, ID 1 |

Las solicitudes utilizan variables del entorno `Bache0 Local` y scripts que guardan automáticamente sus JWT.

No es necesario copiar los tokens manualmente.

## 5. Resultados de las carpetas Postman

### Carpeta 00 — Estado y autenticación

**Resultado: aprobado.**

Se verificaron:

- Estado de la API.
- Rechazo de solicitudes sin JWT.
- Rechazo de tokens inválidos.
- Perfiles de superadministrador y administradores municipales.

### Carpeta 01 — Listados municipales

**Resultado: aprobado.**

Se comprobó que:

- Estación Central recibe únicamente reportes con `municipalidad_id = 1`.
- La Pintana recibe únicamente reportes con `municipalidad_id = 2`.
- El Bosque recibe únicamente reportes con `municipalidad_id = 3`.
- El superadministrador puede consultar reportes de las tres municipalidades.

Se validó el contenido de las respuestas, no solamente el código HTTP 200.

### Carpeta 02 — Aislamiento por ID y filtros

**Resultado: aprobado.**

Se verificaron consultas de reportes propios y rechazo de consultas a reportes ajenos.

Resultados esperados confirmados:

- Reporte propio: HTTP 200.
- Reporte ajeno: HTTP 404.
- Filtro municipal no autorizado: HTTP 403.
- Filtros autorizados del superadministrador: HTTP 200.
- Parámetros inválidos: HTTP 400.

### Carpeta 03 — Fotografías privadas

**Resultado: aprobado.**

Se comprobó:

- Recuperación de fotografías autorizadas.
- Rechazo de fotografías de otras municipalidades.
- Rechazo de solicitudes sin autenticación.

### Carpeta 04 — Usuarios y roles

**Resultado: aprobado.**

Se verificaron:

- Listado global de usuarios por superadministrador.
- Listado limitado a la propia municipalidad.
- Rechazo de consultas no autorizadas a otras municipalidades.

### Carpeta 05 — Validaciones y errores

**Resultado: aprobado.**

Se ejecutaron siete pruebas de validación, con respuestas HTTP 400 y 404 según el caso.

Se comprobó que la API utiliza respuestas de error estructuradas.

### Carpeta 06 — Visión artificial

**Resultado: aprobado para consultas y seguridad.**

Se comprobaron:

- Consulta autorizada de análisis.
- Manejo de listas de análisis vacías.
- Rechazo de acceso a análisis ajenos.
- Rechazo de solicitudes sin autenticación.

### Carpeta 07 — Reportes y persistencia

**Resultado: aprobado.**

Se realizó una prueba de creación de reporte utilizando una fotografía válida del repositorio.

Resultados:

- `07.1`: reporte creado con HTTP 201.
- `07.2`: consulta del reporte creado con HTTP 200.
- `07.3`: actualización de estado con HTTP 200.
- `07.4`: persistencia del estado `en_revision` comprobada.
- `07.5`: consulta del análisis de visión con HTTP 200.
- `07.6`: prioridad explicable disponible.
- `07.7`: solicitud de reprocesamiento aceptada con HTTP 202.
- `07.8`: consulta del análisis por ID con HTTP 200.

Se confirmó que las solicitudes dependientes reutilizan el ID generado mediante una variable de Postman.

### Carpeta 08 — Inspector

**Resultado: aprobado.**

Se creó una cuenta de inspector para Estación Central mediante la API.

- Creación: HTTP 201.
- Login: HTTP 200.
- Perfil inspector: HTTP 200.
- Listado de reportes propios: HTTP 200.
- Tres pruebas de operaciones restringidas: HTTP 403.

Se comprobó que el inspector posee permisos más limitados que el administrador municipal.

### Carpeta 09 — Cobertura y archivos inválidos

**Resultado: códigos HTTP esperados confirmados.**

- Providencia sin cobertura: HTTP 422, `MUNICIPALIDAD_SIN_COBERTURA`.
- Archivo PDF no admitido: HTTP 415, `UNSUPPORTED_MEDIA_TYPE`.
- Imagen PNG de 25,79 MiB: HTTP 413, `FILE_TOO_LARGE`.
- Creación sin fotografía: HTTP 400.

Durante las pruebas se recibió temporalmente HTTP 429 por el limitador de solicitudes. Se respetó el encabezado `Retry-After` y luego se obtuvieron los resultados esperados.

Queda recomendable comprobar también el código específico del error de la prueba sin fotografía.

## 6. Organización de Postman

Se consolidaron los login dentro de la colección principal de pruebas del Hito 3.

Se preparó una plantilla del entorno Postman con los nombres de las variables necesarias.

El entorno local contiene credenciales y tokens de desarrollo, por lo que no debe publicarse directamente.

La colección final y el entorno de ejemplo deben revisarse antes de incorporarse al repositorio.

## 7. Preparación para el profesor

Se creó el documento:

`docs/Postman_Hito3_Instrucciones.md`

El documento explica cómo preparar el backend, importar la colección, configurar variables, iniciar sesión y ejecutar las pruebas.

Se acordó entregar:

- Colección definitiva de Postman.
- Plantilla de entorno sin secretos.
- Instrucciones de ejecución.
- Credenciales de demostración mediante un canal privado.

También deberá verificarse el acceso del profesor a GitHub y a una instancia funcional del backend.

## 8. Dataset de visión artificial

Se recibieron los archivos seleccionados del dataset PavementDamagesG-7.

El conjunto contempla:

- 45 fotografías originales JPG.
- 45 máscaras de referencia PNG.
- 30 fotografías para desarrollo y demostración.
- 15 fotografías reservadas para evaluación independiente.

La distribución prevista es de 15 reportes ficticios nuevos por municipalidad.

Se acordó mantener nombres originales y trazabilidad mediante un manifiesto CSV.

Las fotografías proceden de Colombia y se utilizarán exclusivamente como datos ficticios de demostración para las municipalidades chilenas.

Durante esta jornada no se insertaron todavía los 45 reportes definitivos.

## 9. Pendientes

1. Revisar los JSON exportados de Postman.
2. Consolidar y publicar la colección definitiva sin credenciales.
3. Preparar y publicar el entorno de ejemplo.
4. Conservar evidencia de los resultados de las pruebas.
5. Preparar la carga controlada de 45 reportes ficticios utilizando el manifiesto.
6. Verificar análisis de visión y prioridades de los reportes nuevos.
7. Comprobar el flujo completo desde el celular hasta el panel municipal.
8. Verificar el acceso del profesor al repositorio y al backend.
9. Fusionar la versión estable a `main`.
10. Evaluar posteriormente una mejora experimental del modelo de visión artificial.

## 10. Conclusión

Se completó una batería amplia de pruebas del Hito 3 de Bache0, incluyendo autenticación JWT, aislamiento municipal, permisos de tres roles, fotografías privadas, creación y persistencia de reportes, consultas de visión artificial y validaciones de seguridad.

Los resultados informados fueron satisfactorios para las pruebas ejecutadas.

El siguiente objetivo es publicar la colección Postman definitiva y comenzar la carga controlada de reportes de demostración, manteniendo trazabilidad con las fotografías originales del dataset seleccionado.