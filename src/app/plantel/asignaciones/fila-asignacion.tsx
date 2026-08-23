"use client";

import { useActionState } from "react";
import {
  desasignarDocenteMateriaAction,
  type EstadoDesasignarDocenteMateria,
} from "./acciones";

const estadoInicial: EstadoDesasignarDocenteMateria = {};

// Sin diálogo de confirmación bloqueante (CLAUDE.md 7: "deshacer siempre
// disponible, en vez de diálogos de confirmación bloqueantes") — quitar una
// asignación es una acción de bajo riesgo y fácilmente reversible (volver a
// asignar la misma materia desde el formulario de arriba).
export function BotonDesasignar({ asignacionId }: { asignacionId: string }) {
  const accionConId = desasignarDocenteMateriaAction.bind(null, asignacionId);
  const [estado, accion, enviando] = useActionState(
    accionConId,
    estadoInicial,
  );

  return (
    <form action={accion} className="flex flex-col items-end gap-1">
      <button
        type="submit"
        disabled={enviando}
        className="h-9 rounded-lg border border-red-300 px-3 text-sm font-medium text-red-700 transition-colors hover:bg-red-50 disabled:opacity-60"
      >
        {enviando ? "Quitando..." : "Quitar"}
      </button>
      {estado.error && (
        <p className="text-xs font-medium text-red-600" role="alert">
          {estado.error}
        </p>
      )}
    </form>
  );
}
