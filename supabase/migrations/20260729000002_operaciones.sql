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
