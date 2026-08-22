import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  redirect(user ? "/dashboard" : "/login");
}
