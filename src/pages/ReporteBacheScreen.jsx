import React, { useEffect, useState } from 'react';
import logoBache from '../assets/logo_bache0.png';

const COLORS = {
  blue: '#0033A0',
  blueDark: '#002270',
  blueText: '#12386D',
  yellow: '#FBCB05',
  bg: '#F4F7FC',
  border: '#E1E9F4',
  text: '#334861',
  muted: '#73839A',
  green: '#1D9B6C',
  red: '#C43D35'
};

function Icon({ name, size = 20 }) {
  const p = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': true
  };

  const shapes = {
    camera: (
      <>
        <path d="M4 7.5h3l1.7-2h5.6l1.7 2H20v10.2a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7.5Z" />
        <circle cx="11" cy="13" r="3.1" />
      </>
    ),
    pin: (
      <>
        <path d="M12 21s6-5.5 6-11a6 6 0 1 0-12 0c0 5.5 6 11 6 11Z" />
        <circle cx="12" cy="10" r="2" />
      </>
    ),
    file: (
      <>
        <path d="M7 3h7l4 4v14H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" />
        <path d="M14 3v5h5M8.5 12h6M8.5 16h7" />
      </>
    ),
    road: (
      <>
        <path d="m8 21 3-18M16 21 13 3" />
        <path d="M12 5v3m0 4v3m0 4v1" />
      </>
    ),
    arrow: <path d="M5 12h14m-6-6 6 6-6 6" />,
    check: <path d="m5 12 4 4L19 6" />,
    back: <path d="m15 18-6-6 6-6" />,
    home: (
      <>
        <path d="m3 11 9-8 9 8" />
        <path d="M5 10.5V21h14V10.5M10 21v-6h4v6" />
      </>
    ),
    phone: (
      <>
        <rect x="7" y="3" width="10" height="18" rx="2" />
        <path d="M10.5 18h3" />
      </>
    )
  };

  return <svg {...p}>{shapes[name]}</svg>;
}

