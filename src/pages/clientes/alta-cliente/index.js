import './index.css';
import { navegarA } from '../../../router.js';
import { crearLectorQr } from '../../../components/lector-qr/lector-qr.js';
import { crearSelectorAvatarFoto } from '../../../components/selector-avatar-foto/selector-avatar-foto.js';
import { ROLES, ESTADOS_PERFIL } from '../../../config/constantes.js';
import { signUp } from '../../../services/auth.service.js';
import { altaPerfil, subirFotoPerfil } from '../../../services/perfiles.service.js';
import { enviarEmailPendiente } from '../../../services/email.service.js';
import { avisarNuevoClientePendiente } from '../../../services/notificaciones.service.js';
import { esCampoVacio, esDniValido, esEmailValido, esNombrePersonaValido, obtenerErrorArchivoImagen } from '../../../utils/validadores.js';
import { mostrarToastError } from '../../../components/toast-error/toast-error.js';
import { mostrarToastNormal } from '../../../components/toast-normal/toast-normal.js';


/* =========================================================
   DATOS DEL FORMULARIO
   ========================================================= */

function datosFormulario(formulario) {
  return Object.fromEntries(
    [
      'nombre',
      'apellido',
      'dni',
      'email',
      'password',
    ].map((campo) => {
      const control = formulario.querySelector(
        `#${campo}-cliente`
      );

      return [
        campo,
        control?.value?.trim() ?? '',
      ];
    })
  );
}


/* =========================================================
   VALIDACIONES
   ========================================================= */

function validar(datos, foto) {
  const errores = {};

  if (!esNombrePersonaValido(datos.nombre)) {
    errores.nombre = 'Ingresá un nombre válido.';
  }

  if (!esNombrePersonaValido(datos.apellido)) {
    errores.apellido = 'Ingresá un apellido válido.';
  }

  if (!esDniValido(datos.dni)) {
    errores.dni = 'El DNI debe tener 7 u 8 dígitos.';
  }

  if (!esEmailValido(datos.email)) {
    errores.email = 'Ingresá un correo electrónico válido.';
  }

  if (
    !/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(
      datos.password
    )
  ) {
    errores.password =
      'Usá al menos 8 caracteres, con mayúscula, minúscula y número.';
  }

  if (obtenerErrorArchivoImagen(foto)) {
    errores.foto =
      'Tomá una foto personal válida desde la cámara.';
  }

  return errores;
}


/* =========================================================
   MOSTRAR ERROR
   ========================================================= */

function mostrarError(formulario, campo, mensaje = '') {
  const contenedor = formulario.querySelector(
    `[data-campo="${campo}"]`
  );

  if (!contenedor) {
    return;
  }

  const control = contenedor.querySelector(
    'input'
  );

  const error = contenedor.querySelector(
    `[data-error="${campo}"]`
  );

  if (error) {
    error.textContent = mensaje;
  }

  contenedor.classList.toggle(
    'campo-formulario--invalido',
    Boolean(mensaje)
  );

  contenedor.classList.toggle(
    'campo-formulario--valido',
    !mensaje &&
    control &&
    !esCampoVacio(control.value)
  );

  if (control) {
    control.setAttribute(
      'aria-invalid',
      String(Boolean(mensaje))
    );
  }
}


/* =========================================================
   EXTRAER DATOS DEL DNI
   ========================================================= */

function extraerDatosDni(contenido) {
  const campos = String(contenido)
    .replace(/\*\*\/@/g, '@')
    .split('@')
    .map((valor) => valor.trim())
    .filter(Boolean);

  const indiceDni = campos.findIndex(esDniValido);

  if (indiceDni < 0) {
      throw new Error('DNI no encontrado en el código QR.');
  }

  const apellido = campos[indiceDni - 3];
  const nombre = campos[indiceDni - 2];

  if (
    indiceDni < 3 ||
    !esNombrePersonaValido(apellido) ||
    !esNombrePersonaValido(nombre)
  ) {
    throw new Error(
      'La lectura es inválida o está incompleta: faltan DNI, nombre o apellido.'
    );
  }

  return {
    nombre,
    apellido,
    dni: campos[indiceDni],
  };
}


/* =========================================================
   CARGAR VALOR EN CAMPO
   ========================================================= */

function cargarValorEnCampo(formulario, campo, valor) {
  const control = formulario.querySelector(
    `#${campo}-cliente`
  );

  if (!control) {
    return;
  }

  control.value = valor;

  control.dispatchEvent(
    new Event('input', {
      bubbles: true,
    })
  );

  control.dispatchEvent(
    new Event('change', {
      bubbles: true,
    })
  );
}


/* =========================================================
   RENDER
   ========================================================= */

