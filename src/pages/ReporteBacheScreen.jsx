import React, { useState, useEffect } from 'react';
import logoBache from '../assets/logo_bache0.png';

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

  const [estadoEnvio, setEstadoEnvio] = useState('IDLE');
  const [reporteResultado, setReporteResultado] = useState(null);

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
        setErrorGps('No pudimos obtener tu ubicación. Activa la ubicación de tu dispositivo para continuar.');
        setCargandoGps(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleFotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setFoto(file);
      setPreview(URL.createObjectURL(file));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!foto || !coords || !formData.gravedadCiudadano || !formData.concurrenciaVial || !formData.infraestructuraCritica) {
      alert('Por favor toma la foto, activa el GPS y responde todas las preguntas del formulario.');
      return;
    }

    setEstadoEnvio('ENVIANDO');

    setTimeout(() => {
      setEstadoEnvio('PROCESANDO');
      
      setTimeout(() => {
        setReporteResultado({
          id: 'B0-0001',
          prioridadSimulada: 'Alta',
          mensaje: 'Tu reporte fue registrado y será procesado por Bache 0.'
        });
        setEstadoEnvio('EXITOSO');
      }, 1500);
    }, 1000);
  };

  if (!esMovil) {
    return (
      <div style={styles.escritorioContenedor}>
        <div style={styles.escritorioTarjeta}>
          <img src={logoBache} alt="Logo Bache 0" style={{ height: '50px', objectFit: 'contain', marginBottom: '15px' }} />
          <h2 style={{ color: '#002270', marginTop: 0, fontSize: '20px' }}>Módulo de Terreno</h2>
          <p style={{ color: '#475569', lineHeight: '1.6', fontSize: '15px' }}>
            Los reportes de baches están diseñados para realizarse directamente desde un dispositivo móvil en la calle.
          </p>
          <p style={{ fontWeight: '800', color: '#0033A0', marginTop: '20px' }}>Ingresa desde tu celular para realizar un reporte.</p>
          <img 
            src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=https://bache0.vercel.app/reporte" 
            alt="Código QR de acceso móvil" 
            style={{ marginTop: '15px', borderRadius: '12px', border: '1px solid #E2E8F0', padding: '10px' }}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={styles.contenedorMovil}>
      <header style={styles.header}>
        <img src={logoBache} alt="Bache 0" style={{ height: '40px', objectFit: 'contain', marginBottom: '5px' }} />
        <span style={{ fontSize: '13px', color: '#F8FAFC', fontWeight: '500', opacity: 0.9 }}>Módulo Ciudadano de Reportes</span>
      </header>

      {estadoEnvio === 'EXITOSO' ? (
        <div style={styles.tarjetaConfirmacion}>
          <h2 style={{ color: '#0033A0', marginTop: 0, fontWeight: '800' }}>Reporte enviado correctamente</h2>
          <p style={{ color: '#475569' }}>{reporteResultado.mensaje}</p>
          
          <div style={styles.cajaResultado}>
            <p style={{ margin: '8px 0', color: '#334155' }}><strong>N.° de reporte:</strong> {reporteResultado.id}</p>
            <p style={{ margin: '8px 0', fontSize: '18px', color: '#002270' }}>
              <strong>Prioridad:</strong> <span style={{ color: '#DC2626' }}>{reporteResultado.prioridadSimulada}</span>
            </p>
            <small style={{ color: '#64748B' }}>(Resultado de prueba simulado)</small>
          </div>

          <button onClick={() => window.location.reload()} style={styles.btnSecundario}>
            Realizar otro reporte
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={styles.formulario}>
          
          {/* SECCIÓN 1: FOTO */}
          <div style={styles.seccion}>
            <label style={styles.label}>1. Evidencia Fotográfica</label>
            <input 
              type="file" 
              accept="image/*" 
              capture="environment" 
              id="cameraInput" 
              onChange={handleFotoChange}
              style={{ display: 'none' }}
            />
            <label htmlFor="cameraInput" style={styles.btnCamara}>
              📷 {preview ? 'CAMBIAR FOTOGRAFÍA' : 'TOMAR FOTOGRAFÍA'}
            </label>

            {preview && (
              <div style={{ marginTop: '15px' }}>
                <img src={preview} alt="Vista previa" style={styles.preview} />
                <p style={{ fontSize: '13px', color: '#16A34A', margin: '8px 0', fontWeight: '600' }}>✓ Fotografía cargada correctamente</p>
              </div>
            )}
          </div>

          {/* SECCIÓN 2: GPS */}
          <div style={styles.seccion}>
            <label style={styles.label}>2. Georreferenciación Automática</label>
            {cargandoGps && <p style={{ fontSize: '14px', color: '#64748B' }}>Obteniendo coordenadas...</p>}
            {coords && (
              <div style={{ backgroundColor: '#F8FAFC', padding: '12px', borderRadius: '8px', border: '1px solid #E2E8F0' }}>
                <p style={{ color: '#334155', fontSize: '14px', margin: '0', fontWeight: '600' }}>
                  📍 Ubicación obtenida
                </p>
                <p style={{ color: '#64748B', fontSize: '13px', margin: '4px 0 0 0' }}>
                  Latitud: {coords.latitud.toFixed(4)}<br/>
                  Longitud: {coords.longitud.toFixed(4)}
                </p>
              </div>
            )}
            {errorGps && (
              <div>
                <p style={{ color: '#DC2626', fontSize: '13px', margin: '5px 0', fontWeight: '500' }}>{errorGps}</p>
                <button type="button" onClick={obtenerUbicacion} style={styles.btnReintentar}>
                  Reintentar GPS
                </button>
              </div>
            )}
          </div>

          {/* SECCIÓN 3: FORMULARIO */}
          <div style={styles.seccion}>
            <label style={styles.label}>3. Detalles Técnicos del Reporte</label>
            
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

            <p style={styles.sublabel}>Cercanía a infraestructura crítica <span style={{fontWeight: '400', color: '#64748B'}}>(ej: colegio, mall, salud, etc.)</span>:</p>
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

            <p style={styles.sublabel}>Clasificación vial estimada:</p>
            <input 
              type="text" 
              value={formData.clasificacionVial} 
              disabled 
              style={{ ...styles.input, backgroundColor: '#F1F5F9', color: '#94A3B8', borderColor: '#E2E8F0' }}
            />

            <p style={styles.sublabel}>Observación / Descripción:</p>
            <textarea 
              rows="3" 
              placeholder="Ej: Bache profundo en calzada principal..." 
              value={formData.descripcion} 
              onChange={(e) => setFormData({...formData, descripcion: e.target.value})}
              style={styles.textarea}
            />
          </div>

          <button 
            type="submit" 
            disabled={estadoEnvio !== 'IDLE'}
            style={{
              ...styles.btnGuardar,
              backgroundColor: estadoEnvio === 'IDLE' ? '#0033A0' : '#94A3B8',
              boxShadow: estadoEnvio === 'IDLE' ? '0 8px 20px rgba(0, 51, 160, 0.25)' : 'none'
            }}
          >
            {estadoEnvio === 'IDLE' && 'ENVIAR REPORTE'}
            {estadoEnvio === 'ENVIANDO' && 'Enviando...'}
            {estadoEnvio === 'PROCESANDO' && 'Procesando...'}
          </button>
        </form>
      )}
    </div>
  );
}

