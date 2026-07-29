-- =============================================================
-- MOORA — 004: Perfiles, roles y Row Level Security
-- La separación de permisos vive aquí, en la base de datos.
-- Esconder botones en la UI no es seguridad.
-- =============================================================

do $$ begin
  create type public.rol_usuario as enum ('admin', 'vendedor', 'almacen', 'contador');
exception when duplicate_object then null;
end $$;

create table if not exists public.perfiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  nombre_completo text,
  rol             public.rol_usuario not null default 'vendedor',
  activo          boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

drop trigger if exists trg_updated_at on public.perfiles;
create trigger trg_updated_at before update on public.perfiles
  for each row execute function public.set_updated_at();

-- -------------------------------------------------------------
-- Alta automática de perfil al registrarse un usuario.
-- El PRIMER usuario del sistema es admin (el dueño); el resto entra
-- como vendedor y el admin le cambia el rol después.
-- -------------------------------------------------------------
create or replace function public.crear_perfil_nuevo_usuario()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_rol public.rol_usuario;
begin
  if not exists (select 1 from public.perfiles) then
    v_rol := 'admin';
  else
    v_rol := 'vendedor';
  end if;

  insert into public.perfiles (id, nombre_completo, rol)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre_completo', new.email), v_rol)
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists trg_nuevo_usuario on auth.users;
create trigger trg_nuevo_usuario
  after insert on auth.users
  for each row execute function public.crear_perfil_nuevo_usuario();

-- -------------------------------------------------------------
-- Helpers de rol.
-- SECURITY DEFINER a propósito: si leyeran perfiles con RLS activo,
-- las políticas que los usan entrarían en recursión infinita.
-- -------------------------------------------------------------
create or replace function public.mi_rol()
returns public.rol_usuario
language sql
stable
security definer
set search_path = public
as $$
  select rol from public.perfiles where id = auth.uid() and activo;
$$;

