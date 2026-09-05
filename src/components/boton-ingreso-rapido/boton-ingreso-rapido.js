import './boton-ingreso-rapido.css';

// Tarjeta de acceso rápido a una de las cuentas de prueba del seed
// (ver config/cuentas-demo.js). El login arma una por cada rol y las muestra
// en una fila con scroll horizontal.
export function crearBotonIngresoRapido({ etiqueta, email, onClick = () => {} } = {}) {
  const elemento = document.createElement('button');
  elemento.type = 'button';
  elemento.className = 'boton-ingreso-rapido';
  // El mail completo no siempre entra en la tarjeta: queda en el title y en
  // la etiqueta accesible para que no se pierda al recortarse.
  elemento.title = email;
  elemento.setAttribute('aria-label', `Ingresar como ${etiqueta} (${email})`);
  elemento.setAttribute('aria-pressed', 'false');
  elemento.innerHTML = `
    <span class="boton-ingreso-rapido__avatar" aria-hidden="true">${etiqueta.charAt(0)}</span>
    <span class="boton-ingreso-rapido__rol">${etiqueta}</span>
    <span class="boton-ingreso-rapido__email">${email}</span>
  `;

  elemento.addEventListener('click', () => onClick({ etiqueta, email }));

  return {
    elemento,
    establecerActivo(valor) {
      const activo = Boolean(valor);
      elemento.classList.toggle('boton-ingreso-rapido--activo', activo);
      elemento.setAttribute('aria-pressed', String(activo));
    },
    establecerBloqueado(valor) {
      elemento.disabled = Boolean(valor);
    },
  };
}
