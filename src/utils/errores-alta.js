// Traducción de los errores del alta de un perfil (empleado y cliente) a un
// mensaje para pantalla, señalando el campo culpable cuando se lo puede
// identificar.
//
// Vive acá y no en cada pantalla porque las dos altas crean el usuario de
// Auth y después insertan el perfil, así que fallan de las mismas maneras.

/* Los índices únicos de la tabla (ver supabase/migrations/01_schema.sql).
   Postgres nombra la restricción que chocó dentro del mensaje, así se puede
   señalar el campo exacto en vez de un "DNI o CUIL ya registrado" que
   obligaba a adivinar cuál de los dos era. */

const RESTRICCIONES_UNICAS = [
  { patron: 'uq_perfiles_dni', campo: 'dni', mensaje: 'Ese DNI ya está registrado.' },
  { patron: 'uq_perfiles_cuil', campo: 'cuil', mensaje: 'Ese CUIL ya está registrado.' },
];

/**
 * @param {any} error - El error tal como lo tiró Supabase.
 * @param {object} opciones
 * @param {(campo: string, mensaje: string) => void} opciones.marcarCampo
 *   Marca ese campo del formulario como inválido. Si la pantalla no tiene
 *   ese campo (el alta de cliente no pide CUIL), no hace nada.
 * @returns {string} El mensaje para el toast.
 */
export function mensajeDeErrorAlta(error, { marcarCampo = () => {} } = {}) {

  if (error?.code === '23505') {
    const choque = RESTRICCIONES_UNICAS.find(
      (restriccion) => error.message?.includes(restriccion.patron)
    );

    if (choque) {
      marcarCampo(choque.campo, choque.mensaje);
      return choque.mensaje;
    }

    return 'Ya existe alguien registrado con esos datos.';
  }

  /* El correo existe en Auth pero no en perfiles, así que el chequeo previo
     lo dio por libre: es un usuario que quedó de un alta anterior cortada a
     la mitad. Desde el cliente no se puede borrar, y lo único que destraba
     es usar otro correo. Conviene decirlo en esos términos en vez de dejar
     corrigiendo campos que ya estaban bien. */

  if (error?.message?.includes('already registered')) {
    const mensaje = 'Ese correo ya tiene un usuario creado. Usá otro.';
    marcarCampo('email', mensaje);
    return mensaje;
  }

  if (error?.code === '22P02') return 'Rol o estado inválido.';
  if (error?.code === '42501') return 'Sin permisos (RLS).';

  if (error?.message?.includes('rate limit')) {
    return 'Demasiados intentos seguidos. Esperá unos minutos.';
  }

  return error?.message || 'No se pudo completar el alta.';
}
