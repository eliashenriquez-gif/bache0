import React from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const SANTIAGO_CENTER = [-33.4489, -70.6693];
const DEFAULT_ZOOM = 12;

const SEVERIDAD_COLOR = {
  Alta: "#CC1E1E",
  Media: "#F59E0B",
  Baja: "#10B981",
};

/**
 * Genera un ícono circular coloreado según el nivel de severidad,
 * consistente con los badges usados en ListaReportes. Al usar un
 * divIcon en vez del ícono por defecto de Leaflet, evitamos el
 * problema clásico de assets rotos al empaquetar con Vite/Webpack.
 */
function crearIconoSeveridad(nivel) {
  const color = SEVERIDAD_COLOR[nivel] ?? SEVERIDAD_COLOR.Media;
  return L.divIcon({
    className: "pothole-marker",
    html: `<span style="
      display:block;
      width:16px;
      height:16px;
      border-radius:9999px;
      background:${color};
      border:2px solid #ffffff;
      box-shadow:0 1px 4px rgba(0,0,0,0.4);
    "></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -10],
  });
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
 * MapaReportes
 * Mapa interactivo (React-Leaflet) que georreferencia los reportes de baches
 * capturados en terreno, con marcadores coloreados por severidad.
 *
 * Props:
 * - reportes: array de objetos con
 *   { id, direccion, latitud, longitud, severidad, fechaReporte }
 */
export default function MapaReportes({ reportes = [] }) {
  return (
    <div className="h-[600px] w-full overflow-hidden rounded-lg border border-slate-200 shadow-sm">
      <MapContainer
        center={SANTIAGO_CENTER}
        zoom={DEFAULT_ZOOM}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {reportes.map((reporte) => (
          <Marker
            key={reporte.id}
            position={[reporte.latitud, reporte.longitud]}
            icon={crearIconoSeveridad(reporte.severidad)}
          >
            <Popup>
              <div className="min-w-[180px] text-sm">
                <p className="font-semibold text-[#1A2C4D]">
                  {reporte.direccion}
                </p>
                <p className="mt-1 flex items-center gap-1.5">
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{
                      backgroundColor:
                        SEVERIDAD_COLOR[reporte.severidad] ??
                        SEVERIDAD_COLOR.Media,
                    }}
                  />
                  <span
                    className="font-medium"
                    style={{
                      color:
                        SEVERIDAD_COLOR[reporte.severidad] ??
                        SEVERIDAD_COLOR.Media,
                    }}
                  >
                    Severidad {reporte.severidad}
                  </span>
                </p>
                <p className="mt-1 font-mono text-xs text-slate-500">
                  {formatFecha(reporte.fechaReporte)}
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
