"use client";

import { useActionState } from "react";
import { inscribirAlumnoAction, type EstadoInscribirAlumno } from "./acciones";

interface AlumnoOpcion {
  id: string;
  nombre_completo: string;
  matricula: string;
}

const estadoInicial: EstadoInscribirAlumno = {};

export function FormularioInscribirAlumno({
  grupoId,
  alumnosDisponibles,
}: {
  grupoId: string;
  alumnosDisponibles: AlumnoOpcion[];
}) {
  const accionConGrupo = inscribirAlumnoAction.bind(null, grupoId);
  const [estado, accion, enviando] = useActionState(
    accionConGrupo,
    estadoInicial,
  );

  return (
    <form action={accion} className="flex w-full flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label
          htmlFor="alumno_id"
          className="text-sm font-medium text-zinc-700"
        >
          Inscribir alumno
        </label>
        <select
          id="alumno_id"
          name="alumno_id"
          required
          defaultValue=""
          className="h-12 rounded-lg border border-zinc-300 px-4 text-base"
        >
          <option value="" disabled>
            Selecciona un alumno
          </option>
          {alumnosDisponibles.map((alumno) => (
            <option key={alumno.id} value={alumno.id}>
              {alumno.nombre_completo} ({alumno.matricula})
            </option>
          ))}
        </select>
      </div>
      {estado.error && (
        <p className="text-sm font-medium text-red-600" role="alert">
          {estado.error}
        </p>
      )}
      {estado.mensaje && (
        <p className="text-sm font-medium text-green-700" role="status">
          {estado.mensaje}
        </p>
      )}
      <button
        type="submit"
        disabled={enviando}
        className="h-14 rounded-lg bg-zinc-900 text-lg font-semibold text-white transition-colors hover:bg-zinc-700 disabled:opacity-60"
      >
        {enviando ? "Inscribiendo..." : "Inscribir"}
      </button>
    </form>
  );
}