export function render(container) {

  container.innerHTML = `
    <ion-page class="alta-cliente">

      <ion-content>

        <main class="alta-cliente__contenido">

          <header class="alta-cliente__introduccion">

            <button
              class="alta-cliente__volver"
              type="button"
              aria-label="Volver"
            >
              ‹
            </button>

            <h1>Alta Cliente</h1>

          </header>


          <form
            class="alta-cliente__formulario"
            novalidate
          >

            <!-- FOTO -->

            <div class="alta-cliente__foto"></div>


            <!-- LECTOR DNI -->

            <div class="alta-cliente__lector-qr"></div>


            <!-- RESULTADO DEL ESCANEO -->

            <pre
              class="alta-cliente__resultado-escaneo"
              aria-live="polite"
              hidden
            ></pre>


            <!-- NOMBRES -->

            <div
              class="campo-formulario"
              data-campo="nombre"
            >

              <label for="nombre-cliente">
                Nombres
              </label>

              <input
                class="campo-control"
                id="nombre-cliente"
                name="nombre"
                type="text"
                maxlength="80"
                autocomplete="given-name"
                placeholder="Ej. Juan Carlos"
                required
              >

              <ion-note
                color="danger"
                data-error="nombre"
              ></ion-note>

            </div>


            <!-- APELLIDOS -->

            <div
              class="campo-formulario"
              data-campo="apellido"
            >

              <label for="apellido-cliente">
                Apellidos
              </label>

              <input
                class="campo-control"
                id="apellido-cliente"
                name="apellido"
                type="text"
                maxlength="80"
                autocomplete="family-name"
                placeholder="Ej. Rodríguez"
                required
              >

              <ion-note
                color="danger"
                data-error="apellido"
              ></ion-note>

            </div>


            <!-- CORREO -->

            <div
              class="campo-formulario"
              data-campo="email"
            >

              <label for="email-cliente">
                Correo electrónico
              </label>

              <input
                class="campo-control"
                id="email-cliente"
                name="email"
                type="email"
                inputmode="email"
                autocomplete="email"
                placeholder="usuario@dominio.com"
                required
              >

              <ion-note
                color="danger"
                data-error="email"
              ></ion-note>

            </div>


            <!-- DNI -->

            <div class="alta-cliente__fila">

              <div
                class="campo-formulario"
                data-campo="dni"
              >

                <label for="dni-cliente">
                  DNI
                </label>

                <input
                  class="campo-control"
                  id="dni-cliente"
                  name="dni"
                  type="text"
                  inputmode="numeric"
                  maxlength="8"
                  autocomplete="off"
                  placeholder="12.345.678"
                  required
                >

                <ion-note
                  color="danger"
                  data-error="dni"
                ></ion-note>

              </div>

            </div>


            <!-- CONTRASEÑA -->

            <div
              class="campo-formulario"
              data-campo="password"
            >

              <label for="password-cliente">
                Contraseña
              </label>

              <input
                class="campo-control"
                id="password-cliente"
                name="password"
                type="password"
                autocomplete="new-password"
                placeholder="••••••••••"
                required
              >

              <ion-note
                color="danger"
                data-error="password"
              ></ion-note>

            </div>


            <!-- RESULTADO -->

            <div
              class="alta-cliente__resultado"
              role="status"
              aria-live="polite"
              hidden
            ></div>


            <!-- GUARDAR -->

            <ion-button
              class="alta-cliente__submit"
              type="submit"
              expand="block"
            >
              Guardar Cliente
            </ion-button>

          </form>

        </main>

      </ion-content>

    </ion-page>
  `;


  /* =========================================================
     REFERENCIAS
     ========================================================= */

  const formulario = container.querySelector(
    '.alta-cliente__formulario'
  );

  const resultado = formulario.querySelector(
    '.alta-cliente__resultado'
  );

  const resultadoEscaneo = formulario.querySelector(
    '.alta-cliente__resultado-escaneo'
  );

  const botonGuardar = formulario.querySelector(
    '.alta-cliente__submit'
  );


  /* =========================================================
     NOTIFICACIÓN
     ========================================================= */

  function mostrarResultado(mensaje, tipo = 'exito') {
    resultado.textContent = mensaje;

    resultado.className =
      `alta-cliente__resultado alta-cliente__resultado--${tipo}`;

    resultado.hidden = false;
  }

  function ocultarResultado() {
    resultado.hidden = true;
    resultado.textContent = '';
    resultado.className = 'alta-cliente__resultado';
  }


  /* =========================================================
     ESTADO
     ========================================================= */

  let foto = null;

  let datosDniEscaneados = null;

  let mostrarValidacion = false;

  let enviandoAlta = false;


  /* =========================================================
     VOLVER
     ========================================================= */

  container
    .querySelector('.alta-cliente__volver')
    .addEventListener('click', () => {
      window.history.back();
    });


  /* =========================================================
     ACTUALIZAR VALIDACIÓN
     ========================================================= */

  const actualizar = () => {
    if (!mostrarValidacion) {
      return;
    }

    const errores = validar(
      datosFormulario(formulario),
      foto
    );

    [
      'nombre',
      'apellido',
      'dni',
      'email',
      'password',
    ].forEach((campo) => {
      mostrarError(
        formulario,
        campo,
        errores[campo] ?? ''
      );
    });
  };


  /* =========================================================
     AVATAR
     ========================================================= */

  const avatar = crearSelectorAvatarFoto({
    onCambio(archivo) {
      foto = archivo;
      actualizar();
    },
  });

  formulario
    .querySelector('.alta-cliente__foto')
    .append(avatar.elemento);


  /*
   * Permite hacer click sobre la foto para abrir
   * la cámara, manteniendo el botón + como control.
   */

  const avatarPreview = avatar.elemento.querySelector(
    '.selector-avatar-foto__preview'
  );

  const avatarBoton = avatar.elemento.querySelector(
    'ion-button'
  );

  if (avatarPreview && avatarBoton) {
    avatarPreview.style.cursor = 'pointer';

    avatarPreview.addEventListener(
      'click',
      () => {
        avatarBoton.click();
      }
    );

    avatarBoton.addEventListener(
      'click',
      (evento) => {
        evento.stopPropagation();
      }
    );
  }


  /* =========================================================
     LECTOR QR
     ========================================================= */

  const lector = crearLectorQr({
    onLectura: async (contenido) => {

      resultadoEscaneo.hidden = false;

      resultadoEscaneo.textContent =
        `Resultado recibido del escáner:\n${contenido}`;

      try {

        datosDniEscaneados =
          extraerDatosDni(contenido);


        Object.entries(datosDniEscaneados)
          .filter(([, valor]) => valor)
          .forEach(([campo, valor]) => {

            cargarValorEnCampo(
              formulario,
              campo,
              valor
            );

          });

        mostrarToastNormal('Datos del DNI cargados. Revisalos antes de continuar.');

        actualizar();

      } catch (error) {

        mostrarToastError(error.message);

      }
    },
  });


  formulario
    .querySelector('.alta-cliente__lector-qr')
    .append(lector.elemento);


  /* =========================================================
     EVENTOS DE LOS CAMPOS
     ========================================================= */

  formulario
    .querySelectorAll('input')
    .forEach((control) => {

      control.addEventListener(
        'input',
        () => {

          actualizar();

          ocultarResultado();

        }
      );

    });


  /* =========================================================
     SUBMIT
     ========================================================= */

  formulario.addEventListener(
    'submit',
    async (evento) => {

      evento.preventDefault();

      if (enviandoAlta) {
        return;
      }

      mostrarValidacion = true;


      const errores = validar(
        datosFormulario(formulario),
        foto
      );


      actualizar();


      avatar.mostrarError(
        errores.foto ?? ''
      );


      if (Object.keys(errores).length) {

        mostrarToastError('Revisá los campos señalados antes de continuar.');

        return;
      }


      enviandoAlta = true;
      botonGuardar.disabled = true;

      try {
        const datos = datosFormulario(formulario);
        const { user } = await signUp(datos.email, datos.password);

        if (!user) {
          throw new Error('No se pudo obtener el usuario creado en Supabase Auth.');
        }

        const foto_url = await subirFotoPerfil(foto) || 'https://placehold.co/200x200/png?text=Cliente';

        await altaPerfil({
          id: user.id,
          apellidos: datos.apellido,
          nombres: datos.nombre,
          dni: datos.dni,
          email: datos.email,
          foto_url,
          rol: ROLES.CLIENTE_REGISTRADO,
          estado: ESTADOS_PERFIL.PENDIENTE,
        });

        // El backend obtiene la identidad desde el JWT y decide los destinatarios.
        // El cliente nunca envía IDs de empleados ni tokens de dispositivos.
        try {
          await avisarNuevoClientePendiente();
        } catch (errorPush) {
          console.error('El cliente se guardó, pero no se pudo confirmar el aviso push.', errorPush);
        }

        try {
          await enviarEmailPendiente({ id: user.id });
        } catch (errorMail) {
          console.error('El cliente se guardó, pero falló la función del correo:', errorMail);
        }

        mostrarToastNormal('Cliente registrado exitosamente. Queda pendiente de aprobación.');

        setTimeout(() => { navegarA('/login')}, 2000);

      } catch (error) {

        mostrarToastError(error.message ?? 'No se pudo crear el cliente.');

      } finally {
        enviandoAlta = false;
        botonGuardar.disabled = false;
      }

    }
  );


  /* =========================================================
     LIMPIEZA
     ========================================================= */

  window.addEventListener(
    'hashchange',
    () => {
      avatar.destruir();
    },
    { once: true }
  );
}
