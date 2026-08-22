import { redirect } from "next/navigation";
import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { listarAlumnos } from "@/modules/alumnos/casos-uso/listar-alumnos";
import { obtenerPerfilActual } from "@/modules/identidad/casos-uso/obtener-perfil-actual";

// Mismos roles que exige la política RLS `alumnos_insert_staff_mismo_plantel`
// (ver supabase/migrations/20260822165852_alumnos_alta_y_listado.sql) — se
// replica aquí para no mostrar un botón de "Inscribir alumno" que siempre
// fallaría por RLS para docente/alumno (CLAUDE.md 7: texto explícito, nunca
// una acción que no se puede completar).
const ROLES_PUEDEN_INSCRIBIR = ["administrativo", "oficina_central"];

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

  const resultadoPerfil = await obtenerPerfilActual(supabase);

  if (!resultadoPerfil.exito) {
    throw new Error(resultadoPerfil.error);
  }

  const puedeInscribir =
    !!resultadoPerfil.perfil &&
    ROLES_PUEDEN_INSCRIBIR.includes(resultadoPerfil.perfil.rol);

  return (
    <div className="flex flex-1 flex-col gap-8 bg-zinc-50 px-6 py-16">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-semibold text-zinc-900">Alumnos</h1>
          <p className="text-zinc-600">
            Alumnos inscritos en tu plantel
          </p>
        </div>

        {/* Navegación entre módulos (Materias/Asistencia/Avisos/Invitar
            usuarios) vive en `/dashboard`, ya filtrada por rol — aquí solo
            queda la acción propia de esta pantalla. */}
        {puedeInscribir && (
          <Link
            href="/alumnos/nuevo"
            className="flex h-14 w-full items-center justify-center rounded-lg bg-zinc-900 text-lg font-semibold text-white transition-colors hover:bg-zinc-700"
          >
            Inscribir alumno
          </Link>
        )}

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
