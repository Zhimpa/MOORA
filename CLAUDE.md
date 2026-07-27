# CLAUDE.md — Reglas del proyecto MOORA

> Este archivo es la "constitución" del proyecto. Claude Code lo lee al inicio de cada sesión.
> Si una instrucción de un prompt contradice este archivo en temas de seguridad, GANA este archivo.
> Mantenlo corto. No metas aquí cosas que cambian semana a semana (eso va en los prompts).

## Qué estamos construyendo

Sistema de control de inventario, ventas, compras y finanzas para **MOORA**,
empresa dedicada a la compra y venta al por mayor y menor de perfumes,
skincare y maquillaje.

- Control de **inventario** (productos, variantes por tamaño/tono, entradas y salidas).
- Control de **compras** a proveedores y **cuentas por pagar**.
- Control de **ventas** a clientes (mayoristas y minoristas) y **cuentas por cobrar**
  (clientes con deuda).
- **Finanzas y contabilidad gerencial**: estado de resultados, flujo de caja,
  gastos, valorización de inventario. Es contabilidad de **control interno**,
  no reemplaza al contador ni genera comprobantes válidos ante SUNAT.
- **Dashboard** interactivo con KPIs y gráficos pensado para alguien sin
  conocimientos de contabilidad.
- Objetivo: que el dueño tenga control real y rápido del negocio.

## Stack (no cambiar sin avisarme)

- **Next.js (App Router) + TypeScript + Tailwind CSS.**
- **Supabase**: autenticación, Postgres, Storage (imágenes de productos), RLS.
- **Recharts** para los gráficos del dashboard.
- **date-fns** para manejo de fechas.
- **Despliegue**: Vercel.
- Moneda única: **Soles (PEN)**. Sin facturación electrónica SUNAT (por ahora).
- Un solo almacén/tienda por ahora (el esquema deja lugar a más adelante,
  pero no se construye UI multi-sucursal hasta que se pida).

> Los nombres de paquetes/versiones pueden cambiar. Si algo ya no existe o
> cambió de forma incompatible, avísame antes de reemplazarlo por otra cosa.

## Roles de usuario

- **admin** (dueño): acceso total, incluida configuración y finanzas.
- **vendedor**: registra ventas, ve stock y clientes. No ve compras ni gastos ni reportes financieros completos.
- **almacen**: gestiona productos, proveedores, compras y movimientos de inventario. No ve finanzas ni ventas detalladas.
- **contador**: acceso de **solo lectura** a reportes financieros/contables (estado de resultados, cuentas por cobrar/pagar, gastos, flujo de caja).

## Reglas inquebrantables (seguridad)

1. **Nunca** pongas claves de API ni la `SUPABASE_SERVICE_ROLE_KEY` en código del cliente ni las dejes accesibles desde el navegador. Solo viven en el servidor, vía variables de entorno.
2. **Nunca** subas claves reales al repositorio. Usa `.env.local` (ignorado por git) y mantén un `.env.local.example` sin valores.
3. Toda operación sensible (cambiar roles, eliminar productos/clientes/proveedores, ajustar stock manualmente) se ejecuta en el **servidor**, validando el rol de quien la pide.
4. La separación de roles se hace con **Row Level Security (RLS)** en Supabase, no solo escondiendo botones en la interfaz.
5. Los movimientos de inventario (`movimientos_inventario`) son la **fuente de verdad** del stock — nunca se edita el campo `stock` de una variante a mano, siempre a través de un movimiento (entrada/salida/ajuste/venta/compra/devolución).
6. Toda venta o compra que registre pagos parciales debe reflejarse en cuentas por cobrar/pagar de forma consistente (total documento − suma de pagos registrados).

## Cómo trabajar conmigo

- Trabajamos **por fases**. Te doy una fase a la vez; no te adelantes a fases que no te he pedido.
- Si una decisión tiene riesgo de costo, seguridad o un límite de la plataforma, **avísame ANTES** de implementarla y propón la opción más simple que funcione.
- Al terminar cada fase, dame: (1) cómo correr/probar, (2) qué variables de entorno configurar, (3) qué debería ver yo si funcionó.
- Cuando generes SQL para Supabase, dámelo en un bloque aparte listo para pegar en el editor SQL (o como migración en `supabase/migrations/`).

## Convenciones

- Código en TypeScript, comentarios breves en español.
- Mensajes de la interfaz, en español.
- Variables de entorno: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
