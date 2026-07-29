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
