import React, { useState } from "react";

/** Vista solamente informativa. No calcula gravedad ni escribe prioridad. */
export const esVisionV2 = (analisis) =>
  analisis?.proveedor === "Roboflow-RFDETR-V2" ||
  analisis?.modelo === "bache0-v2-segmentation-2-rfdetr-seg-small-t1";

const porcentaje = (valor) =>
  typeof valor === "number" && Number.isFinite(valor) && valor >= 0 && valor <= 100
    ? `${valor.toLocaleString("es-CL", { maximumFractionDigits: 2 })} %`
    : "No disponible";

const confianza = (valor) =>
  typeof valor === "number" && Number.isFinite(valor) && valor >= 0 && valor <= 1
    ? `${(valor * 100).toLocaleString("es-CL", { maximumFractionDigits: 1 })} %`
    : "No disponible";

function cajaValida(caja, ancho, alto) {
  if (!caja || !ancho || !alto) return false;
  const { x_min, y_min, x_max, y_max } = caja;
  return [x_min, y_min, x_max, y_max].every(n => typeof n === "number" && Number.isFinite(n)) &&
    x_min >= 0 && y_min >= 0 && x_max <= ancho && y_max <= alto &&
    x_max > x_min && y_max > y_min;
}

export default function VisionV2Detalle({ analisis, fotoUrl }) {
  const [dimensionesFoto, setDimensionesFoto] = useState(null);
  if (!esVisionV2(analisis)) return null;

  const detecciones = Array.isArray(analisis?.detecciones) ? analisis.detecciones : [];
  const candidatos = detecciones.filter(d => d?.etiqueta === "bache");
  // Un resumen se guarda también cuando la IA no encuentra candidatos.
  const resumen = detecciones.find(d => d?.resumen_visual?.version === "v2-visual-1")?.resumen_visual;
  const total = Number.isSafeInteger(resumen?.baches_candidatos)
    ? resumen.baches_candidatos : candidatos.length;
  const areaUnion = resumen?.area_visual_pct_union;
  const coincideFoto = dimensionesFoto && resumen?.ancho_imagen === dimensionesFoto.ancho &&
    resumen?.alto_imagen === dimensionesFoto.alto;
  const cajas = coincideFoto
    ? candidatos.filter(d => cajaValida(d.caja, dimensionesFoto.ancho, dimensionesFoto.alto))
    : [];

  return (
    <div className="space-y-3 border-t border-blue-100 pt-3" data-testid="resumen-vision-v2">
      <div className="flex flex-wrap gap-2">
        <span className="rounded-md bg-blue-100 px-2.5 py-1 font-semibold text-blue-900">
          {total === 0 ? "Sin baches detectados" : `${total} candidato${total === 1 ? "" : "s"} a bache`}
        </span>
        <span className="rounded-md bg-slate-100 px-2.5 py-1 text-slate-700">
          Área visual conjunta: {porcentaje(areaUnion)}
        </span>
      </div>
      <p className="text-slate-600">
        El área visual indica cuánto ocupa la detección dentro de esta fotografía;
        no representa metros cuadrados, profundidad ni tamaño físico comparable entre fotos.
      </p>
      {total === 0 && (
        <p className="text-amber-800">
          No detectar un bache no confirma que la calle esté sana. Revisar la imagen original.
        </p>
      )}
      {candidatos.length > 0 && (
        <ul className="space-y-1" aria-label="Baches candidatos detectados">
          {candidatos.slice(0, 10).map((d, i) => (
            <li key={i} className="flex flex-wrap justify-between gap-2 rounded-md border border-slate-200 px-2 py-1">
              <span>Bache candidato {i + 1} · confianza {confianza(d.confianza)}</span>
              <span>Área en foto: {porcentaje(d.area_visual_pct)}</span>
            </li>
          ))}
          {candidatos.length > 10 && <li>Se muestran 10 de {candidatos.length} candidatos.</li>}
        </ul>
      )}
      {fotoUrl && candidatos.length > 0 && (
        <div>
          <p className="mb-2 font-medium">Ubicación aproximada de los candidatos en la fotografía</p>
          <div className="relative inline-block max-w-full overflow-hidden rounded-lg bg-slate-900">
            <img
              src={fotoUrl}
              alt="Fotografía del reporte con posibles baches señalados por rectángulos"
              className="block h-auto max-h-56 w-auto max-w-full"
              onLoad={e => setDimensionesFoto({
                ancho: e.currentTarget.naturalWidth,
                alto: e.currentTarget.naturalHeight,
              })}
              onError={() => setDimensionesFoto(null)}
            />
            {cajas.length > 0 && (
              <svg
                aria-label="Rectángulos de los posibles baches"
                role="img"
                className="pointer-events-none absolute inset-0 h-full w-full"
                viewBox={`0 0 ${dimensionesFoto.ancho} ${dimensionesFoto.alto}`}
                preserveAspectRatio="none"
              >
                {cajas.map((d, i) => (
                  <rect key={i} x={d.caja.x_min} y={d.caja.y_min}
                    width={d.caja.x_max - d.caja.x_min}
                    height={d.caja.y_max - d.caja.y_min}
                    fill="none" stroke="#fde047" strokeWidth="3"
                    vectorEffect="non-scaling-stroke" />
                ))}
              </svg>
            )}
          </div>
          <p className="mt-1 text-slate-500">
            {cajas.length > 0
              ? "Los rectángulos son referencias aproximadas; no son las máscaras de segmentación completas."
              : "Los rectángulos no se muestran si la orientación o dimensiones de la imagen no coinciden con las de la inferencia."}
          </p>
        </div>
      )}
      <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
        <strong>Apoyo a la revisión municipal:</strong> esta IA no asigna gravedad, profundidad
        ni puntos extra por el tamaño aparente. La prioridad sigue las reglas del motor municipal.
      </p>
    </div>
  );
}
