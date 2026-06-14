# Backend

Zona reservada para la logica de servidor del proyecto.

En Next.js, los endpoints publicos de API pueden vivir en `app/api`, pero esta carpeta queda como espacio de organizacion para servicios, modelos, integraciones y logica reutilizable del backend.

## PostgreSQL

La conexion vive en `Backend/db.js` y usa `DATABASE_URL`.

1. Copia `.env.example` a `.env.local`.
2. Ajusta `DATABASE_URL` con los datos reales de PostgreSQL.
3. Con el servidor de desarrollo levantado, prueba `GET /api/health/db`.

El primer esquema base para TPV esta en `Backend/schema.sql`.

## Usuarios y acceso

- `POST /api/users`: crea usuarios. Si no existe ninguno, el primero se crea como administrador.
- `GET /api/users`: lista usuarios, solo admin.
- `POST /api/auth/login`: inicia sesion y crea cookie `tpv_session`.
- `POST /api/auth/logout`: cierra sesion.
- `GET /api/auth/me`: devuelve el usuario autenticado.

Roles actuales:

- `admin`: acceso a `/tpv/admin/*`.
- `worker`: acceso a `/tpv` y `/tpv/pedidos`.

Paginas de acceso:

- `/tpv/login`: login de zona privada.
- `/tpv/setup`: alta inicial del primer administrador.

## Productos

CRUD inicial conectado a `tpv_products`.

- `GET /api/products`: lista productos.
- `POST /api/products`: crea producto.
- `GET /api/products/:id`: obtiene producto.
- `PUT /api/products/:id`: actualiza producto.
- `DELETE /api/products/:id`: borra producto.

## Mesas

Alta incremental conectada a `tpv_tables`.

- `GET /api/tables`: lista mesas.
- `POST /api/tables`: crea la siguiente mesa con `max(table_number) + 1`.
- `PATCH /api/tables/:id`: activa u oculta una mesa.
- `DELETE /api/tables/:id`: borra una mesa.

La impresion de QRs se realiza en cliente desde `/tpv/admin/mesas`.

## Pedidos

- `POST /api/orders`: crea un pedido de cliente o camarero.
- `GET /api/orders?status=pending&source=customer`: lista pedidos de cliente pendientes.
- `GET /api/orders?source=customer&tableNumber=1&includeItems=true`: lista pedidos de cliente de una mesa con lineas.
- `GET /api/orders?tableNumber=1&includeItems=true`: lista todos los pedidos de una mesa con lineas.
- `PATCH /api/orders/:id`: actualiza el estado, por ejemplo a `delivered`.
- `GET /api/orders/stream?tableNumber=1`: stream SSE para actualizar todos los pedidos de una mesa en tiempo real.

Cada `POST /api/orders` crea un ticket nuevo. En el TPV de camarero los clicks se empaquetan con debounce, asi que una rafaga de productos se envia como un solo POST y genera un solo ticket. Dentro de ese ticket, las lineas repetidas se agrupan por producto, origen y precio; si cliente y camarero piden lo mismo en tickets distintos, quedan en tickets distintos.
