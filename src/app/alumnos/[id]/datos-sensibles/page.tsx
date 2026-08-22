import { redirect } from "next/navigation";
import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerPerfilActual } from "@/modules/identidad/casos-uso/obtener-perfil-actual";
import { obtenerKardexAlumno } from "@/modules/calificaciones/casos-uso/obtener-kardex-alumno";
import { FormularioDatosSensibles } from "./formulario";

// Mismo criterio de roles que la restricción de aplicación de
// obtener-kardex-alumno.ts (ROLES_CON_ACCESO_A_DATOS_SENSIBLES) — se
// verifica aquí en el servidor ANTES de mostrar el formulario, no solo
// ocultando el enlace en la UI (ver también acciones.ts, que la vuelve a
// verificar antes de procesar el submit).
const ROLES_CON_ACCESO = ["administrativo", "oficina_central"];

export default async function PaginaDatosSensiblesAlumno({
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
          Solo el personal administrativo puede editar los datos sensibles de
          un alumno.
        </p>
        <Link
          href={`/alumnos/${id}`}
          className="text-sm font-medium text-zinc-900 underline"
        >
          Volver al expediente
        </Link>
      </div>
    );
  }

  const resultado = await obtenerKardexAlumno(supabase, id, perfil.rol);

  if (!resultado.exito) {
    throw new Error(resultado.error);
  }

  const { kardex } = resultado;

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 bg-zinc-50 px-6 py-16">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900">
          Editar datos sensibles
        </h1>
        <p className="max-w-sm text-zinc-600">
          {kardex.alumno.nombre_completo} — contacto de tutor e información
          médica. Se cifran antes de guardarse.
        </p>
      </div>

      <FormularioDatosSensibles
        alumnoId={id}
        valoresIniciales={{
          tutorNombre: kardex.datosSensibles?.tutorNombre ?? "",
          tutorTelefono: kardex.datosSensibles?.tutorTelefono ?? "",
          informacionMedica: kardex.datosSensibles?.informacionMedica ?? "",
        }}
      />
    </div>
  );
}
