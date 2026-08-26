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
