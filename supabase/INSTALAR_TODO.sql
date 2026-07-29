-- =============================================================
-- MOORA — Instalación completa de la base de datos
-- Pega TODO este archivo en el editor SQL de Supabase y ejecútalo.
-- Es reejecutable: si lo corres dos veces, no rompe nada.
-- =============================================================


-- ####### 20260729000001_esquema_base.sql #######

-- =============================================================
-- MOORA — 001: Esquema base
-- Catálogo de productos, inventario y terceros (clientes/proveedores).
-- =============================================================

-- Utilidad: mantener updated_at al día en cualquier tabla
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =============================================================
-- CATÁLOGO
-- =============================================================

create table if not exists public.categorias (
  id          uuid primary key default gen_random_uuid(),
  nombre      text not null unique,
  descripcion text,
  activo      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create table if not exists public.marcas (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null unique,
  activo     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tipo de producto que maneja MOORA
do $$ begin
  create type public.tipo_producto as enum ('perfume', 'skincare', 'maquillaje', 'otro');
exception when duplicate_object then null;
end $$;

create table if not exists public.productos (
  id           uuid primary key default gen_random_uuid(),
  codigo       text unique,
  nombre       text not null,
  descripcion  text,
  tipo         public.tipo_producto not null default 'otro',
  categoria_id uuid references public.categorias(id) on delete set null,
  marca_id     uuid references public.marcas(id) on delete set null,
  imagen_url   text,
  activo       boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_productos_categoria on public.productos(categoria_id);
create index if not exists idx_productos_marca     on public.productos(marca_id);
create index if not exists idx_productos_activo    on public.productos(activo);

-- Variantes: el nivel real de inventario (100ml, tono 03, etc.)
-- El stock NUNCA se edita a mano: lo recalcula un trigger desde movimientos_inventario.
create table if not exists public.variantes (
  id                  uuid primary key default gen_random_uuid(),
  producto_id         uuid not null references public.productos(id) on delete cascade,
  sku                 text not null unique,
  nombre              text not null,               -- "100 ml", "Tono 03 Beige"
  codigo_barras       text unique,
  costo_promedio      numeric(12,2) not null default 0 check (costo_promedio >= 0),
  precio_venta_menor  numeric(12,2) not null default 0 check (precio_venta_menor >= 0),
  precio_venta_mayor  numeric(12,2) not null default 0 check (precio_venta_mayor >= 0),
  stock               numeric(12,2) not null default 0,  -- derivado, solo lo escribe el trigger
  stock_minimo        numeric(12,2) not null default 0 check (stock_minimo >= 0),
  activo              boolean not null default true,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_variantes_producto on public.variantes(producto_id);
create index if not exists idx_variantes_activo   on public.variantes(activo);

-- =============================================================
-- INVENTARIO
-- =============================================================

create table if not exists public.almacenes (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null unique,
  direccion  text,
  activo     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Un solo almacén por ahora; el esquema deja lugar a más adelante.
insert into public.almacenes (nombre, direccion)
select 'Tienda principal', 'Local MOORA'
where not exists (select 1 from public.almacenes);

do $$ begin
  create type public.tipo_movimiento as enum (
    'entrada',                -- ingreso manual
    'salida',                 -- salida manual (merma, uso interno)
    'ajuste',                 -- corrección de conteo físico
    'compra',                 -- ingreso por compra a proveedor
    'venta',                  -- salida por venta a cliente
    'devolucion_cliente',     -- el cliente devuelve: entra stock
    'devolucion_proveedor'    -- devolvemos al proveedor: sale stock
  );
exception when duplicate_object then null;
end $$;

-- FUENTE DE VERDAD DEL STOCK.
-- cantidad va con signo: positivo entra, negativo sale.
create table if not exists public.movimientos_inventario (
  id              uuid primary key default gen_random_uuid(),
  variante_id     uuid not null references public.variantes(id) on delete restrict,
  almacen_id      uuid not null references public.almacenes(id) on delete restrict,
  tipo            public.tipo_movimiento not null,
  cantidad        numeric(12,2) not null check (cantidad <> 0),
  costo_unitario  numeric(12,2) not null default 0 check (costo_unitario >= 0),
  -- Trazabilidad hacia la venta/compra que lo originó
  referencia_tipo text check (referencia_tipo in ('compra','venta','manual')),
  referencia_id   uuid,
  motivo          text,
  usuario_id      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists idx_mov_variante   on public.movimientos_inventario(variante_id);
create index if not exists idx_mov_almacen    on public.movimientos_inventario(almacen_id);
create index if not exists idx_mov_fecha      on public.movimientos_inventario(created_at desc);
create index if not exists idx_mov_referencia on public.movimientos_inventario(referencia_tipo, referencia_id);

-- Coherencia entre el tipo de movimiento y el signo de la cantidad
alter table public.movimientos_inventario
  drop constraint if exists chk_signo_movimiento;
alter table public.movimientos_inventario
  add constraint chk_signo_movimiento check (
    (tipo in ('entrada','compra','devolucion_cliente') and cantidad > 0)
    or (tipo in ('salida','venta','devolucion_proveedor') and cantidad < 0)
    or (tipo = 'ajuste')  -- el ajuste puede ir en cualquier dirección
  );

-- =============================================================
-- TERCEROS
-- =============================================================

create table if not exists public.proveedores (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null,
  ruc        text unique,
  contacto   text,
  telefono   text,
  email      text,
  direccion  text,
  notas      text,
  activo     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  create type public.tipo_cliente as enum ('minorista', 'mayorista');
exception when duplicate_object then null;
end $$;

create table if not exists public.clientes (
  id               uuid primary key default gen_random_uuid(),
  nombre           text not null,
  tipo             public.tipo_cliente not null default 'minorista',
  tipo_documento   text check (tipo_documento in ('DNI','RUC','CE','PAS')),
  numero_documento text,
  telefono         text,
  email            text,
  direccion        text,
  limite_credito   numeric(12,2) not null default 0 check (limite_credito >= 0),
  notas            text,
  activo           boolean not null default true,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create unique index if not exists idx_clientes_documento
  on public.clientes(tipo_documento, numero_documento)
  where numero_documento is not null;

create index if not exists idx_clientes_nombre on public.clientes(nombre);

-- =============================================================
-- Triggers de updated_at
-- =============================================================

do $$
declare t text;
begin
  foreach t in array array[
    'categorias','marcas','productos','variantes',
    'almacenes','proveedores','clientes'
  ] loop
    execute format(
      'drop trigger if exists trg_updated_at on public.%I;
       create trigger trg_updated_at before update on public.%I
       for each row execute function public.set_updated_at();', t, t);
  end loop;
end $$;

-- ####### 20260729000002_operaciones.sql #######

-- =============================================================
-- MOORA — 002: Operaciones
-- Compras a proveedores, ventas a clientes, pagos y gastos.
-- =============================================================

do $$ begin
  create type public.estado_documento as enum ('borrador', 'confirmada', 'anulada');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.metodo_pago as enum ('efectivo', 'yape', 'plin', 'transferencia', 'tarjeta', 'otro');
exception when duplicate_object then null;
end $$;

-- =============================================================
-- COMPRAS
-- =============================================================

create table if not exists public.compras (
  id               uuid primary key default gen_random_uuid(),
  proveedor_id     uuid not null references public.proveedores(id) on delete restrict,
  almacen_id       uuid not null references public.almacenes(id) on delete restrict,
  numero_documento text,                              -- factura/boleta del proveedor
  fecha            date not null default current_date,
  subtotal         numeric(12,2) not null default 0 check (subtotal >= 0),
  descuento        numeric(12,2) not null default 0 check (descuento >= 0),
  total            numeric(12,2) not null default 0 check (total >= 0),
  estado           public.estado_documento not null default 'borrador',
  notas            text,
  usuario_id       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_compras_proveedor on public.compras(proveedor_id);
create index if not exists idx_compras_fecha     on public.compras(fecha desc);
create index if not exists idx_compras_estado    on public.compras(estado);

create table if not exists public.compra_items (
  id             uuid primary key default gen_random_uuid(),
  compra_id      uuid not null references public.compras(id) on delete cascade,
  variante_id    uuid not null references public.variantes(id) on delete restrict,
  cantidad       numeric(12,2) not null check (cantidad > 0),
  costo_unitario numeric(12,2) not null check (costo_unitario >= 0),
  subtotal       numeric(12,2) generated always as (cantidad * costo_unitario) stored,
  created_at     timestamptz not null default now()
);

create index if not exists idx_compra_items_compra   on public.compra_items(compra_id);
create index if not exists idx_compra_items_variante on public.compra_items(variante_id);

create table if not exists public.pagos_compra (
  id           uuid primary key default gen_random_uuid(),
  compra_id    uuid not null references public.compras(id) on delete cascade,
  fecha        date not null default current_date,
  monto        numeric(12,2) not null check (monto > 0),
  metodo       public.metodo_pago not null default 'efectivo',
  referencia   text,                                   -- nro de operación
  notas        text,
  usuario_id   uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index if not exists idx_pagos_compra_compra on public.pagos_compra(compra_id);
create index if not exists idx_pagos_compra_fecha  on public.pagos_compra(fecha desc);

-- =============================================================
-- VENTAS
-- =============================================================

-- Correlativo legible para las ventas (V-000001)
create sequence if not exists public.venta_numero_seq;

create table if not exists public.ventas (
  id          uuid primary key default gen_random_uuid(),
  numero      text not null unique default ('V-' || lpad(nextval('public.venta_numero_seq')::text, 6, '0')),
  cliente_id  uuid references public.clientes(id) on delete restrict,  -- null = venta de mostrador
  almacen_id  uuid not null references public.almacenes(id) on delete restrict,
  fecha       date not null default current_date,
  tipo        public.tipo_cliente not null default 'minorista',        -- define qué lista de precios se usó
  subtotal    numeric(12,2) not null default 0 check (subtotal >= 0),
  descuento   numeric(12,2) not null default 0 check (descuento >= 0),
  total       numeric(12,2) not null default 0 check (total >= 0),
  estado      public.estado_documento not null default 'borrador',
  notas       text,
  usuario_id  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_ventas_cliente on public.ventas(cliente_id);
create index if not exists idx_ventas_fecha   on public.ventas(fecha desc);
create index if not exists idx_ventas_estado  on public.ventas(estado);
create index if not exists idx_ventas_usuario on public.ventas(usuario_id);

create table if not exists public.venta_items (
  id              uuid primary key default gen_random_uuid(),
  venta_id        uuid not null references public.ventas(id) on delete cascade,
  variante_id     uuid not null references public.variantes(id) on delete restrict,
  cantidad        numeric(12,2) not null check (cantidad > 0),
  precio_unitario numeric(12,2) not null check (precio_unitario >= 0),
  -- Costo congelado al momento de vender: sin esto el margen histórico se distorsiona
  costo_unitario  numeric(12,2) not null default 0 check (costo_unitario >= 0),
  subtotal        numeric(12,2) generated always as (cantidad * precio_unitario) stored,
  created_at      timestamptz not null default now()
);

create index if not exists idx_venta_items_venta    on public.venta_items(venta_id);
create index if not exists idx_venta_items_variante on public.venta_items(variante_id);

create table if not exists public.pagos_venta (
  id         uuid primary key default gen_random_uuid(),
  venta_id   uuid not null references public.ventas(id) on delete cascade,
  fecha      date not null default current_date,
  monto      numeric(12,2) not null check (monto > 0),
  metodo     public.metodo_pago not null default 'efectivo',
  referencia text,
  notas      text,
  usuario_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists idx_pagos_venta_venta on public.pagos_venta(venta_id);
create index if not exists idx_pagos_venta_fecha on public.pagos_venta(fecha desc);

-- =============================================================
-- GASTOS
-- =============================================================

create table if not exists public.categorias_gasto (
  id         uuid primary key default gen_random_uuid(),
  nombre     text not null unique,
  activo     boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.categorias_gasto (nombre)
select x from unnest(array[
  'Alquiler','Servicios','Sueldos','Transporte','Publicidad',
  'Comisiones','Empaques','Impuestos','Otros'
]) as x
on conflict (nombre) do nothing;

create table if not exists public.gastos (
  id                 uuid primary key default gen_random_uuid(),
  categoria_gasto_id uuid references public.categorias_gasto(id) on delete set null,
  fecha              date not null default current_date,
  descripcion        text not null,
  monto              numeric(12,2) not null check (monto > 0),
  metodo             public.metodo_pago not null default 'efectivo',
  comprobante_url    text,
  usuario_id         uuid references auth.users(id) on delete set null,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create index if not exists idx_gastos_fecha     on public.gastos(fecha desc);
create index if not exists idx_gastos_categoria on public.gastos(categoria_gasto_id);

-- =============================================================
-- Triggers de updated_at
-- =============================================================

do $$
declare t text;
begin
  foreach t in array array['compras','ventas','gastos','categorias_gasto'] loop
    execute format(
      'drop trigger if exists trg_updated_at on public.%I;
       create trigger trg_updated_at before update on public.%I
       for each row execute function public.set_updated_at();', t, t);
  end loop;
end $$;

-- ####### 20260729000003_logica_negocio.sql #######

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

-- ####### 20260729000004_roles_rls.sql #######

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
