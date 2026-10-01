import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "@fontsource/libre-baskerville/400.css";
import "@fontsource/libre-baskerville/700.css";
import "./globals.css";
import Nav from "@/components/Nav";
import InstallBanner from "@/components/InstallBanner";
import OfflineBanner from "@/components/OfflineBanner";
import { AuthProvider } from "@/context/AuthContext";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const metadata: Metadata = {
  title: "Priprema Proizvodnje",
  description: "Evidencija učinka inžinjera šumarstva",
  manifest: `${BASE}/manifest.json`,
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PRIPREMA",
  },
};

export const viewport: Viewport = {
  themeColor: "#15803d",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="bs">
      <head>
        <link rel="apple-touch-icon" href={`${BASE}/icons/icon-192.png`} />
      </head>
      <body className="min-h-screen">
        <AuthProvider>
          <Nav />
          <main className="max-w-7xl mx-auto px-4 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] md:pb-10">{children}</main>
          <InstallBanner />
          <OfflineBanner />
        </AuthProvider>
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker' in navigator){window.addEventListener('load',function(){navigator.serviceWorker.register('${BASE}/sw.js');})}`,
          }}
        />
      </body>
    </html>
  );
}
