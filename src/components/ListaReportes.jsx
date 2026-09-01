import React from "react";
import { Eye, MapPin, Inbox } from "lucide-react";

const SEVERIDAD_STYLES = {
  Alta: { dot: "bg-[#CC1E1E]", text: "text-[#CC1E1E]", bg: "bg-red-50", border: "border-red-200" },
  Media: { dot: "bg-amber-500", text: "text-amber-700", bg: "bg-amber-50", border: "border-amber-200" },
  Baja: { dot: "bg-emerald-500", text: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-200" },
};

const ESTADO_STYLES = {
  Pendiente: { text: "text-slate-600", bg: "bg-slate-100", border: "border-slate-200" },
  "En revisión": { text: "text-blue-700", bg: "bg-blue-50", border: "border-blue-200" },
  Reparado: { text: "text-teal-700", bg: "bg-teal-50", border: "border-teal-200" },
};

function SeverityBadge({ nivel }) {
  const s = SEVERIDAD_STYLES[nivel] ?? SEVERIDAD_STYLES.Media;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${s.bg} ${s.border} ${s.text} px-2.5 py-1 text-xs font-semibold`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {nivel}
    </span>
  );
}

function EstadoBadge({ estado }) {
  const s = ESTADO_STYLES[estado] ?? ESTADO_STYLES.Pendiente;
  return (
    <span
      className={`inline-flex items-center rounded-full border ${s.bg} ${s.border} ${s.text} px-2.5 py-1 text-xs font-medium`}
    >
      {estado}
    </span>
  );
}

function formatFecha(fechaISO) {
  try {
    return new Date(fechaISO).toLocaleDateString("es-CL", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return fechaISO;
  }
}

/**
 * ListaReportes
 * Tabla (desktop) / lista de tarjetas (mobile) de reportes de baches.
 *
 * Props:
 * - reportes: array de objetos con { id, direccion, comuna, fechaReporte, severidad, estado }
 * - onVerDetalle: callback(reporte) al presionar "Ver detalles"
 */
export default function ListaReportes({ reportes = [], onVerDetalle = () => {} }) {
  if (reportes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-300 bg-white py-16 text-center">
        <Inbox className="text-slate-400" size={32} strokeWidth={1.5} />
        <p className="text-sm text-slate-500">
          No hay reportes registrados en esta jurisdicción todavía.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Tabla — visible desde md hacia arriba */}
      <div className="hidden md:block overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/60 text-xs uppercase tracking-wide text-slate-500">
              <th className="px-5 py-3 font-medium">Folio</th>
              <th className="px-5 py-3 font-medium">Ubicación</th>
              <th className="px-5 py-3 font-medium">Severidad</th>
              <th className="px-5 py-3 font-medium">Estado</th>
              <th className="px-5 py-3 font-medium">Fecha</th>
              <th className="px-5 py-3 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {reportes.map((reporte) => (
              <tr
                key={reporte.id}
                className="transition-colors hover:bg-slate-50 cursor-pointer"
                onClick={() => onVerDetalle(reporte)}
              >
                <td className="px-5 py-4 font-mono text-xs text-slate-500">
                  {reporte.id}
                </td>
                <td className="px-5 py-4">
                  <p className="font-medium text-[#1A2C4D]">{reporte.direccion}</p>
                  <p className="flex items-center gap-1 text-xs text-slate-500">
                    <MapPin size={12} /> {reporte.comuna}
                  </p>
                </td>
                <td className="px-5 py-4">
                  <SeverityBadge nivel={reporte.severidad} />
                </td>
                <td className="px-5 py-4">
                  <EstadoBadge estado={reporte.estado} />
                </td>
                <td className="px-5 py-4 font-mono text-xs text-slate-500">
                  {formatFecha(reporte.fechaReporte)}
                </td>
                <td className="px-5 py-4 text-right">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onVerDetalle(reporte);
                    }}
                    className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-[#1A2C4D] transition-colors hover:border-[#1A2C4D] hover:bg-[#1A2C4D] hover:text-white"
                  >
                    <Eye size={14} />
                    Ver detalles
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Tarjetas — visibles solo en mobile */}
      <div className="grid grid-cols-1 gap-3 md:hidden">
        {reportes.map((reporte) => (
          <div
            key={reporte.id}
            onClick={() => onVerDetalle(reporte)}
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors active:bg-slate-50"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-mono text-[11px] text-slate-400">{reporte.id}</p>
                <p className="truncate font-medium text-[#1A2C4D]">
                  {reporte.direccion}
                </p>
                <p className="flex items-center gap-1 text-xs text-slate-500">
                  <MapPin size={12} /> {reporte.comuna}
                </p>
              </div>
              <SeverityBadge nivel={reporte.severidad} />
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
              <div className="flex items-center gap-2">
                <EstadoBadge estado={reporte.estado} />
                <span className="font-mono text-[11px] text-slate-400">
                  {formatFecha(reporte.fechaReporte)}
                </span>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onVerDetalle(reporte);
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-[#1A2C4D] hover:border-[#1A2C4D] hover:bg-[#1A2C4D] hover:text-white"
              >
                <Eye size={14} />
                Ver
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
