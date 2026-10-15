import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Control de Bebidas & Bodega | Restaurante',
  description: 'Sistema inteligente de inventario de bebidas con escaneo de facturas por IA MiniMax',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#1b1915',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-page antialiased selection:bg-emerald-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
