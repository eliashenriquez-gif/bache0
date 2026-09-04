import logoEstacionCentral from "../assets/logo_ESTACIONCENTRAL.png";
import logoLaPintana from "../assets/logo_LAPINTANA.png";
import logoElBosque from "../assets/logo_ELBOSQUE.png";

export const MUNICIPIOS_DATA = {
  "estacion_central": {
    id: "estacion_central",
    nombre: "Municipalidad de Estación Central",
    subdominio: "estacioncentral.cl",
    logoTexto: "Estación Central",
    logoImg: logoEstacionCentral,
    centroMapa: [-33.4513, -70.6950],
    zoomMapa: 14,
  },
  "la_pintana": {
    id: "la_pintana",
    nombre: "Municipalidad de La Pintana",
    subdominio: "lapintana.cl",
    logoTexto: "La Pintana",
    logoImg: logoLaPintana,
    centroMapa: [-33.5828, -70.6346],
    zoomMapa: 14,
  },
  "el_bosque": {
    id: "el_bosque",
    nombre: "Municipalidad de El Bosque",
    subdominio: "elbosque.cl",
    logoTexto: "El Bosque",
    logoImg: logoElBosque,
    centroMapa: [-33.5785, -70.6720],
    zoomMapa: 14,
  }
};