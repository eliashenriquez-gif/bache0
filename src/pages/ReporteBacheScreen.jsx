import React, { useState, useEffect, useRef } from 'react';

export default function ReporteBacheScreen() {
  const [descripcion, setDescripcion] = useState('');
  const [gravedad, setGravedad] = useState('Media');
  const [imagen, setImagen] = useState(null);
  const [ubicacion, setUbicacion] = useState(null);
  const [cargandoUbi, setCargandoUbi] = useState(false);
  const [esMovil, setEsMovil] = useState(window.innerWidth <= 768);
  const fileInputRef = useRef(null);

  // Detector de tamaño de pantalla (Bloqueador de PC)
  useEffect(() => {
    const handleResize = () => setEsMovil(window.innerWidth <= 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // 1. Geolocalización nativa del navegador web
  const obtenerUbicacion = () => {
    setCargandoUbi(true);
    if (!navigator.geolocation) {
      alert('Tu navegador no soporta geolocalización.');
      setCargandoUbi(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (posicion) => {
        setUbicacion({
          lat: posicion.coords.latitude,
          lng: posicion.coords.longitude,
        });
        setCargandoUbi(false);
      },
      (error) => {
        alert('Permiso denegado. Asegúrate de tener el GPS activado.');
        setCargandoUbi(false);
      }
    );
  };

  // 2. Captura de imagen nativa HTML
  const capturarFoto = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImagen(URL.createObjectURL(file));
    }
  };

  // VISTA A: Bloqueo si entran desde un computador de escritorio
  if (!esMovil) {
    return (
      <div style={styles.bloqueoContainer}>
        <h2 style={{ color: '#0033A0', marginBottom: '10px' }}>Módulo de Terreno</h2>
        <p>Los reportes de baches están diseñados para capturarse en la calle.</p>
        <p style={{ fontWeight: 'bold', marginTop: '15px' }}>
          Por favor, ingresa desde tu celular para habilitar el GPS y la cámara.
        </p>
      </div>
    );
  }

  // VISTA B: Aplicación web adaptable para celulares
  return (
    <div style={styles.container}>
      <h1 style={styles.titulo}>Reporte de Bache</h1>

      <label style={styles.label}>Evidencia Fotográfica:</label>
      {imagen && <img src={imagen} alt="Bache" style={styles.preview} />}
      
      <input 
        type="file" 
        accept="image/*" 
        capture="environment" 
        ref={fileInputRef}
        style={styles.fileInput}
        onChange={capturarFoto}
      />
      <button style={styles.btnSecundario} onClick={() => fileInputRef.current.click()}>
        📷 Tomar Foto del Bache
      </button>

      <label style={styles.label}>Ubicación GPS:</label>
      {ubicacion ? (
        <p style={styles.coords}>
          Lat: {ubicacion.lat.toFixed(5)} | Lng: {ubicacion.lng.toFixed(5)}
        </p>
      ) : (
        <p style={styles.coords}>Ubicación no capturada</p>
      )}
      <button style={styles.btnSecundario} onClick={obtenerUbicacion} disabled={cargandoUbi}>
        {cargandoUbi ? 'Obteniendo GPS...' : '📍 Capturar Mi Ubicación'}
      </button>

      <label style={styles.label}>Gravedad del Bache:</label>
      <div style={styles.opcionesContenedor}>
        {['Baja', 'Media', 'Alta'].map((item) => (
          <button
            key={item}
            style={{
              ...styles.btnOpcion,
              ...(gravedad === item ? styles.btnOpcionActiva : {}),
            }}
            onClick={() => setGravedad(item)}
          >
            {item}
          </button>
        ))}
      </div>

      <label style={styles.label}>Descripción del Problema:</label>
      <textarea
        style={styles.input}
        rows="3"
        placeholder="Ej: Bache profundo en el carril derecho..."
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
      />

      <button 
        style={styles.btnGuardar} 
        onClick={() => alert('Éxito: Reporte guardado correctamente')}
      >
        Guardar Reporte
      </button>
    </div>
  );
}

// Estilos web puros (reemplazo de StyleSheet de React Native)
const styles = {
  container: { flex: 1, padding: '20px', backgroundColor: '#f5f5f5', minHeight: '100vh', fontFamily: 'system-ui, sans-serif' },
  titulo: { fontSize: '22px', fontWeight: 'bold', marginBottom: '20px', marginTop: '10px', color: '#333' },
  label: { fontSize: '16px', fontWeight: '600', marginTop: '15px', marginBottom: '5px', display: 'block', color: '#444' },
  input: { width: '100%', backgroundColor: '#fff', padding: '12px', borderRadius: '8px', border: '1px solid #ccc', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' },
  preview: { width: '100%', height: '200px', objectFit: 'cover', borderRadius: '8px', marginBottom: '10px' },
  coords: { fontSize: '14px', color: '#666', marginBottom: '5px', fontStyle: 'italic' },
  btnSecundario: { width: '100%', display: 'block', backgroundColor: '#007AFF', padding: '12px', borderRadius: '8px', border: 'none', color: '#fff', fontWeight: 'bold', cursor: 'pointer', marginBottom: '10px' },
  opcionesContenedor: { display: 'flex', justifyContent: 'space-between', marginBottom: '10px', gap: '8px' },
  btnOpcion: { flex: 1, padding: '10px', border: '1px solid #ccc', backgroundColor: '#fff', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', color: '#333' },
  btnOpcionActiva: { backgroundColor: '#34C759', borderColor: '#34C759', color: '#fff' },
  btnGuardar: { width: '100%', display: 'block', backgroundColor: '#28a745', padding: '15px', borderRadius: '8px', border: 'none', color: '#fff', fontSize: '16px', fontWeight: 'bold', cursor: 'pointer', marginTop: '20px', marginBottom: '40px' },
  fileInput: { display: 'none' },
  bloqueoContainer: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', padding: '20px', textAlign: 'center', backgroundColor: '#f4f6f8', fontFamily: 'system-ui, sans-serif' }
};