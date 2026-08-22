import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { FormularioInicioSesion } from "./formulario";

export default async function PaginaLogin() {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 bg-zinc-50 px-6 py-16">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900">
          Iniciar sesión
        </h1>
        <p className="text-zinc-600">Control Escolar</p>
      </div>
      <FormularioInicioSesion />
    </div>
  );
}
