import { cerrarSesionAction } from "./acciones";

export function BotonCerrarSesion() {
  return (
    <form action={cerrarSesionAction}>
      <button
        type="submit"
        className="h-12 rounded-lg border border-zinc-300 px-6 text-base font-medium text-zinc-700 transition-colors hover:bg-zinc-100"
      >
        Cerrar sesión
      </button>
    </form>
  );
}
