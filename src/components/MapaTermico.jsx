import React, { useEffect } from "react";
import { MapContainer, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";

const SANTIAGO_CENTER = [-33.4489, -70.6693];
const DEFAULT_ZOOM = 12;

const PESO_SEVERIDAD = {
  Alta: 1.0,
  Media: 0.6,
  Baja: 0.3,
};

function HeatmapLayer({ puntos }) {
  const map = useMap();

  useEffect(() => {
    if (!map || puntos.length === 0) return undefined;

    const capaCalor = L.heatLayer(puntos, {
      radius: 28,
      blur: 20,
      maxZoom: 16,
      minOpacity: 0.35,
      gradient: {
        0.2: "#1A2C4D",
        0.4: "#3B82F6",
        0.6: "#F59E0B",
        1.0: "#CC1E1E",
      },
    }).addTo(map);

    return () => {
      map.removeLayer(capaCalor);
    };
  }, [map, puntos]);

  return null;
}

// Ahora el componente recibe los reportes desde la barra lateral
export default function MapaTermico({ reportes = [] }) {
  const puntos = reportes
    .filter(
      (r) => typeof r.latitud === "number" && typeof r.longitud === "number"
    )
    .map((r) => [r.latitud, r.longitud, PESO_SEVERIDAD[r.severidad] ?? 0.5]);

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
        <HeatmapLayer puntos={puntos} />
      </MapContainer>
    </div>
  );
}