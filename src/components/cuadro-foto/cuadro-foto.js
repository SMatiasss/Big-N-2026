import './cuadro-foto.css';

// Ícono de cámara compartido por todos los selectores de foto que usan el
// diseño de "cuadro-foto" (recuadro punteado + cámara centrada). Se expone
// como string para que cada componente lo inserte donde le corresponda.
export const ICONO_CAMARA_SVG = `
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
    <circle cx="12" cy="13" r="4"></circle>
  </svg>
`;
