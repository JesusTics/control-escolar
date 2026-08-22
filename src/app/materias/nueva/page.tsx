import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import { FormularioCrearMateria } from "./formulario";

export default async function PaginaNuevaMateria() {
  const supabase = await crearClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 bg-zinc-50 px-6 py-16">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900">
          Nueva materia
        </h1>
        <p className="text-zinc-600">
          Da de alta una materia para poder registrar calificaciones en ella
        </p>
      </div>
      <FormularioCrearMateria />
    </div>
  );
}
