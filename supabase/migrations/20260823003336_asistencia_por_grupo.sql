-- Asistencia pasa de ser diaria general del plantel a tomarse por sesión de
-- grupo — un alumno puede tener asistencia distinta en dos materias el mismo
-- día. Reemplaza las tres políticas vigentes desde
-- 20260822200144_endurecer_rls_visibilidad_por_rol.sql (verificadas contra
-- ese archivo y contra 20260822190214_asistencia_diaria.sql: `asistencias_
-- select_propio_o_staff`, `asistencias_insert_staff_mismo_plantel`,
-- `asistencias_update_staff_mismo_plantel`) por su equivalente acotado a
-- `grupos.docente_id`.
--
-- La restricción `unique(alumno_id, fecha)` de
-- 20260822190214_asistencia_diaria.sql se declaró inline sin nombre
-- explícito, así que Postgres le asignó el nombre por default
-- `asistencias_alumno_id_fecha_key` (confirmado contra el esquema real antes
-- de este DROP).
--
-- Las filas existentes de `asistencias` (datos de desarrollo/prueba, sin
-- `grupo_id` retroactivo posible) se borran antes de aplicar el esquema
-- nuevo — es data de prueba, no producción.

drop policy "asistencias_select_propio_o_staff" on public.asistencias;
drop policy "asistencias_insert_staff_mismo_plantel" on public.asistencias;
drop policy "asistencias_update_staff_mismo_plantel" on public.asistencias;

delete from public.asistencias;

alter table public.asistencias add column grupo_id uuid not null references public.grupos(id);
alter table public.asistencias drop constraint asistencias_alumno_id_fecha_key;
alter table public.asistencias add constraint asistencias_alumno_grupo_fecha_key unique (alumno_id, grupo_id, fecha);

create policy "asistencias_select_propia_o_staff_o_docente_grupo"
  on public.asistencias for select
  using (
    plantel_id = public.plantel_id_actual()
    and (
      exists (select 1 from public.alumnos a where a.id = asistencias.alumno_id and a.perfil_id = auth.uid())
      or exists (select 1 from public.perfiles where id = auth.uid() and rol in ('administrativo','oficina_central'))
      or exists (select 1 from public.grupos g where g.id = asistencias.grupo_id and g.docente_id = auth.uid())
    )
  );

-- El INSERT ahora exige, además del rol, que el alumno esté inscrito en el
-- grupo — mismo criterio de integridad que calificaciones.
create policy "asistencias_insert_staff_o_docente_grupo"
  on public.asistencias for insert
  with check (
    plantel_id = public.plantel_id_actual()
    and exists (select 1 from public.inscripciones i where i.alumno_id = asistencias.alumno_id and i.grupo_id = asistencias.grupo_id)
    and (
      exists (select 1 from public.perfiles where id = auth.uid() and rol in ('administrativo','oficina_central'))
      or exists (select 1 from public.grupos g where g.id = asistencias.grupo_id and g.docente_id = auth.uid())
    )
  );

create policy "asistencias_update_staff_o_docente_grupo"
  on public.asistencias for update
  using (
    plantel_id = public.plantel_id_actual()
    and (
      exists (select 1 from public.perfiles where id = auth.uid() and rol in ('administrativo','oficina_central'))
      or exists (select 1 from public.grupos g where g.id = asistencias.grupo_id and g.docente_id = auth.uid())
    )
  )
  with check (plantel_id = public.plantel_id_actual());
