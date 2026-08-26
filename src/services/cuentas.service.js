// Generar cuenta, confirmar pago (puntos 21, 22).
import { getSupabase } from './supabase.client.js';
import { TABLAS } from '../config/constantes.js';

export async function generarCuenta(cuenta) {
  const { data, error } = await getSupabase().from(TABLAS.CUENTAS).insert(cuenta).select().single();
  if (error) throw error;
  return data;
}

export async function confirmarPago(cuentaId) {
  const { data, error } = await getSupabase()
    .from(TABLAS.CUENTAS)
    .update({ pagada: true })
    .eq('id', cuentaId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
