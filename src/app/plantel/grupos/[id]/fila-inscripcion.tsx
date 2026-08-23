"use client";

import { useActionState } from "react";
import {
  desinscribirAlumnoAction,
  type EstadoDesinscribirAlumno,
} from "./acciones";

const estadoInicial: EstadoDesinscribirAlumno = {};

// Sin diálogo de confirmación bloqueante (CLAUDE.md 7: "deshacer siempre
// disponible, en vez de diálogos de confirmación bloqueantes") — desinscribir
// es reversible (volver a inscribir al mismo alumno desde el formulario de
// arriba); su historial de calificaciones/asistencia en el grupo no se
// pierde (ver comentario en desinscribir-alumno-grupo.ts).
export function BotonDesinscribir({
  inscripcionId,
  grupoId,
}: {
  inscripcionId: string;
  grupoId: string;
}) {
  const accionConIds = desinscribirAlumnoAction.bind(
    null,
    inscripcionId,
    grupoId,
  );
  const [estado, accion, enviando] = useActionState(
    accionConIds,
    estadoInicial,
  );

  return (
    <form action={accion} className="flex flex-col items-end gap-1">
      <button
        type="submit"
        disabled={enviando}
        className="h-9 rounded-lg border border-red-300 px-3 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-60"
      >
        {enviando ? "Quitando..." : "Desinscribir"}
      </button>
      {estado.error && (
        <p className="text-xs font-medium text-red-600" role="alert">
          {estado.error}
        </p>
      )}
    </form>
  );
}
