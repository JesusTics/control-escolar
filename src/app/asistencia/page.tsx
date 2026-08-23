import { redirect } from "next/navigation";
import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerPerfilActual } from "@/modules/identidad/casos-uso/obtener-perfil-actual";
import { listarGruposPlantel } from "@/modules/grupos/casos-uso/listar-grupos-plantel";
import { listarMisGrupos } from "@/modules/grupos/casos-uso/listar-mis-grupos";
import { listarInscripcionesGrupo } from "@/modules/grupos/casos-uso/listar-inscripciones-grupo";
import type { GrupoConNombres } from "@/modules/grupos/dominio/grupo";
import { FormularioCapturaAsistencia } from "./formulario";

const ROLES_STAFF = ["administrativo", "oficina_central"];

export default async function PaginaAsistencia({
  searchParams,
}: {
  searchParams: Promise<{ grupoId?: string; fecha?: string }>;
}) {
  const { grupoId, fecha } = await searchParams;
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
  const esStaff = !!perfil && ROLES_STAFF.includes(perfil.rol);

  // La asistencia se toma por sesión de grupo, no de forma general del
  // plantel (ver ARCHITECTURE.md sección Asistencia): el docente ve solo sus
  // grupos (`listar-mis-grupos`); staff ve todos los del plantel
  // (`listar-grupos-plantel`) — mismo criterio de filtro por rol que ya
  // existía para el selector de materia en
  // /alumnos/[id]/calificaciones/nueva antes de esta sesión.
  const resultadoGrupos = esStaff
    ? await listarGruposPlantel(supabase)
    : await listarMisGrupos(supabase);

  if (!resultadoGrupos.exito) {
    throw new Error(resultadoGrupos.error);
  }

  const { grupos } = resultadoGrupos;
  const hoy = new Date().toISOString().slice(0, 10);
  const fechaSeleccionada = fecha || hoy;

  if (grupos.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900">Asistencia</h1>
        <p className="max-w-md text-zinc-600">
          {esStaff
            ? "Todavía no hay grupos en tu plantel. Crea uno primero para poder capturar asistencia."
            : "Todavía no tienes grupos asignados. Contacta al personal administrativo de tu plantel."}
        </p>
        {esStaff && (
          <Link
            href="/plantel/grupos"
            className="flex h-14 w-full max-w-xs items-center justify-center rounded-lg bg-zinc-900 text-lg font-semibold text-white transition-colors hover:bg-zinc-700"
          >
            Ir a Grupos
          </Link>
        )}
        <Link
          href="/dashboard"
          className="text-center text-sm font-medium text-zinc-900 underline"
        >
          Volver al inicio
        </Link>
      </div>
    );
  }

  const grupoSeleccionado = grupoId
    ? grupos.find((g) => g.id === grupoId)
    : undefined;

  return (
    <div className="flex flex-1 flex-col gap-8 bg-zinc-50 px-6 py-16">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-semibold text-zinc-900">Asistencia</h1>
          <p className="text-zinc-600">
            Elige un grupo y una fecha para capturar asistencia
          </p>
        </div>

        {/* Formulario GET a propósito (sin Server Action): elegir grupo/fecha
            solo cambia qué se muestra en esta misma página vía query string,
            re-renderizada como Server Component — no hay ninguna escritura
            que justifique una Server Action aquí. */}
        <form method="get" className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="grupoId"
              className="text-sm font-medium text-zinc-700"
            >
              Grupo
            </label>
            <select
              id="grupoId"
              name="grupoId"
              required
              defaultValue={grupoSeleccionado?.id ?? ""}
              className="h-12 rounded-lg border border-zinc-300 px-4 text-base"
            >
              <option value="" disabled>
                Selecciona un grupo
              </option>
              {grupos.map((grupo) => (
                <option key={grupo.id} value={grupo.id}>
                  {grupo.materiaNombre} — {grupo.nombre} ({grupo.periodo})
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label
              htmlFor="fecha"
              className="text-sm font-medium text-zinc-700"
            >
              Fecha
            </label>
            <input
              id="fecha"
              name="fecha"
              type="date"
              required
              defaultValue={fechaSeleccionada}
              className="h-12 w-full max-w-xs rounded-lg border border-zinc-300 px-4 text-base"
            />
          </div>
          <button
            type="submit"
            className="h-12 rounded-lg border border-zinc-300 text-base font-semibold text-zinc-900 transition-colors hover:bg-zinc-100"
          >
            Cargar alumnos
          </button>
        </form>

        {grupoSeleccionado && (
          <CapturaDelGrupo
            supabase={supabase}
            grupo={grupoSeleccionado}
            fecha={fechaSeleccionada}
          />
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

// Componente async separado (Server Component) para poder mostrar el
// selector de grupo/fecha de inmediato sin esperar a esta segunda consulta
// — solo se resuelve cuando ya hay un grupo elegido.
async function CapturaDelGrupo({
  supabase,
  grupo,
  fecha,
}: {
  supabase: Awaited<ReturnType<typeof crearClienteServidor>>;
  grupo: GrupoConNombres;
  fecha: string;
}) {
  const resultado = await listarInscripcionesGrupo(supabase, grupo.id);

  if (!resultado.exito) {
    throw new Error(resultado.error);
  }

  const { inscripciones } = resultado;

  if (inscripciones.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <p className="max-w-sm text-zinc-600">
          Este grupo todavía no tiene alumnos inscritos. Inscribe alumnos
          primero desde &quot;Grupos&quot;.
        </p>
        <Link
          href={`/plantel/grupos/${grupo.id}`}
          className="flex h-14 w-full max-w-xs items-center justify-center rounded-lg bg-zinc-900 text-lg font-semibold text-white transition-colors hover:bg-zinc-700"
        >
          Ir al grupo
        </Link>
      </div>
    );
  }

  return (
    <FormularioCapturaAsistencia
      grupoId={grupo.id}
      alumnos={inscripciones}
      fechaInicial={fecha}
    />
  );
}
