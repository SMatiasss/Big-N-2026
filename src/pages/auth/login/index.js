import './index.css';
import { crearBotonIngresoRapido } from '../../../components/boton-ingreso-rapido/boton-ingreso-rapido.js';
import { CUENTAS_DEMO, PASSWORD_DEMO } from '../../../config/cuentas-demo.js';
import { signIn } from '../../../services/auth.service.js';
import { esCampoVacio, esEmailValido } from '../../../utils/validadores.js';
import { vibrarError } from '../../../utils/vibracion.js';
import { completarCredenciales } from '../../../utils/login-rapido.js';
import { navegarA, reemplazarRuta } from '../../../router.js';

const ICONO_CORREO = `<svg class="login__icono" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="2.5" y="4.5" width="19" height="15" rx="2.5"></rect><path d="m3 7 8.2 5.7a1.4 1.4 0 0 0 1.6 0L21 7"></path></svg>`;
const ICONO_CANDADO = `<svg class="login__icono" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2.5"></rect><path d="M8 10V7.5a4 4 0 0 1 8 0V10"></path></svg>`;
const ICONO_OJO = `<svg class="login__icono-ojo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><path d="M2 12s3.8-6.5 10-6.5S22 12 22 12s-3.8 6.5-10 6.5S2 12 2 12Z"></path><circle cx="12" cy="12" r="2.8"></circle><line class="login__icono-ojo-barra" x1="4" y1="20" x2="20" y2="4"></line></svg>`;

const MENSAJES_AUTH = {
  'Invalid login credentials': 'El correo o la contraseña no son correctos.',
  'Email not confirmed': 'Todavía falta confirmar el correo de esta cuenta.',
  'Failed to fetch': 'No se pudo conectar con el servidor. Revisá tu conexión.',
};

function mensajeDeError(error) {
  return MENSAJES_AUTH[error?.message] ?? error?.message ?? 'No se pudo iniciar sesión.';
}

function marcaHtml() {
  return `<header class="login__marca"><div class="login__logo"><img src="/assets/logo/Icono Big N.svg" alt=""></div><p class="login__marca-nombre">Big N</p></header>`;
}

export function render(container) {
  container.innerHTML = `
    <ion-page class="login"><ion-content><main class="login__contenido">
      ${marcaHtml()}
      <h1 class="login__titulo">Iniciar sesión</h1>
      <form class="login__formulario" id="form-login" novalidate>
        <div class="campo-formulario"><label for="email-login">Correo electrónico</label><div class="login__campo">${ICONO_CORREO}<input class="campo-control" id="email-login" name="email" type="email" inputmode="email" autocomplete="email" placeholder="usuario@correo.com" required></div></div>
        <div class="campo-formulario"><label for="password-login">Contraseña</label><div class="login__campo">${ICONO_CANDADO}<input class="campo-control campo-control--con-accion" id="password-login" name="password" type="password" autocomplete="current-password" placeholder="••••••••" required><button class="login__ver-password" type="button" aria-label="Mostrar contraseña">${ICONO_OJO}</button></div></div>
        <p class="login__registro"><span>¿No tenés cuenta?</span><button class="login__enlace" id="btn-registro" type="button">Registrate aquí</button></p>
        <ion-button class="login__submit" type="submit" expand="block">Iniciar sesión</ion-button>
      </form>
      <div class="login__separador"><span>Acceso rápido</span></div>
      <section class="login__demo" id="panel-demostracion">
        <p class="sr-only">Elegí un perfil para completar sus credenciales. La sesión comienza al presionar Iniciar sesión.</p>
        <div class="login__cuentas" role="group" aria-label="Perfiles de demostración"></div>
      </section>
      <ion-button class="login__anonimo" id="btn-ingreso-anonimo" expand="block">Ingresar como cliente anónimo</ion-button>
      <p class="login__error" id="mensaje-error" role="alert" aria-live="polite"></p>
    </main></ion-content></ion-page>`;

  const form = container.querySelector('#form-login');
  const mensajeError = container.querySelector('#mensaje-error');
  const inputEmail = form.querySelector('#email-login');
  const inputPassword = form.querySelector('#password-login');
  const botonIngresar = form.querySelector('ion-button[type="submit"]');
  const botonVerPassword = form.querySelector('.login__ver-password');
  const tarjetas = [];
  let enviando = false;

  for (const cuenta of CUENTAS_DEMO) {
    let tarjeta;
    tarjeta = crearBotonIngresoRapido({
      etiqueta: cuenta.etiqueta,
      email: cuenta.email,
      onClick: () => {
        if (enviando) return;
        completarCredenciales({ cuenta, password: PASSWORD_DEMO, inputEmail, inputPassword });
        tarjetas.forEach((otra) => otra.establecerActivo(otra === tarjeta));
        form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      },
    });
    tarjetas.push(tarjeta);
    container.querySelector('.login__cuentas').append(tarjeta.elemento);
  }

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
      await vibrarError(); return;
    }
    if (!esEmailValido(email)) {
      mensajeError.textContent = 'El email no es válido.';
      await vibrarError(); return;
    }
    establecerEnviando(true);
    try {
      await signIn(email, password);
      reemplazarRuta('/home');
    } catch (error) {
      mensajeError.textContent = mensajeDeError(error);
      await vibrarError();
      establecerEnviando(false);
    }
  }

  form.addEventListener('submit', (evento) => { evento.preventDefault(); void enviar(); });
  botonVerPassword.addEventListener('click', () => {
    const visible = inputPassword.type === 'text';
    inputPassword.type = visible ? 'password' : 'text';
    botonVerPassword.classList.toggle('login__ver-password--activo', !visible);
    botonVerPassword.setAttribute('aria-label', visible ? 'Mostrar contraseña' : 'Ocultar contraseña');
  });
  container.querySelector('#btn-registro').addEventListener('click', () => navegarA('/clientes/alta'));
  container.querySelector('#btn-ingreso-anonimo').addEventListener('click', () => navegarA('/ingreso-anonimo'));
}
