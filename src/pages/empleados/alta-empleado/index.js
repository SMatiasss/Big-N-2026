  import './index.css';
  import { crearLectorQr } from '../../../components/lector-qr/lector-qr.js';
  import { crearSelectorAvatarFoto } from '../../../components/selector-avatar-foto/selector-avatar-foto.js';
  import { ROLES, ROLES_EMPLEADO } from '../../../config/constantes.js';
  import { esCampoVacio, esCuilValido, esDniValido, esEmailValido, esNombrePersonaValido, obtenerErrorArchivoImagen } from '../../../utils/validadores.js';

  const ROLES_DISPONIBLES = ROLES_EMPLEADO;

  // Etiquetas legibles para el combo; el valor que se guarda sigue siendo el de ROLES.
  const ETIQUETAS_ROL = {
    [ROLES.DUENO]: 'Dueño',
    [ROLES.SUPERVISOR]: 'Supervisor',
    [ROLES.METRE]: 'Metre',
    [ROLES.MOZO]: 'Mozo',
    [ROLES.COCINERO]: 'Cocinero',
    [ROLES.CANTINERO]: 'Cantinero',
  };

  function datosFormulario(formulario) {
    return Object.fromEntries(['nombre', 'apellido', 'dni', 'cuil', 'email', 'password', 'rol'].map((campo) => [campo, formulario.querySelector(`#${campo}-empleado`).value?.trim() ?? '']));
  }

  function validar(datos, foto) {
    const errores = {};
    if (!esNombrePersonaValido(datos.nombre)) errores.nombre = 'Ingresá un nombre válido.';
    if (!esNombrePersonaValido(datos.apellido)) errores.apellido = 'Ingresá un apellido válido.';
    if (!esDniValido(datos.dni)) errores.dni = 'El DNI debe tener 7 u 8 dígitos.';
    if (!esCuilValido(datos.cuil)) errores.cuil = 'Ingresá un CUIL válido de 11 dígitos.';
    if (!esEmailValido(datos.email)) errores.email = 'Ingresá un correo electrónico válido.';
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/.test(datos.password)) errores.password = 'Usá al menos 8 caracteres, con mayúscula, minúscula y número.';
    if (!ROLES_DISPONIBLES.includes(datos.rol)) errores.rol = 'Seleccioná un perfil válido.';
    if (obtenerErrorArchivoImagen(foto)) errores.foto = 'Tomá una foto personal válida desde la cámara.';
    return errores;
  }

  function mostrarError(formulario, campo, mensaje = '') {
    const contenedor = formulario.querySelector(`[data-campo="${campo}"]`);
    const control = contenedor.querySelector('ion-input, ion-select');
    contenedor.querySelector(`[data-error="${campo}"]`).textContent = mensaje;
    contenedor.classList.toggle('campo-formulario--invalido', Boolean(mensaje));
    contenedor.classList.toggle('campo-formulario--valido', !mensaje && !esCampoVacio(control.value));
    control.setAttribute('aria-invalid', String(Boolean(mensaje)));
  }

  function extraerDatosDni(contenido) {
    const campos = String(contenido).replace(/\\@/g, '@').split('@').map((valor) => valor.trim()).filter(Boolean);
    const indiceDni = campos.findIndex(esDniValido);
    const apellido = campos[indiceDni - 3];
    const nombre = campos[indiceDni - 2];
    if (indiceDni < 3 || !esNombrePersonaValido(apellido) || !esNombrePersonaValido(nombre)) {
      throw new Error('La lectura es inválida o está incompleta: faltan DNI, nombre o apellido.');
    }

    // El número de trámite también puede tener 11 dígitos, pero precede al DNI.
    // El CUIL o su fragmento sólo aparecen después del número de documento.
    const camposDespuesDelDni = campos.slice(indiceDni + 1);
    const cuilCompleto = camposDespuesDelDni.find((valor) => /^\d{11}$/.test(valor));
    const fragmentoCuil = camposDespuesDelDni.find((valor) => /^\d{3}$/.test(valor));
    const cuil = cuilCompleto ?? (fragmentoCuil
      ? `${fragmentoCuil.slice(0, 2)}${campos[indiceDni]}${fragmentoCuil[2]}`
      : '');

    if (cuil && !esCuilValido(cuil)) throw new Error('El código contiene un CUIL inválido.');
    return { nombre, apellido, dni: campos[indiceDni], cuil };
  }

  // ion-input encapsula un input nativo en su Shadow DOM. Actualizamos host,
  // atributo e input interno para que Capacitor e Ionic reflejen el cambio.
  function cargarValorEnCampo(formulario, campo, valor) {
    const control = formulario.querySelector(`#${campo}-empleado`);
    control.value = valor;
    control.setAttribute('value', valor);
    const inputNativo = control.shadowRoot?.querySelector('input');
    if (inputNativo) inputNativo.value = valor;
    control.forceUpdate?.();
  }

  export function render(container) {
    const opcionesRoles = ROLES_DISPONIBLES
      .map((rol) => `<ion-select-option value="${rol}">${ETIQUETAS_ROL[rol] ?? rol}</ion-select-option>`)
      .join('');

    container.innerHTML = `
      <ion-page class="ion-page alta-empleado"><ion-header><ion-toolbar color="primary"><ion-title>Alta de empleado</ion-title></ion-toolbar></ion-header><ion-content><main class="alta-empleado__contenido">
        <header class="alta-empleado__introduccion"><h1>Nuevo empleado</h1><p>Completá los datos del empleado, tomá su foto y, si está disponible, leé el DNI.</p></header>
        <form class="alta-empleado__formulario" novalidate><div class="alta-empleado__lector-qr"></div><pre class="alta-empleado__resultado-escaneo" aria-live="polite" hidden></pre>
          <div class="alta-empleado__fila"><div class="campo-formulario" data-campo="nombre"><ion-item><ion-input id="nombre-empleado" label="Nombre" label-placement="stacked" maxlength="80" required></ion-input></ion-item><ion-note color="danger" data-error="nombre"></ion-note></div><div class="campo-formulario" data-campo="apellido"><ion-item><ion-input id="apellido-empleado" label="Apellido" label-placement="stacked" maxlength="80" required></ion-input></ion-item><ion-note color="danger" data-error="apellido"></ion-note></div></div>
          <div class="alta-empleado__fila"><div class="campo-formulario" data-campo="dni"><ion-item><ion-input id="dni-empleado" label="DNI" label-placement="stacked" inputmode="numeric" maxlength="8" required></ion-input></ion-item><ion-note color="danger" data-error="dni"></ion-note></div><div class="campo-formulario" data-campo="cuil"><ion-item><ion-input id="cuil-empleado" label="CUIL" label-placement="stacked" inputmode="numeric" maxlength="11" required></ion-input></ion-item><ion-note color="danger" data-error="cuil"></ion-note></div></div>
          <div class="campo-formulario" data-campo="email"><ion-item><ion-input id="email-empleado" label="Correo electrónico" label-placement="stacked" type="email" inputmode="email" required></ion-input></ion-item><ion-note color="danger" data-error="email"></ion-note></div><div class="campo-formulario" data-campo="password"><ion-item><ion-input id="password-empleado" label="Contraseña" label-placement="stacked" type="password" required></ion-input></ion-item><ion-note color="danger" data-error="password"></ion-note></div>
          <div class="campo-formulario" data-campo="rol"><ion-item><ion-select id="rol-empleado" label="Perfil" label-placement="stacked" placeholder="Seleccioná un perfil" interface="popover" required>${opcionesRoles}</ion-select></ion-item><ion-note color="danger" data-error="rol"></ion-note></div><div class="alta-empleado__foto"></div><div class="alta-empleado__resultado" role="status" aria-live="polite"></div><ion-button class="alta-empleado__submit" type="submit" expand="block">Validar empleado</ion-button>
        </form></main></ion-content></ion-page>`;

    const formulario = container.querySelector('.alta-empleado__formulario');
    const resultado = formulario.querySelector('.alta-empleado__resultado');
    const resultadoEscaneo = formulario.querySelector('.alta-empleado__resultado-escaneo');
    let foto = null;
    let datosDniEscaneados = null;
    let mostrarValidacion = false;
    const actualizar = () => {
      if (!mostrarValidacion) return;
      const errores = validar(datosFormulario(formulario), foto);
      ['nombre', 'apellido', 'dni', 'cuil', 'email', 'password', 'rol'].forEach((campo) => mostrarError(formulario, campo, errores[campo] ?? ''));
    };
    const avatar = crearSelectorAvatarFoto({ onCambio(archivo) { foto = archivo; actualizar(); } });
    formulario.querySelector('.alta-empleado__foto').append(avatar.elemento);
    const lector = crearLectorQr({ onLectura: async (contenido) => {
      resultadoEscaneo.hidden = false;
      resultadoEscaneo.textContent = `Resultado recibido del escáner:\n${contenido}`;
      try {
        datosDniEscaneados = extraerDatosDni(contenido);
        Object.entries(datosDniEscaneados)
          .filter(([, valor]) => valor)
          .forEach(([campo, valor]) => cargarValorEnCampo(formulario, campo, valor));
        resultado.textContent = datosDniEscaneados.cuil ? 'Datos del DNI cargados. Revisalos antes de continuar.' : 'Datos cargados; completá el CUIL manualmente.';
        resultado.className = 'alta-empleado__resultado alta-empleado__resultado--exito';
        actualizar();
      } catch (error) { resultado.textContent = error.message; resultado.className = 'alta-empleado__resultado alta-empleado__resultado--error'; }
    } });
    formulario.querySelector('.alta-empleado__lector-qr').append(lector.elemento);
    formulario.querySelectorAll('ion-input, ion-select').forEach((control) => control.addEventListener(control.tagName === 'ION-SELECT' ? 'ionChange' : 'ionInput', () => { actualizar(); resultado.textContent = ''; }));
    formulario.addEventListener('submit', (evento) => {
      evento.preventDefault(); mostrarValidacion = true; const errores = validar(datosFormulario(formulario), foto); actualizar(); avatar.mostrarError(errores.foto ?? '');
      if (Object.keys(errores).length) { resultado.textContent = 'Revisá los campos señalados antes de continuar.'; resultado.className = 'alta-empleado__resultado alta-empleado__resultado--error'; return; }
      const rolSeleccionado = datosFormulario(formulario).rol;
      resultado.textContent = `Datos del empleado con perfil ${ETIQUETAS_ROL[rolSeleccionado] ?? rolSeleccionado} validados correctamente. El alta remota requiere el endpoint seguro de administración aún no configurado.`;
      resultado.className = 'alta-empleado__resultado alta-empleado__resultado--exito';
    });
    window.addEventListener('hashchange', () => avatar.destruir(), { once: true });
  }
