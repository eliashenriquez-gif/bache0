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
  getReportPhoto,
  updateReportStatus,
} from "./services/reportService";

import {
  adaptApiReport,
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

// La severidad reportada y la prioridad calculada son conceptos distintos.
const PRIORITY_RANK = { alta: 0, media: 1, baja: 2 };

const PRIORITY_STYLES = {
  alta: "bg-red-50 border-red-200 text-red-800",
  media: "bg-amber-50 border-amber-200 text-amber-800",
  baja: "bg-emerald-50 border-emerald-200 text-emerald-800",
};

function PrioridadBadge({ reporte }) {
  const clave = reporte?.prioridadApi;
  const clase = PRIORITY_STYLES[clave] || "bg-slate-50 border-slate-200 text-slate-700";

  return (
    <span className={`inline-flex flex-wrap items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold ${clase}`}>
      Prioridad: {reporte?.prioridad || "No informada"}
      {reporte?.prioridadProvisional && " · provisional"}
    </span>
  );
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
  const [prioridadFiltro, setPrioridadFiltro] = useState("todas");
  const [ordenPrioridad, setOrdenPrioridad] = useState("alta_primero");

  // Fotografía privada del reporte seleccionado (Blob convertido a URL temporal).
  const [fotoReporteUrl, setFotoReporteUrl] = useState(null);
  const [cargandoFoto, setCargandoFoto] = useState(false);
  const [errorFoto, setErrorFoto] = useState("");

  // Estado que el funcionario desea guardar desde el detalle del reporte.
  const [estadoEdicion, setEstadoEdicion] = useState("pendiente");
  const [guardandoEstado, setGuardandoEstado] = useState(false);
  const [errorEstado, setErrorEstado] = useState("");
  const [estadoActualizado, setEstadoActualizado] = useState(false);


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
    setPrioridadFiltro("todas");
    setOrdenPrioridad("alta_primero");
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

        // Actualiza prioridad y motivos si el motor terminó mientras el modal estaba abierto.
        setReporteSeleccionado((actual) => {
          if (!actual) return null;
          const reciente = adaptedReports.find((reporte) => reporte.apiId === actual.apiId);
          return reciente ? { ...actual, ...reciente } : actual;
        });

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
  // 7. RECUPERAR LA FOTOGRAFÍA PRIVADA DEL REPORTE
  // --------------------------------------------------

  useEffect(() => {
    const reportId = reporteSeleccionado?.apiId;

    setFotoReporteUrl(null);
    setErrorFoto("");

    if (!reportId || !token || !reporteSeleccionado?.fotoUrl) {
      setCargandoFoto(false);
      return undefined;
    }

    let cancelled = false;
    let temporaryUrl = null;

    async function loadReportPhoto() {
      setCargandoFoto(true);

      try {
        const photoBlob = await getReportPhoto(token, reportId);

        if (cancelled) return;

        if (!photoBlob || !photoBlob.type?.startsWith("image/")) {
          throw new Error("El servidor no devolvió una fotografía válida.");
        }

        temporaryUrl = URL.createObjectURL(photoBlob);
        setFotoReporteUrl(temporaryUrl);
      } catch (error) {
        if (cancelled) return;

        if (error.status === 401) {
          clearAccessToken();
          setToken(null);
          setUsuario(null);
          setAuthStatus("anonymous");
          setReporteSeleccionado(null);
          return;
        }

        setErrorFoto(
          error.status === 404
            ? "No se encontró una fotografía asociada a este reporte."
            : error.status === 403
              ? "No tienes permiso para consultar esta fotografía."
              : error.message || "No se pudo recuperar la fotografía."
        );
      } finally {
        if (!cancelled) setCargandoFoto(false);
      }
    }

    loadReportPhoto();

    return () => {
      cancelled = true;
      if (temporaryUrl) URL.revokeObjectURL(temporaryUrl);
    };
  }, [token, reporteSeleccionado?.apiId, reporteSeleccionado?.fotoUrl]);


  // --------------------------------------------------
  // 8. MANTENER SEPARADO EL MÓDULO CIUDADANO
  // --------------------------------------------------

  if (isCitizenRoute) {
    return <ReporteBacheScreen />;
  }


  // --------------------------------------------------
  // 9. PANTALLA DE VERIFICACIÓN DE SESIÓN
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
  // 10. PANTALLA DE LOGIN
  // --------------------------------------------------

  if (authStatus !== "authenticated" || !usuario) {
    return <LoginMunicipal onLogin={handleLogin} />;
  }


  // --------------------------------------------------
  // 11. INFORMACIÓN DEL FUNCIONARIO AUTENTICADO
  // --------------------------------------------------

  const esSuperadministrador =
    usuario.rol === "superadministrador";

// Nombres institucionales asociados a los ID de PostgreSQL.
const MUNICIPALIDADES = {
  1: "Estación Central",
  2: "La Pintana",
  3: "El Bosque",
  4: "Providencia",
};

const municipalidadNombre =
  MUNICIPALIDADES[Number(usuario.municipalidad_id)];

const tenantLabel = esSuperadministrador
  ? "Administración global"
  : municipalidadNombre
    ? `Municipalidad de ${municipalidadNombre}`
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

  // El filtro opera solo sobre los reportes ya autorizados por el backend.
  // Los de prioridad no informada siempre quedan después de los calculados.
  const reportesFiltrados = reportes
    .filter((reporte) =>
      prioridadFiltro === "todas" || reporte.prioridadApi === prioridadFiltro
    )
    .sort((a, b) => {
      const prioridadA = PRIORITY_RANK[a.prioridadApi];
      const prioridadB = PRIORITY_RANK[b.prioridadApi];
      const sinPrioridadA = prioridadA === undefined;
      const sinPrioridadB = prioridadB === undefined;

      if (sinPrioridadA !== sinPrioridadB) return sinPrioridadA ? 1 : -1;

      if (!sinPrioridadA && prioridadA !== prioridadB) {
        return ordenPrioridad === "baja_primero"
          ? prioridadB - prioridadA
          : prioridadA - prioridadB;
      }

      // A igual prioridad, se muestran primero los reportes más recientes.
      const fechaA = new Date(a.fechaReporte).getTime() || 0;
      const fechaB = new Date(b.fechaReporte).getTime() || 0;
      return fechaB - fechaA;
    });

  // El mapa térmico mantiene todos los reportes del ámbito municipal.
  const reportesConCoordenadas = reportes.filter(
    (reporte) =>
      Number.isFinite(reporte.latitud) &&
      Number.isFinite(reporte.longitud)
  );

  // El mapa de Inicio respeta el filtro de prioridad visible en esa sección.
  const reportesFiltradosConCoordenadas = reportesFiltrados.filter(
    (reporte) =>
      Number.isFinite(reporte.latitud) &&
      Number.isFinite(reporte.longitud)
  );


  // --------------------------------------------------
  // 12. SELECCIÓN DE UN REPORTE
  // --------------------------------------------------

  const handleVerDetalle = (reporte) => {
    setReporteSeleccionado(reporte);
    setEstadoEdicion(reporte.estadoApi || "pendiente");
    setErrorEstado("");
    setEstadoActualizado(false);
  };


  async function handleUpdateReportStatus() {
    if (!reporteSeleccionado?.apiId || !token || !estadoEdicion) return;

    setGuardandoEstado(true);
    setErrorEstado("");
    setEstadoActualizado(false);

    try {
      const response = await updateReportStatus(
        token,
        reporteSeleccionado.apiId,
        estadoEdicion
      );

      const rawUpdatedReport = response?.data ?? response;
      const updatedReport = adaptApiReport(rawUpdatedReport);

      if (!updatedReport) {
        throw new Error("El servidor no devolvió el reporte actualizado.");
      }

      setReportes((currentReports) =>
        currentReports.map((report) =>
          report.apiId === updatedReport.apiId
            ? { ...report, ...updatedReport }
            : report
        )
      );

      setReporteSeleccionado((current) =>
        current?.apiId === updatedReport.apiId
          ? { ...current, ...updatedReport }
          : current
      );

      setEstadoEdicion(updatedReport.estadoApi || estadoEdicion);
      setEstadoActualizado(true);
    } catch (error) {
      if (error.status === 401) {
        clearAccessToken();
        setToken(null);
        setUsuario(null);
        setReportes([]);
        setReporteSeleccionado(null);
        setAuthStatus("anonymous");
        return;
      }

      setErrorEstado(error.message || "No se pudo actualizar el estado del reporte.");
    } finally {
      setGuardandoEstado(false);
    }
  }


  // --------------------------------------------------
  // 13. ACTUALIZAR LISTADO
  // --------------------------------------------------

  const handleRefreshReports = () => {
    setReloadReportsKey((previous) => previous + 1);
  };


  // --------------------------------------------------
  // 14. DASHBOARD MUNICIPAL
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

               <h2
  className="text-sm font-bold truncate text-white"
  title={tenantLabel}
>
  {esSuperadministrador
    ? tenantLabel
    : municipalidadNombre || tenantLabel}
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


          {/* FILTRO Y ORDEN DE PRIORIDAD - SOLO INICIO Y REPORTES */}
          {(seccionActiva === "Inicio" || seccionActiva === "Reportes") && (
            <div className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
              <div className="min-w-[150px]">
                <label htmlFor="filtro-prioridad" className="mb-1 block text-xs font-semibold text-slate-600">
                  Filtrar por prioridad
                </label>
                <select
                  id="filtro-prioridad"
                  value={prioridadFiltro}
                  onChange={(event) => setPrioridadFiltro(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                >
                  <option value="todas">Todas</option>
                  <option value="alta">Alta</option>
                  <option value="media">Media</option>
                  <option value="baja">Baja</option>
                </select>
              </div>

              <div className="min-w-[150px]">
                <label htmlFor="orden-prioridad" className="mb-1 block text-xs font-semibold text-slate-600">
                  Orden de prioridad
                </label>
                <select
                  id="orden-prioridad"
                  value={ordenPrioridad}
                  onChange={(event) => setOrdenPrioridad(event.target.value)}
                  className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800"
                >
                  <option value="alta_primero">Alta primero</option>
                  <option value="baja_primero">Baja primero</option>
                </select>
              </div>

              <div className="text-xs text-slate-600 sm:ml-auto">
                Mostrando <strong>{reportesFiltrados.length}</strong> de <strong>{reportes.length}</strong> reportes cargados
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
                      {reportes.length > 0
                        ? "No hay reportes que coincidan con el filtro de prioridad."
                        : "La API no devolvió reportes para el ámbito de esta sesión."}
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

                        {reportesFiltradosConCoordenadas.length > 0 ? (

                          <MapaReportes
                            reportes={reportesFiltradosConCoordenadas}
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
                    {reportes.length > 0
                      ? "No hay reportes que coincidan con el filtro de prioridad."
                      : "Cuando existan reportes asociados a tu ámbito, aparecerán aquí."}
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

                    {cargandoFoto ? (

                      <div className="text-center p-5">
                        <Loader2 size={30} className="mx-auto text-blue-600 mb-2 animate-spin" />
                        <p className="text-sm font-medium text-slate-600">
                          Recuperando fotografía...
                        </p>
                      </div>

                    ) : fotoReporteUrl ? (

                      <img
                        src={fotoReporteUrl}
                        alt={`Fotografía del reporte ${reporteSeleccionado.id}`}
                        className="w-full h-full object-contain bg-slate-900"
                      />

                    ) : (

                      <div className="text-center p-5">
                        <MapPin
                          size={32}
                          className="mx-auto text-slate-400 mb-2"
                        />
                        <p className="text-sm font-medium text-slate-600">
                          {errorFoto ? "No se pudo cargar la fotografía" : "Fotografía no disponible"}
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          {errorFoto || "Este reporte no tiene una fotografía recuperable."}
                        </p>
                      </div>

                    )}


                    <div className="absolute bottom-2 left-2 bg-black/75 text-white text-[10px] px-2.5 py-1 rounded-md font-mono backdrop-blur-xs">

                      GPS: {displayValue(reporteSeleccionado.latitud, "—")},{" "}
                      {displayValue(reporteSeleccionado.longitud, "—")}

                    </div>

                  </div>

                </div>


                {/* PRIORIDAD Y VISIÓN: DATOS REALES SIN PREDICCIONES SIMULADAS */}
                <section className="rounded-xl border border-blue-100 bg-blue-50/50 p-4" aria-label="Prioridad y análisis de IA">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <h4 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-blue-900">
                      <Cpu size={15} className="text-blue-700" />
                      Priorización explicable
                    </h4>
                    <PrioridadBadge reporte={reporteSeleccionado} />
                  </div>

                  <div className="space-y-2 rounded-lg border border-blue-100 bg-white p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-slate-600">Puntaje de reglas</span>
                      <strong className="text-slate-800">
                        {displayValue(reporteSeleccionado.puntajePrioridad, "Pendiente")}
                      </strong>
                    </div>
                    {reporteSeleccionado.versionReglas && (
                      <p className="text-xs text-slate-500">
                        Versión del motor: {reporteSeleccionado.versionReglas}
                      </p>
                    )}
                    {reporteSeleccionado.prioridadProvisional && (
                      <p role="status" className="text-xs font-medium text-amber-800">
                        Prioridad provisional: el análisis todavía puede modificarla.
                      </p>
                    )}
                    {reporteSeleccionado.prioridadProvisional &&
                      reporteSeleccionado.rangoPosiblePrioridad && (
                        <p className="text-xs text-slate-600">
                          Rango posible: {displayValue(reporteSeleccionado.rangoPosiblePrioridad.min)}
                          {" – "}
                          {displayValue(reporteSeleccionado.rangoPosiblePrioridad.max)}
                        </p>
                      )}
                    {reporteSeleccionado.explicacionesPrioridad?.length > 0 ? (
                      <div className="border-t border-blue-100 pt-2">
                        <p className="mb-1 font-semibold text-slate-700">Motivos del cálculo</p>
                        <ul className="list-inside list-disc space-y-1 text-slate-600">
                          {reporteSeleccionado.explicacionesPrioridad.map((texto, index) => (
                            <li key={`${index}-${texto}`}>{texto}</li>
                          ))}
                        </ul>
                      </div>
                    ) : (
                      <p className="border-t border-blue-100 pt-2 text-xs text-slate-500">
                        El reporte todavía no incluye explicaciones de prioridad.
                      </p>
                    )}
                    {reporteSeleccionado.datosNoDisponibles?.length > 0 && (
                      <p className="text-xs text-slate-500">
                        Datos no disponibles: {reporteSeleccionado.datosNoDisponibles
                          .map((factor) => factor.replaceAll("_", " "))
                          .join(", ")}.
                      </p>
                    )}
                    {reporteSeleccionado.advertenciasPrioridad?.map((texto, index) => (
                      <p key={`${index}-${texto}`} className="text-xs text-amber-800">
                        {texto}
                      </p>
                    ))}
                  </div>

                  <div className="mt-3 rounded-lg border border-blue-100 bg-white p-3 text-sm">
                    <h5 className="font-semibold text-blue-900">Visión artificial (TensorFlow.js)</h5>
                    <p className="mt-1 text-xs text-slate-600">
                      La consulta de análisis de fotografía se conectará cuando esté
                      integrado el endpoint de visión del backend. No se muestran
                      estimaciones simuladas de diámetro o profundidad.
                    </p>
                  </div>
                </section>

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

              <div className="flex flex-wrap items-center gap-2">
                <label htmlFor="estado-reporte" className="text-xs text-slate-600 font-medium">
                  Estado:
                </label>
                <select
                  id="estado-reporte"
                  value={estadoEdicion}
                  onChange={(event) => {
                    setEstadoEdicion(event.target.value);
                    setEstadoActualizado(false);
                    setErrorEstado("");
                  }}
                  disabled={guardandoEstado}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="pendiente">Pendiente</option>
                  <option value="en_revision">En revisión</option>
                  <option value="reparado">Reparado</option>
                </select>
                <button
                  type="button"
                  onClick={handleUpdateReportStatus}
                  disabled={guardandoEstado || estadoEdicion === reporteSeleccionado.estadoApi}
                  className="inline-flex items-center gap-2 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 text-white text-sm font-medium px-4 py-2 transition-colors"
                >
                  {guardandoEstado && <Loader2 size={15} className="animate-spin" />}
                  {guardandoEstado ? "Guardando..." : "Guardar estado"}
                </button>
                {estadoActualizado && (
                  <span className="text-xs font-medium text-emerald-700">Estado guardado.</span>
                )}
                {errorEstado && (
                  <span role="alert" className="w-full text-xs text-red-600">{errorEstado}</span>
                )}
              </div>

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