# La Lianta

Landing publica SSR con Next.js App Router.

## Desarrollo

```bash
npm install
npm run dev
```

La landing se sirve desde `/` y reutiliza el contenido actual de `index.html` como markup renderizado en servidor. Las interacciones de cliente viven en `app/landing-interactions.jsx`.

## Arquitectura

- `app`: landing publica e indexable. Aqui va la web orientada a SEO.
- `TPV`: zona privada del terminal punto de venta. El panel de administracion vive en `/tpv/admin` como dashboards con Chart.js, productos en `/tpv/admin/productos`, mesas en `/tpv/admin/mesas`, pedidos de camarero en `/tpv/pedidos` y pedido cliente desde QR en `/pedido?mesa=N`; estas rutas estan marcadas como `noindex`.
- `Backend`: logica de servidor, servicios, modelos e integraciones. Los endpoints de Next pueden exponerse desde `app/api` cuando los necesitemos.
