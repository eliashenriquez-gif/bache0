# BITÁCORA INDIVIDUAL DE TRABAJO
## Proyecto Bache0 — Hitos 2 y 3

**Integrante:** David Ojeda  
**Proyecto:** Bache0 — Sistema de reporte y gestión de desperfectos viales  
**Área de responsabilidad:** Desarrollo e integración del módulo ciudadano  
**Tecnologías utilizadas:** React, Vite, JavaScript, Node.js, Express, Git, GitHub, Vercel y Cloudflare Tunnel.  
**Período documentado:** Noviembre de 2026

---

## 1. Introducción

La presente bitácora tiene como objetivo registrar las actividades que desarrollé durante los Hitos 2 y 3 del proyecto Bache0.

Mi responsabilidad principal consistió en desarrollar, mejorar e integrar el módulo ciudadano, permitiendo que las personas pudieran reportar desperfectos viales mediante un formulario web accesible desde dispositivos móviles.

Durante el desarrollo trabajé en la interfaz, la geolocalización, la incorporación de fotografías, las validaciones del formulario y la comunicación con el backend del sistema.

También participé en la integración de los módulos del equipo y en la realización de pruebas funcionales para verificar que los reportes fueran recibidos y almacenados correctamente.

## 2. Registro cronológico de actividades

### Etapa 1. Desarrollo inicial del módulo ciudadano
**Período: Hito 2**

**Actividades realizadas:**
- Desarrollo de la interfaz del formulario ciudadano utilizando React.
- Implementación de campos para registrar los antecedentes del desperfecto vial.
- Incorporación de la funcionalidad para adjuntar fotografías.
- Integración de un mapa para seleccionar la ubicación del bache.
- Implementación de la obtención de coordenadas mediante GPS.
- Adaptación de la interfaz para su utilización desde dispositivos móviles.

**Resultado:** Se desarrolló la estructura funcional del módulo ciudadano, permitiendo ingresar la información necesaria para generar reportes.

### Etapa 2. Mejoras en las validaciones y geolocalización
**Período: Hito 2 y transición al Hito 3**

**Actividades realizadas:**
- Implementación de validaciones para los campos obligatorios.
- Restricción de fotografías a formatos JPEG, PNG y WebP.
- Incorporación del límite máximo de 10 MB por fotografía.
- Desarrollo de la selección manual de ubicación cuando el GPS no está disponible.
- Implementación de la confirmación del punto seleccionado en el mapa.
- Incorporación de mensajes de error para ubicaciones no válidas o fuera de cobertura.

**Resultado:** Se mejoró la confiabilidad del formulario y se redujo la posibilidad de enviar reportes con información incompleta o ubicaciones incorrectas.

### Etapa 3. Integración del módulo ciudadano con el backend
**Período: Noviembre de 2026**

**Actividades realizadas:**
- Revisión del contrato de comunicación entre frontend y backend.
- Verificación de los nombres y formatos de los campos enviados.
- Integración del formulario con el endpoint `POST /api/v1/reportes`.
- Implementación del envío de fotografías mediante `FormData`.
- Incorporación de estados de carga, éxito y error.
- Implementación de la visualización del folio devuelto por el servidor.
- Coordinación con Elías para integrar el módulo ciudadano con los servicios del sistema.
- Participación en la integración de los cambios mediante Git.

**Resultado:** El módulo ciudadano quedó preparado para enviar reportes reales al backend sin requerir que el usuario iniciara sesión.

### Etapa 4. Despliegue y configuración del entorno de pruebas
**Fecha: 12 de noviembre de 2026**

**Actividades realizadas:**
- Utilización de Vercel para publicar el frontend del proyecto.
- Verificación del funcionamiento del formulario desde un teléfono celular.
- Coordinación con Elías para obtener una dirección HTTPS del backend mediante Cloudflare Tunnel.
- Identificación y revisión de problemas iniciales de conexión.
- Configuración de la variable de entorno `VITE_API_URL` en Vercel.
- Realización de un nuevo despliegue de producción.
- Comprobación de la comunicación entre el frontend publicado y el backend.

**Resultado:** Se consiguió establecer la comunicación entre el módulo ciudadano alojado en Vercel y el backend del proyecto.

### Etapa 5. Prueba real de creación de reportes
**Fecha: 12 de noviembre de 2026**

**Actividades realizadas:**
- Ingreso al formulario ciudadano desde un dispositivo móvil.
- Selección de una fotografía del desperfecto.
- Selección y confirmación de la ubicación.
- Ingreso de los antecedentes solicitados.
- Envío de un reporte real.
- Verificación de la respuesta del servidor.
- Revisión del reporte desde el panel municipal.
- Comprobación de la fotografía, ubicación, severidad y demás antecedentes.
- Actualización del panel municipal para verificar que el reporte permaneciera registrado.

**Resultado:** La prueba fue exitosa. El reporte enviado desde el módulo ciudadano apareció en el panel municipal con sus datos y fotografía, y permaneció disponible después de actualizar la página.

