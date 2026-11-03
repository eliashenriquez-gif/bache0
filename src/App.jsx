import React, { useEffect, useState } from "react";

import MapaReportes from "./components/MapaReportes";
import MapaTermico from "./components/MapaTermico";
import ListaReportes from "./components/ListaReportes";
import LoginMunicipal from "./components/LoginMunicipal";
import ReporteBacheScreen from "./pages/ReporteBacheScreen";

import {
  LayoutDashboard,
  FileText,
  Flame,
  Settings,
  Building2,
  X,
  CheckCircle,
  AlertTriangle,
  Cpu,
  MapPin,
  Activity,
  LogOut,
  Loader2,
  RefreshCw,
  UserRound,
  ShieldCheck,
} from "lucide-react";

import {
  getCurrentUser,
  loginMunicipal,
  saveAccessToken,
  readAccessToken,
  clearAccessToken,
} from "./services/authService";

import {
  listReports,
} from "./services/reportService";

import {
  mapApiReports,
} from "./services/reportAdapter";

import logoBache0 from "./assets/logo_bache0_azul_hd.png";


function formatDate(dateValue) {
  if (!dateValue) return "Fecha no disponible";

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return "Fecha no disponible";
  }

  return date.toLocaleString("es-CL", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}


function displayValue(value, fallback = "No informado") {
  if (value === null || value === undefined || value === "") {
    return fallback;
  }

  return value;
}


