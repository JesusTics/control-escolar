// Cliente de Supabase para Server Components y Server Actions (adaptador de
// infraestructura). Usa las cookies de la request (`next/headers`) para leer
// y refrescar la sesión del usuario en el servidor.
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    "Faltan variables de entorno de Supabase: define NEXT_PUBLIC_SUPABASE_URL y " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY en tu archivo .env.local (ver .env.example).",
  );
}

export async function crearClienteServidor() {
  const cookieStore = await cookies();

  return createServerClient(supabaseUrl!, supabaseAnonKey!, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // `setAll` puede lanzar si se llama desde un Server Component
          // (en vez de un Server Action o Route Handler), porque ahí las
          // cookies son de solo lectura. Es seguro ignorarlo: el middleware
          // (`src/middleware.ts`) ya se encarga de refrescar la sesión en
          // cada request.
        }
      },
    },
  });
}
