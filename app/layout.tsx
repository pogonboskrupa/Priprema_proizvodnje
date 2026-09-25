import type { Metadata, Viewport } from "next";
import { Geist, Libre_Baskerville } from "next/font/google";
import "./globals.css";
import Nav from "@/components/Nav";
import InstallBanner from "@/components/InstallBanner";
import { AuthProvider } from "@/context/AuthContext";

const geist = Geist({ subsets: ["latin"] });
const libreBaskerville = Libre_Baskerville({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-baskerville" });

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const metadata: Metadata = {
  title: "Priprema Proizvodnje",
  description: "Evidencija učinka inžinjera šumarstva",
  manifest: `${BASE}/manifest.json`,
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PripPro",
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
      <body className={`${geist.className} ${libreBaskerville.variable} min-h-screen`}>
        <AuthProvider>
          <Nav />
          <main className="max-w-7xl mx-auto px-4 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] md:pb-10">{children}</main>
          <InstallBanner />
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
