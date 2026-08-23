-- Asignación docente <-> materia: cierra el hueco de mínimo privilegio
-- documentado en supabase/migrations/20260822200144_endurecer_rls_visibilidad_por_rol.sql
-- ("docente mantiene visibilidad de TODO el plantel a propósito: no existe
-- todavía asignación de materias/grupos a un docente específico"). Hoy
-- cualquier perfil con rol `docente` puede ver y calificar CUALQUIER materia
-- de su plantel — un docente de Matemáticas puede calificar Historia sin
-- restricción alguna.
--
-- Alcance explícito: solo asignación docente<->materia, NO docente<->grupo
-- (no existe todavía el concepto de "grupos" de alumnos en el modelo de
-- datos). `asistencias` queda fuera de esta migración a propósito: es
-- diaria y general del plantel, no por materia/clase (decisión ya tomada,
-- ver comentario en 20260822200144) — cualquier staff/docente sigue
-- pudiendo tomar asistencia general como hasta ahora.

create table public.docente_materias (
  id uuid primary key default gen_random_uuid(),
  plantel_id uuid not null references public.planteles(id),
  docente_id uuid not null references public.perfiles(id),
  materia_id uuid not null references public.materias(id),
  created_at timestamptz not null default now(),
  unique (docente_id, materia_id)
);

alter table public.docente_materias enable row level security;
create index idx_docente_materias_plantel_id on public.docente_materias(plantel_id);
create index idx_docente_materias_docente_id on public.docente_materias(docente_id);
create index idx_docente_materias_materia_id on public.docente_materias(materia_id);

-- SELECT: el propio docente ve sus asignaciones; staff ve todas las del
-- plantel (para la pantalla de gestión /plantel/asignaciones).
create policy "docente_materias_select_propia_o_staff"
  on public.docente_materias for select
  using (
    plantel_id = public.plantel_id_actual()
    and (
      docente_id = auth.uid()
      or exists (select 1 from public.perfiles where id = auth.uid() and rol in ('administrativo','oficina_central'))
    )
  );

-- INSERT/DELETE: solo staff asigna/desasigna — un docente no puede
-- auto-asignarse una materia.
create policy "docente_materias_insert_staff"
  on public.docente_materias for insert
  with check (
    plantel_id = public.plantel_id_actual()
    and exists (select 1 from public.perfiles where id = auth.uid() and rol in ('administrativo','oficina_central'))
  );

create policy "docente_materias_delete_staff"
  on public.docente_materias for delete
  using (
    plantel_id = public.plantel_id_actual()
    and exists (select 1 from public.perfiles where id = auth.uid() and rol in ('administrativo','oficina_central'))
  );

-- calificaciones: reemplaza las tres políticas tocadas por
-- 20260822200144_endurecer_rls_visibilidad_por_rol.sql — se añade la
-- condición "docente asignado a esta materia" junto a staff/alumno propio,
-- en vez de "cualquier docente del plantel".
drop policy "calificaciones_select_propio_o_staff" on public.calificaciones;
create policy "calificaciones_select_propio_o_staff_o_docente_asignado"
  on public.calificaciones for select
  using (
    plantel_id = public.plantel_id_actual()
    and (
      exists (select 1 from public.alumnos a where a.id = calificaciones.alumno_id and a.perfil_id = auth.uid())
      or exists (select 1 from public.perfiles where id = auth.uid() and rol in ('administrativo','oficina_central'))
      or exists (
        select 1 from public.docente_materias dm
        where dm.docente_id = auth.uid() and dm.materia_id = calificaciones.materia_id
      )
    )
  );

drop policy "calificaciones_insert_staff_mismo_plantel" on public.calificaciones;
create policy "calificaciones_insert_staff_o_docente_asignado"
  on public.calificaciones for insert
  with check (
    plantel_id = public.plantel_id_actual()
    and (
      exists (select 1 from public.perfiles where id = auth.uid() and rol in ('administrativo','oficina_central'))
      or exists (
        select 1 from public.docente_materias dm
        where dm.docente_id = auth.uid() and dm.materia_id = calificaciones.materia_id
      )
    )
  );

drop policy "calificaciones_update_staff_mismo_plantel" on public.calificaciones;
create policy "calificaciones_update_staff_o_docente_asignado"
  on public.calificaciones for update
  using (
    plantel_id = public.plantel_id_actual()
    and (
      exists (select 1 from public.perfiles where id = auth.uid() and rol in ('administrativo','oficina_central'))
      or exists (
        select 1 from public.docente_materias dm
        where dm.docente_id = auth.uid() and dm.materia_id = calificaciones.materia_id
      )
    )
  )
  with check (
    plantel_id = public.plantel_id_actual()
  );
