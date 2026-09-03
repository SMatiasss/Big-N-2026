import { ESTADOS_PERFIL, ROLES } from '../config/constantes.js';

// Auth identifica a la persona; perfiles determina si puede entrar al restaurante.
// El cliente anónimo no necesita aprobación, pero un perfil inactivo no puede entrar.
export function obtenerMotivoBloqueo(perfil) {
  if (!perfil) return 'No se encontró tu perfil. Contactá al equipo del restaurante.';
  if (perfil.activo !== true) return 'Tu perfil está inactivo. Contactá al restaurante.';
  if (perfil.rol !== ROLES.CLIENTE_REGISTRADO) return '';
  if (perfil.estado === ESTADOS_PERFIL.APROBADO) return '';
  if (perfil.estado === ESTADOS_PERFIL.RECHAZADO) return 'Tu registro fue rechazado. Contactá al restaurante.';
  return 'Tu registro está pendiente de aprobación. Todavía no podés ingresar.';
}

export function puedeResolverClientes(perfil) {
  return Boolean(perfil?.activo === true
    && perfil.estado === ESTADOS_PERFIL.APROBADO
    && [ROLES.DUENO, ROLES.SUPERVISOR].includes(perfil.rol));
}
