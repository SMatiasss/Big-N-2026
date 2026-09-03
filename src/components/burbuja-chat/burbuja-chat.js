import './burbuja-chat.css';

// Se distingue al emisor usando su ID autenticado, no su nombre visible.
export function crearBurbujaChat(mensaje, usuarioId) {
  const el = document.createElement('div');
  el.className = 'burbuja-chat';
  el.classList.toggle('burbuja-chat--propia', mensaje.autor_id === usuarioId);
  const autor = document.createElement('strong');
  autor.textContent = `${mensaje.nombres} ${mensaje.apellidos ?? ''} — ${mensaje.rol === 'mozo' ? 'Mozo' : 'Cliente'}`;
  const texto = document.createElement('p');
  texto.textContent = mensaje.cuerpo;
  const fecha = document.createElement('time');
  fecha.dateTime = mensaje.creado_en;
  // Se presenta el timestamp guardado por PostgreSQL, no la hora de recepción.
  fecha.textContent = new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'short', timeStyle: 'short',
  }).format(new Date(mensaje.creado_en));
  el.append(autor, texto, fecha);
  return el;
}
