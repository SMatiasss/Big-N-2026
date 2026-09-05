import './index.css';
import { navegarA } from '../../../router.js';
import { crearLectorQr } from '../../../components/lector-qr/lector-qr.js';
import { crearSelectorAvatarFoto } from '../../../components/selector-avatar-foto/selector-avatar-foto.js';
import { ROLES, ROLES_EMPLEADO, ESTADOS_PERFIL,} from '../../../config/constantes.js';
import { signUp } from '../../../services/auth.service.js';
import { altaPerfil } from '../../../services/perfiles.service.js';
import { esCampoVacio, esCuilValido, esDniValido, esEmailValido, esNombrePersonaValido, obtenerErrorArchivoImagen } from '../../../utils/validadores.js';
import { mostrarToastError } from '../../../components/toast-error/toast-error.js';
import { mostrarToastNormal } from '../../../components/toast-normal/toast-normal.js';


const ROLES_DISPONIBLES = ROLES_EMPLEADO;


/* =========================================================
   ETIQUETAS DE ROLES
   ========================================================= */

const ETIQUETAS_ROL = {
  [ROLES.DUENO]: 'Dueño',
  [ROLES.SUPERVISOR]: 'Supervisor',
  [ROLES.METRE]: 'Metre',
  [ROLES.MOZO]: 'Mozo',
  [ROLES.COCINERO]: 'Cocinero',
  [ROLES.CANTINERO]: 'Cantinero',
};


/* =========================================================
   DATOS DEL FORMULARIO
   ========================================================= */

