import "../styles.css";
import "../TPV/tpv.css";

export const metadata = {
  title: "La Lianta - Bar & Vinos · Betxí",
  description:
    "La Lianta - bar y discoteca en Betxí. Vinos, cócteles de autor, música en vivo y noches a recordar.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&family=Manrope:wght@400;500;600;700&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
