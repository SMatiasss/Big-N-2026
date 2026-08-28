// excluyente: login + botón cierre de sesión
import {
  obtenerPermisosProductos,
  signIn,
  signOut,
} from '../../../services/auth.service.js';
import { ROLES } from '../../../config/constantes.js';
import { getSupabase } from '../../../services/supabase.client.js';
import { esEmailValido, esCampoVacio } from '../../../utils/validadores.js';
import { vibrarError } from '../../../utils/vibracion.js';
import { navegarA } from '../../../router.js';

export async function render(container) {
  const {
    data: { session },
  } = await getSupabase().auth.getSession();

  if (session) {
    await renderSesionIniciada(container, session);
  } else {
    renderFormularioLogin(container);
  }
}

async function renderSesionIniciada(container, session) {
  container.innerHTML = `
    <ion-content>
      <h2>Sesión iniciada</h2>
      <p id="email-sesion"></p>
      <div id="acciones-demo-productos" hidden>
        <h3>Acciones de demo</h3>
        <p id="perfil-sesion"></p>
        <ion-button id="btn-alta-plato" expand="block" hidden>Alta de plato</ion-button>
        <ion-button id="btn-alta-bebida" expand="block" hidden>Alta de bebida</ion-button>
      </div>
      <ion-button id="btn-cerrar-sesion" color="danger">Cerrar sesión</ion-button>
      <div id="mensaje-error"></div>
    </ion-content>
  `;

  const mensajeError = container.querySelector('#mensaje-error');
  container.querySelector('#email-sesion').textContent = session.user.email ?? 'Cliente anónimo';

  try {
    const { rol, esJefe } = await obtenerPermisosProductos();
    const puedeCargarPlatos = rol === ROLES.COCINERO || esJefe;
    const puedeCargarBebidas = rol === ROLES.CANTINERO || esJefe;

    // Este menú facilita la demo; las policies de Supabase siguen autorizando cada operación.
    if (puedeCargarPlatos || puedeCargarBebidas) {
      container.querySelector('#acciones-demo-productos').hidden = false;
      container.querySelector('#perfil-sesion').textContent = `Perfil: ${rol}`;
    }

    if (puedeCargarPlatos) {
      const botonAltaPlato = container.querySelector('#btn-alta-plato');
      botonAltaPlato.hidden = false;
      botonAltaPlato.addEventListener('click', () => navegarA('/productos/alta-plato'));
    }

    if (puedeCargarBebidas) {
      const botonAltaBebida = container.querySelector('#btn-alta-bebida');
      botonAltaBebida.hidden = false;
      botonAltaBebida.addEventListener('click', () => navegarA('/productos/alta-bebida'));
    }
  } catch {
    mensajeError.textContent = 'No se pudieron cargar las acciones disponibles para el perfil.';
  }

  container.querySelector('#btn-cerrar-sesion').addEventListener('click', async () => {
    try {
      await signOut();
      render(container);
    } catch (error) {
      mensajeError.textContent = error.message;
      await vibrarError();
    }
  });
}

function renderFormularioLogin(container) {
  container.innerHTML = `
    <ion-content>
      <h2>Iniciar sesión</h2>
      <form id="form-login">
        <ion-input name="email" type="email" placeholder="Email" required></ion-input>
        <ion-input name="password" type="password" placeholder="Contraseña" required></ion-input>
        <ion-button type="submit">Ingresar</ion-button>
      </form>
      <ion-button id="btn-ingreso-anonimo" fill="clear">Ingresar como invitado</ion-button>
      <div id="mensaje-error"></div>
    </ion-content>
  `;

  const form = container.querySelector('#form-login');
  const mensajeError = container.querySelector('#mensaje-error');

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    mensajeError.textContent = '';

    const datos = new FormData(form);
    const email = datos.get('email');
    const password = datos.get('password');

    if (esCampoVacio(email) || esCampoVacio(password)) {
      mensajeError.textContent = 'Completá email y contraseña.';
      await vibrarError();
      return;
    }
    if (!esEmailValido(email)) {
      mensajeError.textContent = 'El email no es válido.';
      await vibrarError();
      return;
    }

    try {
      await signIn(email, password);
      render(container);
    } catch (error) {
      mensajeError.textContent = error.message;
      await vibrarError();
    }
  });

  container.querySelector('#btn-ingreso-anonimo').addEventListener('click', () => {
    navegarA('/ingreso-anonimo');
  });
}
