import React, { useEffect, useRef, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
import logoBache0 from '../assets/logo_bache0_azul_hd.png';
import ilustracionCiudadano from '../assets/ilustracion_reporte_ciudadano.webp';

const iconoPin = L.icon({ iconUrl: icon, shadowUrl: iconShadow, iconSize: [25, 41], iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = iconoPin;

// En desarrollo, el backend se ejecuta en el puerto 3000.
// Para desplegar en otro servidor, configura VITE_API_URL.
const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const MAX_FOTO = 10 * 1024 * 1024;
const TIPOS_FOTO = ['image/jpeg', 'image/png', 'image/webp'];
const coordenadaClave = ({ latitud, longitud }) => `${latitud},${longitud}`;

function LocationMarker({ coords, onChange }) {
  useMapEvents({ click(e) { onChange({ latitud: e.latlng.lat, longitud: e.latlng.lng }); } });
  if (!coords) return null;
  return (
    <Marker
      position={[coords.latitud, coords.longitud]}
      draggable
      eventHandlers={{
        dragend(e) {
          const posicion = e.target.getLatLng();
          onChange({ latitud: posicion.lat, longitud: posicion.lng });
        },
      }}
    />
  );
}

function CentrarMapa({ coords }) {
  const mapa = useMap();
  useEffect(() => {
    if (coords) mapa.setView([coords.latitud, coords.longitud], mapa.getZoom());
  }, [coords?.latitud, coords?.longitud, mapa]);
  return null;
}

function mensajeError(resultado, respuesta) {
  if (typeof resultado?.error === 'string') return resultado.error;
  if (typeof resultado?.error?.message === 'string') return resultado.error.message;
  if (typeof resultado?.mensaje === 'string') return resultado.mensaje;
  if (typeof resultado?.message === 'string') return resultado.message;
  if (respuesta.status === 413) return 'La fotografía supera el límite de 10 MB.';
  return `La solicitud no se pudo completar (HTTP ${respuesta.status}).`;
}

export default function ReporteBacheScreen() {
  const [esMovil, setEsMovil] = useState(true);
  const [foto, setFoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [coords, setCoords] = useState(null);
  const [metodoUbicacion, setMetodoUbicacion] = useState('pin_manual');
  const [precisionGps, setPrecisionGps] = useState(null);
  const [ubicacionConfirmada, setUbicacionConfirmada] = useState(false);
  const [ubicacionResuelta, setUbicacionResuelta] = useState(null);
  const [claveConfirmada, setClaveConfirmada] = useState(null);
  const [resolviendoUbicacion, setResolviendoUbicacion] = useState(false);
  const [errorUbicacion, setErrorUbicacion] = useState('');
  const [errorGps, setErrorGps] = useState('');
  const [cargandoGps, setCargandoGps] = useState(false);
  const [formData, setFormData] = useState({
    gravedadCiudadano: '',
    concurrenciaVial: '',
    infraestructuraCritica: '',
    descripcion: '',
  });
  const [estadoEnvio, setEstadoEnvio] = useState('IDLE');
  const [reporteResultado, setReporteResultado] = useState(null);
  const [errorMensaje, setErrorMensaje] = useState('');
  const solicitudUbicacion = useRef(0);
  const coordsActuales = useRef(null);
  const ultimaConfirmacion = useRef(null);

  useEffect(() => {
    const comprobar = () => {
      const agente = navigator.userAgent || '';
      setEsMovil(/android|iphone|ipad|ipod|blackberry|windows phone/i.test(agente) || window.innerWidth <= 768);
    };
    comprobar();
    window.addEventListener('resize', comprobar);
    return () => window.removeEventListener('resize', comprobar);
  }, []);

  useEffect(() => {
    if (!foto) { setPreview(null); return; }
    const url = URL.createObjectURL(foto);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [foto]);

  const cambiarCoordenadas = (nuevas, metodo = 'pin_manual', precision = null) => {
    setMetodoUbicacion(metodo);
    setPrecisionGps(precision);
    solicitudUbicacion.current += 1;
    coordsActuales.current = nuevas;
    ultimaConfirmacion.current = null;
    setCoords(nuevas);
    setUbicacionConfirmada(false);
    setClaveConfirmada(null);
    setUbicacionResuelta(null);
    setErrorUbicacion('');
    setResolviendoUbicacion(false);
  };

  const obtenerUbicacion = () => {
    setCargandoGps(true);
    setErrorGps('');
    if (!navigator.geolocation) {
      setErrorGps('Tu navegador no permite obtener la ubicación. Selecciona el punto en el mapa.');
      setCargandoGps(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        cambiarCoordenadas({ latitud: posicion.coords.latitude, longitud: posicion.coords.longitude }, 'gps', posicion.coords.accuracy);
        setCargandoGps(false);
      },
      () => {
        setErrorGps('No pudimos obtener tu GPS. Selecciona manualmente el lugar del bache en el mapa.');
        // Sin GPS: el ciudadano debe elegir el punto manualmente.
        setCargandoGps(false);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  useEffect(() => { obtenerUbicacion(); }, []);

  const handleFotoChange = (evento) => {
    const archivo = evento.target.files?.[0];
    if (!archivo) return;
    if (!TIPOS_FOTO.includes(archivo.type)) {
      setErrorMensaje('Formato no válido. Solo se permiten JPEG, PNG o WebP.');
      evento.target.value = '';
      return;
    }
    if (archivo.size > MAX_FOTO) {
      setErrorMensaje('La fotografía supera el máximo de 10 MB.');
      evento.target.value = '';
      return;
    }
    setErrorMensaje('');
    setFoto(archivo);
  };

  const confirmarUbicacion = async () => {
    if (!coords || resolviendoUbicacion) return;
    const coordsConsulta = { ...coords };
    const claveConsulta = coordenadaClave(coordsConsulta);
    const numeroSolicitud = ++solicitudUbicacion.current;
    ultimaConfirmacion.current = null;
    setUbicacionConfirmada(false);
    setClaveConfirmada(null);
    setUbicacionResuelta(null);
    setErrorUbicacion('');
    setResolviendoUbicacion(true);
    try {
      const respuesta = await fetch(`${API_URL}/api/v1/ubicaciones/resolver`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...coordsConsulta, metodo_ubicacion: metodoUbicacion, precision_ubicacion_m: precisionGps }),
      });
      const resultado = await respuesta.json().catch(() => ({}));
      if (numeroSolicitud !== solicitudUbicacion.current ||
          coordenadaClave(coordsActuales.current) !== claveConsulta) return;
      if (!respuesta.ok) throw new Error(mensajeError(resultado, respuesta));
      if (!resultado?.data?.comuna_detectada || !resultado?.data?.municipalidad?.id) {
        throw new Error('El servidor no pudo confirmar la comuna y su cobertura.');
      }
      setUbicacionResuelta(resultado.data);
      setClaveConfirmada(claveConsulta);
      ultimaConfirmacion.current = claveConsulta;
      setUbicacionConfirmada(true);
    } catch (error) {
      if (numeroSolicitud !== solicitudUbicacion.current) return;
      setErrorUbicacion(error instanceof TypeError
        ? 'No se pudo conectar con el servicio de ubicación. Comprueba que el backend esté iniciado e intenta nuevamente.'
        : error.message);
    } finally {
      if (numeroSolicitud === solicitudUbicacion.current) setResolviendoUbicacion(false);
    }
  };

  const handleSubmit = async (evento) => {
    evento.preventDefault();
    if (estadoEnvio === 'ENVIANDO') return;
    setErrorMensaje('');
    if (!foto || !coords || !formData.gravedadCiudadano || !formData.concurrenciaVial || !formData.infraestructuraCritica) {
      setErrorMensaje('Agrega una fotografía, selecciona la ubicación y responde todas las preguntas obligatorias.');
      return;
    }
    if (!ubicacionConfirmada || !ubicacionResuelta ||
        claveConfirmada !== coordenadaClave(coords) ||
        ultimaConfirmacion.current !== coordenadaClave(coords)) {
      setErrorMensaje('Debes verificar y confirmar la ubicación antes de enviar el reporte.');
      return;
    }
    const datos = new FormData();
    datos.append('foto', foto);
    datos.append('latitud', String(coords.latitud));
    datos.append('longitud', String(coords.longitud));
    datos.append('metodo_ubicacion', metodoUbicacion);
    datos.append('ubicacion_confirmada', 'true');
    if (precisionGps !== null) datos.append('precision_ubicacion_m', String(precisionGps));
    datos.append('concurrencia_vial', formData.concurrenciaVial);
    datos.append('infraestructura_critica', formData.infraestructuraCritica);
    datos.append('descripcion', formData.descripcion);
    datos.append('severidad', formData.gravedadCiudadano);
    // Los campos adicionales del terreno requieren acuerdo con el contrato del backend.
    setEstadoEnvio('ENVIANDO');
    try {
      const respuesta = await fetch(`${API_URL}/api/v1/reportes`, { method: 'POST', body: datos });
      const resultado = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) throw new Error(mensajeError(resultado, respuesta));
      if (!resultado?.data?.folio) throw new Error('El servidor no devolvió un folio persistido.');
      setReporteResultado({ folio: resultado.data.folio, gravedad: formData.gravedadCiudadano });
      setEstadoEnvio('EXITOSO');
    } catch (error) {
      setEstadoEnvio('ERROR');
      setErrorMensaje(error instanceof TypeError
        ? 'No se pudo conectar con el servidor. Revisa la conexión e intenta nuevamente.'
        : error.message);
    }
  };

  // Bache0-QR-escritorio-v2: sólo interfaz; formulario móvil intacto.
  if (!esMovil) {
    const enlaceMovil = `${window.location.origin}/reporte`;
    const urlQR = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(enlaceMovil)}`;
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-sky-100 px-4 py-8 font-sans text-slate-900 lg:px-8 lg:py-12">
        <main className="mx-auto w-full max-w-7xl overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-xl">
          <header className="flex flex-wrap items-center gap-4 border-b border-slate-100 px-6 py-5 lg:px-12">
            <img src={logoBache0} alt="Bache 0" className="h-auto w-44 object-contain lg:w-52" />
            <span className="rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800">Módulo Ciudadano</span>
          </header>
          <div className="grid items-center gap-6 px-6 py-8 lg:grid-cols-2 lg:gap-10 lg:px-12 lg:py-12">
            <section>
              <h1 className="max-w-xl text-4xl font-extrabold leading-tight tracking-tight text-blue-950 lg:text-5xl">Reporta un bache desde tu celular</h1>
              <p className="mt-5 max-w-lg text-base leading-relaxed text-slate-600">Toma una fotografía, confirma la ubicación en el mapa y envía los antecedentes del daño vial desde el lugar del reporte.</p>
              <div className="mt-6 rounded-2xl border border-blue-100 bg-blue-50 p-5">
                <h2 className="font-bold text-blue-900">¿Por qué aparece un código QR?</h2>
                <p className="mt-2 text-sm leading-relaxed text-blue-950">Este formulario está diseñado para utilizar la cámara y la ubicación del teléfono. Si estás en un computador, escanea el QR con tu celular para continuar en el módulo ciudadano.</p>
              </div>
              <div className="mt-6 flex flex-wrap items-center gap-5">
                <div className="rounded-2xl border border-blue-100 bg-white p-4 shadow-md">
                  <img src={urlQR} alt="QR que abre el formulario de Bache0 en el celular" className="h-48 w-48 lg:h-52 lg:w-52" />
                  <p className="mt-2 text-center text-sm font-bold text-blue-900">Escanea y reporta</p>
                </div>
                <div className="max-w-52 text-sm leading-relaxed text-slate-600">
                  <p className="font-bold text-slate-900">Tres pasos</p>
                  <p className="mt-2">1. Fotografía del daño</p>
                  <p>2. Confirma el punto en el mapa</p>
                  <p>3. Completa y envía el reporte</p>
                  <a href={enlaceMovil} className="mt-4 inline-block break-all font-semibold text-blue-700 underline">Abrir enlace del formulario</a>
                </div>
              </div>
            </section>
            <aside className="overflow-hidden rounded-3xl border border-blue-100 bg-blue-50 shadow-sm">
              <img src={ilustracionCiudadano} alt="Ilustración de una persona que registra un bache utilizando el formulario del celular" className="h-auto w-full object-cover" />
              <p className="px-5 py-3 text-xs text-slate-500">Simulación ilustrativa del proceso de reporte. El formulario real se abre al escanear el QR.</p>
            </aside>
          </div>
          <div className="grid gap-4 border-t border-blue-100 bg-slate-50 px-6 py-6 lg:grid-cols-3 lg:px-12">
            <div className="rounded-xl bg-white p-4"><p className="font-bold text-blue-900">1 · Toma una foto</p><p className="mt-1 text-sm text-slate-600">Registra claramente el daño del pavimento.</p></div>
            <div className="rounded-xl bg-white p-4"><p className="font-bold text-blue-900">2 · Confirma la ubicación</p><p className="mt-1 text-sm text-slate-600">Verifica o ajusta el pin en el mapa.</p></div>
            <div className="rounded-xl bg-white p-4"><p className="font-bold text-blue-900">3 · Envía el reporte</p><p className="mt-1 text-sm text-slate-600">Completa los datos y recibe un folio.</p></div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div style={styles.contenedorMovil}>
      <header style={styles.header}>
        <h1 style={{ margin: 0, fontSize: 20, color: '#fff' }}>Bache 0</h1>
        <span style={{ color: '#FBCB05', fontSize: 13, fontWeight: 'bold' }}>Módulo Ciudadano</span>
      </header>
      {estadoEnvio === 'EXITOSO' ? (
        <div style={styles.seccion}>
          <h2 style={{ color: '#0033A0' }}>Solicitud recibida por el servidor</h2>
          <p>Folio: <strong>{reporteResultado.folio}</strong></p>
          <p>Gravedad declarada: {reporteResultado.gravedad}</p>
          <p>El servidor respondió correctamente. El reporte fue registrado por el servidor.</p>
          <button type="button" style={styles.btnSecundario} onClick={() => window.location.reload()}>Realizar otro reporte</button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={styles.formulario}>
          <section style={styles.seccion}>
            <label htmlFor="cameraInput" style={styles.label}>1. Fotografía del bache</label>
            <input type="file" id="cameraInput" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={handleFotoChange} style={{ display: 'none' }} />
            <label htmlFor="cameraInput" style={styles.btnCamara}>📷 {foto ? 'Cambiar fotografía' : 'Tomar fotografía'}</label>
            {preview && <div style={{ marginTop: 10 }}><img src={preview} alt="Vista previa de la fotografía" style={styles.preview} /><p style={{ fontSize: 12, color: '#198754' }}>✓ Fotografía seleccionada</p></div>}
          </section>

          <section style={styles.seccion}>
            <span style={styles.label}>2. Ubicación del bache (mueve el pin)</span>
            {cargandoGps && <p role="status">Obteniendo ubicación GPS...</p>}
            {errorGps && <p style={styles.aviso}>{errorGps}</p>}
            <div style={{ height: 'clamp(340px, 48vh, 380px)', width: '100%', borderRadius: 6, overflow: 'hidden', border: '1px solid #ccc' }}>
              {
                <MapContainer center={coords ? [coords.latitud, coords.longitud] : [-33.4489, -70.6693]} zoom={coords ? 16 : 11} style={{ height: '100%', width: '100%' }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
                  <CentrarMapa coords={coords} />
                  <LocationMarker coords={coords} onChange={cambiarCoordenadas} />
                </MapContainer>
              }
            </div>
            {coords && <p style={{ fontSize: 12, color: '#555' }}>📍 Lat: {coords.latitud.toFixed(5)}, Lng: {coords.longitud.toFixed(5)}</p>}
            {coords && (
              <div style={{ marginTop: 12 }}>
                <button type="button" onClick={confirmarUbicacion} disabled={resolviendoUbicacion || cargandoGps} style={{ ...styles.btnGuardar, width: '100%', backgroundColor: ubicacionConfirmada ? '#198754' : '#0033A0' }}>
                  {resolviendoUbicacion ? 'Verificando ubicación...' : ubicacionConfirmada ? '✓ Ubicación confirmada' : 'Verificar y confirmar ubicación'}
                </button>
                {ubicacionResuelta && ubicacionConfirmada && <p style={{ color: '#198754', fontSize: 13 }}>Calle: <strong>{ubicacionResuelta.calle_detectada || "No identificada"}</strong><br />Comuna: <strong>{ubicacionResuelta.comuna_detectada}</strong></p>}
                {errorUbicacion && <p role="alert" style={styles.error}>{errorUbicacion}</p>}
                {!ubicacionConfirmada && !resolviendoUbicacion && <p style={styles.aviso}>Revisa el pin y verifica la calle y comuna antes de enviar el reporte.</p>}
              </div>
            )}
          </section>

          <section style={styles.seccion}>
            <span style={styles.label}>3. Información del terreno</span>
            <label htmlFor="gravedad" style={styles.sublabel}>Gravedad percibida:</label>
            <select id="gravedad" value={formData.gravedadCiudadano} onChange={(e) => setFormData({ ...formData, gravedadCiudadano: e.target.value })} style={styles.select} required>
              <option value="">-- Selecciona gravedad --</option><option value="baja">Baja</option><option value="media">Media</option><option value="alta">Alta</option>
            </select>
            <label htmlFor="concurrencia" style={styles.sublabel}>¿Es muy concurrida la calle?</label>
            <select id="concurrencia" value={formData.concurrenciaVial} onChange={(e) => setFormData({ ...formData, concurrenciaVial: e.target.value })} style={styles.select} required>
              <option value="">-- Selecciona concurrencia --</option><option value="baja">Baja</option><option value="media">Media</option><option value="alta">Alta</option><option value="muy_alta">Muy Alta</option>
            </select>
            <label htmlFor="infraestructura" style={styles.sublabel}>Proximidad a infraestructura crítica:</label>
            <select id="infraestructura" value={formData.infraestructuraCritica} onChange={(e) => setFormData({ ...formData, infraestructuraCritica: e.target.value })} style={styles.select} required>
              <option value="">-- Selecciona opción --</option>
              <option value="ninguna">Sin infraestructura crítica cercana</option>
              <option value="colegio">Cercano a colegio</option>
              <option value="centro_salud">Cercano a centro de salud municipal</option>
              <option value="estacion_terminal">Cercano a estación/terminal</option>
              <option value="otra">Cercano a otra infraestructura relevante</option>
            </select>
            <label htmlFor="descripcion" style={styles.sublabel}>Observación / Descripción:</label>
            <textarea id="descripcion" maxLength={2000} rows={3} placeholder="Ej: Bache profundo en calzada principal..." value={formData.descripcion} onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })} style={styles.textarea} />
          </section>
          {errorMensaje && <p role="alert" style={styles.error}>{errorMensaje}</p>}
          <button type="submit" disabled={estadoEnvio === 'ENVIANDO' || resolviendoUbicacion} style={{ ...styles.btnGuardar, backgroundColor: estadoEnvio === 'ENVIANDO' ? '#888' : '#0033A0' }}>
            {estadoEnvio === 'ENVIANDO' ? 'Enviando reporte...' : 'Enviar reporte'}
          </button>
        </form>
      )}
    </div>
  );
}

const styles = {
  escritorioContenedor: { backgroundColor: '#F4F6F8', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, boxSizing: 'border-box' },
  escritorioTarjeta: { backgroundColor: '#fff', padding: 30, borderRadius: 12, textAlign: 'center', maxWidth: 400, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' },
  contenedorMovil: { backgroundColor: '#F4F6F8', minHeight: '100vh', padding: 15, boxSizing: 'border-box', fontFamily: 'sans-serif' },
  header: { backgroundColor: '#0033A0', padding: 15, borderRadius: 8, textAlign: 'center', marginBottom: 15 },
  formulario: { display: 'flex', flexDirection: 'column', gap: 15 },
  seccion: { backgroundColor: '#fff', padding: 15, borderRadius: 8, border: '1px solid #E0E0E0' },
  label: { fontSize: 16, fontWeight: 'bold', color: '#002270', display: 'block', marginBottom: 10 },
  sublabel: { fontSize: 14, fontWeight: 600, color: '#333', display: 'block', margin: '10px 0 5px' },
  select: { width: '100%', padding: 10, borderRadius: 6, border: '1px solid #CCC', fontSize: 14, boxSizing: 'border-box' },
  textarea: { width: '100%', padding: 10, borderRadius: 6, border: '1px solid #CCC', fontSize: 14, boxSizing: 'border-box', resize: 'vertical' },
  btnCamara: { display: 'block', backgroundColor: '#0033A0', color: '#fff', padding: 12, borderRadius: 6, textAlign: 'center', fontWeight: 'bold', cursor: 'pointer' },
  preview: { width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 6 },
  btnGuardar: { color: '#fff', padding: 15, borderRadius: 8, border: 'none', fontSize: 16, fontWeight: 'bold', cursor: 'pointer', marginTop: 10 },
  btnSecundario: { backgroundColor: '#FBCB05', border: 'none', padding: '12px 20px', borderRadius: 6, fontWeight: 'bold', cursor: 'pointer' },
  aviso: { color: '#B45309', fontSize: 13 },
  error: { color: '#B42318', fontSize: 13, fontWeight: 'bold' },
};
