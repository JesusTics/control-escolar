import { redirect } from "next/navigation";
import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerKardexAlumno } from "@/modules/calificaciones/casos-uso/obtener-kardex-alumno";

export default async function PaginaKardexAlumno({
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

  const resultado = await obtenerKardexAlumno(supabase, id);

  if (!resultado.exito) {
    throw new Error(resultado.error);
  }

  const { kardex } = resultado;

  return (
    <div className="flex flex-1 flex-col gap-8 bg-zinc-50 px-6 py-16">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-semibold text-zinc-900">
            {kardex.alumno.nombre_completo}
          </h1>
          <p className="text-zinc-600">Matrícula: {kardex.alumno.matricula}</p>
        </div>

        <div className="flex flex-col items-center gap-1 rounded-lg border border-zinc-200 bg-white px-4 py-6">
          <span className="text-sm font-medium text-zinc-600">
            Promedio general
          </span>
          <span className="text-4xl font-bold text-zinc-900">
            {kardex.promedioGeneral !== null
              ? kardex.promedioGeneral.toFixed(2)
              : "—"}
          </span>
        </div>

        <Link
          href={`/alumnos/${id}/calificaciones/nueva`}
          className="flex h-14 w-full items-center justify-center rounded-lg bg-zinc-900 text-lg font-semibold text-white transition-colors hover:bg-zinc-700"
        >
          Registrar calificación
        </Link>

        {kardex.calificaciones.length === 0 ? (
          <p className="text-center text-zinc-600">
            Todavía no hay calificaciones registradas.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
            {kardex.calificaciones.map((calificacion) => (
              <div
                key={calificacion.id}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <div className="flex flex-col">
                  <span className="font-medium text-zinc-900">
                    {calificacion.materiaNombre}
                  </span>
                  <span className="text-sm text-zinc-600">
                    Periodo: {calificacion.periodo}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-lg font-semibold text-zinc-900">
                    {calificacion.calificacion}
                  </span>
                  <span
                    className={
                      calificacion.aprobado
                        ? "rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800"
                        : "rounded-full bg-red-100 px-3 py-1 text-sm font-medium text-red-800"
                    }
                  >
                    {calificacion.aprobado ? "Aprobado" : "Reprobado"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}

        <Link
          href="/alumnos"
          className="text-center text-sm font-medium text-zinc-900 underline"
        >
          Volver a alumnos
        </Link>
      </div>
    </div>
  );
}
