create table public.materias (
  id uuid primary key default gen_random_uuid(),
  plantel_id uuid not null references public.planteles(id),
  nombre text not null,
  created_at timestamptz not null default now(),
  unique (plantel_id, nombre)
);

alter table public.materias enable row level security;
create index idx_materias_plantel_id on public.materias(plantel_id);

create policy "materias_select_mismo_plantel"
  on public.materias for select
  using (plantel_id = public.plantel_id_actual());

create policy "materias_insert_staff_mismo_plantel"
  on public.materias for insert
  with check (
    plantel_id = public.plantel_id_actual()
    and exists (
      select 1 from public.perfiles
      where id = auth.uid() and rol in ('administrativo','oficina_central')
    )
  );
