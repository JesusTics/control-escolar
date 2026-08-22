-- Sistema de invitaciones: prerrequisito de "portales por rol" (última pieza
-- de la Oleada 1, CLAUDE.md sección 3). Hasta ahora Identidad/Roles solo
-- soportaba el alta del primer usuario (oficina_central) de un plantel
-- nuevo, vía la función `crear_plantel_y_perfil_inicial` (ver
-- 20260822075713_alta_inicial_identidad.sql). No existía forma de dar de
-- alta un SEGUNDO usuario (docente, alumno, u otro administrativo) en ese
-- MISMO plantel — así que los roles `docente`/`alumno` del check de
-- `perfiles.rol` eran papel muerto.
--
-- Mismo "problema del huevo y la gallina" que el alta inicial: la persona
-- invitada todavía no tiene fila en `perfiles`, así que no puede pasar las
-- políticas RLS normales (que asumen `plantel_id_actual()` resoluble). Se
-- resuelve con el mismo patrón: funciones `security definer` acotadas a una
-- sola operación cada una, nunca `service_role` en el código de la app
-- (CLAUDE.md 4.3) ni políticas de INSERT abiertas en `perfiles`.
create table public.invitaciones (
  id uuid primary key default gen_random_uuid(),
  plantel_id uuid not null references public.planteles(id),
  email text not null,
  rol text not null check (rol in ('administrativo','docente','alumno')),
  token uuid not null default gen_random_uuid() unique,
  creada_por uuid not null references public.perfiles(id),
  expira_en timestamptz not null default (now() + interval '7 days'),
  usada_en timestamptz,
  created_at timestamptz not null default now()
);

alter table public.invitaciones enable row level security;
create index idx_invitaciones_plantel_id on public.invitaciones(plantel_id);

-- Solo staff (administrativo/oficina_central) del plantel puede ver y crear
-- invitaciones de su propio plantel. `oficina_central` no está en el check
-- de `rol` de la propia invitación (no tiene sentido invitar a otro
-- oficina_central en este alcance) pero sí puede crear invitaciones.
create policy "invitaciones_select_staff_mismo_plantel"
  on public.invitaciones for select
  using (
    plantel_id = public.plantel_id_actual()
    and exists (
      select 1 from public.perfiles
      where id = auth.uid() and rol in ('administrativo','oficina_central')
    )
  );

create policy "invitaciones_insert_staff_mismo_plantel"
  on public.invitaciones for insert
  with check (
    plantel_id = public.plantel_id_actual()
    and creada_por = auth.uid()
    and exists (
      select 1 from public.perfiles
      where id = auth.uid() and rol in ('administrativo','oficina_central')
    )
  );

-- Info publica minima de una invitacion por token, para la pantalla de
-- aceptacion antes de que la persona tenga sesion/perfil. No expone mas
-- que lo necesario para renderizar la invitacion.
create or replace function public.obtener_invitacion_publica(p_token uuid)
returns table(plantel_nombre text, rol text, email text, valida boolean)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.nombre,
    i.rol,
    i.email,
    (i.usada_en is null and i.expira_en > now())
  from public.invitaciones i
  join public.planteles p on p.id = i.plantel_id
  where i.token = p_token
$$;

revoke all on function public.obtener_invitacion_publica(uuid) from public;
grant execute on function public.obtener_invitacion_publica(uuid) to anon, authenticated;

-- Acepta una invitacion: crea el perfil del usuario autenticado con el
-- plantel_id/rol de la invitacion, y la marca como usada. Requiere que el
-- email de la invitacion coincida con el email de la cuenta autenticada.
create or replace function public.aceptar_invitacion(p_token uuid, p_nombre_completo text)
returns public.perfiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitacion public.invitaciones;
  v_perfil public.perfiles;
begin
  if auth.uid() is null then
    raise exception 'No autenticado';
  end if;

  if exists (select 1 from public.perfiles where id = auth.uid()) then
    raise exception 'El usuario ya tiene un perfil';
  end if;

  select * into v_invitacion from public.invitaciones where token = p_token for update;

  if v_invitacion is null then
    raise exception 'Invitación no encontrada';
  end if;

  if v_invitacion.usada_en is not null then
    raise exception 'Esta invitación ya fue utilizada';
  end if;

  if v_invitacion.expira_en <= now() then
    raise exception 'Esta invitación expiró';
  end if;

  if lower(v_invitacion.email) <> lower(coalesce(auth.email(), '')) then
    raise exception 'Esta invitación fue enviada a otro correo';
  end if;

  insert into public.perfiles (id, plantel_id, rol, nombre_completo)
  values (auth.uid(), v_invitacion.plantel_id, v_invitacion.rol, p_nombre_completo)
  returning * into v_perfil;

  update public.invitaciones set usada_en = now() where id = v_invitacion.id;

  return v_perfil;
end;
$$;

revoke all on function public.aceptar_invitacion(uuid, text) from public;
grant execute on function public.aceptar_invitacion(uuid, text) to authenticated;
