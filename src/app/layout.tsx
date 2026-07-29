import type { Metadata, Viewport } from "next";
import { Newsreader, Work_Sans } from "next/font/google";
import "./globals.css";

// Newsreader en cursiva para títulos y la marca; Work Sans para todo lo operativo.
const newsreader = Newsreader({
  variable: "--fuente-newsreader",
  subsets: ["latin"],
  style: ["italic", "normal"],
  weight: ["400", "500"],
  display: "swap",
});

const workSans = Work_Sans({
  variable: "--fuente-work",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "MOORA — Inventario y finanzas",
  description:
    "Control de inventario, ventas, compras y finanzas para MOORA (perfumes, skincare y maquillaje).",
};

// Pensado para usarse desde el celular
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#faf6f1",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${newsreader.variable} ${workSans.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-crema text-tinta">{children}</body>
    </html>
  );
}