export default function App() {
  const isCitizenRoute =
    typeof window !== "undefined" &&
    window.location.pathname.includes("/reporte");

  // --------------------------------------------------
  // 1. ESTADOS DE AUTENTICACIÓN
  // --------------------------------------------------

  const [authStatus, setAuthStatus] = useState("checking");
  const [token, setToken] = useState(null);
  const [usuario, setUsuario] = useState(null);

  // --------------------------------------------------
  // 2. ESTADOS DEL PANEL MUNICIPAL
  // --------------------------------------------------

  const [seccionActiva, setSeccionActiva] = useState("Inicio");
  const [reporteSeleccionado, setReporteSeleccionado] = useState(null);

  const [reportes, setReportes] = useState([]);
  const [cargandoReportes, setCargandoReportes] = useState(false);
  const [errorReportes, setErrorReportes] = useState("");

  const [reloadReportsKey, setReloadReportsKey] = useState(0);


  // --------------------------------------------------
  // 3. RESTAURAR SESIÓN AL ABRIR O RECARGAR LA PÁGINA
  // --------------------------------------------------

  useEffect(() => {
    if (isCitizenRoute) return undefined;

    let cancelled = false;

    async function restoreSession() {
      const savedToken = readAccessToken();

      if (!savedToken) {
        setAuthStatus("anonymous");
        return;
      }

      try {
        const profile = await getCurrentUser(savedToken);

        if (cancelled) return;

        const currentUser =
          profile?.user ||
          profile?.usuario ||
          profile;

        if (!currentUser || !currentUser.rol) {
          throw new Error("El servidor no devolvió un perfil válido.");
        }

        setToken(savedToken);
        setUsuario(currentUser);
        setAuthStatus("authenticated");

      } catch (error) {
        if (cancelled) return;

        clearAccessToken();
        setToken(null);
        setUsuario(null);
        setAuthStatus("anonymous");
      }
    }

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, [isCitizenRoute]);


  // --------------------------------------------------
  // 4. INICIAR SESIÓN
  // --------------------------------------------------

  async function handleLogin(email, password) {
    const session = await loginMunicipal(email, password);

    if (!session?.access_token) {
      throw new Error(
        "El servidor no devolvió un token de autenticación válido."
      );
    }

    saveAccessToken(session.access_token);

    try {
      const profile = await getCurrentUser(session.access_token);

      const currentUser =
        profile?.user ||
        profile?.usuario ||
        profile;

      if (!currentUser || !currentUser.rol) {
        throw new Error("No se pudo recuperar el perfil del funcionario.");
      }

      setToken(session.access_token);
      setUsuario(currentUser);
      setSeccionActiva("Inicio");
      setAuthStatus("authenticated");

    } catch (error) {
      clearAccessToken();

      setToken(null);
      setUsuario(null);
      setAuthStatus("anonymous");

      throw error;
    }
  }


  // --------------------------------------------------
  // 5. CERRAR SESIÓN
  // --------------------------------------------------

  function handleLogout() {
    clearAccessToken();

    setToken(null);
    setUsuario(null);
    setReportes([]);
    setReporteSeleccionado(null);
    setErrorReportes("");
    setSeccionActiva("Inicio");
    setAuthStatus("anonymous");
  }


  // --------------------------------------------------
  // 6. CARGAR REPORTES DESDE LA API
  // --------------------------------------------------

  useEffect(() => {
    if (
      authStatus !== "authenticated" ||
      !token ||
      isCitizenRoute
    ) {
      return undefined;
    }

    let cancelled = false;

    async function loadReports() {
      setCargandoReportes(true);
      setErrorReportes("");

      try {
        const response = await listReports({
          token,
          page: 1,
          limit: 100,
        });

        if (cancelled) return;

        const adaptedReports = mapApiReports(response);

        setReportes(adaptedReports);

      } catch (error) {
        if (cancelled) return;

        if (error.status === 401) {
          clearAccessToken();
          setToken(null);
          setUsuario(null);
          setAuthStatus("anonymous");
          return;
        }

        setReportes([]);

        setErrorReportes(
          error.message || "No se pudieron cargar los reportes."
        );

      } finally {
        if (!cancelled) {
          setCargandoReportes(false);
        }
      }
    }

    loadReports();

    return () => {
      cancelled = true;
    };
  }, [authStatus, token, reloadReportsKey, isCitizenRoute]);


  // --------------------------------------------------
  // 7. MANTENER SEPARADO EL MÓDULO CIUDADANO
  // --------------------------------------------------

  if (isCitizenRoute) {
    return <ReporteBacheScreen />;
  }


  // --------------------------------------------------
  // 8. PANTALLA DE VERIFICACIÓN DE SESIÓN
  // --------------------------------------------------

  if (authStatus === "checking") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="animate-spin" size={22} />

          <span className="text-sm font-medium">
            Verificando sesión...
          </span>
        </div>
      </div>
    );
  }


  // --------------------------------------------------
  // 9. PANTALLA DE LOGIN
  // --------------------------------------------------

  if (authStatus !== "authenticated" || !usuario) {
    return <LoginMunicipal onLogin={handleLogin} />;
  }


  // --------------------------------------------------
  // 10. INFORMACIÓN DEL FUNCIONARIO AUTENTICADO
  // --------------------------------------------------

  const esSuperadministrador =
    usuario.rol === "superadministrador";

  const tenantLabel = esSuperadministrador
    ? "Administración global"
    : usuario.municipalidad_id != null
      ? `Municipalidad ID ${usuario.municipalidad_id}`
      : "Municipalidad no asignada";

  const nombreUsuario =
    usuario.nombre ||
    usuario.email ||
    "Usuario municipal";

  // El ámbito de los reportes lo determina el backend
  // según el JWT. No se filtra por una comuna seleccionada
  // manualmente en el frontend.

  const reportesFiltrados = reportes;

  const reportesConCoordenadas = reportes.filter(
    (reporte) =>
      Number.isFinite(reporte.latitud) &&
      Number.isFinite(reporte.longitud)
  );


  // --------------------------------------------------
  // 11. SELECCIÓN DE UN REPORTE
  // --------------------------------------------------

  const handleVerDetalle = (reporte) => {
    setReporteSeleccionado(reporte);
  };


  // --------------------------------------------------
  // 12. ACTUALIZAR LISTADO
  // --------------------------------------------------

  const handleRefreshReports = () => {
    setReloadReportsKey((previous) => previous + 1);
  };


  // --------------------------------------------------
  // 13. DASHBOARD MUNICIPAL
  // --------------------------------------------------

  return (
    <div className="flex h-screen bg-slate-100 font-sans overflow-hidden">

      {/* -------------------------------------------- */}
      {/* BARRA LATERAL */}
      {/* -------------------------------------------- */}

      <aside className="w-64 bg-[#0f172a] text-white flex flex-col justify-between border-r border-slate-800 shrink-0">

        <div>

          {/* Identidad institucional */}

          <div className="p-5 border-b border-slate-800 flex items-center gap-3">

            <div className="w-11 h-11 rounded-full bg-white p-1 flex items-center justify-center shrink-0 shadow-sm overflow-hidden">

              <img
                src={logoBache0}
                alt="Logo Bache0"
                className="w-full h-full object-contain"
              />

            </div>

            <div className="overflow-hidden">

              <span className="text-[10px] uppercase font-mono tracking-widest text-blue-400 block">
                Bache0 GovTech
              </span>

              <h2 className="text-sm font-bold truncate text-white">
                {tenantLabel}
              </h2>

            </div>

          </div>


          {/* Menú de navegación */}

          <nav className="mt-6 flex flex-col gap-1 px-3">

            <button
              onClick={() => setSeccionActiva("Inicio")}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                seccionActiva === "Inicio"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              <LayoutDashboard size={18} />
              Inicio
            </button>


            <button
              onClick={() => setSeccionActiva("Mapa Térmico")}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                seccionActiva === "Mapa Térmico"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              <Flame size={18} />
              Mapa Térmico
            </button>


            <button
              onClick={() => setSeccionActiva("Reportes")}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                seccionActiva === "Reportes"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              <FileText size={18} />
              Reportes
            </button>


            <button
              onClick={() => setSeccionActiva("Configuración")}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                seccionActiva === "Configuración"
                  ? "bg-blue-600 text-white shadow-sm"
                  : "text-slate-300 hover:bg-slate-800"
              }`}
            >
              <Settings size={18} />
              Configuración
            </button>

          </nav>

        </div>


        {/* Usuario y estado de sesión */}

        <div className="p-4 border-t border-slate-800 bg-slate-900/50">

          <div className="flex items-center gap-2 mb-3 min-w-0">

            <div className="bg-slate-700 rounded-full p-2 shrink-0">
              <UserRound size={17} className="text-blue-300" />
            </div>

            <div className="min-w-0">

              <p className="text-xs text-white font-semibold truncate">
                {nombreUsuario}
              </p>

              <p className="text-[10px] text-slate-400 truncate">
                {usuario.rol}
              </p>

            </div>

          </div>


          <div className="flex items-center justify-between text-xs mb-3">

            <span className="text-slate-400 font-mono">
              Bache0
            </span>

            <span className="flex items-center gap-1.5 text-emerald-400 font-medium">

              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />

              Sesión activa

            </span>

          </div>


          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-red-500/15 hover:text-red-300 transition-colors"
          >
            <LogOut size={16} />
            Cerrar sesión
          </button>

        </div>

      </aside>


      {/* -------------------------------------------- */}
      {/* CONTENIDO PRINCIPAL */}
      {/* -------------------------------------------- */}

      <main className="flex-1 flex flex-col overflow-hidden bg-slate-50 min-w-0">


        {/* HEADER SUPERIOR */}

        <header className="min-h-16 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 px-5 md:px-8 py-3 shadow-xs">

          <div className="flex items-center gap-3">

            <Building2 className="text-blue-900 shrink-0" size={20} />

            <div>

              <span className="text-sm font-semibold text-slate-700 block">
                Plataforma Centralizada de Gestión Comunal
              </span>

              <span className="text-xs text-slate-400">
                Ámbito: {tenantLabel}
              </span>

            </div>

          </div>


          <div className="flex items-center gap-3">

            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-500">

              <ShieldCheck size={16} className="text-emerald-600" />

              <span>
                {nombreUsuario}
              </span>

            </div>


            <button
              onClick={handleRefreshReports}
              disabled={cargandoReportes}
              title="Actualizar reportes"
              className="flex items-center justify-center gap-2 px-3 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >

              <RefreshCw
                size={16}
                className={cargandoReportes ? "animate-spin" : ""}
              />

              <span className="hidden sm:inline">
                Actualizar
              </span>

            </button>

          </div>

        </header>


        {/* -------------------------------------------- */}
        {/* ZONA PRINCIPAL DESPLAZABLE */}
        {/* -------------------------------------------- */}

        <div className="flex-1 overflow-auto p-5 md:p-8">


          {/* ERROR GLOBAL DE REPORTES */}

          {errorReportes && (

            <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">

              <AlertTriangle
                className="text-red-600 shrink-0 mt-0.5"
                size={20}
              />

              <div className="flex-1">

                <h3 className="text-sm font-bold text-red-800">
                  No se pudieron cargar los reportes
                </h3>

                <p className="text-sm text-red-700 mt-1">
                  {errorReportes}
                </p>

                <button
                  onClick={handleRefreshReports}
                  className="mt-3 text-sm font-semibold text-red-800 underline"
                >
                  Reintentar
                </button>

              </div>

            </div>

          )}


          {/* ------------------------------------------ */}
          {/* SECCIÓN INICIO */}
          {/* ------------------------------------------ */}

          {seccionActiva === "Inicio" && (

            <div className="space-y-6">

              <div>

                <h1 className="text-2xl font-bold text-slate-900">
                  Dashboard de Monitoreo
                </h1>

                <p className="text-sm text-slate-500 mt-1">
                  Reportes ciudadanos correspondientes al ámbito de tu sesión municipal.
                </p>

              </div>


              {/* CARGANDO */}

              {cargandoReportes && (

                <div className="bg-white p-10 rounded-xl text-center border border-slate-200">

                  <Loader2
                    className="mx-auto text-blue-700 animate-spin mb-3"
                    size={32}
                  />

                  <p className="text-sm text-slate-600">
                    Cargando reportes desde el servidor...
                  </p>

                </div>

              )}


              {/* SIN REPORTES */}

              {!cargandoReportes &&
                !errorReportes &&
                reportesFiltrados.length === 0 && (

                  <div className="bg-white p-12 rounded-xl text-center border border-slate-200 shadow-xs">

                    <AlertTriangle
                      className="mx-auto text-amber-500 mb-3"
                      size={36}
                    />

                    <h3 className="text-lg font-bold text-slate-800">
                      No hay reportes disponibles
                    </h3>

                    <p className="text-sm text-slate-500 mt-1">
                      La API no devolvió reportes para el ámbito de esta sesión.
                    </p>

                    <button
                      onClick={handleRefreshReports}
                      className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-blue-800 hover:underline"
                    >
                      <RefreshCw size={15} />
                      Volver a consultar
                    </button>

                  </div>

                )}


              {/* REPORTES DISPONIBLES */}

              {!cargandoReportes &&
                reportesFiltrados.length > 0 && (

                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">


                    {/* MAPA DE REPORTES */}

                    <div className="col-span-1 lg:col-span-2 bg-white p-5 rounded-xl shadow-xs border border-slate-200">

                      <h3 className="font-semibold text-slate-700 mb-3">
                        Georreferenciación de Baches
                      </h3>

                      <div className="h-[380px] w-full rounded-lg overflow-hidden border border-slate-100">

                        {reportesConCoordenadas.length > 0 ? (

                          <MapaReportes
                            reportes={reportesConCoordenadas}
                          />

                        ) : (

                          <div className="h-full flex flex-col items-center justify-center bg-slate-50 text-center p-6">

                            <MapPin
                              size={34}
                              className="text-slate-400 mb-3"
                            />

                            <p className="font-semibold text-slate-700">
                              No hay coordenadas disponibles
                            </p>

                            <p className="text-sm text-slate-500 mt-1">
                              Los reportes recibidos todavía no tienen coordenadas válidas para mostrar en el mapa.
                            </p>

                          </div>

                        )}

                      </div>

                    </div>


                    {/* ALERTAS Y LISTADO */}

                    <div className="col-span-1 bg-white p-5 rounded-xl shadow-xs border border-slate-200">

                      <h3 className="font-semibold text-slate-700 mb-3">
                        Reportes Comunales
                      </h3>

                      <div className="h-[380px] overflow-y-auto pr-1">

                        <ListaReportes
                          reportes={reportesFiltrados}
                          onVerDetalle={handleVerDetalle}
                        />

                      </div>

                    </div>

                  </div>

                )}


              {/* HISTORIAL */}

              {!cargandoReportes &&
                reportesFiltrados.length > 0 && (

                  <div className="bg-white p-5 rounded-xl shadow-xs border border-slate-200">

                    <h3 className="font-semibold text-slate-700 mb-4">
                      Historial de Reportes Oficiales
                    </h3>

                    <ListaReportes
                      reportes={reportesFiltrados}
                      onVerDetalle={handleVerDetalle}
                    />

                  </div>

                )}

            </div>

          )}


          {/* ------------------------------------------ */}
          {/* SECCIÓN REPORTES */}
          {/* ------------------------------------------ */}

          {seccionActiva === "Reportes" && (

            <div className="space-y-6">

              <div className="flex flex-wrap justify-between items-center gap-3">

                <div>

                  <h3 className="text-xl font-bold text-slate-900">
                    Gestión de Incidentes
                  </h3>

                  <p className="text-sm text-slate-500">
                    Listado de reportes correspondientes al usuario autenticado.
                  </p>

                </div>

                <button
                  onClick={handleRefreshReports}
                  disabled={cargandoReportes}
                  className="flex items-center gap-2 px-3 py-2 bg-white border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  <RefreshCw
                    size={15}
                    className={cargandoReportes ? "animate-spin" : ""}
                  />
                  Actualizar listado
                </button>

              </div>


              {cargandoReportes ? (

                <div className="bg-white p-10 rounded-xl text-center border border-slate-200">

                  <Loader2 className="mx-auto animate-spin text-blue-700 mb-3" size={30} />

                  <p className="text-sm text-slate-500">
                    Consultando reportes...
                  </p>

                </div>

              ) : reportesFiltrados.length === 0 ? (

                <div className="bg-white p-10 rounded-xl text-center border border-slate-200">

                  <FileText className="mx-auto text-slate-400 mb-3" size={32} />

                  <h3 className="font-semibold text-slate-800">
                    No hay reportes para mostrar
                  </h3>

                  <p className="text-sm text-slate-500 mt-1">
                    Cuando existan reportes asociados a tu ámbito, aparecerán aquí.
                  </p>

                </div>

              ) : (

                <div className="bg-white p-5 rounded-xl shadow-xs border border-slate-200">

                  <ListaReportes
                    reportes={reportesFiltrados}
                    onVerDetalle={handleVerDetalle}
                  />

                </div>

              )}

            </div>

          )}


          {/* ------------------------------------------ */}
          {/* SECCIÓN MAPA TÉRMICO */}
          {/* ------------------------------------------ */}

          {seccionActiva === "Mapa Térmico" && (

            <div className="space-y-6">

              <div>

                <h3 className="text-xl font-bold text-slate-900">
                  Mapa de Calor y Severidad
                </h3>

                <p className="text-sm text-slate-500">
                  Distribución geográfica de los reportes con coordenadas disponibles.
                </p>

              </div>


              <div className="bg-white p-5 rounded-xl shadow-xs border border-slate-200 h-[600px] overflow-hidden">

                {cargandoReportes ? (

                  <div className="h-full flex items-center justify-center">

                    <Loader2 className="animate-spin text-blue-700" size={32} />

                  </div>

                ) : reportesConCoordenadas.length > 0 ? (

                  <MapaTermico
                    reportes={reportesConCoordenadas}
                  />

                ) : (

                  <div className="h-full flex flex-col items-center justify-center text-center">

                    <Flame
                      size={36}
                      className="text-slate-400 mb-3"
                    />

                    <h3 className="font-semibold text-slate-700">
                      No hay datos geográficos
                    </h3>

                    <p className="text-sm text-slate-500 mt-1">
                      No se encontraron reportes con coordenadas válidas.
                    </p>

                  </div>

                )}

              </div>

            </div>

          )}


          {/* ------------------------------------------ */}
          {/* SECCIÓN CONFIGURACIÓN */}
          {/* ------------------------------------------ */}

          {seccionActiva === "Configuración" && (

            <div className="space-y-6 max-w-2xl bg-white p-6 rounded-xl shadow-xs border border-slate-200">

              <div className="flex items-center gap-3">

                <div className="bg-blue-50 rounded-xl p-3">
                  <Settings size={23} className="text-blue-900" />
                </div>

                <div>

                  <h3 className="text-xl font-bold text-slate-900">
                    Perfil institucional
                  </h3>

                  <p className="text-sm text-slate-500">
                    Información de la cuenta autenticada.
                  </p>

                </div>

              </div>


              <div className="space-y-4 pt-2">

                <div>

                  <label className="block text-xs font-semibold text-slate-500 uppercase">
                    Nombre
                  </label>

                  <input
                    type="text"
                    readOnly
                    value={displayValue(usuario.nombre)}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 font-medium"
                  />

                </div>


                <div>

                  <label className="block text-xs font-semibold text-slate-500 uppercase">
                    Correo electrónico
                  </label>

                  <input
                    type="text"
                    readOnly
                    value={displayValue(usuario.email)}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 font-medium"
                  />

                </div>


                <div>

                  <label className="block text-xs font-semibold text-slate-500 uppercase">
                    Rol
                  </label>

                  <input
                    type="text"
                    readOnly
                    value={displayValue(usuario.rol)}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 font-medium"
                  />

                </div>


                <div>

                  <label className="block text-xs font-semibold text-slate-500 uppercase">
                    Ámbito municipal
                  </label>

                  <input
                    type="text"
                    readOnly
                    value={tenantLabel}
                    className="w-full mt-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-700 font-medium"
                  />

                </div>


                <div className="pt-3 border-t border-slate-200">

                  <div className="flex items-center gap-2 text-sm text-emerald-700">

                    <CheckCircle size={17} />

                    <span className="font-medium">
                      Sesión autenticada correctamente
                    </span>

                  </div>

                </div>

              </div>

            </div>

          )}

        </div>

      </main>


      {/* -------------------------------------------- */}
      {/* MODAL DE DETALLES DEL REPORTE */}
      {/* -------------------------------------------- */}

      {reporteSeleccionado && (

        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">

          <div className="bg-white max-w-3xl w-full rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">


            {/* CABECERA DEL MODAL */}

            <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">

              <div className="flex items-center gap-3">

                <div className="bg-blue-600 p-2 rounded-lg text-white">

                  <Activity size={20} />

                </div>

                <div>

                  <span className="text-xs text-blue-400 font-mono font-bold">
                    EXPEDIENTE TÉCNICO: {reporteSeleccionado.id}
                  </span>

                  <h3 className="text-lg font-bold">
                    {displayValue(reporteSeleccionado.direccion)}
                  </h3>

                </div>

              </div>


              <button
                onClick={() => setReporteSeleccionado(null)}
                className="text-slate-400 hover:text-white bg-slate-800 p-2 rounded-full transition-colors"
                aria-label="Cerrar detalle"
              >

                <X size={18} />

              </button>

            </div>


            {/* CONTENIDO DEL MODAL */}

            <div className="p-6 space-y-6 max-h-[81vh] overflow-y-auto">


              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">


                {/* EVIDENCIA FOTOGRÁFICA */}

                <div>

                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">

                    <MapPin size={14} className="text-blue-600" />

                    Evidencia Fotográfica del Ciudadano

                  </h4>


                  <div className="h-56 bg-slate-100 rounded-xl overflow-hidden border border-slate-200 relative shadow-inner flex items-center justify-center">

                    {reporteSeleccionado.imagenUrl ? (

                      <img
                        src={reporteSeleccionado.imagenUrl}
                        alt="Evidencia del reporte"
                        className="w-full h-full object-cover"
                      />

                    ) : (

                      <div className="text-center p-5">

                        <MapPin
                          size={32}
                          className="mx-auto text-slate-400 mb-2"
                        />

                        <p className="text-sm font-medium text-slate-600">
                          Fotografía no disponible
                        </p>

                        <p className="text-xs text-slate-400 mt-1">
                          La recuperación de fotografías se conectará mediante el endpoint protegido del backend.
                        </p>

                      </div>

                    )}


                    <div className="absolute bottom-2 left-2 bg-black/75 text-white text-[10px] px-2.5 py-1 rounded-md font-mono backdrop-blur-xs">

                      GPS: {displayValue(reporteSeleccionado.latitud, "—")},{" "}
                      {displayValue(reporteSeleccionado.longitud, "—")}

                    </div>

                  </div>

                </div>


                {/* ANÁLISIS DE IA */}

                <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-4 flex flex-col justify-between">

                  <div>

                    <h4 className="text-xs font-semibold uppercase tracking-wider text-blue-900 mb-3 flex items-center gap-1.5">

                      <Cpu size={15} className="text-blue-700" />

                      Triage y Visión Artificial (IA)

                    </h4>


                    {reporteSeleccionado.iaAnalisis ? (

                      <div className="space-y-3 text-sm">

                        <div className="flex justify-between border-b border-blue-100 pb-2">

                          <span className="text-slate-600">
                            Puntaje de Prioridad:
                          </span>

                          <span className="font-bold text-slate-800">
                            {displayValue(
                              reporteSeleccionado.iaAnalisis.puntajePrioridad
                            )}
                          </span>

                        </div>


                        <div className="flex justify-between border-b border-blue-100 pb-2">

                          <span className="text-slate-600">
                            Diámetro Estimado:
                          </span>

                          <span className="font-semibold text-slate-800">
                            {displayValue(
                              reporteSeleccionado.iaAnalisis.diametroEstimado
                            )}
                          </span>

                        </div>


                        <div className="flex justify-between border-b border-blue-100 pb-2">

                          <span className="text-slate-600">
                            Profundidad Promedio:
                          </span>

                          <span className="font-semibold text-slate-800">
                            {displayValue(
                              reporteSeleccionado.iaAnalisis.profundidadEstimada
                            )}
                          </span>

                        </div>

                      </div>

                    ) : (

                      <div className="bg-white border border-blue-100 rounded-lg p-4">

                        <p className="text-sm text-slate-600">
                          No existe un análisis de visión artificial disponible para este reporte.
                        </p>

                      </div>

                    )}

                  </div>


                  <div className="mt-4 bg-white p-3 rounded-lg border border-blue-200 text-xs text-slate-700">

                    <strong className="text-blue-900 block mb-1">
                      Diagnóstico:
                    </strong>

                    {displayValue(
                      reporteSeleccionado.iaAnalisis?.recomendacion,
                      "Sin diagnóstico de IA disponible."
                    )}

                  </div>

                </div>

              </div>


              {/* PARÁMETROS DE ENTORNO */}

              <div>

                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">

                  Parámetros de Entorno y Validación Técnica

                </h4>


                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">


                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-start gap-3">

                    <CheckCircle
                      size={18}
                      className="text-emerald-600 shrink-0 mt-0.5"
                    />

                    <div>

                      <span className="text-xs text-slate-400 block font-medium">
                        Concurrencia vial
                      </span>

                      <span className="text-slate-800 font-semibold">
                        {displayValue(
                          reporteSeleccionado.formulario?.flujoVehicular
                        )}
                      </span>

                    </div>

                  </div>


                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-start gap-3">

                    <CheckCircle
                      size={18}
                      className="text-emerald-600 shrink-0 mt-0.5"
                    />

                    <div>

                      <span className="text-xs text-slate-400 block font-medium">
                        Infraestructura crítica cercana
                      </span>

                      <span className="text-slate-800 font-semibold">
                        {displayValue(
                          reporteSeleccionado.formulario?.cercaniaColegioHospital
                        )}
                      </span>

                    </div>

                  </div>


                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-start gap-3">

                    <CheckCircle
                      size={18}
                      className="text-emerald-600 shrink-0 mt-0.5"
                    />

                    <div>

                      <span className="text-xs text-slate-400 block font-medium">
                        Clasificación vial
                      </span>

                      <span className="text-slate-800 font-semibold">
                        {displayValue(
                          reporteSeleccionado.formulario?.tipoVia
                        )}
                      </span>

                    </div>

                  </div>


                  <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 flex items-start gap-3">

                    <CheckCircle
                      size={18}
                      className="text-emerald-600 shrink-0 mt-0.5"
                    />

                    <div>

                      <span className="text-xs text-slate-400 block font-medium">
                        Observación / Descripción
                      </span>

                      <span className="text-slate-800 font-semibold italic">
                        {displayValue(reporteSeleccionado.descripcion)}
                      </span>

                    </div>

                  </div>


                </div>

              </div>


              {/* INFORMACIÓN GENERAL */}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

                <div className="bg-slate-50 rounded-lg border border-slate-200 p-3">

                  <span className="text-xs text-slate-400 block">
                    Comuna
                  </span>

                  <span className="text-sm font-semibold text-slate-800">
                    {displayValue(reporteSeleccionado.comuna)}
                  </span>

                </div>


                <div className="bg-slate-50 rounded-lg border border-slate-200 p-3">

                  <span className="text-xs text-slate-400 block">
                    Severidad
                  </span>

                  <span className="text-sm font-semibold text-slate-800">
                    {displayValue(reporteSeleccionado.severidad)}
                  </span>

                </div>


                <div className="bg-slate-50 rounded-lg border border-slate-200 p-3">

                  <span className="text-xs text-slate-400 block">
                    Fecha de reporte
                  </span>

                  <span className="text-sm font-semibold text-slate-800">
                    {formatDate(reporteSeleccionado.fechaReporte)}
                  </span>

                </div>

              </div>

            </div>


            {/* PIE DEL MODAL */}

            <div className="bg-slate-50 px-6 py-3 border-t border-slate-200 flex flex-wrap justify-between items-center gap-3">

              <span className="text-xs text-slate-500 font-mono">

                Estado actual:{" "}

                <strong className="text-slate-800">
                  {displayValue(reporteSeleccionado.estado)}
                </strong>

              </span>


              <button
                onClick={() => setReporteSeleccionado(null)}
                className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors shadow-sm"
              >
                Cerrar expediente
              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  );
}