const styles = {
  escritorioContenedor: {
    backgroundColor: '#F1F5F9',
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    boxSizing: 'border-box',
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  escritorioTarjeta: {
    backgroundColor: '#FFFFFF',
    padding: '40px',
    borderRadius: '24px',
    textAlign: 'center',
    maxWidth: '420px',
    boxShadow: '0 20px 40px -15px rgba(0,34,112,0.15)',
    border: '1px solid #E2E8F0'
  },
  contenedorMovil: {
    backgroundColor: '#F8FAFC',
    minHeight: '100vh',
    paddingBottom: '40px',
    boxSizing: 'border-box',
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  },
  header: {
    backgroundColor: '#002270',
    padding: '20px 15px',
    textAlign: 'center',
    borderBottomLeftRadius: '24px',
    borderBottomRightRadius: '24px',
    boxShadow: '0 4px 12px rgba(0,34,112,0.2)',
    marginBottom: '20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px'
  },
  formulario: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    padding: '0 15px'
  },
  seccion: {
    backgroundColor: '#FFFFFF',
    padding: '24px 20px',
    borderRadius: '20px',
    boxShadow: '0 4px 20px rgba(0,0,0,0.03)',
    border: '1px solid #F1F5F9'
  },
  label: {
    fontSize: '17px',
    fontWeight: '800',
    color: '#0033A0',
    display: 'block',
    marginBottom: '16px',
    borderBottom: '2px solid #F1F5F9',
    paddingBottom: '10px'
  },
  sublabel: {
    fontSize: '13px',
    fontWeight: '700',
    color: '#334155',
    margin: '16px 0 8px 0'
  },
  select: {
    width: '100%',
    padding: '14px 16px',
    borderRadius: '12px',
    border: '1px solid #CBD5E1',
    backgroundColor: '#F8FAFC',
    fontSize: '15px',
    color: '#334155',
    outline: 'none',
    boxSizing: 'border-box',
    fontWeight: '500'
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    borderRadius: '12px',
    border: '1px solid #CBD5E1',
    backgroundColor: '#F8FAFC',
    fontSize: '15px',
    color: '#334155',
    outline: 'none',
    boxSizing: 'border-box',
    fontWeight: '500'
  },
  textarea: {
    width: '100%',
    padding: '14px 16px',
    borderRadius: '12px',
    border: '1px solid #CBD5E1',
    backgroundColor: '#F8FAFC',
    fontSize: '15px',
    color: '#334155',
    boxSizing: 'border-box',
    resize: 'none',
    minHeight: '100px',
    fontWeight: '500'
  },
  btnCamara: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '10px',
    backgroundColor: '#EEF2FF',
    color: '#0033A0',
    padding: '16px',
    borderRadius: '14px',
    fontWeight: '800',
    fontSize: '15px',
    cursor: 'pointer',
    width: '100%',
    boxSizing: 'border-box',
    border: '2px dashed #A5B4FC',
    transition: 'all 0.2s ease'
  },
  preview: {
    width: '100%',
    maxHeight: '220px',
    objectFit: 'cover',
    borderRadius: '12px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
    border: '3px solid #FFF'
  },
  btnReintentar: {
    backgroundColor: '#FEE2E2',
    color: '#DC2626',
    border: 'none',
    padding: '10px 16px',
    borderRadius: '8px',
    fontWeight: '700',
    fontSize: '14px',
    cursor: 'pointer',
    marginTop: '10px'
  },
  btnGuardar: {
    color: '#FFF',
    padding: '18px',
    borderRadius: '16px',
    border: 'none',
    fontSize: '16px',
    fontWeight: '800',
    cursor: 'pointer',
    marginTop: '10px',
    letterSpacing: '0.5px'
  },
  tarjetaConfirmacion: {
    backgroundColor: '#FFFFFF',
    padding: '30px 20px',
    borderRadius: '24px',
    textAlign: 'center',
    boxShadow: '0 10px 30px rgba(0,0,0,0.08)',
    margin: '20px 15px',
    border: '1px solid #E2E8F0'
  },
  cajaResultado: {
    backgroundColor: '#F8FAFC',
    padding: '20px',
    borderRadius: '16px',
    margin: '24px 0',
    border: '1px dashed #CBD5E1'
  },
  btnSecundario: {
    backgroundColor: '#FBCB05',
    color: '#002270',
    border: 'none',
    padding: '16px 24px',
    borderRadius: '12px',
    fontWeight: '800',
    fontSize: '16px',
    cursor: 'pointer',
    width: '100%',
    boxShadow: '0 4px 12px rgba(251, 203, 5, 0.3)'
  }
};