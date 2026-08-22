// Cliente de Supabase para el navegador (adaptador de infraestructura).
//
// Usa `createBrowserClient` de `@supabase/ssr` (en vez de `createClient` de
// `@supabase/supabase-js` directo) para que la sesión se comparta de forma
// consistente entre Server Components/Server Actions y el cliente vía
// cookies, en lugar de vivir solo en localStorage del navegador.
import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Faltan variables de entorno de Supabase: define NEXT_PUBLIC_SUPABASE_URL y " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY en tu archivo .env.local (ver .env.example).",
  );
}

export function crearClienteNavegador() {
  return createBrowserClient(supabaseUrl!, supabaseAnonKey!);
}
