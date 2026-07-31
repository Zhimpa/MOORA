-- =============================================================
-- MOORA — 006: Origen de la venta, comprador y comisiones
-- Cada venta guarda quién compró, por qué canal llegó y si hay un
-- asesor de ventas que gana comisión. La comisión NO afecta el total
-- que paga el cliente: es un gasto interno que resta de la utilidad neta.
-- =============================================================

do $$ begin
  create type public.plataforma_venta as enum (
    'tienda_fisica', 'mercado_libre', 'instagram', 'facebook', 'tiktok', 'whatsapp', 'otro'
  );
exception when duplicate_object then null;
end $$;

-- -------------------------------------------------------------
-- ASESORES DE VENTA
-- Personas (propias o referidos externos) que ganan comisión por
-- traer una venta. No necesitan cuenta en el sistema.
-- -------------------------------------------------------------
create table if not exists public.asesores_venta (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  telefono   text,
  notas      text,
  activo     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_asesores_venta_activo on public.asesores_venta(activo);

drop trigger if exists trg_updated_at on public.asesores_venta;
create trigger trg_updated_at before update on public.asesores_venta
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------
-- VENTAS: datos del comprador, canal de venta y comisión
-- -------------------------------------------------------------
alter table public.ventas
  add column if not exists comprador_nombre     text,
  add column if not exists comprador_documento  text,
  add column if not exists plataforma           public.plataforma_venta not null default 'tienda_fisica',
  add column if not exists asesor_id            uuid references public.asesores_venta(id) on delete set null,
  add column if not exists comision_monto       numeric(12,2) not null default 0 check (comision_monto >= 0);

create index if not exists idx_ventas_asesor on public.ventas(asesor_id);
create index if not exists idx_ventas_plataforma on public.ventas(plataforma);

-- =============================================================
-- RLS — asesores_venta: mismas manos que operan ventas (admin/vendedor),
-- contador solo lee, admin borra.
-- =============================================================
alter table public.asesores_venta enable row level security;
revoke all on public.asesores_venta from anon;

drop policy if exists asesores_venta_select on public.asesores_venta;
drop policy if exists asesores_venta_insert on public.asesores_venta;
drop policy if exists asesores_venta_update on public.asesores_venta;
drop policy if exists asesores_venta_delete on public.asesores_venta;

create policy asesores_venta_select on public.asesores_venta for select to authenticated
  using (public.tiene_rol('admin','vendedor','contador'));
create policy asesores_venta_insert on public.asesores_venta for insert to authenticated
  with check (public.tiene_rol('admin','vendedor'));
create policy asesores_venta_update on public.asesores_venta for update to authenticated
  using (public.tiene_rol('admin','vendedor')) with check (public.tiene_rol('admin','vendedor'));
create policy asesores_venta_delete on public.asesores_venta for delete to authenticated
  using (public.es_admin());

-- =============================================================
-- VISTAS
-- =============================================================

-- Detalle de comisiones: una fila por venta con comisión > 0
create or replace view public.v_comisiones
with (security_invoker = true) as
select
  ve.id               as venta_id,
  ve.numero,
  ve.fecha,
  ve.estado,
  ve.total,
  ve.comision_monto,
  ve.plataforma,
  a.id                as asesor_id,
  a.nombre            as asesor,
  coalesce(ve.comprador_nombre, cl.nombre, 'Mostrador') as comprador,
  cl.id               as cliente_id
from public.ventas ve
join public.asesores_venta a on a.id = ve.asesor_id
left join public.clientes cl on cl.id = ve.cliente_id
where ve.comision_monto > 0 and ve.estado <> 'anulada';

-- Resumen por asesor: cuánto se le debe/pagó, en cuántas ventas
create or replace view public.v_comisiones_por_asesor
with (security_invoker = true) as
select
  a.id                as asesor_id,
  a.nombre            as asesor,
  a.activo,
  count(ve.id)         filter (where ve.comision_monto > 0 and ve.estado <> 'anulada') as num_ventas,
  coalesce(sum(ve.comision_monto) filter (where ve.estado <> 'anulada'), 0)            as total_comision,
  coalesce(sum(ve.total) filter (where ve.estado <> 'anulada'), 0)                     as total_vendido,
  max(ve.fecha)         filter (where ve.estado <> 'anulada')                          as ultima_venta
from public.asesores_venta a
left join public.ventas ve on ve.asesor_id = a.id and ve.comision_monto > 0
group by a.id, a.nombre, a.activo;

-- Estado de resultados simplificado, mes a mes (ahora descuenta comisiones)
-- Se elimina primero: CREATE OR REPLACE no permite insertar una columna
-- ("comisiones") en medio del orden existente, solo al final.
drop view if exists public.v_resultados_mensuales;
create view public.v_resultados_mensuales
with (security_invoker = true) as
with ventas_mes as (
  select date_trunc('month', ve.fecha)::date as mes,
         sum(vi.subtotal)                    as ingresos,
         sum(vi.cantidad * vi.costo_unitario) as costo_ventas
  from public.ventas ve
  join public.venta_items vi on vi.venta_id = ve.id
  where ve.estado = 'confirmada'
  group by 1
),
comisiones_mes as (
  select date_trunc('month', fecha)::date as mes, sum(comision_monto) as comisiones
  from public.ventas
  where estado = 'confirmada' and comision_monto > 0
  group by 1
),
gastos_mes as (
  select date_trunc('month', fecha)::date as mes, sum(monto) as gastos
  from public.gastos group by 1
)
select
  coalesce(v.mes, g.mes, c.mes)                              as mes,
  coalesce(v.ingresos, 0)                                    as ingresos,
  coalesce(v.costo_ventas, 0)                                as costo_ventas,
  coalesce(v.ingresos, 0) - coalesce(v.costo_ventas, 0)      as utilidad_bruta,
  coalesce(g.gastos, 0)                                      as gastos,
  coalesce(c.comisiones, 0)                                  as comisiones,
  coalesce(v.ingresos, 0) - coalesce(v.costo_ventas, 0)
    - coalesce(g.gastos, 0) - coalesce(c.comisiones, 0)      as utilidad_neta
from ventas_mes v
full outer join gastos_mes g on g.mes = v.mes
full outer join comisiones_mes c on c.mes = coalesce(v.mes, g.mes)
order by 1 desc;

-- KPIs del dashboard: la utilidad del periodo también descuenta comisiones
create or replace function public.kpis_dashboard(p_dias int default 30)
returns json
language sql
security invoker
set search_path = public
as $$
  select json_build_object(
    'ventas_periodo',      coalesce((select sum(total) from public.ventas
                                     where estado = 'confirmada' and fecha > current_date - p_dias), 0),
    'num_ventas',          coalesce((select count(*) from public.ventas
                                     where estado = 'confirmada' and fecha > current_date - p_dias), 0),
    'ventas_hoy',          coalesce((select sum(total) from public.ventas
                                     where estado = 'confirmada' and fecha = current_date), 0),
    'utilidad_periodo',    coalesce((select sum(vi.subtotal - vi.cantidad * vi.costo_unitario)
                                     from public.ventas ve join public.venta_items vi on vi.venta_id = ve.id
                                     where ve.estado = 'confirmada' and ve.fecha > current_date - p_dias), 0),
    'comisiones_periodo',  coalesce((select sum(comision_monto) from public.ventas
                                     where estado = 'confirmada' and fecha > current_date - p_dias), 0),
    'gastos_periodo',      coalesce((select sum(monto) from public.gastos
                                     where fecha > current_date - p_dias), 0),
    'por_cobrar',          coalesce((select sum(saldo) from public.v_cuentas_por_cobrar), 0),
    'por_pagar',           coalesce((select sum(saldo) from public.v_cuentas_por_pagar), 0),
    'valor_inventario',    coalesce((select sum(valor_inventario) from public.v_stock_actual where activo), 0),
    'productos_activos',   coalesce((select count(*) from public.productos where activo), 0),
    'stock_bajo',          coalesce((select count(*) from public.v_stock_actual where activo and stock_bajo), 0)
  );
$$;

grant execute on function public.kpis_dashboard(int) to authenticated;
