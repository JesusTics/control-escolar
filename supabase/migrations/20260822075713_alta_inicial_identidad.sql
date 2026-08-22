-- Alta inicial de Identidad/Roles: crea el primer plantel + perfil de un
-- usuario recién registrado.
--
-- Problema que resuelve: las políticas RLS de `perfiles`/`planteles`
-- dependen de que ya exista un perfil (perfiles_select_propio,
-- planteles_select_propio vía plantel_id_actual()). Un usuario recién
-- registrado en Supabase Auth todavía no tiene fila en `perfiles`, así que
-- no hay forma de que un INSERT directo desde el cliente (con el rol
-- `authenticated` normal) pase RLS sin abrir una política de INSERT
-- indiscriminada en `planteles`/`perfiles` — lo cual permitiría a cualquier
-- usuario autenticado crear planteles arbitrarios o perfiles con rol
-- distinto a la primera alta.
--
-- Solución: una función `security definer` que agrupa ambos inserts en una
-- transacción, valida explícitamente las invariantes (usuario autenticado,
-- perfil no existente todavía) y no delega control al llamador sobre qué
-- fila puede tocar. Se evita usar `service_role` en el código de la app
-- (regla CLAUDE.md 4.3) porque `service_role` se salta RLS por completo y
-- viviría embebido en el proceso de Next.js; esta función, en cambio, solo
-- expone la operación puntual "crear mi primer plantel y perfil" con sus
-- propias validaciones, ejecutándose con los privilegios del owner de la
-- función pero acotada a esa única operación.
create or replace function public.crear_plantel_y_perfil_inicial(
  p_nombre_plantel text,
  p_nombre_completo text
)
returns public.perfiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plantel_id uuid;
  v_perfil public.perfiles;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  if exists (select 1 from public.perfiles where id = auth.uid()) then
    raise exception 'El usuario ya tiene un perfil';
  end if;

  insert into public.planteles (nombre) values (p_nombre_plantel)
  returning id into v_plantel_id;

  insert into public.perfiles (id, plantel_id, rol, nombre_completo)
  values (auth.uid(), v_plantel_id, 'oficina_central', p_nombre_completo)
  returning * into v_perfil;

  return v_perfil;
end;
$$;

revoke all on function public.crear_plantel_y_perfil_inicial(text, text) from public;
grant execute on function public.crear_plantel_y_perfil_inicial(text, text) to authenticated;
