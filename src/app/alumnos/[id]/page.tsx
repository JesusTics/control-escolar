import { redirect } from "next/navigation";
import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerKardexAlumno } from "@/modules/calificaciones/casos-uso/obtener-kardex-alumno";
import { obtenerAsistenciaAlumno } from "@/modules/asistencia/casos-uso/obtener-asistencia-alumno";
import { obtenerPerfilActual } from "@/modules/identidad/casos-uso/obtener-perfil-actual";
import { VistaKardexAlumno } from "./vista-kardex";

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

  // El rol determina si el kardex trae los datos sensibles descifrados (ver
  // comentario en obtener-kardex-alumno.ts) — se resuelve aquí, no en el
  // caso de uso, para no acoplarlo a Identidad más de lo necesario.
  const resultadoPerfil = await obtenerPerfilActual(supabase);
  if (!resultadoPerfil.exito) {
    throw new Error(resultadoPerfil.error);
  }
  const rolActual = resultadoPerfil.perfil?.rol;

  const resultado = await obtenerKardexAlumno(supabase, id, rolActual);

  if (!resultado.exito) {
    throw new Error(resultado.error);
  }

  const { kardex } = resultado;

  const resultadoAsistencia = await obtenerAsistenciaAlumno(supabase, id);

  if (!resultadoAsistencia.exito) {
    throw new Error(resultadoAsistencia.error);
  }

  const { asistencia } = resultadoAsistencia;

  return (
    <div className="flex flex-1 flex-col gap-8 bg-zinc-50 px-6 py-16">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <VistaKardexAlumno
          kardex={kardex}
          asistencia={asistencia}
          idAlumno={id}
          puedeGestionar
        />

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
