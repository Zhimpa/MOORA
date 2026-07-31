-- =============================================================
-- MOORA — 005: Solicitudes de acceso
-- Ya no existe alta libre de cuentas. Quien quiere entrar deja una
-- solicitud (sin contraseña) y el admin la aprueba eligiendo el rol,
-- lo que dispara una invitación por correo desde Supabase Auth.
-- =============================================================

create table if not exists public.solicitudes_acceso (
  id              uuid primary key default gen_random_uuid(),
  nombre_completo text not null,
  email           text not null,
  telefono        text,
  mensaje         text,
  estado          text not null default 'pendiente'
                    check (estado in ('pendiente', 'aprobada', 'rechazada')),
  revisado_por    uuid references public.perfiles(id),
  revisado_at     timestamptz,
  created_at      timestamptz not null default now()
);

-- Evita spam de la misma persona mientras tenga una solicitud sin revisar
create unique index if not exists solicitudes_acceso_email_pendiente
  on public.solicitudes_acceso (lower(email))
  where estado = 'pendiente';

alter table public.solicitudes_acceso enable row level security;

drop policy if exists solicitudes_acceso_insert on public.solicitudes_acceso;
drop policy if exists solicitudes_acceso_select on public.solicitudes_acceso;
drop policy if exists solicitudes_acceso_update on public.solicitudes_acceso;
drop policy if exists solicitudes_acceso_delete on public.solicitudes_acceso;

-- Cualquiera (ni siquiera logueado) puede dejar una solicitud, pero no puede
-- leerlas: no devolvemos fila en el insert, así no hace falta permiso de select.
create policy solicitudes_acceso_insert on public.solicitudes_acceso
  for insert to anon, authenticated with check (true);

-- Solo el admin las revisa
create policy solicitudes_acceso_select on public.solicitudes_acceso for select to authenticated
  using (public.es_admin());
create policy solicitudes_acceso_update on public.solicitudes_acceso for update to authenticated
  using (public.es_admin()) with check (public.es_admin());
create policy solicitudes_acceso_delete on public.solicitudes_acceso for delete to authenticated
  using (public.es_admin());
