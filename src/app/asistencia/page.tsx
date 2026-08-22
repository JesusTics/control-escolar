import { redirect } from "next/navigation";
import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { listarAlumnosParaCaptura } from "@/modules/asistencia/casos-uso/listar-alumnos-para-captura";
import { FormularioCapturaAsistencia } from "./formulario";

export default async function PaginaAsistencia() {
  const supabase = await crearClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const resultado = await listarAlumnosParaCaptura(supabase);

  if (!resultado.exito) {
    throw new Error(resultado.error);
  }

  const { alumnos } = resultado;
  const hoy = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-1 flex-col gap-8 bg-zinc-50 px-6 py-16">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-semibold text-zinc-900">Asistencia</h1>
          <p className="text-zinc-600">
            Captura la asistencia diaria del plantel
          </p>
        </div>

        {alumnos.length === 0 ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="max-w-sm text-zinc-600">
              Todavía no hay alumnos activos en tu plantel. Inscribe alumnos
              primero para poder capturar asistencia.
            </p>
            <Link
              href="/alumnos/nuevo"
              className="flex h-14 w-full max-w-xs items-center justify-center rounded-lg bg-zinc-900 text-lg font-semibold text-white transition-colors hover:bg-zinc-700"
            >
              Inscribir alumno
            </Link>
          </div>
        ) : (
          <FormularioCapturaAsistencia alumnos={alumnos} fechaInicial={hoy} />
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
