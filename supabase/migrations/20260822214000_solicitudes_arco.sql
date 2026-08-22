-- Canal formal de derechos ARCO (acceso, rectificación, cancelación,
-- oposición) exigido por CLAUDE.md 4.4 / LFPDPPP. Cualquier usuario
-- autenticado puede levantar una solicitud sobre sus propios datos; el
-- staff del plantel (administrativo/oficina_central) la ve y la marca como
-- resuelta manualmente. Esta tabla es el CANAL de la solicitud, no la
-- ejecución automática (ej. "cancelación" no borra datos por sí sola).
create table public.solicitudes_arco (
  id uuid primary key default gen_random_uuid(),
  plantel_id uuid not null references public.planteles(id),
  solicitante_id uuid not null references public.perfiles(id),
  tipo text not null check (tipo in ('acceso','rectificacion','cancelacion','oposicion')),
  descripcion text not null,
  estado text not null default 'pendiente' check (estado in ('pendiente','resuelta')),
  respuesta text,
  atendida_por uuid references public.perfiles(id),
  created_at timestamptz not null default now(),
  resuelta_en timestamptz
);

alter table public.solicitudes_arco enable row level security;
create index idx_solicitudes_arco_plantel_id on public.solicitudes_arco(plantel_id);

create policy "solicitudes_arco_select_propia_o_staff"
  on public.solicitudes_arco for select
  using (
    plantel_id = public.plantel_id_actual()
    and (
      solicitante_id = auth.uid()
      or exists (
        select 1 from public.perfiles
        where id = auth.uid() and rol in ('administrativo','oficina_central')
      )
    )
  );

-- Cualquier usuario autenticado (de cualquier rol) puede crear una
-- solicitud sobre sí mismo — a diferencia de otras tablas del proyecto, no
-- se restringe por rol el INSERT: derechos ARCO aplican a todo usuario,
-- no solo a staff.
create policy "solicitudes_arco_insert_propia"
  on public.solicitudes_arco for insert
  with check (
    plantel_id = public.plantel_id_actual()
    and solicitante_id = auth.uid()
  );

create policy "solicitudes_arco_update_staff"
  on public.solicitudes_arco for update
  using (
    plantel_id = public.plantel_id_actual()
    and exists (
      select 1 from public.perfiles
      where id = auth.uid() and rol in ('administrativo','oficina_central')
    )
  )
  with check (
    plantel_id = public.plantel_id_actual()
  );
