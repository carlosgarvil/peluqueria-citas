import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reserva tu cita",
  description: "Gestión de citas de peluquería",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#a83159" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
