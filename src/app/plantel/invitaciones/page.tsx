import { redirect } from "next/navigation";
import Link from "next/link";
import { headers } from "next/headers";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerPerfilActual } from "@/modules/identidad/casos-uso/obtener-perfil-actual";
import { listarInvitaciones } from "@/modules/identidad/casos-uso/listar-invitaciones";
import { listarAlumnosSinVincular } from "@/modules/alumnos/casos-uso/listar-alumnos-sin-vincular";
import { FormularioCrearInvitacion } from "./formulario";

// Mismos roles que exige la política RLS `invitaciones_select/insert_staff_
// mismo_plantel` (ver supabase/migrations/20260822191914_invitaciones_plantel.sql)
// — se replica aquí para poder mostrar un mensaje de "no tienes permiso"
// explícito en vez de una lista vacía silenciosa o un error de RLS crudo.
const ROLES_CON_ACCESO = ["administrativo", "oficina_central"];

const ETIQUETA_ROL: Record<string, string> = {
  administrativo: "Administrativo",
  docente: "Docente",
  alumno: "Alumno",
};

const ETIQUETA_ESTADO: Record<string, string> = {
  pendiente: "Pendiente",
  usada: "Usada",
  expirada: "Expirada",
};

const ESTILO_ESTADO: Record<string, string> = {
  pendiente: "bg-green-100 text-green-800",
  usada: "bg-zinc-200 text-zinc-700",
  expirada: "bg-red-100 text-red-800",
};

export default async function PaginaInvitaciones() {
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
          Solo el personal administrativo puede invitar usuarios al plantel.
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

  const resultado = await listarInvitaciones(supabase);

  if (!resultado.exito) {
    throw new Error(resultado.error);
  }

  const { invitaciones } = resultado;

  const resultadoAlumnosSinVincular = await listarAlumnosSinVincular(supabase);

  if (!resultadoAlumnosSinVincular.exito) {
    throw new Error(resultadoAlumnosSinVincular.error);
  }

  const { alumnos: alumnosSinVincular } = resultadoAlumnosSinVincular;

  const encabezados = await headers();
  const origen =
    encabezados.get("origin") ?? `http://${encabezados.get("host")}`;

  return (
    <div className="flex flex-1 flex-col gap-8 bg-zinc-50 px-6 py-16">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-semibold text-zinc-900">
            Invitar usuarios
          </h1>
          <p className="text-zinc-600">
            Da de alta a docentes, alumnos u otro personal administrativo en
            tu plantel
          </p>
        </div>

        <FormularioCrearInvitacion alumnosSinVincular={alumnosSinVincular} />

        {invitaciones.length === 0 ? (
          <p className="text-center text-zinc-600">
            Todavía no hay invitaciones creadas.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
            {invitaciones.map((invitacion) => (
              <div
                key={invitacion.id}
                className="flex flex-col gap-2 px-4 py-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="font-semibold text-zinc-900">
                    {invitacion.email}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-medium ${ESTILO_ESTADO[invitacion.estado]}`}
                  >
                    {ETIQUETA_ESTADO[invitacion.estado]}
                  </span>
                </div>
                <span className="text-sm text-zinc-600">
                  Rol: {ETIQUETA_ROL[invitacion.rol] ?? invitacion.rol}
                </span>
                {invitacion.estado === "pendiente" && (
                  <p className="select-all break-all rounded bg-zinc-100 px-3 py-2 text-sm text-zinc-700">
                    {`${origen}/invitacion/${invitacion.token}`}
                  </p>
                )}
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
