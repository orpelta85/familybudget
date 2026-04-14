import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import { Sidebar } from "@/components/layout/Sidebar";
import { BottomNav } from "@/components/layout/BottomNav";
import { MemberBanner } from "@/components/layout/MemberBanner";
import { ImpersonationBanner } from "@/components/layout/ImpersonationBanner";
import { MobileViewSelector } from "@/components/layout/MobileViewSelector";
import { Toaster } from "@/components/ui/sonner";
import { PwaRegister } from "@/components/PwaRegister";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_URL || 'https://familyplan.co.il'),
  title: "Family Plan",
  description: "סדר בבית, שקט בכיס — ניהול תקציב משפחתי חכם",
  icons: {
    icon: "/favicon.svg",
    apple: "/logo-familyplan.png",
  },
  manifest: "/manifest.json",
  openGraph: {
    images: ["/logo-familyplan.png"],
  },
  other: {
    "mobile-web-app-capable": "yes",
    "apple-mobile-web-app-status-bar-style": "black-translucent",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('theme')||'light';document.documentElement.setAttribute('data-theme',t)}catch(e){document.documentElement.setAttribute('data-theme','light')}})()` }} />
        <style dangerouslySetInnerHTML={{ __html: `.logo-dark{display:block}.logo-light{display:none}[data-theme="light"] .logo-dark{display:none}[data-theme="light"] .logo-light{display:block}` }} />
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
              <ImpersonationBanner />
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
