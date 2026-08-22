-- Endurece las políticas de SELECT de `alumnos`, `calificaciones`,
-- `asistencias` y `avisos`: hasta ahora solo filtraban por
-- `plantel_id = plantel_id_actual()`, sin considerar el rol — una cuenta con
-- rol `alumno` (posible desde el sistema de invitaciones,
-- 20260822191914_invitaciones_plantel.sql) veía las calificaciones y
-- asistencia de TODOS los alumnos del plantel, no solo las suyas. Viola
-- mínimo privilegio y el principio de "interés superior del menor"
-- (CLAUDE.md 4.4).
--
-- Solo se tocan las políticas de SELECT — INSERT/UPDATE quedan intactas, sin
-- cambios de comportamiento para staff (administrativo/oficina_central) ni
-- docente, que siguen viendo todo su plantel.
--
-- `docente` mantiene visibilidad de TODO el plantel a propósito: no existe
-- todavía asignación de materias/grupos a un docente específico — sería
-- resolver un problema que no está en el alcance de esta sesión. Solo
-- `alumno` se restringe a lo propio, vía `alumnos.perfil_id` (ver
-- 20260822200141_vincular_alumno_a_perfil.sql).

-- alumnos: un alumno solo ve su propia fila; staff/docente ven todo el
-- plantel.
drop policy "alumnos_select_mismo_plantel" on public.alumnos;
create policy "alumnos_select_propio_o_staff"
  on public.alumnos for select
  using (
    plantel_id = public.plantel_id_actual()
    and (
      perfil_id = auth.uid()
      or exists (
        select 1 from public.perfiles
        where id = auth.uid() and rol in ('administrativo','oficina_central','docente')
      )
    )
  );

-- calificaciones: un alumno solo ve las calificaciones del alumno vinculado
-- a su perfil; staff/docente ven todo el plantel.
drop policy "calificaciones_select_mismo_plantel" on public.calificaciones;
create policy "calificaciones_select_propio_o_staff"
  on public.calificaciones for select
  using (
    plantel_id = public.plantel_id_actual()
    and (
      exists (select 1 from public.alumnos a where a.id = calificaciones.alumno_id and a.perfil_id = auth.uid())
      or exists (select 1 from public.perfiles where id = auth.uid() and rol in ('administrativo','oficina_central','docente'))
    )
  );

-- asistencias: mismo criterio que calificaciones.
drop policy "asistencias_select_mismo_plantel" on public.asistencias;
create policy "asistencias_select_propio_o_staff"
  on public.asistencias for select
  using (
    plantel_id = public.plantel_id_actual()
    and (
      exists (select 1 from public.alumnos a where a.id = asistencias.alumno_id and a.perfil_id = auth.uid())
      or exists (select 1 from public.perfiles where id = auth.uid() and rol in ('administrativo','oficina_central','docente'))
    )
  );

-- avisos: staff ve todos los avisos de su plantel; docente/alumno solo los
-- dirigidos a "todos" o a su propio rol (`dirigido_a`, hasta ahora solo
-- informativo, pasa a filtrar visibilidad de verdad).
drop policy "avisos_select_mismo_plantel" on public.avisos;
create policy "avisos_select_segun_rol"
  on public.avisos for select
  using (
    plantel_id = public.plantel_id_actual()
    and exists (
      select 1 from public.perfiles p
      where p.id = auth.uid()
      and (
        p.rol in ('administrativo','oficina_central')
        or avisos.dirigido_a = 'todos'
        or (avisos.dirigido_a = 'docentes' and p.rol = 'docente')
        or (avisos.dirigido_a = 'alumnos' and p.rol = 'alumno')
      )
    )
  );
