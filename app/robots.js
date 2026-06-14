export default function robots() {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/TPV", "/TPV/", "/tpv", "/tpv/", "/pedido", "/pedido/"],
      },
    ],
  };
}
