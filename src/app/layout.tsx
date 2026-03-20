import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Sidebar } from "@/components/layout/Sidebar";
import { BottomNav } from "@/components/layout/BottomNav";
import { MemberBanner } from "@/components/layout/MemberBanner";
import { MobileViewSelector } from "@/components/layout/MobileViewSelector";
import { Toaster } from "@/components/ui/sonner";
import { PwaRegister } from "@/components/PwaRegister";

export const metadata: Metadata = {
  title: "My Family Finance",
  description: "ניהול תקציב משפחתי חכם",
  icons: {
    icon: "/favicon.svg",
  },
  manifest: "/manifest.json",
  other: {
    "apple-mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Heebo:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
        <meta name="theme-color" content="#0066cc" />
        <link rel="apple-touch-icon" href="/icon-192.svg" />
      </head>
      <body>
        <Providers>
          <div className="page-layout">
            <Sidebar />
            <main className="main-content">
              <MobileViewSelector />
              <MemberBanner />
              {children}
            </main>
          </div>
          <BottomNav />
          <Toaster position="top-center" richColors />
          <PwaRegister />
        </Providers>
      </body>
    </html>
  );
}
