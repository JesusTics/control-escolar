import { redirect } from "next/navigation";
import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { listarMisSolicitudesArco } from "@/modules/identidad/casos-uso/listar-mis-solicitudes-arco";
import { FormularioSolicitudArco } from "./formulario";

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

// Protegida — cualquier rol autenticado puede levantar una solicitud sobre
// sus propios datos (ver CLAUDE.md 4.4, derechos ARCO operables como caso de
// uso real, no solo mencionados en el aviso de privacidad).
export default async function PaginaDerechosArco() {
  const supabase = await crearClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const resultado = await listarMisSolicitudesArco(supabase);

  if (!resultado.exito) {
    throw new Error(resultado.error);
  }

  const { solicitudes } = resultado;

  return (
    <div className="flex flex-1 flex-col gap-8 bg-zinc-50 px-6 py-16">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-semibold text-zinc-900">
            Derechos ARCO
          </h1>
          <p className="text-zinc-600">
            Solicita acceso, rectificación, cancelación u oposición sobre tus
            datos personales. Consulta el{" "}
            <Link href="/aviso-privacidad" className="underline">
              aviso de privacidad
            </Link>{" "}
            para más detalle.
          </p>
        </div>

        <FormularioSolicitudArco />

        <div className="flex flex-col gap-3">
          <h2 className="text-center text-xl font-semibold text-zinc-900">
            Mis solicitudes
          </h2>
          {solicitudes.length === 0 ? (
            <p className="text-center text-zinc-600">
              Todavía no has levantado ninguna solicitud.
            </p>
          ) : (
            <div className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
              {solicitudes.map((solicitud) => (
                <div
                  key={solicitud.id}
                  className="flex flex-col gap-2 px-4 py-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <span className="font-semibold text-zinc-900">
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
                  {solicitud.estado === "resuelta" && solicitud.respuesta && (
                    <div className="mt-1 rounded bg-zinc-100 px-3 py-2 text-sm text-zinc-700">
                      <span className="font-medium">Respuesta: </span>
                      {solicitud.respuesta}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

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
