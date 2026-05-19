import { AppStateProvider } from "@/hooks/useAppState";
import { SOSAlertProvider } from "@/hooks/useSOSAlert";
import { RoleGuard } from "@/components/RoleGuard";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import { PWAErrorBoundary } from "@/components/PWAErrorBoundary";
import ServiceWorkerRegistration from "@/lib/swRegistration";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PathGuard | Geo-protecció Discreta",
  description: "Seguiment de geolocalització discret per a la persona a càrrec i cuidadors.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PathGuard",
  },
  formatDetection: {
    telephone: false,
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export const viewport = {
  themeColor: "#1E3A8A",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ca"
      className={`${inter.variable} h-full antialiased`}
    >
      <head>
        <ServiceWorkerRegistration />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <PWAErrorBoundary>
          <SOSAlertProvider>
            <AppStateProvider>
              <RoleGuard>
                {children}
                <PWAInstallPrompt />
              </RoleGuard>
            </AppStateProvider>
          </SOSAlertProvider>
        </PWAErrorBoundary>
      </body>
    </html>
  );
}