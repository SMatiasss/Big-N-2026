import './index.css';
import { navegarA } from '../../../router.js';
import { crearLectorQr } from '../../../components/lector-qr/lector-qr.js';
import { crearSelectorAvatarFoto } from '../../../components/selector-avatar-foto/selector-avatar-foto.js';
import { ROLES, ROLES_EMPLEADO, ESTADOS_PERFIL } from '../../../config/constantes.js';
import { registrarUsuarioSinIniciarSesion } from '../../../services/auth.service.js';
import { altaPerfil, buscarConflictosPerfil, subirFotoPerfil } from '../../../services/perfiles.service.js';
import { errorCuil, esCampoVacio, esCuilValido, esDniValido, esEmailValido, esNombrePersonaValido, obtenerErrorArchivoImagen } from '../../../utils/validadores.js';
import { mostrarToastError } from '../../../components/toast-error/toast-error.js';
import { mostrarToastNormal } from '../../../components/toast-normal/toast-normal.js';
import { crearAppHeader } from '../../../components/app-header/app-header.js';
import { ajustarFormulario } from '../../../components/lista-ajustada/lista-ajustada.js';
import { mensajeDeErrorAlta } from '../../../utils/errores-alta.js';


const ROLES_DISPONIBLES = ROLES_EMPLEADO;

