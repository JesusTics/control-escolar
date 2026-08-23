import { redirect } from "next/navigation";
import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerPerfilActual } from "@/modules/identidad/casos-uso/obtener-perfil-actual";
import { listarGruposDeAlumno } from "@/modules/grupos/casos-uso/listar-grupos-de-alumno";
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

  // El selector ya no es de "materia" sino de "grupo" — lista los grupos en
  // los que ESE alumno específico está inscrito. No se filtra por rol aquí:
  // la política RLS `inscripciones_select_propia_o_staff_o_docente` ya
  // acota lo que ve un `docente` a solo los grupos donde es el titular
  // (`grupos.docente_id`), así que el resultado de
  // `listarGruposDeAlumno` para un docente YA ES la intersección "grupos del
  // alumno ∩ grupos del docente" pedida por la tarea — ver comentario en ese
  // caso de uso. Staff ve todos los grupos del alumno, sin cambio.
  const resultado = await listarGruposDeAlumno(supabase, id);

  if (!resultado.exito) {
    throw new Error(resultado.error);
  }

  const { grupos } = resultado;

  if (grupos.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900">
          Este alumno no está inscrito en ningún grupo
        </h1>
        <p className="max-w-md text-zinc-600">
          {resultadoPerfil.perfil?.rol === "docente"
            ? "No tiene grupos tuyos en los que esté inscrito. Pide al personal administrativo que lo inscriba en uno de tus grupos desde \"Grupos\"."
            : "Inscribe al alumno en un grupo primero, desde \"Grupos\", para poder registrar una calificación."}
        </p>
        <Link
          href="/plantel/grupos"
          className="flex h-14 w-full max-w-xs items-center justify-center rounded-lg bg-zinc-900 text-lg font-semibold text-white transition-colors hover:bg-zinc-700"
        >
          Ir a Grupos
        </Link>
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
          Captura la calificación del alumno en uno de sus grupos
        </p>
      </div>

      <FormularioRegistrarCalificacion alumnoId={id} grupos={grupos} />
    </div>
  );
}
