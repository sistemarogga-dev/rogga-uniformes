import { createClient } from "@supabase/supabase-js";

// Cliente do Supabase para uso NO SERVIDOR (usa a service_role key, que ignora RLS).
// Nunca exponha a service_role key no navegador.
export function getSupabase() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase não configurado. Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no .env.local.");
  }
  return createClient(url, key, { auth: { persistSession: false } });
}
