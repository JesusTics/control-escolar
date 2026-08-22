"use client";

import { useActionState } from "react";
import { aceptarInvitacionAction, type EstadoAceptarInvitacion } from "./acciones";

const estadoInicial: EstadoAceptarInvitacion = {};

interface PropiedadesFormularioAceptarInvitacion {
  token: string;
  email: string;
}

export function FormularioAceptarInvitacion({
  token,
  email,
}: PropiedadesFormularioAceptarInvitacion) {
  const [estado, accion, enviando] = useActionState(
    aceptarInvitacionAction,
    estadoInicial,
  );

  return (
    <form action={accion} className="flex w-full max-w-sm flex-col gap-4">
      <input type="hidden" name="token" value={token} />
      <div className="flex flex-col gap-1">
        <label htmlFor="email" className="text-sm font-medium text-zinc-700">
          Correo electrónico
        </label>
        {/* `readOnly`, no `disabled`: un input `disabled` no envía su valor
            al hacer submit del formulario. El email viene fijo de la
            invitación (ver diseño de la sesión: "mostrado pero no editable"). */}
        <input
          id="email"
          name="email"
          type="email"
          value={email}
          readOnly
          className="h-12 rounded-lg border border-zinc-300 bg-zinc-100 px-4 text-base text-zinc-600"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="nombreCompleto"
          className="text-sm font-medium text-zinc-700"
        >
          Tu nombre completo
        </label>
        <input
          id="nombreCompleto"
          name="nombreCompleto"
          type="text"
          required
          className="h-12 rounded-lg border border-zinc-300 px-4 text-base"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label
          htmlFor="password"
          className="text-sm font-medium text-zinc-700"
        >
          Contraseña
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          className="h-12 rounded-lg border border-zinc-300 px-4 text-base"
        />
      </div>
      {estado.error && (
        <p className="text-sm font-medium text-red-600" role="alert">
          {estado.error}
        </p>
      )}
      <button
        type="submit"
        disabled={enviando}
        className="h-14 rounded-lg bg-zinc-900 text-lg font-semibold text-white transition-colors hover:bg-zinc-700 disabled:opacity-60"
      >
        {enviando ? "Uniéndote..." : "Unirme"}
      </button>
    </form>
  );
}
