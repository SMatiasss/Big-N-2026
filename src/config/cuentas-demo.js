// Cuentas de prueba creadas por el seed (02_seed.sql, crear_usuario_demo).
// Sirven para el "acceso rápido" del login: una cuenta por cada rol, para no
// tener que escribir el mail y la contraseña en cada demo o corrección.
// Si el seed cambia, este archivo es el único lugar a tocar.
import { ETIQUETAS_ROL, ROLES } from './constantes.js';

// Todos los usuarios del seed comparten la misma clave (ver 02_seed.sql).
export const PASSWORD_DEMO = '111111';

// En la tarjeta entra una sola palabra: para el cliente registrado se acorta
// la etiqueta general ('Cliente registrado') a 'Cliente'.
export const CUENTAS_DEMO = [
  { rol: ROLES.DUENO, email: 'dueno@larosaria.com' },
  { rol: ROLES.SUPERVISOR, email: 'supervisor@larosaria.com' },
  { rol: ROLES.METRE, email: 'metre@larosaria.com' },
  { rol: ROLES.MOZO, email: 'mozo@larosaria.com' },
  { rol: ROLES.COCINERO, email: 'cocinero@larosaria.com' },
  { rol: ROLES.CANTINERO, email: 'cantinero@larosaria.com' },
  { rol: ROLES.CLIENTE_REGISTRADO, email: 'cliente@mail.com', etiqueta: 'Cliente' },
].map((cuenta) => ({ etiqueta: ETIQUETAS_ROL[cuenta.rol], ...cuenta }));
