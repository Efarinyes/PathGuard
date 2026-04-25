
import { AppStateProvider } from "@/hooks/useAppState";
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
  icons: {
    icon: "/icons/icon.svg",
    apple: "/icons/icon.svg",
  },
  themeColor: "#1E3A8A",
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
        </AppStateProvider>
      </body>
    </html>
  );
}
