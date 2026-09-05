// excluyente: login + botón cierre de sesión
import './index.css';
import {
  obtenerPermisos,
  obtenerPerfilActual,
  signIn,
  signOut,
} from '../../../services/auth.service.js';
import { crearBotonIngresoRapido } from '../../../components/boton-ingreso-rapido/boton-ingreso-rapido.js';
import { crearLectorQr } from '../../../components/lector-qr/lector-qr.js';
import { mostrarToastError } from '../../../components/toast-error/toast-error.js';
import { ETIQUETAS_ROL, ROLES } from '../../../config/constantes.js';
import { esEmpleado } from '../../../config/permisos.js';
import { puedeResolverClientes } from '../../../utils/acceso-perfil.js';
import { CUENTAS_DEMO, PASSWORD_DEMO } from '../../../config/cuentas-demo.js';
import { getSupabase } from '../../../services/supabase.client.js';
import { validarQrIngreso } from '../../../services/qr.service.js';
import { esEmailValido, esCampoVacio } from '../../../utils/validadores.js';
import { vibrarError } from '../../../utils/vibracion.js';
import { navegarA } from '../../../router.js';
import {
  iniciarPushAdministracion,
  iniciarPushListaEspera,
  iniciarPushCliente,
  borrarTokenActual,
} from '../../../services/notificaciones.service.js';

// El proyecto no usa librería de íconos (ver package.json): los tres del
// formulario van como SVG inline, así heredan el color del CSS de la pantalla.
const ICONO_CORREO = `
  <svg class="login__icono" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="2.5" y="4.5" width="19" height="15" rx="2.5"></rect>
    <path d="m3 7 8.2 5.7a1.4 1.4 0 0 0 1.6 0L21 7"></path>
  </svg>
`;

const ICONO_CANDADO = `
  <svg class="login__icono" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <rect x="4" y="10" width="16" height="11" rx="2.5"></rect>
    <path d="M8 10V7.5a4 4 0 0 1 8 0V10"></path>
  </svg>
`;

const ICONO_OJO = `
  <svg class="login__icono-ojo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M2 12s3.8-6.5 10-6.5S22 12 22 12s-3.8 6.5-10 6.5S2 12 2 12Z"></path>
    <circle cx="12" cy="12" r="2.8"></circle>
    <line class="login__icono-ojo-barra" x1="4" y1="20" x2="20" y2="4"></line>
  </svg>
`;

// Supabase Auth devuelve sus errores en inglés; acá se traducen los que el
// usuario puede llegar a ver de verdad y el resto se muestra tal cual.
const MENSAJES_AUTH = {
  'Invalid login credentials': 'El correo o la contraseña no son correctos.',
  'Email not confirmed': 'Todavía falta confirmar el correo de esta cuenta.',
  'Failed to fetch': 'No se pudo conectar con el servidor. Revisá tu conexión.',
};

function mensajeDeError(error) {
  return MENSAJES_AUTH[error?.message] ?? error?.message ?? 'No se pudo iniciar sesión.';
}

function marcaHtml() {
  return `
    <header class="login__marca">
      <div class="login__logo">
        <img src="/assets/logo/Icono Big N.svg" alt="" aria-hidden="true">
      </div>
      <p class="login__marca-nombre">Big N</p>
    </header>
  `;
}

// Cada llamada a render() toma un número de generación. Si mientras se espera
// una consulta asincrónica (getSession, obtenerPermisos) arranca OTRA
// llamada a render() -por el motivo que sea: doble submit, doble invocación al
// arrancar la app, etc.-, la ejecución vieja lo detecta y no vuelve a tocar el
// DOM; sólo la más nueva termina de construir la pantalla. Así se evita la
// duplicación de botones sin depender de adivinar cada disparador posible.
let generacionRender = 0;

