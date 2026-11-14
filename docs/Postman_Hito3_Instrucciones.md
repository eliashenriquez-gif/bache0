# Bache0 — Instrucciones de Postman (Hito 3)

## 1. Objetivo

Esta colección permite comprobar el funcionamiento de la API REST de Bache0 mediante pruebas de autenticación, permisos, aislamiento municipal, reportes, fotografías, visión artificial y motor de prioridad.

## 2. Requisitos

- Postman instalado.
- Backend de Bache0 funcionando.
- PostgreSQL configurado y con las cuentas de demostración.
- Colección y entorno Postman importados.
- Credenciales de prueba entregadas por el equipo.

## 3. Archivos

- `backend/postman/Bache0_Hito3_Final.postman_collection.json`: colección de pruebas.
- `backend/postman/Bache0_Local.example.postman_environment.json`: plantilla de variables.
- `backend/Bache0_Hito3.postman_collection.json`: colección técnica original.

## 4. Preparación del backend

Comprobar que PostgreSQL está funcionando.

Desde la raíz del proyecto, iniciar el backend con:

```powershell
node backend/src/app.js
```

La API estará disponible en `http://localhost:3000/api/v1`, siempre que el entorno local esté correctamente configurado.

Para verificarla, ejecutar:

```powershell
curl.exe http://localhost:3000/api/v1/health
```

Se espera una respuesta con `"status": "ok"`.

## 5. Configuración de Postman

1. Importar la colección final.
2. Importar el entorno de ejemplo.
3. Seleccionar el entorno importado.
4. Configurar `baseUrl` con la dirección de la API.
5. Ingresar las credenciales de demostración entregadas por el equipo.
6. Ejecutar los login para generar los tokens JWT.

Los JWT se guardan automáticamente mediante los scripts de Postman.

## 6. Usuarios y roles

La instalación de demostración utiliza:

| Usuario | Rol | Municipalidad |
|---|---|---|
| Superadministrador | `superadministrador` | Acceso global |
| Administrador Estación Central | `administrador_municipal` | ID 1 |
| Administrador La Pintana | `administrador_municipal` | ID 2 |
| Administrador El Bosque | `administrador_municipal` | ID 3 |
| Inspector Estación Central | `inspector` | ID 1 |

Las cuentas existentes no deben volver a crearse. Si se utiliza una base de datos nueva, primero deben prepararse usuarios de demostración equivalentes.

## 7. Ejecución de pruebas

Las carpetas están organizadas de la siguiente manera:

- `00`: Estado de API y autenticación.
- `01`: Listados municipales.
- `02`: Aislamiento y permisos.
- `03`: Fotografías privadas.
- `04`: Usuarios y roles.
- `05`: Validaciones y errores.
- `06`: Visión artificial.
- `07`: Reportes y persistencia.
- `08`: Permisos del inspector.
- `09`: Cobertura municipal y archivos inválidos.

Las carpetas 07 y 09 contienen pruebas manuales que requieren fotografías de ejemplo. Algunas solicitudes crean o modifican registros; deben ejecutarse únicamente sobre datos de demostración.

## 8. Fotografías de prueba

Para la creación de reportes, seleccionar una fotografía válida en `Body → form-data → foto → File`.

El backend admite JPEG, PNG y WebP, con un tamaño máximo de 10 MiB.

La prueba de archivos grandes requiere una imagen de más de 10 MiB. Las pruebas de formatos no admitidos pueden realizarse con un PDF ficticio.

## 9. Resultados esperados

Se verifican, entre otros:

- `200`: consulta autorizada.
- `201`: creación de reporte.
- `202`: solicitud de reprocesamiento de visión.
- `400`: validación incorrecta.
- `401`: autenticación ausente o inválida.
- `403`: operación prohibida.
- `404`: recurso no disponible para el usuario.
- `413`: archivo demasiado grande.
- `415`: tipo de archivo no admitido.
- `422`: municipalidad sin cobertura.

En las consultas municipales no basta con comprobar HTTP 200: también debe verificarse que los datos pertenezcan a la municipalidad autenticada.

## 10. Seguridad y acceso

Las contraseñas y tokens JWT no se publican en GitHub.

Las credenciales de demostración se entregarán al evaluador mediante un canal privado.

Para ejecutar las solicitudes, el evaluador necesita acceso a una instancia del backend con PostgreSQL y cuentas de prueba configuradas. La URL `localhost` se refiere al equipo que ejecuta Postman, no al notebook de los integrantes.

## 11. Consideraciones finales

Las pruebas de Postman fueron desarrolladas para validar el prototipo Bache0. Las fotografías utilizadas en los reportes ficticios no representan necesariamente desperfectos reales de las municipalidades chilenas.

La creación de reportes puede activar el procesamiento asíncrono de visión artificial y el cálculo de prioridad. Los resultados deben verificarse después de completarse el análisis.

Las pruebas automatizadas del backend se ejecutan por separado mediante `npm test` dentro de `backend`.