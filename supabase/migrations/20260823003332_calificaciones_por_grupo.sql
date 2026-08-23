-- Calificaciones pasa de registrarse por (alumno, materia, periodo) a
-- registrarse por (alumno, grupo) — el grupo ya trae materia y periodo (ver
-- 20260823003328_grupos_e_inscripciones.sql). Reemplaza las tres políticas
-- vigentes desde 20260823000049_asignacion_docente_materia.sql
-- (verificadas contra ese archivo: `calificaciones_select_propio_o_staff_o_
-- docente_asignado`, `calificaciones_insert_staff_o_docente_asignado`,
-- `calificaciones_update_staff_o_docente_asignado`) por su equivalente
-- acotado a `grupos.docente_id` en vez de `docente_materias`.
--
-- Las filas existentes de `calificaciones` (datos de desarrollo/prueba, sin
-- `grupo_id` retroactivo posible) se borran antes de aplicar el esquema
-- nuevo — es data de prueba, no producción.

drop policy "calificaciones_select_propio_o_staff_o_docente_asignado" on public.calificaciones;
drop policy "calificaciones_insert_staff_o_docente_asignado" on public.calificaciones;
drop policy "calificaciones_update_staff_o_docente_asignado" on public.calificaciones;

delete from public.calificaciones;

alter table public.calificaciones drop column materia_id;
alter table public.calificaciones drop column periodo;
alter table public.calificaciones add column grupo_id uuid not null references public.grupos(id);
alter table public.calificaciones add constraint calificaciones_alumno_grupo_key unique (alumno_id, grupo_id);

create policy "calificaciones_select_propia_o_staff_o_docente_grupo"
  on public.calificaciones for select
  using (
    plantel_id = public.plantel_id_actual()
    and (
      exists (select 1 from public.alumnos a where a.id = calificaciones.alumno_id and a.perfil_id = auth.uid())
      or exists (select 1 from public.perfiles where id = auth.uid() and rol in ('administrativo','oficina_central'))
      or exists (select 1 from public.grupos g where g.id = calificaciones.grupo_id and g.docente_id = auth.uid())
    )
  );

-- El INSERT ahora exige, además del rol, que el alumno esté inscrito en el
-- grupo (`exists ... inscripciones`) — validación de integridad nueva: no se
-- puede calificar a alguien que no está inscrito.
create policy "calificaciones_insert_staff_o_docente_grupo"
  on public.calificaciones for insert
  with check (
    plantel_id = public.plantel_id_actual()
    and exists (select 1 from public.inscripciones i where i.alumno_id = calificaciones.alumno_id and i.grupo_id = calificaciones.grupo_id)
    and (
      exists (select 1 from public.perfiles where id = auth.uid() and rol in ('administrativo','oficina_central'))
      or exists (select 1 from public.grupos g where g.id = calificaciones.grupo_id and g.docente_id = auth.uid())
    )
  );

create policy "calificaciones_update_staff_o_docente_grupo"
  on public.calificaciones for update
  using (
    plantel_id = public.plantel_id_actual()
    and (
      exists (select 1 from public.perfiles where id = auth.uid() and rol in ('administrativo','oficina_central'))
      or exists (select 1 from public.grupos g where g.id = calificaciones.grupo_id and g.docente_id = auth.uid())
    )
  )
  with check (plantel_id = public.plantel_id_actual());
