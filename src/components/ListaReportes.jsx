
import React from "react";
import { Eye, MapPin, Inbox } from "lucide-react";

// ==========================================
// ESTILOS DE SEVERIDAD
// ==========================================

const SEVERIDAD_STYLES = {
  Alta: {
    dot: "bg-[#CC1E1E]",
    text: "text-[#CC1E1E]",
    bg: "bg-red-50",
    border: "border-red-200",
  },
  Media: {
    dot: "bg-amber-500",
    text: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
  },
  Baja: {
    dot: "bg-emerald-500",
    text: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
  },
};

const ESTILO_NEUTRO = {
  dot: "bg-slate-400",
  text: "text-slate-600",
  bg: "bg-slate-50",
  border: "border-slate-200",
};

// ==========================================
// ESTILOS DE PRIORIDAD
// ==========================================

const PRIORIDAD_STYLES = {
  Alta: {
    dot: "bg-red-600",
    text: "text-red-800",
    bg: "bg-red-100",
    border: "border-red-300",
  },
  Media: {
    dot: "bg-amber-500",
    text: "text-amber-800",
    bg: "bg-amber-100",
    border: "border-amber-300",
  },
  Baja: {
    dot: "bg-emerald-600",
    text: "text-emerald-800",
    bg: "bg-emerald-100",
    border: "border-emerald-300",
  },
};

// ==========================================
// ESTILOS DE ESTADO
// ==========================================

const ESTADO_STYLES = {
  Pendiente: {
    text: "text-slate-600",
    bg: "bg-slate-100",
    border: "border-slate-200",
  },
  "En revisión": {
    text: "text-blue-700",
    bg: "bg-blue-50",
    border: "border-blue-200",
  },
  Reparado: {
    text: "text-teal-700",
    bg: "bg-teal-50",
    border: "border-teal-200",
  },
};

// ==========================================
// BADGE DE SEVERIDAD
// ==========================================

