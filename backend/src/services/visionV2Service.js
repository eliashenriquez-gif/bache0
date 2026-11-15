'use strict';
/** Puente opt-in Python RF-DETR. Desactivado salvo VISION_V2_PROVIDER=rfdetr.
 * No altera el motor de prioridad; ante fallo, retorna {ok:false}.
 * La clave se obtiene SOLO de variable de entorno ROBOFLOW_API_KEY.
 */
const path = require('node:path');
const { spawn } = require('node:child_process');

const PY_SCRIPT = path.resolve(__dirname, '../../scripts/vision-v2/inferir_rf_detr_online.py');
const TIMEOUT = 45000;
let crearProceso = spawn;

function analyzeImage(rutaFoto) {
  return new Promise((resolve) => {
    if (process.env.VISION_V2_PROVIDER !== 'rfdetr') {
      return resolve({ ok: false, error_code: 'VISION_V2_DESHABILITADA', mensaje: 'Visión V2 no habilitada' });
    }
    if (!process.env.ROBOFLOW_API_KEY) {
      return resolve({ ok: false, error_code: 'VISION_V2_SIN_CREDENCIALES', mensaje: 'No se configuró acceso al proveedor' });
    }
    const python = process.env.VISION_V2_PYTHON;
    if (!python) {
      return resolve({ ok: false, error_code: 'VISION_V2_SIN_PYTHON', mensaje: 'Falta VISION_V2_PYTHON' });
    }
    let child;
    try {
      child = crearProceso(python, [PY_SCRIPT, rutaFoto], {
        stdio: ['ignore', 'pipe', 'pipe'], shell: false, windowsHide: true,
        env: process.env,
      });
    } catch {
      return resolve({ ok: false, error_code: 'VISION_V2_LANZAMIENTO', mensaje: 'No se pudo iniciar el analizador' });
    }
    let output = '';
    let finished = false;
    const finish = (result) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      resolve(result);
    };
    const fail = (code) => finish({ ok: false, error_code: code, mensaje: 'Visión V2 no disponible' });
    const timer = setTimeout(() => { try { child.kill(); } catch {} fail('VISION_V2_TIMEOUT'); }, TIMEOUT);
    child.stdout?.on('data', (chunk) => {
      output += String(chunk);
      if (output.length > 1_000_000) {
        try { child.kill(); } catch {}
        fail('VISION_V2_RESPUESTA_EXCESIVA');
      }
    });
    // stderr no se registra: puede contener detalles del proveedor / credenciales.
    child.stderr?.resume();
    child.on('error', () => fail('VISION_V2_PROCESO'));
    child.on('close', (code) => {
      if (finished) return;
      if (code !== 0) return fail('VISION_V2_INFERENCIA');
      let value;
      try { value = JSON.parse(output); } catch { return fail('VISION_V2_JSON'); }
      if (!value || value.ok !== true || !value.analisis ||
          !Array.isArray(value.analisis.detecciones) ||
          value.analisis.severidad_sugerida !== null ||
          value.analisis.puntos_ia !== 0 ||
          value.analisis.modelo !== 'bache0-v2-segmentation-2-rfdetr-seg-small-t1' ||
          !Number.isFinite(value.analisis.confianza) ||
          value.analisis.detecciones.some(d => d.etiqueta !== 'bache' || d.severidad_sugerida !== null ||
            !Number.isFinite(d.confianza) || d.confianza < 0 || d.confianza > 1)) {
        return fail('VISION_V2_CONTRATO');
      }
      return finish(value);
    });
  });
}
module.exports = { analyzeImage, _setCrearProcesoParaPruebas: fn => { crearProceso = fn ?? spawn; } };
