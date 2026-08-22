import { redirect } from "next/navigation";
import Link from "next/link";
import { crearClienteServidor } from "@/lib/supabase/server";
import { obtenerPerfilActual } from "@/modules/identidad/casos-uso/obtener-perfil-actual";
import { BotonCerrarSesion } from "./boton-cerrar-sesion";

export default async function PaginaDashboard() {
  const supabase = await crearClienteServidor();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const resultado = await obtenerPerfilActual(supabase);

  if (!resultado.exito) {
    throw new Error(resultado.error);
  }

  const { perfil } = resultado;

  // Caso borde: el usuario tiene sesión (ya confirmó su correo) pero nunca
  // se le creó plantel/perfil porque el registro se detuvo en el paso de
  // "revisa tu correo" (ver src/app/registro/acciones.ts). Todavía no hay
  // un flujo para retomar el onboarding en este punto — se avisa en vez de
  // fallar o entrar en un loop de redirects.
  if (!perfil) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 bg-zinc-50 px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold text-zinc-900">
          Tu cuenta todavía no tiene un plantel asociado
        </h1>
        <p className="max-w-md text-zinc-600">
          Esto puede pasar si confirmaste tu correo antes de completar el
          registro. Contacta a soporte para terminar de configurar tu cuenta.
        </p>
        <BotonCerrarSesion />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-50 px-6 py-16 text-center">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-zinc-900">
          Bienvenido, {perfil.nombre_completo}
        </h1>
        <p className="text-lg text-zinc-600">
          Plantel: {perfil.plantel?.nombre ?? "Sin plantel asociado"}
        </p>
        <p className="text-lg text-zinc-600">Rol: {perfil.rol}</p>
      </div>
      <Link
        href="/alumnos"
        className="flex h-14 w-full max-w-xs items-center justify-center rounded-lg bg-zinc-900 text-lg font-semibold text-white transition-colors hover:bg-zinc-700"
      >
        Alumnos
      </Link>
      <BotonCerrarSesion />
    </div>
  );
}
