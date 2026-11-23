# Bache 0 · Bitácora consolidada del equipo — Hitos 1, 2 y 3

**Período:** septiembre–23 de noviembre de 2026. **Asignatura:** Arquitectura de Desarrollo (Móvil y Web), INGT1003-001, Universidad Mayor. **Equipo:** Elías Henríquez, Bastián Mansilla y David Ojeda. **Docente:** Prof. Carlos Muñoz S.

**Criterio documental.** Se seleccionan hitos con respaldo en commits, documentos, bitácoras y pruebas fechadas. Las contribuciones fueron colaborativas: un commit evidencia una publicación atribuida a su autor, no que esa persona haya diseñado por sí sola toda la función. «Probado por el equipo» distingue una prueba registrada de una ejecución realizada nuevamente en esta revisión. Horas-hombre del Hito 1 fueron **estimaciones**, no horas efectivamente trabajadas.

## 1. Hito 1 · Propuesta y prototipo (septiembre)

| Fecha | Responsable(s) | Trabajo y decisión | Dificultad / solución | Evidencia |
|---|---|---|---|---|
| **1–7 sep.** | Bastián, Elías y David | Bastián preparó componentes mock, lista, mapa y dashboard; Elías desarrolló panel municipal y la integración; David construyó formulario ciudadano adaptable a web. | Había dos experiencias de uso; se separaron módulo ciudadano y municipal. | Commits `ebfeb10`, `b9edfd0`, `cf9011b`, `74c7141`. |
| **15–18 sep.** | Equipo | Se integró módulo ciudadano, mapa de calor, rutas de React, identidad visual y prototipo navegable. | La navegación directa en Vercel daba 404; se ajustó `vercel.json`. | `3c1998c`, `00a837c`, `595942e`, `6b45510`, `126ca60`. |
| **20–25 sep.** | Equipo; Elías coordina documentación | Se consolidó propuesta de centralización de reportes, arquitectura cliente-servidor, comparación React/Vue, Express/Spring y PostgreSQL/MongoDB. | El prototipo seguía con datos simulados: se dejó su conexión real al servidor para los siguientes hitos. | Informe `docs/Informe_HITO1_Documento_de_propuesta.pdf`; `197afb4`. |
| **23–27 oct. (ajuste H1)** | Equipo, publicación de Elías | Se revisó el enfoque comercial y la presentación de la propuesta según observaciones del docente. | Conservar la misma «skin» azul/amarilla para documentación posterior. | `dd41a4c`, `b82220a`. |

**Decisión rectora H1:** promesa estable durante el semestre: foto y ubicación desde el celular; datos en un mismo sistema; mapa y gestión municipal. El Hito 1 estima **360 HH** totales repartidas en 45 H1, 180 H2 y 135 H3; son proyecciones del equipo.

## 2. Hito 2 · API, datos, autenticación y panel (octubre–principios de noviembre)

| Fecha | Responsable(s) | Trabajo y decisión | Dificultad / solución | Evidencia |
|---|---|---|---|---|
| **20–24 oct.** | Elías y Bastián | Incorporación de base PostgreSQL, scripts SQL, contrato REST y estructura Express; rutas/controladores y manejo de errores. | Se necesitaba separar responsabilidades para evitar SQL mezclado con interfaz. | `d0e800c`, `06e06ea`, `07c9fb7`, `2058ae3`, `c33e3d6`. |
| **26–29 oct.** | Bastián | CRUD de usuarios, contraseñas Argon2id, JWT, roles, límites de login, ámbito por municipalidad y preparación de superadministrador. | Se acordó no guardar credenciales en código ni exponer datos municipales de otras comunas. | `7ded056`, `23999f3`, `c4f6643`. |
| **30 oct.–1 nov.** | David, Elías y Bastián | David integró formulario, GPS/pin, foto y validaciones; Elías conectó repositorios de usuarios y servicios frontend; Bastián consolidó autenticación y pruebas Postman iniciales. | Contratos y servicios debían coincidir entre módulos. | `323e121`, `774bf9d`, `d0cbb6b`, `d5d0404`, `e0c39f7`, `547867c`. |
| **2–8 nov.** | Elías y David, apoyo Bastián | Elías conectó login, dashboard y reportes reales a la API, fotografía privada y gestión de estados. David continuó formulario ciudadano y servicio de ubicación. | Sustituir pantallas con mock por llamadas reales y controlar permisos sobre fotos. | `3116de4`, `0816894`, `1f9e927`, `0514e83`, `684ac0a`, `8f5e853`. |
| **8–10 nov.** | Elías, David y Bastián | Integración inicial en `integration/elias-david`, auditoría y migración de prioridad (`motivos` JSONB, `version_reglas`); pruebas por municipio y definición de alcance. | Providencia se deja **sin cobertura**; el piloto opera en Estación Central, La Pintana y El Bosque. | `129f3b2`, `d2e9e0a`, `546c638`, bitácora de pruebas 10/11. |

