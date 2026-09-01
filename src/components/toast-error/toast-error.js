import './toast-error.css';

// Cartel flotante con un único botón de confirmación. Reemplaza el uso de
// alert() nativo (excluyente del TP) tanto para errores como para confirmar
// el resultado de un alta. Se monta directo en document.body porque es un
// overlay: no depende de dónde esté parado el código que lo llama.
// onCerrar se dispara al tocar el botón (por ejemplo, para volver al listado
// después de un alta exitosa); en un error alcanza con no pasarlo y listo.
export function mostrarToast({ mensaje, tipo = 'error', textoBoton = 'OK', onCerrar = () => {} } = {}) {
  const el = document.createElement('div');
  el.className = `toast-error toast-error--${tipo}`;
  el.setAttribute('role', 'alertdialog');
  el.setAttribute('aria-live', 'assertive');
  el.innerHTML = `
    <div class="toast-error__tarjeta">
      <p class="toast-error__mensaje"></p>
      <ion-button class="toast-error__boton" expand="block">${textoBoton}</ion-button>
    </div>
  `;
  el.querySelector('.toast-error__mensaje').textContent = mensaje;

  function cerrar() {
    el.remove();
    onCerrar();
  }

  el.querySelector('.toast-error__boton').addEventListener('click', cerrar);
  document.body.append(el);

  return cerrar;
}
