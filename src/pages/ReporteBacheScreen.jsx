import React, { useState, useEffect } from 'react';
// Importamos los componentes del mapa
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Arreglo para que el icono del pin de Leaflet se vea bien
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

// Componente para permitir mover el pin en el mapa
function LocationMarker({ coords, setCoords }) {
  const map = useMapEvents({
    click(e) {
      setCoords({ latitud: e.latlng.lat, longitud: e.latlng.lng });
      map.flyTo(e.latlng, map.getZoom());
    },
  });

  return coords === null ? null : (
    <Marker 
      position={{ lat: coords.latitud, lng: coords.longitud }} 
      draggable={true}
      eventHandlers={{
        dragend: (e) => {
          const latlng = e.target.getLatLng();
          setCoords({ latitud: latlng.lat, longitud: latlng.lng });
        },
      }}
    />
  );
}

export default function ReporteBacheScreen() {
  const [esMovil, setEsMovil] = useState(true);
  const [foto, setFoto] = useState(null);
  const [preview, setPreview] = useState(null);
  const [coords, setCoords] = useState(null);
  const [errorGps, setErrorGps] = useState(null);
  const [cargandoGps, setCargandoGps] = useState(false);

  const [formData, setFormData] = useState({
    gravedadCiudadano: '',
    concurrenciaVial: '',
    infraestructuraCritica: '',
    clasificacionVial: 'Avenida Troncal (Ejemplo automático)',
    descripcion: ''
  });

  const [estadoEnvio, setEstadoEnvio] = useState('IDLE'); // IDLE, ENVIANDO, EXITOSO, ERROR
  const [reporteResultado, setReporteResultado] = useState(null);
  const [errorMensaje, setErrorMensaje] = useState('');

  useEffect(() => {
    const checkDevice = () => {
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      const isMobileDevice = /android|iphone|ipad|ipod|blackberry|windows phone/i.test(userAgent);
      const isMobileWidth = window.innerWidth <= 768;
      setEsMovil(isMobileDevice || isMobileWidth);
    };

    checkDevice();
    window.addEventListener('resize', checkDevice);
    return () => window.removeEventListener('resize', checkDevice);
  }, []);

  useEffect(() => {
    obtenerUbicacion();
  }, []);

  const obtenerUbicacion = () => {
    setCargandoGps(true);
    setErrorGps(null);

    if (!navigator.geolocation) {
      setErrorGps('La geolocalización no es soportada por tu navegador.');
      setCargandoGps(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCoords({
          latitud: position.coords.latitude,
          longitud: position.coords.longitude
        });
        setCargandoGps(false);
      },
      () => {
        setErrorGps('No pudimos obtener tu ubicación. Puedes mover el pin en el mapa manualmente.');
        setCargandoGps(false);
        // Coordenadas por defecto (Santiago) si falla el GPS
        setCoords({ latitud: -33.4489, longitud: -70.6693 });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleFotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validación básica en el frontend
      const tiposPermitidos = ['image/jpeg', 'image/png', 'image/webp'];
      if (!tiposPermitidos.includes(file.type)) {
        alert("Formato no válido. Solo se permiten JPEG, PNG o WebP.");
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        alert("La foto es muy pesada. El máximo es 10MB.");
        return;
      }
      setFoto(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  // AQUÍ CONECTAMOS CON EL BACKEND REAL
  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!foto || !coords || !formData.gravedadCiudadano || !formData.concurrenciaVial || !formData.infraestructuraCritica) {
      alert('Por favor toma la foto, activa el GPS y responde todas las preguntas del formulario.');
      return;
    }

    setEstadoEnvio('ENVIANDO');
    setErrorMensaje('');

    // Armamos el paquete multipart/form-data
    const data = new FormData();
    data.append('foto', foto);
    data.append('lat', coords.latitud);
    data.append('lng', coords.longitud);
    data.append('descripcion', formData.descripcion);
    data.append('gravedad', formData.gravedadCiudadano);
    // Aquí podrías enviar también calle y comuna cuando hagamos el LocationService

    try {
      const respuesta = await fetch('http://localhost:3000/api/v1/reportes', {
        method: 'POST',
        body: data,
      });

      const result = await respuesta.json();

      if (respuesta.ok) {
        setReporteResultado({
          id: result.folio,
          prioridadSimulada: formData.gravedadCiudadano, // Simulamos que la prioridad es la gravedad enviada
          mensaje: 'Tu reporte fue registrado y será procesado por Bache 0.'
        });
        setEstadoEnvio('EXITOSO');
      } else {
        throw new Error(result.error || "Error al enviar el reporte");
      }
    } catch (error) {
      console.error(error);
      setEstadoEnvio('ERROR');
      setErrorMensaje(
        error.message === 'FORMATO_FOTO_INVALIDO' ? 'La foto fue rechazada por seguridad.' : 
        error.message === 'FOTO_MUY_PESADA' ? 'La foto supera los 10MB.' :
        'Hubo un error de conexión. Revisa tu internet e intenta de nuevo.'
      );
    }
  };

  if (!esMovil) {
    return (
      <div style={styles.escritorioContenedor}>
        <div style={styles.escritorioTarjeta}>
          <h2 style={{ color: '#0033A0', marginTop: 0 }}>Módulo de Terreno</h2>
          <p style={{ color: '#333', lineHeight: '1.5' }}>
            Los reportes de baches están diseñados para realizarse directamente desde un dispositivo móvil.
          </p>
          <p style={{ fontWeight: 'bold', color: '#002270' }}>Ingresa desde tu celular para realizar un reporte.</p>
          <img 
            src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=https://bache0.vercel.app/reporte" 
            alt="Código QR de acceso móvil" 
            style={{ marginTop: '15px', borderRadius: '8px', border: '1px solid #ddd', padding: '5px' }}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={styles.contenedorMovil}>
      <header style={styles.header}>
        <h1 style={{ margin: 0, fontSize: '20px', color: '#FFF' }}>Bache 0</h1>
        <span style={{ fontSize: '13px', color: '#FBCB05', fontWeight: 'bold' }}>Módulo Ciudadano</span>
      </header>

      {estadoEnvio === 'EXITOSO' ? (
        <div style={styles.tarjetaConfirmacion}>
          <h2 style={{ color: '#0033A0', marginTop: 0 }}>Reporte enviado correctamente</h2>
          <p style={{ color: '#444' }}>{reporteResultado.mensaje}</p>
          
          <div style={styles.cajaResultado}>
            <p style={{ margin: '8px 0' }}><strong>Folio de seguimiento:</strong> {reporteResultado.id}</p>
            <p style={{ margin: '8px 0', fontSize: '18px', color: '#002270' }}>
              <strong>Gravedad reportada:</strong> <span style={{ color: '#D9534F' }}>{reporteResultado.prioridadSimulada}</span>
            </p>
          </div>

          <button 
            onClick={() => window.location.reload()} 
            style={styles.btnSecundario}
          >
            Realizar otro reporte
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={styles.formulario}>
          <div style={styles.seccion}>
            <label style={styles.label}>1. Fotografía del bache</label>
            <input 
              type="file" 
              accept="image/jpeg, image/png, image/webp" 
              capture="environment" 
              id="cameraInput" 
              onChange={handleFotoChange}
              style={{ display: 'none' }}
            />
            <label htmlFor="cameraInput" style={styles.btnCamara}>
              📷 {preview ? 'Cambiar fotografía' : 'Tomar fotografía'}
            </label>

            {preview && (
              <div style={{ marginTop: '10px' }}>
                <img src={preview} alt="Vista previa" style={styles.preview} />
                <p style={{ fontSize: '12px', color: 'green', margin: '5px 0' }}>✓ Fotografía cargada</p>
              </div>
            )}
          </div>

          <div style={styles.seccion}>
            <label style={styles.label}>2. Ubicación (Mueve el pin)</label>
            {cargandoGps && <p style={{ fontSize: '14px', color: '#666' }}>Obteniendo ubicación GPS...</p>}
            {errorGps && (
              <div style={{ marginBottom: '10px' }}>
                <p style={{ color: 'orange', fontSize: '13px', margin: '5px 0' }}>{errorGps}</p>
              </div>
            )}
            
            {/* MAPA INTERACTIVO */}
            <div style={{ height: '250px', width: '100%', marginTop: '10px', borderRadius: '6px', overflow: 'hidden', border: '1px solid #ccc' }}>
              {coords && (
                <MapContainer center={[coords.latitud, coords.longitud]} zoom={16} style={{ height: '100%', width: '100%' }}>
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; OpenStreetMap'
                  />
                  <LocationMarker coords={coords} setCoords={setCoords} />
                </MapContainer>
              )}
            </div>
            {coords && (
              <p style={{ fontSize: '12px', color: '#555', marginTop: '5px' }}>
                📍 Lat: {coords.latitud.toFixed(5)}, Lng: {coords.longitud.toFixed(5)}
              </p>
            )}
          </div>

          <div style={styles.seccion}>
            <label style={styles.label}>3. Información del terreno</label>
            
            <p style={styles.sublabel}>Gravedad percibida:</p>
            <select 
              value={formData.gravedadCiudadano} 
              onChange={(e) => setFormData({...formData, gravedadCiudadano: e.target.value})}
              style={styles.select}
            >
              <option value="" disabled>-- Selecciona gravedad --</option>
              <option value="Baja">Baja</option>
              <option value="Media">Media</option>
              <option value="Alta">Alta</option>
            </select>

            <p style={styles.sublabel}>¿Es muy concurrida la calle?</p>
            <select 
              value={formData.concurrenciaVial} 
              onChange={(e) => setFormData({...formData, concurrenciaVial: e.target.value})}
              style={styles.select}
            >
              <option value="" disabled>-- Selecciona concurrencia --</option>
              <option value="Baja">Baja</option>
              <option value="Media">Media</option>
              <option value="Alta">Alta</option>
              <option value="Muy Alta">Muy Alta</option>
            </select>

            <p style={styles.sublabel}>Proximidad a infraestructura crítica:</p>
            <select 
              value={formData.infraestructuraCritica} 
              onChange={(e) => setFormData({...formData, infraestructuraCritica: e.target.value})}
              style={styles.select}
            >
              <option value="" disabled>-- Selecciona opción --</option>
              <option value="Sin infraestructura crítica cercana">Sin infraestructura crítica cercana</option>
              <option value="Cercano a colegio">Cercano a colegio</option>
              <option value="Cercano a centro de salud municipal">Cercano a centro de salud municipal</option>
              <option value="Cercano a estación/terminal">Cercano a estación/terminal</option>
              <option value="Cercano a otra infraestructura relevante">Cercano a otra infraestructura relevante</option>
            </select>

            <p style={styles.sublabel}>Observación / Descripción:</p>
            <textarea 
              rows="3" 
              placeholder="Ej: Bache profundo en calzada principal..." 
              value={formData.descripcion} 
              onChange={(e) => setFormData({...formData, descripcion: e.target.value})}
              style={styles.textarea}
            />
          </div>

          {estadoEnvio === 'ERROR' && (
            <p style={{ color: 'red', fontWeight: 'bold', textAlign: 'center' }}>{errorMensaje}</p>
          )}

          <button 
            type="submit" 
            disabled={estadoEnvio === 'ENVIANDO'}
            style={{
              ...styles.btnGuardar,
              backgroundColor: estadoEnvio === 'ENVIANDO' ? '#888' : '#0033A0'
            }}
          >
            {estadoEnvio === 'ENVIANDO' ? 'Enviando reporte...' : 'Enviar reporte'}
          </button>
        </form>
      )}
    </div>
  );
}

const styles = {
  escritorioContenedor: { backgroundColor: '#F4F6F8', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px', boxSizing: 'border-box' },
  escritorioTarjeta: { backgroundColor: '#FFFFFF', padding: '30px', borderRadius: '12px', textAlign: 'center', maxWidth: '400px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' },
  contenedorMovil: { backgroundColor: '#F4F6F8', minHeight: '100vh', padding: '15px', boxSizing: 'border-box', fontFamily: 'sans-serif' },
  header: { backgroundColor: '#0033A0', padding: '15px', borderRadius: '8px', textAlign: 'center', marginBottom: '15px' },
  formulario: { display: 'flex', flexDirection: 'column', gap: '15px' },
  seccion: { backgroundColor: '#FFFFFF', padding: '15px', borderRadius: '8px', border: '1px solid #E0E0E0' },
  label: { fontSize: '16px', fontWeight: 'bold', color: '#002270', display: 'block', marginBottom: '10px' },
  sublabel: { fontSize: '14px', fontWeight: '600', color: '#333', margin: '10px 0 5px 0' },
  select: { width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #CCC', fontSize: '14px', boxSizing: 'border-box' },
  textarea: { width: '100%', padding: '10px', borderRadius: '6px', border: '1px solid #CCC', fontSize: '14px', boxSizing: 'border-box', resize: 'vertical' },
  btnCamara: { display: 'inline-block', backgroundColor: '#0033A0', color: '#FFF', padding: '12px', borderRadius: '6px', textAlign: 'center', fontWeight: 'bold', cursor: 'pointer', width: '100%', boxSizing: 'border-box' },
  preview: { width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '6px' },
  btnGuardar: { color: '#FFF', padding: '15px', borderRadius: '8px', border: 'none', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginTop: '10px' },
  tarjetaConfirmacion: { backgroundColor: '#FFF', padding: '20px', borderRadius: '8px', textAlign: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.05)' },
  cajaResultado: { backgroundColor: '#F4F6F8', padding: '15px', borderRadius: '6px', margin: '15px 0' },
  btnSecundario: { backgroundColor: '#FBCB05', border: 'none', padding: '12px 20px', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }
};gi