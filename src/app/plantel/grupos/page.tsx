import { redirect } from "next/navigation";
import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerPerfilActual } from "@/modules/identidad/casos-uso/obtener-perfil-actual";
import { listarDocentesPlantel } from "@/modules/identidad/casos-uso/listar-docentes-plantel";
import { listarMaterias } from "@/modules/calificaciones/casos-uso/listar-materias";
import { listarGruposPlantel } from "@/modules/grupos/casos-uso/listar-grupos-plantel";
import { FormularioCrearGrupo } from "./formulario";

// Mismos roles que exigen las políticas RLS `grupos_insert_staff`/
// `grupos_update_staff` — se replica aquí para dar un mensaje de "no tienes
// permiso" explícito, mismo criterio que `/plantel/invitaciones`.
const ROLES_CON_ACCESO = ["administrativo", "oficina_central"];

export default async function PaginaGrupos() {
  const supabase = await crearClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const resultadoPerfil = await obtenerPerfilActual(supabase);

  if (!resultadoPerfil.exito) {
    throw new Error(resultadoPerfil.error);
  }

  const { perfil } = resultadoPerfil;

  if (!perfil || !ROLES_CON_ACCESO.includes(perfil.rol)) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900">
          No tienes permiso para ver esta página
        </h1>
        <p className="max-w-md text-zinc-600">
          Solo el personal administrativo puede crear y gestionar grupos.
        </p>
        <Link
          href="/dashboard"
          className="text-sm font-medium text-zinc-900 underline"
        >
          Volver al inicio
        </Link>
      </div>
    );
  }

  const [resultadoMaterias, resultadoDocentes, resultadoGrupos] =
    await Promise.all([
      listarMaterias(supabase),
      listarDocentesPlantel(supabase),
      listarGruposPlantel(supabase),
    ]);

  if (!resultadoMaterias.exito) {
    throw new Error(resultadoMaterias.error);
  }

  if (!resultadoDocentes.exito) {
    throw new Error(resultadoDocentes.error);
  }

  if (!resultadoGrupos.exito) {
    throw new Error(resultadoGrupos.error);
  }

  const { materias } = resultadoMaterias;
  const { docentes } = resultadoDocentes;
  const { grupos } = resultadoGrupos;

  return (
    <div className="flex flex-1 flex-col gap-8 bg-zinc-50 px-6 py-16">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-semibold text-zinc-900">Grupos</h1>
          <p className="text-zinc-600">
            Crea grupos por materia/periodo e inscribe alumnos a cada uno
          </p>
        </div>

        {materias.length === 0 ? (
          <div className="flex flex-col items-center gap-4 text-center">
            <p className="max-w-sm text-zinc-600">
              Todavía no hay materias en tu plantel. Crea una primero para
              poder crear un grupo.
            </p>
            <Link
              href="/materias/nueva"
              className="flex h-14 w-full max-w-xs items-center justify-center rounded-lg bg-zinc-900 text-lg font-semibold text-white transition-colors hover:bg-zinc-700"
            >
              Crear materia
            </Link>
          </div>
        ) : (
          <FormularioCrearGrupo materias={materias} docentes={docentes} />
        )}

        {grupos.length === 0 ? (
          <p className="text-center text-zinc-600">
            Todavía no hay grupos en tu plantel.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
            {grupos.map((grupo) => (
              <div
                key={grupo.id}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <div className="flex flex-col">
                  <span className="font-medium text-zinc-900">
                    {grupo.materiaNombre} — {grupo.nombre}
                  </span>
                  <span className="text-sm text-zinc-600">
                    Periodo: {grupo.periodo} · Docente:{" "}
                    {grupo.docenteNombre ?? "Sin asignar"}
                  </span>
                </div>
                <Link
                  href={`/plantel/grupos/${grupo.id}`}
                  className="text-sm font-medium text-zinc-900 underline"
                >
                  Gestionar inscripciones
                </Link>
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
