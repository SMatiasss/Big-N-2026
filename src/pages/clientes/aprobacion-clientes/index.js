import './index.css';
import { navegarA } from '../../../router.js';
import { listarClientesPendientes, listarClientesAceptados, resolverClientePendiente, observarClientesPendientes } from '../../../services/aprobacion-clientes.service.js';
import { ESTADOS_PERFIL } from '../../../config/constantes.js';

export async function render(container) {
  container.innerHTML = `
    <ion-content class="aprobacion-clientes">
      <main class="aprobacion-clientes__contenido">
        <header><button type="button" data-volver aria-label="Volver al inicio">‹</button><h1>Clientes</h1></header>
        <nav class="aprobacion-clientes__pestanas" aria-label="Filtrar clientes">
          <button type="button" data-estado="aprobado" aria-pressed="false">Todos</button>
          <button type="button" data-estado="pendiente" aria-pressed="true">Pendientes</button>
        </nav>
        <div class="aprobacion-clientes__resumen">
          <p role="status" aria-live="polite" data-mensaje></p>
          <p data-conexion>Conectando las actualizaciones…</p>
        </div>
        <p class="aprobacion-clientes__resultado" role="status" aria-live="polite" data-decision></p>
        <section class="aprobacion-clientes__lista" aria-label="Clientes pendientes"></section>
        <p class="aprobacion-clientes__aviso">Al aprobar o rechazar, se intentará enviar un correo al cliente.</p>
      </main>
    </ion-content>`;
  const raiz = container.firstElementChild;
  const lista = raiz.querySelector('section');
  const mensaje = raiz.querySelector('[data-mensaje]');
  const conexion = raiz.querySelector('[data-conexion]');
  const decision = raiz.querySelector('[data-decision]');
  let ocupado = false;
  let clientes = [];
  let estadoSeleccionado = ESTADOS_PERFIL.PENDIENTE;
  const pestanas = [...raiz.querySelectorAll('[data-estado]')];
  pestanas.forEach((boton) => boton.addEventListener('click', () => {
    if (ocupado || cerrado) return;
    estadoSeleccionado = boton.dataset.estado;
    pestanas.forEach((item) => item.setAttribute('aria-pressed', String(item === boton)));
    dibujar();
  }));
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
    void confirmacion?.dismiss(undefined, 'cancel');
    clearInterval(intervalo);
    detenerObservacion?.();
    window.removeEventListener('online', solicitarRecargaVisible);
    document.removeEventListener('visibilitychange', solicitarRecargaVisible);
  }
  function solicitarRecargaVisible() {
    if (!document.hidden) void cargar();
  }
  raiz.querySelector('[data-volver]').addEventListener('click', () => navegarA('/login'));

  function bloquear(valor) {
    ocupado = valor;
    lista.setAttribute('aria-busy', String(valor));
    lista.querySelectorAll('button, select').forEach((control) => { control.disabled = valor; });
    pestanas.forEach((boton) => { boton.disabled = valor; });
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
      nombre.textContent = `${cliente.nombres} ${cliente.apellidos ?? ''}`.trim();
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
        listarClientesPendientes(), listarClientesAceptados(),
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
      // Ionic administra el foco y el cierre del modal. El nombre va como texto,
      // no como HTML. Cancelar o salir de la pantalla nunca guarda la decisión.
      const modal = document.createElement('ion-alert');
      confirmacion = modal;
      modal.cssClass = 'confirmacion-cliente';
      modal.header = aceptar ? '¿Aceptar a este cliente?' : '¿Rechazar a este cliente?';
      modal.subHeader = `${cliente.nombres} ${cliente.apellidos ?? ''}`.trim();
      modal.message = aceptar
        ? 'Su registro quedará aprobado y podrá ingresar a la aplicación. ¿Querés continuar?'
        : 'Su registro quedará rechazado y no podrá ingresar a la aplicación. ¿Querés continuar?';
      modal.backdropDismiss = false;
      modal.buttons = [
        { text: 'Cancelar', role: 'cancel' },
        { text: aceptar ? 'Sí, aceptar' : 'Sí, rechazar', role: 'confirm' },
      ];
      document.body.append(modal);
      try {
        const cierre = modal.onDidDismiss();
        await modal.present();
        if (cerrado) await modal.dismiss(undefined, 'cancel');
        const { role } = await cierre;
        if (role !== 'confirm' || cerrado || !raiz.isConnected) return;
      } finally {
        modal.remove();
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
