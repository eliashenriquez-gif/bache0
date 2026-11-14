#!/usr/bin/env node
/**
 * Bache0 - Corrección de tabla recortada + pantalla QR de escritorio.
 * Ejecutar desde el directorio raíz del repo:
 * node backend/scripts/aplicar_mejoras_ui_bache0.mjs --verificar
 * node backend/scripts/aplicar_mejoras_ui_bache0.mjs --aplicar
 *
 * Lee la estructura existente y aborta si no coincide. Nunca modifica
 * el formulario móvil, servicios, modelo, PostgreSQL ni fotografías.
 */
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const args = process.argv.slice(2);
const aplicar = args.length === 1 && args[0] === '--aplicar';
const verificar = args.length === 1 && args[0] === '--verificar';
if (!aplicar && !verificar) {
  console.error('Uso: node backend/scripts/aplicar_mejoras_ui_bache0.mjs --verificar|--aplicar');
  process.exit(2);
}

const appPath = path.join(root, 'src', 'App.jsx');
const screenPath = path.join(root, 'src', 'pages', 'ReporteBacheScreen.jsx');
const artPath = path.join(root, 'src', 'assets', 'ilustracion_reporte_ciudadano.webp');
for (const p of [appPath, screenPath, artPath]) {
  if (!fs.existsSync(p)) throw Error(`Archivo requerido ausente: ${p}`);
}
const inputApp = fs.readFileSync(appPath, 'utf8');
const inputScreen = fs.readFileSync(screenPath, 'utf8');
const normalized = (s) => s.replace(/\r\n/g,'\n');
let app = normalized(inputApp);
let screen = normalized(inputScreen);

function once(s, oldStr, newStr, label) {
  const count = s.split(oldStr).length - 1;
  if (count !== 1) throw Error(`${label}: esperado exactamente 1 bloque original, encontrado ${count}. Sin cambios.`);
  return s.replace(oldStr, newStr);
}

// DASHBOARD: mapa a ancho completo; reutilizar el listado existente de abajo,
// pues ya era idéntico al listado de la columna derecha.
let changedDashboard = false;
if (app.includes('Bache0-dashboard-ancho-completo-v1')) {
  console.log('Dashboard ya actualizado.');
} else {
const mapSectionBegin = app.indexOf('              {/* REPORTES DISPONIBLES */}');
const mapSectionEnd = app.indexOf('              {/* HISTORIAL */}', mapSectionBegin);
if (mapSectionBegin < 0 || mapSectionEnd < 0) throw Error('Sección de dashboard inesperada. Sin cambios.');
let mapPart = app.slice(mapSectionBegin, mapSectionEnd);
if (mapPart.includes('lg:grid-cols-3') && mapPart.includes('lg:col-span-2') && mapPart.includes('{/* ALERTAS Y LISTADO */}')) {
  mapPart = once(mapPart, 'grid grid-cols-1 lg:grid-cols-3 gap-6', 'grid grid-cols-1 gap-6', 'Grid del dashboard');
  mapPart = once(mapPart, 'col-span-1 lg:col-span-2 bg-white', 'col-span-1 min-w-0 bg-white', 'Panel del mapa');
  const sideBegin = mapPart.indexOf('                    {/* ALERTAS Y LISTADO */}');
  const sideEndAnchor = '\n                  </div>\n\n                )}';
  const sideEnd = mapPart.lastIndexOf(sideEndAnchor);
  if (sideBegin < 0 || sideEnd < 0 || sideEnd <= sideBegin || !mapPart.slice(sideBegin,sideEnd).includes('<ListaReportes')) {
    throw Error('Panel de reportes a la derecha distinto al esperado. Sin cambios.');
  }
  mapPart = mapPart.slice(0, sideBegin) + mapPart.slice(sideEnd);
  app = app.slice(0, mapSectionBegin) + mapPart + app.slice(mapSectionEnd);
  app = once(app, 'Historial de Reportes Oficiales', 'Reportes Comunales', 'Título del listado');
  changedDashboard = true;
} else {
  throw Error('El dashboard no coincide con el código conocido. Sin cambios.');
}
}
if (changedDashboard) {
  app = once(app, '{/* REPORTES DISPONIBLES */}', '{/* REPORTES DISPONIBLES: Bache0-dashboard-ancho-completo-v1 */}', 'Marca de actualización');
}

