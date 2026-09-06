// Agrupa eventos durante una consulta; evita carreras y libera recursos al navegar.
export function crearActualizacionHu11(raiz, consultar, onError) {
  let cerrado = false;
  let ejecutando = false;
  let pendiente = false;
  const limpiezas = [];
  async function actualizar() {
    if (cerrado || !raiz.isConnected) return;
    if (ejecutando) { pendiente = true; return; }
    ejecutando = true;
    try { await consultar(() => !cerrado && raiz.isConnected); }
    catch (error) { if (!cerrado) onError(error); }
    finally {
      ejecutando = false;
      if (pendiente && !cerrado) { pendiente = false; void actualizar(); }
    }
  }
  const visible = () => { if (!document.hidden) void actualizar(); };
  const intervalo = setInterval(visible, 30000);
  document.addEventListener('visibilitychange', visible);
  window.addEventListener('online', visible);
  window.addEventListener('hashchange', () => {
    cerrado = true;
    clearInterval(intervalo);
    document.removeEventListener('visibilitychange', visible);
    window.removeEventListener('online', visible);
    limpiezas.forEach(fn => fn());
  }, { once: true });
  return { actualizar, alSalir(fn) { if (cerrado) fn(); else limpiezas.push(fn); } };
}
