-- =============================================================
-- MOORA — 003: Lógica de negocio
-- El stock se deriva SIEMPRE de movimientos_inventario.
-- Confirmar una compra o venta es lo único que mueve inventario.
-- =============================================================

-- -------------------------------------------------------------
-- Stock derivado: el trigger es el único que escribe variantes.stock
-- -------------------------------------------------------------
create or replace function public.aplicar_movimiento_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update public.variantes set stock = stock + new.cantidad where id = new.variante_id;

  elsif (tg_op = 'DELETE') then
    update public.variantes set stock = stock - old.cantidad where id = old.variante_id;

  elsif (tg_op = 'UPDATE') then
    -- Si cambió de variante, revierte en la vieja y aplica en la nueva
    if old.variante_id <> new.variante_id then
      update public.variantes set stock = stock - old.cantidad where id = old.variante_id;
      update public.variantes set stock = stock + new.cantidad where id = new.variante_id;
    else
      update public.variantes set stock = stock - old.cantidad + new.cantidad where id = new.variante_id;
    end if;
  end if;

  return null;
end;
$$;

drop trigger if exists trg_stock on public.movimientos_inventario;
create trigger trg_stock
  after insert or update or delete on public.movimientos_inventario
  for each row execute function public.aplicar_movimiento_stock();

-- Nota: el blindaje de variantes.stock (que nadie lo edite a mano) se aplica
-- en la migración 004 revocando el UPDATE de esa columna a los usuarios.

