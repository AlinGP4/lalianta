# TPV

Codigo de interfaz para el terminal punto de venta.

## Superficies

- Administracion: pensada para tablet y desktop. `/tpv/admin` redirige a productos.
- Productos: CRUD administrativo de productos en `/tpv/admin/productos`.
- Mesas: alta incremental de mesas y QR unico de cliente en `/tpv/admin/mesas`.
- Historico: panel propio con colas independientes de Cocina y Barra en `/tpv/historico`.
- Pedidos camarero: pensada para movil interno. Ruta: `/tpv/pedidos`.
- Pedido cliente: ruta del QR unico. El cliente selecciona mesa al entrar. Ruta: `/pedido`.

Ambas zonas deben ser privadas, protegidas por autenticacion y marcadas como `noindex`.

## Estado actual

- Admin sin dashboard/panel; la entrada principal es `/tpv/admin/productos`.
- CRUD de productos en `/tpv/admin/productos`.
- Gestion de mesas, QRs e impresion en `/tpv/admin/mesas`.
- Historico de pedidos con completado independiente para Cocina y Barra en `/tpv/historico`.
- TPV de camarero en `/tpv/pedidos`.
- Pedido cliente por QR en `/pedido`.
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

El historico de pedidos ya esta disponible en `/tpv/historico`. La auditoria de caja queda pendiente para revisar:

- Sesiones de caja abiertas y cerradas.
- Tickets generados durante cada sesion.
- Tickets pagados completos o parciales.
- Totales finales por sesion.

### 7. Roles de usuario

El sistema tendra cinco tipos de usuario:

- `Administrador`
- `Barra`
- `Cocina`
- `Camarero`
- `Cliente`

Permisos previstos:

#### Administrador

- Gestionar productos, mesas, caja y configuracion.
- Ver historicos y metricas.
- Ver totales, importes, arqueo y cierres.
- Ver historicos y metricas completas.

#### Barra

- Ver y completar el historico de barra.

#### Cocina

- Ver y completar el historico de cocina.

#### Camarero

- Crear pedidos desde `/tpv/pedidos` mesa por mesa.

#### Cliente

- No tiene usuario.
- Interactua desde el QR unico y selecciona su mesa al entrar.
- Puede pedir unicamente si la caja esta abierta y el permiso de pedidos cliente esta activado.

## Notas de implementacion

- La TPV seguira en zona privada y `noindex`.
- El pedido cliente seguira entrando por QR a `/pedido`; la mesa se selecciona al inicio.
- El backend seguira dentro del mismo proyecto Next.js, con logica en `Backend` y endpoints en `app/api`.
- Las reglas de caja afectaran tanto a la TPV como al pedido cliente.
- Hasta tener autenticacion real, la vista de caja ocultara importes por defecto con `*****`.

## Acceso actual

- `/tpv/login`: acceso de usuarios privados.
- `/tpv/setup`: alta inicial del primer administrador.
- `/tpv/admin/*`: solo administradores.
- `/tpv/historico`: administradores, barra, cocina y camareros.
- `/tpv/pedidos`: administradores y camareros.
