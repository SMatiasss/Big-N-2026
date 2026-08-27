// Esta página importa su estilo, el selector reutilizable y validadores puros.
// Los módulos ES permiten mantener cada responsabilidad en un archivo separado.
import './index.css';
import { crearSelectorFotosProducto } from '../../../components/selector-fotos-producto/selector-fotos-producto.js';
import { SECTORES, TIPOS_PRODUCTO } from '../../../config/constantes.js';
import { crearPlatoCompleto } from '../../../services/productos.service.js';
import {
  esCampoVacio,
  esEnteroPositivo,
  esNumeroPositivo,
  esTextoObligatorioValido,
  hayCantidadExactaDeImagenes,
} from '../../../utils/validadores.js';

const CANTIDAD_FOTOS = 3;

// Valida los datos ingresados antes de aceptar el formulario.
// Recibe un objeto con los campos y el array de tres imágenes.
// Devuelve un objeto cuyas propiedades contienen los errores encontrados.
function validarFormulario(datos, imagenes) {
  const errores = {};

  if (!esTextoObligatorioValido(datos.nombre)) {
    errores.nombre = 'Ingresá el nombre del plato.';
  }

  if (!esTextoObligatorioValido(datos.descripcion)) {
    errores.descripcion = 'Ingresá una descripción del plato.';
  }

  if (esCampoVacio(datos.tiempo)) {
    errores.tiempo = 'Ingresá el tiempo de elaboración.';
  } else if (!esEnteroPositivo(datos.tiempo)) {
    errores.tiempo = 'El tiempo debe ser un número entero mayor que 0.';
  }

  if (esCampoVacio(datos.precio)) {
    errores.precio = 'Ingresá el precio del plato.';
  } else if (!esNumeroPositivo(datos.precio)) {
    errores.precio = 'El precio debe ser un número mayor que 0.';
  }

  if (!hayCantidadExactaDeImagenes(imagenes, CANTIDAD_FOTOS)) {
    errores.imagenes = 'Seleccioná las tres imágenes del plato.';
  }

  return errores;
}

// Lee los valores actuales de los componentes Ionic y elimina espacios
// innecesarios en los campos de texto.
function obtenerDatosFormulario(formulario) {
  return {
    nombre: formulario.querySelector('#nombre-plato').value?.trim() ?? '',
    descripcion: formulario.querySelector('#descripcion-plato').value?.trim() ?? '',
    tiempo: formulario.querySelector('#tiempo-plato').value ?? '',
    precio: formulario.querySelector('#precio-plato').value ?? '',
  };
}

// Actualiza el mensaje y el aspecto visual de un campo.
// El DOM es la representación de los elementos HTML disponibles en pantalla.
function mostrarErrorCampo(formulario, campo, mensaje = '') {
  const item = formulario.querySelector(`[data-campo="${campo}"]`);
  const nota = formulario.querySelector(`[data-error="${campo}"]`);
  const control = item.querySelector('ion-input, ion-textarea');
  const hayError = Boolean(mensaje);

  nota.textContent = mensaje;
  item.classList.toggle('campo-formulario--invalido', hayError);
  item.classList.toggle('campo-formulario--valido', !hayError && !esCampoVacio(control.value));
  control.setAttribute('aria-invalid', String(hayError));
}

// Presenta todos los errores junto a sus controles y devuelve true
// cuando el formulario completo es válido.
function mostrarResultadoValidacion(formulario, selectorFotos, errores) {
  ['nombre', 'descripcion', 'tiempo', 'precio'].forEach((campo) => {
    mostrarErrorCampo(formulario, campo, errores[campo] ?? '');
  });

  selectorFotos.mostrarError(errores.imagenes ?? '');
  return Object.keys(errores).length === 0;
}

