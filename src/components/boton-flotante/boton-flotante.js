import './boton-flotante.css';

// Botón "+" flotante para ir al alta desde un listado (mesas, empleados,
// productos, etc). Arranca oculto: cada listado decide cuándo mostrarlo
// según si el rol logueado puede efectivamente dar de alta ahí.
export function crearBotonFlotante({ etiqueta = 'Agregar', onClick = () => {} } = {}) {
  const elemento = document.createElement('ion-fab');
  elemento.setAttribute('vertical', 'bottom');
  elemento.setAttribute('horizontal', 'end');
  elemento.setAttribute('slot', 'fixed');
  elemento.hidden = true;
  elemento.innerHTML = `<ion-fab-button aria-label="${etiqueta}">+</ion-fab-button>`;
  elemento.querySelector('ion-fab-button').addEventListener('click', onClick);

  return {
    elemento,
    mostrar() {
      elemento.hidden = false;
    },
  };
}
