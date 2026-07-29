# Prompt para el rediseño del frontend de MOORA

> Copia todo lo que está dentro del bloque y pégaselo a Claude.

---

Eres un diseñador de producto y desarrollador frontend senior. Vas a rediseñar
por completo la interfaz de **MOORA**, un sistema de gestión que ya está
construido y funcionando. La lógica de negocio está terminada y probada: tu
trabajo es **solo la capa visual y de experiencia de uso**, sin romper nada de
lo que ya funciona.

## El negocio

MOORA es una empresa peruana que compra y vende **perfumes, skincare y
maquillaje**, al por mayor y al por menor. Un solo local por ahora.

Quien más va a usar el sistema es **el dueño, que no sabe de contabilidad**, y
sus vendedores, que registran ventas en el mostrador mientras atienden a un
cliente. La interfaz tiene que ser entendible sin manual y rápida de operar con
una mano en el celular.

- Moneda única: **soles peruanos (PEN)**, formato `S/ 1,234.56`
- Todo en **español**
- Sin facturación electrónica SUNAT (los reportes son de control interno)

## Stack — no lo cambies

- **Next.js 16** con App Router (en esta versión `middleware.ts` se llama `proxy.ts`)
- **React 19** · **TypeScript** en modo estricto
- **Tailwind CSS 4** — configuración por CSS en `src/app/globals.css` con
  `@import "tailwindcss"` y `@theme inline`. **No existe `tailwind.config.js`** y
  no debes crearlo.
- **Supabase** para datos y autenticación
- **Recharts** para gráficos · **date-fns** para fechas
- Se despliega en **Vercel**

Prefiere Tailwind puro. Si crees que hace falta una librería de componentes,
propónmelo antes con el motivo y el peso que agrega; no la instales por tu
cuenta.

## Cómo está armado hoy

```
src/
  app/
    layout.tsx              Layout raíz (html/body)
    globals.css             Tailwind 4 + tema
    login/
      page.tsx              Server Component que lee searchParams
      formulario.tsx        Client Component con useActionState
      actions.ts            iniciarSesion / registrarse / cerrarSesion
    sin-acceso/page.tsx     Pantalla de rol sin permiso
    (app)/                  Todo lo privado (exige sesión)
      layout.tsx            Cabecera + navegación + <main>
      page.tsx              Dashboard con KPIs y gráfico
      productos/page.tsx           Lista + alta
      productos/[id]/page.tsx      Detalle + presentaciones (variantes)
      inventario/page.tsx          Stock, ajustes, movimientos
      ventas/page.tsx              Lista + alta
      ventas/[id]/page.tsx         Detalle: ítems, confirmar, cobros
      compras/page.tsx             Lista + alta
      compras/[id]/page.tsx        Detalle: ítems, confirmar, pagos
      clientes/page.tsx
      proveedores/page.tsx
      gastos/page.tsx
      reportes/page.tsx            Estado de resultados, CxC, CxP, top productos
      usuarios/page.tsx            Admin cambia roles
  components/
    ui.tsx                  Tarjeta, Kpi, Boton, BotonLink, Campo, Input,
                            Select, TextArea, Tabla, Vacio, Etiqueta,
                            EstadoDoc, Aviso, TituloPagina
    navegacion.tsx          Client Component, filtra enlaces por rol
    grafico-ventas.tsx      Client Component, barras con Recharts
  lib/
    auth.ts, format.ts, tipos.ts, supabase/
```

**Patrón de datos:** las páginas son Server Components que leen de Supabase, y
los formularios envían a **Server Actions** (`<form action={miAction}>`). No hay
`fetch` del lado del cliente ni estado global.

## Reglas que no puedes romper

1. **No toques** `src/lib/`, ningún `actions.ts`, `src/proxy.ts` ni `supabase/`.
   Ahí vive la lógica y la seguridad.
2. **No cambies el atributo `name` de ningún input.** Las Server Actions leen los
   datos por `FormData.get('nombre_del_campo')`. Si lo renombras, se rompe el
   guardado en silencio.
3. **No cambies las rutas ni los nombres de archivo de página.**
4. **Mantén el envío por Server Action.** Si conviertes algo a Client Component,
   sigue usando `action={...}` o `useActionState`, nunca `onSubmit` con fetch.
5. **No inventes campos ni pantallas nuevas** que no existan en los datos.
6. Los textos van en **español**, con tildes correctas.

## Qué está feo hoy y quiero que resuelvas

