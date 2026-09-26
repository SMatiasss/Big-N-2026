import './index.css';
import { navegarA } from '../../../router.js';
import { crearAppHeader } from '../../../components/app-header/app-header.js';
import { crearLectorQr } from '../../../components/lector-qr/lector-qr.js';
import { crearSelectorAvatarFoto } from '../../../components/selector-avatar-foto/selector-avatar-foto.js';
import { ROLES, ESTADOS_PERFIL } from '../../../config/constantes.js';
import { obtenerPermisos, signUp } from '../../../services/auth.service.js';
import { altaPerfil, buscarConflictosPerfil, subirFotoPerfil } from '../../../services/perfiles.service.js';
import { enviarEmailPendiente } from '../../../services/email.service.js';
import { avisarNuevoClientePendiente } from '../../../services/notificaciones.service.js';
import { esCampoVacio, esDniValido, esEmailValido, esNombrePersonaValido, obtenerErrorArchivoImagen } from '../../../utils/validadores.js';
import { mostrarToastError } from '../../../components/toast-error/toast-error.js';
import { mostrarToastNormal } from '../../../components/toast-normal/toast-normal.js';
import { ajustarFormulario } from '../../../components/lista-ajustada/lista-ajustada.js';
import { mensajeDeErrorAlta } from '../../../utils/errores-alta.js';


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
      'confirmarPassword',
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
      'Mín. 8 caracteres, con mayúscula, minúscula y número.';
  }

  if (!datos.confirmarPassword) {
    errores.confirmarPassword = 'Repetí la contraseña.';
  } else if (datos.confirmarPassword !== datos.password) {
    errores.confirmarPassword = 'Las contraseñas no coinciden.';
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

        <div data-header></div>

        <main class="alta-cliente__contenido">

          <form
            class="alta-cliente__formulario"
            novalidate
          >

            <!-- FOTO Y LECTOR DNI, lado a lado -->

            <!-- La foto va sola y centrada, como pide el TP. -->
            <div class="alta-cliente__medios">
              <div class="alta-cliente__foto"></div>
            </div>


            <!-- RESULTADO DEL ESCANEO -->

            <pre
              class="alta-cliente__resultado-escaneo"
              aria-live="polite"
              hidden
            ></pre>


            <!-- NOMBRES Y APELLIDOS: uno al lado del otro, para dejarle
                 más alto a la foto. -->

            <div class="alta-cliente__fila">

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
                class="texto-error"
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
                class="texto-error"
                data-error="apellido"
              ></ion-note>

            </div>

            </div>


            <!-- DNI -->

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
                class="texto-error"
                data-error="dni"
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
                class="texto-error"
                data-error="email"
              ></ion-note>

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
                class="texto-error"
                data-error="password"
              ></ion-note>

            </div>


            <!-- CONFIRMAR CONTRASEÑA -->

            <div
              class="campo-formulario"
              data-campo="confirmarPassword"
            >

              <label for="confirmarPassword-cliente">
                Confirmar contraseña
              </label>

              <input
                class="campo-control"
                id="confirmarPassword-cliente"
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
              class="alta-cliente__resultado"
              role="status"
              aria-live="polite"
              hidden
            ></div>


            <!-- ESCANEAR DNI: botón propio arriba de Guardar (antes era un
                 recuadro al lado de la foto). -->

            <div class="alta-cliente__lector-qr"></div>


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

  /* Errores que sólo conoce la base (DNI o correo ya usados). Van aparte de
     validar(), que mira nada más el contenido del formulario, y se limpian
     campo por campo apenas se edita ese campo. */
  let conflictosServidor = {};


  /* =========================================================
     HEADER

     Esta pantalla se comparte entre dos entradas distintas: "Crear una
     cuenta" del login (sin sesión, el cliente se registra a sí mismo) y el
     "+" del metre en Clientes (con sesión, da de alta a otra persona). El
     título por default corresponde al caso sin sesión; si hay una sesión de
     metre activa, se corrige apenas se confirma.

     Los dos títulos son cortos a propósito: "Registrar un cliente nuevo"
     entraba en dos líneas y ese renglón de más era lo que empujaba el
     formulario hasta provocar scroll. Al cambiarlos, conviene que ambos
     sigan cayendo en el mismo tramo de largo (12 a 20 caracteres, ver
     crearAppHeader) para que el header mida siempre igual: la clase que
     define el tamaño de fuente se asigna al crearlo y no se recalcula
     cuando después se reemplaza el texto.
     ========================================================= */

  const header = crearAppHeader({
    titulo: 'Crear cuenta',
  });
  container.querySelector('[data-header]').append(header);

  obtenerPermisos()
    .then((permisos) => {
      if (permisos.rol === ROLES.METRE) {
        header.querySelector('.app-header__titulo').textContent = 'Nuevo cliente';
      }
    })
    .catch(() => {
      // Sin sesión: es el caso de "Crear una cuenta" desde el login, el
      // título por default ya es el correcto.
    });


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
      'email',
      'password',
      'confirmarPassword',
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
    textoBoton: 'Escanear datos DNI',
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
     AJUSTE DE ALTO

     Recién acá (con la foto y el lector de DNI ya insertados: son los que
     le dan su alto real a esos recuadros) tiene sentido medir. Antes,
     ".alta-cliente__foto"/"__lector-qr" están vacíos y miden 0.
     ========================================================= */

  const ajusteFormulario = ajustarFormulario(
    container.querySelector('.alta-cliente__contenido'),
    { variable: '--ac-ajuste' },
  );


  /* =========================================================
     EVENTOS DE LOS CAMPOS
     ========================================================= */

  formulario
    .querySelectorAll('input')
    .forEach((control) => {

      control.addEventListener(
        'input',
        () => {

          /* Si se corrige el campo que la base rechazó, el aviso deja de
             aplicar: el valor ya no es el que chocaba. */
          const campo = control.id.replace('-cliente', '');

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
         * Si se crea el usuario de Auth y después rebota el INSERT del perfil
         * (DNI repetido), el usuario queda creado igual y desde el cliente no
         * hay forma de borrarlo: ese correo queda quemado y todo reintento,
         * aun con los datos corregidos, responde que ya está registrado.
         *
         * Con el metre logueado esta consulta ve la tabla y corta antes de
         * llegar a Auth. En el registro sin sesión, RLS no deja leer perfiles
         * y devuelve vacío: no molesta, y el rebote lo sigue atajando el
         * índice único con el mensaje de mensajeDeErrorAlta().
         */

        const conflictos = await buscarConflictosPerfil({
          dni: datos.dni,
          email: datos.email,
        });

        if (Object.keys(conflictos).length) {

          conflictosServidor = {
            ...(conflictos.dni && { dni: 'Ese DNI ya está registrado.' }),
            ...(conflictos.email && { email: 'Ese correo ya está registrado.' }),
          };

          actualizar();

          mostrarToastError('Revisá los campos señalados antes de continuar.');

          return;
        }


        /* — 2. La foto antes que el usuario: si falla la subida, el correo
               queda libre para reintentar. — */

        const foto_url = await subirFotoPerfil(foto) || 'https://placehold.co/200x200/png?text=Cliente';


        /* — 3. Usuario de Auth y perfil — */

        const { user } = await signUp(datos.email, datos.password);

        if (!user) {
          throw new Error('No se pudo obtener el usuario creado en Supabase Auth.');
        }

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
