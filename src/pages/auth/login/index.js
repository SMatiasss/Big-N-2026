// excluyente: login + botón cierre de sesión
import { signIn, signOut } from '../../../services/auth.service.js';
import { getSupabase } from '../../../services/supabase.client.js';
import { esEmailValido, esCampoVacio } from '../../../utils/validadores.js';
import { vibrarError } from '../../../utils/vibracion.js';
import { navegarA } from '../../../router.js';

export async function render(container) {
  const {
    data: { session },
  } = await getSupabase().auth.getSession();

  if (session) {
    renderSesionIniciada(container, session);
  } else {
    renderFormularioLogin(container);
  }
}

function renderSesionIniciada(container, session) {
  container.innerHTML = `
    <ion-content>
      <h2>Sesión iniciada</h2>
      <p>${session.user.email ?? 'Cliente anónimo'}</p>
      <ion-button id="btn-cerrar-sesion" color="danger">Cerrar sesión</ion-button>
      <div id="mensaje-error"></div>
    </ion-content>
  `;

  const mensajeError = container.querySelector('#mensaje-error');
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
