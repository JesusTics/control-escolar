// Refresco de sesión de Supabase en cada request (patrón oficial de
// `@supabase/ssr` para Next.js App Router). Se invoca desde
// `src/middleware.ts`.
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export async function actualizarSesion(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      "Faltan variables de entorno de Supabase: define NEXT_PUBLIC_SUPABASE_URL y " +
        "NEXT_PUBLIC_SUPABASE_ANON_KEY en tu archivo .env.local (ver .env.example).",
    );
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        supabaseResponse = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          supabaseResponse.cookies.set(name, value, options);
        }
      },
    },
  });

  // No quitar: `getUser()` revalida el token contra Supabase Auth y es lo
  // que dispara el refresco de la sesión expirada. No usar `getSession()`
  // aquí, que solo lee cookies sin validar.
  await supabase.auth.getUser();

  return supabaseResponse;
}
