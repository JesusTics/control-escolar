// Pantalla pública de aceptación de invitación — sin necesidad de sesión
// previa (`middleware.ts` no protege esta ruta; ver src/lib/supabase/middleware.ts).
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerInfoInvitacion } from "@/modules/identidad/casos-uso/obtener-info-invitacion";
import { FormularioAceptarInvitacion } from "./formulario";

const ETIQUETA_ROL: Record<string, string> = {
  administrativo: "administrativo",
  docente: "docente",
  alumno: "alumno",
};

interface PropiedadesPaginaInvitacion {
  params: Promise<{ token: string }>;
}

export default async function PaginaInvitacion({
  params,
}: PropiedadesPaginaInvitacion) {
  const { token } = await params;
  const supabase = await crearClienteServidor();

  const resultado = await obtenerInfoInvitacion(supabase, token);

  if (!resultado.exito) {
    throw new Error(resultado.error);
  }

  const { info } = resultado;

  if (!info || !info.valida) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900">
          Invitación no válida
        </h1>
        <p className="max-w-md text-zinc-600">
          Este link de invitación no existe, ya fue utilizado o expiró. Pide
          a quien te invitó que te comparta uno nuevo.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-8 bg-zinc-50 px-6 py-16">
      <div className="flex flex-col items-center gap-2 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900">
          Te invitaron a unirte a {info.plantelNombre}
        </h1>
        <p className="text-zinc-600">
          Como {ETIQUETA_ROL[info.rol] ?? info.rol}
        </p>
      </div>
      <FormularioAceptarInvitacion token={token} email={info.email} />
    </div>
  );
}