// QR: sólo la rama de escritorio que comienza con if (!esMovil), jamás
// los callbacks ni el formulario real mostrado a usuarios de celular.
const qrStart = screen.indexOf('  if (!esMovil) {');
const qrEndMarker = '\n  return (\n    <div style={styles.contenedorMovil}>';
const qrEnd = screen.indexOf(qrEndMarker, qrStart);
if (qrStart < 0 || qrEnd < 0 || qrEnd <= qrStart) throw Error('No se encontró el límite escritorio/móvil. Sin cambios.');
const qrOriginal = screen.slice(qrStart, qrEnd);
let changedQR = false;
if (qrOriginal.includes('escritorioTarjeta') && qrOriginal.includes('api.qrserver.com')) {
  const imports = `import logoBache0 from '../assets/logo_bache0_azul_hd.png';\nimport ilustracionCiudadano from '../assets/ilustracion_reporte_ciudadano.webp';\n`;
  if (!screen.includes("import logoBache0 from '../assets/logo_bache0_azul_hd.png';")) {
    screen = once(screen, "import iconShadow from 'leaflet/dist/images/marker-shadow.png';\n", "import iconShadow from 'leaflet/dist/images/marker-shadow.png';\n" + imports, 'Importaciones de imágenes');
  }
  // Mantener la URL real del dominio actual, no un QR pintado en la ilustración.
  const modern = `  // Bache0-QR-escritorio-v2: sólo interfaz; formulario móvil intacto.\n  if (!esMovil) {\n    const enlaceMovil = \`\${window.location.origin}/reporte\`;\n    const urlQR = \`https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=\${encodeURIComponent(enlaceMovil)}\`;\n    return (\n      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-sky-100 px-4 py-8 font-sans text-slate-900 lg:px-8 lg:py-12">\n        <main className="mx-auto w-full max-w-7xl overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-xl">\n          <header className="flex flex-wrap items-center gap-4 border-b border-slate-100 px-6 py-5 lg:px-12">\n            <img src={logoBache0} alt="Bache 0" className="h-auto w-44 object-contain lg:w-52" />\n            <span className="rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800">Módulo Ciudadano</span>\n          </header>\n          <div className="grid items-center gap-6 px-6 py-8 lg:grid-cols-2 lg:gap-10 lg:px-12 lg:py-12">\n            <section>\n              <h1 className="max-w-xl text-4xl font-extrabold leading-tight tracking-tight text-blue-950 lg:text-5xl">Reporta un bache desde tu celular</h1>\n              <p className="mt-5 max-w-lg text-base leading-relaxed text-slate-600">Toma una fotografía, confirma la ubicación en el mapa y envía los antecedentes del daño vial desde el lugar del reporte.</p>\n              <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-5">\n                <h2 className="font-bold text-blue-900">¿Por qué aparece un código QR?</h2>\n                <p className="mt-2 text-sm leading-relaxed text-blue-950">Este formulario está diseñado para utilizar la cámara y la ubicación del teléfono. Si estás en un computador, escanea el QR con tu celular para continuar en el módulo ciudadano.</p>\n              </div>\n              <div className="mt-6 flex flex-wrap items-center gap-5">\n                <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-md">\n                  <img src={urlQR} alt="QR que abre el formulario de Bache0 en el celular" className="h-48 w-48 lg:h-52 lg:w-52" />\n                  <p className="mt-2 text-center text-sm font-bold text-blue-900">Escanea y reporta</p>\n                </div>\n                <div className="max-w-52 text-sm leading-relaxed text-slate-600">\n                  <p className="font-bold text-slate-900">Tres pasos</p>\n                  <p className="mt-2">1. Fotografía del daño</p>\n                  <p>2. Confirma el punto en el mapa</p>\n                  <p>3. Completa y envía el reporte</p>\n                  <a href={enlaceMovil} className="mt-4 inline-block break-all font-semibold text-blue-700 underline">Abrir enlace del formulario</a>\n                </div>\n              </div>\n            </section>\n            <aside className="overflow-hidden rounded-3xl border border-blue-100 bg-blue-50 shadow-sm">\n              <img src={ilustracionCiudadano} alt="Ilustración de una persona que registra un bache utilizando el formulario del celular" className="h-auto w-full object-cover" />\n              <p className="px-5 py-3 text-xs text-slate-500">Simulación ilustrativa del proceso de reporte. El formulario real se abre al escanear el QR.</p>\n            </aside>\n          </div>\n          <div className="grid gap-4 border-t border-blue-100 bg-slate-50 px-6 py-6 lg:grid-cols-3 lg:px-12">\n            <div className="rounded-xl bg-white p-4"><p className="font-bold text-blue-900">1 · Toma una foto</p><p className="mt-1 text-sm text-slate-600">Registra claramente el daño del pavimento.</p></div>\n            <div className="rounded-xl bg-white p-4"><p className="font-bold text-blue-900">2 · Confirma la ubicación</p><p className="mt-1 text-sm text-slate-600">Verifica o ajusta el pin en el mapa.</p></div>\n            <div className="rounded-xl bg-white p-4"><p className="font-bold text-blue-900">3 · Envía el reporte</p><p className="mt-1 text-sm text-slate-600">Completa los datos y recibe un folio.</p></div>\n          </div>\n        </main>\n      </div>\n    );\n  }\n`;
  screen = screen.slice(0, screen.indexOf('  if (!esMovil) {')) + modern + screen.slice(screen.indexOf(qrEndMarker, screen.indexOf('  if (!esMovil) {')));
  changedQR = true;
} else if (screen.includes('Bache0-QR-escritorio-v2')) {
  console.log('QR escritorio ya actualizado.');
} else {
  throw Error('El bloque QR no coincide con el código conocido. Sin cambios.');
}

// Backup y escritura sólo tras validar ambos archivos.
console.log(`Validación OK: dashboard ${changedDashboard?'se corrige':'ya corregido'}; QR ${changedQR?'se moderniza':'ya modernizado'}.`);
console.log('No se modifican reportes, backend, IA ni base de datos.');
if (!aplicar) {
  console.log('Modo --verificar: archivos sin cambios.');
  process.exit(0);
}
const backupDir = path.join(root, '..', 'respaldos', 'ui_antes_mejoras_' + new Date().toISOString().replace(/[:.]/g,'-'));
fs.mkdirSync(backupDir, {recursive:true});
fs.copyFileSync(appPath, path.join(backupDir, 'App.jsx'));
fs.copyFileSync(screenPath, path.join(backupDir, 'ReporteBacheScreen.jsx'));
if (changedDashboard) fs.writeFileSync(appPath, inputApp.includes('\r\n')?app.replace(/\n/g,'\r\n'):app);
if (changedQR) fs.writeFileSync(screenPath, inputScreen.includes('\r\n')?screen.replace(/\n/g,'\r\n'):screen);
console.log('Aplicado. Respaldos:',backupDir);
console.log('Siguiente: npm.cmd run build; git diff --check; probar en Preview antes de commit.');
