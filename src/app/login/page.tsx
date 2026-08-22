import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { FormularioInicioSesion } from "./formulario";

interface PropiedadesPaginaLogin {
  // Next.js pasa `searchParams` como Promise en Server Components (App
  // Router). Se usa para mostrar el error que `/auth/callback` agrega a la
  // URL cuando la confirmación de correo falla (código inválido/expirado o
  // metadata faltante) — ver src/app/auth/callback/route.ts.
  searchParams: Promise<{ error?: string }>;
}

export default async function PaginaLogin({
  searchParams,
}: PropiedadesPaginaLogin) {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  const { error } = await searchParams;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 bg-zinc-50 px-6 py-16">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900">
          Iniciar sesión
        </h1>
        <p className="text-zinc-600">Control Escolar</p>
      </div>
      {error && (
        <p
          className="max-w-sm text-center text-sm font-medium text-red-600"
          role="alert"
        >
          {error}
        </p>
      )}
      <FormularioInicioSesion />
    </div>
  );
}