-- -------------------------------------------------------------
-- Recalcular totales de un documento
-- -------------------------------------------------------------
create or replace function public.recalcular_total_compra(p_compra_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.compras c
  set subtotal = coalesce((select sum(subtotal) from public.compra_items where compra_id = p_compra_id), 0),
      total    = greatest(coalesce((select sum(subtotal) from public.compra_items where compra_id = p_compra_id), 0) - c.descuento, 0)
  where c.id = p_compra_id;
end;
$$;

create or replace function public.recalcular_total_venta(p_venta_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.ventas v
  set subtotal = coalesce((select sum(subtotal) from public.venta_items where venta_id = p_venta_id), 0),
      total    = greatest(coalesce((select sum(subtotal) from public.venta_items where venta_id = p_venta_id), 0) - v.descuento, 0)
  where v.id = p_venta_id;
end;
$$;

-- -------------------------------------------------------------
-- Confirmar COMPRA: ingresa stock y recalcula costo promedio ponderado
-- -------------------------------------------------------------
create or replace function public.confirmar_compra(p_compra_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_compra public.compras%rowtype;
  v_item   record;
  v_stock  numeric(12,2);
  v_costo  numeric(12,2);
begin
  select * into v_compra from public.compras where id = p_compra_id for update;
  if not found then raise exception 'La compra no existe'; end if;
  if v_compra.estado <> 'borrador' then
    raise exception 'Solo se puede confirmar una compra en borrador (estado actual: %)', v_compra.estado;
  end if;
  if not exists (select 1 from public.compra_items where compra_id = p_compra_id) then
    raise exception 'La compra no tiene productos';
  end if;

  for v_item in select * from public.compra_items where compra_id = p_compra_id loop
    -- Costo promedio ponderado antes de sumar el nuevo ingreso
    select stock, costo_promedio into v_stock, v_costo
      from public.variantes where id = v_item.variante_id for update;

    if (v_stock + v_item.cantidad) > 0 then
      update public.variantes
        set costo_promedio = round(
              ((greatest(v_stock, 0) * v_costo) + (v_item.cantidad * v_item.costo_unitario))
              / (greatest(v_stock, 0) + v_item.cantidad), 2)
        where id = v_item.variante_id;
    end if;

    insert into public.movimientos_inventario
      (variante_id, almacen_id, tipo, cantidad, costo_unitario, referencia_tipo, referencia_id, motivo, usuario_id)
    values
      (v_item.variante_id, v_compra.almacen_id, 'compra', v_item.cantidad, v_item.costo_unitario,
       'compra', p_compra_id, 'Compra confirmada', auth.uid());
  end loop;

  perform public.recalcular_total_compra(p_compra_id);
  update public.compras set estado = 'confirmada' where id = p_compra_id;
end;
$$;

-- -------------------------------------------------------------
-- Confirmar VENTA: valida stock, congela el costo y descarga inventario
-- -------------------------------------------------------------
create or replace function public.confirmar_venta(p_venta_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venta public.ventas%rowtype;
  v_item  record;
  v_falta text;
begin
  select * into v_venta from public.ventas where id = p_venta_id for update;
  if not found then raise exception 'La venta no existe'; end if;
  if v_venta.estado <> 'borrador' then
    raise exception 'Solo se puede confirmar una venta en borrador (estado actual: %)', v_venta.estado;
  end if;
  if not exists (select 1 from public.venta_items where venta_id = p_venta_id) then
    raise exception 'La venta no tiene productos';
  end if;

  -- Stock insuficiente: se avisa con nombre de producto, no con un id
  select string_agg(format('%s (disponible %s, pedido %s)', v.sku, v.stock, i.cantidad), '; ')
    into v_falta
  from public.venta_items i
  join public.variantes v on v.id = i.variante_id
  where i.venta_id = p_venta_id and v.stock < i.cantidad;

  if v_falta is not null then
    raise exception 'Stock insuficiente: %', v_falta;
  end if;

  for v_item in select * from public.venta_items where venta_id = p_venta_id loop
    -- Congela el costo actual para que el margen histórico no cambie después
    update public.venta_items
      set costo_unitario = (select costo_promedio from public.variantes where id = v_item.variante_id)
      where id = v_item.id;

    insert into public.movimientos_inventario
      (variante_id, almacen_id, tipo, cantidad, costo_unitario, referencia_tipo, referencia_id, motivo, usuario_id)
    values
      (v_item.variante_id, v_venta.almacen_id, 'venta', -v_item.cantidad,
       (select costo_promedio from public.variantes where id = v_item.variante_id),
       'venta', p_venta_id, 'Venta confirmada', auth.uid());
  end loop;

  perform public.recalcular_total_venta(p_venta_id);
  update public.ventas set estado = 'confirmada' where id = p_venta_id;
end;
$$;

-- -------------------------------------------------------------
-- Anular: revierte el inventario con movimientos inversos
-- -------------------------------------------------------------
create or replace function public.anular_venta(p_venta_id uuid, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_venta public.ventas%rowtype;
  v_mov   record;
begin
  select * into v_venta from public.ventas where id = p_venta_id for update;
  if not found then raise exception 'La venta no existe'; end if;
  if v_venta.estado = 'anulada' then raise exception 'La venta ya está anulada'; end if;

  if v_venta.estado = 'confirmada' then
    for v_mov in
      select * from public.movimientos_inventario
      where referencia_tipo = 'venta' and referencia_id = p_venta_id
    loop
      insert into public.movimientos_inventario
        (variante_id, almacen_id, tipo, cantidad, costo_unitario, referencia_tipo, referencia_id, motivo, usuario_id)
      values
        (v_mov.variante_id, v_mov.almacen_id, 'devolucion_cliente', abs(v_mov.cantidad), v_mov.costo_unitario,
         'venta', p_venta_id, coalesce(p_motivo, 'Venta anulada'), auth.uid());
    end loop;
  end if;

  update public.ventas set estado = 'anulada', notas = coalesce(notas || ' | ', '') || coalesce(p_motivo, 'Anulada')
  where id = p_venta_id;
end;
$$;

create or replace function public.anular_compra(p_compra_id uuid, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_compra public.compras%rowtype;
  v_mov    record;
begin
  select * into v_compra from public.compras where id = p_compra_id for update;
  if not found then raise exception 'La compra no existe'; end if;
  if v_compra.estado = 'anulada' then raise exception 'La compra ya está anulada'; end if;

  if v_compra.estado = 'confirmada' then
    for v_mov in
      select * from public.movimientos_inventario
      where referencia_tipo = 'compra' and referencia_id = p_compra_id
    loop
      insert into public.movimientos_inventario
        (variante_id, almacen_id, tipo, cantidad, costo_unitario, referencia_tipo, referencia_id, motivo, usuario_id)
      values
        (v_mov.variante_id, v_mov.almacen_id, 'devolucion_proveedor', -abs(v_mov.cantidad), v_mov.costo_unitario,
         'compra', p_compra_id, coalesce(p_motivo, 'Compra anulada'), auth.uid());
    end loop;
  end if;

  update public.compras set estado = 'anulada', notas = coalesce(notas || ' | ', '') || coalesce(p_motivo, 'Anulada')
  where id = p_compra_id;
end;
$$;

-- -------------------------------------------------------------
-- Ajuste manual de inventario (conteo físico)
-- -------------------------------------------------------------
create or replace function public.ajustar_stock(
  p_variante_id uuid,
  p_stock_real  numeric,
  p_motivo      text default 'Ajuste por conteo físico'
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actual  numeric(12,2);
  v_almacen uuid;
  v_dif     numeric(12,2);
begin
  select stock into v_actual from public.variantes where id = p_variante_id for update;
  if not found then raise exception 'La variante no existe'; end if;

  select id into v_almacen from public.almacenes where activo order by created_at limit 1;
  v_dif := p_stock_real - v_actual;
  if v_dif = 0 then return; end if;

  insert into public.movimientos_inventario
    (variante_id, almacen_id, tipo, cantidad, costo_unitario, referencia_tipo, motivo, usuario_id)
  values
    (p_variante_id, v_almacen, 'ajuste', v_dif,
     (select costo_promedio from public.variantes where id = p_variante_id),
     'manual', p_motivo, auth.uid());
end;
$$;

-- =============================================================
-- VISTAS DE REPORTE
-- security_invoker = las vistas respetan el RLS de quien consulta
-- =============================================================

create or replace view public.v_stock_actual
with (security_invoker = true) as
select
  v.id                as variante_id,
  v.sku,
  v.nombre            as variante,
  v.stock,
  v.stock_minimo,
  v.costo_promedio,
  v.precio_venta_menor,
  v.precio_venta_mayor,
  round(v.stock * v.costo_promedio, 2) as valor_inventario,
  (v.stock <= v.stock_minimo)          as stock_bajo,
  p.id                as producto_id,
  p.nombre            as producto,
  p.tipo,
  c.nombre            as categoria,
  m.nombre            as marca,
  v.activo
from public.variantes v
join public.productos p  on p.id = v.producto_id
left join public.categorias c on c.id = p.categoria_id
left join public.marcas m     on m.id = p.marca_id;

-- Cuentas por cobrar: total del documento − pagos registrados
create or replace view public.v_cuentas_por_cobrar
with (security_invoker = true) as
select
  ve.id            as venta_id,
  ve.numero,
  ve.fecha,
  ve.total,
  coalesce(pg.pagado, 0)              as pagado,
  ve.total - coalesce(pg.pagado, 0)   as saldo,
  cl.id            as cliente_id,
  coalesce(cl.nombre, 'Mostrador')    as cliente,
  cl.telefono,
  current_date - ve.fecha             as dias_transcurridos
from public.ventas ve
left join public.clientes cl on cl.id = ve.cliente_id
left join lateral (
  select sum(monto) as pagado from public.pagos_venta where venta_id = ve.id
) pg on true
where ve.estado = 'confirmada'
  and ve.total - coalesce(pg.pagado, 0) > 0;

create or replace view public.v_cuentas_por_pagar
with (security_invoker = true) as
select
  co.id            as compra_id,
  co.numero_documento,
  co.fecha,
  co.total,
  coalesce(pg.pagado, 0)              as pagado,
  co.total - coalesce(pg.pagado, 0)   as saldo,
  pr.id            as proveedor_id,
  pr.nombre        as proveedor,
  pr.telefono,
  current_date - co.fecha             as dias_transcurridos
from public.compras co
join public.proveedores pr on pr.id = co.proveedor_id
left join lateral (
  select sum(monto) as pagado from public.pagos_compra where compra_id = co.id
) pg on true
where co.estado = 'confirmada'
  and co.total - coalesce(pg.pagado, 0) > 0;

-- Estado de resultados simplificado, mes a mes
create or replace view public.v_resultados_mensuales
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
gastos_mes as (
  select date_trunc('month', fecha)::date as mes, sum(monto) as gastos
  from public.gastos group by 1
)
select
  coalesce(v.mes, g.mes)                          as mes,
  coalesce(v.ingresos, 0)                         as ingresos,
  coalesce(v.costo_ventas, 0)                     as costo_ventas,
  coalesce(v.ingresos, 0) - coalesce(v.costo_ventas, 0) as utilidad_bruta,
  coalesce(g.gastos, 0)                           as gastos,
  coalesce(v.ingresos, 0) - coalesce(v.costo_ventas, 0) - coalesce(g.gastos, 0) as utilidad_neta
from ventas_mes v
full outer join gastos_mes g on g.mes = v.mes
order by 1 desc;

-- -------------------------------------------------------------
-- KPIs del dashboard en una sola llamada
-- -------------------------------------------------------------
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
    'gastos_periodo',      coalesce((select sum(monto) from public.gastos
                                     where fecha > current_date - p_dias), 0),
    'por_cobrar',          coalesce((select sum(saldo) from public.v_cuentas_por_cobrar), 0),
    'por_pagar',           coalesce((select sum(saldo) from public.v_cuentas_por_pagar), 0),
    'valor_inventario',    coalesce((select sum(valor_inventario) from public.v_stock_actual where activo), 0),
    'productos_activos',   coalesce((select count(*) from public.productos where activo), 0),
    'stock_bajo',          coalesce((select count(*) from public.v_stock_actual where activo and stock_bajo), 0)
  );
$$;

-- Serie diaria de ventas para el gráfico
create or replace function public.serie_ventas(p_dias int default 30)
returns table (fecha date, total numeric)
language sql
security invoker
set search_path = public
as $$
  select d::date as fecha,
         coalesce((select sum(v.total) from public.ventas v
                   where v.fecha = d::date and v.estado = 'confirmada'), 0) as total
  from generate_series(current_date - (p_dias - 1), current_date, interval '1 day') d
  order by 1;
$$;
