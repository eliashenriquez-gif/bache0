# Bache 0 — Evidencia de instalación limpia y Postman Hito 2

**Fecha:** 21 de noviembre de 2026  
**Finalidad:** comprobar que la documentación permite clonar, configurar y demostrar el backend de Bache 0 en una copia independiente.  
**Fuente de la evidencia:** resultados informados en la ejecución local de PowerShell, pgAdmin y Postman; no se adjuntan credenciales ni tokens.  
**Repositorio de origen:** `main`, inicialmente clonado desde commit `112d1c2`. La copia de evaluación se mantuvo separada de la carpeta original.

## Configuración de la prueba

- Copia de evaluación: `D:\BACHE_0\bache0_profesor_prueba`.
- Backend: `http://localhost:3100`.
- PostgreSQL: `bache0_profesor` (base aislada), usuario de aplicación `bache0_app`.
- Instalación: `npm ci` en raíz y backend; creación de base con `db/schema.sql` y `db/seed.sql`.
- Estado inicial comprobado: tres reportes semilla (`SELECT COUNT(*) FROM reportes`).
- Verificación SQL ejecutada desde la copia nueva: `current_database() = bache0_profesor`, `current_user = bache0_app` y `reportes = 3`.
- `GET /health` en puerto 3100: `status = ok`.
- Superadministrador ficticio de evaluación creado desde variables privadas; no se registran credenciales.

## Resultados de la colección Hito 2

**Colección:** `backend/postman/Bache0_Hito2_Demo_CRUD.postman_collection.json`. Se ejecutaron 12 solicitudes en orden y el usuario comunicó resultados exitosos para todas ellas.

| Solicitud | Comprobación | Resultado |
| --- | --- | --- |
| 0 | Inicio de sesión superadministrador; token recibido | Correcto |
| 1.1 | Crear inspector ficticio, rol/municipalidad y no exposición de contraseña/hash | HTTP 201; tests passed |
| 1.2 | Leer inspector creado | HTTP 200; ID y datos correspondientes |
| 1.3 | Actualizar nombre del inspector | HTTP 200; datos actualizados |
| 1.4 | Desactivar inspector | HTTP 204; test passed |
| 1.5 | Confirmar que la cuenta persiste con `activo=false` | HTTP 200; tests passed |
| 2.1 | Crear reporte con imagen y georreferencia; `Location` y folio | HTTP 201; tests passed |
| 2.2 | Leer reporte y verificar el folio | HTTP 200; tests passed |
| 2.3 | Actualizar estado a `en_revision` | HTTP 200; tests passed |
| 2.4 | Editar reporte y severidad | HTTP 200; tests passed |
| 2.5 | Archivar reporte | HTTP 204; test passed |
| 2.6 | Confirmar que el reporte archivado ya no está disponible | HTTP 404 esperado; tests passed |

**Conclusión:** demostración completa de autenticación y de ambos CRUD del Hito 2 sobre una base aislada. El 404 final es el resultado esperado del archivado lógico.

## Problemas de configuración detectados y soluciones

- `.env` inexistente / valores de ejemplo sin completar: crear copia local y rellenar variables válidas.
- Dependencia `helmet` no instalada en el entorno anterior: `npm ci` dentro de `backend`.
- Usuario y contraseña SQL incompatibles: utilizar credenciales propias válidas y permisos sobre la base nueva; no es necesario cambiar contraseñas.
- Correo de superadministrador inválido y contraseña no definida: utilizar valores ficticios válidos para la base aislada.
- JWT secreto ausente o incorrecto: generar secreto aleatorio de al menos 32 caracteres en el `.env` local.
- Riesgo de confundir puerto HTTP con base de datos: fijar ambos `PORT=3100` y `PGDATABASE=bache0_profesor` y verificar mediante `current_database()`.
- Warning de módulos Node y aviso de optimización de TensorFlow.js: aparecieron, pero no impidieron iniciar la API.

## Alcance y pendientes

Esta evidencia verifica **backend HTTP, conexión SQL y colección CRUD Hito 2**. No demuestra por sí sola el funcionamiento final del frontend, del acceso desde celular/túnel, el desempeño de la IA, la aprobación de `npm test` en esta copia ni toda la colección Postman Hito 3 de 73 solicitudes. Esas comprobaciones se documentarán separadamente cuando se ejecuten.

**Protección de datos:** no se incluyen tokens de acceso, contraseñas, archivos `.env` ni fotografías de usuarios reales.
