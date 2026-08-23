import { redirect } from "next/navigation";
import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerPerfilActual } from "@/modules/identidad/casos-uso/obtener-perfil-actual";
import { listarDocentesPlantel } from "@/modules/identidad/casos-uso/listar-docentes-plantel";
import { listarAlumnos } from "@/modules/alumnos/casos-uso/listar-alumnos";
import { listarGruposPlantel } from "@/modules/grupos/casos-uso/listar-grupos-plantel";
import { listarInscripcionesGrupo } from "@/modules/grupos/casos-uso/listar-inscripciones-grupo";
import { SelectorDocenteGrupo } from "./selector-docente";
import { FormularioInscribirAlumno } from "./formulario-inscripcion";
import { BotonDesinscribir } from "./fila-inscripcion";

const ROLES_CON_ACCESO = ["administrativo", "oficina_central"];

export default async function PaginaDetalleGrupo({
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
          Solo el personal administrativo puede gestionar grupos.
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

  const [resultadoGrupos, resultadoDocentes, resultadoAlumnos, resultadoInscripciones] =
    await Promise.all([
      listarGruposPlantel(supabase),
      listarDocentesPlantel(supabase),
      listarAlumnos(supabase),
      listarInscripcionesGrupo(supabase, id),
    ]);

  if (!resultadoGrupos.exito) {
    throw new Error(resultadoGrupos.error);
  }

  if (!resultadoDocentes.exito) {
    throw new Error(resultadoDocentes.error);
  }

  if (!resultadoAlumnos.exito) {
    throw new Error(resultadoAlumnos.error);
  }

  if (!resultadoInscripciones.exito) {
    throw new Error(resultadoInscripciones.error);
  }

  const grupo = resultadoGrupos.grupos.find((g) => g.id === id);

  if (!grupo) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900">
          No se encontró el grupo
        </h1>
        <Link
          href="/plantel/grupos"
          className="text-sm font-medium text-zinc-900 underline"
        >
          Volver a grupos
        </Link>
      </div>
    );
  }

  const { docentes } = resultadoDocentes;
  const { inscripciones } = resultadoInscripciones;

  const idsInscritos = new Set(inscripciones.map((i) => i.alumno_id));
  const alumnosDisponibles = resultadoAlumnos.alumnos.filter(
    (alumno) => !idsInscritos.has(alumno.id),
  );

  return (
    <div className="flex flex-1 flex-col gap-8 bg-zinc-50 px-6 py-16">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-semibold text-zinc-900">
            {grupo.materiaNombre} — {grupo.nombre}
          </h1>
          <p className="text-zinc-600">Periodo: {grupo.periodo}</p>
        </div>

        <div className="rounded-lg border border-zinc-200 bg-white px-4 py-4">
          <SelectorDocenteGrupo
            grupoId={grupo.id}
            docenteIdActual={grupo.docente_id}
            docentes={docentes}
          />
        </div>

        {alumnosDisponibles.length === 0 ? (
          <p className="text-center text-zinc-600">
            {resultadoAlumnos.alumnos.length === 0
              ? "Todavía no hay alumnos en tu plantel."
              : "Todos los alumnos del plantel ya están inscritos en este grupo."}
          </p>
        ) : (
          <FormularioInscribirAlumno
            grupoId={grupo.id}
            alumnosDisponibles={alumnosDisponibles}
          />
        )}

        <div className="flex flex-col gap-3">
          <h2 className="text-center text-xl font-semibold text-zinc-900">
            Alumnos inscritos
          </h2>
          {inscripciones.length === 0 ? (
            <p className="text-center text-zinc-600">
              Todavía no hay alumnos inscritos en este grupo.
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
              {inscripciones.map((inscripcion) => (
                <div
                  key={inscripcion.id}
                  className="flex items-center justify-between gap-4 px-4 py-3"
                >
                  <div className="flex flex-col">
                    <span className="font-medium text-zinc-900">
                      {inscripcion.alumnoNombre}
                    </span>
                    <span className="text-sm text-zinc-600">
                      Matrícula: {inscripcion.alumnoMatricula}
                    </span>
                  </div>
                  <BotonDesinscribir
                    inscripcionId={inscripcion.id}
                    grupoId={grupo.id}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <Link
          href="/plantel/grupos"
          className="text-center text-sm font-medium text-zinc-900 underline"
        >
          Volver a grupos
        </Link>
      </div>
    </div>
  );
}
