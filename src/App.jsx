import React, { useState } from "react";
import DashboardLayout from "./components/DashboardLayout";
import MapaReportes from "./components/MapaReportes";
import ListaReportes from "./components/ListaReportes";
import mockData from "./data/mockData.json";

export default function App() {
  const [seccionActiva, setSeccionActiva] = useState("Reportes");

  const handleVerDetalle = (reporte) => {
    alert(`Viendo detalles del reporte: ${reporte.id} - ${reporte.direccion}`);
  };

  return (
    <DashboardLayout activeItem={seccionActiva} onNavigate={setSeccionActiva}>
      {seccionActiva === "Reportes" && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-bold text-[#1A2C4D]">Gestión de Incidentes Viales</h3>
            <p className="text-sm text-slate-500">
              Listado general de baches reportados en la jurisdicción municipal.
            </p>
          </div>
          <ListaReportes reportes={mockData.reportes} onVerDetalle={handleVerDetalle} />
        </div>
      )}

      {seccionActiva === "Mapa Térmico" && (
        <div className="space-y-6">
          <div>
            <h3 className="text-lg font-bold text-[#1A2C4D]">Georreferenciación de Daños</h3>
            <p className="text-sm text-slate-500">
              Visualización cartográfica de reportes con codificación por severidad.
            </p>
          </div>
          <MapaReportes reportes={mockData.reportes} />
        </div>
      )}

      {seccionActiva === "Inicio" && (
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <h3 className="text-lg font-bold text-[#1A2C4D]">Panel de Control Municipal</h3>
          <p className="mt-2 text-sm text-slate-600">
            Bienvenido al sistema PotholeVision. Utiliza el menú lateral para revisar los reportes activos o acceder al mapa de calor vial.
          </p>
        </div>
      )}
    </DashboardLayout>
  );
}