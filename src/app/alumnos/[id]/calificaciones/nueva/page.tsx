import { redirect } from "next/navigation";
import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerPerfilActual } from "@/modules/identidad/casos-uso/obtener-perfil-actual";
import { listarMaterias } from "@/modules/calificaciones/casos-uso/listar-materias";
import { listarMisMateriasAsignadas } from "@/modules/calificaciones/casos-uso/listar-mis-materias-asignadas";
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

  const resultadoPerfil = await obtenerPerfilActual(supabase);

  if (!resultadoPerfil.exito) {
    throw new Error(resultadoPerfil.error);
  }

  // El selector de materia se filtra según el rol: staff (administrativo/
  // oficina_central) sigue viendo TODAS las materias del plantel, como hasta
  // ahora; `docente` ve solo las que tiene asignadas
  // (`public.docente_materias`, ver ARCHITECTURE.md sección Calificaciones)
  // — es el mismo alcance que exigen las políticas RLS
  // `calificaciones_insert/update_staff_o_docente_asignado`, replicado aquí
  // para no ofrecer en el selector una materia que de todos modos sería
  // rechazada al guardar.
  const esDocente = resultadoPerfil.perfil?.rol === "docente";

  const resultado = esDocente
    ? await listarMisMateriasAsignadas(supabase)
    : await listarMaterias(supabase);

  if (!resultado.exito) {
    throw new Error(resultado.error);
  }

  const { materias } = resultado;

  if (esDocente && materias.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900">
          Todavía no tienes materias asignadas
        </h1>
        <p className="max-w-md text-zinc-600">
          Contacta al personal administrativo de tu plantel para que te
          asigne al menos una materia antes de registrar calificaciones.
        </p>
        <Link
          href={`/alumnos/${id}`}
          className="text-center text-sm font-medium text-zinc-900 underline"
        >
          Volver
        </Link>
      </div>
    );
  }

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
