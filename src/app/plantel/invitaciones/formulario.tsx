"use client";

import { useActionState } from "react";
import { crearInvitacionAction, type EstadoCrearInvitacion } from "./acciones";

const estadoInicial: EstadoCrearInvitacion = {};

export function FormularioCrearInvitacion() {
  const [estado, accion, enviando] = useActionState(
    crearInvitacionAction,
    estadoInicial,
  );

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
          defaultValue="docente"
          className="h-12 rounded-lg border border-zinc-300 px-4 text-base"
        >
          <option value="administrativo">Administrativo</option>
          <option value="docente">Docente</option>
          <option value="alumno">Alumno</option>
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
        {enviando ? "Creando invitación..." : "Crear invitación"}
      </button>
    </form>
  );
}
