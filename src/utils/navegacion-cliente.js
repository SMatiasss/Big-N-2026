import { ROLES } from '../config/constantes.js';

export function rutaClientePorEstado({ perfil, espera, estadia, mesaValidada }) {
  if (!perfil?.activo || ![ROLES.CLIENTE_REGISTRADO, ROLES.CLIENTE_ANONIMO].includes(perfil.rol)) return null;
  if (perfil.rol === ROLES.CLIENTE_REGISTRADO && perfil.estado !== 'aprobado') return null;
  if (estadia && mesaValidada) return '/mesa/carta';
  if (estadia || espera) return '/lista-espera';
  return null;
}
