// Quién puede hacer cada alta. Cada función espeja una policy de RLS
// (01_schema.sql): esto sólo decide qué se muestra en pantalla, la
// autorización real la sigue haciendo la base. Si una policy cambia, este
// archivo es el único lugar de la UI a tocar.
//
// Criterio general de la app: TODO el staff puede ver todas las pantallas de
// gestión (las policies de lectura usan es_empleado()), pero el botón de alta
// de cada pantalla aparece sólo para los roles que pueden crear ahí.
import { ROLES, ROLES_EMPLEADO } from './constantes.js';

// Espeja es_empleado(): dueño, supervisor, metre, mozo, cocinero y cantinero.
export function esEmpleado(rol) {
  return ROLES_EMPLEADO.includes(rol);
}

// productos_alta: (tipo in ('plato','postre') and mi_rol() = 'cocinero') or es_jefe()
export function puedeAltaPlato({ rol, esJefe }) {
  return rol === ROLES.COCINERO || esJefe;
}

// productos_alta: (tipo = 'bebida' and mi_rol() = 'cantinero') or es_jefe()
export function puedeAltaBebida({ rol, esJefe }) {
  return rol === ROLES.CANTINERO || esJefe;
}

// mesas_admin: es_jefe() or mi_rol() = 'metre'
export function puedeAltaMesa({ rol, esJefe }) {
  return esJefe || rol === ROLES.METRE;
}

// perfiles_alta permite además al metre, pero eso es para dar de alta
// clientes; el alta de EMPLEADOS es de dueño y supervisor.
export function puedeAltaEmpleado({ esJefe }) {
  return esJefe;
}

// estadias_alta: mi_rol() = 'metre' or es_jefe(). Asignar una mesa es dar de
// alta una estadía, así que el resto del staff ve la lista pero no asigna.
export function puedeAsignarMesa({ rol, esJefe }) {
  return rol === ROLES.METRE || esJefe;
}
