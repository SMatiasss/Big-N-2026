// Flujo invitado: el botón atrás de Android no navega, pregunta si se quiere
// cerrar la sesión de invitado. Sólo aplica a sesiones anónimas; para
// cualquier otro rol la pantalla se comporta normal.
//
// Uso: const soltar = atajarAtrasInvitado(); ... y al salir de la pantalla,
// soltar().
import { crearModalConfirmacion } from '../components/modal-confirmacion/modal-confirmacion.js';
import { ROLES } from '../config/constantes.js';
import { alPresionarAtras, reemplazarRuta } from '../router.js';
import { obtenerPerfilActual, signOut } from '../services/auth.service.js';
import { borrarTokenActual } from '../services/notificaciones.service.js';

export function atajarAtrasInvitado() {
  let soltar = () => {};
  let activo = true;
  let modal = null;

  async function preguntar() {
    // Atrás con la pregunta ya abierta: la cierra, como "Cancelar".
    if (modal) {
      modal.cerrar('cancel');
      return;
    }

    modal = crearModalConfirmacion({
      variante: 'error',
      titulo: '¿Deseas cerrar la sesión como invitado?',
      mensaje: 'Vas a salir y, para volver a entrar, tendrás que ingresar de nuevo como invitado.',
      botones: [
        { texto: 'Cancelar', rol: 'cancel' },
        { texto: 'Cerrar sesión', rol: 'confirmar', destacado: true },
      ],
    });
    const rol = await modal.presentar();
    modal = null;
    if (rol !== 'confirmar') return;

    // Mismo cierre que el botón de salir del inicio.
    soltar();
    try { await borrarTokenActual(); } catch (error) { console.error('No se pudo borrar el token de avisos.', error); }
    try { await signOut(); } catch (error) { console.error('No se pudo cerrar la sesión.', error); }
    reemplazarRuta('/login');
  }

  // El perfil ya está en caché en este punto del flujo: la respuesta es
  // inmediata. Si la pantalla se cerró antes, no se registra nada.
  obtenerPerfilActual()
    .then((perfil) => {
      if (activo && perfil?.rol === ROLES.CLIENTE_ANONIMO) soltar = alPresionarAtras(preguntar);
    })
    .catch(() => {});

  return () => {
    activo = false;
    soltar();
    modal?.cerrar('cancel');
  };
}
