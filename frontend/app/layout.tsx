import { AppStateProvider } from "@/hooks/useAppState";
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
    icon: "/icons/icon.svg",
    apple: "/icons/icon.svg",
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
      <body className="min-h-full flex flex-col font-sans">
        <AppStateProvider>
          {children}
          <PWAInstallPrompt />
        </AppStateProvider>
      </body>
    </html>
  );
}

