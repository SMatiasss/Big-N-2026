import './index.css';
import { ajustarLista } from '../../../components/lista-ajustada/lista-ajustada.js';
import { navegarA } from '../../../router.js';
import { crearAppHeader } from '../../../components/app-header/app-header.js';
import { crearPestanas } from '../../../components/pestanas-filtro/pestanas-filtro.js';
import { crearModalConfirmacion } from '../../../components/modal-confirmacion/modal-confirmacion.js';
import { listarClientesPendientes, listarClientesAceptados, resolverClientePendiente, observarClientesPendientes } from '../../../services/aprobacion-clientes.service.js';
import { obtenerPermisos } from '../../../services/auth.service.js';
import { PERMISOS_PESTANAS } from '../../../config/navegacion.js';
import { ESTADOS_PERFIL, ROLES } from '../../../config/constantes.js';

export async function render(container) {
  container.innerHTML = `
    <ion-content class="aprobacion-clientes pantalla-lista" scroll-y="false">
      <div data-header></div>
      <main class="aprobacion-clientes__contenido pantalla-lista__cuerpo">
        <div data-pestanas></div>
        <div class="aprobacion-clientes__resumen">
          <p role="status" aria-live="polite" data-mensaje></p>
          <p data-conexion>Conectando las actualizaciones…</p>
        </div>
        <p class="aprobacion-clientes__resultado" role="status" aria-live="polite" data-decision></p>
        <section class="aprobacion-clientes__lista lista-ajustada" aria-label="Clientes pendientes"></section>
        <p class="aprobacion-clientes__aviso" data-aviso-email>Al aprobar o rechazar, se intentará enviar un correo al cliente.</p>
      </main>
    </ion-content>`;
  const raiz = container.firstElementChild;
  const lista = raiz.querySelector('section');
  const ajusteLista = ajustarLista(lista);
  const mensaje = raiz.querySelector('[data-mensaje]');
  const conexion = raiz.querySelector('[data-conexion]');
  const decision = raiz.querySelector('[data-decision]');

  // Matriz de acceso: dueño/supervisor ven "Pendientes" habilitada y "Todos"
  // ("Clientes - Activos" en la matriz) gris; metre es al revés y además
  // puede registrar un cliente nuevo. La pestaña "Pendientes" para metre no
  // sólo se muestra gris: ni siquiera se le pide el dato, porque el propio
  // servicio (exigirAdministradorClientes) le tiraría error si se lo pidiera.
  const permisos = await obtenerPermisos().catch(() => null);
  const permisoTabs = permisos ? PERMISOS_PESTANAS.clientes[permisos.rol] : undefined;
  const puedeVerPendientes = permisoTabs?.[ESTADOS_PERFIL.PENDIENTE] !== 'deshabilitada';
  const puedeVerAceptados = permisoTabs?.[ESTADOS_PERFIL.APROBADO] !== 'deshabilitada';
  const puedeAgregarCliente = permisos?.rol === ROLES.METRE;

  let ocupado = false;
  let clientes = [];
  let estadoSeleccionado = puedeVerPendientes ? ESTADOS_PERFIL.PENDIENTE : ESTADOS_PERFIL.APROBADO;
  let cerrado = false;
  let recargaPendiente = false;
  let detenerObservacion;
  let confirmacion;
  // Respaldo ante cortes/eventos perdidos; sólo consulta mientras la página es visible.
  const intervalo = setInterval(solicitarRecargaVisible, 30000);
  window.addEventListener('online', solicitarRecargaVisible);
  document.addEventListener('visibilitychange', solicitarRecargaVisible);
  window.addEventListener('hashchange', destruir, { once: true });
  function destruir() {
    cerrado = true;
    confirmacion?.cerrar('cancel');
    clearInterval(intervalo);
    ajusteLista.destruir();
    detenerObservacion?.();
    window.removeEventListener('online', solicitarRecargaVisible);
    document.removeEventListener('visibilitychange', solicitarRecargaVisible);
  }
  function solicitarRecargaVisible() {
    if (!document.hidden) void cargar();
  }
  const header = crearAppHeader({
    titulo: 'Clientes',
    etiquetaVolver: 'Volver al inicio',
    onVolver: () => navegarA('/home'),
    // "Clientes - Activos: Ver + Agregar" del metre: la lectura de la matriz
    // de acceso a config/navegacion.js, la ruta ya está gateada a metre.
    accion: {
      texto: '+',
      etiqueta: 'Registrar un cliente',
      onClick: () => navegarA('/clientes/alta'),
    },
  });
  raiz.querySelector('[data-header]').append(header);
  const botonAgregar = header.querySelector('.app-header__accion');
  if (botonAgregar) botonAgregar.hidden = !puedeAgregarCliente;

  // Al viewer que no puede resolver pendientes tampoco le corresponde el
  // aviso de "se enviará un correo al aprobar/rechazar".
  raiz.querySelector('[data-aviso-email]').hidden = !puedeVerPendientes;

  const pestanas = crearPestanas({
    etiqueta: 'Filtrar clientes',
    opciones: [
      { valor: ESTADOS_PERFIL.APROBADO, texto: 'Todos', deshabilitada: !puedeVerAceptados },
      { valor: ESTADOS_PERFIL.PENDIENTE, texto: 'Pendientes', deshabilitada: !puedeVerPendientes },
    ],
    seleccionInicial: estadoSeleccionado,
    permitirCambio: () => !ocupado && !cerrado,
    onCambio: (valor) => {
      estadoSeleccionado = valor;
      dibujar();
    },
  });
  raiz.querySelector('[data-pestanas]').append(pestanas.elemento);

  function bloquear(valor) {
    ocupado = valor;
    lista.setAttribute('aria-busy', String(valor));
    lista.querySelectorAll('button, select').forEach((control) => { control.disabled = valor; });
    pestanas.establecerBloqueado(valor);
    // No se pierden eventos recibidos durante un SELECT o una decisión.
    if (!valor && recargaPendiente && !cerrado) {
      recargaPendiente = false;
      void cargar();
    }
  }

  function dibujar() {
    lista.replaceChildren();
    const visibles = clientes.filter((cliente) => cliente.estado === estadoSeleccionado);
    const pendientes = estadoSeleccionado === ESTADOS_PERFIL.PENDIENTE;
    lista.setAttribute('aria-label', pendientes ? 'Clientes pendientes' : 'Clientes aceptados');
    mensaje.textContent = visibles.length
      ? `${visibles.length} ${visibles.length === 1 ? 'cliente' : 'clientes'} ${pendientes
        ? (visibles.length === 1 ? 'pendiente' : 'pendientes') : (visibles.length === 1 ? 'aceptado' : 'aceptados')}`
      : pendientes ? 'No hay solicitudes pendientes' : 'Todavía no hay clientes aceptados';
    for (const cliente of visibles) {
      const tarjeta = document.createElement('article');
      tarjeta.className = 'aprobacion-clientes__tarjeta';
      const foto = document.createElement('div');
      foto.className = 'aprobacion-clientes__foto';
      const iniciales = `${cliente.nombres?.trim().charAt(0) ?? ''}${cliente.apellidos?.trim().charAt(0) ?? ''}`.toLocaleUpperCase('es');
      foto.textContent = iniciales || '?';
      foto.setAttribute('aria-label', 'Foto no disponible');
      // No interpolar datos del perfil en HTML; sólo se admiten URLs web.
      try {
        const url = new URL(cliente.foto_url);
        if (['https:', 'http:'].includes(url.protocol)) {
          const imagen = document.createElement('img');
          imagen.alt = `Foto de ${cliente.nombres} ${cliente.apellidos ?? ''}`;
          imagen.src = url.href;
          imagen.loading = 'lazy';
          imagen.referrerPolicy = 'no-referrer';
          imagen.addEventListener('error', () => { foto.textContent = iniciales || '?'; }, { once: true });
          foto.replaceChildren(imagen);
          foto.removeAttribute('aria-label');
        }
      } catch { /* La falta de una foto no impide revisar los demás perfiles. */ }
      const nombre = document.createElement('h2');
      const nombreCompleto = `${cliente.nombres} ${cliente.apellidos ?? ''}`.trim();
      nombre.textContent = nombreCompleto;
      // Nombres largos ("Estefano Caballeroso Palermo") no deben desbordar ni
      // achicar el resto de la tarjeta: se reduce sólo la tipografía del nombre.
      if (nombreCompleto.length > 28) {
        nombre.classList.add('aprobacion-clientes__nombre--muy-largo');
      } else if (nombreCompleto.length > 18) {
        nombre.classList.add('aprobacion-clientes__nombre--largo');
      }
      tarjeta.append(foto, nombre);
      if (pendientes) {
        // El desplegable sólo elige la acción; el modal sigue siendo obligatorio.
        const elegir = document.createElement('select');
        elegir.className = 'aprobacion-clientes__elegir';
        elegir.setAttribute('aria-label', `Elegir acción para ${nombre.textContent}`);
        elegir.innerHTML = '<option value="" disabled selected>Elegir</option><option value="aprobado">Aceptar</option><option value="rechazado">Rechazar</option>';
        elegir.addEventListener('change', () => {
          const estado = elegir.value;
          elegir.value = '';
          void decidir(cliente.id, estado);
        });
        tarjeta.append(elegir);
      }
      lista.append(tarjeta);
    }
  }

  async function cargar() {
    if (cerrado || !raiz.isConnected) return;
    if (ocupado) { recargaPendiente = true; return; }
    bloquear(true);
    if (!clientes.length) mensaje.textContent = 'Buscando solicitudes…';
    try {
      const [pendientes, aceptados] = await Promise.all([
        puedeVerPendientes ? listarClientesPendientes() : Promise.resolve([]),
        puedeVerAceptados ? listarClientesAceptados() : Promise.resolve([]),
      ]);
      if (cerrado || !raiz.isConnected) return;
      clientes = [...pendientes, ...aceptados];
      dibujar();
      if (!detenerObservacion) {
        detenerObservacion = observarClientesPendientes(() => { void cargar(); }, (estado) => {
          conexion.textContent = estado === 'SUBSCRIBED'
            ? 'Los nuevos registros aparecen automáticamente.'
            : 'Reconectando… Buscaremos nuevas solicitudes automáticamente.';
        });
      }
    } catch (error) {
      if (cerrado) return;
      lista.replaceChildren();
      mensaje.textContent = error.message ?? 'No se pudo cargar el listado.';
      detenerObservacion?.();
      detenerObservacion = undefined;
      conexion.textContent = 'No pudimos actualizar las solicitudes. Volveremos a intentarlo automáticamente.';
    } finally { bloquear(false); }
  }

  async function decidir(id, estado) {
    // Bloquear antes del primer await evita doble clic y decisiones contradictorias.
    if (ocupado || cerrado) return;
    bloquear(true);
    try {
      const cliente = clientes.find((item) => item.id === id);
      if (!cliente) return;
      const aceptar = estado === ESTADOS_PERFIL.APROBADO;
      // El nombre va como texto, no como HTML. Cancelar o salir de la
      // pantalla nunca guarda la decisión.
      const modal = crearModalConfirmacion({
        variante: aceptar ? 'exito' : 'error',
        titulo: aceptar ? '¿Aceptar a este cliente?' : '¿Rechazar a este cliente?',
        subtitulo: `${cliente.nombres} ${cliente.apellidos ?? ''}`.trim(),
        mensaje: aceptar
          ? 'Su registro quedará aprobado y podrá ingresar a la aplicación. ¿Querés continuar?'
          : 'Su registro quedará rechazado y no podrá ingresar a la aplicación. ¿Querés continuar?',
        botones: [
          { texto: 'Cancelar', rol: 'cancel' },
          { texto: aceptar ? 'Sí, aceptar' : 'Sí, rechazar', rol: 'confirm', destacado: true },
        ],
      });
      confirmacion = modal;
      try {
        const rolCierre = modal.presentar();
        if (cerrado) modal.cerrar('cancel');
        const rol = await rolCierre;
        if (rol !== 'confirm' || cerrado || !raiz.isConnected) return;
      } finally {
        confirmacion = undefined;
      }
      decision.textContent = 'Guardando tu decisión…';
      const resultado = await resolverClientePendiente(id, estado);
      if (cerrado || !raiz.isConnected) return;
      clientes = clientes.filter((cliente) => cliente.id !== id);
      if (aceptar) clientes.push(resultado.cliente);
      dibujar();
      decision.textContent = `${cliente.nombres}: ${aceptar ? 'registro aprobado' : 'registro rechazado'}. ${resultado.emailEnviado
        ? 'Correo enviado.'
        : 'La decisión se guardó. No se pudo confirmar el envío del correo al cliente.'}`;
      recargaPendiente = true;
    } catch (error) {
      if (cerrado) return;
      decision.textContent = error.message ?? 'No se pudo guardar la decisión.';
      recargaPendiente = true;
    } finally { bloquear(false); }
  }

  await cargar();
}