//test
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
      'confirmarPassword',
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
    errores.dni = 'DNI de 7 u 8 dígitos.';
  }

  // Dice por qué lo rechaza (largo, prefijo, DNI o dígito verificador), y
  // compara con el DNI cargado: el CUIL es prefijo + DNI + verificador.
  const motivoCuil = errorCuil(datos.cuil, datos.dni);
  if (motivoCuil) {
    errores.cuil = motivoCuil;
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
      'Mín. 8 caracteres, con mayúscula, minúscula y número.';
  }

  if (!datos.confirmarPassword) {
    errores.confirmarPassword = 'Repetí la contraseña.';
  } else if (datos.confirmarPassword !== datos.password) {
    errores.confirmarPassword = 'Las contraseñas no coinciden.';
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

        <div data-header></div>

        <main class="alta-empleado__contenido">

          <form
            class="alta-empleado__formulario"
            novalidate
          >

            <!-- FOTO Y LECTOR DNI, lado a lado -->

            <div class="alta-empleado__medios">
              <div class="alta-empleado__foto"></div>
              <div class="alta-empleado__lector-qr"></div>
            </div>


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
                class="texto-error"
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
                class="texto-error"
                data-error="apellido"
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
                  class="texto-error"
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
                  class="texto-error"
                  data-error="cuil"
                ></ion-note>

              </div>

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
                class="texto-error"
                data-error="rol"
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
                class="texto-error"
                data-error="email"
              ></ion-note>

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
                class="texto-error"
                data-error="password"
              ></ion-note>

            </div>


            <!-- CONFIRMAR CONTRASEÑA -->

            <div
              class="campo-formulario"
              data-campo="confirmarPassword"
            >

              <label for="confirmarPassword-empleado">
                Confirmar contraseña
              </label>

              <input
                class="campo-control"
                id="confirmarPassword-empleado"
                name="confirmarPassword"
                type="password"
                autocomplete="new-password"
                placeholder="••••••••••"
                required
              >

              <ion-note
                class="texto-error"
                data-error="confirmarPassword"
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

  /* Errores que sólo conoce la base (DNI/CUIL/correo ya usados). Van aparte
     de validar(), que mira nada más el contenido del formulario, y se
     limpian campo por campo apenas se edita ese campo. */
  let conflictosServidor = {};


  /* =========================================================
     VOLVER
     ========================================================= */

  const header = crearAppHeader({
    titulo: 'Agregar un empleado',
    onVolver: () => navegarA('/empleados'),
  });
  container.querySelector('[data-header]').append(header);


  /* =========================================================
     ACTUALIZAR VALIDACIÓN
     ========================================================= */

  const actualizar = () => {
    if (!mostrarValidacion) {
      return;
    }

    const errores = {
      ...validar(datosFormulario(formulario), foto),
      ...conflictosServidor,
    };

    [
      'nombre',
      'apellido',
      'dni',
      'cuil',
      'email',
      'password',
      'confirmarPassword',
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
     AJUSTE DE ALTO

     Recién acá (con la foto y el lector de DNI ya insertados: son los que
     le dan su alto real a esos recuadros) tiene sentido medir. Antes,
     ".alta-empleado__foto"/"__lector-qr" están vacíos y miden 0.
     ========================================================= */

  const ajusteFormulario = ajustarFormulario(
    container.querySelector('.alta-empleado__contenido'),
    { variable: '--ae-ajuste' },
  );


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

          /* Si el dueño corrige el campo que la base rechazó, el aviso deja
             de aplicar: el valor ya no es el que chocaba. */
          const campo = control.id.replace('-empleado', '');

          if (conflictosServidor[campo]) {
            const { [campo]: _descartado, ...resto } = conflictosServidor;
            conflictosServidor = resto;
          }

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

      const datos = datosFormulario(formulario);

      try {

        /* — 1. Unicidad contra la base, ANTES de crear nada —
         *
         * Acá estaba el problema: el alta creaba el usuario de Auth y recién
         * después insertaba el perfil. Si ese INSERT rebotaba (DNI o CUIL ya
         * usados) el usuario de Auth quedaba creado igual, y desde el cliente
         * no hay forma de borrarlo. Ese correo quedaba quemado para siempre:
         * el siguiente intento, con todo corregido, seguía respondiendo "el
         * correo ya está registrado" y no había manera de salir del paso.
         *
         * Consultando primero, el caso normal ni siquiera llega a Auth.
         */

        const conflictos = await buscarConflictosPerfil({
          dni: datos.dni,
          cuil: datos.cuil,
          email: datos.email,
        });

        if (Object.keys(conflictos).length) {

          conflictosServidor = {
            ...(conflictos.dni && { dni: 'Ese DNI ya está registrado.' }),
            ...(conflictos.cuil && { cuil: 'Ese CUIL ya está registrado.' }),
            ...(conflictos.email && { email: 'Ese correo ya está registrado.' }),
          };

          actualizar();

          mostrarToastError('Revisá los campos señalados antes de continuar.');

          return;
        }


        /* — 2. La foto antes que el usuario —
         *
         * Si falla la subida, no quedó creado ningún usuario y el correo
         * sigue libre para reintentar.
         */

        const fotoUrl = await subirFotoPerfil(foto);


        /* — 3. Usuario de Auth —
         *
         * No se usa signUp(): ése inicia sesión con el usuario recién creado y
         * dejaría al dueño logueado como el empleado nuevo, con el INSERT del
         * perfil rebotando por RLS (el nuevo usuario todavía no tiene rol).
         */

        const { user } = await registrarUsuarioSinIniciarSesion(datos.email, datos.password);

        if (!user) {
          throw new Error('No se pudo obtener el usuario creado en Supabase Auth.');
        }


        /* — 4. Perfil — */

        await altaPerfil({
          id: user.id,
          apellidos: datos.apellido,
          nombres: datos.nombre,
          dni: datos.dni,
          cuil: datos.cuil,
          email: datos.email,
          foto_url: fotoUrl,
          rol: datos.rol,
          estado: ESTADOS_PERFIL.APROBADO,
        });

        mostrarToastNormal('Empleado creado y aprobado correctamente.');

        setTimeout(() => { navegarA('/empleados')}, 2000);

      } catch (error) {

        mostrarToastError(mensajeDeErrorAlta(error, {
          marcarCampo: (campo, mensaje) => {
            conflictosServidor = { ...conflictosServidor, [campo]: mensaje };
            actualizar();
          },
        }));

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
      ajusteFormulario.destruir();
    },
    { once: true }
  );
}
