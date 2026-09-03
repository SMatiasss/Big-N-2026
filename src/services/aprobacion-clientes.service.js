import { getSupabase } from './supabase.client.js';
import { exigirAdministradorClientes } from './auth.service.js';
import { ESTADOS_PERFIL, ROLES, TABLAS } from '../config/constantes.js';
import { enviarEmailAprobacion, enviarEmailRechazo } from './email.service.js';

const COLUMNAS_LISTADO = 'id, nombres, apellidos, foto_url, estado';

// Se usa después de autorizar al administrador. El evento sólo avisa que hay
// cambios: volvemos a consultar el listado con sus filtros y permisos reales.
export function observarClientesPendientes(onCambio, onEstado = () => {}) {
  const supabase = getSupabase();
  let cerrado = false;
  const canal = supabase.channel(`clientes-pendientes-${crypto.randomUUID()}`)
    .on('postgres_changes', {
      event: '*', schema: 'public', table: TABLAS.PERFILES,
      filter: `rol=eq.${ROLES.CLIENTE_REGISTRADO}`,
    }, () => { if (!cerrado) onCambio(); })
    .subscribe((estado) => {
      if (cerrado) return;
      onEstado(estado);
      // Recupera cambios ocurridos entre el SELECT y la conexión/reconexión.
      if (estado === 'SUBSCRIBED') onCambio();
    });
  return () => {
    if (cerrado) return;
    cerrado = true;
    void supabase.removeChannel(canal).catch(() => {});
  };
}

export async function listarClientesPendientes() {
  return listarClientesPorEstado(ESTADOS_PERFIL.PENDIENTE);
}

export async function listarClientesAceptados() {
  return listarClientesPorEstado(ESTADOS_PERFIL.APROBADO);
}

async function listarClientesPorEstado(estado) {
  await exigirAdministradorClientes();
  // El panel no necesita DNI, correo ni otros datos personales del cliente.
  const { data, error } = await getSupabase().from(TABLAS.PERFILES)
    .select(COLUMNAS_LISTADO)
    .eq('rol', ROLES.CLIENTE_REGISTRADO)
    .eq('estado', estado)
    .order('apellidos').order('nombres').order('id');
  if (error) throw error;
  return data;
}

export async function resolverClientePendiente(clienteId, estado) {
  if (![ESTADOS_PERFIL.APROBADO, ESTADOS_PERFIL.RECHAZADO].includes(estado)) {
    throw new Error('La decisión debe ser aprobar o rechazar.');
  }
  const administrador = await exigirAdministradorClientes();
  // La condición pendiente forma parte del UPDATE: si dos administradores actúan
  // a la vez, sólo el primero modifica la fila. El segundo debe recargar el listado.
  const { data, error } = await getSupabase().from(TABLAS.PERFILES)
    .update({ estado, resuelto_por: administrador.id, resuelto_en: new Date().toISOString() })
    .eq('id', clienteId).eq('rol', ROLES.CLIENTE_REGISTRADO)
    .eq('estado', ESTADOS_PERFIL.PENDIENTE)
    .select(COLUMNAS_LISTADO).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('El cliente ya fue resuelto o no tenés permiso. El listado se actualizará automáticamente.');

  // La decisión ya está guardada. Un fallo de correo no debe repetir ni revertir
  // la aprobación. Las funciones existentes aún necesitan proveedor y despliegue.
  let emailEnviado = false;
  try {
    const enviar = estado === ESTADOS_PERFIL.APROBADO ? enviarEmailAprobacion : enviarEmailRechazo;
    const resultado = await enviar({ id: data.id });
    // Un placeholder que devuelve {ok:true} NO demuestra que haya enviado correo.
    emailEnviado = resultado?.enviado === true;
  } catch {
    // Se devuelve el resultado parcial para mostrarlo sin ocultar el cambio de estado.
  }
  return { cliente: data, emailEnviado };
}