1. **Todo es gris y plano.** No hay identidad de marca. MOORA vende perfumería y
   cosmética: la interfaz debería verse cuidada y elegante, sin caer en lo
   recargado ni lo infantil. Propón una paleta y tipografía, y justifícalas.
2. **Los formularios se abren con `<details>/<summary>`**, que es tosco. Pásalos a
   algo mejor: modal, panel lateral, o pantalla propia; tú decides qué conviene
   en cada caso, y en móvil especialmente.
3. **Las tablas no funcionan bien en celular** — hoy solo hacen scroll horizontal.
   En pantallas chicas deberían volverse tarjetas legibles.
4. **La navegación es una fila de pestañas con scroll.** En móvil conviene una
   barra inferior fija con los accesos principales; en escritorio, una barra
   lateral. Los enlaces se filtran por rol: respeta esa lógica.
5. **No hay manejo visual de errores.** Hoy, si una Server Action falla (por
   ejemplo "Stock insuficiente: PX-100 (disponible 2, pedido 5)"), Next muestra su
   pantalla de error genérica. Agrega `error.tsx` y muestra esos mensajes de forma
   clara dentro de la pantalla.
6. **No hay estados de carga.** Agrega `loading.tsx` con esqueletos y estados
   "pendiente" en los botones que envían formularios.
7. **Pantallas vacías sin gracia.** Cuando no hay datos, guía al usuario hacia la
   primera acción.
8. El **dashboard** debe leerse de un vistazo: qué vendí hoy, cuánto me deben,
   qué tengo que reponer.

## Los cuatro roles

La navegación y los botones cambian según quién entra. Esto ya está resuelto en
el código; respétalo:

| Rol | Ve |
|---|---|
| **admin** | Todo: ventas, compras, inventario, gastos, reportes, usuarios |
| **vendedor** | Ventas, clientes, productos (solo consulta de stock y precios) |
| **almacen** | Productos, inventario, compras, proveedores |
| **contador** | Solo lectura: reportes, cuentas por cobrar y pagar, gastos |

## Conceptos del negocio que la interfaz debe comunicar bien

- Un **producto** (ej. "Perfume Good Girl") tiene **presentaciones/variantes**
  (80 ml, 50 ml, Tono 03). El stock y los precios viven en la variante, no en el
  producto.
- Cada variante tiene **dos precios**: por menor y por mayor. La venta usa uno u
  otro según el tipo de cliente.
- Las **ventas y compras nacen en borrador** y no mueven inventario hasta que se
  **confirman**. Confirmar es irreversible (solo se puede anular). Ese momento
  debe sentirse importante en la interfaz: pedir confirmación clara.
- El **stock nunca se edita a mano**: cambia por compras, ventas, ajustes de
  conteo físico o movimientos manuales. La interfaz debe reforzar esa idea.
- Una venta puede quedar **parcialmente pagada** → genera deuda del cliente
  (cuentas por cobrar). Lo mismo con las compras hacia el proveedor.
- El **stock bajo** (por debajo del mínimo) debe saltar a la vista.

## Requisitos de la experiencia

- **Mobile-first de verdad.** Se va a usar de pie, en el mostrador, con una mano.
  Más adelante se envolverá como app de celular. Áreas táctiles de 44 px mínimo.
- Que funcione bien de 360 px hasta escritorio.
- **Accesibilidad**: contraste AA, `<label>` real en cada campo, foco visible,
  navegación por teclado.
- Modo oscuro si lo ves conveniente, pero que el claro sea impecable primero.
- Nada de dependencias que rompan el renderizado en servidor.

## Qué quiero de vuelta

1. Una **propuesta breve de dirección visual** antes de programar: paleta con sus
   valores, tipografía, forma de los componentes y el porqué. Máximo dos
   párrafos y una lista.
2. El **sistema de diseño** en `globals.css` con `@theme` (colores, radios,
   sombras, espaciado).
3. `src/components/ui.tsx` **rediseñado**, manteniendo los mismos nombres y props
   exportados para no romper las páginas que ya los usan.
4. Las **páginas actualizadas** con el nuevo diseño, respetando su lógica de datos.
5. La **navegación** rehecha (barra inferior en móvil, lateral en escritorio).
6. `error.tsx` y `loading.tsx` donde corresponda.
7. Al terminar: `npx tsc --noEmit` y `npm run build` deben pasar sin errores.
   Verifícalo tú antes de darme el trabajo por hecho.

Trabaja por partes y muéstrame avances: primero la dirección visual y el sistema
de componentes; después las pantallas. No hagas todo de una sola vez sin que yo
vea nada.
