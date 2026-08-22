import { redirect } from "next/navigation";
import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { listarMaterias } from "@/modules/calificaciones/casos-uso/listar-materias";
import { FormularioRegistrarCalificacion } from "./formulario";

export default async function PaginaNuevaCalificacion({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await crearClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const resultado = await listarMaterias(supabase);

  if (!resultado.exito) {
    throw new Error(resultado.error);
  }

  const { materias } = resultado;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 bg-zinc-50 px-6 py-16">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900">
          Registrar calificación
        </h1>
        <p className="text-zinc-600">
          Captura la calificación del alumno en una materia y periodo
        </p>
      </div>

      {materias.length === 0 ? (
        <div className="flex flex-col items-center gap-4 text-center">
          <p className="max-w-sm text-zinc-600">
            Todavía no hay materias en tu plantel. Crea una primero para
            poder registrar calificaciones.
          </p>
          <Link
            href="/materias/nueva"
            className="flex h-14 w-full max-w-xs items-center justify-center rounded-lg bg-zinc-900 text-lg font-semibold text-white transition-colors hover:bg-zinc-700"
          >
            Crear materia
          </Link>
          <Link
            href={`/alumnos/${id}`}
            className="text-center text-sm font-medium text-zinc-900 underline"
          >
            Volver
          </Link>
        </div>
      ) : (
        <FormularioRegistrarCalificacion alumnoId={id} materias={materias} />
      )}
    </div>
  );
}
