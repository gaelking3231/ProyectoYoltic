import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YOLTIC — Zapotec Translation Dashboard",
  description:
    "Real-time monitoring dashboard for the YOLTIC Zapotec translation assistant. View live translations, manage devices, and configure smart glasses.",
  keywords: ["Zapotec", "translation", "dashboard", "YOLTIC", "indigenous languages"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body>{children}</body>
    </html>
  );
}
