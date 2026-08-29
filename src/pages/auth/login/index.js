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
        <div id="botones-acciones"></div>
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
    const puedeDarAltaEmpleados = rol === ROLES.DUENO || rol === ROLES.SUPERVISOR;
    const puedeDarAltaMesa = rol === ROLES.DUENO || rol === ROLES.SUPERVISOR;

    // Este menú facilita la demo; las policies de Supabase siguen autorizando cada operación.
    // Cada botón se crea (y por lo tanto sólo existe en el DOM) si el rol lo permite: usar el
    // atributo "hidden" sobre un ion-button ya creado no alcanza, porque el propio CSS del
    // componente fija su "display" y termina pisando la regla nativa de "hidden".
    const contenedorBotones = container.querySelector('#botones-acciones');

    function agregarBotonAccion(id, texto, ruta) {
      const boton = document.createElement('ion-button');
      boton.id = id;
      boton.setAttribute('expand', 'block');
      boton.textContent = texto;
      boton.addEventListener('click', () => navegarA(ruta));
      contenedorBotones.append(boton);
    }

    if (puedeCargarPlatos || puedeCargarBebidas || puedeDarAltaEmpleados || puedeDarAltaMesa) {
      container.querySelector('#acciones-demo-productos').hidden = false;
      container.querySelector('#perfil-sesion').textContent = `Perfil: ${rol}`;
    }

    if (puedeCargarPlatos) agregarBotonAccion('btn-alta-plato', 'Alta de plato', '/productos/alta-plato');
    if (puedeCargarBebidas) agregarBotonAccion('btn-alta-bebida', 'Alta de bebida', '/productos/alta-bebida');
    if (puedeDarAltaEmpleados) agregarBotonAccion('btn-alta-empleado', 'Alta de empleado', '/empleados/alta-empleado');
    if (puedeDarAltaMesa) agregarBotonAccion('btn-alta-mesa', 'Alta de mesa', '/mesas/alta');
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
