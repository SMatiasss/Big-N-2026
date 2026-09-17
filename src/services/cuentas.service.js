// Punto 21: el cliente pide la cuenta, escanea el QR de propina y paga.
//
// Lo que NO vive acá: la confirmación del pago por parte del mozo y el cierre
// de la mesa (punto 22), y el cálculo del descuento por juegos (punto 15, lo
// resuelve el trigger de hu15 sobre estadias.descuento_pct).
import { getSupabase } from './supabase.client.js';
import { ESTADOS_CUENTA, ESTADOS_PEDIDO, EVENTOS_CUENTA, TABLAS } from '../config/constantes.js';
import { obtenerMiEstadiaActiva } from './estadias.service.js';
import { avisarCuenta } from './notificaciones.service.js';

// total NO se lee de una cuenta calculada en el frontend: es una columna
// generada en la base (subtotal, descuento y propina), así que siempre se
// trae desde el servidor después de cada update.
const SELECT_CUENTA = `
  id,
  estadia_id,
  subtotal,
  descuento_pct,
  propina_pct,
  total,
  estado,
  solicitada_en,
  pagada_en,
  nivel:niveles_propina ( id, etiqueta, porcentaje )
`;

// Los pedidos rechazados (punto 13) siguen existiendo como historial -nunca se
// borran, ver 03_baja_logica.sql- pero no se cobran: por eso quedan afuera del
// detalle y del subtotal.
async function listarPedidosFacturables(estadiaId) {
  const { data, error } = await getSupabase()
    .from(TABLAS.PEDIDOS)
    .select('id, creado_en, pedido_items ( cantidad, precio_unitario, productos ( nombre ) )')
    .eq('estadia_id', estadiaId)
    .neq('estado', ESTADOS_PEDIDO.RECHAZADO)
    .order('creado_en', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// Un solo renglón por ítem pedido, en el orden en que se pidieron. El precio
// unitario sale de pedido_items, que lo congela al momento del pedido: si el
// cocinero cambia el precio después, la cuenta no se mueve (ver 01_schema.sql).
export function aplanarItems(pedidos) {
  return pedidos.flatMap((pedido) => (pedido.pedido_items ?? []).map((item) => ({
    nombre: item.productos?.nombre ?? 'Producto',
    cantidad: Number(item.cantidad),
    precioUnitario: Number(item.precio_unitario),
    importe: Number(item.cantidad) * Number(item.precio_unitario),
  })));
}

export function calcularSubtotal(pedidos) {
  return aplanarItems(pedidos).reduce((suma, item) => suma + item.importe, 0);
}

export async function obtenerCuentaDeEstadia(estadiaId) {
  const { data, error } = await getSupabase()
    .from(TABLAS.CUENTAS)
    .select(SELECT_CUENTA)
    .eq('estadia_id', estadiaId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Todo lo que necesita la pantalla de la cuenta en una sola llamada: la
// estadía (de donde sale el descuento de juegos), el detalle de lo consumido
// y la cuenta si ya estaba pedida.
export async function obtenerResumenCuenta() {
  const estadia = await obtenerMiEstadiaActiva();
  if (!estadia) return null;

  const [pedidos, cuenta] = await Promise.all([
    listarPedidosFacturables(estadia.id),
    obtenerCuentaDeEstadia(estadia.id),
  ]);

  return { estadia, pedidos, cuenta, items: aplanarItems(pedidos), subtotal: calcularSubtotal(pedidos) };
}

// Idempotente a propósito: la llama el botón "Pedir la cuenta" del punto 19 y
// también la propia pantalla de la cuenta al abrirse (por si el cliente entró
// directo, recargó, o volvió desde una notificación). Si la cuenta ya existía
// no la duplica ni vuelve a avisarle al mozo.
export async function solicitarCuenta() {
  const estadia = await obtenerMiEstadiaActiva();
  if (!estadia) throw new Error('No encontramos una mesa abierta a tu nombre.');

  const existente = await obtenerCuentaDeEstadia(estadia.id);
  if (existente) return { cuenta: existente, creada: false };

  const pedidos = await listarPedidosFacturables(estadia.id);

  const { data, error } = await getSupabase()
    .from(TABLAS.CUENTAS)
    .insert({
      estadia_id: estadia.id,
      subtotal: calcularSubtotal(pedidos),
      // El descuento por juegos ya está resuelto en la estadía por el trigger
      // de HU15 (y no es acumulable): acá sólo se copia, nunca se recalcula.
      descuento_pct: estadia.descuento_pct ?? 0,
      estado: ESTADOS_CUENTA.PENDIENTE,
    })
    .select(SELECT_CUENTA)
    .single();

  // estadia_id es unique: si el cliente toca dos veces casi a la vez, el
  // segundo insert rebota con 23505 y se resuelve leyendo la fila que ganó.
  if (error?.code === '23505') {
    return { cuenta: await obtenerCuentaDeEstadia(estadia.id), creada: false };
  }
  if (error) throw error;

  // Alcance de este aviso: SÓLO el mozo (el de "pagada" suma dueño y
  // supervisor). Es best-effort: la cuenta ya quedó pedida aunque el push falle.
  await avisarCuenta(estadia.id, EVENTOS_CUENTA.SOLICITADA)
    .catch((errorPush) => console.error('La cuenta se pidió, pero no se pudo avisar al mozo.', errorPush));

  return { cuenta: data, creada: true };
}

// El QR de propina se valida contra la base (niveles_propina.qr_token), nunca
// contra una lista hardcodeada: por eso no se puede falsear desde el cliente.
// Se admite el token pelado o con prefijo "propina:", mismo criterio que el QR
// de ingreso (ver qr.service.js), porque todavía no está definido cómo se
// imprime el QR físico.
export async function validarQrPropina(contenido) {
  const token = String(contenido ?? '').trim().replace(/^propina:/i, '');
  // Comparar un texto cualquiera contra una columna uuid hace fallar la
  // consulta (22P02), así que un token con formato inválido se descarta antes.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) return null;

  const { data, error } = await getSupabase()
    .from(TABLAS.NIVELES_PROPINA)
    .select('id, etiqueta, porcentaje')
    .eq('qr_token', token)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// Guardar el nivel es lo que destraba el total: hasta que la cuenta no tiene
// nivel_propina_id, la constraint ck_propina_obligatoria impide pasarla a
// cualquier estado que no sea 'pendiente'.
export async function aplicarPropina(estadiaId, nivel) {
  const { data, error } = await getSupabase()
    .from(TABLAS.CUENTAS)
    .update({ nivel_propina_id: nivel.id, propina_pct: nivel.porcentaje })
    .eq('estadia_id', estadiaId)
    .select(SELECT_CUENTA)
    .single();
  if (error) throw error;
  return data;
}

export async function pagarCuenta(estadiaId) {
  const { data, error } = await getSupabase()
    .from(TABLAS.CUENTAS)
    .update({ estado: ESTADOS_CUENTA.PAGADA, pagada_en: new Date().toISOString() })
    .eq('estadia_id', estadiaId)
    .select(SELECT_CUENTA)
    .single();

  // La regla "sin propina no hay total" ya la impone la base
  // (ck_propina_obligatoria); acá sólo se traduce a algo legible por si la
  // pantalla llegara a ofrecer el pago antes de tiempo.
  if (error?.code === '23514') {
    throw new Error('Antes de pagar tenés que escanear el QR de propina.');
  }
  if (error) throw error;

  // Alcance distinto al aviso de "pidió la cuenta": este va al mozo, al dueño
  // y al supervisor juntos.
  await avisarCuenta(estadiaId, EVENTOS_CUENTA.PAGADA)
    .catch((errorPush) => console.error('El pago se registró, pero no se pudo avisar al personal.', errorPush));

  return data;
}

// Punto 22 (todavía sin implementar): cuando el mozo confirme el pago, la fila
// pasa a 'confirmada' y la pantalla del cliente se entera por acá sin recargar.
export function suscribirseAMiCuenta(estadiaId, onCambio) {
  const canal = getSupabase()
    .channel(`cuenta-cliente-${estadiaId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: TABLAS.CUENTAS, filter: `estadia_id=eq.${estadiaId}` },
      (payload) => onCambio(payload.new),
    )
    .subscribe();

  return () => { getSupabase().removeChannel(canal); };
}
