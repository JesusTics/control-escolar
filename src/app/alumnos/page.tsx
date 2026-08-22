import { redirect } from "next/navigation";
import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { listarAlumnos } from "@/modules/alumnos/casos-uso/listar-alumnos";

export default async function PaginaAlumnos() {
  const supabase = await crearClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const resultado = await listarAlumnos(supabase);

  if (!resultado.exito) {
    throw new Error(resultado.error);
  }

  const { alumnos } = resultado;

  return (
    <div className="flex flex-1 flex-col gap-8 bg-zinc-50 px-6 py-16">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-semibold text-zinc-900">Alumnos</h1>
          <p className="text-zinc-600">
            Alumnos inscritos en tu plantel
          </p>
        </div>

        <div className="flex gap-3">
          <Link
            href="/alumnos/nuevo"
            className="flex h-14 flex-1 items-center justify-center rounded-lg bg-zinc-900 text-lg font-semibold text-white transition-colors hover:bg-zinc-700"
          >
            Inscribir alumno
          </Link>
          <Link
            href="/materias"
            className="flex h-14 flex-1 items-center justify-center rounded-lg border border-zinc-300 text-lg font-semibold text-zinc-900 transition-colors hover:bg-zinc-100"
          >
            Materias
          </Link>
          <Link
            href="/asistencia"
            className="flex h-14 flex-1 items-center justify-center rounded-lg border border-zinc-300 text-lg font-semibold text-zinc-900 transition-colors hover:bg-zinc-100"
          >
            Asistencia
          </Link>
          <Link
            href="/avisos"
            className="flex h-14 flex-1 items-center justify-center rounded-lg border border-zinc-300 text-lg font-semibold text-zinc-900 transition-colors hover:bg-zinc-100"
          >
            Avisos
          </Link>
          {/* Se agrega siempre; la propia página bloquea con "no tienes
              permiso" si el rol no es administrativo/oficina_central — mismo
              criterio que el resto de esta barra de navegación mínima. */}
          <Link
            href="/plantel/invitaciones"
            className="flex h-14 flex-1 items-center justify-center rounded-lg border border-zinc-300 text-lg font-semibold text-zinc-900 transition-colors hover:bg-zinc-100"
          >
            Invitar usuarios
          </Link>
        </div>

        {alumnos.length === 0 ? (
          <p className="text-center text-zinc-600">
            Todavía no hay alumnos registrados.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
            {alumnos.map((alumno) => (
              <Link
                key={alumno.id}
                href={`/alumnos/${alumno.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-zinc-50"
              >
                <div className="flex flex-col">
                  <span className="font-medium text-zinc-900">
                    {alumno.nombre_completo}
                  </span>
                  <span className="text-sm text-zinc-600">
                    Matrícula: {alumno.matricula}
                  </span>
                </div>
                <span
                  className={
                    alumno.estado === "activo"
                      ? "rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800"
                      : "rounded-full bg-zinc-200 px-3 py-1 text-sm font-medium text-zinc-700"
                  }
                >
                  {alumno.estado}
                </span>
              </Link>
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
