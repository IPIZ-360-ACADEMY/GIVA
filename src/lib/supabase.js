import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabasePublishableKey =
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? import.meta.env.VITE_SUPABASE_ANON_KEY;
const isTestMode = import.meta.env.MODE === "test";
const hasValidHttpsUrl = typeof supabaseUrl === "string" && /^https:\/\//i.test(supabaseUrl);

if (!isTestMode && supabaseUrl && !hasValidHttpsUrl) {
  console.error("[supabase] URL inválida: VITE_SUPABASE_URL deve começar com https://");
}

export const isSupabaseConfigured = !isTestMode && hasValidHttpsUrl && Boolean(supabasePublishableKey);

if (!isTestMode && !isSupabaseConfigured) {
  console.warn("[supabase] Credenciais não configuradas ou inválidas - modo demo ativo");
}

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey)
  : null;