function SeverityBadge({ nivel }) {
  const texto = nivel || "No informada";
  const s = SEVERIDAD_STYLES[texto] ?? ESTILO_NEUTRO;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${s.bg} ${s.border} ${s.text} px-2.5 py-1 text-xs font-semibold`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {texto}
    </span>
  );
}

// ==========================================
// BADGE DE PRIORIDAD
// ==========================================

function PrioridadBadge({ prioridad, provisional = false }) {
  const texto = prioridad || "No informada";

  const s = PRIORIDAD_STYLES[texto] ?? ESTILO_NEUTRO;

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span
        className={`inline-flex items-center gap-1.5 rounded-full border ${s.bg} ${s.border} ${s.text} px-2.5 py-1 text-xs font-semibold`}
      >
        <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
        {texto}
      </span>

      {provisional && (
        <span
          className="rounded-md border border-blue-200 bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700"
          title="La prioridad puede cambiar después del análisis de visión artificial."
        >
          Provisional
        </span>
      )}
    </div>
  );
}

// ==========================================
// BADGE DE ESTADO
// ==========================================

function EstadoBadge({ estado }) {
  const texto = estado || "No informado";
  const s = ESTADO_STYLES[texto] ?? ESTILO_NEUTRO;

  return (
    <span
      className={`inline-flex items-center rounded-full border ${s.bg} ${s.border} ${s.text} px-2.5 py-1 text-xs font-medium`}
    >
      {texto}
    </span>
  );
}

// ==========================================
// FORMATO DE FECHA
// ==========================================

function formatFecha(fechaISO) {
  if (!fechaISO) {
    return "Fecha no disponible";
  }

  const fecha = new Date(fechaISO);

  if (Number.isNaN(fecha.getTime())) {
    return "Fecha no disponible";
  }

  return fecha.toLocaleDateString("es-CL", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * ListaReportes
 *
 * Tabla de escritorio y tarjetas para móviles.
 *
 * Recibe reportes adaptados mediante adaptApiReport().
 *
 * Muestra:
 * - Folio
 * - Ubicación
 * - Severidad
 * - Prioridad
 * - Prioridad provisional
 * - Estado
 * - Fecha
 * - Acción para ver el detalle
 */
export default function ListaReportes({
  reportes = [],
  onVerDetalle = () => {},
}) {
  // ==========================================
  // SIN REPORTES
  // ==========================================

  if (reportes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-300 bg-white py-16 text-center">
        <Inbox
          className="text-slate-400"
          size={32}
          strokeWidth={1.5}
        />

        <p className="text-sm text-slate-500">
          No hay reportes para mostrar.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* ======================================
          TABLA DE ESCRITORIO
      ====================================== */}

      <div className="hidden md:block overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[850px] text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/60 text-xs uppercase tracking-wide text-slate-500">
              <th className="px-4 py-3 font-medium">
                Folio
              </th>

              <th className="px-4 py-3 font-medium">
                Ubicación
              </th>

              <th className="px-4 py-3 font-medium">
                Severidad
              </th>

              <th className="px-4 py-3 font-medium">
                Prioridad
              </th>

              <th className="px-4 py-3 font-medium">
                Estado
              </th>

              <th className="px-4 py-3 font-medium">
                Fecha
              </th>

              <th className="px-4 py-3 font-medium text-right">
                Acciones
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-slate-100">
            {reportes.map((reporte) => (
              <tr
                key={reporte.apiId ?? reporte.id}
                className="cursor-pointer transition-colors hover:bg-slate-50"
                onClick={() => onVerDetalle(reporte)}
              >
                {/* FOLIO */}

                <td className="px-4 py-4 font-mono text-xs text-slate-500">
                  {reporte.id}
                </td>

                {/* UBICACIÓN */}

                <td className="px-4 py-4">
                  <p className="font-medium text-[#1A2C4D]">
                    {reporte.direccion}
                  </p>

                  <p className="flex items-center gap-1 text-xs text-slate-500">
                    <MapPin size={12} />
                    {reporte.comuna}
                  </p>
                </td>

                {/* SEVERIDAD */}

                <td className="px-4 py-4">
                  <SeverityBadge nivel={reporte.severidad} />
                </td>

                {/* PRIORIDAD EXPLICABLE */}

                <td className="px-4 py-4">
                  <PrioridadBadge
                    prioridad={reporte.prioridad}
                    provisional={reporte.prioridadProvisional}
                  />
                </td>

                {/* ESTADO */}

                <td className="px-4 py-4">
                  <EstadoBadge estado={reporte.estado} />
                </td>

                {/* FECHA */}

                <td className="px-4 py-4 font-mono text-xs text-slate-500">
                  {formatFecha(reporte.fechaReporte)}
                </td>

                {/* ACCIONES */}

                <td className="px-4 py-4 text-right">
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

      {/* ======================================
          TARJETAS PARA CELULARES
      ====================================== */}

      <div className="grid grid-cols-1 gap-3 md:hidden">
        {reportes.map((reporte) => (
          <div
            key={reporte.apiId ?? reporte.id}
            onClick={() => onVerDetalle(reporte)}
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors active:bg-slate-50"
          >
            {/* FOLIO Y UBICACIÓN */}

            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-mono text-[11px] text-slate-400">
                  {reporte.id}
                </p>

                <p className="truncate font-medium text-[#1A2C4D]">
                  {reporte.direccion}
                </p>

                <p className="flex items-center gap-1 text-xs text-slate-500">
                  <MapPin size={12} />
                  {reporte.comuna}
                </p>
              </div>

              <SeverityBadge nivel={reporte.severidad} />
            </div>

            {/* PRIORIDAD */}

            <div className="mt-3">
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                Prioridad calculada
              </p>

              <PrioridadBadge
                prioridad={reporte.prioridad}
                provisional={reporte.prioridadProvisional}
              />
            </div>

            {/* ESTADO, FECHA Y BOTÓN */}

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
              <div className="flex flex-wrap items-center gap-2">
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