**Decisiones de fondo:** modelo de cinco tablas (`municipalidades`, `usuarios`, `reportes`, `analisis_vision`, `auditoria_eventos`), fotos fuera de la BD en carpeta privada, auditoría inmutable y archivado lógico. Un admin municipal solo ve su ámbito; el superadministrador tiene alcance transversal autorizado. Monolito modular elegido por coste y tamaño del equipo.

## 3. Hito 3 · Integración, IA, prueba y reproducibilidad (noviembre)

| Fecha | Responsable(s) | Trabajo y decisión | Dificultad / solución | Evidencia |
|---|---|---|---|---|
| **10 nov.** | Bastián y equipo | Evaluación de servicios externos de visión, incluyendo Google/Hugging Face; desarrollo del motor de prioridad. | Problemas de cuotas, facturación y acceso; se evita que el MVP dependa de esas APIs. | `3f835d3`, `82d369b`, bitácora Bastián. |
| **10–11 nov.** | Elías y David | Elías respaldó base/fotos y preparó notebook; David completó QR dinámico. Se coordinó Vercel con backend mediante HTTPS. | `localhost` del computador no es accesible desde un celular remoto; se adopta Cloudflare Tunnel temporal. | `2b95935`, `14fa771`, bitácora David. |
| **11–12 nov.** | Bastián | Clasificador **MobileNetV2 local** con TensorFlow.js, `sharp` y worker; prioridad `prototipo-v1` con motivos y registro asíncrono. | La IA puede fallar o confundir escenas; se guarda primero el reporte y la visión no estima profundidad/severidad. | `e652ae0`, `43e4d06`, `815c6d0`, `docs/vision-ia-hito3.md`. |
| **12 nov.** | David | Prueba comunicada de envío ciudadano desde móvil hacia backend, lectura en panel y persistencia, y validaciones de foto/ubicación. | Se identificó dependencia de URL HTTPS, CORS y disponibilidad de notebook. | `7065b98`, `docs/bitacora_david_ojeda.md` (resultado comunicado; no certificación global). |
| **12–13 nov.** | Bastián, Elías y David | Integración de la rama backend con frente Elías-David; validaciones de archivos, cola y pruebas Node, compilación Vite. | Se instalaron dependencias faltantes y se separaron cambios para no sobrescribir ramas. | `4fb2571`, `ba78458`, `3c4b944`; bitácora integración: **176/176 pruebas** en esa fase. |
| **13–14 nov.** | Elías | Consolidación Postman Hito 3: JWT, usuarios, lectura propia/ajena, fotos, errores, cobertura e IA. | Pruebas que esperaban 401, 403, 404 y 400 requieren tokens e IDs correctos; no todas se ejecutan automáticamente. | `d50fa39`, `9663588`: **73 solicitudes** en 10 carpetas; ensayo histórico de **54 solicitudes seguras / 108 aserciones**. |
| **13–14 nov.** | Elías | Preparación controlada de 45 fotografías/45 máscaras públicas y manifiestos para demo e investigación. | Dataset colombiano no equivale a calles chilenas; preparación de imágenes **no demuestra** que 45 reportes se cargaron en la BD. | `f42b8ce`, `27dd85b`, `docs/Bache0_Reproducibilidad_y_Demo45.md`. |
| **14–15 nov.** | Elías | Evaluación exploratoria de alternativas de visión y RF-DETR sobre muestras de investigación; V2 opcional en código. | El modelo local producía falsos positivos; RF-DETR se conserva **opt-in** para no reemplazar el estable ni alterar prioridad. | `docs/Bache0_Vision_V2_Informe_Final_20261115.md`, `def09e1`, merge `4a5465d`. |
| **20–21 nov.** | Elías | Normalización de documento Hito 2, diagramas, contrato, README, colecciones, bitácora de Bastián e instalación en carpeta limpia. | Errores de `.env`, conexión y herramientas; se preparó `bache0_profesor` en puerto 3100 para no afectar desarrollo. | `112d1c2`, `82d430c`, `526bd82`, `8991d93`; **12/12 CRUD H2**, **191/191 Node**, `/health` y cinco tablas. |
| **23 nov.** | Elías (prueba de preparación) | Revisión de backend y túnel del notebook, variables Vercel y Postman. | `node: .env: not found` se resolvió situando la configuración privada en `backend/.env`; `/health` respondió `ok` local y por túnel. En Postman una prueba de 404 respondió 401 por token inválido/vencido: hay que renovar JWT antes de repetir. | Capturas y resultados de PowerShell/Postman aportados en conversación; **no declarar la prueba 404 aprobada** por esa ejecución. |

