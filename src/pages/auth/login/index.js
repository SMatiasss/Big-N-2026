// excluyente: login + botón cierre de sesión
import {
  obtenerPermisosProductos,
  signIn,
  signOut,
  verificarAccesoSesion,
} from '../../../services/auth.service.js';
import { crearLectorQr } from '../../../components/lector-qr/lector-qr.js';
import { mostrarToastError } from '../../../components/toast-error/toast-error.js';
import { ROLES, ROLES_EMPLEADO } from '../../../config/constantes.js';
import { validarQrIngreso } from '../../../services/qr.service.js';
import { esEmailValido, esCampoVacio } from '../../../utils/validadores.js';
import { vibrarError } from '../../../utils/vibracion.js';
import { navegarA } from '../../../router.js';

// Cada llamada a render() toma un número de generación. Si mientras se espera
// una consulta asincrónica (getSession, obtenerPermisosProductos) arranca OTRA
// llamada a render() -por el motivo que sea: doble submit, doble invocación al
// arrancar la app, etc.-, la ejecución vieja lo detecta y no vuelve a tocar el
// DOM; sólo la más nueva termina de construir la pantalla. Así se evita la
// duplicación de botones sin depender de adivinar cada disparador posible.
let generacionRender = 0;

export async function render(container) {
  const generacion = ++generacionRender;
  let session;
  try {
    session = await verificarAccesoSesion();
  } catch (error) {
    if (generacion !== generacionRender) return;
    renderFormularioLogin(container);
    container.querySelector('#mensaje-error').textContent = error.message;
    return;
  }

  if (generacion !== generacionRender) return;

  if (session) {
    await renderSesionIniciada(container, session, generacion);
  } else {
    renderFormularioLogin(container);
  }
}

async function renderSesionIniciada(container, session, generacion) {
  container.innerHTML = `
    <ion-content>
      <h2>Sesión iniciada</h2>
      <p id="email-sesion"></p>
      <div id="acciones-demo-productos" hidden>
        <h3>Acciones de demo</h3>
        <p id="perfil-sesion"></p>
        <div id="botones-acciones"></div>
        <div id="ingreso-local-qr"></div>
      </div>
      <ion-button id="btn-cerrar-sesion" color="danger">Cerrar sesión</ion-button>
      <div id="mensaje-error"></div>
    </ion-content>
  `;

  const mensajeError = container.querySelector('#mensaje-error');
  container.querySelector('#email-sesion').textContent = session.user.email ?? 'Cliente anónimo';

  try {
    const { rol, esJefe } = await obtenerPermisosProductos();
    if (generacion !== generacionRender) return;

    const puedeCargarPlatos = rol === ROLES.COCINERO || esJefe;
    const puedeCargarBebidas = rol === ROLES.CANTINERO || esJefe;
    const puedeDarAltaEmpleados = rol === ROLES.DUENO || rol === ROLES.SUPERVISOR;
    // El listado de mesas lo puede ver cualquier trabajador; quién puede dar de
    // alta una mesa se decide adentro de ese listado (botón "+"), no acá.
    const puedeVerMesas = ROLES_EMPLEADO.includes(rol);
    // Un cliente registrado (ya aprobado, HU06-08) no pasa por el formulario
    // de ingreso anónimo: entra directo al QR de ingreso al local y de ahí a
    // la lista de espera, igual que el anónimo pero sin pedirle nombre/foto
    // de nuevo (esos datos ya los cargó al registrarse).
    const puedeIngresarAlLocal = rol === ROLES.CLIENTE_REGISTRADO;
    // El panel de asignación es tarea del metre (punto 10); dueño/supervisor
    // también pueden entrar a mirarlo/gestionarlo, como en el resto de los paneles.
    const puedeVerListaEspera = rol === ROLES.METRE || esJefe;

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

    if (puedeCargarPlatos || puedeCargarBebidas || puedeDarAltaEmpleados || puedeVerMesas || puedeIngresarAlLocal || puedeVerListaEspera) {
      container.querySelector('#acciones-demo-productos').hidden = false;
      container.querySelector('#perfil-sesion').textContent = `Perfil: ${rol}`;
    }

    if (puedeCargarPlatos) agregarBotonAccion('btn-alta-plato', 'Alta de plato', '/productos/alta-plato');
    if (puedeCargarBebidas) agregarBotonAccion('btn-alta-bebida', 'Alta de bebida', '/productos/alta-bebida');
    if (puedeDarAltaEmpleados) agregarBotonAccion('btn-empleados', 'Empleados', '/empleados');
    if (puedeDarAltaEmpleados) agregarBotonAccion('btn-clientes-pendientes', 'Clientes pendientes', '/clientes/aprobacion');
    if (puedeVerMesas) agregarBotonAccion('btn-mesas', 'Mesas', '/mesas');
    if (rol === ROLES.MOZO) agregarBotonAccion('btn-consultas', 'Consultas de clientes', '/pedidos/consulta');
    if (puedeVerListaEspera) agregarBotonAccion('btn-lista-espera', 'Lista de espera', '/lista-espera/metre');

    if (puedeIngresarAlLocal) {
      const contenedorQr = container.querySelector('#ingreso-local-qr');
      const botonIngresoLocal = document.createElement('ion-button');
      botonIngresoLocal.id = 'btn-ingreso-local';
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
  const botonIngresar = form.querySelector('ion-button[type="submit"]');
  // ion-button[type="submit"] dentro de un form a veces dispara "submit" dos
  // veces por un mismo click (manejo interno de Ionic + comportamiento nativo
  // del botón). Esta bandera evita que el segundo dispare un signIn/render
  // por duplicado (que en renderSesionIniciada terminaba duplicando botones).
  let enviando = false;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (enviando) return;

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

    enviando = true;
    botonIngresar.disabled = true;

    try {
      await signIn(email, password);
      render(container);
    } catch (error) {
      mensajeError.textContent = error.message;
      await vibrarError();
      enviando = false;
      botonIngresar.disabled = false;
    }
  });

  container.querySelector('#btn-ingreso-anonimo').addEventListener('click', () => {
    navegarA('/ingreso-anonimo');
  });
}
