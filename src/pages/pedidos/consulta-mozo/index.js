import { obtenerPerfilActual } from '../../../services/auth.service.js';
import { obtenerContextoMesa, listarConversacionesMozo } from '../../../services/mesa-cliente.service.js';
import { enviarMensaje, listarMensajes, suscribirseAMensajes } from '../../../services/mensajes.service.js';
import { crearBurbujaChat } from '../../../components/burbuja-chat/burbuja-chat.js';
import { crearActualizacionHu11 } from '../../../utils/actualizacion-hu11.js';
import { validarMensaje, haySaltoEnHistorial } from '../../../utils/hu11.js';
import { navegarA } from '../../../router.js';
import { consumirEstadiaPushHu11 } from '../../../services/notificaciones.service.js';
import { crearAppHeader } from '../../../components/app-header/app-header.js';
import '../../productos/carta/index.css';
import './index.css';

function horaMensaje(fecha) {
  if (!fecha) return '';
  return new Intl.DateTimeFormat('es-AR', { hour: '2-digit', minute: '2-digit' }).format(new Date(fecha));
}

export async function render(container) {
  container.innerHTML = `<ion-content class="hu11 consulta-mozo"><div data-header></div><main>
    <p class="consulta-mozo__subtitulo" data-subtitulo>Atención clientes</p>
    <p role="status" aria-live="polite">Verificando acceso…</p>
    <label class="sr-only" data-salas hidden>Conversación<select aria-label="Seleccionar mesa"></select></label>
    <section class="consulta-mozo__bandeja" data-bandeja hidden aria-label="Conversaciones"></section>
    <section class="consulta-mozo__conversacion" data-conversacion>
      <h2 data-mesa></h2><button type="button" data-anteriores hidden>Ver mensajes anteriores</button>
      <div class="hu11__chat" role="log" aria-label="Mensajes" aria-live="polite"></div>
      <form class="hu11__form" hidden><label><span class="sr-only">Tu mensaje</span><textarea name="mensaje" required rows="1" aria-label="Tu mensaje" placeholder="Escribe un mensaje..."></textarea></label>
        <button type="submit" aria-label="Enviar mensaje">→</button></form>
      <p class="consulta-mozo__aviso">Recibirás un aviso cuando haya un nuevo mensaje.</p>
    </section>
  </main></ion-content>`;
  const raiz = container.firstElementChild;
  const estado = raiz.querySelector('[role="status"]');
  const salas = raiz.querySelector('select');
  const chat = raiz.querySelector('[role="log"]');
  const form = raiz.querySelector('form');
  const campo = form.elements.mensaje;
  const anteriores = raiz.querySelector('[data-anteriores]');
  const bandeja = raiz.querySelector('[data-bandeja]');
  const conversacion = raiz.querySelector('[data-conversacion]');
  let perfil, mozo = false, seleccion = null, contexto = null, nombreCliente = '';
  let mensajes = [], enviando = false, intento = null, cargandoAnteriores = false;
  let historialCompleto = false;
  let firma = '', version = 0, conectado = false;
  const header = crearAppHeader({
    titulo: 'Consultas',
    onVolver: () => {
      if (mozo && seleccion) {
        cambiarSala(null);
        raiz.querySelector('h1').textContent = 'Consultas';
        raiz.querySelector('[data-subtitulo]').textContent = 'Atención clientes';
        bandeja.hidden = false;
        conversacion.hidden = true;
        estado.textContent = 'Elegí una consulta para leer o responder.';
        return;
      }
      navegarA(mozo ? '/home' : '/mesa/carta');
    },
  });
  raiz.querySelector('[data-header]').append(header);

  function dibujarBandeja(conversaciones, ultimos) {
    bandeja.replaceChildren();
    conversaciones.forEach((item, indice) => {
      const ultimo = ultimos[indice]?.at(-1);
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'consulta-mozo__tarjeta';
      boton.classList.toggle('consulta-mozo__tarjeta--pendiente', Boolean(ultimo && ultimo.autor_id !== perfil.id));
      boton.innerHTML = `<span class="consulta-mozo__fila"><strong>Mesa ${item.numero_mesa}</strong><time></time></span><span class="consulta-mozo__resumen"></span>`;
      boton.querySelector('time').dateTime = ultimo?.creado_en ?? item.ultimo_mensaje_en ?? '';
      boton.querySelector('time').textContent = horaMensaje(ultimo?.creado_en ?? item.ultimo_mensaje_en);
      boton.querySelector('.consulta-mozo__resumen').textContent = ultimo?.cuerpo || `Conversación con ${[item.nombres, item.apellidos].filter(Boolean).join(' ')}`;
      boton.addEventListener('click', () => {
        nombreCliente = [item.nombres, item.apellidos].filter(Boolean).join(' ');
        cambiarSala(item.estadia_id);
        salas.value = item.estadia_id;
        bandeja.hidden = true;
        conversacion.hidden = false;
        void actualizacion.actualizar();
      });
      bandeja.append(boton);
    });
  }

  function dibujar(nuevos) {
    // Un mismo mensaje puede llegar por RPC, Realtime y reconexión: se combina por ID.
    const mapa = new Map(mensajes.map(m => [m.id, m]));
    nuevos.forEach(m => mapa.set(m.id, m));
    mensajes = [...mapa.values()].sort((a, b) => a.creado_en.localeCompare(b.creado_en) || a.id.localeCompare(b.id));
    const proximaFirma = JSON.stringify(mensajes);
    if (firma === proximaFirma) return;
    const alFinal = chat.scrollHeight - chat.scrollTop - chat.clientHeight < 50;
    firma = proximaFirma;
    chat.replaceChildren(...mensajes.map(m => crearBurbujaChat(m, perfil.id)));
    if (!mensajes.length) chat.textContent = 'Todavía no hay mensajes. Podés iniciar la conversación.';
    if (alFinal) chat.scrollTop = chat.scrollHeight;
  }

  function cambiarSala(id) {
    version++;
    seleccion = id || null;
    contexto = null;
    mensajes = [];
    firma = '';
    historialCompleto = false;
    chat.replaceChildren();
    form.hidden = true;
    campo.value = '';
    intento = null;
    anteriores.hidden = true;
    raiz.querySelector('[data-mesa]').textContent = '';
  }

  // Ante pérdida de permisos no se deja visible el historial anterior.
  function fallar(error) {
    contexto = null;
    mensajes = [];
    firma = '';
    historialCompleto = false;
    chat.replaceChildren();
    form.hidden = true;
    anteriores.hidden = true;
    if (mozo) salas.replaceChildren();
    estado.textContent = error.message || 'No pudimos actualizar la conversación. Reintentaremos automáticamente.';
  }

  const actualizacion = crearActualizacionHu11(raiz, async vigente => {
    const actual = version;
    try {
      if (!perfil) return;
      if (mozo) {
        const conversaciones = await listarConversacionesMozo();
        if (!vigente() || actual !== version) return;
        const ultimos = await Promise.all(conversaciones.map(c => listarMensajes(c.estadia_id)));
        if (!vigente() || actual !== version) return;
        dibujarBandeja(conversaciones, ultimos);
        salas.replaceChildren();
        const opcion = document.createElement('option');
        opcion.value = '';
        opcion.textContent = 'Elegí una mesa';
        salas.append(opcion);
        conversaciones.forEach(c => {
          const opt = document.createElement('option');
          opt.value = c.estadia_id;
          opt.textContent = `Mesa ${c.numero_mesa} · ${[c.nombres, c.apellidos].filter(Boolean).join(' ')}`;
          salas.append(opt);
        });
        if (seleccion && !conversaciones.some(c => c.estadia_id === seleccion)) cambiarSala(null);
        salas.value = seleccion || '';
        if (!seleccion) {
          bandeja.hidden = false;
          conversacion.hidden = true;
          estado.textContent = conversaciones.length ? 'Elegí una consulta para leer o responder.' : 'No hay consultas de mesas habilitadas.';
          return;
        }
        bandeja.hidden = true;
        conversacion.hidden = false;
      }
      const id = seleccion;
      const ctx = await obtenerContextoMesa(id);
      const nuevos = await listarMensajes(ctx.estadia_id);
      if (!vigente() || actual !== version) return;
      seleccion = ctx.estadia_id;
      contexto = ctx;
      raiz.querySelector('[data-mesa]').textContent = `Mesa ${ctx.numero_mesa}`;
      if (mozo) {
        raiz.querySelector('h1').textContent = `Mesa ${ctx.numero_mesa}`;
        raiz.querySelector('[data-subtitulo]').textContent = nombreCliente || 'Cliente';
      }
      const salto = haySaltoEnHistorial(mensajes, nuevos);
      if (salto) { mensajes = []; firma = ''; historialCompleto = false; }
      if (!mensajes.length && nuevos.length < 100) historialCompleto = true;
      dibujar(nuevos);
      anteriores.hidden = historialCompleto;
      form.hidden = false;
      estado.textContent = conectado ? 'La conversación se actualiza automáticamente.' : 'Actualización periódica activa. Reconectando la actualización en vivo…';
      if (salto) estado.textContent = 'Recuperamos los mensajes recientes. Usá “Ver mensajes anteriores” para recuperar el resto.';
    } catch (error) {
      // Una lectura de otra sala que falla tarde no borra el chat actual.
      if (actual === version) throw error;
    }
  }, fallar);

  salas.onchange = () => { cambiarSala(salas.value); void actualizacion.actualizar(); };
  anteriores.onclick = async () => {
    if (cargandoAnteriores || !contexto || !mensajes.length) return;
    cargandoAnteriores = true;
    anteriores.disabled = true;
    const actual = version;
    try {
      const viejos = await listarMensajes(seleccion, mensajes[0]);
      if (!raiz.isConnected || actual !== version) return;
      const altura = chat.scrollHeight;
      const posicion = chat.scrollTop;
      dibujar(viejos);
      chat.scrollTop = posicion + chat.scrollHeight - altura;
      historialCompleto = viejos.length < 100;
      anteriores.hidden = historialCompleto;
    } catch (error) { if (actual === version && raiz.isConnected) fallar(error); }
    finally { cargandoAnteriores = false; anteriores.disabled = false; }
  };

  form.onsubmit = async event => {
    event.preventDefault();
    if (enviando || !contexto) return;
    let cuerpo;
    try { cuerpo = validarMensaje(campo.value); }
    catch (error) { estado.textContent = error.message; return; }
    // Si hubo timeout conservamos el mismo ID. No generamos otro hasta confirmar
    // o cambiar el contenido, evitando duplicar la consulta por un reintento.
    if (!intento || intento.cuerpo !== cuerpo || intento.estadiaId !== seleccion) {
      intento = { id: crypto.randomUUID(), cuerpo, estadiaId: seleccion };
    }
    const actual = version;
    enviando = true;
    campo.disabled = true;
    form.querySelector('button').disabled = true;
    salas.disabled = true;
    estado.textContent = 'Guardando mensaje…';
    try {
      await enviarMensaje(intento);
      if (!raiz.isConnected || actual !== version) return;
      campo.value = '';
      intento = null;
      estado.textContent = 'Mensaje enviado.';
      await actualizacion.actualizar();
    } catch (error) {
      if (!raiz.isConnected || actual !== version) return;
      if (error.code === '42501') fallar(error);
      else estado.textContent = `No se confirmó el envío. Podés reintentar el mismo mensaje sin duplicarlo. ${error.message || ''}`;
    } finally {
      enviando = false;
      campo.disabled = false;
      form.querySelector('button').disabled = false;
      salas.disabled = false;
    }
  };

  try {
    perfil = await obtenerPerfilActual();
    if (!raiz.isConnected) return;
    mozo = perfil?.rol === 'mozo';
    if (mozo) seleccion = consumirEstadiaPushHu11();
    if (!perfil?.activo || (!mozo && !['cliente_registrado', 'cliente_anonimo'].includes(perfil.rol)) ||
      (perfil.rol !== 'cliente_anonimo' && perfil.estado !== 'aprobado')) {
      throw new Error('Esta pantalla es para clientes habilitados y mozos aprobados.');
    }
    raiz.querySelector('h1').textContent = mozo ? 'Consultas' : 'Consulta al mozo';
    raiz.querySelector('[data-subtitulo]').textContent = mozo ? 'Atención clientes' : 'Mesa asignada';
    raiz.querySelector('[data-salas]').hidden = !mozo;
    if (!mozo) {
      const ctx = await obtenerContextoMesa();
      if (!raiz.isConnected) return;
      seleccion = ctx.estadia_id;
    }
    actualizacion.alSalir(suscribirseAMensajes(mozo ? null : seleccion,
      () => { void actualizacion.actualizar(); }, estadoCanal => { conectado = estadoCanal === 'SUBSCRIBED'; }));
    await actualizacion.actualizar();
  } catch (error) { if (raiz.isConnected) { perfil = null; fallar(error); } }
}
