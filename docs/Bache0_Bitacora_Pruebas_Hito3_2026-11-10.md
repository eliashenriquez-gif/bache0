# Bache0 — Bitácora de validación manual del Hito 3

- **Fecha de revisión:** 10 de noviembre de 2026 (capturas compartidas durante la continuación del chat).
- **Rama objetivo:** `integration/elias-david`.
- **Entorno comprobado por el usuario:** backend en `http://localhost:3000/api/v1`, PostgreSQL `bache0_dev`, Postman.
**Tipo de evidencia:** resultados comunicados por el usuario, JSON y capturas de Postman/pgAdmin; no equivale a ejecución automática del pipeline.

## 1. Evidencia recuperada del historial anterior

- 9 de 9 comprobaciones básicas de aislamiento de reportes entre administradores municipales aprobadas en el entorno anterior: lectura propia (200), acceso por ID ajeno denegado (404), filtro por comuna ajena denegado (403), según el historial recuperado.
- Commit `546c638` (`feat(vision): prepara repositorio y prioridad explicable`) registrado como publicado anteriormente en `integration/elias-david`; verificar el estado real de Git local antes de crear otro commit.
- 34 de 34 pruebas automatizadas del backend aprobadas en la copia del repositorio de integración revisada el 10/11/2026. Estas pruebas usan mocks y no reemplazan la validación con PostgreSQL real.

## 2. Superadministrador — pruebas positivas del 10/11/2026

| Solicitud | Resultado observado | Alcance |
|---|---|---|
| `POST /auth/login` | `200 OK` | JWT de `superadministrador`, `municipalidad_id=null` |
| `GET /reportes` | `200 OK` | JSON con tres reportes (municipalidades 3, 2, 1); `pagination.total=3` |
| `GET /reportes?municipalidad_id=1` | `200 OK` | Solo Estación Central, ID municipal 1 |
| `GET /reportes?municipalidad_id=2` | `200 OK`; 2 tests `PASSED` | Solo La Pintana, ID municipal 2 |
| `GET /reportes?municipalidad_id=3` | `200 OK`; 2 tests `PASSED` | Solo El Bosque, ID municipal 3 |
| `GET /usuarios` | `200 OK` | Listado global de usuarios con roles y ámbitos distintos |

Las dos pruebas automáticas para las municipalidades 2 y 3 validan el HTTP 200 y el campo **`municipalidad_id` de todos los registros devueltos**. Para la municipalidad 1 se mostró el script y una respuesta correcta, pero no se compartió la pestaña `Test Results`; queda pendiente confirmar `2/2 PASSED`.

**Precisión:** que el ID del reporte y el de la municipalidad coincidan en estos tres registros de prueba no implica que sean el mismo tipo de identificador. Las pruebas validan `municipalidad_id`, no `id`.

## 3. Estado actual de las municipalidades — consulta SQL proporcionada por el usuario

| ID | Comuna | `activa` | `servicio_activo` |
|---:|---|---|---|
| 1 | Estación Central | true | true |
| 2 | La Pintana | true | true |
| 3 | El Bosque | true | true |
| 4 | Providencia | true | false |

Providencia está registrada, pero su servicio está deshabilitado deliberadamente para probar el comportamiento sin cobertura. No se ha validado todavía por HTTP el rechazo esperado del caso.

## 4. Pendientes, sin asumir que están aprobados

- Confirmar `2/2 PASSED` de Estación Central.
- Probar peticiones sin JWT (401), JWT inválido (401), filtros y accesos ajenos (403/404 según contrato), parámetros inválidos y ausencia de recurso.
- Revisar aislamiento de usuarios, recuperación de fotografías privadas, permisos de inspectores y modificaciones, auditoría y rechazo de cobertura inactiva.
- David: flujo real desde móvil, ubicación/foto, QR y llegada a panel; Bastián: visión artificial, prioridad explicable, colección Postman global y video.
- Verificar ejecución real de extremo a extremo para Hito 3: formulario → API → BD → panel → recarga y persistencia.

## 5. Conservación de evidencia y respaldos

- Las solicitudes **guardadas** en Postman (`My Collection`) pueden sincronizarse con la misma cuenta y workspace, según configuración; **exportar además un JSON limpio** permite respaldo e intercambio con Bastián.
- No exportar ni publicar contraseñas, JWT ni variables compartidas con secretos. Los tokens locales pueden caducar.
- Los GET y login de hoy no insertaron/modificaron registros de reportes. Guardar una solicitud o un script en Postman tampoco altera PostgreSQL. Otros POST/PUT/DELETE probados en sesiones anteriores *sí pudieron* modificarla.
- GitHub sincroniza código y documentación, **no** los datos locales de PostgreSQL, el `.env` ni las imágenes privadas almacenadas fuera de la base.
- Hacer un respaldo `Custom` de `bache0_dev` (estructura y datos) antes de restaurarla en el notebook; respaldar separadamente el directorio de fotografías privadas y configurar credenciales locales.

## 6. Recomendación para continuidad

Usar notebook como equipo principal de desarrollo y presentación, una vez restaurada la base del escritorio. Mantener la base de escritorio como copia de seguridad, sin mantener dos bases activas que deban sincronizarse a diario. Respaldar periódicamente la base del notebook y el almacenamiento privado.

Este archivo documenta exclusivamente el estado probado hasta este punto: **no certifica la entrega final del Hito 3**.
