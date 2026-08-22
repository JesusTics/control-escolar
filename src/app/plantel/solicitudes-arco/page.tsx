import { redirect } from "next/navigation";
import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerPerfilActual } from "@/modules/identidad/casos-uso/obtener-perfil-actual";
import { listarSolicitudesArcoPlantel } from "@/modules/identidad/casos-uso/listar-solicitudes-arco-plantel";
import { FormularioResolverSolicitud } from "./formulario";

// Mismos roles que exige la política RLS `solicitudes_arco_select_propia_o_
// staff`/`solicitudes_arco_update_staff` — se replica aquí para dar un
// mensaje de "no tienes permiso" explícito, mismo criterio que
// `/plantel/invitaciones`.
const ROLES_CON_ACCESO = ["administrativo", "oficina_central"];

const ETIQUETA_TIPO: Record<string, string> = {
  acceso: "Acceso",
  rectificacion: "Rectificación",
  cancelacion: "Cancelación",
  oposicion: "Oposición",
};

const ETIQUETA_ESTADO: Record<string, string> = {
  pendiente: "Pendiente",
  resuelta: "Resuelta",
};

const ESTILO_ESTADO: Record<string, string> = {
  pendiente: "bg-amber-100 text-amber-800",
  resuelta: "bg-green-100 text-green-800",
};

export default async function PaginaSolicitudesArcoPlantel() {
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
          Solo el personal administrativo puede ver y resolver solicitudes
          ARCO del plantel.
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

  const resultado = await listarSolicitudesArcoPlantel(supabase);

  if (!resultado.exito) {
    throw new Error(resultado.error);
  }

  const { solicitudes } = resultado;

  return (
    <div className="flex flex-1 flex-col gap-8 bg-zinc-50 px-6 py-16">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-semibold text-zinc-900">
            Solicitudes ARCO
          </h1>
          <p className="text-zinc-600">
            Revisa y resuelve manualmente las solicitudes de derechos ARCO de
            tu plantel
          </p>
        </div>

        {solicitudes.length === 0 ? (
          <p className="text-center text-zinc-600">
            Todavía no hay solicitudes ARCO en tu plantel.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
            {solicitudes.map((solicitud) => (
              <div
                key={solicitud.id}
                className="flex flex-col gap-3 px-4 py-4"
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="font-semibold text-zinc-900">
                    {solicitud.solicitanteNombre} ·{" "}
                    {ETIQUETA_TIPO[solicitud.tipo] ?? solicitud.tipo}
                  </span>
                  <span
                    className={`rounded-full px-3 py-1 text-sm font-medium ${ESTILO_ESTADO[solicitud.estado]}`}
                  >
                    {ETIQUETA_ESTADO[solicitud.estado]}
                  </span>
                </div>
                <p className="whitespace-pre-wrap text-zinc-700">
                  {solicitud.descripcion}
                </p>
                <span className="text-sm text-zinc-500">
                  {new Date(solicitud.created_at).toLocaleString("es-MX")}
                </span>
                {solicitud.estado === "resuelta" ? (
                  <div className="rounded bg-zinc-100 px-3 py-2 text-sm text-zinc-700">
                    <span className="font-medium">Respuesta: </span>
                    {solicitud.respuesta}
                  </div>
                ) : (
                  <FormularioResolverSolicitud solicitudId={solicitud.id} />
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
