import { obtenerPerfilActual } from './auth.service.js';
import { obtenerMiEspera } from './lista-espera.service.js';
import { obtenerMiEstadiaActiva } from './estadias.service.js';
import { obtenerContextoMesa } from './mesa-cliente.service.js';
import { rutaClientePorEstado } from '../utils/navegacion-cliente.js';

export async function resolverRutaClienteAlArrancar() {
  let perfil;
  try {
    perfil = await obtenerPerfilActual();
  } catch {
    return null;
  }

  const [espera, estadia] = await Promise.all([
    obtenerMiEspera(),
    obtenerMiEstadiaActiva(),
  ]);
  let mesaValidada = false;
  if (estadia) {
    try {
      await obtenerContextoMesa(estadia.id);
      mesaValidada = true;
    } catch (error) {
      // 42501 significa que todavía debe escanear el QR de la mesa. Otros
      // errores tampoco habilitan la carta: se conserva el cierre seguro.
      mesaValidada = false;
    }
  }
  return rutaClientePorEstado({ perfil, espera, estadia, mesaValidada });
}