create or replace function public.tiene_rol(variadic p_roles public.rol_usuario[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.perfiles
    where id = auth.uid() and activo and rol = any(p_roles)
  );
$$;

create or replace function public.es_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.tiene_rol('admin');
$$;

-- =============================================================
-- Blindaje del stock: ni siquiera un admin lo edita a mano.
-- Solo el trigger (que corre como owner) puede tocar esa columna.
-- =============================================================
revoke update on public.variantes from authenticated;
grant update (
  producto_id, sku, nombre, codigo_barras, costo_promedio,
  precio_venta_menor, precio_venta_mayor, stock_minimo, activo, updated_at
) on public.variantes to authenticated;

-- =============================================================
-- Activar RLS en todas las tablas
-- =============================================================
do $$
declare t text;
begin
  foreach t in array array[
    'perfiles','categorias','marcas','productos','variantes','almacenes',
    'movimientos_inventario','proveedores','clientes',
    'compras','compra_items','pagos_compra',
    'ventas','venta_items','pagos_venta',
    'categorias_gasto','gastos'
  ] loop
    execute format('alter table public.%I enable row level security;', t);
    execute format('revoke all on public.%I from anon;', t);
  end loop;
end $$;

-- Limpieza: quita políticas previas para que la migración sea reejecutable
do $$
declare r record;
begin
  for r in
    select schemaname, tablename, policyname
    from pg_policies where schemaname = 'public'
  loop
    execute format('drop policy if exists %I on public.%I;', r.policyname, r.tablename);
  end loop;
end $$;

-- =============================================================
-- PERFILES
-- =============================================================
create policy perfiles_select on public.perfiles for select to authenticated
  using (id = auth.uid() or public.es_admin());

-- Solo el admin reparte roles
create policy perfiles_update on public.perfiles for update to authenticated
  using (public.es_admin()) with check (public.es_admin());

create policy perfiles_delete on public.perfiles for delete to authenticated
  using (public.es_admin() and id <> auth.uid());  -- que el admin no se borre a sí mismo

-- =============================================================
-- CATÁLOGO — todos leen (el vendedor necesita precios y stock),
-- solo admin/almacén modifican.
-- =============================================================
do $$
declare t text;
begin
  foreach t in array array['categorias','marcas','productos','variantes','almacenes'] loop
    execute format($f$
      create policy %1$s_select on public.%1$I for select to authenticated using (true);
      create policy %1$s_insert on public.%1$I for insert to authenticated
        with check (public.tiene_rol('admin','almacen'));
      create policy %1$s_update on public.%1$I for update to authenticated
        using (public.tiene_rol('admin','almacen'))
        with check (public.tiene_rol('admin','almacen'));
      create policy %1$s_delete on public.%1$I for delete to authenticated
        using (public.es_admin());
    $f$, t);
  end loop;
end $$;

-- =============================================================
-- MOVIMIENTOS DE INVENTARIO
-- Inmutables: no hay UPDATE ni DELETE para nadie. Se corrige con un ajuste.
-- =============================================================
create policy mov_select on public.movimientos_inventario for select to authenticated
  using (public.tiene_rol('admin','almacen','contador'));

create policy mov_insert on public.movimientos_inventario for insert to authenticated
  with check (public.tiene_rol('admin','almacen'));

-- =============================================================
-- PROVEEDORES — el vendedor no los ve
-- =============================================================
create policy proveedores_select on public.proveedores for select to authenticated
  using (public.tiene_rol('admin','almacen','contador'));
create policy proveedores_insert on public.proveedores for insert to authenticated
  with check (public.tiene_rol('admin','almacen'));
create policy proveedores_update on public.proveedores for update to authenticated
  using (public.tiene_rol('admin','almacen')) with check (public.tiene_rol('admin','almacen'));
create policy proveedores_delete on public.proveedores for delete to authenticated
  using (public.es_admin());

-- =============================================================
-- CLIENTES — el de almacén no los ve
-- =============================================================
create policy clientes_select on public.clientes for select to authenticated
  using (public.tiene_rol('admin','vendedor','contador'));
create policy clientes_insert on public.clientes for insert to authenticated
  with check (public.tiene_rol('admin','vendedor'));
create policy clientes_update on public.clientes for update to authenticated
  using (public.tiene_rol('admin','vendedor')) with check (public.tiene_rol('admin','vendedor'));
create policy clientes_delete on public.clientes for delete to authenticated
  using (public.es_admin());

-- =============================================================
-- COMPRAS — admin y almacén operan; contador solo mira
-- =============================================================
do $$
declare t text;
begin
  foreach t in array array['compras','compra_items','pagos_compra'] loop
    execute format($f$
      create policy %1$s_select on public.%1$I for select to authenticated
        using (public.tiene_rol('admin','almacen','contador'));
      create policy %1$s_insert on public.%1$I for insert to authenticated
        with check (public.tiene_rol('admin','almacen'));
      create policy %1$s_update on public.%1$I for update to authenticated
        using (public.tiene_rol('admin','almacen'))
        with check (public.tiene_rol('admin','almacen'));
      create policy %1$s_delete on public.%1$I for delete to authenticated
        using (public.tiene_rol('admin','almacen'));
    $f$, t);
  end loop;
end $$;

-- =============================================================
-- VENTAS — admin y vendedor operan; contador solo mira.
-- El vendedor solo puede tocar sus propias ventas y únicamente en borrador:
-- una vez confirmada, ya movió inventario y no se edita.
-- =============================================================
create policy ventas_select on public.ventas for select to authenticated
  using (public.tiene_rol('admin','vendedor','contador'));

create policy ventas_insert on public.ventas for insert to authenticated
  with check (public.tiene_rol('admin','vendedor'));

create policy ventas_update on public.ventas for update to authenticated
  using (
    public.es_admin()
    or (public.tiene_rol('vendedor') and usuario_id = auth.uid() and estado = 'borrador')
  )
  with check (
    public.es_admin()
    or (public.tiene_rol('vendedor') and usuario_id = auth.uid())
  );

create policy ventas_delete on public.ventas for delete to authenticated
  using (
    public.es_admin()
    or (public.tiene_rol('vendedor') and usuario_id = auth.uid() and estado = 'borrador')
  );

-- Los ítems siguen la suerte de su venta
create policy venta_items_select on public.venta_items for select to authenticated
  using (public.tiene_rol('admin','vendedor','contador'));

create policy venta_items_write on public.venta_items for all to authenticated
  using (
    exists (
      select 1 from public.ventas v where v.id = venta_id
        and (public.es_admin() or (public.tiene_rol('vendedor') and v.usuario_id = auth.uid() and v.estado = 'borrador'))
    )
  )
  with check (
    exists (
      select 1 from public.ventas v where v.id = venta_id
        and (public.es_admin() or (public.tiene_rol('vendedor') and v.usuario_id = auth.uid() and v.estado = 'borrador'))
    )
  );

-- Los pagos sí se registran sobre ventas ya confirmadas (cobranza)
create policy pagos_venta_select on public.pagos_venta for select to authenticated
  using (public.tiene_rol('admin','vendedor','contador'));
create policy pagos_venta_insert on public.pagos_venta for insert to authenticated
  with check (public.tiene_rol('admin','vendedor'));
create policy pagos_venta_update on public.pagos_venta for update to authenticated
  using (public.es_admin()) with check (public.es_admin());
create policy pagos_venta_delete on public.pagos_venta for delete to authenticated
  using (public.es_admin());

-- =============================================================
-- GASTOS — plata que sale: solo admin escribe, contador lee
-- =============================================================
create policy categorias_gasto_select on public.categorias_gasto for select to authenticated
  using (public.tiene_rol('admin','contador'));
create policy categorias_gasto_write on public.categorias_gasto for all to authenticated
  using (public.es_admin()) with check (public.es_admin());

create policy gastos_select on public.gastos for select to authenticated
  using (public.tiene_rol('admin','contador'));
create policy gastos_insert on public.gastos for insert to authenticated
  with check (public.es_admin());
create policy gastos_update on public.gastos for update to authenticated
  using (public.es_admin()) with check (public.es_admin());
create policy gastos_delete on public.gastos for delete to authenticated
  using (public.es_admin());

-- =============================================================
-- Permisos de ejecución de las funciones de negocio
-- =============================================================
revoke all on function public.confirmar_venta(uuid)          from public, anon;
revoke all on function public.confirmar_compra(uuid)         from public, anon;
revoke all on function public.anular_venta(uuid, text)       from public, anon;
revoke all on function public.anular_compra(uuid, text)      from public, anon;
revoke all on function public.ajustar_stock(uuid, numeric, text) from public, anon;

grant execute on function public.confirmar_venta(uuid)          to authenticated;
grant execute on function public.confirmar_compra(uuid)         to authenticated;
grant execute on function public.anular_venta(uuid, text)       to authenticated;
grant execute on function public.anular_compra(uuid, text)      to authenticated;
grant execute on function public.ajustar_stock(uuid, numeric, text) to authenticated;
grant execute on function public.kpis_dashboard(int)            to authenticated;
grant execute on function public.serie_ventas(int)              to authenticated;
grant execute on function public.mi_rol()                       to authenticated;
grant execute on function public.tiene_rol(public.rol_usuario[]) to authenticated;
grant execute on function public.es_admin()                     to authenticated;

-- Las funciones SECURITY DEFINER bypasean RLS, así que validan el rol por dentro.
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
  if not public.tiene_rol('admin','vendedor') then
    raise exception 'No tienes permiso para confirmar ventas';
  end if;

  select * into v_venta from public.ventas where id = p_venta_id for update;
  if not found then raise exception 'La venta no existe'; end if;
  if v_venta.estado <> 'borrador' then
    raise exception 'Solo se puede confirmar una venta en borrador (estado actual: %)', v_venta.estado;
  end if;
  if not exists (select 1 from public.venta_items where venta_id = p_venta_id) then
    raise exception 'La venta no tiene productos';
  end if;

  select string_agg(format('%s (disponible %s, pedido %s)', v.sku, v.stock, i.cantidad), '; ')
    into v_falta
  from public.venta_items i
  join public.variantes v on v.id = i.variante_id
  where i.venta_id = p_venta_id and v.stock < i.cantidad;

  if v_falta is not null then
    raise exception 'Stock insuficiente: %', v_falta;
  end if;

  for v_item in select * from public.venta_items where venta_id = p_venta_id loop
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
  if not public.tiene_rol('admin','almacen') then
    raise exception 'No tienes permiso para confirmar compras';
  end if;

  select * into v_compra from public.compras where id = p_compra_id for update;
  if not found then raise exception 'La compra no existe'; end if;
  if v_compra.estado <> 'borrador' then
    raise exception 'Solo se puede confirmar una compra en borrador (estado actual: %)', v_compra.estado;
  end if;
  if not exists (select 1 from public.compra_items where compra_id = p_compra_id) then
    raise exception 'La compra no tiene productos';
  end if;

  for v_item in select * from public.compra_items where compra_id = p_compra_id loop
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
  if not public.tiene_rol('admin','almacen') then
    raise exception 'No tienes permiso para ajustar inventario';
  end if;

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
-- STORAGE: imágenes de productos
-- =============================================================
insert into storage.buckets (id, name, public)
values ('productos', 'productos', true)
on conflict (id) do nothing;

drop policy if exists productos_img_lectura on storage.objects;
create policy productos_img_lectura on storage.objects for select
  using (bucket_id = 'productos');

drop policy if exists productos_img_escritura on storage.objects;
create policy productos_img_escritura on storage.objects for insert to authenticated
  with check (bucket_id = 'productos' and public.tiene_rol('admin','almacen'));

drop policy if exists productos_img_borrado on storage.objects;
create policy productos_img_borrado on storage.objects for delete to authenticated
  using (bucket_id = 'productos' and public.tiene_rol('admin','almacen'));
