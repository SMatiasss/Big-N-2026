import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/supabase.config.js';

let supabase;

export function initSupabase() {
  if (!supabase) {
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return supabase;
}

export function getSupabase() {
  if (!supabase) {
    throw new Error('Supabase no fue inicializado. Llamá a initSupabase() primero.');
  }
  return supabase;
}

let supabaseAislado;

// Cliente aparte para crear usuarios en Auth SIN pisar la sesión abierta.
// auth.signUp() inicia sesión automáticamente con el usuario recién creado y
// la guarda en el storage compartido: si el dueño da de alta un empleado, la
// app pasa a estar logueada como ese empleado (y el alta del perfil termina
// fallando por RLS, porque el nuevo usuario todavía no tiene rol).
// Con persistSession en false este cliente nunca toca ese storage, así que la
// sesión del dueño queda intacta en el cliente principal.
export function getSupabaseAislado() {
  if (!supabaseAislado) {
    supabaseAislado = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
  return supabaseAislado;
}
