# TPV

Codigo de interfaz para el terminal punto de venta.

## Superficies

- Administracion: pensada para tablet y desktop. El panel en `/tpv/admin` es solo dashboards con Chart.js.
- Productos: CRUD administrativo de productos en `/tpv/admin/productos`.
- Mesas: alta incremental de mesas, QR e impresion de QRs en lote en `/tpv/admin/mesas`.
- Pedidos camarero: pensada para movil interno. Ruta: `/tpv/pedidos`.
- Pedido cliente: ruta del QR para que el cliente pida desde mesa. Ruta: `/pedido?mesa=N`.

Ambas zonas deben ser privadas, protegidas por autenticacion y marcadas como `noindex`.

## Estado actual

- Admin con dashboards en `/tpv/admin`.
- CRUD de productos en `/tpv/admin/productos`.
- Gestion de mesas, QRs e impresion en `/tpv/admin/mesas`.
- TPV de camarero en `/tpv/pedidos`.
- Pedido cliente por QR en `/pedido?mesa=N`.
- Estados de pedido actuales: `pending`, `delivered`, `paid`.
- Cobro completo y cobro por separado ya visibles en la TPV.

## Proximos cambios

### 1. Caja

Se anadira un modulo de `Caja` separado de la vista de mesas.

Incluira:

- `Abrir caja`.
- `Cerrar caja`.
- Estado actual de caja: abierta o cerrada.
- Importe inicial de apertura.
- Total acumulado del turno.
- Conteo de tickets cobrados.
- Ticket medio.
- Diferencia de cierre.
- Observaciones de apertura y cierre.

### 2. Vista de caja

La zona de caja mostrara:

- Todos los tickets generados.
- Tickets cobrados completos.
- Tickets cobrados por separado.
- Totales agregados del turno.
- Conteo general necesario para arqueo de bar.

La idea es que caja sirva como superficie de control y revision, no solo como accion de cobro.

### 3. Cobros

Se completara el flujo de cobro para cubrir:

- `Pagar todo`.
- `Dividir entre X personas`.
- `Pagar por separado`.
- Registro claro de tickets parciales y tickets finales pagados.
- Trazabilidad para que el cierre de caja cuadre.

### 4. Entregados y pagados

`Entregados` se tratara como cola real de cuentas pendientes de cobro, porque un ticket puede tardar bastante en pagarse.

Se mejorara con:

- Tickets individuales en entregados.
- Hora o antiguedad del ticket.
- Acceso directo a cobro desde cada ticket.
- Historico de `Pagados`.

### 5. Reglas operativas de cliente

Se aplicaran estas reglas:

- Si la caja esta cerrada, el cliente no puede pedir nada desde el QR.
- Si la caja esta abierta, el cliente solo podra pedir si el local lo permite.
- Habra un boton o interruptor de `Permitir pedidos cliente` para activar o bloquear pedidos de cliente aunque la caja este abierta.

Resumen de comportamiento:

- `Caja cerrada` -> cliente bloqueado.
- `Caja abierta + permitir pedidos cliente activado` -> cliente puede pedir.
- `Caja abierta + permitir pedidos cliente desactivado` -> cliente bloqueado.

### 6. Historico y auditoria

Se anadira historico para poder revisar:

- Sesiones de caja abiertas y cerradas.
- Tickets generados durante cada sesion.
- Tickets pagados completos o parciales.
- Totales finales por sesion.

### 7. Roles de usuario

El sistema tendra tres tipos de usuario:

- `Administrador`
- `Trabajador`
- `Cliente`

Permisos previstos:

#### Administrador

- Gestionar productos, mesas, caja y configuracion.
- Ver dashboards.
- Ver totales, importes, arqueo y cierres.
- Ver historicos y metricas completas.

#### Trabajador

- Crear pedidos y gestionar cuentas.
- Operar la TPV de mesa.
- Abrir caja y trabajar con la operativa diaria.
- No debe ver dashboards financieros ni totales sensibles.
- En caja, los importes deben salir ocultos por defecto.

#### Cliente

- No tiene usuario.
- Solo interactua desde el QR de su mesa.
- Puede pedir unicamente si la caja esta abierta y el permiso de pedidos cliente esta activado.

## Notas de implementacion

- La TPV seguira en zona privada y `noindex`.
- El pedido cliente seguira entrando por QR a `/pedido?mesa=N`.
- El backend seguira dentro del mismo proyecto Next.js, con logica en `Backend` y endpoints en `app/api`.
- Las reglas de caja afectaran tanto a la TPV como al pedido cliente.
- Hasta tener autenticacion real, la vista de caja ocultara importes por defecto con `*****`.

## Acceso actual

- `/tpv/login`: acceso de usuarios privados.
- `/tpv/setup`: alta inicial del primer administrador.
- `/tpv/admin/*`: solo administradores.
- `/tpv/pedidos`: administradores y trabajadores.