// Renderiza la interfaz de HU02 dentro del contenedor que entrega el router.
// También conecta los eventos y conserva el estado temporal de la pantalla.
export function render(container) {
  container.innerHTML = `
    <ion-page class="alta-plato">
      <ion-header>
        <ion-toolbar color="primary">
          <ion-title>Alta de plato</ion-title>
        </ion-toolbar>
      </ion-header>

      <ion-content>
        <main class="alta-plato__contenido">
          <header class="alta-plato__introduccion">
            <h1>Nuevo plato</h1>
            <p>Completá los datos y agregá tres fotos para presentar el plato.</p>
          </header>

          <form class="alta-plato__formulario" novalidate>
            <div class="campo-formulario" data-campo="nombre">
              <ion-item>
                <ion-input id="nombre-plato" label="Nombre" label-placement="stacked" type="text" maxlength="80" required></ion-input>
              </ion-item>
              <ion-note color="danger" data-error="nombre" aria-live="polite"></ion-note>
            </div>

            <div class="campo-formulario" data-campo="descripcion">
              <ion-item>
                <ion-textarea id="descripcion-plato" label="Descripción" label-placement="stacked" maxlength="300" auto-grow="true" required></ion-textarea>
              </ion-item>
              <ion-note color="danger" data-error="descripcion" aria-live="polite"></ion-note>
            </div>

            <div class="alta-plato__fila-numerica">
              <div class="campo-formulario" data-campo="tiempo">
                <ion-item>
                  <ion-input id="tiempo-plato" label="Tiempo (minutos)" label-placement="stacked" type="number" inputmode="numeric" min="1" step="1" required></ion-input>
                </ion-item>
                <ion-note color="danger" data-error="tiempo" aria-live="polite"></ion-note>
              </div>

              <div class="campo-formulario" data-campo="precio">
                <ion-item>
                  <ion-input id="precio-plato" label="Precio" label-placement="stacked" type="number" inputmode="decimal" min="0.01" step="0.01" required></ion-input>
                </ion-item>
                <ion-note color="danger" data-error="precio" aria-live="polite"></ion-note>
              </div>
            </div>

            <div class="alta-plato__fotos"></div>

            <ion-note class="alta-plato__resultado" aria-live="polite"></ion-note>

            <ion-button class="alta-plato__submit" type="submit" expand="block">
              <ion-spinner name="crescent" aria-hidden="true"></ion-spinner>
              <span>Registrar plato</span>
            </ion-button>
          </form>
        </main>
      </ion-content>
    </ion-page>
  `;

  const formulario = container.querySelector('.alta-plato__formulario');
  const botonSubmit = formulario.querySelector('.alta-plato__submit');
  const textoSubmit = botonSubmit.querySelector('span');
  const resultado = formulario.querySelector('.alta-plato__resultado');

  // Este array es el estado de las imágenes de la página. Sus tres posiciones
  // se mantienen fijas aunque una foto sea reemplazada.
  const imagenes = Array(CANTIDAD_FOTOS).fill(null);
  let enviando = false;
  let validacionMostrada = false;

  // La página recibe archivos mediante onCambio, sin conocer si provienen de
  // un input local o, en una etapa futura, de Camera/Gallery.
  const selectorFotos = crearSelectorFotosProducto({
    onCambio(indice, archivo) {
      imagenes[indice] = archivo;

      if (validacionMostrada) {
        const errores = validarFormulario(obtenerDatosFormulario(formulario), imagenes);
        selectorFotos.mostrarError(errores.imagenes ?? '');
      }
    },
  });

  formulario.querySelector('.alta-plato__fotos').append(selectorFotos.elemento);

  // Habilita o bloquea toda acción de envío y selección de fotos.
  // Así se evita que el usuario dispare dos submits al mismo tiempo.
  function establecerProcesando(valor) {
    enviando = valor;
    botonSubmit.disabled = valor;
    botonSubmit.classList.toggle('alta-plato__submit--procesando', valor);
    textoSubmit.textContent = valor ? 'Registrando...' : 'Registrar plato';
    selectorFotos.establecerBloqueado(valor);
  }

  // Después del primer submit, cada cambio vuelve a validar su campo para
  // que el error desaparezca apenas el usuario lo corrija.
  formulario.querySelectorAll('ion-input, ion-textarea').forEach((control) => {
    control.addEventListener('ionInput', () => {
      if (!validacionMostrada) return;

      const datos = obtenerDatosFormulario(formulario);
      const errores = validarFormulario(datos, imagenes);
      const campo = control.closest('[data-campo]').dataset.campo;
      mostrarErrorCampo(formulario, campo, errores[campo] ?? '');
      resultado.textContent = '';
      resultado.className = 'alta-plato__resultado';
    });
  });

  // submit es el evento del formulario. preventDefault evita que el navegador
  // recargue la página y permite controlar la validación con JavaScript.
  formulario.addEventListener('submit', async (evento) => {
    evento.preventDefault();
    if (enviando) return;

    validacionMostrada = true;
    const datos = obtenerDatosFormulario(formulario);
    const errores = validarFormulario(datos, imagenes);
    const esValido = mostrarResultadoValidacion(formulario, selectorFotos, errores);

    if (!esValido) {
      resultado.textContent = 'Revisá los campos señalados antes de continuar.';
      resultado.className = 'alta-plato__resultado alta-plato__resultado--error';
      return;
    }

    establecerProcesando(true);
    resultado.textContent = '';
    resultado.className = 'alta-plato__resultado';

    try {
      // La página sólo arma los datos válidos. El service encapsula el INSERT,
      // Storage, producto_fotos, limpieza y consulta final de verificación.
      // La validación del perfil cocina todavía depende de las policies existentes;
      // su comprobación visual queda pendiente porque Auth/Perfiles están fuera de alcance.
      // Se envían únicamente columnas que existen en el esquema real de productos;
      // los campos administrados por la base se omiten para usar sus valores por defecto.
      const platoCreado = await crearPlatoCompleto({
        nombre: datos.nombre,
        descripcion: datos.descripcion,
        tiempo_elaboracion_min: Number(datos.tiempo),
        precio: Number(datos.precio),
        tipo: TIPOS_PRODUCTO.PLATO,
        // Todo plato se elabora en cocina; el rol que autoriza el alta es "cocinero".
        sector: SECTORES.COCINA,
      }, imagenes);

      resultado.textContent = `Plato registrado correctamente. ID verificado: ${platoCreado.id}`;
      resultado.className = 'alta-plato__resultado alta-plato__resultado--exito';
    } catch (error) {
      console.error('No se pudo completar el alta del plato.', error);
      resultado.textContent = `No se pudo registrar el plato: ${error.message ?? 'error desconocido'}`;
      resultado.className = 'alta-plato__resultado alta-plato__resultado--error';
    } finally {
      // finally se ejecuta tanto en éxito como en error y garantiza que la
      // interfaz vuelva a habilitarse después de la operación asincrónica.
      establecerProcesando(false);
    }
  });

  // El router actual no ofrece un ciclo de destrucción. Escuchamos un solo cambio
  // de ruta para liberar los previews cuando el usuario abandona esta pantalla.
  window.addEventListener('hashchange', () => selectorFotos.destruir(), { once: true });
}