## 4. Balance de responsabilidades y decisiones

| Integrante | Aportes principales que respaldan los registros |
|---|---|
| **Elías Henríquez** | Panel municipal y API real, esquema/SQL y repositorios, auditoría, integración de ramas, seguridad por ámbito, Postman, evaluación RF-DETR opcional, documentos, instalación limpia y preparación de demostración. |
| **Bastián Mansilla** | API REST/Express, controladores, usuarios, JWT/Argon2id y roles, errores y validaciones, modelo MobileNetV2/worker, motor de prioridad y tests de backend. |
| **David Ojeda** | Módulo ciudadano, formulario, foto y validaciones, geolocalización/pin, QR, servicios de envío y Vercel/HTTPS, pruebas móviles registradas. |

**Alternativas y consecuencias.** React frente a Vue: continuidad y convenciones propias. Express frente a Spring Boot: lenguaje compartido y disciplina de capas. PostgreSQL frente a MongoDB: consistencia relacional y necesidad de migraciones. Monolito frente a microservicios: menos despliegues y escalamiento menos granular. APIs externas de visión frente a MobileNetV2 local: menos dependencia/costo, a cambio de menor capacidad de detectar objetos. RF-DETR es investigación adicional, no la ruta estable.

## 5. Cierre y fuentes de evidencia

Bache 0 llegó al Hito 3 con módulos integrados, persistencia PostgreSQL, controles municipales, clasificación visual auxiliar y documentación técnica. Las **191 pruebas Node** y las **12 solicitudes CRUD** pertenecen a ejecuciones documentadas; las **73 solicitudes Postman H3** son el tamaño de una colección, no 73 resultados aprobados. La estabilidad del túnel HTTPS durante la defensa y la ejecución E2E en el entorno final deben comprobarse en el momento de evaluar.

**Fuentes principales:** `docs/Informe_HITO1_Documento_de_propuesta.pdf`; `docs/Bache0_Hito2_Documento_Tecnico.pdf`; `docs/Bache0_Hito2_Evidencia_Instalacion_Limpia_2026-11-21.md`; `docs/Bache0_Checklist_Pauta_Hito3.md`; archivos versionados ahora en `docs/bitacoras_historicas/`; `docs/Bache0_Protocolo_Vision_V2.md`; `docs/Bache0_Vision_V2_Informe_Final_20261115.md`; `backend/postman/`; historial de [commits de Bache 0](https://github.com/eliashenriquez-gif/bache0/commits/main/). El material `Bache0_Contexto_Historico_Completo_para_Claude_2026-11-21.md` se utilizó como **fuente complementaria**, no como evidencia autónoma.
