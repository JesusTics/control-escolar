-- Vincula un perfil con rol `alumno` a su fila correspondiente en
-- `public.alumnos` — hasta ahora eran entidades desconectadas: era posible
-- crear una cuenta con rol `alumno` (vía invitaciones,
-- 20260822191914_invitaciones_plantel.sql) sin ningún vínculo con un
-- registro real de `alumnos`. Prerrequisito de la migración siguiente
-- (endurecer_rls_visibilidad_por_rol), que restringe la visibilidad de un
-- `alumno` a su propia fila usando esta columna.
alter table public.alumnos
  add column perfil_id uuid unique references public.perfiles(id);

-- La invitación necesita "recordar" a qué alumno vincular el perfil una vez
-- aceptada — solo tiene sentido cuando `rol = 'alumno'` (validado en el caso
-- de uso `crear-invitacion.ts`, no aquí con un check adicional, mismo
-- criterio de mantener la tabla simple que el resto de columnas opcionales
-- de este esquema).
alter table public.invitaciones
  add column alumno_id uuid references public.alumnos(id);

-- Reemplaza `aceptar_invitacion` (ver 20260822191914_invitaciones_plantel.sql)
-- para, además de crear el perfil, vincular `alumnos.perfil_id` cuando la
-- invitación traiga un `alumno_id`. Mismas validaciones que la versión
-- anterior (auth.uid() no nulo, sin perfil previo, token válido/no usado/no
-- expirado, email coincidente) — se agrega únicamente el paso de vinculación
-- al final, dentro de la misma transacción.
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

  if v_invitacion.alumno_id is not null then
    update public.alumnos
    set perfil_id = auth.uid()
    where id = v_invitacion.alumno_id
      and plantel_id = v_invitacion.plantel_id
      and perfil_id is null;
  end if;

  update public.invitaciones set usada_en = now() where id = v_invitacion.id;

  return v_perfil;
end;
$$;
