import { redirect } from "next/navigation";
import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { listarAvisos } from "@/modules/comunicacion/casos-uso/listar-avisos";

const ETIQUETA_DIRIGIDO_A: Record<string, string> = {
  docentes: "Docentes",
  alumnos: "Alumnos",
};

export default async function PaginaAvisos() {
  const supabase = await crearClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const resultado = await listarAvisos(supabase);

  if (!resultado.exito) {
    throw new Error(resultado.error);
  }

  const { avisos } = resultado;

  return (
    <div className="flex flex-1 flex-col gap-8 bg-zinc-50 px-6 py-16">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-2xl font-semibold text-zinc-900">Avisos</h1>
          <p className="text-zinc-600">Tablón de avisos del plantel</p>
        </div>

        <Link
          href="/avisos/nuevo"
          className="flex h-14 w-full items-center justify-center rounded-lg bg-zinc-900 text-lg font-semibold text-white transition-colors hover:bg-zinc-700"
        >
          Publicar aviso
        </Link>

        {avisos.length === 0 ? (
          <p className="text-center text-zinc-600">
            Todavía no hay avisos publicados.
          </p>
        ) : (
          <div className="flex flex-col divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white">
            {avisos.map((aviso) => (
              <div key={aviso.id} className="flex flex-col gap-2 px-4 py-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="font-semibold text-zinc-900">
                    {aviso.titulo}
                  </span>
                  {aviso.dirigido_a !== "todos" && (
                    <span className="rounded-full bg-zinc-200 px-3 py-1 text-sm font-medium text-zinc-700">
                      {ETIQUETA_DIRIGIDO_A[aviso.dirigido_a]}
                    </span>
                  )}
                </div>
                <p className="whitespace-pre-wrap text-zinc-700">
                  {aviso.contenido}
                </p>
                <span className="text-sm text-zinc-500">
                  {aviso.autorNombre} ·{" "}
                  {new Date(aviso.created_at).toLocaleString("es-MX")}
                </span>
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
