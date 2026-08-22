"use client";

import { useActionState } from "react";
import Link from "next/link";
import { registrarseAction, type EstadoRegistro } from "./acciones";

const estadoInicial: EstadoRegistro = {};

export function FormularioRegistro() {
  const [estado, accion, enviando] = useActionState(
    registrarseAction,
    estadoInicial,
  );

  if (estado.mensaje) {
    return (
      <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
        <p className="text-base font-medium text-zinc-800">
          {estado.mensaje}
        </p>
        <Link
          href="/login"
          className="flex h-14 w-full items-center justify-center rounded-lg bg-zinc-900 text-lg font-semibold text-white transition-colors hover:bg-zinc-700"
        >
          Ir a iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <form action={accion} className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col gap-1">
        <label
          htmlFor="nombrePlantel"
          className="text-sm font-medium text-zinc-700"
        >
          Nombre del plantel
        </label>
        <input
          id="nombrePlantel"
          name="nombrePlantel"
          type="text"
          required
          className="h-12 rounded-lg border border-zinc-300 px-4 text-base"
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
        <label htmlFor="email" className="text-sm font-medium text-zinc-700">
          Correo electrónico
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
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
        {enviando ? "Creando cuenta..." : "Crear cuenta"}
      </button>
      <p className="text-center text-sm text-zinc-600">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-medium text-zinc-900 underline">
          Inicia sesión
        </Link>
      </p>
    </form>
  );
}
