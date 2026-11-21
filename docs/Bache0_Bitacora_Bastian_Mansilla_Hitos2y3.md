# Bache 0 — Bitácora de desarrollo backend y visión artificial

**Autor:** Bastián Mansilla Haro  
**Proyecto:** Bache 0 — Universidad Mayor  
**Ámbito:** trabajo de backend en Hito 2 y evolución de visión artificial/prioridad incorporada durante noviembre de 2026  
**Período documentado:** octubre al 13 de noviembre de 2026  
**Rama de desarrollo original:** `feature/bastian-backend-core` (posteriormente integrada al proyecto)

> Esta bitácora consolida dos registros entregados por Bastián. Las fechas, dificultades con proveedores y participación personal corresponden a su relato. Las descripciones técnicas se armonizaron con el código publicado en `main`. Los resultados de pruebas se distinguen por su fecha: no representan una ejecución nueva.

## 1. Hito 2 — Backend, API REST y autenticación (octubre–8 de noviembre)

- **Arquitectura:** desarrollo del backend como monolito modular con Node.js y Express, conectado a PostgreSQL. Separación de rutas, controladores, servicios, repositorios y middlewares.
- **Errores y seguridad:** manejo uniforme de errores (`errorHandler`, `notFoundHandler`, `AppError`), autenticación JWT y almacenamiento de contraseñas con hash Argon2id.
- **Usuarios y roles:** operaciones de creación, consulta, actualización y desactivación de funcionarios, con controles de autorización y ámbito municipal.
- **Configuración reproducible:** inicialización del primer superadministrador mediante `SEED_SUPERADMIN_*` en un archivo `.env` local, sin credenciales reales en el repositorio.
- **Pruebas de API:** elaboración de la colección histórica `backend/Bache0_Hito2.postman_collection.json` para verificar autenticación, permisos y usuarios.

## 2. Hito 3 — Evolución técnica del backend y contingencias (10–13 de noviembre)

### 10 de noviembre — Intentos de servicios externos

- Se evaluaron **Google Cloud Vision/Gemini** y después **Hugging Face** para procesar fotografías. Según la bitácora original, los intentos encontraron restricciones de facturación, cuota y conectividad, por lo que se descartó depender de esos servicios como requisito del flujo principal.
- Se reorientó la implementación hacia inferencia local. Durante la refactorización también se revisó la configuración de `JWT_SECRET` y se utilizó asistencia de Claude Code, según el registro del autor.

### 11 y 12 de noviembre — Clasificador local y prioridad explicable

- Se integró un clasificador **MobileNetV2** para las clases **Bache, Calle sana y Otro**, ejecutado con **`@tensorflow/tfjs`** en un **worker thread** de Node.js. El procesamiento de imagen se realiza aparte del hilo principal de la API.
- El flujo ciudadano guarda primero el reporte en PostgreSQL y devuelve **`201 Created`**; el análisis visual ocurre después, de forma asíncrona. Si falla la IA, el reporte persiste.
- Se incorporó un motor de prioridad **`prototipo-v1`** con factores de severidad declarada, concurrencia, infraestructura crítica y tipo de vía si está confirmado. La IA actúa solo como información complementaria y puede aportar **hasta un punto, sujeto a las condiciones de `priorityRules.js`**; no mide la severidad física del bache ni decide por sí sola la prioridad.
- Se guardan motivos y versión de reglas para que la prioridad sea trazable y explicable.

### 13 de noviembre — Validaciones, fallos y pruebas

- Se reforzó la subida de fotografías: formatos permitidos, tamaño máximo de 10 MB y validación de contenido mediante firmas binarias (*magic bytes*).
- Se incorporaron medidas de contingencia frente a fallos de inferencia, *timeouts* y desactivación de visión, sin perder los reportes previamente guardados.
- **Resultado histórico comunicado para el 13 de noviembre:** **176 pruebas automatizadas aprobadas, 0 fallidas**. Esto acredita esa ejecución, **no una medición de 100 % de cobertura de código**. El informe técnico posterior del equipo registra 191 pruebas aprobadas al 15 de noviembre; es una ejecución de otra fecha.
- Se trabajó en los casos de Postman de integración y seguridad, incluidos rechazos por archivos inválidos y límites de tamaño. La colección de integración consolidada se conserva en `backend/postman/Bache0_Hito3_Final.postman_collection.json`.

## 3. Evidencias del repositorio

| Elemento | Archivo de referencia |
|---|---|
| Backend y ensamblaje de API | `backend/src/app.js` |
| Autenticación y usuarios | `backend/src/services/authService.js`, `backend/src/services/userService.js` |
| Inferencia asíncrona local | `backend/src/services/visionService.js`, `backend/src/services/visionWorker.js`, `backend/src/services/visionPrediction.js` |
| Reglas y cálculo de prioridad | `backend/src/services/priorityRules.js`, `backend/src/services/priorityService.js` |
| Validación de fotografías | `backend/src/middlewares/uploadValidation.js` |
| Pruebas automatizadas | `backend/test/` |
| Postman histórico Hito 2 | `backend/Bache0_Hito2.postman_collection.json` |
| Postman consolidado de integración | `backend/postman/Bache0_Hito3_Final.postman_collection.json` |

## 4. Resultado y aprendizajes

El trabajo pasó de un backend con autenticación y CRUD a un servicio con análisis visual local asíncrono, reglas de prioridad explicables y validaciones más rigurosas. Las dificultades para activar proveedores externos motivaron una solución que funciona sin claves de inferencia de terceros en su configuración predeterminada. El clasificador tiene límites: analiza la fotografía completa y su respuesta no sustituye la inspección humana.

**Nota documental:** Este archivo registra las contribuciones descritas por Bastián; debe revisarse junto con las bitácoras de David y Elías para construir la bitácora general del equipo del Hito 3. No reemplaza las evidencias de ejecución ni atribuye a un solo integrante toda la integración final.
