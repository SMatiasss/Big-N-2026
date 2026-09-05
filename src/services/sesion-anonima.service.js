// Cierre automático de sesión para clientes anónimos cuando termina su
// estadía. signInAnonymously() deja una sesión persistida igual que
// cualquier otra, pero un cliente anónimo es de un solo uso por visita: no
// tiene sentido que la sesión siga viva después de que pagó y se fue (ver
// trg_cerrar_estadia en 01_schema.sql, que es quien marca la estadía
// 'cerrada' al confirmarse el pago). No aplica a cliente_registrado ni a
// ningún rol de empleado: todos ellos mantienen su sesión persistente normal,
// sin ningún chequeo de este archivo.
import { getSupabase } from './supabase.client.js';
import { ESTADOS_ESTADIA, ROLES } from '../config/constantes.js';
import { signOut } from './auth.service.js';
import { borrarTokenActual } from './notificaciones.service.js';
import { navegarA } from '../router.js';
import { obtenerMiUltimaEstadia, suscribirseAMiEstadia } from './estadias.service.js';

// null si no hay sesión (nada que revisar); el rol de la sesión actual si la hay.
async function obtenerRolSiHaySesion() {
  const supabase = getSupabase();
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const { data: rol, error } = await supabase.rpc('mi_rol');
  if (error) return null;
  return rol;
}

let cancelarVigilancia = null;

// Caso 1 (app abierta): empieza a escuchar por Realtime el momento en que la
// estadía pasa a 'cerrada' y, cuando pasa, cierra la sesión y manda al
// cliente a /login. Se puede invocar más de una vez en la misma sesión de la
// app (al arrancar y, de nuevo, apenas se crea la estadía tras la asignación
// de mesa): reemplaza cualquier vigilancia anterior en vez de acumular
// canales realtime en paralelo.
function vigilarCierre(estadiaId) {
  cancelarVigilancia?.();
  cancelarVigilancia = suscribirseAMiEstadia(estadiaId, async (filaActualizada) => {
    if (filaActualizada.estado !== ESTADOS_ESTADIA.CERRADA) return;
    cancelarVigilancia?.();
    cancelarVigilancia = null;
    await borrarTokenActual().catch((error) => {
      console.error('No se pudo borrar el token push de la visita finalizada.', error);
    });
    await signOut();
    navegarA('/login');
  });
}

// Arranca (o reengancha) la vigilancia del Caso 1 para el cliente anónimo
// actual, si corresponde. La llama anuncio-cliente apenas detecta -en vivo,
// por su propia suscripción a lista_espera- que le asignaron una mesa: ahí
// recién existe la estadía a vigilar.
export async function vigilarMiEstadiaSiSoyAnonima(estadia) {
  const rol = await obtenerRolSiHaySesion();
  if (rol !== ROLES.CLIENTE_ANONIMO) return;
  if (estadia) vigilarCierre(estadia.id);
}

// Caso 2 (reapertura de la app): si la sesión activa es de un cliente
// anónimo, se busca su estadía más reciente. Si no tiene ninguna o la más
// reciente ya está 'cerrada', esa sesión quedó "huérfana" de una visita
// anterior y se cierra en silencio (sin ningún mensaje) para que arranque
// desde /login como si fuera la primera vez. Si sigue activa, no se toca
// nada -se lo deja entrar normalmente- y de paso se deja andando la
// vigilancia del Caso 1 por si el mozo confirma el pago con la app ya abierta.
// Se llama una sola vez, en main.js, antes de iniciar el router.
export async function verificarSesionAnonimaAlArrancar() {
  const rol = await obtenerRolSiHaySesion();
  if (rol !== ROLES.CLIENTE_ANONIMO) return;

  const ultimaEstadia = await obtenerMiUltimaEstadia();
  if (!ultimaEstadia || ultimaEstadia.estado === ESTADOS_ESTADIA.CERRADA) {
    await borrarTokenActual().catch((error) => {
      console.error('No se pudo borrar el token push de la visita anterior.', error);
    });
    await signOut();
    return;
  }

  vigilarCierre(ultimaEstadia.id);
}