function datosFormulario(formulario) {
  return Object.fromEntries(
    [
      'nombre',
      'apellido',
      'dni',
      'cuil',
      'email',
      'password',
      'rol',
    ].map((campo) => {
      const control = formulario.querySelector(
        `#${campo}-empleado`
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

  if (!esCuilValido(datos.cuil)) {
    errores.cuil = 'Ingresá un CUIL válido de 11 dígitos.';
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

  if (!ROLES_DISPONIBLES.includes(datos.rol)) {
    errores.rol = 'Seleccioná un perfil válido.';
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
    'input, ion-select'
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

  /*
   * El número de trámite también puede tener 11 dígitos,
   * pero precede al DNI.
   *
   * El CUIL o su fragmento aparecen después del DNI.
   */

  const camposDespuesDelDni = campos.slice(
    indiceDni + 1
  );

  const cuilCompleto = camposDespuesDelDni.find(
    (valor) => /^\d{11}$/.test(valor)
  );

  const fragmentoCuil = camposDespuesDelDni.find(
    (valor) => /^\d{3}$/.test(valor)
  );

  const cuil =
    cuilCompleto ??
    (
      fragmentoCuil
        ? `${fragmentoCuil.slice(0, 2)}${campos[indiceDni]}${fragmentoCuil[2]}`
        : ''
    );

  if (cuil && !esCuilValido(cuil)) {
    throw new Error(
      'El código contiene un CUIL inválido.'
    );
  }

  return {
    nombre,
    apellido,
    dni: campos[indiceDni],
    cuil,
  };
}


/* =========================================================
   CARGAR VALOR EN CAMPO
   ========================================================= */

/*
 * Los campos de texto son inputs HTML nativos.
 *
 * Por eso no necesitamos acceder a Shadow DOM como
 * ocurría anteriormente con ion-input.
 *
 * Se actualiza el valor y se disparan los eventos
 * correspondientes para mantener el estado visual
 * y la validación del formulario.
 */

function cargarValorEnCampo(formulario, campo, valor) {
  const control = formulario.querySelector(
    `#${campo}-empleado`
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
  const opcionesRoles = ROLES_DISPONIBLES
    .map(
      (rol) =>
        `<ion-select-option value="${rol}">
          ${ETIQUETAS_ROL[rol] ?? rol}
        </ion-select-option>`
    )
    .join('');

  container.innerHTML = `
    <ion-page class="alta-empleado">

      <ion-content>

        <main class="alta-empleado__contenido">

          <header class="alta-empleado__introduccion">

            <button
              class="alta-empleado__volver"
              type="button"
              aria-label="Volver"
            >
              ‹
            </button>

            <h1>Agregar un empleado</h1>

          </header>


          <form
            class="alta-empleado__formulario"
            novalidate
          >

            <!-- FOTO -->

            <div class="alta-empleado__foto"></div>


            <!-- LECTOR DNI -->

            <div class="alta-empleado__lector-qr"></div>


            <!-- RESULTADO DEL ESCANEO -->

            <pre
              class="alta-empleado__resultado-escaneo"
              aria-live="polite"
              hidden
            ></pre>


            <!-- NOMBRES -->

            <div
              class="campo-formulario"
              data-campo="nombre"
            >

              <label for="nombre-empleado">
                Nombres
              </label>

              <input
                class="campo-control"
                id="nombre-empleado"
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

              <label for="apellido-empleado">
                Apellidos
              </label>

              <input
                class="campo-control"
                id="apellido-empleado"
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

              <label for="email-empleado">
                Correo electrónico
              </label>

              <input
                class="campo-control"
                id="email-empleado"
                name="email"
                type="email"
                inputmode="email"
                autocomplete="email"
                placeholder="usuario@bign.com"
                required
              >

              <ion-note
                color="danger"
                data-error="email"
              ></ion-note>

            </div>


            <!-- DNI / CUIL -->

            <div class="alta-empleado__fila">

              <div
                class="campo-formulario"
                data-campo="dni"
              >

                <label for="dni-empleado">
                  DNI
                </label>

                <input
                  class="campo-control"
                  id="dni-empleado"
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


              <div
                class="campo-formulario"
                data-campo="cuil"
              >

                <label for="cuil-empleado">
                  CUIL
                </label>

                <input
                  class="campo-control"
                  id="cuil-empleado"
                  name="cuil"
                  type="text"
                  inputmode="numeric"
                  maxlength="11"
                  autocomplete="off"
                  placeholder="20-12345678-9"
                  required
                >

                <ion-note
                  color="danger"
                  data-error="cuil"
                ></ion-note>

              </div>

            </div>


            <!-- CONTRASEÑA -->

            <div
              class="campo-formulario"
              data-campo="password"
            >

              <label for="password-empleado">
                Contraseña
              </label>

              <input
                class="campo-control"
                id="password-empleado"
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


            <!-- PERFIL -->

            <div
              class="campo-formulario alta-empleado__campo-rol"
              data-campo="rol"
            >

              <label for="rol-empleado">
                Perfil
              </label>

              <ion-select
                class="campo-control"
                id="rol-empleado"
                placeholder="Seleccioná un perfil"
                interface="popover"
                required
              >
                ${opcionesRoles}
              </ion-select>

              <ion-note
                color="danger"
                data-error="rol"
              ></ion-note>

            </div>


            <!-- RESULTADO -->

            <div
              class="alta-empleado__resultado"
              role="status"
              aria-live="polite"
              hidden
            ></div>


            <!-- GUARDAR -->

            <ion-button
              class="alta-empleado__submit"
              type="submit"
              expand="block"
            >
              Guardar Empleado
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
    '.alta-empleado__formulario'
  );

  const resultado = formulario.querySelector(
    '.alta-empleado__resultado'
  );

  const resultadoEscaneo = formulario.querySelector(
    '.alta-empleado__resultado-escaneo'
  );

  const botonGuardar = formulario.querySelector(
    '.alta-empleado__submit'
  );


  /* =========================================================
     NOTIFICACIÓN
     ========================================================= */

  function mostrarResultado(mensaje, tipo = 'exito') {
    resultado.textContent = mensaje;

    resultado.className =
      `alta-empleado__resultado alta-empleado__resultado--${tipo}`;

    resultado.hidden = false;
  }

  function ocultarResultado() {
    resultado.hidden = true;
    resultado.textContent = '';
    resultado.className = 'alta-empleado__resultado';
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
    .querySelector('.alta-empleado__volver')
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
      'cuil',
      'email',
      'password',
      'rol',
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
    .querySelector('.alta-empleado__foto')
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


        if (datosDniEscaneados.cuil) {

          mostrarToastNormal('Datos del DNI cargados. Revisalos antes de continuar.');

        } else {

          mostrarToastNormal('Datos cargados; completá el CUIL manualmente.');

        }


        actualizar();

      } catch (error) {

        mostrarToastError(error.message);

      }
    },
  });


  formulario
    .querySelector('.alta-empleado__lector-qr')
    .append(lector.elemento);


  /* =========================================================
     ROL PREDETERMINADO
     ========================================================= */

  formulario.querySelector(
    '#rol-empleado'
  ).value = ROLES.MOZO;


  /* =========================================================
     EVENTOS DE LOS CAMPOS
     ========================================================= */

  formulario
    .querySelectorAll('input, ion-select')
    .forEach((control) => {

      const evento =
        control.tagName === 'ION-SELECT'
          ? 'ionChange'
          : 'input';

      control.addEventListener(
        evento,
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

        await altaPerfil({
          id: user.id,
          apellidos: datos.apellido,
          nombres: datos.nombre,
          dni: datos.dni,
          cuil: datos.cuil,
          email: datos.email,
          foto_url: 'https://placehold.co/200x200/png?text=Empleado',
          rol: datos.rol,
          estado: ESTADOS_PERFIL.APROBADO,
        });

        mostrarToastNormal('Empleado creado y aprobado correctamente.');

        setTimeout(() => { navegarA('/login')}, 2000);

      } catch (error) {

        mostrarToastError(error.message ?? 'No se pudo crear el empleado.');

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
