"use client";

import { useActionState, useState } from "react";
import { crearInvitacionAction, type EstadoCrearInvitacion } from "./acciones";

interface AlumnoOpcion {
  id: string;
  nombre_completo: string;
  matricula: string;
}

const estadoInicial: EstadoCrearInvitacion = {};

export function FormularioCrearInvitacion({
  alumnosSinVincular,
}: {
  alumnosSinVincular: AlumnoOpcion[];
}) {
  const [estado, accion, enviando] = useActionState(
    crearInvitacionAction,
    estadoInicial,
  );
  // Rol seleccionado en el cliente, solo para mostrar/ocultar el selector de
  // alumno a vincular — JavaScript mínimo, sin librería nueva (CLAUDE.md 7:
  // una acción por pantalla, sin complicar el flujo).
  const [rol, setRol] = useState("docente");
  const sinAlumnosDisponibles = alumnosSinVincular.length === 0;
  const bloqueadoPorFaltaDeAlumnos = rol === "alumno" && sinAlumnosDisponibles;

  return (
    <form action={accion} className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium text-zinc-700">
          Correo electrónico
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="h-12 rounded-lg border border-zinc-300 px-4 text-base"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label htmlFor="rol" className="text-sm font-medium text-zinc-700">
          Rol
        </label>
        <select
          id="rol"
          name="rol"
          value={rol}
          onChange={(evento) => setRol(evento.target.value)}
          className="h-12 rounded-lg border border-zinc-300 px-4 text-base"
        >
          <option value="administrativo">Administrativo</option>
          <option value="docente">Docente</option>
          <option value="alumno">Alumno</option>
        </select>
      </div>

      {rol === "alumno" &&
        (sinAlumnosDisponibles ? (
          <p className="text-sm text-zinc-600">
            Todavía no hay alumnos sin cuenta vinculada en tu plantel.
            Inscribe un alumno primero en &quot;Alumnos&quot; para poder
            invitarlo con este rol.
          </p>
        ) : (
          <div className="flex flex-col gap-1">
            <label
              htmlFor="alumno_id"
              className="text-sm font-medium text-zinc-700"
            >
              Alumno a vincular
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
              {alumnosSinVincular.map((alumno) => (
                <option key={alumno.id} value={alumno.id}>
                  {alumno.nombre_completo} ({alumno.matricula})
                </option>
              ))}
            </select>
          </div>
        ))}

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
        disabled={enviando || bloqueadoPorFaltaDeAlumnos}
        className="h-14 rounded-lg bg-zinc-900 text-lg font-semibold text-white transition-colors hover:bg-zinc-700 disabled:opacity-60"
      >
        {enviando ? "Creando invitación..." : "Crear invitación"}
      </button>
    </form>
  );
}