### Etapa 6. Pruebas de validación y manejo de errores
**Fecha: 12 de noviembre de 2026**

**Actividades realizadas:**
- Prueba de envío con campos obligatorios incompletos.
- Verificación de mensajes de validación del formulario.
- Comprobación de la restricción de tipos de archivo desde el selector de fotografías.
- Prueba de selección manual de ubicación con el GPS desactivado.
- Verificación del rechazo de ubicaciones fuera de cobertura.
- Prueba del comportamiento del formulario durante una pérdida de conexión.
- Recuperación de la conexión y envío exitoso de un reporte.

**Resultado:** Las pruebas confirmaron que el formulario valida información obligatoria, permite seleccionar ubicaciones manualmente y puede continuar funcionando después de recuperar la conexión.

**Observación:** La prueba de rechazo directo de un archivo inválido quedó limitada porque el selector no permitió elegir archivos distintos de imágenes. Tampoco se completó una prueba aislada de fallo durante una solicitud de envío ya iniciada.

### Etapa 7. Revisión del repositorio y documentación
**Fecha: 12 de noviembre de 2026**

**Actividades realizadas:**
- Verificación del estado del repositorio mediante `git status -sb`.
- Confirmación de que la rama `integration/elias-david` no presentaba cambios pendientes en archivos versionados.
- Identificación de archivos locales de respaldo y pruebas que no debían incorporarse al repositorio.
- Elaboración del informe de pruebas del módulo ciudadano.
- Registro de resultados, funcionalidades implementadas y verificaciones pendientes.

**Resultado:** El trabajo quedó integrado en la rama compartida y se preparó documentación de respaldo para la entrega del Hito 3.

---

## 3. Principales dificultades encontradas

Durante el desarrollo e integración del módulo ciudadano se presentaron diversas dificultades técnicas.

**Problemas de integración:** Fue necesario revisar las diferencias entre los datos enviados desde el formulario y los campos esperados por el backend.

**Problemas de conexión:** Inicialmente, el frontend publicado no podía comunicarse con el servidor. Esto se solucionó configurando la dirección HTTPS del backend en Vercel.

**Problemas con Cloudflare Tunnel:** Se presentaron errores de conexión con algunos enlaces temporales, por lo que fue necesario coordinar con Elías la disponibilidad del servidor.

**Validación de ubicaciones:** Se realizaron comprobaciones para impedir el envío de reportes con ubicaciones no confirmadas o fuera de cobertura.

**Pruebas de funcionamiento:** Fue necesario verificar que los reportes no fueran simulados y que sus datos pudieran recuperarse desde el panel municipal.

Estas dificultades permitieron fortalecer la integración del módulo ciudadano y comprobar su funcionamiento en condiciones reales.

## 4. Resultados obtenidos

Al finalizar las actividades documentadas, se consiguieron los siguientes resultados:

- Módulo ciudadano accesible desde dispositivos móviles.
- Formulario conectado a una API real.
- Envío de reportes sin autenticación ciudadana.
- Incorporación de fotografías y coordenadas geográficas.
- Validación de campos obligatorios.
- Selección manual de ubicación cuando el GPS no está disponible.
- Control de cobertura municipal.
- Recepción del folio generado por el backend.
- Visualización de reportes y fotografías en el panel municipal.
- Comprobación de persistencia después de actualizar la página.
- Recuperación del funcionamiento tras una interrupción de conexión.

## 5. Actividades pendientes

Aunque el flujo principal del módulo ciudadano fue probado exitosamente, quedaron algunas comprobaciones para el cierre definitivo:

1. Realizar una prueba controlada del envío cuando el servicio de inteligencia artificial esté deshabilitado o presente fallas.
2. Verificar el comportamiento específico ante un error durante una solicitud de envío ya iniciada.
3. Completar las evidencias de las pruebas de formatos y tamaños de fotografía no permitidos.
4. Coordinar con el equipo la disponibilidad del backend y de la base de datos durante la presentación final.

Estas actividades corresponden principalmente a validaciones complementarias y coordinación de la integración general.

## 6. Conclusión personal

Mi participación en el proyecto Bache0 estuvo enfocada en desarrollar una interfaz ciudadana funcional, accesible y conectada con los servicios reales del sistema.

Durante los Hitos 2 y 3 pude aplicar conocimientos de desarrollo frontend, integración de API REST, validaciones, geolocalización, gestión de archivos, control de versiones y despliegue web.

Uno de los logros más importantes fue conseguir que un reporte enviado desde el celular llegara correctamente al backend y pudiera visualizarse en el panel municipal, manteniendo su fotografía, ubicación e información después de actualizar la página.

Considero que el trabajo realizado representa un avance significativo en el desarrollo de Bache0, ya que permite demostrar el funcionamiento real de una de las funcionalidades principales del proyecto.

**Estado final:** Módulo ciudadano implementado, integrado y con su flujo principal validado. Quedan pruebas complementarias para el cierre definitivo del Hito 3.