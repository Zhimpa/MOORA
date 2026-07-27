# MOORA — Sistema de Inventario y Finanzas

Sistema de control de inventario, ventas, compras, clientes/proveedores y
finanzas para MOORA (compra y venta al por mayor y menor de perfumes,
skincare y maquillaje).

Ver [CLAUDE.md](./CLAUDE.md) para el detalle de módulos, roles, reglas de
seguridad y convenciones del proyecto.

## Stack

- Next.js (App Router) + TypeScript + Tailwind CSS
- Supabase (Auth, Postgres, Storage, RLS)
- Recharts para el dashboard
- Vercel para despliegue

## Cómo correr el proyecto

1. Instala dependencias:

   ```bash
   npm install
   ```

2. Copia `.env.local.example` a `.env.local` y completa las variables con los
   datos de tu proyecto de Supabase (Project Settings → API):

   ```bash
   cp .env.local.example .env.local
   ```

3. Levanta el servidor de desarrollo:

   ```bash
   npm run dev
   ```

4. Abre [http://localhost:3000](http://localhost:3000).

## Base de datos

Las migraciones SQL viven en `supabase/migrations/`. Cada archivo se pega,
en orden, en el editor SQL de Supabase (o se aplica con la CLI de Supabase).