export async function render(container) {
  const generacion = ++generacionRender;
  const {
    data: { session },
  } = await getSupabase().auth.getSession();

  if (generacion !== generacionRender) return;

  if (session) {
    await renderSesionIniciada(container, session, generacion);
  } else {
    renderFormularioLogin(container);
  }
}

async function renderSesionIniciada(container, session, generacion) {
  container.innerHTML = `
    <ion-page class="login">
      <ion-content>
        <main class="login__contenido">
          ${marcaHtml()}

          <section class="login__sesion">
            <h1 class="login__titulo">Sesión iniciada</h1>
            <p class="login__sesion-email" id="email-sesion"></p>
            <p class="login__sesion-rol" id="perfil-sesion"></p>
          </section>

          <section id="acciones-demo-productos" hidden>
            <div class="login__separador"><span>Acciones disponibles</span></div>
            <div class="login__acciones" id="botones-acciones"></div>
            <div id="ingreso-local-qr"></div>
          </section>

          <ion-button class="login__cerrar" id="btn-cerrar-sesion" expand="block" fill="clear">Cerrar sesión</ion-button>
          <p class="login__error" id="mensaje-error" role="alert" aria-live="polite"></p>
        </main>
      </ion-content>
    </ion-page>
  `;

  const mensajeError = container.querySelector('#mensaje-error');
  container.querySelector('#email-sesion').textContent = session.user.email ?? 'Cliente anónimo';

  try {
    let permisos;
    let perfil;

    // En un arranque en frío la red y la sesión nativa pueden terminar de
    // estabilizarse unos instantes después de que aparece el WebView.
    for (let intento = 0; intento < 3; intento += 1) {
      try {
        [permisos, perfil] = await Promise.all([obtenerPermisos(), obtenerPerfilActual()]);
        break;
      } catch (error) {
        if (intento === 2) throw error;
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    const { rol } = permisos;
    if (generacion !== generacionRender) return;

    // Todo el staff ve todas las pantallas de gestión: las policies de lectura
    // usan es_empleado(), y el botón de alta de cada pantalla se decide
    // adentro de ella (ver config/permisos.js), no en este menú.
    const esStaff = esEmpleado(rol);
    // Un cliente registrado (ya aprobado, HU06-08) no pasa por el formulario
    // de ingreso anónimo: entra directo al QR de ingreso al local y de ahí a
    // la lista de espera, igual que el anónimo pero sin pedirle nombre/foto
    // de nuevo (esos datos ya los cargó al registrarse).
    const puedeIngresarAlLocal = rol === ROLES.CLIENTE_REGISTRADO;

    // Este menú facilita la demo; las policies de Supabase siguen autorizando cada operación.
    // Cada botón se crea (y por lo tanto sólo existe en el DOM) si el rol lo permite: usar el
    // atributo "hidden" sobre un ion-button ya creado no alcanza, porque el propio CSS del
    // componente fija su "display" y termina pisando la regla nativa de "hidden".
    const contenedorBotones = container.querySelector('#botones-acciones');

    function agregarBotonAccion(id, texto, ruta) {
      const boton = document.createElement('ion-button');
      boton.id = id;
      boton.className = 'login__accion';
      boton.setAttribute('expand', 'block');
      boton.textContent = texto;
      boton.addEventListener('click', () => navegarA(ruta));
      contenedorBotones.append(boton);
    }

    if (esStaff || puedeIngresarAlLocal) {
      container.querySelector('#acciones-demo-productos').hidden = false;
      container.querySelector('#perfil-sesion').textContent = ETIQUETAS_ROL[rol] ?? rol;
    }
    void iniciarPushAdministracion(perfil).catch((error) => {
      console.error('No se pudieron iniciar los avisos de clientes pendientes.', error);
    });
    // HU09: el metre necesita el push de "nuevo cliente en espera".
    void iniciarPushListaEspera(perfil).catch((error) => {
      console.error('No se pudieron iniciar los avisos de lista de espera.', error);
    });
    // HU10: un cliente registrado que vuelve a loguearse (por ejemplo tras
    // cerrar la app) también necesita poder recibir el push de mesa asignada.
    // El cliente anónimo se registra aparte, en ingreso-anonimo, porque nunca
    // pasa por esta pantalla con sesión ya iniciada.
    void iniciarPushCliente(perfil).catch((error) => {
      console.error('No se pudieron iniciar los avisos de mesa asignada.', error);
    });

    if (esStaff) {
      agregarBotonAccion('btn-productos', 'Productos', '/productos');
      agregarBotonAccion('btn-empleados', 'Empleados', '/empleados');
      agregarBotonAccion('btn-mesas', 'Mesas', '/mesas');
      agregarBotonAccion('btn-lista-espera', 'Lista de espera', '/lista-espera/metre');
    }

    // La gestión de clientes no es una acción general del staff: sólo el dueño
    // o un supervisor activo y aprobado pueden aceptar o rechazar solicitudes.
    if (puedeResolverClientes(perfil)) {
      agregarBotonAccion('btn-clientes', 'Clientes', '/clientes/aprobacion');
    }

    if (puedeIngresarAlLocal) {
      const contenedorQr = container.querySelector('#ingreso-local-qr');
      const botonIngresoLocal = document.createElement('ion-button');
      botonIngresoLocal.id = 'btn-ingreso-local';
      botonIngresoLocal.className = 'login__accion';
      botonIngresoLocal.setAttribute('expand', 'block');
      botonIngresoLocal.textContent = 'Ingresar al local';

      // A diferencia de los botones de arriba, éste no navega: abre el
      // lector de QR ahí mismo (mismo patrón que ingreso-anonimo) y recién
      // al validar el código cambia de pantalla hacia /lista-espera.
      botonIngresoLocal.addEventListener('click', () => {
        botonIngresoLocal.hidden = true;

        const lector = crearLectorQr({
          titulo: 'Escaneá el QR de la entrada',
          descripcion: 'Es el código que está en la puerta del local.',
          textoBoton: 'Escanear código',
          nombreObjeto: 'código',
          onLectura: async (contenido) => {
            try {
              const esValido = await validarQrIngreso(contenido);
              if (!esValido) {
                mostrarToastError('Ese código no es el de ingreso al local. Probá de nuevo.');
                return;
              }
              navegarA('/lista-espera');
            } catch (error) {
              mostrarToastError(`No se pudo validar el código: ${error.message ?? 'error desconocido'}`);
            }
          },
        });
        contenedorQr.append(lector.elemento);
      });

      contenedorBotones.append(botonIngresoLocal);
    }
  } catch {
    mensajeError.textContent = 'No se pudieron cargar las acciones disponibles para el perfil.';
  }

  container.querySelector('#btn-cerrar-sesion').addEventListener('click', async () => {
    try {
      await borrarTokenActual().catch(() => {});
      await signOut();
      render(container);
    } catch (error) {
      mensajeError.textContent = mensajeDeError(error);
      await vibrarError();
    }
  });
}

function renderFormularioLogin(container) {
  container.innerHTML = `
    <ion-page class="login">
      <ion-content>
        <main class="login__contenido">
          ${marcaHtml()}

          <h1 class="login__titulo">Iniciar Sesión</h1>
          <p class="login__subtitulo">Iniciá sesión para continuar</p>

          <form class="login__formulario" id="form-login" novalidate>
            <div class="campo-formulario">
              <label for="email-login">Correo electrónico</label>
              <div class="login__campo">
                ${ICONO_CORREO}
                <input
                  class="campo-control"
                  id="email-login"
                  name="email"
                  type="email"
                  inputmode="email"
                  autocomplete="email"
                  placeholder="usuario@correo.com"
                  required
                >
              </div>
            </div>

            <div class="campo-formulario">
              <label for="password-login">Contraseña</label>
              <div class="login__campo">
                ${ICONO_CANDADO}
                <input
                  class="campo-control campo-control--con-accion"
                  id="password-login"
                  name="password"
                  type="password"
                  autocomplete="current-password"
                  placeholder="••••••••••"
                  required
                >
                <button class="login__ver-password" type="button" aria-label="Mostrar contraseña">
                  ${ICONO_OJO}
                </button>
              </div>
            </div>

            <p class="login__registro">
              ¿No tenés cuenta?
              <button class="login__enlace" id="btn-registro" type="button">Registrate aquí</button>
            </p>

            <ion-button class="login__submit" type="submit" expand="block">Iniciar sesión</ion-button>
          </form>

          <div class="login__separador"><span>Acceso rápido</span></div>
          <div class="login__cuentas" role="group" aria-label="Cuentas de prueba"></div>

          <ion-button class="login__anonimo" id="btn-ingreso-anonimo" expand="block">Ingresar como cliente anónimo</ion-button>

          <p class="login__error" id="mensaje-error" role="alert" aria-live="polite"></p>
        </main>
      </ion-content>
    </ion-page>
  `;

  const form = container.querySelector('#form-login');
  const mensajeError = container.querySelector('#mensaje-error');
  const inputEmail = form.querySelector('#email-login');
  const inputPassword = form.querySelector('#password-login');
  const botonIngresar = form.querySelector('ion-button[type="submit"]');
  const botonVerPassword = form.querySelector('.login__ver-password');
  // ion-button[type="submit"] dentro de un form a veces dispara "submit" dos
  // veces por un mismo click (manejo interno de Ionic + comportamiento nativo
  // del botón). Esta bandera evita que el segundo dispare un signIn/render
  // por duplicado (que en renderSesionIniciada terminaba duplicando botones).
  let enviando = false;

  /* ---- Acceso rápido: una tarjeta por cuenta de prueba del seed ---- */

  const contenedorCuentas = container.querySelector('.login__cuentas');
  const tarjetas = CUENTAS_DEMO.map((cuenta) => {
    const tarjeta = crearBotonIngresoRapido({
      etiqueta: cuenta.etiqueta,
      email: cuenta.email,
      onClick: () => usarCuentaDemo(cuenta, tarjeta),
    });
    contenedorCuentas.append(tarjeta.elemento);
    return tarjeta;
  });

  function usarCuentaDemo(cuenta, tarjeta) {
    if (enviando) return;
    inputEmail.value = cuenta.email;
    inputPassword.value = PASSWORD_DEMO;
    tarjetas.forEach((otra) => otra.establecerActivo(otra === tarjeta));
    enviar();
  }

  /* ---- Envío ---- */

  function establecerEnviando(valor) {
    enviando = valor;
    botonIngresar.disabled = valor;
    tarjetas.forEach((tarjeta) => tarjeta.establecerBloqueado(valor));
  }

  async function enviar() {
    if (enviando) return;

    mensajeError.textContent = '';

    const email = inputEmail.value;
    const password = inputPassword.value;

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

    establecerEnviando(true);

    try {
      await signIn(email, password);
      render(container);
    } catch (error) {
      mensajeError.textContent = mensajeDeError(error);
      await vibrarError();
      establecerEnviando(false);
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    enviar();
  });

  botonVerPassword.addEventListener('click', () => {
    const seVeía = inputPassword.type === 'text';
    inputPassword.type = seVeía ? 'password' : 'text';
    botonVerPassword.classList.toggle('login__ver-password--activo', !seVeía);
    botonVerPassword.setAttribute('aria-label', seVeía ? 'Mostrar contraseña' : 'Ocultar contraseña');
  });

  container.querySelector('#btn-registro').addEventListener('click', () => {
    navegarA('/clientes/alta');
  });

  container.querySelector('#btn-ingreso-anonimo').addEventListener('click', () => {
    navegarA('/ingreso-anonimo');
  });
}
