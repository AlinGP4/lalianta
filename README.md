# La Lianta

Landing publica SSR con Next.js App Router.

## Desarrollo

```bash
npm install
npm run dev
```

La landing esta desactivada desde `middleware.js`: `/` responde 503 y noindex. El contenido original sigue en `index.html` y `app/page.jsx` para poder reactivarlo.

## Arquitectura

- `app`: landing publica desactivada temporalmente. El codigo queda listo para reactivarse cuando vuelva a estar disponible.
- `TPV`: zona privada del terminal punto de venta. La administracion entra por `/tpv/admin/productos`, mesas en `/tpv/admin/mesas`, caja en `/tpv/admin/caja`, usuarios en `/tpv/admin/usuarios`, historico en `/tpv/historico`, pedidos de camarero en `/tpv/pedidos` y pedido cliente desde QR en `/pedido?mesa=N`; estas rutas estan marcadas como `noindex`.
- `Backend`: logica de servidor, servicios, modelos e integraciones. Los endpoints de Next pueden exponerse desde `app/api` cuando los necesitemos.
