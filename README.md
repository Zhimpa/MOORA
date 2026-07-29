# MOORA — Sistema de Inventario y Finanzas

Sistema de control de inventario, ventas, compras, clientes/proveedores y
finanzas para MOORA (compra y venta al por mayor y menor de perfumes,
skincare y maquillaje).

Ver [CLAUDE.md](./CLAUDE.md) para el detalle de módulos, roles, reglas de
seguridad y convenciones del proyecto.

## Stack

- Next.js 16 (App Router) + TypeScript + Tailwind CSS 4
- Supabase (Auth, Postgres, Storage, RLS)
- Recharts para el dashboard · date-fns para fechas
- Vercel para despliegue

## Puesta en marcha

### 1. Base de datos

En Supabase → **SQL Editor** → pega y ejecuta el archivo
[`supabase/INSTALAR_TODO.sql`](./supabase/INSTALAR_TODO.sql) completo.

Ese archivo es la unión de las migraciones de [`supabase/migrations/`](./supabase/migrations/),
en orden. Se puede volver a ejecutar sin romper nada.

Crea: catálogo de productos y variantes, inventario, clientes, proveedores,
compras, ventas, pagos, gastos, las vistas de reportes, los roles y todas las
políticas de seguridad (RLS).

### 2. Variables de entorno

Copia `.env.local.example` a `.env.local` y complétalo con los datos de
Supabase (Project Settings → API):

```
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhb...
SUPABASE_SERVICE_ROLE_KEY=eyJhb...
```

Las mismas tres variables hay que cargarlas en Vercel
(Project Settings → Environment Variables) para que funcione el despliegue.

> `SUPABASE_SERVICE_ROLE_KEY` es secreta: nunca va en código del cliente ni se
> sube al repositorio.

### 3. Correr el proyecto

```bash
npm install
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

### 4. Primer usuario

Entra a `/login` → pestaña **Crear cuenta**. La **primera cuenta que se
registre queda como administrador**; las siguientes entran como *vendedor* y
el admin les cambia el rol desde **Usuarios**.

Si Supabase tiene activada la confirmación por correo
(Authentication → Providers → Email), hay que confirmar el correo antes de
poder entrar. Para pruebas se puede desactivar ahí mismo.

## Roles

| Rol | Qué puede hacer |
|---|---|
| **admin** | Todo: finanzas, gastos, usuarios, configuración |
| **vendedor** | Ventas, clientes, cobros. Ve stock y precios. No ve compras ni gastos |
| **almacen** | Productos, proveedores, compras, movimientos de inventario. No ve ventas ni finanzas |
| **contador** | Solo lectura de reportes financieros, cuentas por cobrar/pagar y gastos |

La separación de permisos está en la base de datos con **Row Level Security**.
La interfaz solo esconde lo que no corresponde; aunque alguien manipule el
navegador, la base de datos no le devuelve datos ajenos a su rol.

## Cómo funciona el inventario

El campo `stock` **nunca se edita a mano** — ni desde la app ni desde SQL: los
usuarios tienen revocado el permiso de escritura sobre esa columna.

El stock se calcula desde `movimientos_inventario`, que es la fuente de verdad.
Se mueve solo por:

- **Confirmar una compra** → entra stock y se recalcula el costo promedio ponderado
- **Confirmar una venta** → sale stock y se congela el costo para el margen histórico
- **Ajuste de inventario** → corrige contra un conteo físico
- **Entrada/salida manual** → mermas, muestras, uso interno
- **Anular** una compra o venta → genera el movimiento inverso

Las ventas y compras nacen en **borrador** (no tocan stock). Al confirmarlas se
aplican al inventario y quedan cerradas a edición.

## Estructura

```
src/
  app/
    (app)/            Páginas privadas (requieren sesión)
      page.tsx        Dashboard con KPIs
      productos/      Catálogo y presentaciones (variantes)
      inventario/     Stock, ajustes y movimientos
      ventas/         Ventas, confirmación y cobros
      compras/        Compras a proveedores y pagos
      clientes/  proveedores/  gastos/  reportes/  usuarios/
    login/            Ingreso y registro
  components/         UI reutilizable
  lib/                Supabase, auth, formatos y tipos
  proxy.ts            Sesión y protección de rutas
supabase/
  migrations/         Migraciones en orden
  INSTALAR_TODO.sql   Las migraciones unidas, listas para pegar
```

> En Next.js 16 el antiguo `middleware.ts` se llama `proxy.ts`.

## Nota contable

Los reportes son de **control interno de gestión**. No reemplazan al contador
ni generan comprobantes válidos ante SUNAT.
