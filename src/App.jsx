import React, { useState } from "react";
import MapaReportes from "./components/MapaReportes";
import MapaTermico from "./components/MapaTermico";
import ListaReportes from "./components/ListaReportes";
import mockData from "./data/mockData.json";
import { MUNICIPIOS_DATA } from "./data/municipiosConfig";
import { LayoutDashboard, FileText, Flame, Settings, Building2, X, CheckCircle, AlertTriangle, Cpu, MapPin, Activity } from "lucide-react";
import ReporteBacheScreen from "./pages/ReporteBacheScreen";

export default function App() {
  // 1. PRIMERO LOS HOOKS (Regla de React)
  const [comunaKey, setComunaKey] = useState("la_pintana");
  const [seccionActiva, setSeccionActiva] = useState("Inicio");
  const [reporteSeleccionado, setReporteSeleccionado] = useState(null);

  // 2. EL MURO QUE SEPARA AL CIUDADANO DE LA MUNICIPALIDAD
  if (window.location.pathname.includes("/reporte")) {
    return <ReporteBacheScreen />;
  }

  // 3. TODO EL CÓDIGO DE LA MUNICIPALIDAD SE MANTIENE INTACTO ABAJO
  const tenantActual = MUNICIPIOS_DATA[comunaKey];

  // FILTRADO ESTRICTO POR COMUNA REAL (Basado en el campo "comuna" del JSON)
  const reportesFiltrados = mockData.reportes.filter(
    (rep) => rep.comuna.toLowerCase() === tenantActual.logoTexto.toLowerCase()
  );

  const handleVerDetalle = (reporte) => {
    setReporteSeleccionado(reporte);
  };

  return (
    <div className="flex h-screen bg-slate-100 font-sans overflow-hidden">
      
      {/* BARRA LATERAL INSTITUCIONAL */}
      <aside className="w-64 bg-[#0f172a] text-white flex flex-col justify-between border-r border-slate-800">
        <div>
          {/* Logo y Nombre Dinámico */}
          <div className="p-5 border-b border-slate-800 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white p-1 flex items-center justify-center shrink-0 shadow-sm overflow-hidden">
              <img src={tenantActual.logoImg} alt="Logo Municipio" className="w-full h-full object-contain" />
            </div>
            <div className="overflow-hidden">
              <span className="text-[10px] uppercase font-mono tracking-widest text-blue-400 block">bache0 GovTech</span>
              <h2 className="text-sm font-bold truncate text-white">{tenantActual.logoTexto}</h2>
            </div>
          </div>

          {/* Menú de Navegación */}
          <nav className="mt-6 flex flex-col gap-1 px-3">
            <button 
              onClick={() => setSeccionActiva("Inicio")}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${seccionActiva === "Inicio" ? "bg-blue-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800"}`}
            >
              <LayoutDashboard size={18} /> Inicio
            </button>
            <button 
              onClick={() => setSeccionActiva("Mapa Térmico")}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${seccionActiva === "Mapa Térmico" ? "bg-blue-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800"}`}
            >
              <Flame size={18} /> Mapa Térmico
            </button>
            <button 
              onClick={() => setSeccionActiva("Reportes")}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${seccionActiva === "Reportes" ? "bg-blue-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800"}`}
            >
              <FileText size={18} /> Reportes
            </button>
            <button 
              onClick={() => setSeccionActiva("Configuración")}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${seccionActiva === "Configuración" ? "bg-blue-600 text-white shadow-sm" : "text-slate-300 hover:bg-slate-800"}`}
            >
              <Settings size={18} /> Configuración
            </button>
          </nav>
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-900/50">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-400 font-mono">SaaS GovTech v2.1</span>
            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span> En Línea
            </span>
          </div>
        </div>
      </aside>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 flex flex-col overflow-hidden bg-slate-50">
        
        {/* Header Superior con Selector de Comuna SaaS */}
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-8 shadow-xs">
          <div className="flex items-center gap-3">
            <Building2 className="text-blue-900" size={20} />
            <span className="text-sm font-semibold text-slate-700">Plataforma Centralizada de Gestión Comunal</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Municipio Activo (Tenant):</span>
            <select 
              value={comunaKey}
              onChange={(e) => setComunaKey(e.target.value)}
              className="bg-slate-50 border border-slate-300 text-slate-800 text-sm font-medium rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-900 focus:outline-none cursor-pointer"
            >
              <option value="la_pintana">Municipalidad de La Pintana</option>
              <option value="estacion_central">Municipalidad de Estación Central</option>
              <option value="el_bosque">Municipalidad de El Bosque</option>
            </select>
          </div>
        </header>

        {/* Zona Scrollable */}
        <div className="flex-1 overflow-auto p-8">
          
          {seccionActiva === "Inicio" && (
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Dashboard de Monitoreo - {tenantActual.logoTexto}</h1>
                <p className="text-sm text-slate-500">Mostrando exclusivamente reportes ciudadanos y análisis de IA dentro de los límites comunales.</p>
              </div>

              {reportesFiltrados.length === 0 ? (
                <div className="bg-white p-12 rounded-xl text-center border border-slate-200 shadow-xs">
                  <AlertTriangle className="mx-auto text-amber-500 mb-3" size={36} />
                  <h3 className="text-lg font-bold text-slate-800">No hay incidentes reportados en {tenantActual.logoTexto}</h3>
                  <p className="text-sm text-slate-500 mt-1">La comuna se encuentra limpia o sin registros activos en este momento en el sistema.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="col-span-2 bg-white p-5 rounded-xl shadow-xs border border-slate-200">
                    <h3 className="font-semibold text-slate-700 mb-3">Georreferenciación de Baches</h3>
                    <div className="h-[380px] w-full rounded-lg overflow-hidden border border-slate-100">
                      <MapaReportes reportes={reportesFiltrados} />
                    </div>
                  </div>

                  <div className="col-span-1 bg-white p-5 rounded-xl shadow-xs border border-slate-200">
                    <h3 className="font-semibold text-slate-700 mb-3">Alertas Críticas Comunales</h3>
                    <div className="h-[380px] overflow-y-auto pr-1">
                      <ListaReportes reportes={reportesFiltrados} onVerDetalle={handleVerDetalle} />
                    </div>
                  </div>
                </div>
              )}

              {reportesFiltrados.length > 0 && (
                <div className="bg-white p-5 rounded-xl shadow-xs border border-slate-200">
                  <h3 className="font-semibold text-slate-700 mb-4">Historial de Reportes Oficiales</h3>
                  <ListaReportes reportes={reportesFiltrados} onVerDetalle={handleVerDetalle} />
                </div>
              )}
            </div>
          )}

          {seccionActiva === "Reportes" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Gestión de Incidentes - {tenantActual.logoTexto}</h3>
                <p className="text-sm text-slate-500">Listado general de reportes validados por la app móvil ciudadana.</p>
              </div>
              <div className="bg-white p-5 rounded-xl shadow-xs border border-slate-200">
                <ListaReportes reportes={reportesFiltrados} onVerDetalle={handleVerDetalle} />
              </div>
            </div>
          )}

          {seccionActiva === "Mapa Térmico" && (
            <div className="space-y-6">
              <div>
                <h3 className="text-xl font-bold text-slate-900">Mapa de Calor y Severidad</h3>
                <p className="text-sm text-slate-500">Concentración de daños viales para priorización de cuadrillas municipales.</p>
              </div>
              <div className="bg-white p-5 rounded-xl shadow-xs border border-slate-200 h-[600px] overflow-hidden">
                <MapaTermico reportes={reportesFiltrados} />
              </div>
            </div>
          )}

          {seccionActiva === "Configuración" && (
            <div className="space-y-6 max-w-2xl bg-white p-6 rounded-xl shadow-xs border border-slate-200">
              <h3 className="text-xl font-bold text-slate-900">Parámetros del Tenant Municipal</h3>
              <p className="text-sm text-slate-500">Configuración activa de la plataforma SaaS B2G.</p>
              
              <div className="space-y-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase">Institución</label>
                  <input type="text" readOnly value={tenantActual.nombre} className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 font-medium" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase">Dominio Institucional</label>
                  <input type="text" readOnly value={tenantActual.subdominio} className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 font-medium" />
                </div>
              </div>
            </div>
          )}

        </div>
      </main>

      {/* MODAL "VER DETALLES" COMPLETO: FOTO, FORMULARIO Y VISIÓN ARTIFICIAL (IA) */}
      {reporteSeleccionado && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white max-w-3xl w-full rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200">
            
            {/* Cabecera */}
            <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="bg-blue-600 p-2 rounded-lg text-white">
                  <Activity size={20} />
                </div>
                <div>
                  <span className="text-xs text-blue-400 font-mono font-bold">EXPEDIENTE TÉCNICO: {reporteSeleccionado.id}</span>
                  <h3 className="text-lg font-bold">{reporteSeleccionado.direccion}</h3>
                </div>
              </div>
              <button onClick={() => setReporteSeleccionado(null)} className="text-slate-400 hover:text-white bg-slate-800 p-2 rounded-full transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Contenido del Modal */}
            <div className="p-6 space-y-6 max-h-[81vh] overflow-y-auto">
              
              {/* Grid Principal: Foto vs IA */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Columna 1: Evidencia Fotográfica */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                    <MapPin size={14} className="text-blue-600" /> Evidencia Fotográfica del Ciudadano
                  </h4>
                  <div className="h-56 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 relative shadow-inner">
                    <img src={reporteSeleccionado.imagenUrl} alt="Daño en pavimento" className="w-full h-full object-cover" />
                    <div className="absolute bottom-2 left-2 bg-black/75 text-white text-[10px] px-2.5 py-1 rounded-md font-mono backdrop-blur-xs">
                      GPS: {reporteSeleccionado.latitud}, {reporteSeleccionado.longitud}
                    </div>
                  </div>
                </div>

                {/* Columna 2: Análisis de Visión Artificial (IA) */}
                <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 flex flex-col justify-between">
                  <div>
                    <h4 className="text-xs font-semibold uppercase tracking-wider text-blue-900 mb-3 flex items-center gap-1.5">
                      <Cpu size={15} className="text-blue-700" /> Triage y Visión Artificial (IA)
                    </h4>
                    
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between border-b border-blue-100 pb-2">
                        <span className="text-slate-600">Puntaje de Prioridad:</span>
                        <span className="font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded text-xs border border-red-200">
                          {reporteSeleccionado.iaAnalisis?.puntajePrioridad ?? "85"} / 100 (Crítico)
                        </span>
                      </div>
                      <div className="flex justify-between border-b border-blue-100 pb-2">
                        <span className="text-slate-600">Diámetro Estimado:</span>
                        <span className="font-semibold text-slate-800">{reporteSeleccionado.iaAnalisis?.diametroEstimado ?? "50 cm"}</span>
                      </div>
                      <div className="flex justify-between border-b border-blue-100 pb-2">
                        <span className="text-slate-600">Profundidad Promedio:</span>
                        <span className="font-semibold text-slate-800">{reporteSeleccionado.iaAnalisis?.profundidadEstimada ?? "10 cm"}</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 bg-white p-3 rounded-lg border border-blue-200 text-xs text-slate-700">
                    <strong className="text-blue-900 block mb-0.5">Diagnóstico Algorítmico:</strong>
                    {reporteSeleccionado.iaAnalisis?.recomendacion ?? "Intervención requerida según parámetros de seguridad vial."}
                  </div>
                </div>

              </div>

              {/* Formulario de Contexto Objetivo (Respondido en la App Móvil) */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                  Parámetros de Entorno y Validación Técnica
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  
                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-start gap-3">
                    <CheckCircle size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs text-slate-400 block font-medium">¿Es muy concurrida la calle?</span>
                      <span className="text-slate-800 font-semibold">{reporteSeleccionado.formulario?.flujoVehicular ?? "Alto (Tránsito Habitual)"}</span>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-start gap-3">
                    <CheckCircle size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs text-slate-400 block font-medium">Proximidad a Infraestructura Crítica (ej: colegio, mall)</span>
                      <span className="text-slate-800 font-semibold">{reporteSeleccionado.formulario?.cercaniaColegioHospital ?? "Cercano a centro de salud municipal"}</span>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-start gap-3">
                    <CheckCircle size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs text-slate-400 block font-medium">Clasificación Vial (Automática por GPS)</span>
                      <span className="text-slate-800 font-semibold">{reporteSeleccionado.formulario?.tipoVia ?? "Avenida Principal (Cruce GIS)"}</span>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-start gap-3">
                    <CheckCircle size={18} className="text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs text-slate-400 block font-medium">Observación / Descripción</span>
                      <span className="text-slate-800 font-semibold italic">"{reporteSeleccionado.descripcion}"</span>
                    </div>
                  </div>

                </div>
              </div>

            </div>

            {/* Pie del Modal */}
            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex justify-between items-center">
              <span className="text-xs text-slate-500 font-mono">Estado Actual: <strong className="text-slate-800">{reporteSeleccionado.estado}</strong></span>
              <button 
                onClick={() => setReporteSeleccionado(null)}
                className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors shadow-sm"
              >
                Cerrar Expediente
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}