import type { Metadata, Viewport } from "next";
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";
import "@fontsource/manrope/500.css";
import "@fontsource/manrope/600.css";
import "@fontsource/manrope/700.css";
import "streamdown/styles.css";
import "./globals.css";
import { Pwa } from "@/components/pwa";

export const metadata: Metadata = {
  title: "GuIA Dados · Demonstração",
  description:
    "Demonstração do painel GuIA Dados com dados fictícios de empresas de Salvador.",
  robots: { index: false, follow: false },
  applicationName: "GuIA Dados",
  appleWebApp: {
    capable: true,
    title: "GuIA Dados",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#16142b",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        {children}
        <Pwa />
      </body>
    </html>
  );
}
