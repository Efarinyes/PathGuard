import { AppStateProvider } from "@/hooks/useAppState";
import { RoleGuard } from "@/components/RoleGuard";
import { PWAInstallPrompt } from "@/components/PWAInstallPrompt";
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "PathGuard | Geo-protecció Discreta",
  description: "Seguiment de geolocalització discret per a pacients i cuidadors.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PathGuard",
    // startupImage: [] // Add splash screens here if available
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
        {/* Early PWA install event capture - MUST be in head */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              window.addEventListener('beforeinstallprompt', (e) => {
                e.preventDefault();
                window.deferredPrompt = e;
                window.dispatchEvent(new CustomEvent('pwa-installable'));
              });

              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/pathguard-sw.js').then(function(registration) {
                    console.log('SW registered:', registration.scope);
                  }, function(err) {
                    console.log('SW registration failed:', err);
                  });
                });
              }
            `,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <AppStateProvider>
          <RoleGuard>
            {children}
            <PWAInstallPrompt />
          </RoleGuard>
        </AppStateProvider>
      </body>
    </html>
  );
}