function RoadIllustration() {
  return (
    <div style={styles.roadIllustration} aria-hidden="true">
      <div style={styles.roadGlowOne} />
      <div style={styles.roadGlowTwo} />
      <div style={styles.roadPathOne} />
      <div style={styles.roadPathTwo} />
      <div style={styles.roadPathThree} />
      <div style={styles.personHead} />
      <div style={styles.personBody} />
      <div style={styles.personArm} />
      <div style={styles.personPhone} />
      <div style={styles.pothole} />
      <div style={styles.potholeInner} />
    </div>
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
        <div style={styles.escritorioDecoracion} aria-hidden="true">
          <div style={styles.curveOne} />
          <div style={styles.curveTwo} />
          <div style={styles.curveThree} />
          <div style={styles.curveFour} />
        </div>

        <div style={styles.escritorioTarjeta}>
          <div style={styles.desktopContent}>
            <div style={styles.desktopKicker}>MÓDULO DE TERRENO</div>

            <img src={logoBache} alt="Logo Bache 0" style={styles.desktopLogo} />

            <h1 style={styles.desktopTitle}>
              Reporta un bache desde el lugar donde lo encontraste.
            </h1>

            <p style={styles.desktopDescription}>
              Escanea el código QR con tu celular y completa el reporte en pocos pasos. La ubicación se obtiene automáticamente para que no tengas que escribirla.
            </p>

            <div style={styles.desktopPromise}>
              <span style={styles.promiseIcon}><Icon name="phone" size={18} /></span>
              <div>
                <strong style={styles.promiseTitle}>Diseñado para terreno</strong>
                <span style={styles.promiseText}>Foto + GPS + antecedentes del evento</span>
              </div>
            </div>

            <div style={styles.qrBlock}>
              <div style={styles.qrFrame}>
                <img
                  src="https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=https://bache0.vercel.app/reporte"
                  alt="Código QR de acceso móvil"
                  style={styles.qrImage}
                />
              </div>

              <div style={styles.qrCopy}>
                <span style={styles.qrKicker}>ESCANEA Y REPORTA</span>
                <strong style={styles.qrTitle}>Abre Bache 0 en tu celular</strong>
                <span style={styles.qrText}>El flujo está pensado para realizarse directamente en la calle.</span>
              </div>
            </div>

            <div style={styles.desktopFooter}>
              <span style={styles.footerRoad}><Icon name="road" size={15} /></span>
              <span>Mejores calles · Comunidades más seguras</span>
            </div>
          </div>

          <div style={styles.desktopVisual}>
            <div style={styles.visualBadge}>
              <span style={styles.liveDot} />
              REPORTE EN TERRENO
            </div>

            <RoadIllustration />

            <div style={styles.desktopSteps}>
              <div style={styles.desktopStep}>
                <span style={styles.stepIcon}><Icon name="camera" size={17} /></span>
                <div>
                  <strong style={styles.stepTitle}>Toma una foto</strong>
                  <span style={styles.stepText}>Registra el estado del bache.</span>
                </div>
              </div>

              <div style={styles.desktopStep}>
                <span style={styles.stepIcon}><Icon name="pin" size={17} /></span>
                <div>
                  <strong style={styles.stepTitle}>Tu ubicación se detecta</strong>
                  <span style={styles.stepText}>El GPS se activa automáticamente.</span>
                </div>
              </div>

              <div style={styles.desktopStep}>
                <span style={styles.stepIcon}><Icon name="file" size={17} /></span>
                <div>
                  <strong style={styles.stepTitle}>Completa la información</strong>
                  <span style={styles.stepText}>Agrega los antecedentes del evento.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.contenedorMovil}>
      <header style={styles.header}>
        <div style={styles.headerRow}>
          <span style={styles.headerButton}><Icon name="back" size={19} /></span>
          <img src={logoBache} alt="Bache 0" style={styles.mobileLogo} />
          <span style={styles.headerButton}><Icon name="home" size={18} /></span>
        </div>
        <span style={styles.headerSubtitle}>Módulo Ciudadano de Reportes</span>
      </header>

      <main style={styles.mobileMain}>
        <div style={styles.mobileIntro}>
          <div>
            <span style={styles.mobileKicker}>REPORTE EN TERRENO</span>
            <h1 style={styles.mobileTitle}>Ayúdanos a identificar el bache.</h1>
            <p style={styles.mobileText}>Toma una foto, confirma tu ubicación y cuéntanos qué está pasando.</p>
          </div>
          <span style={styles.mobileRoadIcon}><Icon name="road" size={25} /></span>
        </div>

        <div style={styles.progress}>
          <div style={styles.progressLine} />
          {['Evidencia', 'Ubicación', 'Detalles'].map((label, index) => (
            <div key={label} style={styles.progressStep}>
              <span style={{ ...styles.progressBubble, background: index === 0 ? COLORS.blue : '#E8EEF7', color: index === 0 ? '#FFF' : '#74839A' }}>
                {index + 1}
              </span>
              <span style={{ ...styles.progressLabel, color: index === 0 ? COLORS.blue : '#7A8799' }}>{label}</span>
            </div>
          ))}
        </div>

        {estadoEnvio === 'EXITOSO' ? (
          <div style={styles.tarjetaConfirmacion}>
            <div style={styles.successCircle}><Icon name="check" size={31} /></div>
            <span style={styles.successKicker}>REPORTE REGISTRADO</span>
            <h2 style={styles.successTitle}>Todo listo.</h2>
            <p style={styles.successDescription}>{reporteResultado.mensaje}</p>

            <div style={styles.cajaResultado}>
              <div>
                <span style={styles.resultLabel}>N.° de reporte</span>
                <strong style={styles.resultValue}>{reporteResultado.id}</strong>
              </div>
              <div style={styles.priorityBox}>
                <span style={styles.resultLabel}>Prioridad</span>
                <strong style={styles.resultPriority}>{reporteResultado.prioridadSimulada}</strong>
              </div>
              <small style={styles.simulatedNote}>Resultado de prueba simulado</small>
            </div>

            <button onClick={() => window.location.reload()} style={styles.btnSecundario}>
              Realizar otro reporte
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} style={styles.formulario}>
            <section style={styles.seccion}>
              <div style={styles.sectionHeader}>
                <div>
                  <span style={styles.sectionKicker}>PASO 1</span>
                  <h2 style={styles.label}>Evidencia fotográfica</h2>
                </div>
                <span style={styles.sectionIcon}><Icon name="camera" size={19} /></span>
              </div>

              <p style={styles.sectionHelper}>Registra el estado del desperfecto con una fotografía.</p>

              <input
                type="file"
                accept="image/*"
                capture="environment"
                id="cameraInput"
                onChange={handleFotoChange}
                style={{ display: 'none' }}
              />

              <label htmlFor="cameraInput" style={styles.btnCamara}>
                <span style={styles.cameraIcon}><Icon name="camera" size={18} /></span>
                <span>{preview ? 'CAMBIAR FOTOGRAFÍA' : 'TOMAR FOTOGRAFÍA'}</span>
                <Icon name="arrow" size={16} />
              </label>

              {preview && (
                <div style={styles.previewBlock}>
                  <img src={preview} alt="Vista previa" style={styles.preview} />
                  <span style={styles.previewStatus}><Icon name="check" size={14} /> Fotografía cargada correctamente</span>
                </div>
              )}
            </section>

            <section style={styles.seccion}>
              <div style={styles.sectionHeader}>
                <div>
                  <span style={styles.sectionKicker}>PASO 2</span>
                  <h2 style={styles.label}>Ubicación automática</h2>
                </div>
                <span style={styles.sectionIcon}><Icon name="pin" size={19} /></span>
              </div>

              <p style={styles.sectionHelper}>No necesitas escribir una dirección: Bache 0 obtiene la posición del dispositivo.</p>

              {cargandoGps && (
                <div style={styles.gpsLoading}>
                  <span style={styles.loadingDot} />
                  <div>
                    <strong style={styles.statusStrong}>Obteniendo ubicación...</strong>
                    <span style={styles.statusText}>Espera unos segundos.</span>
                  </div>
                </div>
              )}

              {coords && (
                <div style={styles.gpsSuccess}>
                  <div style={styles.gpsTop}>
                    <span style={styles.gpsBadge}><Icon name="check" size={12} /> GPS activo</span>
                    <span style={styles.gpsSmall}>Ubicación obtenida</span>
                  </div>
                  <div style={styles.coordsBox}>
                    <span style={styles.coordsIcon}><Icon name="pin" size={16} /></span>
                    <div><span style={styles.coordLabel}>Latitud</span><strong style={styles.coordValue}>{coords.latitud.toFixed(4)}</strong></div>
                    <div><span style={styles.coordLabel}>Longitud</span><strong style={styles.coordValue}>{coords.longitud.toFixed(4)}</strong></div>
                  </div>
                </div>
              )}

              {errorGps && (
                <div style={styles.gpsError}>
                  <div>
                    <strong style={{ ...styles.statusStrong, color: COLORS.red }}>No pudimos obtener tu ubicación.</strong>
                    <span style={styles.statusText}>{errorGps}</span>
                  </div>
                  <button type="button" onClick={obtenerUbicacion} style={styles.btnReintentar}>Reintentar</button>
                </div>
              )}
            </section>

            <section style={styles.seccion}>
              <div style={styles.sectionHeader}>
                <div>
                  <span style={styles.sectionKicker}>PASO 3</span>
                  <h2 style={styles.label}>Detalles del reporte</h2>
                </div>
                <span style={styles.sectionIcon}><Icon name="file" size={19} /></span>
              </div>

              <p style={styles.sectionHelper}>Cuéntanos el contexto para ayudar a la municipalidad a priorizar el evento.</p>

              <FieldSelect
                label="Gravedad percibida"
                value={formData.gravedadCiudadano}
                onChange={(value) => setFormData({ ...formData, gravedadCiudadano: value })}
                options={['Baja', 'Media', 'Alta']}
                placeholder="Selecciona gravedad"
              />

              <FieldSelect
                label="¿Es muy concurrida la calle?"
                value={formData.concurrenciaVial}
                onChange={(value) => setFormData({ ...formData, concurrenciaVial: value })}
                options={['Baja', 'Media', 'Alta', 'Muy Alta']}
                placeholder="Selecciona concurrencia"
              />

              <FieldSelect
                label="Cercanía a infraestructura crítica"
                hint="(ej.: colegio, mall, salud)"
                value={formData.infraestructuraCritica}
                onChange={(value) => setFormData({ ...formData, infraestructuraCritica: value })}
                options={[
                  'Sin infraestructura crítica cercana',
                  'Cercano a colegio',
                  'Cercano a centro de salud municipal',
                  'Cercano a estación/terminal',
                  'Cercano a otra infraestructura relevante'
                ]}
                placeholder="Selecciona opción"
              />

              <div style={styles.fieldGroup}>
                <label style={styles.fieldLabel}>Clasificación vial estimada</label>
                <div style={styles.autoField}>
                  <span style={styles.autoIcon}><Icon name="road" size={16} /></span>
                  <div><span style={styles.autoLabel}>Determinada automáticamente</span><strong style={styles.autoValue}>{formData.clasificacionVial}</strong></div>
                </div>
              </div>

              <div style={styles.fieldGroup}>
                <label style={styles.fieldLabel}>Observación / descripción</label>
                <textarea
                  rows="4"
                  placeholder="Ej.: Bache profundo en calzada principal..."
                  value={formData.descripcion}
                  onChange={(e) => setFormData({ ...formData, descripcion: e.target.value })}
                  style={styles.textarea}
                />
                <span style={styles.inputHint}>Describe lo que observas en una o dos frases.</span>
              </div>
            </section>

            <div style={styles.submitArea}>
              <button
                type="submit"
                disabled={estadoEnvio !== 'IDLE'}
                style={{
                  ...styles.btnGuardar,
                  background: estadoEnvio === 'IDLE' ? 'linear-gradient(135deg, #0033A0 0%, #0B4CC6 100%)' : '#94A3B8',
                  boxShadow: estadoEnvio === 'IDLE' ? '0 12px 24px rgba(0, 51, 160, .24)' : 'none'
                }}
              >
                {estadoEnvio === 'IDLE' && <>ENVIAR REPORTE <Icon name="arrow" size={17} /></>}
                {estadoEnvio === 'ENVIANDO' && 'Enviando...'}
                {estadoEnvio === 'PROCESANDO' && 'Procesando...'}
              </button>
              <span style={styles.submitHint}>Tu ubicación forma parte del reporte y se obtiene automáticamente.</span>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}

function FieldSelect({ label, hint, value, onChange, options, placeholder }) {
  return (
    <div style={styles.fieldGroup}>
      <label style={styles.fieldLabel}>
        {label} {hint && <span style={styles.fieldHint}>{hint}</span>}
      </label>
      <div style={styles.selectWrap}>
        <select value={value} onChange={(e) => onChange(e.target.value)} style={styles.select}>
          <option value="" disabled>{placeholder}</option>
          {options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <span style={styles.selectArrow}>⌄</span>
      </div>
    </div>
  );
}

const styles = {
  escritorioContenedor: {
    minHeight: '100vh',
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '38px',
    boxSizing: 'border-box',
    background: 'linear-gradient(145deg, #F8FBFF 0%, #EAF2FD 100%)',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    color: COLORS.blueText
  },
  escritorioDecoracion: {
    position: 'absolute',
    inset: '-20% -10%',
    pointerEvents: 'none',
    opacity: 0.75,
    transform: 'rotate(-3deg)'
  },
  curve: {
    position: 'absolute',
    border: '7px solid rgba(0,51,160,.08)',
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderBottomColor: 'transparent',
    borderRadius: '50%',
    transform: 'rotate(13deg)'
  },
  escritorioTarjeta: {
    position: 'relative',
    zIndex: 2,
    width: 'min(1160px, 100%)',
    minHeight: '640px',
    display: 'grid',
    gridTemplateColumns: '1.02fr .98fr',
    borderRadius: '32px',
    overflow: 'hidden',
    background: 'rgba(255,255,255,.94)',
    border: '1px solid rgba(255,255,255,.96)',
    boxShadow: '0 28px 80px rgba(34,65,115,.16)'
  },
  desktopContent: {
    padding: '54px 52px 40px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center'
  },
  desktopKicker: {
    width: 'fit-content',
    padding: '7px 11px',
    marginBottom: '15px',
    borderRadius: '999px',
    background: '#EAF1FF',
    color: COLORS.blue,
    fontSize: '10px',
    fontWeight: 900,
    letterSpacing: '1.1px'
  },
  desktopLogo: { height: '46px', width: 'auto', objectFit: 'contain', alignSelf: 'flex-start', marginBottom: '19px' },
  desktopTitle: { margin: 0, maxWidth: '590px', fontSize: '40px', lineHeight: 1.09, letterSpacing: '-1.6px', fontWeight: 900, color: COLORS.blueText },
  desktopDescription: { maxWidth: '560px', margin: '20px 0 0', color: '#61738C', fontSize: '15px', lineHeight: 1.65 },
  desktopPromise: { display: 'flex', alignItems: 'center', gap: '12px', width: 'fit-content', marginTop: '22px', padding: '13px 15px', borderRadius: '16px', background: '#F8FBFF', border: `1px solid ${COLORS.border}` },
  promiseIcon: { width: '36px', height: '36px', display: 'grid', placeItems: 'center', borderRadius: '11px', background: '#EAF1FF', color: COLORS.blue },
  promiseTitle: { display: 'block', fontSize: '12px', color: COLORS.blueText },
  promiseText: { display: 'block', marginTop: '2px', fontSize: '10px', color: COLORS.muted },
  qrBlock: { display: 'flex', alignItems: 'center', gap: '19px', marginTop: '23px' },
  qrFrame: { width: '166px', height: '166px', flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: '19px', background: '#FFF', border: `1px solid ${COLORS.border}`, boxShadow: '0 14px 30px rgba(39,70,116,.09)' },
  qrImage: { width: '142px', height: '142px', objectFit: 'contain', borderRadius: '8px' },
  qrCopy: { display: 'flex', flexDirection: 'column', gap: '5px', maxWidth: '220px' },
  qrKicker: { fontSize: '10px', fontWeight: 900, letterSpacing: '1px', color: COLORS.blue },
  qrTitle: { fontSize: '15px', lineHeight: 1.25, color: COLORS.blueText },
  qrText: { fontSize: '11px', lineHeight: 1.5, color: COLORS.muted },
  desktopFooter: { display: 'flex', alignItems: 'center', gap: '8px', marginTop: '25px', color: '#7C8CA1', fontSize: '10px', fontWeight: 800, letterSpacing: '.7px', textTransform: 'uppercase' },
  footerRoad: { width: '23px', height: '23px', display: 'grid', placeItems: 'center', borderRadius: '8px', background: '#EEF4FF', color: COLORS.blue },
  desktopVisual: { position: 'relative', padding: '39px 39px 40px', background: 'linear-gradient(145deg, #F4F9FF 0%, #E6F0FD 100%)', borderLeft: `1px solid ${COLORS.border}`, display: 'flex', flexDirection: 'column', justifyContent: 'center' },
  visualBadge: { alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: '8px', marginBottom: '14px', padding: '7px 10px', borderRadius: '999px', background: '#FFF', border: `1px solid ${COLORS.border}`, color: '#50657F', fontSize: '9px', fontWeight: 900, letterSpacing: '.9px' },
  liveDot: { width: '7px', height: '7px', borderRadius: '50%', background: '#20A673', boxShadow: '0 0 0 4px rgba(32,166,115,.11)' },
  roadIllustration: { position: 'relative', width: '100%', height: '300px', overflow: 'hidden', borderRadius: '25px', background: 'linear-gradient(160deg, #EAF3FF 0%, #D6E6F8 100%)', border: '1px solid rgba(255,255,255,.9)', boxShadow: '0 16px 35px rgba(42,75,122,.12)' },
  roadGlowOne: { position: 'absolute', width: '300px', height: '300px', left: '-100px', top: '-60px', borderRadius: '50%', border: '22px solid rgba(0,51,160,.07)' },
  roadGlowTwo: { position: 'absolute', width: '370px', height: '190px', right: '-110px', bottom: '-60px', borderRadius: '50%', border: '18px solid rgba(251,203,5,.18)' },
  roadPathOne: { position: 'absolute', width: '150%', height: '160px', left: '-20%', bottom: '6px', borderTop: '75px solid rgba(105,126,155,.18)', borderRadius: '50% 50% 0 0', transform: 'rotate(-7deg)' },
  roadPathTwo: { position: 'absolute', width: '150%', height: '130px', left: '-30%', bottom: '32px', borderTop: '5px dashed rgba(255,255,255,.9)', borderRadius: '50%', transform: 'rotate(-7deg)' },
  roadPathThree: { position: 'absolute', width: '140%', height: '120px', left: '-20%', bottom: '18px', borderTop: '4px solid rgba(251,203,5,.8)', borderRadius: '50%', transform: 'rotate(-7deg)' },
  personHead: { position: 'absolute', width: '43px', height: '43px', left: '48%', top: '66px', borderRadius: '50%', background: '#F2C4A5', zIndex: 3, boxShadow: '0 -8px 0 #1C2940 inset' },
  personBody: { position: 'absolute', width: '85px', height: '126px', left: '39%', top: '104px', borderRadius: '35px 35px 15px 15px', background: '#1D5DB7', transform: 'rotate(3deg)', zIndex: 2 },
  personArm: { position: 'absolute', width: '83px', height: '15px', left: '49%', top: '130px', borderRadius: '99px', background: '#F2C4A5', transform: 'rotate(-24deg)', zIndex: 4, transformOrigin: 'left center' },
  personPhone: { position: 'absolute', width: '23px', height: '38px', left: '64%', top: '101px', borderRadius: '5px', background: '#152E68', border: '4px solid #FFF', transform: 'rotate(-10deg)', zIndex: 5 },
  pothole: { position: 'absolute', width: '108px', height: '45px', right: '14%', bottom: '51px', borderRadius: '50%', background: '#27384F', transform: 'rotate(-6deg)', zIndex: 2, boxShadow: '0 10px 0 rgba(39,56,79,.12)' },
  potholeInner: { position: 'absolute', width: '72px', height: '22px', right: '16.5%', bottom: '64px', borderRadius: '50%', background: '#101B2C', transform: 'rotate(-6deg)', zIndex: 3 },
  desktopSteps: { display: 'grid', gap: '9px', marginTop: '15px' },
  desktopStep: { display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 11px', borderRadius: '14px', background: '#FFF', border: `1px solid ${COLORS.border}` },
  stepIcon: { width: '31px', height: '31px', flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: '10px', background: '#EDF3FF', color: COLORS.blue },
  stepTitle: { display: 'block', fontSize: '11px', color: COLORS.blueText },
  stepText: { display: 'block', marginTop: '2px', fontSize: '9px', color: COLORS.muted },

  // Mobile
  contenedorMovil: { minHeight: '100vh', paddingBottom: '25px', background: `linear-gradient(180deg, ${COLORS.bg} 0%, #EDF2F8 100%)`, fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', color: '#223A5D' },
  header: { position: 'sticky', top: 0, zIndex: 10, padding: '13px 13px 16px', color: '#FFF', background: 'linear-gradient(135deg, #0033A0 0%, #0B4CC6 100%)', boxShadow: '0 10px 25px rgba(0,51,160,.20)' },
  headerRow: { display: 'grid', gridTemplateColumns: '34px 1fr 34px', alignItems: 'center', gap: '7px' },
  headerButton: { width: '31px', height: '31px', display: 'grid', placeItems: 'center', borderRadius: '10px', color: '#FFF', background: 'rgba(255,255,255,.08)' },
  mobileLogo: { justifySelf: 'center', width: 'auto', height: '32px', maxWidth: '170px', objectFit: 'contain' },
  headerSubtitle: { display: 'block', marginTop: '4px', textAlign: 'center', fontSize: '9px', fontWeight: 800, opacity: .86, letterSpacing: '.55px', textTransform: 'uppercase' },
  mobileMain: { width: '100%', maxWidth: '670px', margin: '0 auto', padding: '12px 11px 30px', boxSizing: 'border-box' },
  mobileIntro: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '16px 15px', marginBottom: '11px', background: '#FFF', border: `1px solid ${COLORS.border}`, borderRadius: '19px', boxShadow: '0 9px 22px rgba(27,52,91,.05)' },
  mobileKicker: { display: 'block', marginBottom: '4px', fontSize: '8px', fontWeight: 900, color: COLORS.blue, letterSpacing: '1.1px' },
  mobileTitle: { margin: 0, fontSize: '19px', lineHeight: 1.12, color: COLORS.blueText, fontWeight: 900, letterSpacing: '-.4px' },
  mobileText: { maxWidth: '430px', margin: '6px 0 0', fontSize: '11px', lineHeight: 1.45, color: '#718198' },
  mobileRoadIcon: { width: '44px', height: '44px', flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: '14px', background: '#EDF3FF', color: COLORS.blue },
  progress: { position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '4px', padding: '11px 8px 9px', marginBottom: '11px', background: 'rgba(255,255,255,.86)', border: `1px solid ${COLORS.border}`, borderRadius: '17px' },
  progressLine: { position: 'absolute', left: '15%', right: '15%', top: '24px', height: '2px', background: '#DDE6F2', zIndex: 0 },
  progressStep: { position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' },
  progressBubble: { width: '27px', height: '27px', display: 'grid', placeItems: 'center', borderRadius: '50%', border: '2px solid #FFF', fontSize: '10px', fontWeight: 900, boxShadow: '0 2px 6px rgba(31,57,95,.08)' },
  progressLabel: { fontSize: '9px', fontWeight: 800 },
  formulario: { display: 'flex', flexDirection: 'column', gap: '11px' },
  seccion: { padding: '17px 15px', background: '#FFF', border: `1px solid ${COLORS.border}`, borderRadius: '19px', boxShadow: '0 9px 22px rgba(28,53,94,.045)' },
  sectionHeader: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' },
  sectionKicker: { display: 'block', marginBottom: '3px', color: COLORS.blue, fontSize: '8px', fontWeight: 900, letterSpacing: '1.05px' },
  label: { margin: 0, fontSize: '16px', lineHeight: 1.2, fontWeight: 900, color: '#173B6B' },
  sectionIcon: { width: '36px', height: '36px', flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: '12px', background: '#EEF4FF', border: '1px solid #E1EAF7', color: COLORS.blue },
  sectionHelper: { margin: '6px 0 13px', color: COLORS.muted, fontSize: '10px', lineHeight: 1.5 },
  btnCamara: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '9px', minHeight: '48px', width: '100%', boxSizing: 'border-box', padding: '0 13px', borderRadius: '14px', cursor: 'pointer', background: 'linear-gradient(135deg,#0033A0 0%,#0B4CC6 100%)', color: '#FFF', fontSize: '11px', fontWeight: 900, letterSpacing: '.55px', boxShadow: '0 10px 20px rgba(0,51,160,.18)' },
  cameraIcon: { width: '29px', height: '29px', display: 'grid', placeItems: 'center', borderRadius: '9px', background: 'rgba(255,255,255,.10)' },
  previewBlock: { marginTop: '10px' },
  preview: { width: '100%', maxHeight: '230px', objectFit: 'cover', display: 'block', borderRadius: '14px', border: '1px solid #DDE6F1', boxShadow: '0 8px 18px rgba(20,48,86,.10)' },
  previewStatus: { display: 'inline-flex', alignItems: 'center', gap: '5px', marginTop: '7px', color: COLORS.green, fontSize: '9px', fontWeight: 800 },
  gpsLoading: { display: 'flex', alignItems: 'center', gap: '10px', padding: '12px', borderRadius: '13px', background: '#F8FBFF', border: `1px solid ${COLORS.border}` },
  loadingDot: { width: '10px', height: '10px', flexShrink: 0, borderRadius: '50%', background: COLORS.yellow, boxShadow: '0 0 0 5px rgba(251,203,5,.13)' },
  statusStrong: { display: 'block', fontSize: '10px', lineHeight: 1.3, color: '#34506F' },
  statusText: { display: 'block', marginTop: '2px', fontSize: '9px', lineHeight: 1.4, color: COLORS.muted },
  gpsSuccess: { padding: '12px', borderRadius: '14px', background: '#F8FBFF', border: '1px solid #DCE8F7' },
  gpsTop: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', marginBottom: '9px' },
  gpsBadge: { display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '5px 8px', borderRadius: '999px', background: '#E9FAF3', color: COLORS.green, fontSize: '8px', fontWeight: 900 },
  gpsSmall: { fontSize: '8px', color: '#7C8A9D', fontWeight: 700 },
  coordsBox: { display: 'grid', gridTemplateColumns: '33px 1fr 1fr', gap: '9px', alignItems: 'center', padding: '10px', borderRadius: '12px', background: '#FFF', border: `1px solid ${COLORS.border}` },
  coordsIcon: { width: '30px', height: '30px', display: 'grid', placeItems: 'center', borderRadius: '9px', color: COLORS.blue, background: '#EEF4FF' },
  coordLabel: { display: 'block', marginBottom: '2px', color: '#8492A4', fontSize: '8px', fontWeight: 700 },
  coordValue: { fontSize: '10px', color: '#29476B', fontWeight: 900 },
  gpsError: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', padding: '12px', borderRadius: '13px', background: '#FFF8F7', border: '1px solid #F1D8D4' },
  btnReintentar: { flexShrink: 0, padding: '8px 9px', borderRadius: '9px', background: '#FFF', border: '1px solid #E4BDB8', color: COLORS.red, fontSize: '9px', fontWeight: 900, cursor: 'pointer' },
  fieldGroup: { marginTop: '12px' },
  fieldLabel: { display: 'block', marginBottom: '6px', color: '#41556F', fontSize: '10px', lineHeight: 1.35, fontWeight: 800 },
  fieldHint: { color: '#8794A5', fontWeight: 500 },
  selectWrap: { position: 'relative' },
  select: { width: '100%', minHeight: '44px', padding: '0 36px 0 12px', boxSizing: 'border-box', borderRadius: '12px', border: `1px solid #DCE5F1`, background: '#F9FBFE', color: '#2B415D', fontSize: '10px', fontWeight: 700, outline: 'none', appearance: 'none', WebkitAppearance: 'none' },
  selectArrow: { position: 'absolute', right: '11px', top: '50%', transform: 'translateY(-55%)', color: '#73839A', fontSize: '16px', pointerEvents: 'none' },
  autoField: { display: 'flex', alignItems: 'center', gap: '9px', minHeight: '44px', padding: '7px 10px', boxSizing: 'border-box', borderRadius: '12px', background: '#F5F8FC', border: '1px solid #E0E7F0' },
  autoIcon: { width: '30px', height: '30px', flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: '9px', background: '#E9EFF7', color: '#74859A' },
  autoLabel: { display: 'block', fontSize: '8px', color: '#8A96A6' },
  autoValue: { display: 'block', marginTop: '2px', color: '#4E6179', fontSize: '10px' },
  textarea: { width: '100%', minHeight: '102px', padding: '11px 12px', boxSizing: 'border-box', resize: 'vertical', borderRadius: '12px', border: `1px solid #DCE5F1`, background: '#F9FBFE', color: '#2B415D', outline: 'none', fontFamily: 'inherit', fontSize: '10px', lineHeight: 1.5 },
  inputHint: { display: 'block', marginTop: '5px', color: '#8995A6', fontSize: '8px' },
  submitArea: { paddingTop: '1px' },
  btnGuardar: { width: '100%', minHeight: '51px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', border: 'none', borderRadius: '14px', color: '#FFF', fontSize: '11px', fontWeight: 900, letterSpacing: '.75px', cursor: 'pointer' },
  submitHint: { display: 'block', marginTop: '7px', textAlign: 'center', color: '#8793A4', fontSize: '8px' },

  // Confirmation
  tarjetaConfirmacion: { padding: '27px 16px 18px', background: '#FFF', border: `1px solid ${COLORS.border}`, borderRadius: '20px', textAlign: 'center', boxShadow: '0 12px 26px rgba(27,52,91,.06)' },
  successCircle: { width: '61px', height: '61px', margin: '0 auto 10px', display: 'grid', placeItems: 'center', borderRadius: '50%', color: COLORS.green, background: '#EAF9F3', border: '8px solid #F7FCF9' },
  successKicker: { color: COLORS.green, fontSize: '8px', fontWeight: 900, letterSpacing: '1px' },
  successTitle: { margin: '5px 0 4px', fontSize: '24px', lineHeight: 1.1, color: COLORS.blueText, fontWeight: 900 },
  successDescription: { maxWidth: '350px', margin: '0 auto', fontSize: '10px', color: COLORS.muted, lineHeight: 1.5 },
  cajaResultado: { display: 'grid', gridTemplateColumns: '1fr auto', gap: '12px', alignItems: 'end', margin: '18px 0', padding: '13px', borderRadius: '15px', background: '#F8FBFF', border: '1px solid #E0E9F5', textAlign: 'left' },
  resultLabel: { display: 'block', marginBottom: '3px', color: '#8794A8', fontSize: '8px', fontWeight: 700 },
  resultValue: { fontSize: '14px', color: '#274A72', fontWeight: 900 },
  priorityBox: { textAlign: 'right' },
  resultPriority: { fontSize: '14px', color: COLORS.red, fontWeight: 900 },
  simulatedNote: { gridColumn: '1 / -1', color: '#9AA5B4', fontSize: '8px' },
  btnSecundario: { width: '100%', minHeight: '47px', border: 'none', borderRadius: '13px', background: COLORS.yellow, color: '#18345F', fontSize: '10px', fontWeight: 900, cursor: 'pointer', boxShadow: '0 8px 18px rgba(251,203,5,.24)' }
};

// Ajustes geométricos para las líneas decorativas de escritorio.
styles.curveOne = { ...styles.curve, width: '760px', height: '760px', left: '-120px', top: '70px' };
styles.curveTwo = { ...styles.curve, width: '900px', height: '900px', left: '180px', top: '-120px' };
styles.curveThree = { ...styles.curve, width: '1050px', height: '650px', right: '-150px', bottom: '-180px' };
styles.curveFour = { ...styles.curve, width: '820px', height: '510px', right: '70px', bottom: '-80px', borderColor: 'rgba(251,203,5,.12)', borderLeftColor: 'transparent', borderRightColor: 'transparent' };
