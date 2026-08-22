import { redirect } from "next/navigation";
import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { listarMaterias } from "@/modules/calificaciones/casos-uso/listar-materias";

export default async function PaginaMaterias() {
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
    <div className="flex flex-1 flex-col gap-8 bg-zinc-50 px-6 py-16">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-semibold text-zinc-900">Materias</h1>
          <p className="text-zinc-600">Materias del plantel</p>
        </div>

        <Link
          href="/materias/nueva"
          className="flex h-14 w-full items-center justify-center rounded-lg bg-zinc-900 text-lg font-semibold text-white transition-colors hover:bg-zinc-700"
        >
          Nueva materia
        </Link>

        {materias.length === 0 ? (
          <p className="text-center text-zinc-600">
            Todavía no hay materias registradas.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
            {materias.map((materia) => (
              <div key={materia.id} className="px-4 py-3">
                <span className="font-medium text-zinc-900">
                  {materia.nombre}
                </span>
              </div>
            ))}
          </div>
        )}

        <Link
          href="/dashboard"
          className="text-center text-sm font-medium text-zinc-900 underline"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
